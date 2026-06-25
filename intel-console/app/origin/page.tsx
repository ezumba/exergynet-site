"use client";
// app/origin/page.tsx
// Origin Index — Best of v2 (controls) + v3 (design) + all Intel Console data
// External: Yahoo Finance, NOAA SWPC, USGS, GDELT, FRED (opt), EIA (opt)
// Internal: signals stats, Vanguard ops, entity events, Ghost-Witness, divergence

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LayerSeries { date: string; value: number; }
interface Layer {
  key:     string;
  label:   string;
  cat:     "lnes" | "market" | "planet" | "derived" | "health" | "custom";
  color:   string;
  weight:  number;
  active:  boolean;
  val:     number | null;
  norm:    number | null;
  trend:   "up" | "down" | "flat";
  series:  LayerSeries[];
  src:     string;
  unit:    string;
  desc:    string;
  needsKey?: string;
  // normalize fn: returns 0-1 where 1 = max entropy
  normFn:  (v: number) => number;
}

// ── Initial layer definitions ─────────────────────────────────────────────────
// Origin Index health source-pack — resolved server-side via MLE /series proxy.
const HEALTH_SERIES: { key: string; source: string; indicator: string; geo: string; window: string }[] = [
  { key: "who_life_expectancy", source: "who_gho",    indicator: "WHOSIS_000001", geo: "GLOBAL", window: "25" },
  { key: "who_pm25",            source: "who_gho",    indicator: "SDGPM25",       geo: "GLOBAL", window: "20" },
  { key: "who_immunization",    source: "who_gho",    indicator: "WHS4_544",     geo: "GLOBAL", window: "20" },
  { key: "covid_cases",         source: "disease_sh", indicator: "covid_cases",   geo: "",       window: "90" },
];

function makeLayers(): Record<string, Layer> {
  return {
    intel_signals: {
      key:"intel_signals", label:"Intel Signal Density", cat:"lnes", color:"#7C6FE4",
      weight:0.20, active:true, val:null, norm:null, trend:"flat", series:[], src:"Intel Console · LIVE",
      unit:"HIGH signals/24h", desc:"Volume of HIGH-confidence anomaly signals detected by the agent swarm across all tracked entities.",
      normFn: v => Math.min(v / 20, 1),
    },
    vanguard: {
      key:"vanguard", label:"Vanguard Inference Rate", cat:"lnes", color:"#9B87F5",
      weight:0.15, active:true, val:null, norm:null, trend:"flat", series:[], src:"Vanguard SGX · LIVE",
      unit:"ops/hr", desc:"Inference operations per hour through the Vanguard SGX enclave. High rate signals complex analytical load.",
      normFn: v => Math.min(v / 200, 1),
    },
    event_stress: {
      key:"event_stress", label:"Entity Event Stress", cat:"lnes", color:"#F59E0B",
      weight:0.15, active:true, val:null, norm:null, trend:"flat", series:[], src:"Intel Scrapers · LIVE",
      unit:"CRITICAL events/24h", desc:"Critical/HIGH events detected by the scraper swarm: ACLED, GDELT, SEC filings, CourtListener, USASpending.",
      normFn: v => Math.min(v / 20, 1),
    },
    truth_stress: {
      key:"truth_stress", label:"Truth Verification Stress", cat:"lnes", color:"#00E5B0",
      weight:0.10, active:true, val:null, norm:null, trend:"flat", series:[], src:"LNES-05 · LIVE",
      unit:"inconsistency rate", desc:"Ghost-Witness logical inconsistency rate from AI agent audits. High rate = agents making contradictory claims.",
      normFn: v => Math.min(v, 1),
    },
    sp500: {
      key:"sp500", label:"S&P 500 Momentum", cat:"market", color:"#3B82F6",
      weight:0.12, active:true, val:null, norm:null, trend:"flat", series:[], src:"Yahoo Finance",
      unit:"index", desc:"US equity benchmark. Rising S&P = risk-on, lower entropy. Falling = risk-off, higher uncertainty.",
      normFn: v => Math.max(0, Math.min(1, 0.5 - (v / 5500 - 1) * 3)),
    },
    vix: {
      key:"vix", label:"VIX Fear Index", cat:"market", color:"#EF4444",
      weight:0.12, active:true, val:null, norm:null, trend:"flat", series:[], src:"Yahoo Finance",
      unit:"", desc:"CBOE Volatility Index. Measures expected 30-day market volatility. VIX > 30 = fear mode, high entropy.",
      normFn: v => Math.min(v / 60, 1),
    },
    dxy: {
      key:"dxy", label:"DXY Dollar Index", cat:"market", color:"#8B5CF6",
      weight:0.06, active:true, val:null, norm:null, trend:"flat", series:[], src:"Yahoo Finance",
      unit:"", desc:"US Dollar Index vs major currencies. Strong dollar = global liquidity tightening, elevated macro stress.",
      normFn: v => Math.max(0, Math.min(1, (v - 95) / 20)),
    },
    solar: {
      key:"solar", label:"Solar Activity (Kp)", cat:"planet", color:"#F5C842",
      weight:0.04, active:true, val:null, norm:null, trend:"flat", series:[], src:"NOAA SWPC",
      unit:"Kp", desc:"Geomagnetic activity index. High Kp correlates with market anomalies and communication disruption.",
      normFn: v => Math.min(v / 9, 1),
    },
    seismic: {
      key:"seismic", label:"Global Seismic Energy", cat:"planet", color:"#2ECC71",
      weight:0.03, active:true, val:null, norm:null, trend:"flat", series:[], src:"USGS",
      unit:"avg mag", desc:"Global 30-day average earthquake magnitude. Extreme events signal supply-chain and infrastructure stress.",
      normFn: v => Math.min(Math.max(0, (v - 2.5) / 5), 1),
    },
    gdelt: {
      key:"gdelt", label:"Global Conflict Tone", cat:"planet", color:"#EC4899",
      weight:0.03, active:true, val:null, norm:null, trend:"flat", series:[], src:"GDELT Project",
      unit:"conflict score", desc:"GDELT global event conflict/tone index. Higher = more negative global news tone, geopolitical stress.",
      normFn: v => Math.min(Math.max(0, v / 100), 1),
    },
    fred_epu: {
      key:"fred_epu", label:"Economic Policy Uncertainty", cat:"derived", color:"#F97316",
      weight:0.00, active:false, val:null, norm:null, trend:"flat", series:[], src:"FRED · Needs API key",
      unit:"EPU index", desc:"Federal Reserve Economic Policy Uncertainty Index. Measures uncertainty in economic policy direction.",
      normFn: v => Math.min(v / 300, 1),
      needsKey: "fred",
    },
    eia_grid: {
      key:"eia_grid", label:"US Grid Demand", cat:"planet", color:"#06B6D4",
      weight:0.00, active:false, val:null, norm:null, trend:"flat", series:[], src:"EIA · Needs API key",
      unit:"GW", desc:"US electricity grid demand. Extreme demand signals economic overheating or weather stress.",
      normFn: v => Math.min(Math.max(0, (v - 350) / 150), 1),
      needsKey: "eia",
    },
    who_life_expectancy: {
      key:"who_life_expectancy", label:"Life Expectancy (Global)", cat:"health", color:"#00BFFF",
      weight:0.03, active:true, val:null, norm:null, trend:"flat", series:[], src:"MLE · WHO GHO",
      unit:"yrs", desc:"WHO GHO global life expectancy at birth (both sexes, via MLE backplane). Falling expectancy = elevated systemic health stress.",
      normFn: v => Math.max(0, Math.min(1, 1 - (v - 50) / 40)),
    },
    who_pm25: {
      key:"who_pm25", label:"PM2.5 Exposure (Global)", cat:"health", color:"#95E1D3",
      weight:0.03, active:true, val:null, norm:null, trend:"flat", series:[], src:"MLE · WHO GHO",
      unit:"µg/m³", desc:"WHO GHO ambient fine particulate exposure. Higher concentration = greater environmental health burden.",
      normFn: v => Math.min(Math.max(0, v / 100), 1),
    },
    who_immunization: {
      key:"who_immunization", label:"DTP3 Immunization (Global)", cat:"health", color:"#4ECDC4",
      weight:0.02, active:true, val:null, norm:null, trend:"flat", series:[], src:"MLE · WHO GHO",
      unit:"%", desc:"WHO GHO global DTP3 immunization coverage. Lower coverage = weaker herd immunity = elevated health stress.",
      normFn: v => Math.max(0, Math.min(1, 1 - v / 100)),
    },
    covid_cases: {
      key:"covid_cases", label:"COVID Cumulative Cases", cat:"health", color:"#E74C3C",
      weight:0.00, active:false, val:null, norm:null, trend:"flat", series:[], src:"MLE · disease.sh",
      unit:"cases", desc:"Global cumulative confirmed COVID-19 cases (disease.sh). Off by default — cumulative, low marginal entropy.",
      normFn: v => Math.min(v / 700e6, 1),
    },
  };
}

