// lib/agent/publicAdapters.ts
// Free public API adapters — all zero-key, working from Azure cloud IPs
// USASpending: gov contracts | CourtListener: lawsuits | HackerNews: tech signal | World Bank: macro

import { safeFetch } from './security';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// ─── Shared event writer ──────────────────────────────────────────────────────

async function writeEvent(
  entityId: string, eventType: string, severity: string,
  title: string, summary: string, sourceUrl: string,
  sourceName: string, occurredAt: Date, confidence: number,
): Promise<boolean> {
  try {
    const r = await db.execute(sql`
      INSERT INTO entity_events
        (entity_id, event_type, severity, title, summary, source_url, source_name, occurred_at, confidence)
      VALUES
        (${entityId}, ${eventType}, ${severity}, ${title}, ${summary}, ${sourceUrl}, ${sourceName}, ${occurredAt}, ${confidence})
      ON CONFLICT DO NOTHING RETURNING id
    `);
    return ((r.rows ?? r) as any[]).length > 0;
  } catch { return false; }
}

// ─── 1. USASpending.gov — Federal Government Contracts ───────────────────────
// https://api.usaspending.gov  — FREE, no key, no IP restrictions
// HIGH signal: government procurement = demand signal, financial health indicator
// Finds contracts awarded TO the entity from federal agencies

