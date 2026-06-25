// app/api/cron/oracle/route.ts
// Resolution oracle cron endpoint.
// Called every 15 min by the same ingest_cron.mjs that drives agent cycles.
// Safe to call concurrently — uses DB-level predicate (resolved = false).

import { NextRequest, NextResponse } from "next/server";
import { runResolutionOracle } from "@/lib/polsignal/oracleResolver";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Optional cron secret guard (same pattern as agent cron)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
    if (auth !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const started = Date.now();
  const result = await runResolutionOracle();

  return NextResponse.json({
    status:   'ok',
    ts:       new Date().toISOString(),
    duration: `${Date.now() - started}ms`,
    ...result,
  });
}
