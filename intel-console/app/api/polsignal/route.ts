// app/api/polsignal/route.ts
// PolSignal unified orchestrator — Polymarket + Kalshi + Intel Console signals
// v3: reputation model — no CPTX spend, daily prediction limits by tier

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signals, entities } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { fetchPolyMarkets } from "@/lib/polymarketAdapter";
import { fetchKalshiMarkets } from "@/lib/kalshiAdapter";
import {
  matchSignalToMarket, computeSystemPrediction,
  loadDomainRules, deduplicateSignals, IntelSignal,
  extractPriceThreshold,
} from "@/lib/polsignal/signalMatcher";
import { callOracle, OracleResult } from "@/lib/agent/oracleClient";
import { getPriceHistory } from "@/lib/agent/priceHistory";
import { canPredict, getTierConfig, remainingPredictions } from "@/lib/tiers";
import type { Tier } from "@/lib/tiers";

// ─── GET /api/polsignal ───────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  // 1. Load best signal per entity+metric — HIGH confidence wins over recency
  // Uses DISTINCT ON to pick the top-confidence, most-recent z_score per entity
  // This prevents UNVERIFIED noise from burying valuable HIGH signals from earlier
  const bestSignalRows = await db.execute(sql`
    SELECT DISTINCT ON (s.entity_id, s.metric)
      s.id, s.entity_id AS "entityId", e.name AS "entityName",
      s.metric, s.signal_type AS "signalType",
      s.value, s.confidence, s.t
    FROM signals s
    LEFT JOIN entities e ON e.id = s.entity_id
    ORDER BY s.entity_id, s.metric,
      CASE s.confidence WHEN 'HIGH' THEN 0 WHEN 'LOW' THEN 1 ELSE 2 END ASC,
      CASE s.signal_type WHEN 'z_score' THEN 0 ELSE 1 END ASC,
      s.t DESC
  `);

  const intelSignals: IntelSignal[] = ((bestSignalRows.rows ?? bestSignalRows) as Record<string, unknown>[]).map(s => ({
    id:         String(s.id ?? ""),
    entityId:   String(s.entityId ?? ""),
    entityName: String(s.entityName ?? s.entityId ?? ""),
    metric:     String(s.metric ?? "price"),
    signalType: String(s.signalType ?? "z_score"),
    value:      parseFloat(String(s.value ?? "0")) || 0,
    confidence: (String(s.confidence ?? "UNVERIFIED")) as "HIGH" | "LOW" | "UNVERIFIED",
    t:          s.t ? new Date(String(s.t)).toISOString() : new Date().toISOString(),
  }));
  // deduplicateSignals still applied as a safety net
  const dedupedSignals = deduplicateSignals(intelSignals);
  console.log("[PolSignal] best signals loaded:", dedupedSignals.length,
    "| HIGH:", dedupedSignals.filter(s => s.confidence === "HIGH").length,
    "| LOW:", dedupedSignals.filter(s => s.confidence === "LOW").length);

  // 2. Fetch live markets in parallel
  const [polyResult, kalshiResult] = await Promise.allSettled([
    fetchPolyMarkets(300),   // 3 pages × 100 = up to 300 Polymarket markets
    fetchKalshiMarkets(600), // 3 pages × 200 = up to 600 Kalshi markets
  ]);
  const polyMarkets   = polyResult.status   === "fulfilled" ? polyResult.value   : [];
  const kalshiMarkets = kalshiResult.status === "fulfilled" ? kalshiResult.value : [];

  // 3. Load domain rules
  const rules = loadDomainRules();

  // 4. Enrich each market — oracle-powered with legacy fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichMarket = async (market: { id: string; question: string; yesPrice: number; source: string; volume: number } & Record<string, any>) => {
    const signal = matchSignalToMarket(market.question, dedupedSignals);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let systemPrediction: any;

    if (signal) {
      try {
        const history = await getPriceHistory(signal.entityId);
        const oracleResult = await callOracle({
          question:        market.question,
          crowd_prob:      market.yesPrice,
          entity:          signal.entityName,
          current_price:   history.currentPrice ?? signal.value,
          price_history:   history.prices,
          volume_history:  history.volumes.length > 0 ? history.volumes : undefined,
          current_volume:  history.currentVolume ?? undefined,
          resolution_date: market.endDate ?? undefined,
          threshold:       extractPriceThreshold(market.question) ?? undefined,
        });
        // Always get legacy prediction for probability accuracy
        const legacyPred = computeSystemPrediction(signal, rules, market.question, signal.entityName);
        if (oracleResult) {
          // Use legacy probability (better for price-level questions) but attach oracle metadata
          // Use oracle probability only when it has real channel confidence
          const useOracleProb = oracleResult.system_confidence > 0.3;
          const finalProb = useOracleProb ? oracleResult.system_prob : legacyPred.probability;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const strong = Object.entries(oracleResult.channel_votes)
            .filter(([, v]) => (v as any).confidence > 0.3 && (v as any).vote !== "FLAT")
            .map(([n, v]) => n + ": " + (v as any).vote + " (" + ((v as any).confidence * 100).toFixed(0) + "%)");
          const divergence_check = Math.abs((market.yesPrice ?? 0.5) - finalProb);
          systemPrediction = {
            direction:  finalProb > 0.6 ? "UP" : finalProb < 0.4 ? "DOWN" : "FLAT",
            probability: finalProb,
            rationale:  strong.length > 0 ? strong.slice(0, 3).join(" · ") : legacyPred.rationale,
            domainRule: legacyPred.domainRule,
            oracleData: {
              confidence:   oracleResult.system_confidence,
              channelVotes: oracleResult.channel_votes,
              isfTriggered: divergence_check > 0.25 && finalProb !== 0.5,
              proofHash:    oracleResult.proof_hash,
              rawProb:      oracleResult.raw_prob,
            },
          };
        } else {
          systemPrediction = legacyPred;
        }
      } catch {
        systemPrediction = computeSystemPrediction(signal, rules, market.question, signal.entityName);
      }
    } else {
      systemPrediction = computeSystemPrediction(null, rules, market.question);
    }

    const divergence = Math.round(Math.abs(market.yesPrice - systemPrediction.probability) * 1000) / 1000;
    return { ...market, signal, systemPrediction, divergence };
  };

  const polyEnriched   = await Promise.all(polyMarkets.map(m => enrichMarket({ ...m, source: "polymarket" as const })));
  const kalshiEnriched = await Promise.all(kalshiMarkets.map(m => enrichMarket({ ...m, source: "kalshi" as const })));
  const allMarkets     = deduplicateCrossSource([...polyEnriched, ...kalshiEnriched]);
  allMarkets.sort((a, b) => b.divergence - a.divergence);

  return NextResponse.json({
    markets: allMarkets,
    signals: dedupedSignals,
    rules:   rules.map(r => ({
      ...r,
      confidence: Math.round(((r.clarity * 0.7) + (r.weight * 0.3)) * 1000) / 1000,
    })),
    meta: {
      polyCount:   polyMarkets.length,
      kalshiCount: kalshiMarkets.length,
      signalCount: dedupedSignals.length,
      timestamp:   new Date().toISOString(),
    },
  });
}

