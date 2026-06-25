import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { entities, entityEvents, signals as signalsTable, agentCostEvents } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [entity] = await db.select().from(entities).where(eq(entities.id, params.id)).limit(1);
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [recentEvents, latestSignals] = await Promise.all([
    db.select().from(entityEvents).where(eq(entityEvents.entityId, params.id)).orderBy(desc(entityEvents.occurredAt)).limit(50),
    db.select().from(signalsTable).where(eq(signalsTable.entityId, params.id)).orderBy(desc(signalsTable.t)).limit(20),
  ]);

  const costResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_operations,
      COALESCE(SUM(cost_usdc), 0) AS total_cost_usdc,
      COALESCE(SUM(cost_usdc) FILTER (WHERE created_at > NOW() - INTERVAL '24h'), 0) AS cost_24h,
      COALESCE(SUM(result_signals), 0) AS total_signals,
      COALESCE(AVG(efficiency_ratio) FILTER (WHERE efficiency_ratio > 0), 0) AS avg_efficiency
    FROM agent_cost_events
    WHERE entity_id = ${params.id}
  `).catch(() => ({ rows: [{}] }));

  const eventBreakdown = await db.execute(sql`
    SELECT event_type, severity, COUNT(*)::int AS count
    FROM entity_events WHERE entity_id = ${params.id}
    GROUP BY event_type, severity ORDER BY count DESC
  `).catch(() => ({ rows: [] }));

  return NextResponse.json({
    entity,
    events:         recentEvents,
    signals:        latestSignals,
    cost:           costResult.rows[0] ?? {},
    eventBreakdown: eventBreakdown.rows,
  });
}
