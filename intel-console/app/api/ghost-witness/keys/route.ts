// POST /api/ghost-witness/keys
// Provision a Ghost-Witness API key.
// Gated by GW_ADMIN_KEY env var.

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const adminKey = req.headers.get("x-admin-key");
  if (!adminKey || adminKey !== process.env.GW_ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { business_key, plan = "pay_per_audit", wallet_address } = body as {
    business_key:    string;
    plan?:           string;
    wallet_address?: string;
  };

  if (!business_key) {
    return NextResponse.json({ error: "business_key required." }, { status: 400 });
  }

  const rawKey    = `gw_live_${randomBytes(24).toString("hex")}`;
  const keyHash   = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  await db.execute(sql`
    INSERT INTO gw_api_keys (business_key, key_hash, key_prefix, plan, wallet_address)
    VALUES (${business_key}, ${keyHash}, ${keyPrefix}, ${plan}, ${wallet_address ?? null})
    ON CONFLICT (business_key) DO UPDATE
    SET key_hash = ${keyHash}, key_prefix = ${keyPrefix}, active = true
  `);

  return NextResponse.json({
    api_key:      rawKey,
    key_prefix:   keyPrefix,
    business_key,
    plan,
    message: "Store this key securely. It will not be shown again.",
  });
}