export async function runUSASpendingAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const name = entity.name as string;
  if (!name) return { cost: 0, signals: 0, events: 0 };

  const searchName = name.toUpperCase(); // full name for exact match
  const shortName  = name.replace(/,? (Inc|Corp|Ltd|LLC|Co)\.?$/i, '').trim().toUpperCase();

  try {
    const res = await safeFetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'ExergyNet-Intel/1.0' },
      body: JSON.stringify({
        subawards: false,
        limit: 10,
        filters: {
          recipient_search_text: [searchName],
          award_type_codes: ['A', 'B', 'C', 'D', '02', '03', '04', '05'],
          time_period: [{ start_date: '2024-01-01', end_date: '2026-12-31' }],
        },
        fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Start Date', 'Awarding Agency'],
        sort: 'Award Amount',
        order: 'desc',
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return { cost: 0, signals: 0, events: 0 };
    const data: any = await res.json();
    const awards: any[] = data.results ?? [];
    let written = 0;

    // Filter: prevent false matches (e.g. "Apple Transfer Inc" when searching Apple)
    const filtered = awards.filter((a: any) => {
      const rn = (a["Recipient Name"] ?? "").toUpperCase();
      return rn.includes(shortName) || shortName.split(" ").every((w: string) => w.length < 4 || rn.includes(w));
    }).slice(0, 5);
    for (const a of filtered) {
      const amount  = a['Award Amount'] ? `$${Number(a['Award Amount']).toLocaleString()}` : 'undisclosed';
      const agency  = a['Awarding Agency'] ?? 'Federal Agency';
      const desc    = a['Description'] ?? 'Federal award';
      const awardId = a['Award ID'] ?? '';
      const date    = a['Start Date'] ? new Date(a['Start Date']) : new Date();

      const title   = `Gov Contract: ${desc.slice(0, 80)}`;
      const summary = `${amount} from ${agency}. Award ID: ${awardId}`;
      const url     = `https://www.usaspending.gov/award/${a.generated_internal_id ?? awardId}`;

      const severity = Number(a['Award Amount']) > 1_000_000 ? 'HIGH' : 'MEDIUM';
      const ok = await writeEvent(entity.id, 'government_contract', severity, title, summary, url, 'USASpending.gov', date, 0.92);
      if (ok) written++;
    }

    return { cost: 0, signals: written, events: written };
  } catch (err) {
    console.error('[USASpending] failed for', name, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}

// ─── 2. CourtListener — Federal Court Cases & PACER ──────────────────────────
// https://www.courtlistener.com/api/rest/v4/  — FREE, no key for basic search
// HIGH signal: lawsuits, regulatory actions, patent disputes, criminal charges
// Covers 9M+ opinions from 2,000+ courts + RECAP PACER archive

export async function runCourtListenerAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const name = entity.name as string;
  if (!name) return { cost: 0, signals: 0, events: 0 };

  const clToken = process.env.COURTLISTENER_API_KEY ?? '';
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'ExergyNet-Intel/1.0',
  };
  if (clToken) headers['Authorization'] = `Token ${clToken}`;

  try {
    // Search recent dockets mentioning the entity
    const q = `"${name}"`;
    const url = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(q)}&type=r&order_by=dateFiled+desc&stat_Precedential=on&stat_Non-Precedential=on`;

    const res = await safeFetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { cost: 0, signals: 0, events: 0 };

    const data: any = await res.json();
    const results: any[] = data.results ?? [];
    let written = 0;

    for (const r of results.slice(0, 5)) {
      const caseDate = r.dateFiled ?? r.dateArgued ?? r.dateDecided;
      const court    = r.court ?? r.court_id ?? 'Federal Court';
      const caseNum  = r.docketNumber ?? r.caseName ?? '';

      const title   = `Court Case: ${(r.caseName ?? r.case_name ?? 'Case').slice(0, 80)}`;
      const summary = `${court} | Filed: ${caseDate ?? 'Unknown'} | Docket: ${caseNum}`;
      const caseUrl = r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : `https://www.courtlistener.com/opinion/${r.cluster_id}/`;
      const date    = caseDate ? new Date(caseDate) : new Date();

      // Classify severity from keywords
      const text = (r.caseName ?? '') + (r.snippet ?? '');
      const severity = /criminal|fraud|securities|antitrust|injunction/i.test(text) ? 'HIGH'
                     : /patent|trademark|contract|breach/i.test(text)               ? 'MEDIUM'
                     : 'INFO';

      const ok = await writeEvent(entity.id, 'legal', severity, title, summary, caseUrl, 'CourtListener', date, 0.88);
      if (ok) written++;
    }

    return { cost: 0, signals: written, events: written };
  } catch (err) {
    console.error('[CourtListener] failed for', name, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}

// ─── 3. HackerNews — Tech Community Signal ───────────────────────────────────
// https://hn.algolia.com/api/v1/  — FREE, no key, no IP restrictions
// MEDIUM signal: HN stories = early tech/startup signal, community sentiment
// Particularly strong for: tech companies, crypto, AI, developer tools

export async function runHackerNewsAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const name = entity.name as string;
  if (!name) return { cost: 0, signals: 0, events: 0 };

  const searchTerm = name.replace(/,? (Inc|Corp|Ltd|LLC|Co)\.?$/i, '').trim();

  try {
    // Search HN stories from last 30 days
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(searchTerm)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=5`;

    const res = await safeFetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ExergyNet-Intel/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { cost: 0, signals: 0, events: 0 };

    const data: any = await res.json();
    const hits: any[] = data.hits ?? [];
    let written = 0;

    for (const h of hits.slice(0, 5)) {
      const points  = h.points ?? 0;
      const comments = h.num_comments ?? 0;
      const title   = `HN: ${h.title ?? 'Untitled'}`;
      const summary = `${points} pts · ${comments} comments · by ${h.author ?? 'unknown'}`;
      const hnUrl   = h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`;
      const date    = h.created_at ? new Date(h.created_at) : new Date();

      // High signal if trending (many points/comments)
      const confidence = Math.min(0.95, 0.60 + (points / 1000) * 0.3 + (comments / 500) * 0.1);

      const ok = await writeEvent(entity.id, 'news', 'INFO', title, summary, hnUrl, 'Hacker News', date, confidence);
      if (ok) written++;
    }

    return { cost: 0, signals: written, events: written };
  } catch (err) {
    console.error('[HackerNews] failed for', name, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}

// ─── 4. World Bank — Macro Economic Indicators ───────────────────────────────
// https://api.worldbank.org/v2/  — FREE, no key, works everywhere
// For macro entities: GDP, inflation, interest rates, trade data
// Maps entity type to relevant indicators

const WORLDBANK_INDICATORS: Record<string, { id: string; label: string }[]> = {
  // For S&P 500, Gold, macro entities
  macro: [
    { id: 'NY.GDP.MKTP.CD',    label: 'GDP (USD)' },
    { id: 'FP.CPI.TOTL.ZG',   label: 'Inflation (CPI %)' },
    { id: 'SL.UEM.TOTL.ZS',   label: 'Unemployment (%)' },
    { id: 'BX.KLT.DINV.CD.WD',label: 'FDI Inflows (USD)' },
  ],
  // For crypto, commodity, financial entities
  equity: [
    { id: 'FR.INR.RINR',  label: 'Real Interest Rate (%)' },
    { id: 'PA.NUS.FCRF',  label: 'Official Exchange Rate (LCU/USD)' },
  ],
};

export async function runWorldBankAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const type    = (entity.type as string) ?? 'macro';
  const name    = entity.name as string;
  const subtype = (entity.entitySubtype as string) ?? 'standard';

  // Only run for macro entities (S&P 500, Gold, economic indicators)
  if (type !== 'macro' && subtype !== 'standard') return { cost: 0, signals: 0, events: 0 };
  // Skip company-type entities — World Bank data isn't relevant
  const skip = /Inc|Corp|Ltd|LLC/.test(name) && type === 'equity';
  if (skip) return { cost: 0, signals: 0, events: 0 };

  const indicators = WORLDBANK_INDICATORS[type] ?? WORLDBANK_INDICATORS.macro;
  let written = 0;

  for (const ind of indicators.slice(0, 3)) {
    try {
      const url = `https://api.worldbank.org/v2/country/us/indicator/${ind.id}?format=json&per_page=2&mrv=2`;
      const res = await safeFetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'ExergyNet-Intel/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const data: any = await res.json();
      const points: any[] = Array.isArray(data) ? (data[1] ?? []) : [];
      if (!points.length || points[0]?.value === null) continue;

      const latest = points[0];
      const prev   = points[1];
      const val    = Number(latest.value ?? 0);
      const prevVal = prev ? Number(prev.value ?? 0) : val;
      const change  = prevVal !== 0 ? ((val - prevVal) / Math.abs(prevVal)) * 100 : 0;
      const dir     = change > 0.5 ? '▲' : change < -0.5 ? '▼' : '→';

      const title   = `Macro: ${ind.label} — US ${latest.date}`;
      const summary = `${val.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${dir} ${Math.abs(change).toFixed(1)}% vs ${prev?.date ?? 'prior year'}`;
      const url2    = `https://data.worldbank.org/indicator/${ind.id}?locations=US`;
      const date    = new Date(`${latest.date}-01-01`);

      const ok = await writeEvent(entity.id, 'macro_indicator', 'INFO', title, summary, url2, 'World Bank', date, 0.90);
      if (ok) written++;
    } catch {}
  }

  return { cost: 0, signals: written, events: written };
}

