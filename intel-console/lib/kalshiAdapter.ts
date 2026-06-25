// lib/kalshiAdapter.ts
// Kalshi REST API v2 — RSA-SHA256 (PKCS1v15) signed requests
// Auth: https://trading-api.readme.io/reference/authentication
// Prices: 0–100 integer cents, normalized to 0–1 internally

import { createSign } from 'crypto';
import { readFileSync } from 'fs';

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

// ─── Auth ────────────────────────────────────────────────────────────────────

function getPrivateKey(): string {
  const keyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
  if (keyPath) {
    try { return readFileSync(keyPath, 'utf8'); } catch {}
  }
  // Fallback: inline key via env (newlines encoded as \n literal)
  const inline = process.env.KALSHI_PRIVATE_KEY;
  if (inline) return inline.replace(/\\n/g, '\n');
  return '';
}

function kalshiHeaders(method: string, path: string): Record<string, string> {
  const keyId      = process.env.KALSHI_API_KEY_ID ?? '';
  const privateKey = getPrivateKey();
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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KalshiMarket {
  id: string;
  question: string;
  description: string;
  category: string;
  endDate: string;
  volume: number;
  liquidity: number;
  openInterest: number;
  yesPrice: number;  // 0–1
  noPrice: number;   // 0–1
  sourceUrl: string;
}

interface KalshiRawMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  yes_sub_title?: string;
  event_ticker: string;
  category?: string;
  status: string;
  // Legacy cent-scale fields (old API)
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  // New dollar-scale fields (elections API, 0.0–1.0)
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  last_price_dollars?: string;
  mve_collection_ticker?: string; // present on parlay/multi-variate markets
  volume: number;
  volume_fp?: string;
  open_interest: number;
  open_interest_fp?: string;
  close_time: string;
  liquidity: number;
  liquidity_dollars?: string;
}

