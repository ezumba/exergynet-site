import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signals, entities } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const confidence = searchParams.get("confidence") ?? "HIGH";
  const entityId   = searchParams.get("entityId");

  const conditions: any[] = [];
  if (confidence !== "ALL") conditions.push(eq(signals.confidence, confidence as any));
  if (entityId)              conditions.push(eq(signals.entityId, entityId));

  const rows = await db
    .select({
      id:         signals.id,
      entityId:   signals.entityId,
      entityName: entities.name,
      metric:     signals.metric,
      signalType: signals.signalType,
      value:      signals.value,
      confidence: signals.confidence,
      t:          signals.t,
      params:     signals.params,
    })
    .from(signals)
    .leftJoin(entities, eq(signals.entityId, entities.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(signals.t))
    .limit(50);

  return NextResponse.json(rows);
}