// ─── 5. FRED — Federal Reserve Economic Data ─────────────────────────────────
// https://fred.stlouisfed.org/docs/api/fred/  — FREE key from fred.stlouisfed.org
// Best for: interest rates, yield curve, money supply, sector ETF performance

export async function runFREDAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const fredKey = process.env.FRED_API_KEY;
  if (!fredKey) {
    console.log(`[FRED] SKIPPED for ${entity.name}: get free key at fred.stlouisfed.org/docs/api/fred/`);
    return { cost: 0, signals: 0, events: 0 };
  }

  const type = (entity.type as string) ?? 'macro';
  // Only relevant for macro entities
  if (!['macro', 'equity'].includes(type)) return { cost: 0, signals: 0, events: 0 };

  // Key FRED series for financial entity monitoring
  const FRED_SERIES = [
    { id: 'DFF',     label: 'Fed Funds Rate',  min_change: 0.05 },
    { id: 'T10Y2Y',  label: 'Yield Curve 10Y-2Y', min_change: 0.1 },
    { id: 'VIXCLS',  label: 'VIX (Fear Index)', min_change: 2.0 },
    { id: 'DCOILWTICO', label: 'WTI Crude Oil', min_change: 2.0 },
  ];

  let written = 0;

  for (const series of FRED_SERIES.slice(0, 3)) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${fredKey}&limit=2&sort_order=desc&file_type=json`;
      const res = await safeFetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;

      const data: any = await res.json();
      const obs: any[] = data.observations ?? [];
      if (obs.length < 2) continue;

      const latest = parseFloat(obs[0].value ?? '0');
      const prev   = parseFloat(obs[1].value ?? '0');
      if (isNaN(latest) || isNaN(prev)) continue;

      const change = latest - prev;
      if (Math.abs(change) < series.min_change) continue; // Skip noise

      const dir  = change > 0 ? '▲' : '▼';
      const title   = `FRED: ${series.label} ${dir} ${Math.abs(change).toFixed(3)}`;
      const summary = `${series.label}: ${latest} (was ${prev} on ${obs[1].date})`;
      const url2    = `https://fred.stlouisfed.org/series/${series.id}`;
      const date    = new Date(obs[0].date);

      const ok = await writeEvent(entity.id, 'macro_indicator', 'MEDIUM', title, summary, url2, 'FRED (Fed Reserve)', date, 0.92);
      if (ok) written++;
    } catch {}
  }

  return { cost: 0, signals: written, events: written };
}