// ─── POST /api/polsignal ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    marketId, source, question, prediction, yesPrice,
    systemProbability, divergence, signalId, entityId, metric,
    zScoreAtVote, userKey = "default",
  } = body;

  if (!["UP", "DOWN", "FLAT"].includes(prediction)) {
    return NextResponse.json({ error: "Invalid prediction. Must be UP, DOWN, or FLAT." }, { status: 400 });
  }

  // Upsert user
  await db.execute(sql`
    INSERT INTO cptx_balances (user_key, score, tier, prediction_count, correct_count, daily_used, daily_reset_at)
    VALUES (${userKey}, 0, 'free', 0, 0, 0, NOW())
    ON CONFLICT (user_key) DO NOTHING
  `);

  // Reset daily counter if stale
  await db.execute(sql`
    UPDATE cptx_balances
    SET daily_used = 0, daily_reset_at = NOW()
    WHERE user_key = ${userKey}
    AND daily_reset_at < NOW() - INTERVAL '24 hours'
  `);

  // Fetch user state
  const userRow = await db.execute(sql`
    SELECT score, tier, daily_used, prediction_count, correct_count
    FROM cptx_balances WHERE user_key = ${userKey} LIMIT 1
  `);
  const user = (userRow.rows ?? userRow)[0] as {
    score: number; tier: string; daily_used: number;
    prediction_count: number; correct_count: number;
  };

  const effectiveTier = (user.tier ?? "free") as Tier;
  const dailyUsed = Number(user.daily_used ?? 0);

  // Enforce daily limit
  if (!canPredict(dailyUsed, effectiveTier)) {
    const limit = getTierConfig(effectiveTier).dailyPredictions;
    return NextResponse.json({
      error:   `Daily limit reached. ${effectiveTier} tier allows ${limit} predictions per day.`,
      limit, tier: effectiveTier,
      upgrade: effectiveTier === "free" ? "Upgrade to Pro for unlimited predictions." : null,
    }, { status: 429 });
  }

  // Duplicate vote check
  const existing = await db.execute(sql`
    SELECT id FROM predictions WHERE polymarket_market_id = ${marketId} LIMIT 1
  `);
  if ((existing.rows ?? existing).length > 0) {
    return NextResponse.json({ error: "You have already voted on this market." }, { status: 409 });
  }

  // Record prediction
  const predResult = await db.execute(sql`
    INSERT INTO predictions (
      entity_id, metric, signal_id, prediction,
      z_score_at_vote, cptx_cost, cptx_reward,
      polymarket_market_id, polymarket_question, polymarket_yes_price,
      score_delta, resolved
    ) VALUES (
      ${entityId ?? null}, ${metric ?? "market"}, ${signalId ?? null}, ${prediction},
      ${zScoreAtVote != null ? parseFloat(String(zScoreAtVote)) : null}, 0, 0,
      ${marketId}, ${question}, ${yesPrice},
      0, false
    ) RETURNING id
  `);
  const predictionId = (predResult.rows ?? predResult)[0]?.id;

  // Increment counters
  await db.execute(sql`
    UPDATE cptx_balances
    SET daily_used       = daily_used + 1,
        prediction_count = prediction_count + 1,
        updated_at       = NOW()
    WHERE user_key = ${userKey}
  `);

  // Log transaction (no delta)
  await db.execute(sql`
    INSERT INTO cptx_transactions (user_key, action, delta, balance_after, prediction_id)
    VALUES (${userKey}, 'prediction_cast', 0, ${Number(user.score ?? 0)}, ${predictionId})
  `);

  const remaining = remainingPredictions(dailyUsed + 1, effectiveTier);

  return NextResponse.json({
    status: "recorded", predictionId, prediction, source, remaining,
    message: remaining === "unlimited"
      ? "Prediction recorded. Unlimited remaining today."
      : `Prediction recorded. ${remaining} predictions remaining today.`,
  });
}

// ─── Cross-source dedup ───────────────────────────────────────────────────────
function deduplicateCrossSource<T extends { question: string; source: string; volume: number }>(markets: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const m of markets) {
    const key = m.question.toLowerCase().slice(0, 60).replace(/\s+/g, " ").trim();
    if (!seen.has(key)) { seen.add(key); result.push(m); }
  }
  return result;
}
