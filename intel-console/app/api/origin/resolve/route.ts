import { NextResponse } from "next/server";

// Free-text -> indicator resolver. Catalog-first (free, deterministic); falls back to
// Vanguard (SEI LLM) for open-ended queries, then VERIFIES the proposed code against
// live data so a hallucinated indicator can never enter the store.
const ROUTER_URL  = process.env.ROUTER_URL || "http://localhost:8080";
const VG_ENDPOINT = process.env.VANGUARD_ENDPOINT || "";
const VG_KEY      = process.env.VANGUARD_KEY || "";
const KNOWN = ["worldbank", "who_gho", "fred", "noaa", "usgs", "eia", "disease_sh"];
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const SYSTEM = `You map a natural-language request to ONE numeric data indicator from these sources:
- worldbank (codes like SP.DYN.LE00.IN, EN.GHG.CO2.PC.CE.AR5, NY.GDP.MKTP.KD.ZG, SL.UEM.TOTL.ZS, AG.LND.FRST.ZS; geo = ISO3 e.g. USA, CHN, or WLD for world)
- who_gho (codes like WHOSIS_000001, SDGPM25, WHS4_544; geo = GLOBAL or ISO3)
- fred (US series ids like UNRATE, CPIAUCSL; geo empty)
- noaa (indicator co2_mlo; geo empty)
- usgs (indicator quakes_m5; geo empty)
- eia (series ids like EBA.US48-ALL.D.H; geo empty)
Reply with ONLY compact JSON, no prose: {"source":"...","indicator":"...","geo":"...","label":"short title","unit":"..."}.
Prefer worldbank for global socio-economic/environmental metrics. If you cannot map it, reply {"source":"","indicator":""}.`;

async function vanguardResolve(q: string): Promise<any | null> {
  if (!VG_ENDPOINT || !VG_KEY) return null;
  try {
    const res = await fetch(VG_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + VG_KEY },
      body: JSON.stringify({ model: "vanguard-standard", temperature: 0, max_tokens: 160,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: q }] }),
      signal: AbortSignal.timeout(50000),
    });
    const raw = await res.text();
    let text = "";
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const p = t.slice(5).trim();
      if (p === "[DONE]") continue;
      try { const j = JSON.parse(p); text += j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? ""; } catch {}
    }
    if (!text) { try { const j = JSON.parse(raw); text = j.choices?.[0]?.message?.content ?? ""; } catch {} }
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    if (!obj.source || !obj.indicator || !KNOWN.includes(obj.source)) return null;
    return obj;
  } catch { return null; }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ candidates: [], vanguard: null });

  let candidates: any[] = [];
  try {
    const r = await fetch(`${ROUTER_URL}/catalog?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) candidates = await r.json();
  } catch {}
  if (candidates.length > 0) return NextResponse.json({ candidates, vanguard: null, via: "catalog" });

  const proposal = await vanguardResolve(q);
  if (!proposal) return NextResponse.json({ candidates: [], vanguard: null, via: "none" });

  let verified = false, val: number | null = null, status = "unverified";
  try {
    const qs = new URLSearchParams({ source: proposal.source, indicator: proposal.indicator, geo: proposal.geo || "", window: "5" }).toString();
    const sv = await fetch(`${ROUTER_URL}/series?${qs}`, { signal: AbortSignal.timeout(20000) });
    const sd = await sv.json();
    status = sd.status; verified = (sd.status === "live" || sd.status === "cached"); val = sd.val ?? null;
  } catch {}

  // close the loop: log (query -> proposed -> verified) into the evolve corpus
  fetch(`${ROUTER_URL}/feedback`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: q, source: proposal.source, indicator: proposal.indicator, geo: proposal.geo || "", verified, value: val, via: "vanguard" }),
    signal: AbortSignal.timeout(5000) }).catch(() => {});
  return NextResponse.json({ candidates: [], via: "vanguard", vanguard: {
    id: "vg_" + String(proposal.indicator || "x").replace(/[^a-zA-Z0-9]/g, "").slice(0, 20),
    label: proposal.label || q, source: proposal.source, indicator: proposal.indicator,
    geo: proposal.geo || "", unit: proposal.unit || "", verified, status, val,
  }});
}
