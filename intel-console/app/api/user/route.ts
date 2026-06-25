// app/api/user/route.ts
// Returns complete user state: tier, score, daily usage, predictions history.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getTierConfig, canPredict, remainingPredictions, getScoreTier, CPTX_RULES } from "@/lib/tiers";
import type { Tier } from "@/lib/tiers";

export async function GET(req: NextRequest) {
  const userKey = req.headers.get("x-user-key") ?? "default";

  // Upsert user row
  await db.execute(sql`
    INSERT INTO cptx_balances (user_key, score, tier, prediction_count, correct_count, daily_used, daily_reset_at)
    VALUES (${userKey}, 0, 'free', 0, 0, 0, NOW())
    ON CONFLICT (user_key) DO NOTHING
  `);

  // Reset daily_used if past 24h
  await db.execute(sql`
    UPDATE cptx_balances
    SET daily_used = 0, daily_reset_at = NOW()
    WHERE user_key = ${userKey}
    AND daily_reset_at < NOW() - INTERVAL '24 hours'
  `);

  const result = await db.execute(sql`
    SELECT score, tier, prediction_count, correct_count,
           daily_used, daily_reset_at, pro_expires_at, api_key, balance
    FROM cptx_balances
    WHERE user_key = ${userKey}
    LIMIT 1
  `);

  const row = (result.rows ?? result)[0] as {
    score: number;
    tier: string;
    prediction_count: number;
    correct_count: number;
    daily_used: number;
    daily_reset_at: string;
    pro_expires_at: string | null;
    api_key: string | null;
    balance: number;
  };

  // Downgrade expired Pro
  let effectiveTier = (row.tier ?? "free") as Tier;
  if (effectiveTier === "pro" && row.pro_expires_at && new Date(row.pro_expires_at) < new Date()) {
    effectiveTier = "free";
    await db.execute(sql`UPDATE cptx_balances SET tier = 'free' WHERE user_key = ${userKey}`);
  }

  const score    = Number(row.score ?? 0);
  const dailyUsed = Number(row.daily_used ?? 0);
  const predCount = Number(row.prediction_count ?? 0);
  const corrCount = Number(row.correct_count ?? 0);

  const tierConfig  = getTierConfig(effectiveTier);
  const scoreTier   = getScoreTier(score);
  const accuracy    = predCount > 0 ? Math.round((corrCount / predCount) * 100) : 0;

  // Fetch this user's predictions via their transaction log
  const recentPreds = await db.execute(sql`
    SELECT p.id, p.entity_id, p.metric, p.prediction, p.polymarket_market_id,
           p.polymarket_question, p.polymarket_yes_price,
           p.resolved, p.resolved_correct, p.score_delta, p.created_at
    FROM predictions p
    JOIN cptx_transactions t ON t.prediction_id = p.id
    WHERE t.user_key = ${userKey}
      AND t.action = 'prediction_cast'
    ORDER BY p.created_at DESC
    LIMIT 50
  `);

  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const msUntil = nextReset.getTime() - now.getTime();
  const h = Math.floor(msUntil / 3600000);
  const m = Math.floor((msUntil % 3600000) / 60000);

  return NextResponse.json({
    userKey,
    score,
    scoreTier:      scoreTier.label,
    scoreTierColor: scoreTier.color,
    tier:           effectiveTier,
    tierConfig,
    predictionCount: predCount,
    correctCount:    corrCount,
    accuracy,
    dailyUsed,
    remaining:   remainingPredictions(dailyUsed, effectiveTier),
    canPredict:  canPredict(dailyUsed, effectiveTier),
    resetIn:     `${h}h ${m}m`,
    hasApiKey:   !!row.api_key,
    predictions: (recentPreds.rows ?? recentPreds) as Record<string, unknown>[],
    cptxRules:   CPTX_RULES,
  });
}
