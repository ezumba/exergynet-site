// app/api/divergence/route.ts
// PUBLIC: top 5 divergence markets (free)
// API TIER: top 50 with full signal detail (x-api-key header)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { createHash } from "crypto";
import { fetchPolyMarkets } from "@/lib/polymarketAdapter";
import { fetchKalshiMarkets } from "@/lib/kalshiAdapter";
import { matchSignalToMarket, computeSystemPrediction, loadDomainRules, deduplicateSignals } from "@/lib/polsignal/signalMatcher";
import { signals, entities } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

const FREE_LIMIT = 5;
const API_LIMIT  = 50;

export async function GET(req: NextRequest) {
  const apiKeyHeader    = req.headers.get("x-api-key");
  const requestedLimit  = parseInt(req.nextUrl.searchParams.get("limit") ?? "5");

  let isApiTier = false;
  if (apiKeyHeader) {
    const keyHash = createHash("sha256").update(apiKeyHeader).digest("hex");
    const keyRow  = await db.execute(sql`
      SELECT tier, active, calls_today FROM api_keys
      WHERE key_hash = ${keyHash} AND active = true LIMIT 1
    `);
    const rows = (keyRow.rows ?? keyRow) as { tier: string; calls_today: number }[];
    if (rows.length > 0) {
      if (rows[0].calls_today >= 1000) {
        return NextResponse.json(
          { error: "Daily API call limit reached (1000/day). Resets at midnight UTC." },
          { status: 429 }
        );
      }
      isApiTier = true;
      await db.execute(sql`
        UPDATE api_keys SET calls_today = calls_today + 1, last_used = NOW()
        WHERE key_hash = ${keyHash}
      `);
    }
  }

  const limit = isApiTier ? Math.min(requestedLimit, API_LIMIT) : FREE_LIMIT;

  // Load and dedup signals
  const rawSignals = await db
    .select({ id: signals.id, entityId: signals.entityId, entityName: entities.name,
              metric: signals.metric, signalType: signals.signalType,
              value: signals.value, confidence: signals.confidence, t: signals.t })
    .from(signals)
    .leftJoin(entities, eq(signals.entityId, entities.id))
    .orderBy(desc(signals.t))
    .limit(200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intelSignals = rawSignals.map((s: any) => ({
    ...s,
    entityName: s.entityName ?? s.entityId,
    value: parseFloat(String(s.value ?? "0")) || 0,
    confidence: (s.confidence ?? "UNVERIFIED") as "HIGH" | "LOW" | "UNVERIFIED",
    t: s.t ? new Date(s.t).toISOString() : new Date().toISOString(),
  }));
  const dedupedSignals = deduplicateSignals(intelSignals);

  const [polyResult, kalshiResult] = await Promise.allSettled([
    fetchPolyMarkets(50),
    fetchKalshiMarkets(100),
  ]);

  const allMarkets = [
    ...(polyResult.status   === "fulfilled" ? polyResult.value.map(m => ({ ...m, source: "polymarket" as const }))   : []),
    ...(kalshiResult.status === "fulfilled" ? kalshiResult.value.map(m => ({ ...m, source: "kalshi" as const })) : []),
  ];

  const rules = loadDomainRules();

  const enriched = allMarkets.map(market => {
    const matchedSignal    = matchSignalToMarket(market.question, dedupedSignals);
    const systemPrediction = computeSystemPrediction(matchedSignal, rules, market.question);
    const divergence       = Math.abs(market.yesPrice - systemPrediction.probability);
    return {
      id:                market.id,
      source:            market.source,
      question:          market.question,
      category:          market.category,
      endDate:           market.endDate,
      yesPrice:          market.yesPrice,
      noPrice:           market.noPrice,
      volume:            market.volume,
      systemProbability: systemPrediction.probability,
      systemDirection:   systemPrediction.direction,
      systemRationale:   systemPrediction.rationale,
      divergence:        Math.round(divergence * 1000) / 1000,
      signal: isApiTier ? matchedSignal : (matchedSignal ? {
        entityName: matchedSignal.entityName,
        confidence: matchedSignal.confidence,
      } : null),
    };
  })
  .filter(m => m.divergence > 0)
  .sort((a, b) => b.divergence - a.divergence)
  .slice(0, limit);

  return NextResponse.json({
    markets:   enriched,
    count:     enriched.length,
    tier:      isApiTier ? "api" : "free",
    limit,
    timestamp: new Date().toISOString(),
    meta: isApiTier
      ? { full_signal: true, max_limit: API_LIMIT }
      : {
          full_signal: false,
          max_limit:   FREE_LIMIT,
          upgrade:     "Add x-api-key header with an API tier key for up to 50 results with full signal detail.",
        },
  });
}