interface KalshiCandlestick {
  end_period_ts: number;
  yes_open: number;
  yes_close: number;
  yes_high: number;
  yes_low: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeCents(cents: number): number {
  const val = cents / 100;
  return Math.min(1, Math.max(0, isNaN(val) ? 0.5 : val));
}

function normalizeKalshiCategory(raw: string, ticker = '', eventTicker = '', title = ''): string {
  // Kalshi's category field is almost always blank — use all available text
  const all = [raw, ticker, eventTicker, title].join(' ').toLowerCase();

  // Sports: check ticker prefixes + common sports keywords
  if (/\b(nba|nfl|mlb|nhl|ncaa|pga|ufc|mls|fifa|nascar|wnba|soccer|baseball|basketball|football|golf|tennis|hockey|sport|mvp|playoff|championship|world\s*cup|super\s*bowl|draft|bowl|series|parlay|game|player|innings|quarter|touchdown|homerun)\b/.test(all)) return 'sports';

  // Crypto
  if (/\b(crypto|bitcoin|ethereum|btc|eth|sol|xrp|defi|nft|blockchain|coinbase|binance)\b/.test(all)) return 'crypto';

  // Politics / elections
  if (/\b(election|president|senate|congress|vote|democrat|republican|trump|harris|governor|mayor|politic|ballot|primary|tariff|sanction|war|ceasefire|nato|un\b)/.test(all)) return 'politics';

  // Economics / macro
  if (/\b(fed|gdp|inflation|cpi|unemployment|recession|interest\s*rate|oil|gas|commodit|market|stock|nasdaq|sp500|dow|earnings|ipo)\b/.test(all)) return 'economics';

  return 'other';
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchKalshiMarkets(maxTotal = 600): Promise<KalshiMarket[]> {
  if (!process.env.KALSHI_API_KEY_ID) return [];

  const PAGE_SIZE = 200; // Kalshi max per page
  const allRaw: KalshiRawMarket[] = [];
  let cursor: string | undefined;
  let pages = 0;
  const maxPages = Math.ceil(maxTotal / PAGE_SIZE);

  // Paginate until we have enough or run out of pages
  while (pages < maxPages) {
    const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const apiPath  = `/markets?status=open&limit=${PAGE_SIZE}${cursorParam}`;
    const signPath = `/trade-api/v2/markets?status=open&limit=${PAGE_SIZE}${cursorParam}`;

    try {
      const res = await fetch(`${KALSHI_BASE}${apiPath}`, {
        headers: kalshiHeaders('GET', signPath),
        next: { revalidate: 300 },
      } as RequestInit);

      if (!res.ok) {
        const body = await res.text().catch(() => res.status.toString());
        console.error(`[Kalshi] markets error ${res.status}: ${body.slice(0, 200)}`);
        break;
      }

      const data = await res.json();
      const batch: KalshiRawMarket[] = (data as { markets?: KalshiRawMarket[]; cursor?: string }).markets ?? [];
      allRaw.push(...batch);
      cursor = (data as { cursor?: string }).cursor;
      pages++;

      if (!cursor || batch.length < PAGE_SIZE) break; // no more pages
    } catch (err) {
      console.error('[Kalshi] page fetch failed:', err);
      break;
    }
  }

  console.log(`[Kalshi] fetched ${allRaw.length} markets across ${pages} page(s)`);

  try {
    const markets = allRaw;

    return markets
      .filter(m => m.status === 'active' || m.status === 'open')
      .map(m => {
        // Elections API returns prices in 0.0–1.0 dollar scale (_dollars fields)
        // Legacy API uses cent scale (0–100) in yes_bid/yes_ask
        let yesPrice: number;
        let noPrice: number;
        if (m.yes_bid_dollars != null || m.yes_ask_dollars != null) {
          // Dollar scale: already 0–1, no division needed
          const yb = parseFloat(m.yes_bid_dollars ?? '0');
          const ya = parseFloat(m.yes_ask_dollars ?? '0');
          const yMid = (yb + ya) / 2;
          const lp   = parseFloat(m.last_price_dollars ?? '0');
          yesPrice = Math.min(1, Math.max(0, isNaN(yMid) || yMid === 0 ? (isNaN(lp) ? 0.5 : lp) : yMid));
        } else if (m.yes_bid != null) {
          // Legacy cent scale
          const yesMid = (m.yes_bid + (m.yes_ask ?? m.yes_bid)) / 2;
          yesPrice = normalizeCents(yesMid);
        } else {
          yesPrice = normalizeCents(m.last_price ?? 50);
        }
        noPrice = Math.round((1 - yesPrice) * 1000) / 1000;

        // Build the cleanest available question text
        // For MVE parlay markets, title is 'yes Leg1,yes Leg2,...' — clean it up
        const rawTitle = m.subtitle ?? m.title ?? '';
        const question = (() => {
          if (!rawTitle.trim().toLowerCase().startsWith('yes ')) return rawTitle || m.event_ticker || m.ticker;
          // Clean parlay: strip 'yes ' prefix from each leg
          const legs = rawTitle.split(',').map((l: string) => l.replace(/^yes\s+/i, '').trim()).filter(Boolean);
          const preview = legs.slice(0, 3).join(' + ');
          const extra  = legs.length > 3 ? ` (+${legs.length - 3} more)` : '';
          const sport  = m.event_ticker?.includes('MLB') ? 'MLB' : m.event_ticker?.includes('NBA') ? 'NBA' : m.event_ticker?.includes('NFL') ? 'NFL' : 'Sports';
          return `${sport} Parlay: ${preview}${extra}`;
        })();

        return {
          id:           m.ticker,
          question,
          description:  m.event_ticker ?? '',
          category:     normalizeKalshiCategory(m.category ?? '', m.ticker ?? '', m.event_ticker ?? '', question),
          endDate:      m.close_time ?? '',
          volume:       m.volume ?? parseFloat(m.volume_fp ?? '0') ?? 0,
          liquidity:    m.liquidity ?? parseFloat(m.liquidity_dollars ?? '0') ?? 0,
          openInterest: m.open_interest ?? parseFloat(m.open_interest_fp ?? '0') ?? 0,
          yesPrice,
          noPrice,
          sourceUrl:    `https://kalshi.com/markets/${m.event_ticker ?? m.ticker}`,
        } satisfies KalshiMarket;
      });
  } catch (err) {
    console.error('[Kalshi] market mapping failed:', err);
    return [];
  }
}

export async function fetchKalshiCandlesticks(
  ticker: string,
  intervalMinutes: 1 | 60 | 1440 = 60
): Promise<{ t: number; open: number; close: number; high: number; low: number }[]> {
  if (!process.env.KALSHI_API_KEY_ID) return [];

  const endTs   = Math.floor(Date.now() / 1000);
  const startTs = endTs - 24 * 60 * 60;
  const apiPath = `/markets/${ticker}/candlesticks?start_ts=${startTs}&end_ts=${endTs}&period_interval=${intervalMinutes}`;
  const signPath = `/trade-api/v2/markets/${ticker}/candlesticks?start_ts=${startTs}&end_ts=${endTs}&period_interval=${intervalMinutes}`;

  try {
    const res = await fetch(`${KALSHI_BASE}${apiPath}`, {
      headers: kalshiHeaders('GET', signPath),
      next: { revalidate: 300 },
    } as RequestInit);

    if (!res.ok) return [];
    const data = await res.json();
    return (data.candlesticks ?? []).map((c: KalshiCandlestick) => ({
      t:     c.end_period_ts,
      open:  normalizeCents(c.yes_open),
      close: normalizeCents(c.yes_close),
      high:  normalizeCents(c.yes_high),
      low:   normalizeCents(c.yes_low),
    }));
  } catch {
    return [];
  }
}

// ─── Account (for future PolSignal Phase 2 — agent voting) ───────────────────

export async function fetchKalshiBalance(): Promise<{ balance: number } | null> {
  if (!process.env.KALSHI_API_KEY_ID) return null;
  const apiPath  = '/portfolio/balance';
  const signPath = '/trade-api/v2/portfolio/balance';
  try {
    const res = await fetch(`${KALSHI_BASE}${apiPath}`, {
      headers: kalshiHeaders('GET', signPath),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return { balance: (d.balance ?? 0) / 100 }; // cents → dollars
  } catch { return null; }
}

export async function fetchKalshiPositions(): Promise<{ ticker: string; position: number; cost: number }[]> {
  if (!process.env.KALSHI_API_KEY_ID) return [];
  const apiPath  = '/portfolio/positions';
  const signPath = '/trade-api/v2/portfolio/positions';
  try {
    const res = await fetch(`${KALSHI_BASE}${apiPath}`, {
      headers: kalshiHeaders('GET', signPath),
    });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.market_positions ?? []).map((p: any) => ({
      ticker:   p.market_id,
      position: p.position ?? 0,
      cost:     (p.market_exposure ?? 0) / 100,
    }));
  } catch { return []; }
}
