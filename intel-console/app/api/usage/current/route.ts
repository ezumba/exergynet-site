import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usageEvents } from "@/lib/schema";
import { gte } from "drizzle-orm";

export async function GET() {
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);

  const rows = await db.select().from(usageEvents).where(gte(usageEvents.createdAt, start));

  const totals = rows.reduce((acc, r) => ({
    promptTokens:     acc.promptTokens     + (r.promptTokens     ?? 0),
    completionTokens: acc.completionTokens + (r.completionTokens ?? 0),
    costUsdc:         acc.costUsdc         + parseFloat(r.costUsdc ?? "0"),
    operations:       acc.operations       + 1,
  }), { promptTokens: 0, completionTokens: 0, costUsdc: 0, operations: 0 });

  return NextResponse.json(totals);
}
