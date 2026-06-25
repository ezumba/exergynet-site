// lib/polsignal/oracleResolver.ts
// Auto-resolution oracle for PolSignal predictions.
// Polls Polymarket and Kalshi APIs for market closure and scores pending predictions.
// Called by the cron job — safe to call multiple times (idempotent per market).

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { CPTX_RULES } from '@/lib/tiers';
import { createSign } from 'crypto';
import { readFileSync } from 'fs';

// ─── Kalshi auth (reuse from kalshiAdapter) ──────────────────────────────────

function getKalshiPrivateKey(): string {
  const keyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
  if (keyPath) { try { return readFileSync(keyPath, 'utf8'); } catch {} }
  const inline = process.env.KALSHI_PRIVATE_KEY;
  if (inline) return inline.replace(/\\n/g, '\n');
  return '';
}

function kalshiAuthHeaders(method: string, path: string): Record<string, string> {
  const keyId      = process.env.KALSHI_API_KEY_ID ?? '';
  const privateKey = getKalshiPrivateKey();
  if (!keyId || !privateKey) return {};
  const timestamp = String(Date.now());
  const message   = timestamp + method.toUpperCase() + path;
  const signer = createSign('RSA-SHA256');
  signer.update(message);
  signer.end();
  const signature = signer.sign(privateKey, 'base64');
  return {
    'KALSHI-ACCESS-KEY':       keyId,
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'Content-Type':            'application/json',
    'Accept':                  'application/json',
  };
}

// ─── Resolution result types ─────────────────────────────────────────────────

type Resolution = 'YES' | 'NO' | 'UNKNOWN';

interface MarketResolution {
  marketId:   string;
  resolution: Resolution;
  source:     string;
}

// ─── Polymarket resolution check ─────────────────────────────────────────────
// closed=true + outcomePrices=["1","0"] → YES, ["0","1"] → NO

async function checkPolymarketResolution(marketId: string): Promise<Resolution> {
  try {
    const res = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ExergyNet-Oracle/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 'UNKNOWN';
    const data: Record<string, unknown> = await res.json();

    if (!data.closed) return 'UNKNOWN'; // Market still open

    // outcomePrices: [yesPrice, noPrice] as strings
    const prices: string[] = (() => {
      const op = data.outcomePrices;
      if (Array.isArray(op)) return op.map(String);
      try { return JSON.parse(String(op)); } catch { return ['0.5', '0.5']; }
    })();

    const yesPrice = parseFloat(prices[0] ?? '0.5');
    const noPrice  = parseFloat(prices[1] ?? '0.5');

    // Resolved markets show price of exactly 1 for the winning outcome
    if (yesPrice >= 0.99) return 'YES';
    if (noPrice  >= 0.99) return 'NO';

    return 'UNKNOWN'; // Ambiguous — may be resolving
  } catch {
    return 'UNKNOWN';
  }
}

// ─── Kalshi resolution check ─────────────────────────────────────────────────
// status = "settled" or "finalized" + result = "yes" or "no"

