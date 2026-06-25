// app/api/intel/proofs/route.ts
// "I Saw It First" — early detection proofs API
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userKey = req.nextUrl.searchParams.get('userKey') ?? 'default';
  const limit   = parseInt(req.nextUrl.searchParams.get('limit') ?? '20');

  // Fetch all proofs with entity info
  const proofs = await db.execute(sql`
    SELECT ed.*, e.name as entity_display_name, e.type as entity_type, e.symbol
    FROM early_detections ed
    JOIN entities e ON e.id = ed.entity_id
    ORDER BY ed.agent_detected_at DESC
    LIMIT ${limit}
  `);

  const rows = (proofs.rows ?? proofs) as any[];

  // Compute reputation stats
  const stats = await db.execute(sql`
    SELECT
      COUNT(*)                                         AS total_detections,
      COUNT(*) FILTER (WHERE lead_time_seconds > 0)   AS with_lead_time,
      AVG(lead_time_seconds) FILTER (WHERE lead_time_seconds > 0) AS avg_lead_seconds,
      MAX(lead_time_seconds)                           AS max_lead_seconds
    FROM early_detections
  `);
  const s = (stats.rows ?? stats)[0] as any;

  // Category breakdown
  const cats = await db.execute(sql`
    SELECT event_type,
           COUNT(*) AS count,
           AVG(lead_time_seconds) FILTER (WHERE lead_time_seconds > 0) AS avg_lead
    FROM early_detections
    GROUP BY event_type ORDER BY count DESC
  `);

  return NextResponse.json({
    proofs: rows,
    reputation: {
      totalDetections:   Number(s?.total_detections ?? 0),
      withLeadTime:      Number(s?.with_lead_time ?? 0),
      avgLeadSeconds:    Number(s?.avg_lead_seconds ?? 0),
      maxLeadSeconds:    Number(s?.max_lead_seconds ?? 0),
      detectionScore:    computeScore(rows),
      categories:        (cats.rows ?? cats) as any[],
    },
  });
}

function computeScore(rows: any[]): number {
  return rows.reduce((acc, r) => {
    const secs = Number(r.lead_time_seconds ?? 0);
    if (secs <= 0) return acc + 10; // detecting any signal = 10 pts
    const hours = secs / 3600;
    return acc + Math.min(100, 10 + hours * 5); // +5 pts/hour of lead time, cap 100
  }, 0);
}
