// app/api/entities/watchlist-stats/route.ts
// Returns per-entity 24h cost, signal breakdown, event counts for watchlist table
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [costs, signals, events] = await Promise.all([
    // 24h cost + signal count per entity
    db.execute(sql`
      SELECT entity_id,
             SUM(cost_usdc)::float        AS cost_24h,
             SUM(result_signals)::integer AS signals_24h
      FROM agent_cost_events
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY entity_id
    `),
    // Signal confidence breakdown per entity
    db.execute(sql`
      SELECT entity_id, confidence, COUNT(*)::integer AS cnt
      FROM signals
      WHERE t > NOW() - INTERVAL '7 days'
      GROUP BY entity_id, confidence
    `),
    // Total event count per entity
    db.execute(sql`
      SELECT entity_id, COUNT(*)::integer AS total_events
      FROM entity_events
      GROUP BY entity_id
    `),
  ]);

  // Index by entity_id
  const costMap: Record<string, { cost_24h: number; signals_24h: number }> = {};
  for (const r of (costs.rows ?? costs) as any[]) {
    costMap[r.entity_id] = { cost_24h: Number(r.cost_24h ?? 0), signals_24h: Number(r.signals_24h ?? 0) };
  }

  const sigMap: Record<string, Record<string, number>> = {};
  for (const r of (signals.rows ?? signals) as any[]) {
    if (!sigMap[r.entity_id]) sigMap[r.entity_id] = {};
    sigMap[r.entity_id][r.confidence] = Number(r.cnt);
  }

  const evtMap: Record<string, number> = {};
  for (const r of (events.rows ?? events) as any[]) {
    evtMap[r.entity_id] = Number(r.total_events);
  }

  return NextResponse.json({ costs: costMap, signals: sigMap, events: evtMap });
}