// ─── 6. OpenSanctions — Sanctions & PEP Screening ────────────────────────────
// https://opensanctions.org  — FREE for non-commercial, needs API key
// Checks if entity appears on sanctions lists (OFAC, UN, EU) or PEP registries

export async function runOpenSanctionsAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const osKey = process.env.OPENSANCTIONS_API_KEY;
  if (!osKey) {
    console.log(`[OpenSanctions] SKIPPED for ${entity.name}: get free key at opensanctions.org`);
    return { cost: 0, signals: 0, events: 0 };
  }

  const name = entity.name as string;
  if (!name) return { cost: 0, signals: 0, events: 0 };

  try {
    // Entity matching endpoint — returns ranked candidates from sanctions/PEP DBs
    const res = await safeFetch('https://api.opensanctions.org/match/default', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `ApiKey ${osKey}`,
        'User-Agent': 'ExergyNet-Intel/1.0',
      },
      body: JSON.stringify({
        queries: {
          q1: {
            schema: 'Organization',
            properties: { name: [name] },
          },
        },
        algorithm: 'best',
        threshold: 0.7,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return { cost: 0, signals: 0, events: 0 };

    const data: any = await res.json();
    const responses = data.responses?.q1?.results ?? [];
    let written = 0;

    for (const hit of responses.slice(0, 3)) {
      if ((hit.score ?? 0) < 0.7) continue;

      const datasets = (hit.datasets ?? []).join(', ');
      const title   = `⚠️ Sanctions Hit: ${name} — ${datasets}`;
      const summary = `Match score: ${(hit.score * 100).toFixed(0)}% | Datasets: ${datasets} | ID: ${hit.id}`;
      const url     = `https://www.opensanctions.org/entities/${hit.id}/`;

      const ok = await writeEvent(entity.id, 'sanctions', 'HIGH', title, summary, url, 'OpenSanctions', new Date(), 0.85 * hit.score);
      if (ok) written++;
    }

    return { cost: 0, signals: written, events: written };
  } catch (err) {
    console.error('[OpenSanctions] failed for', name, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}

// ─── 7. SEC EDGAR Form 4 — Insider Trading Filings ───────────────────────────
// https://data.sec.gov  — FREE, no key, 10 req/min
// HIGH signal: executive buy/sell > $100k = directional bet by insiders

export async function runSECFormFourAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  if (!entity.symbol) return { cost: 0, signals: 0, events: 0 };

  const symbol = (entity.symbol as string).toUpperCase();

  try {
    // Step 1: resolve CIK from ticker
    const tickerRes = await safeFetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'ExergyNet-Intel/1.0 intel@exergynet.org' },
      signal: AbortSignal.timeout(8000),
    });
    if (!tickerRes.ok) return { cost: 0, signals: 0, events: 0 };
    const tickers: any = await tickerRes.json();

    let cik: string | null = null;
    for (const v of Object.values(tickers) as any[]) {
      if (v.ticker?.toUpperCase() === symbol) {
        cik = String(v.cik_str).padStart(10, '0');
        break;
      }
    }
    if (!cik) return { cost: 0, signals: 0, events: 0 };

    // Step 2: get recent filings
    const subRes = await safeFetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': 'ExergyNet-Intel/1.0 intel@exergynet.org' },
      signal: AbortSignal.timeout(8000),
    });
    if (!subRes.ok) return { cost: 0, signals: 0, events: 0 };
    const sub: any = await subRes.json();

    const recent = sub.filings?.recent ?? {};
    const forms: string[] = recent.form ?? [];
    const dates: string[] = recent.filingDate ?? [];
    const accNums: string[] = recent.accessionNumber ?? [];
    const descriptions: string[] = recent.primaryDocument ?? [];

    let written = 0;
    for (let i = 0; i < forms.length && written < 5; i++) {
      if (forms[i] !== '4') continue;
      const date = new Date(dates[i]);
      if (Date.now() - date.getTime() > 7 * 24 * 60 * 60 * 1000) continue; // skip > 7 days old

      const accFormatted = accNums[i]?.replace(/-/g, '');
      const cikNum = parseInt(cik);
      const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accFormatted}/${descriptions[i]}`;
      const title = `SEC Form 4: ${symbol} insider transaction (${dates[i]})`;
      const summary = `Recent Form 4 insider filing detected for ${entity.name}. Review for buy/sell direction.`;

      const ok = await writeEvent(entity.id, 'filing', 'MEDIUM', title, summary, url, 'SEC EDGAR', date, 0.95);
      if (ok) written++;
    }

    return { cost: 0, signals: written, events: written };
  } catch (err) {
    console.error('[SEC Form4] failed for', symbol, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}

// ─── 8. ACLED — Armed Conflict Location & Event Data ─────────────────────────
// https://acleddata.com/api  — FREE for non-commercial (OAuth Bearer auth)
// Uses email+password OAuth flow: POST /oauth/token → Bearer token (24h valid)
// CRITICAL signals: fatality events, protests, battles — for geopolitical/event entities

// Token cache — reuse for 23 hours to avoid hammering the auth endpoint
let _acledToken: string | null = null;
let _acledTokenExpiry = 0;

async function getACLEDToken(): Promise<string | null> {
  if (_acledToken && Date.now() < _acledTokenExpiry) return _acledToken;

  const email    = process.env.ACLED_EMAIL ?? '';
  const password = process.env.ACLED_PASSWORD ?? '';
  if (!email || !password) {
    console.log('[ACLED] SKIPPED: set ACLED_EMAIL + ACLED_PASSWORD in .env.local');
    return null;
  }

  try {
    const body = new URLSearchParams({
      username:   email,
      password,
      grant_type: 'password',
      client_id:  'acled',
      scope:      'authenticated',
    });
    const res = await safeFetch('https://acleddata.com/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
      signal:  AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    _acledToken = data.access_token ?? null;
    _acledTokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23h (token valid 24h)
    return _acledToken;
  } catch (err) {
    console.error('[ACLED] token request failed:', err);
    return null;
  }
}

export async function runACLEDAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const type = (entity.type as string) ?? '';
  const name = (entity.name as string) ?? '';

  // Only relevant for event, macro entities or entities with war/conflict in name
  if (!['event', 'macro'].includes(type) && !name.toLowerCase().match(/war|conflict|crisis|coup|attack/)) {
    return { cost: 0, signals: 0, events: 0 };
  }

  const token = await getACLEDToken();
  if (!token) return { cost: 0, signals: 0, events: 0 };

  // Extract country keyword from entity name (e.g. "Iran War" → "Iran")
  const keyword = name.replace(/\s+(War|Conflict|Crisis|Coup|Attack)$/i, '').trim();

  try {
    const url = `https://acleddata.com/api/acled/read?_format=json&country=${encodeURIComponent(keyword)}&limit=10&fields=event_date|event_type|actor1|notes|fatalities`;
    const res = await safeFetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      // Access denied usually means account profile not yet approved on acleddata.com
      if (res.status === 403 || res.status === 401) {
        console.log('[ACLED] Access denied — complete profile at acleddata.com/user/edit to unlock API access');
        _acledToken = null; // force re-auth on next attempt
      }
      return { cost: 0, signals: 0, events: 0 };
    }

    const data: any = await res.json();
    const events: any[] = data.data ?? [];
    let written = 0;

    for (const ev of events.slice(0, 5)) {
      const fatalities = parseInt(ev.fatalities ?? '0');
      const severity = fatalities > 10 ? 'CRITICAL' : fatalities > 0 ? 'HIGH' : 'MEDIUM';
      const title = `ACLED: ${ev.event_type} — ${ev.actor1 ?? keyword} (${ev.event_date})`;
      const summary = `${ev.notes ?? 'No details available'}. Fatalities: ${fatalities}`;

      const ok = await writeEvent(entity.id, 'conflict_event', severity, title, summary,
        'https://acleddata.com/#/dashboard', 'ACLED', new Date(ev.event_date), 0.92);
      if (ok) written++;
    }

    return { cost: 0, signals: written, events: written };
  } catch (err) {
    console.error('[ACLED] data fetch failed for', keyword, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}

// ─── 9. GDELT — Global Database of Events, Language and Tone ─────────────────
// https://api.gdeltproject.org  — FREE, no key, 100 req/min
// Covers 100+ languages, updates every 15 min — global news event mentions

export async function runGDELTAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const name = (entity.name as string) ?? '';
  if (!name) return { cost: 0, signals: 0, events: 0 };

  try {
    const q = encodeURIComponent(`"${name}"`);
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&maxrecords=10&format=json&timespan=1d`;
    const res = await safeFetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { cost: 0, signals: 0, events: 0 };

    const data: any = await res.json();
    const articles: any[] = data.articles ?? [];
    let written = 0;

    for (const art of articles.slice(0, 5)) {
      const tone = parseFloat(art.tone ?? '0');
      const severity = tone < -5 ? 'HIGH' : tone > 5 ? 'MEDIUM' : 'LOW';
      const dir = tone > 0 ? 'pos' : 'neg';
      const title = `GDELT: ${(art.title ?? name).slice(0, 100)} (tone ${dir} ${Math.abs(tone).toFixed(1)})`;
      const summary = `Source: ${art.domain ?? 'unknown'} | Language: ${art.language ?? 'en'} | ${art.seendate ?? ''}`;

      const ok = await writeEvent(entity.id, 'news_event', severity, title, summary,
        art.url ?? url, 'GDELT', new Date(), 0.75);
      if (ok) written++;
    }

    return { cost: 0, signals: written, events: written };
  } catch (err) {
    console.error('[GDELT] failed for', name, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}

// ─── 10. EIA — Energy Information Administration ──────────────────────────────
// https://api.eia.gov  — FREE (requires EIA_API_KEY, instant registration)
// WTI crude, Henry Hub gas — commodity signals for macro/equity entities

export async function runEIAAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const eiaKey = process.env.EIA_API_KEY;
  if (!eiaKey) {
    console.log(`[EIA] SKIPPED for ${entity.name}: get free key at eia.gov/opendata/register.php`);
    return { cost: 0, signals: 0, events: 0 };
  }

  const type = (entity.type as string) ?? '';
  if (!['macro', 'equity'].includes(type)) return { cost: 0, signals: 0, events: 0 };

  const SERIES = [
    { id: 'PET.RWTC.W',   label: 'WTI Crude Oil ($/bbl)', threshold: 0.03 },
    { id: 'NG.RNGWHHD.W', label: 'Henry Hub Natural Gas ($/MMBtu)', threshold: 0.03 },
  ];

  let written = 0;

  for (const series of SERIES) {
    try {
      const url = `https://api.eia.gov/v2/seriesid/${series.id}?api_key=${eiaKey}&data%5B0%5D=value&sort%5B0%5D%5Bcolumn%5D=period&sort%5B0%5D%5Bdirection%5D=desc&length=2`;
      const res = await safeFetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;

      const data: any = await res.json();
      const rows: any[] = (data.response?.data ?? data.response ?? []) as any[];
      if (rows.length < 2) continue;

      const latest = parseFloat(rows[0].value ?? '0');
      const prev   = parseFloat(rows[1].value ?? '0');
      if (isNaN(latest) || isNaN(prev) || prev === 0) continue;

      const pctChange = (latest - prev) / prev;
      if (Math.abs(pctChange) < series.threshold) continue;

      const dir = pctChange > 0 ? 'up' : 'down';
      const title = `EIA: ${series.label} ${dir} ${(Math.abs(pctChange) * 100).toFixed(1)}% w/w`;
      const summary = `Latest: ${latest.toFixed(2)} (was ${prev.toFixed(2)} prior week, period: ${rows[0].period})`;

      const ok = await writeEvent(entity.id, 'commodity', 'MEDIUM', title, summary,
        'https://www.eia.gov/petroleum/data.php', 'EIA', new Date(), 0.90);
      if (ok) written++;
    } catch {}
  }

  return { cost: 0, signals: written, events: written };
}

