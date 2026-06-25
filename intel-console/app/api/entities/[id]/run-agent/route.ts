import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { entities } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { triggerAgentCycle } from "@/lib/agent/watchlistAgent";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const [entity] = await db.select().from(entities).where(eq(entities.id, params.id)).limit(1);
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cycleId = await triggerAgentCycle(params.id);
  return NextResponse.json({ status: "triggered", cycleId, entityId: params.id });
}