async function checkKalshiResolution(ticker: string): Promise<Resolution> {
  if (!process.env.KALSHI_API_KEY_ID) return 'UNKNOWN';
  try {
    const apiPath  = `/markets/${ticker}`;
    const signPath = `/trade-api/v2/markets/${ticker}`;
    const res = await fetch(`https://api.elections.kalshi.com/trade-api/v2${apiPath}`, {
      headers: kalshiAuthHeaders('GET', signPath),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 'UNKNOWN';
    const data: Record<string, unknown> = await res.json();
    const market = (data.market ?? data) as Record<string, unknown>;

    const status = String(market.status ?? '').toLowerCase();
    if (!['settled', 'finalized'].includes(status)) return 'UNKNOWN';

    const result = String(market.result ?? '').toLowerCase();
    if (result === 'yes') return 'YES';
    if (result === 'no')  return 'NO';

    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

// ─── Score a single prediction against a resolution ──────────────────────────

async function scorePrediction(
  predId:     string,
  prediction: string,   // UP | DOWN | FLAT
  resolution: Resolution,
  source:     string,
): Promise<void> {
  // UP → betting YES price rises → correct if resolves YES
  // DOWN → betting YES price falls → correct if resolves NO
  // FLAT → correct if market resolves ambiguously (we treat FLAT as wrong for binary)
  const isCorrect =
    (prediction === 'UP'   && resolution === 'YES') ||
    (prediction === 'DOWN' && resolution === 'NO');

  const scoreDelta = isCorrect
    ? CPTX_RULES.CORRECT_PREDICTION + CPTX_RULES.PARTICIPATION
    : CPTX_RULES.WRONG_PREDICTION   + CPTX_RULES.PARTICIPATION;

  // Mark prediction resolved
  await db.execute(sql`
    UPDATE predictions
    SET resolved          = true,
        resolved_correct  = ${isCorrect},
        score_delta       = ${scoreDelta},
        resolution_source = ${source},
        scored_at         = NOW()
    WHERE id = ${predId}
  `);

  // Find the user who cast this prediction
  const txRow = await db.execute(sql`
    SELECT user_key FROM cptx_transactions
    WHERE prediction_id = ${predId}
    AND action = 'prediction_cast'
    LIMIT 1
  `);
  const userKey = ((txRow.rows ?? txRow)[0] as { user_key?: string } | undefined)?.user_key;
  if (!userKey) return;

  // Update user balance + correct_count
  await db.execute(sql`
    UPDATE cptx_balances
    SET score         = score + ${scoreDelta},
        correct_count = correct_count + ${isCorrect ? 1 : 0},
        updated_at    = NOW()
    WHERE user_key = ${userKey}
  `);

  // Log the scoring transaction
  const balResult = await db.execute(sql`
    SELECT score FROM cptx_balances WHERE user_key = ${userKey} LIMIT 1
  `);
  const newBal = Number(((balResult.rows ?? balResult)[0] as { score?: number })?.score ?? 0);

  await db.execute(sql`
    INSERT INTO cptx_transactions (user_key, action, delta, balance_after, prediction_id)
    VALUES (
      ${userKey},
      ${isCorrect ? 'correct_prediction' : 'wrong_prediction'},
      ${scoreDelta},
      ${newBal},
      ${predId}
    )
  `);

  console.log(`[Oracle] ${predId} → ${resolution} → ${isCorrect ? 'CORRECT' : 'WRONG'} (${scoreDelta > 0 ? '+' : ''}${scoreDelta}) for ${userKey}`);
}

// ─── Main oracle run ──────────────────────────────────────────────────────────

export interface OracleRunResult {
  checked:  number;
  resolved: number;
  correct:  number;
  wrong:    number;
  skipped:  number;
  errors:   string[];
}

export async function runResolutionOracle(): Promise<OracleRunResult> {
  const result: OracleRunResult = { checked: 0, resolved: 0, correct: 0, wrong: 0, skipped: 0, errors: [] };

  // Load all unresolved predictions that have real market IDs
  const pending = await db.execute(sql`
    SELECT id, prediction, polymarket_market_id
    FROM predictions
    WHERE resolved = false
      AND polymarket_market_id IS NOT NULL
      AND polymarket_market_id NOT LIKE 'smoke%'
      AND polymarket_market_id NOT LIKE 'test%'
      AND polymarket_market_id NOT LIKE 'debug%'
      AND polymarket_market_id NOT LIKE 'Drain%'
    ORDER BY created_at ASC
  `);

  const rows = (pending.rows ?? pending) as { id: string; prediction: string; polymarket_market_id: string }[];

  // Deduplicate by market ID — check each market once, score all predictions for it
  const marketMap = new Map<string, { ids: string[]; predictions: string[] }>();
  for (const row of rows) {
    const mid = row.polymarket_market_id;
    if (!marketMap.has(mid)) marketMap.set(mid, { ids: [], predictions: [] });
    marketMap.get(mid)!.ids.push(row.id);
    marketMap.get(mid)!.predictions.push(row.prediction);
  }

  result.checked = marketMap.size;

  for (const [marketId, { ids, predictions }] of marketMap) {
    try {
      // Determine source: Kalshi tickers start with KX or contain letters+dash pattern
      const isKalshi = /^KX[A-Z]/.test(marketId) || /^[A-Z]+[A-Z\-]+[A-Z]$/.test(marketId);
      const resolution = isKalshi
        ? await checkKalshiResolution(marketId)
        : await checkPolymarketResolution(marketId);

      if (resolution === 'UNKNOWN') {
        result.skipped++;
        continue;
      }

      // Score all predictions for this market
      for (let i = 0; i < ids.length; i++) {
        await scorePrediction(ids[i], predictions[i], resolution, isKalshi ? 'kalshi' : 'polymarket');
        result.resolved++;
        if (
          (predictions[i] === 'UP'   && resolution === 'YES') ||
          (predictions[i] === 'DOWN' && resolution === 'NO')
        ) {
          result.correct++;
        } else {
          result.wrong++;
        }
      }
    } catch (err) {
      result.errors.push(`${marketId}: ${String(err).slice(0, 100)}`);
    }
  }

  return result;
}
