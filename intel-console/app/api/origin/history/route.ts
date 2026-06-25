// app/api/origin/history/route.ts
// GET /api/origin/history?hours=168
// Real hourly-bucketed history for the 4 LNES vectors (replaces fabricated mockSeries).
// Each series: [{ date: ISO-hour, value: number }]. Public read, CORS enabled.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
const CORS = { "Access-Control-Allow-Origin": "*" };

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: { ...CORS, "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": "Content-Type" },
  });
}

let _cache: { at: number; hours: number; body: any } | null = null;
const TTL = 120_000; // 2 min

type Pt = { date: string; value: number };

export async function GET(req: NextRequest) {
  const hours = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("hours") || "168"), 24), 720);
  if (_cache && _cache.hours === hours && Date.now() - _cache.at < TTL) {
    return NextResponse.json(_cache.body, { headers: { ...CORS, "X-Origin-Cache": "hit" } });
  }

  const safe = async (q: any): Promise<Pt[]> => {
    try {
      const r = await db.execute(q);
      return (r.rows as { bucket: string; value: number | string }[]).map((x) => ({
        date: new Date(x.bucket).toISOString().split("T")[0],
        value: Number(x.value) || 0,
      }));
    } catch {
      return [];
    }
  };

  // HIGH signals per hour
  const intel_signals = await safe(sql`
    SELECT date_trunc('day', t) AS bucket, COUNT(*) FILTER (WHERE confidence = 'HIGH')::int AS value
    FROM signals WHERE t > NOW() - (${hours} || ' hours')::interval
    GROUP BY 1 ORDER BY 1`);

  // Vanguard ops per hour
  const vanguard = await safe(sql`
    SELECT date_trunc('day', created_at) AS bucket, COUNT(*)::int AS value
    FROM agent_cost_events WHERE created_at > NOW() - (${hours} || ' hours')::interval
    GROUP BY 1 ORDER BY 1`);

  // CRITICAL/HIGH entity events per hour
  const event_stress = await safe(sql`
    SELECT date_trunc('day', created_at) AS bucket, COUNT(*) FILTER (WHERE severity IN ('CRITICAL','HIGH'))::int AS value
    FROM entity_events WHERE created_at > NOW() - (${hours} || ' hours')::interval
    GROUP BY 1 ORDER BY 1`);

  // CLC inconsistency rate per hour (0 when no CLCs that hour)
  const truth_stress = await safe(sql`
    SELECT date_trunc('day', created_at) AS bucket,
           CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE consistent = false)::float / COUNT(*) ELSE 0 END AS value
    FROM ghost_witness_audits WHERE created_at > NOW() - (${hours} || ' hours')::interval AND status = 'complete'
    GROUP BY 1 ORDER BY 1`);

  const body = {
    hours,
    generated_at: new Date().toISOString(),
    series: { intel_signals, vanguard, event_stress, truth_stress },
    points: {
      intel_signals: intel_signals.length,
      vanguard: vanguard.length,
      event_stress: event_stress.length,
      truth_stress: truth_stress.length,
    },
  };

  _cache = { at: Date.now(), hours, body };
  return NextResponse.json(body, { headers: { ...CORS, "X-Origin-Cache": "miss" } });
}

