// app/api/admin/cleanup/route.ts
// POST /api/admin/cleanup — one-click system cleanup + restart
// Requires x-admin-token header matching GW_ADMIN_KEY

import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function GET(_req: NextRequest) {
  // Sysinfo endpoint — returns Azure disk + process state
  let disk = { total_gb: 0, used_gb: 0, free_gb: 0, pct: 0 };
  try {
    const out = execSync("df / --output=size,used,avail --block-size=1G | tail -1", { timeout: 5000 }).toString().trim();
    const [total, used, avail] = out.split(/\s+/).map(Number);
    disk = { total_gb: total, used_gb: used, free_gb: avail, pct: Math.round((used / total) * 100) };
  } catch { /* */ }

  let mem = { total_gb: 0, used_gb: 0, free_gb: 0, pct: 0 };
  try {
    const out = execSync("free -g | grep Mem", { timeout: 3000 }).toString().trim();
    const parts = out.split(/\s+/);
    const total = Number(parts[1]), used = Number(parts[2]), free = Number(parts[3]);
    mem = { total_gb: total, used_gb: used, free_gb: free, pct: Math.round((used / total) * 100) };
  } catch { /* */ }

  return NextResponse.json(
    { ok: true, host: "azure-gamma", disk, mem, ts: Math.floor(Date.now() / 1000) },
    { headers: CORS }
  );
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (token !== process.env.GW_ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  const log: string[] = [];
  const start = Date.now();

  const run = (cmd: string, label: string) => {
    try {
      const out = execSync(cmd, { timeout: 30000 }).toString().trim();
      log.push(`✓ ${label}${out ? ": " + out.slice(0, 80) : ""}`);
    } catch (e: unknown) {
      log.push(`✗ ${label}: ${e instanceof Error ? e.message.slice(0, 60) : "error"}`);
    }
  };

  // 1. Disk before
  let diskBefore = 0;
  try {
    const out = execSync("df / --output=used --block-size=1G | tail -1", { timeout: 3000 }).toString().trim();
    diskBefore = Number(out);
  } catch { /* */ }
  log.push(`Disk before: ${diskBefore}GB used`);

  // 2. Flush PM2 logs
  run("pm2 flush 2>/dev/null || true", "PM2 logs flushed");

  // 3. Truncate large log files
  run(
    "find /home/azureuser/.pm2/logs -name '*.log' -size +10M -exec truncate -s 0 {} \\;",
    "Large PM2 logs truncated"
  );

  // 4. Clear .next build cache from old builds
  run(
    "find /home/azureuser/intel-console/.next/cache -name '*.pack' -mtime +3 -delete 2>/dev/null || true",
    ".next old cache packs cleared"
  );

  // 5. Clear system journal
  run("sudo journalctl --vacuum-size=100M 2>&1 | tail -1", "Journals vacuumed");

  // 6. Clear apt cache
  run("sudo apt-get clean 2>/dev/null || true", "APT cache cleared");

  // 7. Restart intel-ingest-cron if stopped
  run("pm2 describe intel-ingest-cron | grep -q stopped && pm2 start intel-ingest-cron || echo 'already running'", "Ingest cron checked");

  // 8. Disk after
  let diskAfter = 0;
  try {
    const out = execSync("df / --output=used --block-size=1G | tail -1", { timeout: 3000 }).toString().trim();
    diskAfter = Number(out);
  } catch { /* */ }
  const freedGB = diskBefore - diskAfter;
  log.push(`Disk after: ${diskAfter}GB used (freed ${freedGB}GB)`);

  // 9. Trigger Apex Router cleanup via its cleanup server
  let apexResult: Record<string, unknown> = {};
  try {
    const apexRes = await fetch("https://explorer-api.exergynet.org/api/admin/cleanup", {
      method: "POST",
      headers: { "x-admin-token": "ExergyNetCommandCenter2026", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (apexRes.ok) {
      apexResult = await apexRes.json() as Record<string, unknown>;
      const apexLog = apexResult.log as string[] | undefined;
      log.push(`Apex Router cleanup: ${apexLog?.at(-1) ?? "ok"}`);
    }
  } catch (e) {
    log.push(`Apex Router cleanup: unreachable (${e instanceof Error ? e.message.slice(0, 40) : "error"})`);
  }

  return NextResponse.json(
    {
      ok: true,
      duration_ms: Date.now() - start,
      azure_log: log,
      apex: apexResult,
      freed_gb: freedGB,
    },
    { headers: CORS }
  );
}
