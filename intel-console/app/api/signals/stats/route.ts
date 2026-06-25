import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signals, entities } from "@/lib/schema";
import { sql, count } from "drizzle-orm";

// GET /intel/api/signals/stats
// Returns exact confidence distribution counts — no limit applied.
// Fixes the HIGH count mismatch where /anomalies?confidence=ALL hit a 50-row limit.
export async function GET() {
  const [confRows, entityCount] = await Promise.all([
    db
      .select({
        confidence: signals.confidence,
        cnt: count(signals.id),
      })
      .from(signals)
      .groupBy(signals.confidence),
    db
      .select({ cnt: count(entities.id) })
      .from(entities),
  ]);

  const dist: Record<string, number> = {};
  let total = 0;
  for (const row of confRows) {
    const key = String(row.confidence);
    const n   = Number(row.cnt);
    dist[key]  = n;
    total     += n;
  }

  return NextResponse.json({
    total,
    high:       dist["HIGH"]       ?? 0,
    low:        dist["LOW"]        ?? 0,
    unverified: dist["UNVERIFIED"] ?? 0,
    entities:   Number(entityCount[0]?.cnt ?? 0),
    distribution: dist,
  });
}
