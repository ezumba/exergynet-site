// lib/polymarketAdapter.ts
// Polymarket Gamma API — public, no auth required
// IMPORTANT: volume, liquidity, outcomes, outcomePrices are STRINGS in the API — parse explicitly.

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB  = "https://clob.polymarket.com";

export interface PolyMarket {
  id: string;
  question: string;
  description: string;
  category: string;
  endDate: string;
  volume: number;
  liquidity: number;
  yesPrice: number;
  noPrice: number;
  primaryTokenId: string | null;
  active: boolean;
  closed: boolean;
  sourceUrl: string;
}

function safeJsonParse<T>(str: unknown, fallback: T): T {
  if (Array.isArray(str)) return str as unknown as T;
  try { return JSON.parse(String(str)); } catch { return fallback; }
}

function detectCategory(question: string, tags: string[]): string {
  const q = question.toLowerCase();
  const t = tags.join(" ").toLowerCase();
  const all = q + " " + t;
  if (/bitcoin|ethereum|crypto|btc|eth|sol|xrp|defi/.test(all))  return "crypto";
  if (/election|president|senate|congress|vote|democrat|republican|trump|harris/.test(all)) return "politics";
  if (/gdp|inflation|fed|interest rate|cpi|unemployment|recession|tariff/.test(all)) return "economics";
  if (/(nba|nfl|mlb|nhl|ncaa|pga|ufc|mls|wnba|nascar|fifa|soccer|baseball|basketball|football|golf|tennis|hockey|sport|mvp|playoff|championship|world cup|super bowl|draft|bowl|series|game|player|innings|quarter|touchdown|homerun|pennant|stanley|wimbledon|masters|grand slam|transfer|title|season|roster)/.test(all))  return "sports";
  return "other";
}

export async function fetchPolyMarkets(maxTotal = 300): Promise<PolyMarket[]> {
  const PAGE_SIZE = 100; // Polymarket Gamma API max
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allMarkets: Record<string, any>[] = [];
  let offset = 0;
  let pages = 0;
  const maxPages = Math.ceil(maxTotal / PAGE_SIZE);

  while (pages < maxPages) {
    const url = `${GAMMA}/markets?active=true&closed=false&limit=${PAGE_SIZE}&offset=${offset}&order=volume&ascending=false`;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ExergyNet-Intel/1.0" },
        next: { revalidate: 300 },
      } as RequestInit);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batch: Record<string, any>[] = ((data as any).markets ?? (Array.isArray(data) ? data : []));
      allMarkets.push(...batch);
      pages++;
      offset += PAGE_SIZE;
      if (batch.length < PAGE_SIZE) break; // last page
    } catch (err) {
      console.error("Polymarket page fetch failed:", err);
      break;
    }
  }

  console.log(`[Polymarket] fetched ${allMarkets.length} markets across ${pages} page(s)`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markets: Record<string, any>[] = allMarkets;

  return markets
    .filter(m => m.active && !m.closed)
    .map(m => {
      const prices: string[] = safeJsonParse(m.outcomePrices, ["0.5", "0.5"]);
      const tags: string[]   = safeJsonParse(m.tags, []);
      const tagLabels = tags.map((t: unknown) =>
        typeof t === "object" && t !== null ? String((t as Record<string, unknown>).label ?? "") : String(t)
      );
      const _rawYes = parseFloat(prices[0] ?? "0.5");
      const yesPrice = Math.min(1, Math.max(0, isNaN(_rawYes) ? 0.5 : _rawYes));
      const tokens: { token_id: string; outcome: string }[] = Array.isArray(m.tokens)
        ? m.tokens as { token_id: string; outcome: string }[]
        : [];

      return {
        id:             String(m.id ?? m.conditionId ?? ""),
        question:       String(m.question ?? ""),
        description:    String(m.description ?? ""),
        category:       detectCategory(String(m.question ?? ""), tagLabels),
        endDate:        String(m.endDate ?? m.end_date ?? ""),
        volume:         parseFloat(String(m.volume ?? "0")) || 0,
        liquidity:      parseFloat(String(m.liquidity ?? "0")) || 0,
        yesPrice,
        noPrice:        Math.round((1 - yesPrice) * 1000) / 1000,
        primaryTokenId: tokens[0]?.token_id ?? null,
        active:         Boolean(m.active),
        closed:         Boolean(m.closed),
        sourceUrl:      `https://polymarket.com/market/${String(m.id ?? m.conditionId ?? "")}`,
      } satisfies PolyMarket;
    });
}

export async function fetchPolyPriceHistory(tokenId: string): Promise<{ t: number; p: number }[]> {
  try {
    const res = await fetch(
      `${CLOB}/prices-history?market=${tokenId}&interval=1h&fidelity=60`,
      { next: { revalidate: 300 } } as RequestInit
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.history ?? []).map((pt: { t: number; p: number }) => ({ t: pt.t, p: pt.p }));
  } catch {
    return [];
  }
}

// Legacy compatibility — still used in Signals / Entities pages
export function matchPolyToEntity(polyQuestion: string, entityName: string): number {
  const q = polyQuestion.toLowerCase();
  const e = entityName.toLowerCase().split(" ");
  const matches = e.filter(word => word.length > 3 && q.includes(word));
  return matches.length / Math.max(e.length, 1);
}
