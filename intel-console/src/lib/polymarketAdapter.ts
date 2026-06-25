// src/lib/polymarketAdapter.ts
// Polymarket Gamma API — public, no auth required

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const CLOB_BASE  = "https://clob.polymarket.com";

export interface PolyMarket {
  id: string;
  question: string;
  description: string;
  endDate: string;
  volume: number;
  liquidity: number;
  outcomes: string[];
  outcomePrices: number[];
  active: boolean;
  closed: boolean;
  tags: string[];
}

export async function fetchPolyMarkets(params?: {
  tag?: string;
  keyword?: string;
  limit?: number;
}): Promise<PolyMarket[]> {
  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(params?.limit ?? 50));
  if (params?.tag) url.searchParams.set("tag", params.tag);

  const res = await fetch(url.toString(), {
    next: { revalidate: 300 },
  } as RequestInit);
  if (!res.ok) throw new Error(`Polymarket Gamma API error: ${res.status}`);
  const data = await res.json();

  return (data.markets ?? data ?? []).map((m: Record<string, unknown>) => ({
    id:            String(m.id ?? m.conditionId ?? ""),
    question:      String(m.question ?? ""),
    description:   String(m.description ?? ""),
    endDate:       String(m.endDate ?? m.end_date ?? ""),
    volume:        Number(m.volume ?? 0),
    liquidity:     Number(m.liquidity ?? 0),
    outcomes:      (m.outcomes as string[]) ?? ["Yes", "No"],
    outcomePrices: (m.outcomePrices as number[]) ?? [0.5, 0.5],
    active:        Boolean(m.active),
    closed:        Boolean(m.closed),
    tags:          (m.tags as string[]) ?? [],
  }));
}

export async function fetchPolyMarket(conditionId: string): Promise<PolyMarket | null> {
  const res = await fetch(`${GAMMA_BASE}/markets/${conditionId}`, {
    next: { revalidate: 60 },
  } as RequestInit);
  if (!res.ok) return null;
  const m = await res.json();
  return {
    id:            String(m.id ?? conditionId),
    question:      String(m.question ?? ""),
    description:   String(m.description ?? ""),
    endDate:       String(m.endDate ?? ""),
    volume:        Number(m.volume ?? 0),
    liquidity:     Number(m.liquidity ?? 0),
    outcomes:      (m.outcomes as string[]) ?? ["Yes", "No"],
    outcomePrices: (m.outcomePrices as number[]) ?? [0.5, 0.5],
    active:        Boolean(m.active),
    closed:        Boolean(m.closed),
    tags:          (m.tags as string[]) ?? [],
  };
}

export function matchPolyToEntity(polyQuestion: string, entityName: string): number {
  const q = polyQuestion.toLowerCase();
  const e = entityName.toLowerCase().split(" ");
  const matches = e.filter(word => word.length > 3 && q.includes(word));
  return matches.length / Math.max(e.length, 1);
}
