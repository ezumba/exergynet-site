import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seriesPoints, signals } from "@/lib/schema";
import { eq, and, asc } from "drizzle-orm";
import { OPERATORS } from "@/lib/signals";

export async function POST(req: Request) {
  const { entityId, metric, operator, params } = await req.json();

  // always fetch at least 60 points regardless of window size
  const fetchLimit = Math.max(60, (params?.window ?? 20) + 5);

  const pts = await db
    .select({ value: seriesPoints.value })
    .from(seriesPoints)
    .where(and(eq(seriesPoints.entityId, entityId), eq(seriesPoints.metric, metric)))
    .orderBy(asc(seriesPoints.t))
    .limit(fetchLimit);

  const values = pts.map(p => parseFloat(p.value));
  const fn     = OPERATORS[operator];
  if (!fn) return NextResponse.json({ error: "Unknown operator" }, { status: 400 });

  const result = fn(values, params?.window);

  await db.insert(signals).values({
    entityId, metric,
    t:          new Date(),
    signalType: operator,
    value:      String(result.value),
    params:     result.params,
    confidence: result.confidence,
  });

  return NextResponse.json(result);
}