// ── Mock series generator ─────────────────────────────────────────────────────
function mockSeries(days: number, base: number, vol: number): LayerSeries[] {
  const s: LayerSeries[] = []; let v = base;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    v = Math.max(0.01, v * (1 + (Math.random() - 0.5) * vol));
    s.push({ date: d.toISOString().split("T")[0], value: v });
  }
  return s;
}

// ── Layer category colors ─────────────────────────────────────────────────────
const CAT_LABEL: Record<string, string> = {
  lnes: "INTEL", market: "MARKET", planet: "PLANETARY", derived: "DERIVED", health: "HEALTH", custom: "CUSTOM",
};

// ── Main component ────────────────────────────────────────────────────────────
export default function OriginIndexPage() {
  const [layers, setLayers]         = useState<Record<string, Layer>>(makeLayers);
  const [apiKeys, setApiKeys]       = useState<Record<string, string>>({});
  const [tf, setTf]                 = useState("1M");
  const [sigQuery, setSigQuery]     = useState("");
  const [sigResults, setSigResults] = useState<any[]>([]);
  const [sigBusy, setSigBusy]       = useState(false);
  const [adaptive, setAdaptive]     = useState(false);
  const adaptiveRef                 = useRef(false);
  adaptiveRef.current = adaptive;
  const [project, setProject]       = useState(false);
  const [forecast, setForecast]     = useState<any | null>(null);
  const forecastRef                 = useRef<any | null>(null);
  forecastRef.current = project ? forecast : null;
  const [sigGeo, setSigGeo]         = useState("");
  const [vgBusy, setVgBusy]         = useState(false);
  const [brief, setBrief]           = useState("Awaiting signal convergence. Click Generate Brief.");
  const [briefMeta, setBriefMeta]   = useState("Not generated");
  const [briefLoading, setBriefLoading] = useState(false);
  const [lastSync, setLastSync]     = useState("—");
  const [serverIndex, setServerIndex]   = useState<number | null>(null);  // authoritative /api/origin value
  const [serverStatus, setServerStatus] = useState<string>("");
  const [showKeys, setShowKeys]     = useState(false);
  const [keyInputs, setKeyInputs]   = useState<Record<string,string>>({});
  const [isPro, setIsPro] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("origin_pro") === "1"; } catch { return false; }
  });
  const [showPro, setShowPro] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const [subMsg, setSubMsg]   = useState<string>("");

  // Server-backed Pro entitlement (subscription on the central balance)
  useEffect(() => {
    let tok = "";
    try { tok = localStorage.getItem("en_token") || ""; } catch {}
    if (!tok) return;
    fetch("/api/apps/entitlement?app_key=origin_pro", { headers: { Authorization: "Bearer " + tok } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.entitled) setIsPro(true); })
      .catch(() => {});
  }, []);

  const subscribePro = async () => {
    setSubBusy(true); setSubMsg("");
    let tok = "";
    try { tok = localStorage.getItem("en_token") || ""; } catch {}
    if (!tok) { setSubMsg("Sign in to the portal to subscribe."); setSubBusy(false); return; }
    try {
      const res = await fetch("/api/apps/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
        body: JSON.stringify({ app_key: "origin_pro" }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && (d.status === "subscribed" || d.status === "already_subscribed")) {
        setIsPro(true); setShowPro(false);
        try { localStorage.setItem("origin_pro", "1"); } catch {}
      } else if (res.status === 402) {
        setSubMsg("Not enough USDC — add funds in the Billing tab (wallet or card).");
      } else {
        setSubMsg(d.message || d.error || "Subscription failed. Try again.");
      }
    } catch {
      setSubMsg("Network error. Try again.");
    } finally { setSubBusy(false); }
  };
  const canvasRef                   = useRef<HTMLCanvasElement>(null);
  const INTEL_API                   = "/intel/api";

  // ── Compute composite score ───────────────────────────────────────────────
  const computeScore = useCallback((ls: Record<string, Layer>, tfKey: string): LayerSeries[] => {
    const active = Object.values(ls).filter(l => l.active && l.series.length > 0);
    if (!active.length) return [];
    const cutoff = (() => {
      const d = new Date();
      switch (tfKey) {
        case "1D": d.setDate(d.getDate() - 1); break;
        case "1W": d.setDate(d.getDate() - 7); break;
        case "1M": d.setMonth(d.getMonth() - 1); break;
        case "3M": d.setMonth(d.getMonth() - 3); break;
        case "1Y": d.setFullYear(d.getFullYear() - 1); break;
        default:   return "";
      }
      return d.toISOString().split("T")[0];
    })();
    const allDates = [...new Set(active.flatMap(l => l.series.map(d => d.date)))].sort();
    const dates = cutoff ? allDates.filter(d => d >= cutoff) : allDates;
    const adapt = adaptiveRef.current;
    const wOf = new Map<string, number>();
    active.forEach(l => {
      if (adapt) {
        const ns = l.series.map(d => l.normFn(d.value));
        const m = ns.reduce((a, b) => a + b, 0) / (ns.length || 1);
        const varr = ns.reduce((a, b) => a + (b - m) * (b - m), 0) / (ns.length || 1);
        wOf.set(l.key, varr + 1e-4);            // information-weighted (variance of normalized signal)
      } else {
        wOf.set(l.key, l.weight);
      }
    });
    return dates.map(date => {
      let weighted = 0, wsum = 0;
      active.forEach(l => {
        // most recent point on or before this date; exclude the layer if it has no data yet
        let pt: LayerSeries | undefined;
        for (const d of l.series) { if (d.date <= date) pt = d; else break; }
        if (pt) { const w = wOf.get(l.key) || 0; weighted += l.normFn(pt.value) * w; wsum += w; }
      });
      return { date, value: wsum > 0 ? (weighted / wsum) * 1000 : 0 };
    });
  }, []);

  const currentScore = useCallback((ls: Record<string, Layer>): number | null => {
    const active = Object.values(ls).filter(l => l.active && l.norm !== null);
    if (!active.length) return null;
    const totalW = active.reduce((s, l) => s + l.weight, 0) || 1;
    return active.reduce((s, l) => s + (l.norm ?? 0) * l.weight, 0) / totalW * 1000;
  }, []);

  // ── Canvas chart ──────────────────────────────────────────────────────────
  const drawChart = useCallback((ls: Record<string, Layer>, tfKey: string) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const _lt = typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = { t: 10, r: 16, b: 28, l: 52 };
    ctx.clearRect(0, 0, W, H);

    const histData = computeScore(ls, tfKey);
    if (histData.length < 2) return;
    const fcast = forecastRef.current;
    const fcArr = (fcast && Array.isArray(fcast.forecast)) ? fcast.forecast : [];
    const data = fcArr.length ? histData.concat(fcArr.map((f: any) => ({ date: f.date, value: f.value }))) : histData;
    const boundary = histData.length - 1;
    const scaleVals = data.map(d => d.value).concat(fcArr.flatMap((f: any) => [f.lo, f.hi]));
    const minV = Math.min(...scaleVals) * 0.99, maxV = Math.max(...scaleVals) * 1.01;
    const rng = maxV - minV || 1;
    const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
    const toX = (i: number) => pad.l + (i / (data.length - 1)) * cW;
    const toY = (v: number) => pad.t + cH - ((v - minV) / rng) * cH;

    // grid
    ctx.strokeStyle = _lt ? "rgba(148,163,184,0.45)" : "rgba(30,32,48,0.8)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (cH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = _lt ? "#64748B" : "#3A3D5C"; ctx.font = "10px Space Mono"; ctx.textAlign = "right";
      ctx.fillText((maxV - (rng / 4) * i).toFixed(0), pad.l - 6, y + 4);
    }
    const step = Math.ceil(data.length / 5);
    ctx.fillStyle = _lt ? "#64748B" : "#3A3D5C"; ctx.textAlign = "center";
    for (let i = 0; i < data.length; i += step) ctx.fillText(data[i].date.slice(5), toX(i), H - 6);

    // ghost layer lines
    Object.values(ls).forEach(l => {
      if (!l.active || l.series.length < 2) return;
      const cutoff = (() => { const d = new Date(); switch(tfKey){ case "1D": d.setDate(d.getDate()-1); break; case "1W": d.setDate(d.getDate()-7); break; case "1M": d.setMonth(d.getMonth()-1); break; case "3M": d.setMonth(d.getMonth()-3); break; case "1Y": d.setFullYear(d.getFullYear()-1); break; default: return ""; } return d.toISOString().split("T")[0]; })();
      const ls2 = cutoff ? l.series.filter(d => d.date >= cutoff) : l.series;
      if (ls2.length < 2) return;
      ctx.strokeStyle = l.color + "22"; ctx.lineWidth = 1;
      ctx.beginPath();
      ls2.forEach((d, i) => {
        const n = l.normFn(d.value);
        const x = pad.l + (i / (ls2.length - 1)) * cW;
        const y = pad.t + cH - n * cH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // gradient fill
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
    grad.addColorStop(0, "rgba(0,229,176,0.16)"); grad.addColorStop(1, "rgba(0,229,176,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let i = 0; i <= boundary; i++) { const x = toX(i), y = toY(data[i].value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.lineTo(toX(boundary), pad.t + cH); ctx.lineTo(toX(0), pad.t + cH);
    ctx.closePath(); ctx.fill();

    // main line (history)
    ctx.strokeStyle = "#00E5B0"; ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0,229,176,0.5)"; ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i <= boundary; i++) { const x = toX(i), y = toY(data[i].value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke(); ctx.shadowBlur = 0;
    // forecast projection (confidence band + dotted line)
    if (fcArr.length) {
      ctx.fillStyle = "rgba(0,191,255,0.10)";
      ctx.beginPath();
      ctx.moveTo(toX(boundary), toY(data[boundary].value));
      fcArr.forEach((f: any, k: number) => ctx.lineTo(toX(boundary + 1 + k), toY(f.hi)));
      for (let k = fcArr.length - 1; k >= 0; k--) ctx.lineTo(toX(boundary + 1 + k), toY(fcArr[k].lo));
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#00BFFF"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(toX(boundary), toY(data[boundary].value));
      fcArr.forEach((f: any, k: number) => ctx.lineTo(toX(boundary + 1 + k), toY(f.value)));
      ctx.stroke(); ctx.setLineDash([]);
    }

    // end dot
    const lx = toX(boundary), ly = toY(data[boundary].value);
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#00E5B0"; ctx.shadowColor = "rgba(0,229,176,0.8)"; ctx.shadowBlur = 12;
    ctx.fill(); ctx.shadowBlur = 0;
  }, [computeScore]);

  // ── Data fetchers ─────────────────────────────────────────────────────────
  const updateLayer = useCallback((key: string, updates: Partial<Layer>) => {
    setLayers(prev => ({ ...prev, [key]: { ...prev[key], ...updates } }));
  }, []);

  const fetchInternalData = useCallback(async () => {
    try {
      const res = await fetch(`${INTEL_API}/origin`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const d = await res.json();
        if (typeof d.origin_index === "number") setServerIndex(d.origin_index);
        if (typeof d.status === "string") setServerStatus(d.status);
        const v = d.vectors;
        // Real hourly/daily history for the LNES vectors (replaces fabricated mockSeries)
        let hist: Record<string, LayerSeries[]> = {};
        try {
          const hr = await fetch(`${INTEL_API}/origin/history?hours=168`, { signal: AbortSignal.timeout(8000) });
          if (hr.ok) hist = (await hr.json()).series ?? {};
        } catch { /* history optional */ }
        const realSeries = (key: string, liveVal: number): LayerSeries[] => {
          const s = hist[key];
          if (Array.isArray(s) && s.length > 0) return s;
          // no DB history → single live point (never fabricate a trend)
          return [{ date: new Date().toISOString().split("T")[0], value: liveVal }];
        };
        if (v?.intel_signals) {
          const val = v.intel_signals.value;
          updateLayer("intel_signals", { val, norm: v.intel_signals.normalized,
            trend: val > 5 ? "up" : val < 2 ? "down" : "flat",
            src: "Intel Console · LIVE",
            series: realSeries("intel_signals", val) });
        }
        if (v?.vanguard) {
          const val = v.vanguard.value;
          updateLayer("vanguard", { val, norm: v.vanguard.normalized,
            trend: val > 50 ? "up" : "flat",
            src: "Vanguard (Azure) · LIVE",
            series: realSeries("vanguard", val) });
        }
        if (v?.event_stress) {
          const val = v.event_stress.value;
          updateLayer("event_stress", { val, norm: v.event_stress.normalized,
            trend: val > 5 ? "up" : "flat",
            src: "Intel Scrapers · LIVE",
            series: realSeries("event_stress", val) });
        }
        if (v?.truth_stress) {
          const rate = d.network?.clcs_24h > 0
            ? (v.truth_stress.value ?? 0)
            : 0;
          updateLayer("truth_stress", { val: rate, norm: rate,
            trend: rate > 0.3 ? "up" : "flat",
            src: "LNES-05 · LIVE",
            series: realSeries("truth_stress", rate) });
        }
      }
    } catch { /* fallback to mock */ }
  }, [updateLayer]);

  const fetchYahoo = useCallback(async (symbol: string, key: string) => {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error("yahoo fail");
      const data = await res.json();
      const result = data.chart?.result?.[0];
      if (!result) throw new Error("no result");
      const closes = result.indicators.quote[0].close;
      const ts = result.timestamp;
      const series: LayerSeries[] = [];
      for (let i = 0; i < ts.length; i++) {
        if (closes[i] != null)
          series.push({ date: new Date(ts[i] * 1000).toISOString().split("T")[0], value: closes[i] });
      }
      const live = closes.filter(Boolean).at(-1) as number;
      const prev = closes.filter(Boolean).at(-21) as number;
      updateLayer(key, {
        val: live, norm: layers[key]?.normFn(live) ?? null,
        trend: live > prev * 1.005 ? "up" : live < prev * 0.995 ? "down" : "flat",
        series, src: "Yahoo Finance · LIVE",
      });
    } catch {
      const defaults: Record<string, number> = { sp500: 5400, vix: 18, dxy: 104 };
      const base = defaults[key] ?? 100;
      const series = mockSeries(180, base, key === "vix" ? 0.06 : 0.01);
      const live = series.at(-1)!.value;
      updateLayer(key, { val: live, norm: layers[key]?.normFn(live) ?? null, trend: "flat", series, src: "Yahoo Finance · MOCK" });
    }
  }, [layers, updateLayer]);

  const fetchSolar = useCallback(async () => {
    try {
      const res = await fetch("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json", { signal: AbortSignal.timeout(8000) });
      const data = await res.json() as { kp_index: string; time_tag: string }[];
      const kp = parseFloat(data.at(-1)!.kp_index) || 0;
      const prevKp = parseFloat(data.at(-61)?.kp_index ?? "0") || 0;
      const series: LayerSeries[] = data.slice(-720).map(p => ({
        date: p.time_tag.split("T")[0], value: parseFloat(p.kp_index) || 0,
      }));
      updateLayer("solar", { val: kp, norm: Math.min(kp / 9, 1),
        trend: kp > prevKp + 0.5 ? "up" : kp < prevKp - 0.5 ? "down" : "flat",
        series, src: "NOAA SWPC · LIVE" });
    } catch {
      const series = mockSeries(90, 2.5, 0.3);
      updateLayer("solar", { val: 2.5, norm: 0.28, trend: "flat", series, src: "NOAA SWPC · MOCK" });
    }
  }, [updateLayer]);

  const fetchSeismic = useCallback(async () => {
    try {
      const start = new Date(Date.now() - 86400000 * 30).toISOString().split("T")[0];
      const end   = new Date().toISOString().split("T")[0];
      const res = await fetch(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&endtime=${end}&minmagnitude=2.5`,
        { signal: AbortSignal.timeout(12000) }
      );
      const data = await res.json() as { features: { properties: { mag: number; time: number } }[] };
      const mags = data.features.map(f => f.properties.mag);
      const avg  = mags.reduce((a, b) => a + b, 0) / (mags.length || 1);
      const daily: Record<string, { sum: number; n: number }> = {};
      data.features.forEach(f => {
        const d = new Date(f.properties.time).toISOString().split("T")[0];
        if (!daily[d]) daily[d] = { sum: 0, n: 0 };
        daily[d].sum += f.properties.mag; daily[d].n++;
      });
      const series = Object.entries(daily)
        .map(([date, v]) => ({ date, value: v.sum / v.n }))
        .sort((a, b) => a.date.localeCompare(b.date));
      updateLayer("seismic", { val: avg, norm: Math.min(Math.max(0, (avg - 2.5) / 5), 1),
        trend: "flat", series, src: `USGS · LIVE · ${mags.length} events` });
    } catch {
      const series = mockSeries(30, 3.8, 0.1);
      updateLayer("seismic", { val: 3.8, norm: 0.26, trend: "flat", series, src: "USGS · MOCK" });
    }
  }, [updateLayer]);

  const fetchGDELT = useCallback(async () => {
    // GDELT TV API — global conflict/news tone score (no auth needed)
    try {
      const now = new Date();
      const end = now.toISOString().replace(/[-:T.]/g, "").slice(0, 14);
      const start30 = new Date(now.getTime() - 86400000 * 2);
      const startStr = start30.toISOString().replace(/[-:T.]/g, "").slice(0, 14);
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20geopolitical%20war&mode=VolInfo&startdatetime=${startStr}&enddatetime=${end}&format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error("gdelt fail");
      const data = await res.json() as { totalrows?: number; vols?: { value: number; date: string }[] };
      const score = Math.min(100, (data.totalrows ?? 0) / 50);
      const series = mockSeries(30, score, 0.15);
      updateLayer("gdelt", { val: score, norm: score / 100,
        trend: score > 30 ? "up" : "flat", series, src: "GDELT · LIVE" });
    } catch {
      const series = mockSeries(30, 25, 0.2);
      updateLayer("gdelt", { val: 25, norm: 0.25, trend: "flat", series, src: "GDELT · MOCK" });
    }
  }, [updateLayer]);

  const fetchFRED = useCallback(async (key: string) => {
    if (!key) return;
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=USEPUINDXD&api_key=${key}&limit=90&sort_order=desc&file_type=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await res.json() as { observations: { date: string; value: string }[] };
      const series = data.observations
        .filter(o => o.value !== ".")
        .map(o => ({ date: o.date, value: parseFloat(o.value) }))
        .reverse();
      const live = series.at(-1)?.value ?? 150;
      updateLayer("fred_epu", { val: live, norm: Math.min(live / 300, 1), trend: live > 200 ? "up" : "flat", series, src: "FRED · LIVE", active: true, weight: 0.05 });
    } catch { /* invalid key or no data */ }
  }, [updateLayer]);

  const fetchEIA = useCallback(async (key: string) => {
    if (!key) return;
    try {
      const url = `https://api.eia.gov/v2/electricity/rto/region-data/data/?frequency=hourly&data[0]=value&facets[respondent][]=US48&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=168&api_key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await res.json() as { response?: { data: { period: string; value: string }[] } };
      if (!data.response?.data?.length) throw new Error("no data");
      const values = data.response.data.map(d => parseFloat(d.value)).filter(v => !isNaN(v));
      const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1) / 1000; // MW → GW approx
      updateLayer("eia_grid", { val: avg, norm: Math.min(Math.max(0, (avg - 350) / 150), 1), trend: "flat", src: "EIA · LIVE", active: true, weight: 0.05 });
    } catch { /* invalid key */ }
  }, [updateLayer]);

  // ── Refresh all ───────────────────────────────────────────────────────────
  // ── Health source-pack (server-side via MLE /series proxy; never mock) ─────
  const fetchHealth = useCallback(async () => {
    await Promise.allSettled(HEALTH_SERIES.map(async (h) => {
      try {
        const qs = new URLSearchParams({ source: h.source, indicator: h.indicator, geo: h.geo, window: h.window }).toString();
        const res = await fetch(`${INTEL_API}/origin/series?${qs}`, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const d = await res.json();
        const ok = (d.status === "live" || d.status === "cached") && Array.isArray(d.series) && d.series.length > 0;
        setLayers(prev => {
          const L = prev[h.key]; if (!L) return prev;
          if (!ok) return { ...prev, [h.key]: { ...L, val: null, norm: null, series: [], src: `MLE · ${h.source} · UNAVAILABLE` } };
          const series = d.series as LayerSeries[];
          const val = typeof d.val === "number" ? d.val : series[series.length - 1].value;
          const prevVal = L.series.length ? L.series[L.series.length - 1].value : val;
          return { ...prev, [h.key]: { ...L, val, norm: L.normFn(val), series,
            trend: val > prevVal ? "up" : val < prevVal ? "down" : "flat",
            src: `MLE · ${d.source} · ${String(d.status).toUpperCase()}` } };
        });
      } catch {
        setLayers(prev => { const L = prev[h.key]; if (!L) return prev;
          return { ...prev, [h.key]: { ...L, val: null, norm: null, series: [], src: `MLE · ${h.source} · UNAVAILABLE` } }; });
      }
    }));
  }, []);

  const refreshAll = useCallback(async () => {
    await fetchInternalData();
    await Promise.allSettled([
      fetchYahoo("%5EGSPC", "sp500"),
      fetchYahoo("%5EVIX", "vix"),
      fetchYahoo("DX-Y.NYB", "dxy"),
      fetchSolar(),
      fetchSeismic(),
      fetchGDELT(),
      fetchHealth(),
      ...(apiKeys.fred ? [fetchFRED(apiKeys.fred)] : []),
      ...(apiKeys.eia  ? [fetchEIA(apiKeys.eia)]   : []),
    ]);
    setLastSync(new Date().toLocaleTimeString());
  }, [fetchInternalData, fetchYahoo, fetchSolar, fetchSeismic, fetchGDELT, fetchHealth, fetchFRED, fetchEIA, apiKeys]);

  // ── Vanguard brief ────────────────────────────────────────────────────────
  const generateBrief = useCallback(async () => {
    setBriefLoading(true);
    setBrief("Synthesizing planetary state via Vanguard SGX...");
    try {
      const res = await fetch(`${INTEL_API}/intel/daily-brief`, { signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const d = await res.json() as { narrative?: string; costUsdc?: string };
        if (d.narrative) {
          setBrief(d.narrative);
          setBriefMeta(`Vanguard · ${new Date().toLocaleTimeString()} · ${d.costUsdc ? `$${d.costUsdc} USDC` : "SGX sealed"}`);
          setBriefLoading(false); return;
        }
      }
    } catch { /* fallback */ }
    const score = serverIndex ?? currentScore(layers) ?? 400;
    setBrief(score > 600
      ? "Global signal entropy is elevated. Multiple vectors indicate simultaneous stress across market, planetary, and intelligence layers. The Origin Index elevation suggests reduced prediction reliability. Apply caution to all high-divergence position decisions."
      : score > 350
      ? "Signal environment is at nominal levels. The Intel swarm is processing within expected parameters. Market and planetary telemetry are within two sigma of baseline. Standard analytical confidence applies to divergence scores."
      : "Low-entropy environment detected. Signal channels are clear and operating at high fidelity. This is an optimal window for high-confidence analytical operations. Intel divergence scores carry maximum reliability."
    );
    setBriefMeta(`Vanguard · ${new Date().toLocaleTimeString()} · local synthesis`);
    setBriefLoading(false);
  }, [currentScore, layers]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const data = computeScore(layers, "MAX");
    const csv = "Date,Origin Index\n" + data.map(d => `${d.date},${d.value.toFixed(4)}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `origin_index_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }, [computeScore, layers]);

  // ── Init + intervals ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("origin_api_keys_v3");
      if (saved) {
        const k = JSON.parse(saved) as Record<string, string>;
        setApiKeys(k); setKeyInputs(k);
      }
    } catch { /* */ }
    // Seed with mock data immediately
    setLayers(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (!next[k].series.length) {
          const bases: Record<string, number> = { sp500: 5400, vix: 18, dxy: 103, solar: 3, seismic: 3.8, gdelt: 25, intel_signals: 6, vanguard: 40, event_stress: 4, truth_stress: 0.2 };
          const vols: Record<string, number>  = { sp500: 0.008, vix: 0.05, dxy: 0.005, solar: 0.3, seismic: 0.1, gdelt: 0.2, intel_signals: 0.15, vanguard: 0.2, event_stress: 0.25, truth_stress: 0.3 };
          const base = bases[k] ?? 50;
          next[k] = { ...next[k], series: mockSeries(90, base, vols[k] ?? 0.01), val: base, norm: next[k].normFn(base), trend: "flat" };
        }
      });
      return next;
    });
    setTimeout(refreshAll, 300);
    const liveInterval = setInterval(() => {
      setLayers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (next[k].series.length) {
            const last = next[k].series.at(-1)!;
            last.value *= (1 + (Math.random() - 0.5) * 0.003);
            next[k] = { ...next[k], norm: next[k].normFn(last.value) };
          }
        });
        return next;
      });
    }, 5000);
    const fullInterval = setInterval(refreshAll, 60000);
    return () => { clearInterval(liveInterval); clearInterval(fullInterval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { drawChart(layers, tf); }, [layers, tf, drawChart, forecast]);
  // ── Forecast the composite via MLE /forecast when Project is on ────────────
  useEffect(() => {
    if (!project) { setForecast(null); return; }
    const hist = computeScore(layers, tf);
    if (hist.length < 4) { setForecast(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${INTEL_API}/origin/forecast`, { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ series: hist, horizon: 6 }), signal: AbortSignal.timeout(15000) });
        const d = await res.json();
        if (!cancelled) setForecast(d);
      } catch { if (!cancelled) setForecast(null); }
    })();
    return () => { cancelled = true; };
  }, [project, layers, tf, computeScore]);
  useEffect(() => { const h = () => drawChart(layers, tf); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, [layers, tf, drawChart]);

  // ── Score + helpers ───────────────────────────────────────────────────────
  const score = serverIndex ?? currentScore(layers) ?? 0;  // server /api/origin is authoritative
  const scoreColor = score < 300 ? "#00E5B0" : score < 550 ? "#3B82F6" : score < 750 ? "#F59E0B" : "#EF4444";
  const scoreLabel = score < 300 ? "Low Entropy" : score < 550 ? "Nominal" : score < 750 ? "Elevated" : "High Entropy";
  const activeLayers = Object.values(layers).filter(l => l.active);
  const totalW = activeLayers.reduce((s, l) => s + l.weight, 0);

  // ── Save API keys ─────────────────────────────────────────────────────────
  const saveKeys = useCallback(() => {
    setApiKeys(keyInputs);
    try { localStorage.setItem("origin_api_keys_v3", JSON.stringify(keyInputs)); } catch { /* */ }
    setShowKeys(false);
    if (keyInputs.fred) fetchFRED(keyInputs.fred);
    if (keyInputs.eia)  fetchEIA(keyInputs.eia);
  }, [keyInputs, fetchFRED, fetchEIA]);

  // ── Toggle + weight helpers ───────────────────────────────────────────────
  const toggleLayer = (key: string) => {
    setLayers(prev => ({ ...prev, [key]: { ...prev[key], active: !prev[key].active } }));
  };
  const setWeight = (key: string, w: number) => {
    setLayers(prev => ({ ...prev, [key]: { ...prev[key], weight: w } }));
  };

  // ── Add-any-signal (MLE catalog -> dynamic custom layer) ───────────────────
  const searchCatalog = useCallback(async (q: string) => {
    setSigQuery(q);
    if (q.trim().length < 2) { setSigResults([]); return; }
    try {
      const res = await fetch(`${INTEL_API}/origin/catalog?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) setSigResults(await res.json());
    } catch { /* */ }
  }, []);
  const addSignal = useCallback(async (item: any) => {
    const key = "custom_" + item.id;
    setSigResults([]); setSigQuery(""); setSigBusy(true);
    try {
      const qs = new URLSearchParams({ source: item.source, indicator: item.indicator, geo: (sigGeo.trim() || item.geo || ""), window: "40" }).toString();
      const res = await fetch(`${INTEL_API}/origin/series?${qs}`, { signal: AbortSignal.timeout(20000) });
      const d = await res.json();
      const ok = (d.status === "live" || d.status === "cached") && Array.isArray(d.series) && d.series.length > 0;
      const series: LayerSeries[] = ok ? d.series : [];
      const vals = series.map(p => p.value);
      const lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
      const normFn = (v: number) => (hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0.5);
      setLayers(prev => ({ ...prev, [key]: {
        key, label: item.label, cat: "custom" as const, color: "#22D3EE",
        weight: 0.05, active: ok, val: ok ? d.val : null, norm: ok ? normFn(d.val) : null,
        trend: "flat" as const, series,
        src: ok ? `MLE · ${d.source} · ${String(d.status).toUpperCase()}` : `MLE · ${item.source} · UNAVAILABLE`,
        unit: item.unit || "", desc: `Custom signal via MLE backplane (${item.source}/${item.indicator}). Auto-normalized to its own range.`,
        normFn,
      } }));
    } catch { /* */ } finally { setSigBusy(false); }
  }, []);
  const removeSignal = (key: string) => setLayers(prev => { const n = { ...prev }; delete n[key]; return n; });
  // Open-ended resolution via Vanguard (SEI LLM), verified against live data server-side.
  const resolveWithVanguard = useCallback(async (q: string) => {
    if (q.trim().length < 2) return;
    setVgBusy(true);
    try {
      const res = await fetch(`${INTEL_API}/origin/resolve?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(55000) });
      const d = await res.json();
      if (d.vanguard) setSigResults([{ ...d.vanguard, _vg: true }]);
      else if (Array.isArray(d.candidates) && d.candidates.length) setSigResults(d.candidates);
      else setSigResults([{ id: "none", _none: true, label: `Vanguard could not map "${q}" to a known indicator` }]);
    } catch { setSigResults([{ id: "none", _none: true, label: "Vanguard resolve failed — try again" }]); }
    finally { setVgBusy(false); }
  }, []);

  const trendData = computeScore(layers, tf);
  const last2 = trendData.slice(-2);
  const scoreDelta = last2.length === 2 ? last2[1].value - last2[0].value : 0;
  const scorePct   = last2.length === 2 && last2[0].value ? (scoreDelta / last2[0].value) * 100 : 0;

  // ── Cat groups for sidebar ────────────────────────────────────────────────
  const cats: { key: Layer["cat"]; label: string }[] = [
    { key: "lnes", label: "INTEL CONSOLE" },
    { key: "market", label: "MARKET REALITY" },
    { key: "planet", label: "PLANETARY TELEMETRY" },
    { key: "derived", label: "DERIVED (needs API key)" },
    { key: "health", label: "GLOBAL HEALTH" },
    { key: "custom", label: "CUSTOM SIGNALS" },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div data-origin style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, lineHeight: 1.5, color: "var(--oi-text)", position: "relative" }}>
      <style>{`
        [data-origin] { --oi-bg: #05060A; --oi-surface: #0C0D13; --oi-surface2: #12131C; --oi-border: #1E2030; --oi-border-mid: #252840; --oi-muted: #3A3D5C; --oi-dim: #6B7094; --oi-accent: #00E5B0; --oi-purple: #7C6FE4; --oi-text: #E8EAF0; }
        [data-theme="light"] [data-origin] { --oi-bg: #FFFFFF; --oi-surface: #F1F5F9; --oi-surface2: #FFFFFF; --oi-border: #E2E8F0; --oi-border-mid: #CBD5E1; --oi-muted: #94A3B8; --oi-dim: #64748B; --oi-accent: #0D9488; --oi-purple: #7C6FE4; --oi-text: #0F172A; }
        [data-origin] .oi-tf { background: transparent; border: 1px solid var(--oi-border); color: var(--oi-dim); font-family: 'Space Mono', monospace; font-size: 10px; padding: 3px 9px; border-radius: 3px; cursor: pointer; transition: all 0.12s; }
        [data-origin] .oi-tf:hover, [data-origin] .oi-tf.active { border-color: var(--oi-accent); color: var(--oi-accent); background: rgba(0,229,176,0.08); }
        [data-origin] .oi-toggle { width: 28px; height: 15px; background: var(--oi-border-mid); border-radius: 8px; position: relative; cursor: pointer; border: none; transition: background 0.2s; flex-shrink: 0; }
        [data-origin] .oi-toggle.on { background: var(--oi-accent); }
        [data-origin] .oi-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; border-radius: 50%; background: var(--oi-text); transition: left 0.2s; }
        [data-origin] .oi-toggle.on::after { left: 15px; }
        [data-origin] .oi-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 3px; border-radius: 2px; background: var(--oi-border); outline: none; cursor: pointer; }
        [data-origin] .oi-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: var(--oi-accent); cursor: pointer; }
        [data-origin] .oi-layer-card { background: var(--oi-surface2); border: 1px solid var(--oi-border); border-radius: 6px; padding: 11px 12px; margin-bottom: 6px; transition: border-color 0.15s; }
        [data-origin] .oi-layer-card.active-lnes { border-color: rgba(124,111,228,0.4); background: rgba(124,111,228,0.06); }
        [data-origin] .oi-layer-card.active-market { border-color: rgba(59,130,246,0.3); }
        [data-origin] .oi-layer-card.active-planet { border-color: rgba(0,229,176,0.25); }
        [data-origin] .oi-src { font-size: 9px; letter-spacing: 0.06em; padding: 1px 5px; border-radius: 3px; background: var(--oi-surface); color: var(--oi-muted); display: inline-block; }
        [data-origin] .oi-src.lnes { background: rgba(124,111,228,0.12); color: var(--oi-purple); }
        [data-origin] .oi-btn { font-family: 'Space Mono', monospace; font-size: 10px; padding: 5px 12px; border-radius: 3px; cursor: pointer; transition: all 0.12s; }
        [data-origin] .oi-btn-ghost { background: transparent; border: 1px solid var(--oi-border-mid); color: var(--oi-dim); }
        [data-origin] .oi-btn-ghost:hover { color: #E8EAF0; border-color: var(--oi-accent); }
        [data-origin] .oi-btn-accent { background: var(--oi-accent); border: none; color: #05060A; font-weight: 700; letter-spacing: 0.04em; }
        [data-origin] .oi-btn-accent:hover { box-shadow: 0 0 14px rgba(0,229,176,0.4); }
        [data-origin] .oi-blink { animation: oi-blink 1.4s infinite; }
        @keyframes oi-blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        [data-origin] .oi-vec-card { background: var(--oi-surface2); border: 1px solid var(--oi-border); border-radius: 6px; padding: 12px; transition: border-color 0.15s; }
        [data-origin] .oi-vec-card:hover { border-color: var(--oi-border-mid); }
        [data-origin] .oi-vec-card.lnes { border-color: rgba(124,111,228,0.25); }
        [data-origin] .oi-modal { position: fixed; inset: 0; background: rgba(5,6,10,0.85); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
      `}</style>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--oi-bg)", borderBottom: "1px solid var(--oi-border)", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700 }}>Origin Index</div>
            <div style={{ fontSize: 10, color: "var(--oi-dim)" }}>Planetary signal entropy · {activeLayers.length} layers active</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#00E5B0", border: "1px solid rgba(0,229,176,0.25)", padding: "3px 10px", borderRadius: 20 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00E5B0", boxShadow: "0 0 8px rgba(0,229,176,0.4)" }} className="oi-blink" />
            LIVE
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {isPro ? (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#F59E0B", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 20, padding: "3px 11px" }}>✦ PRO</span>
          ) : (
            <button className="oi-btn" style={{ background: "#F59E0B", border: "none", color: "var(--oi-bg)", fontWeight: 700, letterSpacing: "0.04em" }} onClick={() => setShowPro(true)}>✦ Upgrade to Pro</button>
          )}
          <button className="oi-btn oi-btn-ghost" onClick={() => isPro ? setShowKeys(true) : setShowPro(true)} title={isPro ? "" : "Pro feature"}>⚙ API Keys{!isPro && <span style={{color:"#F59E0B",marginLeft:4,fontSize:9}}>PRO</span>}</button>
          <button className="oi-btn oi-btn-ghost" onClick={() => isPro ? exportCSV() : setShowPro(true)} title={isPro ? "" : "Pro feature"}>↓ CSV{!isPro && <span style={{color:"#F59E0B",marginLeft:4,fontSize:9}}>PRO</span>}</button>
          <button className="oi-btn oi-btn-accent" onClick={refreshAll}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Pro upgrade modal ── */}
      {showPro && (
        <div className="oi-modal" onClick={() => setShowPro(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 470, maxWidth: "92vw", background: "linear-gradient(160deg,var(--oi-surface2),var(--oi-surface))", border: "1px solid var(--oi-border-mid)", borderRadius: 14, padding: 26, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: 260, height: 260, right: -70, top: -110, background: "radial-gradient(circle,rgba(245,158,11,0.18),transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "relative" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#F59E0B", marginBottom: 6 }}>✦ ORIGIN INDEX PRO</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, color: "#F8FAFC", letterSpacing: "-0.02em" }}>Unlock the full oracle</div>
              <div style={{ fontSize: 12, color: "var(--oi-dim)", marginTop: 6, lineHeight: 1.6 }}>Everything in Free, plus premium data layers, AI synthesis and machine-readable access.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, margin: "18px 0" }}>
                {[
                  ["Premium data layers", "FRED Economic Policy Uncertainty + EIA grid-load vectors"],
                  ["Vanguard daily brief", "AI-synthesized planetary state, on demand"],
                  ["Custom weighting", "Tune every layer's contribution to the composite"],
                  ["Full history export", "Download the complete Origin Index time series as CSV"],
                  ["Threshold alerts", "Webhook / email when entropy crosses your bands"],
                  ["M2M Pro API", "Higher rate limits + the /history endpoint for agents"],
                ].map(([t, d]) => (
                  <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: "#F59E0B", fontSize: 13, lineHeight: 1.3 }}>✦</span>
                    <div>
                      <div style={{ fontSize: 12.5, color: "var(--oi-text)", fontWeight: 600 }}>{t}</div>
                      <div style={{ fontSize: 11, color: "var(--oi-dim)" }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={subscribePro} disabled={subBusy} style={{ flex: 1, background: "#F59E0B", border: "none", color: "var(--oi-bg)", fontWeight: 800, fontSize: 13, letterSpacing: "0.03em", borderRadius: 10, padding: "12px 0", cursor: subBusy ? "wait" : "pointer", fontFamily: "'Syne',sans-serif", opacity: subBusy ? 0.7 : 1 }}>{subBusy ? "Processing…" : "Upgrade — $19/mo"}</button>
                <button onClick={() => setShowPro(false)} className="oi-btn oi-btn-ghost" style={{ padding: "12px 16px" }}>Maybe later</button>
              </div>
              {subMsg && <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>{subMsg}</div>}
              <div style={{ fontSize: 10, color: "var(--oi-muted)", marginTop: 10, textAlign: "center" }}>Billed in USDC from your central balance · cancel anytime</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Formula bar ─────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--oi-surface)", borderBottom: "1px solid var(--oi-border)", padding: "8px 24px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
        <span style={{ color: "var(--oi-muted)", letterSpacing: "0.08em" }}>ORIGIN =</span>
        {activeLayers.map((l, i) => (
          <span key={l.key}>
            <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, background: l.cat === "lnes" ? "rgba(124,111,228,0.12)" : l.cat === "market" ? "rgba(59,130,246,0.1)" : "rgba(0,229,176,0.08)", color: l.cat === "lnes" ? "#7C6FE4" : l.cat === "market" ? "#3B82F6" : "#00E5B0", border: `1px solid ${l.color}33` }}>
              {l.label} {l.weight !== 1 ? `×${l.weight.toFixed(2)}` : ""}
            </span>
            {i < activeLayers.length - 1 && <span style={{ color: "var(--oi-muted)", margin: "0 4px" }}>+</span>}
          </span>
        ))}
        {activeLayers.length === 0 && <span style={{ color: "var(--oi-muted)" }}>No layers active</span>}
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "264px 1fr", minHeight: "calc(100vh - 140px)" }}>

        {/* SIDEBAR */}
        <aside style={{ borderRight: "1px solid var(--oi-border)", overflowY: "auto", padding: "16px 0", background: "var(--oi-surface)", position: "sticky", top: 88, height: "calc(100vh - 88px)" }}>

          {/* Score panel */}
          <div style={{ margin: "0 12px 16px", background: "linear-gradient(135deg,var(--oi-surface2),var(--oi-surface2))", border: "1px solid var(--oi-border-mid)", borderRadius: 8, padding: 14, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%,rgba(0,229,176,0.08),transparent 70%)", pointerEvents: "none" }} />
            <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "var(--oi-muted)", marginBottom: 4 }}>ORIGIN INDEX · COMPOSITE</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800, color: scoreColor, letterSpacing: "-0.03em", lineHeight: 1, textShadow: `0 0 32px ${scoreColor}66` }}>{score.toFixed(1)}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: scoreDelta >= 0 ? "#00E5B0" : "#EF4444" }}>
              {scoreDelta >= 0 ? "▲ +" : "▼ "}{Math.abs(scorePct).toFixed(2)}% from prior
            </div>
            <div style={{ height: 2, background: "var(--oi-border)", borderRadius: 1, marginTop: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, score / 10)}%`, background: `linear-gradient(90deg,${scoreColor},#00BFFF)`, borderRadius: 1, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--oi-muted)", marginTop: 3 }}>
              <span>Low entropy</span><span>High entropy</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: scoreColor, fontWeight: 700, letterSpacing: "0.06em" }}>{scoreLabel}</div>
          </div>

          {/* Add any signal (MLE catalog) */}
          <div style={{ padding: "4px 12px 14px" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "var(--oi-muted)", padding: "0 12px 8px" }}>ADD ANY SIGNAL · MLE</div>
            <input value={sigQuery} onChange={e => searchCatalog(e.target.value)} placeholder="Search: inflation, co2, unemployment…"
              style={{ width: "100%", padding: "8px 10px", fontSize: 11, background: "var(--oi-surface2)", border: "1px solid var(--oi-border)", borderRadius: 6, color: "var(--oi-text)", outline: "none", boxSizing: "border-box" }} />
            <input value={sigGeo} onChange={e => setSigGeo(e.target.value)} placeholder="geo (optional): USA, CHN, WLD…"
              style={{ width: "100%", padding: "6px 10px", fontSize: 10, marginTop: 6, background: "var(--oi-surface2)", border: "1px solid var(--oi-border)", borderRadius: 6, color: "var(--oi-dim)", outline: "none", boxSizing: "border-box" }} />
            {(sigBusy || vgBusy) && <div style={{ fontSize: 9, color: vgBusy ? "#9B87F5" : "var(--oi-dim)", marginTop: 6, paddingLeft: 2 }}>{vgBusy ? "Asking Vanguard…" : "Resolving via MLE…"}</div>}
            {sigResults.length > 0 && (
              <div style={{ marginTop: 6, border: "1px solid var(--oi-border)", borderRadius: 6, overflow: "hidden", background: "var(--oi-surface2)" }}>
                {sigResults.map(r => (
                  r._none ? (
                    <div key="none" style={{ padding: "7px 10px", fontSize: 10, color: "var(--oi-dim)" }}>{r.label}</div>
                  ) : (
                  <div key={r.id} onClick={() => addSignal(r)}
                    style={{ padding: "7px 10px", fontSize: 11, cursor: "pointer", borderBottom: "1px solid var(--oi-border)", display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{r._vg ? "✨ " : ""}{r.label}{r._vg && r.verified === false ? " (unverified)" : ""}</span>
                    <span style={{ color: r._vg ? "#9B87F5" : "var(--oi-dim)", fontSize: 9 }}>{r.source}{r._vg ? " · vanguard" : ""}</span>
                  </div>
                  )
                ))}
              </div>
            )}
            {sigResults.length === 0 && sigQuery.trim().length >= 3 && !sigBusy && !vgBusy && (
              <button onClick={() => resolveWithVanguard(sigQuery)}
                style={{ marginTop: 6, width: "100%", padding: "7px 10px", fontSize: 10, cursor: "pointer", background: "rgba(124,111,228,0.12)", color: "#9B87F5", border: "1px solid rgba(124,111,228,0.35)", borderRadius: 6 }}>
                ✨ Ask Vanguard to resolve &quot;{sigQuery}&quot;
              </button>
            )}
          </div>

          {/* Layer groups */}
          {cats.map(cat => {
            const catLayers = Object.values(layers).filter(l => l.cat === cat.key);
            if (!catLayers.length) return null;
            return (
              <div key={cat.key}>
                <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "var(--oi-muted)", padding: "0 24px 8px", borderBottom: "1px solid var(--oi-border)", marginBottom: 10, marginTop: 6 }}>{cat.label}</div>
                <div style={{ padding: "0 12px" }}>
                  {catLayers.map(l => (
                    <div key={l.key} className={`oi-layer-card ${l.active ? `active-${l.cat}` : ""}`}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: l.active ? l.color : "var(--oi-muted)", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{l.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button className={`oi-toggle ${l.active ? "on" : ""}`} onClick={() => toggleLayer(l.key)} />
                          {l.cat === "custom" && <button onClick={() => removeSignal(l.key)} title="Remove signal" style={{ background: "none", border: "none", color: "var(--oi-dim)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>}
                        </div>
                      </div>
                      {l.needsKey && !apiKeys[l.needsKey] && (
                        <div style={{ fontSize: 9, color: "#F59E0B", marginBottom: 4 }}>→ Set {l.needsKey.toUpperCase()} key to activate</div>
                      )}
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: l.active ? l.color : "var(--oi-muted)", marginBottom: 2 }}>
                        {l.val != null ? (l.val > 100 ? l.val.toFixed(0) : l.val.toFixed(2)) : "—"} <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "var(--oi-dim)" }}>{l.unit}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--oi-dim)", marginBottom: 8, lineHeight: 1.4 }}>{l.desc}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <input type="range" className="oi-slider" min={0} max={50} value={Math.round(l.weight * 100)} onChange={e => setWeight(l.key, parseInt(e.target.value) / 100)} />
                        <span style={{ fontSize: 10, color: "#00E5B0", minWidth: 30, textAlign: "right" }}>{l.weight.toFixed(2)}</span>
                      </div>
                      <span className={`oi-src ${l.cat === "lnes" ? "lnes" : ""}`}>{l.src}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </aside>

        {/* MAIN */}
        <main style={{ overflow: "hidden", paddingBottom: 48 }}>

          {/* Chart area */}
          <div style={{ borderBottom: "1px solid var(--oi-border)", padding: "20px 24px 16px", background: "var(--oi-surface)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "var(--oi-muted)", marginBottom: 4 }}>PLANETARY EXERGY GRADIENT</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Origin Index</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 800, color: scoreColor, letterSpacing: "-0.04em", lineHeight: 1, textShadow: `0 0 40px ${scoreColor}44` }}>{score.toFixed(2)}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: scoreDelta >= 0 ? "#00E5B0" : "#EF4444" }}>
                  {scoreDelta >= 0 ? "▲ +" : "▼ "}{Math.abs(scorePct).toFixed(2)}% ({Math.abs(scoreDelta).toFixed(1)} pts)
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {["1D","1W","1M","3M","1Y","MAX"].map(t => (
                  <button key={t} className={`oi-tf ${tf === t ? "active" : ""}`} onClick={() => setTf(t)}>{t}</button>
                ))}
                <button className={`oi-tf ${adaptive ? "active" : ""}`} title="Adaptive (β): weight layers by information content (variance of the normalized signal). Affects the chart composite only — the authoritative server index is unchanged." onClick={() => setAdaptive(a => !a)}>β&nbsp;ADAPT</button>
                <button className={`oi-tf ${project ? "active" : ""}`} title="Project (β): forecast the composite forward 6 steps via the MLE model (linear trend + EWMA, 95% band). Visualization only." onClick={() => setProject(p => !p)}>↗&nbsp;PROJECT</button>
              </div>
            </div>
            <canvas ref={canvasRef} style={{ width: "100%", height: 200, display: "block", borderRadius: 3 }} />
          </div>

          {/* LNES Network Strip */}
          <div style={{ borderBottom: "1px solid var(--oi-border)", padding: "12px 24px", background: "linear-gradient(90deg,rgba(124,111,228,0.05),transparent)", display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
            {[
              { id:"INTEL SIGNALS", val: layers.intel_signals.val != null ? `${Math.round(layers.intel_signals.val)} HIGH` : "—", label:"24h · anomalies" },
              { id:"VANGUARD",      val: layers.vanguard.val != null ? `${Math.round(layers.vanguard.val)} ops` : "—", label:"inference/hr" },
              { id:"LNES-05",       val: layers.truth_stress.val != null ? `${(layers.truth_stress.val * 100).toFixed(0)}%` : "—", label:"inconsistency rate" },
              { id:"GDELT TONE",    val: layers.gdelt.val != null ? layers.gdelt.val.toFixed(0) : "—", label:"conflict score" },
              { id:"SOLAR Kp",      val: layers.solar.val != null ? `${layers.solar.val.toFixed(1)} Kp` : "—", label:"NOAA SWPC" },
              { id:"VIX",           val: layers.vix.val != null ? layers.vix.val.toFixed(1) : "—", label:"fear index" },
            ].map((item, i) => (
              <div key={item.id} style={{ display: "flex", flexShrink: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 20px" }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#7C6FE4" }}>{item.id}</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--oi-text)" }}>{item.val}</div>
                  <div style={{ fontSize: 10, color: "var(--oi-dim)" }}>{item.label}</div>
                </div>
                {i < 5 && <div style={{ width: 1, height: 36, background: "var(--oi-border)", alignSelf: "center", flexShrink: 0 }} />}
              </div>
            ))}
          </div>

          {/* Vector Grid */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--oi-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700 }}>Live Signal Vectors</div>
              <span style={{ fontSize: 9, letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 20, background: "rgba(0,229,176,0.08)", color: "#00E5B0", border: "1px solid rgba(0,229,176,0.25)" }}>
                {activeLayers.length} ACTIVE
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 8 }}>
              {Object.values(layers).filter(l => l.active).map(l => {
                const pct = l.norm != null ? Math.round(l.norm * 100) : 0;
                const trendIcon = l.trend === "up" ? "▲" : l.trend === "down" ? "▼" : "→";
                const trendCls  = l.trend === "up" ? "#00E5B0" : l.trend === "down" ? "#EF4444" : "var(--oi-muted)";
                return (
                  <div key={l.key} className={`oi-vec-card ${l.cat === "lnes" ? "lnes" : ""}`}>
                    <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--oi-muted)", marginBottom: 5 }}>{CAT_LABEL[l.cat]}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: l.color, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 2 }}>
                      {l.val != null ? (l.val > 100 ? l.val.toFixed(0) : l.val < 1 ? (l.val * 100).toFixed(0) + "%" : l.val.toFixed(2)) : "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--oi-dim)", marginBottom: 7 }}>{l.label}</div>
                    <div style={{ height: 2, background: "var(--oi-border)", borderRadius: 1, marginBottom: 5 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: l.color, borderRadius: 1 }} />
                    </div>
                    <div style={{ fontSize: 10, color: trendCls }}>{trendIcon} {l.trend === "up" ? "Rising" : l.trend === "down" ? "Falling" : "Stable"}</div>
                    <span className={`oi-src ${l.cat === "lnes" ? "lnes" : ""}`} style={{ marginTop: 5 }}>{l.src}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vanguard Brief */}
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700 }}>Vanguard Strategic Directive</div>
              <button className="oi-btn oi-btn-ghost" onClick={() => isPro ? generateBrief() : setShowPro(true)} disabled={briefLoading}>
                {briefLoading ? "Synthesizing…" : "↻ Generate Brief"}
              </button>
            </div>
            <div style={{ background: "var(--oi-surface2)", border: "1px solid var(--oi-border-mid)", borderRadius: 8, padding: 18, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,#7C6FE4,transparent)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 9, letterSpacing: "0.1em", padding: "2px 8px", borderRadius: 3, background: "rgba(124,111,228,0.12)", color: "#7C6FE4", border: "1px solid rgba(124,111,228,0.3)" }}>VANGUARD PRO · SGX SEALED</span>
                <span style={{ fontSize: 11, color: "var(--oi-dim)" }}>Deterministic Depth Gating · zero-retention</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--oi-text)", lineHeight: 1.7, letterSpacing: "0.01em" }}>{brief}</div>
              <div style={{ borderTop: "1px solid var(--oi-border)", marginTop: 12, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--oi-muted)" }}>
                <span>{briefMeta}</span>
                <span>Last sync: {lastSync}</span>
              </div>
            </div>
          </div>

          {/* Signal Environment Summary */}
          <div style={{ padding: "0 24px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label:"Signal clarity",        val: score < 300 ? "High" : score < 550 ? "Good" : score < 750 ? "Fair" : "Low",        good: score < 300, poor: score >= 750 },
              { label:"Prediction environment", val: score < 300 ? "Optimal" : score < 550 ? "Standard" : score < 750 ? "Caution" : "High noise", good: score < 300, poor: score >= 750 },
              { label:"Active data sources",    val: `${activeLayers.length} layers`, good: activeLayers.length > 6, poor: activeLayers.length < 3 },
              { label:"Intel weight coverage",  val: `${(totalW * 100).toFixed(0)}%`, good: totalW > 0.8, poor: totalW < 0.4 },
            ].map(item => (
              <div key={item.label} style={{ background: "var(--oi-surface2)", border: "1px solid var(--oi-border)", borderRadius: 6, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--oi-dim)" }}>{item.label}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: item.poor ? "#EF4444" : item.good ? "#00E5B0" : "#F59E0B" }}>{item.val}</span>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* API Keys Modal */}
      {showKeys && (
        <div className="oi-modal" onClick={e => { if (e.target === e.currentTarget) setShowKeys(false); }}>
          <div style={{ background: "var(--oi-surface2)", border: "1px solid var(--oi-border-mid)", borderRadius: 8, padding: 24, width: 480, maxWidth: "90vw", position: "relative" }}>
            <button onClick={() => setShowKeys(false)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "1px solid var(--oi-border)", borderRadius: 3, color: "var(--oi-dim)", cursor: "pointer", width: 26, height: 26, fontSize: 14 }}>✕</button>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 6 }}>API Configuration</div>
            <div style={{ fontSize: 12, color: "var(--oi-dim)", marginBottom: 18, lineHeight: 1.6 }}>Optional keys unlock additional layers. All stored locally in your browser only.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { key: "fred", label: "FRED (Economic Policy Uncertainty)", placeholder: "api.stlouisfed.org — free, register at fred.stlouisfed.org" },
                { key: "eia",  label: "EIA Open Data (US Grid Demand)", placeholder: "eia.gov/opendata — free registration" },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--oi-dim)", display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input type="text" value={keyInputs[f.key] ?? ""} onChange={e => setKeyInputs(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    style={{ width: "100%", fontFamily: "'Space Mono', monospace", fontSize: 11, background: "var(--oi-bg)", border: "1px solid var(--oi-border)", color: "var(--oi-text)", padding: "7px 10px", borderRadius: 3, outline: "none" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="oi-btn oi-btn-ghost" onClick={() => setShowKeys(false)}>Cancel</button>
              <button className="oi-btn oi-btn-accent" onClick={saveKeys}>Save & Connect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
