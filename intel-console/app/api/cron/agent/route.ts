import { NextRequest, NextResponse } from "next/server";
import { runScheduledCycles } from "@/lib/agent/scheduler";
import { runResolutionOracle } from "@/lib/polsignal/oracleResolver";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  // Run agent cycles and resolution oracle in parallel
  const [, oracleResult] = await Promise.allSettled([
    runScheduledCycles(),
    runResolutionOracle(),
  ]);

  const oracle = oracleResult.status === 'fulfilled' ? oracleResult.value : { error: String(oracleResult.reason) };
  return NextResponse.json({ status: "ok", ts: new Date().toISOString(), oracle });
}
