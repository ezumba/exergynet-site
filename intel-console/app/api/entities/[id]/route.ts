import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { entities } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;

  // Cascade delete in dependency order
  await db.execute(sql`DELETE FROM entity_events     WHERE entity_id = ${id}`);
  await db.execute(sql`DELETE FROM agent_cost_events WHERE entity_id = ${id}`);
  await db.execute(sql`DELETE FROM agent_activities  WHERE entity_id = ${id}`);
  await db.execute(sql`DELETE FROM series_points     WHERE entity_id = ${id}`);
  await db.execute(sql`DELETE FROM signals           WHERE entity_id = ${id}`);
  await db.execute(sql`DELETE FROM entities          WHERE id        = ${id}`);

  return NextResponse.json({ deleted: true, id });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { name, symbol, groundTruthUrl, agentSources, agentFrequency, agentEnabled } = body;

  await db.execute(sql`
    UPDATE entities SET
      name             = COALESCE(${name || null},            name),
      symbol           = COALESCE(${symbol || null},          symbol),
      ground_truth_url = COALESCE(${groundTruthUrl || null},  ground_truth_url),
      agent_sources    = COALESCE(${agentSources ? JSON.stringify(agentSources) : null}::jsonb, agent_sources),
      agent_frequency  = COALESCE(${agentFrequency || null},  agent_frequency),
      agent_enabled    = COALESCE(${agentEnabled != null ? agentEnabled : null}, agent_enabled)
    WHERE id = ${params.id}
  `);

  const [updated] = await db.select().from(entities).where(eq(entities.id, params.id)).limit(1);
  return NextResponse.json(updated);
}
