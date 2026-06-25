// GET /api/ghost-witness/audits
// Returns audit history for the dashboard. No auth for now (internal Intel Console).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const result = await db.execute(sql`
    SELECT audit_id, conversation_id, platform, claim_count, consistent,
           confidence, flags, settlement_cost, clc_url, tx_hash, status, created_at
    FROM ghost_witness_audits
    ORDER BY created_at DESC
    LIMIT 100
  `);
  return NextResponse.json({ audits: result.rows });
}
