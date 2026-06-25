// POST /api/ghost-witness/audit
// Main Ghost-Witness entry point.
// Accepts a conversation log, runs Vanguard consistency check,
// settles on Base L2 via LNES-05, returns CLC + receipt.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { extractClaims, type ConversationMessage } from "@/lib/ghost-witness/claimExtractor";
import { checkConsistency } from "@/lib/ghost-witness/consistencyChecker";
import { computeAuditHash, settleLNES05 } from "@/lib/ghost-witness/lnes05";

const STATUS_PENDING  = "pending";
const STATUS_COMPLETE = "complete";
const STATUS_FAILED   = "failed";

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key required. Set x-api-key header." },
      { status: 401 }
    );
  }

  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const keyRow  = await db.execute(sql`
    SELECT business_key, plan, active, wallet_address
    FROM gw_api_keys WHERE key_hash = ${keyHash} AND active = true LIMIT 1
  `);

  if (keyRow.rows.length === 0) {
    return NextResponse.json({ error: "Invalid or inactive API key." }, { status: 401 });
  }

  const { business_key: businessKey, wallet_address: walletAddress } =
    keyRow.rows[0] as { business_key: string; wallet_address: string | null };

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    conversation,
    conversation_id,
    platform   = "whatsapp",
    strip_pii  = false,
    agent_only = true,
  } = body as {
    conversation:    ConversationMessage[];
    conversation_id?: string;
    platform?:        string;
    strip_pii?:       boolean;
    agent_only?:      boolean;
  };

  if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
    return NextResponse.json(
      { error: "conversation is required and must be a non-empty array." },
      { status: 400 }
    );
  }

  const timestamp = new Date().toISOString();
  const auditId   = createHash("sha256")
    .update(`${businessKey}:${conversation_id ?? Date.now()}:${timestamp}`)
    .digest("hex")
    .slice(0, 32);

  // ── Create pending record ───────────────────────────────────────────────────
  await db.execute(sql`
    INSERT INTO ghost_witness_audits
      (audit_id, business_key, platform, conversation_id, status, audit_hash, created_at)
    VALUES
      (${auditId}, ${businessKey}, ${platform}, ${conversation_id ?? null},
       ${STATUS_PENDING}, ${auditId}, NOW())
  `);

  try {
    // Step 1 — Extract claims
    const claims = extractClaims(conversation, {
      agentOnly: agent_only,
      stripPII:  strip_pii,
    });

    // Step 2 — Vanguard consistency check
    const consistency = await checkConsistency(claims, conversation);

    // Step 3 — Compute deterministic audit hash
    const auditHash = computeAuditHash({
      conversationId: conversation_id ?? auditId,
      businessKey,
      clcDraft:       consistency as unknown as Record<string, unknown>,
      timestamp,
    });

    // Step 4 — LNES-05 settlement
    const receipt = await settleLNES05({
      auditHash,
      businessKey,
      walletAddress: walletAddress ?? undefined,
    });

    // Step 5 — Build Certificate of Logical Consistency
    const clc = {
      certificate_type:   "logical_consistency",
      version:            "1.0",
      issued_at:          timestamp,
      issued_by:          "ExergyNet Ghost-Witness LNES-05",
      conversation_id:    conversation_id ?? auditId,
      platform,
      claim_count:        claims.length,
      consistent:         consistency.consistent,
      overall_score:      consistency.overallScore,
      hallucination_risk: consistency.hallucinationRisk,
      flags:              consistency.flags,
      reasoning:          consistency.reasoning,
      settlement: {
        protocol:     "LNES-05",
        chain:        "Base L2",
        tx_hash:      receipt.txHash,
        block_number: receipt.blockNumber,
        audit_hash:   receipt.auditHash,
        cost_usdc:    receipt.costUsdc,
        clc_url:      receipt.clcUrl,
      },
    };

    // Update record to complete
    await db.execute(sql`
      UPDATE ghost_witness_audits
      SET
        claim_count   = ${claims.length},
        flags         = ${JSON.stringify(consistency.flags)},
        consistent    = ${consistency.consistent},
        confidence    = ${consistency.overallScore},
        vanguard_cost = ${consistency.vanguardCost},
        tx_hash       = ${receipt.txHash},
        audit_hash    = ${auditHash},
        clc_url       = ${receipt.clcUrl},
        status        = ${STATUS_COMPLETE},
        completed_at  = NOW()
      WHERE audit_id = ${auditId}
    `);

    return NextResponse.json({
      status:   STATUS_COMPLETE,
      audit_id: auditId,
      clc,
      receipt: {
        tx_hash:    receipt.txHash,
        audit_hash: receipt.auditHash,
        clc_url:    receipt.clcUrl,
        cost_usdc:  receipt.costUsdc,
      },
    });

  } catch (err) {
    await db.execute(sql`
      UPDATE ghost_witness_audits SET status = ${STATUS_FAILED} WHERE audit_id = ${auditId}
    `);
    return NextResponse.json(
      { error: "Audit failed", audit_id: auditId, detail: String(err) },
      { status: 500 }
    );
  }
}
