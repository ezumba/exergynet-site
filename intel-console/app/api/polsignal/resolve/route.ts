// app/api/polsignal/resolve/route.ts
// Called by scheduled job or webhook when a market resolves.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { CPTX_RULES } from "@/lib/tiers";
import { resolveMarket } from "@/lib/agent/oracleClient";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { marketId, resolvedOutcome, resolutionSource, adminKey } = body;

  if (adminKey !== process.env.RESOLUTION_ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["YES", "NO"].includes(resolvedOutcome)) {
    return NextResponse.json({ error: "resolvedOutcome must be YES or NO" }, { status: 400 });
  }

  const preds = await db.execute(sql`
    SELECT p.id, p.prediction, p.entity_id
    FROM predictions p
    WHERE p.polymarket_market_id = ${marketId} AND p.resolved = false
  `);

  if ((preds.rows ?? preds).length === 0) {
    return NextResponse.json({ status: "no_predictions", marketId });
  }

  let resolved = 0, correct = 0, wrong = 0;

  for (const pred of (preds.rows ?? preds) as { id: string; prediction: string }[]) {
    const isCorrect =
      (pred.prediction === "UP"   && resolvedOutcome === "YES") ||
      (pred.prediction === "DOWN" && resolvedOutcome === "NO");

    const scoreDelta = isCorrect
      ? CPTX_RULES.CORRECT_PREDICTION + CPTX_RULES.PARTICIPATION
      : CPTX_RULES.WRONG_PREDICTION   + CPTX_RULES.PARTICIPATION;

    await db.execute(sql`
      UPDATE predictions
      SET resolved = true, resolved_correct = ${isCorrect},
          score_delta = ${scoreDelta}, resolution_source = ${resolutionSource ?? "manual"},
          scored_at = NOW()
      WHERE id = ${pred.id}
    `);

    const txRow = await db.execute(sql`
      SELECT user_key FROM cptx_transactions WHERE prediction_id = ${pred.id} LIMIT 1
    `);
    const userKey = ((txRow.rows ?? txRow)[0] as { user_key: string } | undefined)?.user_key;
    if (!userKey) continue;

    await db.execute(sql`
      UPDATE cptx_balances
      SET score = score + ${scoreDelta},
          correct_count = correct_count + ${isCorrect ? 1 : 0},
          updated_at = NOW()
      WHERE user_key = ${userKey}
    `);

    const newScoreResult = await db.execute(sql`
      SELECT score FROM cptx_balances WHERE user_key = ${userKey} LIMIT 1
    `);
    const newScore = Number(((newScoreResult.rows ?? newScoreResult)[0] as { score: number })?.score ?? 0);

    await db.execute(sql`
      INSERT INTO cptx_transactions (user_key, action, delta, balance_after, prediction_id)
      VALUES (
        ${userKey},
        ${isCorrect ? "correct_prediction" : "wrong_prediction"},
        ${scoreDelta}, ${newScore}, ${pred.id}
      )
    `);

    resolved++;
    if (isCorrect) correct++; else wrong++;
  }

  // Non-blocking oracle calibration update (Part 7)
  const question = body.question ?? marketId;
  if (question) {
    resolveMarket(String(question), resolvedOutcome === "YES").catch(() => {});
  }

    return NextResponse.json({ status: "resolved", marketId, resolved, correct, wrong, outcome: resolvedOutcome });
}
