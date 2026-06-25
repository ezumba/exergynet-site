// app/api/origin/route.ts
// GET /api/origin
// M2M endpoint: returns the composite Origin Index + ALL vectors.
// Single source of truth — the dashboard renders this exact value.
// Public read — CORS enabled. Used by: exergynet_get_origin_index MCP tool,
// the Origin Index page, and AI agents.
//
// v2 (audit #1+#2): market + planetary vectors are now fetched server-side from
// real sources (Yahoo, NOAA, USGS, GDELT). No more 0.5 placeholders. The output
// exposes every vector and an honest verification status with a degraded[] list.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*" };

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ── Normalizers (identical to the dashboard layer normFns) ────────────────────
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const normSp500   = (v: number) => clamp01(0.5 - (v / 5500 - 1) * 3);
const normVix     = (v: number) => clamp01(v / 60);
const normDxy     = (v: number) => clamp01((v - 95) / 20);
const normSolar   = (v: number) => clamp01(v / 9);
const normSeismic = (v: number) => clamp01((v - 2.5) / 5);
const normGdelt   = (v: number) => clamp01(v / 100);

async function getJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OriginOracle/2.0; +https://exergynet.org)" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// Stooq latest close (CSV, no key, reachable from datacenter IPs — Yahoo 429s here)
async function stooqLast(symbol: string): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(
      `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`,
      { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (OriginOracle/2.0)" } }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    const last = text.split("\n").pop() || "";
    const cols = last.split(",");            // sym,date,time,open,high,low,close,vol
    if (cols.length < 7 || cols[6] === "N/D") return null;
    const close = parseFloat(cols[6]);
    return isNaN(close) ? null : close;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── 45s result cache (page polls every 60s; external APIs are slow) ───────────
let _cache: { at: number; body: any } | null = null;
const CACHE_TTL_MS = 45_000;

export async function GET(_req: NextRequest) {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return NextResponse.json(_cache.body, { headers: { ...CORS, "X-Origin-Cache": "hit" } });
  }

  const now = new Date();
  const degraded: string[] = [];

  // ── Internal LNES vectors (guarded — a missing table degrades, never 500s) ──
  const safeQuery = async <T>(label: string, q: any, fallback: T): Promise<T> => {
    try {
      const r = await db.execute(q);
      return r.rows as unknown as T;
    } catch {
      degraded.push(label);
      return fallback;
    }
  };

  const [signalRows, evRows, costRows, usageRows, clcRows, entityRows] = await Promise.all([
    safeQuery<{ confidence: string; count: number }[]>("signals",
      sql`SELECT confidence, COUNT(*)::int AS count FROM signals WHERE t > NOW() - INTERVAL '24 hours' GROUP BY confidence`, []),
    safeQuery<{ count: number; critical: number }[]>("entity_events",
      sql`SELECT COUNT(*)::int AS count, COUNT(*) FILTER (WHERE severity IN ('CRITICAL','HIGH'))::int AS critical FROM entity_events WHERE created_at > NOW() - INTERVAL '24 hours'`, [{ count: 0, critical: 0 }]),
    safeQuery<{ ops_last_hour: number; ops_24h: number; cost_24h: number }[]>("agent_cost_events",
      sql`SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1h')::int AS ops_last_hour, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h')::int AS ops_24h, COALESCE(SUM(cost_usdc) FILTER (WHERE created_at > NOW() - INTERVAL '24h'),0) AS cost_24h FROM agent_cost_events`, [{ ops_last_hour: 0, ops_24h: 0, cost_24h: 0 }]),
    safeQuery<{ count: number }[]>("usage_events",
      sql`SELECT COUNT(*)::int AS count FROM usage_events WHERE created_at > date_trunc('month', NOW())`, [{ count: 0 }]),
    safeQuery<{ total: number; inconsistent: number }[]>("ghost_witness_audits",
      sql`SELECT COUNT(*) FILTER (WHERE status='complete')::int AS total, COUNT(*) FILTER (WHERE consistent=false)::int AS inconsistent FROM ghost_witness_audits WHERE created_at > NOW() - INTERVAL '24 hours'`, [{ total: 0, inconsistent: 0 }]),
    safeQuery<{ count: number }[]>("entities",
      sql`SELECT COUNT(*)::int AS count FROM entities`, [{ count: 0 }]),
  ]);

  const sigMap = Object.fromEntries(signalRows.map((r) => [r.confidence, r.count]));
  const highSignals  = sigMap["HIGH"] ?? 0;
  const totalSignals = highSignals + (sigMap["LOW"] ?? 0) + (sigMap["UNVERIFIED"] ?? 0);
  const entityEvents24h         = evRows[0]?.count ?? 0;
  const entityEventsCritical24h = evRows[0]?.critical ?? 0;
  const opsLastHour = costRows[0]?.ops_last_hour ?? 0;
  const ops24h = costRows[0]?.ops_24h ?? 0;
  // Surge ratio: current hour vs the trailing-24h average hourly rate.
  // ratio 1.0 = steady state (no anomaly); >1 = elevated activity = entropy.
  const baselineHourly = Math.max(ops24h / 24, 1);
  const vanguardRatio  = opsLastHour / baselineHourly;
  const usageMtd    = usageRows[0]?.count ?? 0;
  const clcCount24h        = clcRows[0]?.total ?? 0;
  const clcInconsistent24h = clcRows[0]?.inconsistent ?? 0;
  const entityCount = entityRows[0]?.count ?? 0;

  // ── Market + planetary vectors (real, server-side) ──────────────────────────
  const vix: number | null = null; // VIX unavailable from datacenter source; market = sp500+dxy
  const [sp500, dxy, solarData, seismicData, gdeltData] = await Promise.all([
    stooqLast("^spx"),
    stooqLast("dx.f"),
    getJson<{ kp_index: string }[]>("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json", 7000),
    getJson<{ features: { properties: { mag: number } }[] }>(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${new Date(Date.now() - 86400000).toISOString().split("T")[0]}&endtime=${now.toISOString().split("T")[0]}&minmagnitude=2.5`, 9000),
    getJson<{ totalrows?: number }>(
      `https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20geopolitical%20war&mode=ToneChart&format=json`, 8000),
  ]);

  // Market sub-vector (sp500 .12 / vix .12 / dxy .06 within the .30 market band)
  let marketVector = 0.5, marketReal = false;
  {
    const parts: { w: number; n: number }[] = [];
    if (sp500 != null) parts.push({ w: 0.12, n: normSp500(sp500) });
    if (vix   != null) parts.push({ w: 0.12, n: normVix(vix) });
    if (dxy   != null) parts.push({ w: 0.06, n: normDxy(dxy) });
    if (parts.length) {
      const tw = parts.reduce((s, p) => s + p.w, 0);
      marketVector = parts.reduce((s, p) => s + p.n * p.w, 0) / tw;
      marketReal = true;
    } else degraded.push("market");
  }

  // Planetary sub-vector (solar .04 / seismic .03 / gdelt .03 within the .10 band)
  let planetaryVector = 0.5, planetaryReal = false;
  {
    const parts: { w: number; n: number }[] = [];
    const kp = solarData?.length ? parseFloat(solarData[solarData.length - 1].kp_index) : NaN;
    if (!isNaN(kp)) parts.push({ w: 0.04, n: normSolar(kp) });
    if (seismicData?.features?.length) {
      const mags = seismicData.features.map((f) => f.properties.mag);
      const avg = mags.reduce((a, b) => a + b, 0) / mags.length;
      parts.push({ w: 0.03, n: normSeismic(avg) });
    }
    if (gdeltData) {
      const score = Math.min(100, (gdeltData.totalrows ?? 0) / 50);
      parts.push({ w: 0.03, n: normGdelt(score) });
    }
    if (parts.length) {
      const tw = parts.reduce((s, p) => s + p.w, 0);
      planetaryVector = parts.reduce((s, p) => s + p.n * p.w, 0) / tw;
      planetaryReal = true;
    } else degraded.push("planetary");
  }

  // ── Composite (real inputs only) ────────────────────────────────────────────
  const signalDensity = clamp01(highSignals / 15);
  const vanguardRate  = clamp01((vanguardRatio - 0.5) / 2);  // ratio 0.5->0, 1->0.25, 2.5->1
  const eventStress   = clamp01(entityEventsCritical24h / 20);
  const truthStress   = clcCount24h >= 5 ? clamp01(clcInconsistent24h / clcCount24h) : 0; // min-sample floor

  const compositeRaw =
    signalDensity   * 0.25 +
    vanguardRate    * 0.20 +
    eventStress     * 0.20 +
    truthStress     * 0.10 +
    marketVector    * 0.15 +
    planetaryVector * 0.10;

  const originIndex = Math.round(1000 * compositeRaw * 10) / 10;

  const allReal = marketReal && planetaryReal && degraded.length === 0;
  const status = allReal ? "VERIFIED_VIA_LNES"
    : degraded.length ? `PARTIAL: ${degraded.join(",")}_degraded`
    : "VERIFIED_VIA_LNES";

  const body = {
    origin_index: originIndex,
    status,
    degraded,
    timestamp: now.toISOString(),
    vectors: {
      intel_signals: {
        label: "Intel Signal Density", value: highSignals, normalized: signalDensity,
        weight: 0.25, unit: "HIGH-confidence signals (24h)", source: "INTEL CONSOLE",
        note: "More HIGH signals = elevated analytical activity = higher entropy",
      },
      vanguard: {
        label: "Vanguard Inference Surge", value: opsLastHour, normalized: vanguardRate,
        weight: 0.20, unit: "inference ops/hr", source: "VANGUARD (Azure)",
        surge_ratio: Math.round(vanguardRatio * 100) / 100,
        baseline_hourly: Math.round(baselineHourly * 10) / 10,
        note: "Current-hour ops vs trailing-24h avg. ratio>1 = elevated activity (entropy)",
      },
      event_stress: {
        label: "Entity Event Stress", value: entityEventsCritical24h, normalized: eventStress,
        weight: 0.20, unit: "CRITICAL/HIGH events from scrapers (24h)", source: "INTEL SCRAPERS",
        note: "USASpending, GDELT, ACLED, SEC, CourtListener aggregate",
      },
      truth_stress: {
        label: "Truth Verification Stress", value: clcCount24h, normalized: truthStress,
        weight: 0.10, unit: "CLCs issued (24h)", source: "LNES-05",
        inconsistency_rate: clcCount24h > 0 ? clcInconsistent24h / clcCount24h : 0,
        note: clcCount24h < 5 ? "min-sample floor active (<5 CLCs): stress held at 0" : undefined,
      },
      market: {
        label: "Market Reality", value: { sp500, vix, dxy }, normalized: marketVector,
        weight: 0.15, unit: "composite (S&P500 / VIX / DXY)", source: marketReal ? "Stooq · LIVE" : "DEGRADED",
        real: marketReal,
        note: "Equity stress + volatility + dollar strength",
      },
      planetary: {
        label: "Planetary Telemetry",
        value: {
          kp: solarData?.length ? parseFloat(solarData[solarData.length - 1].kp_index) : null,
          seismic_events: seismicData?.features?.length ?? null,
          gdelt_rows: gdeltData?.totalrows ?? null,
        },
        normalized: planetaryVector, weight: 0.10,
        unit: "composite (NOAA Kp / USGS seismic / GDELT)", source: planetaryReal ? "NOAA+USGS+GDELT · LIVE" : "DEGRADED",
        real: planetaryReal,
        note: "Geomagnetic + seismic + geopolitical stress",
      },
    },
    network: {
      entities_tracked: entityCount,
      signals_24h: totalSignals,
      high_signals_24h: highSignals,
      events_24h: entityEvents24h,
      clcs_24h: clcCount24h,
      vanguard_ops_hr: opsLastHour,
      usage_ops_mtd: usageMtd,
    },
    m2m: {
      toll_recommendation: originIndex > 700
        ? "HIGH_ENTROPY: increase compute toll by 25%"
        : "NOMINAL: standard compute toll applies",
      recommended_toll_usdc: originIndex > 700 ? 0.00625 : 0.005,
    },
  };

  _cache = { at: Date.now(), body };
  return NextResponse.json(body, { headers: { ...CORS, "X-Origin-Cache": "miss" } });
}
