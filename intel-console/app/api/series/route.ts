import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seriesPoints } from "@/lib/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const metric   = searchParams.get("metric") ?? "price";
  if (!entityId) return NextResponse.json([], { status: 400 });
  const rows = await db.select({ t: seriesPoints.t, value: seriesPoints.value })
    .from(seriesPoints)
    .where(and(eq(seriesPoints.entityId, entityId), eq(seriesPoints.metric, metric)))
    .orderBy(asc(seriesPoints.t))
    .limit(120);
  return NextResponse.json(rows);
}
