// lib/polsignal/signalMatcher.ts
// Matches prediction markets to Intel Console signals.
// Computes the SEI system prediction from z-score + confidence + domain rules.
// v2: fixes HIGH-signal burial, wrong rule path, question-aware price level, entity coverage

import * as fs from "fs";
import * as path from "path";

export interface IntelSignal {
  id: string;
  entityId: string;
  entityName: string;
  metric: string;
  signalType: string;
  value: number;
  confidence: "HIGH" | "LOW" | "UNVERIFIED";
  t: string;
}

export interface DomainRule {
  id: string;
  domain: string;
  premise: string;
  signal: string;
  summary: string;
  clarity: number;
  weight: number;
}

export interface SystemPrediction {
  direction: "UP" | "DOWN" | "FLAT";
  probability: number;   // 0–1
  rationale: string;
  domainRule: string | null;
}

// ─── Entity → market question keyword map ────────────────────────────────────
// Each entry covers the entity's DB name → keywords likely to appear in Polymarket/Kalshi questions
const ENTITY_KEYWORDS: Record<string, string[]> = {
  "Bitcoin":        ["bitcoin", "btc", "btc-usd", "150,000", "$100k", "$150k", "100k", "150k", "200k", "90k", "80k", "76k"],
  "Ethereum":       ["ethereum", "eth", "ether", "eth-usd"],
  "S&P 500 Index":  ["s&p", "spy", "sp500", "s&p 500", "spx", "stock market", "equities", "nasdaq", "dow"],
  "Gold Futures":   ["gold", "xau", "gc=f", "gold futures", "gold price", "gold (gc)", "gold settle"],
  "Tesla Inc":      ["tesla", "tsla"],
  "NVIDIA Corp":    ["nvidia", "nvda", "nvda stock"],
  "Alphabet Inc":   ["alphabet", "google", "googl", "goog", "deepmind"],
  "Microsoft Corp": ["microsoft", "msft", "azure", "copilot"],
  "Apple Inc":      ["apple", "aapl", "iphone", "apple stock"],
  "Amazon.com Inc": ["amazon", "amzn", "aws", "amazon stock"],
  "ExergyNet":      ["exergynet", "exergy"],
  "Iran War":       ["iran", "tehran", "iranian", "irgc", "strait of hormuz"],
  "Nicki Minaj":    ["nicki minaj", "nicki", "barb", "onika"],
};

