// lib/tiers.ts
// Single source of truth for all tier limits and CPTX reputation scoring.
// Do not duplicate these values elsewhere.

export type Tier = "free" | "pro" | "api" | "enterprise";

export interface TierConfig {
  name:             string;
  dailyPredictions: number;       // -1 = unlimited
  apiCallsPerDay:   number;       // -1 = unlimited, 0 = none
  vanguardBriefs:   number;       // per day, -1 = unlimited
  priceUsdcMonth:   number;       // 0 = free
  features:         string[];
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  free: {
    name:             "Free",
    dailyPredictions: 5,
    apiCallsPerDay:   0,
    vanguardBriefs:   0,
    priceUsdcMonth:   0,
    features: [
      "5 predictions per day",
      "Basic divergence score",
      "CPTX reputation score",
      "Polymarket + Kalshi market browser",
      "Intel Console signal match",
    ],
  },
  pro: {
    name:             "Pro",
    dailyPredictions: -1,
    apiCallsPerDay:   0,
    vanguardBriefs:   5,
    priceUsdcMonth:   29,
    features: [
      "Unlimited predictions",
      "Full signal history (30 days)",
      "Divergence alerts (push)",
      "5 Vanguard briefs per day",
      "Kalshi candlestick charts",
      "Price history overlays",
    ],
  },
  api: {
    name:             "API",
    dailyPredictions: -1,
    apiCallsPerDay:   1000,
    vanguardBriefs:   10,
    priceUsdcMonth:   199,
    features: [
      "Everything in Pro",
      "1,000 API calls/day",
      "/divergence/top endpoint",
      "/signal/{marketId} endpoint",
      "/history/{entityId} endpoint",
      "10 Vanguard briefs per day",
    ],
  },
  enterprise: {
    name:             "Enterprise",
    dailyPredictions: -1,
    apiCallsPerDay:   -1,
    vanguardBriefs:   -1,
    priceUsdcMonth:   0,
    features: [
      "Everything in API",
      "Unlimited API calls",
      "Unlimited Vanguard briefs",
      "White-label Intel Console signal layer",
      "Dedicated ingestion pipeline",
      "SLA + support",
    ],
  },
};

// CPTX reputation scoring
export const CPTX_RULES = {
  CORRECT_PREDICTION: +10,
  WRONG_PREDICTION:   -3,
  PARTICIPATION:      +1,
  STREAK_BONUS_5:     +5,
  STREAK_BONUS_10:    +15,
} as const;

// Score thresholds
export const SCORE_TIERS = [
  { label: "Novice",     min: 0,    color: "#6b7280" },
  { label: "Analyst",    min: 50,   color: "#3b82f6" },
  { label: "Strategist", min: 200,  color: "#8b5cf6" },
  { label: "Expert",     min: 500,  color: "#f59e0b" },
  { label: "Oracle",     min: 1000, color: "#10b981" },
] as const;

export function getScoreTier(score: number) {
  return [...SCORE_TIERS].reverse().find(t => score >= t.min) ?? SCORE_TIERS[0];
}

export function getTierConfig(tier: Tier): TierConfig {
  return TIER_CONFIG[tier];
}

export function canPredict(dailyUsed: number, tier: Tier): boolean {
  const limit = TIER_CONFIG[tier].dailyPredictions;
  if (limit === -1) return true;
  return dailyUsed < limit;
}

export function remainingPredictions(dailyUsed: number, tier: Tier): number | "unlimited" {
  const limit = TIER_CONFIG[tier].dailyPredictions;
  if (limit === -1) return "unlimited";
  return Math.max(0, limit - dailyUsed);
}
