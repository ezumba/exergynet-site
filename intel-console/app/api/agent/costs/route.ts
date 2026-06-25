import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const result = await db.execute(sql`
    SELECT
      e.id, e.name, e.symbol, e.type, e.entity_subtype,
      e.last_agent_run, e.baseline_ready,
      COALESCE(SUM(ace.cost_usdc), 0) AS total_cost,
      COALESCE(SUM(ace.cost_usdc) FILTER (WHERE ace.created_at > NOW() - INTERVAL '24h'), 0) AS cost_24h,
      COALESCE(SUM(ace.cost_usdc) FILTER (WHERE ace.created_at > NOW() - INTERVAL '30d'), 0) AS cost_30d,
      COALESCE(SUM(ace.result_signals), 0) AS signals_produced,
      COALESCE(AVG(ace.efficiency_ratio) FILTER (WHERE ace.efficiency_ratio > 0), 0) AS efficiency
    FROM entities e
    LEFT JOIN agent_cost_events ace ON ace.entity_id = e.id
    GROUP BY e.id, e.name, e.symbol, e.type, e.entity_subtype, e.last_agent_run, e.baseline_ready
    ORDER BY cost_24h DESC NULLS LAST
  `);

  const totalMtd = result.rows.reduce((s, r) => s + Number((r as any).cost_30d ?? 0), 0);
  return NextResponse.json({ entities: result.rows, totalMtdUsdc: totalMtd.toFixed(8), timestamp: new Date().toISOString() });
}
