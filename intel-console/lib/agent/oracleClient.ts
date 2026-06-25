// lib/agent/oracleClient.ts
// TypeScript client for the Python Convergence Oracle v2
// Falls back to legacy computeSystemPrediction if oracle is unavailable

const ORACLE_URL = process.env.ORACLE_URL ?? 'http://localhost:8081';

export interface OracleRequest {
  question:         string;
  crowd_prob:       number;
  entity:           string;
  current_price:    number;
  price_history:    number[];
  volume_history?:  number[];
  current_volume?:  number;
  resolution_date?: string;
  threshold?:       number;
  gdelt_tone?:      number;
}

export interface OracleResult {
  system_prob:         number;
  raw_prob:            number;
  system_confidence:   number;
  divergence:          number;
  isf_triggered:       boolean;
  proof_hash:          string;
  channel_votes:       Record<string, {
    vote:       'UP' | 'FLAT' | 'DOWN';
    confidence: number;
    raw_value:  number;
    metadata:   Record<string, unknown>;
  }>;
  calibration_applied: boolean;
  timestamp:           string;
}

let oracleHealthy: boolean | null = null;
let lastHealthCheck = 0;
const HEALTH_TTL_MS = 60000;

export async function checkOracleHealth(): Promise<boolean> {
  const now = Date.now();
  if (oracleHealthy !== null && now - lastHealthCheck < HEALTH_TTL_MS) return oracleHealthy;
  try {
    const res = await fetch(`${ORACLE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    oracleHealthy = res.ok;
  } catch {
    oracleHealthy = false;
  }
  lastHealthCheck = now;
  return oracleHealthy ?? false;
}

export async function callOracle(req: OracleRequest): Promise<OracleResult | null> {
  const healthy = await checkOracleHealth();
  if (!healthy) return null;
  try {
    const res = await fetch(`${ORACLE_URL}/predict`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req),
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json() as OracleResult;
  } catch {
    return null;
  }
}

export async function resolveMarket(question: string, outcome: boolean): Promise<void> {
  try {
    await fetch(`${ORACLE_URL}/resolve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ question, outcome }),
      signal:  AbortSignal.timeout(5000),
    });
  } catch {
    console.warn(`Oracle calibration update failed for: ${question}`);
  }
}