// ─── Extract price threshold from question text ───────────────────────────────
// Parses "$76,000", "$76k", "76000" from question strings
export function extractPriceThreshold(question: string): number | null {
  // Match patterns like "$76,000" "$76k" "$6,200" "76000"
  const patterns = [
    /\$(\d[\d,]+)k\b/i,        // $76k
    /\$(\d[\d,]+(?:\.\d+)?)\b/, // $76,000 or $76000
    /\b(\d[\d,]+)\s*(?:usd|usdc|dollars?)\b/i,
  ];
  for (const p of patterns) {
    const m = question.match(p);
    if (m) {
      let numStr = m[1].replace(/,/g, "");
      let num = parseFloat(numStr);
      if (p.source.includes("k\\b")) num *= 1000; // "$76k" → 76000
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

// ─── Best signal per entity — prefer HIGH, then most recent ──────────────────
export function matchSignalToMarket(
  question: string,
  signals: IntelSignal[]
): IntelSignal | null {
  if (!question) return null;
  const q = question.toLowerCase();

  for (const [entityName, keywords] of Object.entries(ENTITY_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw.toLowerCase()))) {
      const entitySignals = signals
        .filter(s => s.entityName === entityName)
        .sort((a, b) => {
          // 1. Best confidence first
          const TIER: Record<string, number> = { HIGH: 0, LOW: 1, UNVERIFIED: 2 };
          const tierDiff = (TIER[a.confidence] ?? 2) - (TIER[b.confidence] ?? 2);
          if (tierDiff !== 0) return tierDiff;
          // 2. Prefer z_score over pct_change (richer signal)
          if (a.signalType === "z_score" && b.signalType !== "z_score") return -1;
          if (b.signalType === "z_score" && a.signalType !== "z_score") return 1;
          // 3. Most recent
          return new Date(b.t).getTime() - new Date(a.t).getTime();
        });
      if (entitySignals.length > 0) return entitySignals[0];
    }
  }
  return null;
}

// ─── Question-aware price level adjustment ────────────────────────────────────
// For "Will Bitcoin be above $76,000?" questions, the crowd prob is nearly 0% or 100%
// when the asset price is far from the threshold. We detect this and sharpen the system
// prediction accordingly.
function adjustForPriceLevel(
  question: string,
  baseProb: number,
  entityName: string,
): number {
  if (!question || !entityName) return baseProb;
  // Current approximate prices (updated by ingest; use as reference baseline)
  const APPROX_PRICES: Record<string, number> = {
    "Bitcoin":        106000,  // will be updated dynamically
    "Ethereum":       2500,
    "Gold Futures":   3300,
    "S&P 500 Index":  5500,
    "Tesla Inc":      280,
    "NVIDIA Corp":    130,
    "Apple Inc":      210,
    "Microsoft Corp": 430,
    "Alphabet Inc":   180,
    "Amazon.com Inc": 220,
  };

  const currentPrice = APPROX_PRICES[entityName];
  if (!currentPrice) return baseProb;

  const threshold = extractPriceThreshold(question);
  if (!threshold) return baseProb;

  const isAboveQuestion = /above|over|exceed|higher|greater|more than/i.test(question);
  const isBelowQuestion = /below|under|dip to|drop to|fall to|less than/i.test(question);

  if (!isAboveQuestion && !isBelowQuestion) return baseProb;

  const ratio = threshold / currentPrice;

  if (isAboveQuestion) {
    // Price is currently FAR above threshold → very likely YES (high prob)
    if (ratio < 0.50) return 0.92;   // threshold is half the current price
    if (ratio < 0.75) return 0.82;
    if (ratio < 0.90) return 0.70;
    if (ratio < 1.00) return Math.max(baseProb, 0.58); // just below current — leaning yes
    // Price would need to rise to hit threshold → uncertain
    if (ratio < 1.15) return Math.min(baseProb, 0.42);
    if (ratio < 1.30) return 0.25;
    return 0.10; // threshold is 30%+ above current price
  }

  if (isBelowQuestion) {
    // Inverse of above
    if (ratio < 0.50) return 0.08;   // threshold is half current price — very unlikely dip
    if (ratio < 0.75) return 0.18;
    if (ratio < 0.90) return 0.30;
    if (ratio < 1.00) return Math.min(baseProb, 0.42); // just below current
    if (ratio < 1.15) return Math.max(baseProb, 0.58);
    return 0.88; // threshold well above current — very likely to be below it
  }

  return baseProb;
}

// ─── System prediction ────────────────────────────────────────────────────────
export function computeSystemPrediction(
  signal: IntelSignal | null,
  rules: DomainRule[],
  question: string,
  entityName?: string,
): SystemPrediction {
  if (!signal) {
    return {
      direction:   "FLAT",
      probability: 0.5,
      rationale:   "No matching Intel signal found for this market",
      domainRule:  null,
    };
  }

  const z    = signal.value;
  const conf = signal.confidence;
  const name = entityName ?? signal.entityName ?? '';

  // Direction from z-score
  let direction: "UP" | "DOWN" | "FLAT";
  if      (z >  1.5) direction = "UP";
  else if (z < -1.5) direction = "DOWN";
  else               direction = "FLAT";

  // Sigmoid mapping: z=3 → ~0.80, z=0 → 0.50, z=-3 → ~0.20
  const rawProb = 0.5 + Math.atan(z * 0.4) / Math.PI;
  const clampedProb = Math.min(0.95, Math.max(0.05, rawProb));

  // Confidence scaling — HIGH signals carry full weight
  const confScale = conf === "HIGH" ? 1.0 : conf === "LOW" ? 0.75 : 0.50;
  let probability = 0.5 + (clampedProb - 0.5) * confScale;
  probability = Math.round(probability * 1000) / 1000;

  // Question-aware price level adjustment
  probability = adjustForPriceLevel(question, probability, name);
  probability = Math.round(Math.min(0.95, Math.max(0.05, probability)) * 1000) / 1000;

  // Domain rule matching
  const q = question.toLowerCase();
  const matchedRule = rules.find(r => {
    if (!r.domain) return false;
    const domain = String(r.domain).toLowerCase();
    return q.includes(domain) ||
      domain.split(" ").some(w => w.length > 4 && q.includes(w));
  }) ?? null;

  // Apply domain rule weight if matched
  if (matchedRule) {
    const ruleNudge = (matchedRule.weight - 0.5) * 0.1 * matchedRule.clarity;
    probability = Math.min(0.95, Math.max(0.05, probability + ruleNudge));
    probability = Math.round(probability * 1000) / 1000;
  }

  const signStr = z >= 0 ? "+" : "";
  const rationale = `z=${signStr}${z.toFixed(2)} (${conf}) → ${direction} · ${(probability * 100).toFixed(0)}% sys prob${matchedRule ? " · domain rule applied" : ""}`;

  return { direction, probability, rationale, domainRule: matchedRule?.summary ?? null };
}

// ─── Domain rules loader — fixed path ────────────────────────────────────────
export function loadDomainRules(): DomainRule[] {
  // Try both possible locations (no src/ prefix vs with src/)
  const candidates = [
    path.join(process.cwd(), "lib/polsignal/rule_library.jsonl"),
    path.join(process.cwd(), "src/lib/polsignal/rule_library.jsonl"),
    path.join(__dirname, "rule_library.jsonl"),
  ];
  for (const rulePath of candidates) {
    if (fs.existsSync(rulePath)) {
      try {
        const rules = fs.readFileSync(rulePath, "utf-8")
          .split("\n")
          .filter(Boolean)
          .map(l => JSON.parse(l) as DomainRule);
        console.log(`[PolSignal] loaded ${rules.length} domain rules from ${rulePath}`);
        return rules;
      } catch {
        continue;
      }
    }
  }
  console.warn("[PolSignal] rule_library.jsonl not found — no domain rules active");
  return [];
}

// ─── Deduplication — best signal per entity+metric across ALL confidence tiers ─
export function deduplicateSignals<T extends {
  entityId: string;
  metric: string;
  confidence: string;
  signalType?: string;
  t: string;
}>(signals: T[]): T[] {
  const TIER: Record<string, number> = { HIGH: 0, LOW: 1, UNVERIFIED: 2 };
  const best = new Map<string, T>();
  for (const s of signals) {
    const key = `${s.entityId}__${s.metric}`;
    const existing = best.get(key);
    if (!existing) { best.set(key, s); continue; }
    const eTier = TIER[existing.confidence] ?? 2;
    const sTier = TIER[s.confidence] ?? 2;
    if (sTier < eTier) { best.set(key, s); continue; }
    if (sTier === eTier) {
      // Same confidence: prefer z_score, then most recent
      const eIsZ = (existing as any).signalType === "z_score";
      const sIsZ = (s as any).signalType === "z_score";
      if (sIsZ && !eIsZ) { best.set(key, s); continue; }
      if (sIsZ === eIsZ && new Date(s.t) > new Date(existing.t)) best.set(key, s);
    }
  }
  return Array.from(best.values());
}