// ─── 11. Wayback Machine — Web Presence History ───────────────────────────────
// https://archive.org  — FREE, no key, 200 req/min
// Detects when a company's website goes dark or hasn't been crawled recently

export async function runWaybackAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const groundUrl = entity.groundTruthUrl as string;
  if (!groundUrl || !groundUrl.startsWith('http')) return { cost: 0, signals: 0, events: 0 };

  let domain: string;
  try { domain = new URL(groundUrl).hostname; } catch { return { cost: 0, signals: 0, events: 0 }; }

  try {
    const url = `http://archive.org/wayback/available?url=${encodeURIComponent(domain)}`;
    const res = await safeFetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { cost: 0, signals: 0, events: 0 };

    const data: any = await res.json();
    const snap = data.archived_snapshots?.closest;
    if (!snap) return { cost: 0, signals: 0, events: 0 };

    const rawTs = snap.timestamp as string; // "20260101120000"
    const snapDate = new Date(
      `${rawTs.slice(0,4)}-${rawTs.slice(4,6)}-${rawTs.slice(6,8)}T${rawTs.slice(8,10)}:${rawTs.slice(10,12)}:${rawTs.slice(12,14)}Z`
    );
    const daysSince = (Date.now() - snapDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince > 60) {
      const ok = await writeEvent(entity.id, 'web_change', 'HIGH',
        `Wayback: ${domain} — last snapshot ${Math.round(daysSince)} days ago`,
        `Most recent Wayback snapshot: ${snap.timestamp}. Website may have changed significantly or gone dark.`,
        snap.url, 'Wayback Machine', snapDate, 0.70);
      return { cost: 0, signals: ok ? 1 : 0, events: ok ? 1 : 0 };
    }

    return { cost: 0, signals: 0, events: 0 }; // healthy — no event needed
  } catch (err) {
    console.error('[Wayback] failed for', domain, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}
