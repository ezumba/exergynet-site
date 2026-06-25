import { safeFetch } from './security';
import {
  runPatentSearchAdapter,
  runPatentAssignmentsAdapter,
  runTrademarkAdapter,
  runPEDSAdapter,
} from './usptoAdapters';
import {
  runUSASpendingAdapter,
  runCourtListenerAdapter,
  runHackerNewsAdapter,
  runWorldBankAdapter,
  runFREDAdapter,
  runOpenSanctionsAdapter,
  runSECFormFourAdapter,
  runACLEDAdapter,
  runGDELTAdapter,
  runEIAAdapter,
  runWaybackAdapter,
} from './publicAdapters';
// lib/agent/watchlistAgent.ts
import { db } from "@/lib/db";
import { entities, entityEvents, agentCostEvents } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

const PROXY_BASE  = process.env.VANGUARD_PROXY_BASE  ?? "http://localhost:3000";
const PROXY_EMAIL = process.env.VANGUARD_PROXY_EMAIL ?? "dt-admin@exergynet.dev";
const PROXY_PASS  = process.env.VANGUARD_PROXY_PASS  ?? "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const SERP_API_KEY = process.env.SERP_API_KEY ?? "";

let _proxyToken: string | null = null;
let _proxyTokenExpiry = 0;

async function getProxyToken(): Promise<string | null> {
  if (_proxyToken && Date.now() < _proxyTokenExpiry) return _proxyToken;
  try {
    const res = await fetch(`${PROXY_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: PROXY_EMAIL, password: PROXY_PASS }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    _proxyToken = data.token ?? null;
    _proxyTokenExpiry = Date.now() + 50 * 60 * 1000;
    return _proxyToken;
  } catch { return null; }
}

export async function triggerAgentCycle(entityId: string): Promise<string> {
  const cycleId = crypto.randomUUID();

  const [entity] = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
  if (!entity) throw new Error(`Entity ${entityId} not found`);

  const sources = (entity.agentSources as string[]) ?? ["market", "news"];
  let totalCost = 0;
  let totalSignals = 0;
  let totalEvents = 0;

  for (const source of sources) {
    const result = await runAdapter(source, entity, cycleId);
    totalCost    += result.cost;
    totalSignals += result.signals;
    totalEvents  += result.events;
  }

  if (entity.agentEnabled && totalEvents > 0) {
    const synth = await synthesizeProfile(entity);
    totalCost += synth.cost;
  }

  await db.execute(sql`
    UPDATE entities
    SET last_agent_run = NOW(),
        baseline_ready = (
          SELECT COUNT(*) >= 20 FROM entity_events WHERE entity_id = ${entityId}
        )
    WHERE id = ${entityId}
  `);

  return cycleId;
}

async function runAdapter(
  source: string,
  entity: any,
  cycleId: string
): Promise<{ cost: number; signals: number; events: number }> {
  const startMs = Date.now();
  let cost = 0, signals = 0, events = 0;

  try {
    switch (source) {
      case "market":
        ({ cost, signals, events } = await runMarketAdapter(entity));
        break;
      case "news":
        ({ cost, signals, events } = await runNewsAdapter(entity));
        break;
      case "github":
        ({ cost, signals, events } = await runGitHubAdapter(entity));
        break;
      case "mempool":
        ({ cost, signals, events } = await runMempoolAdapter(entity));
        break;
      case "patent_search":
        ({ cost, signals, events } = await runPatentSearchAdapter(entity));
        break;
      case "patent_assignments":
        ({ cost, signals, events } = await runPatentAssignmentsAdapter(entity));
        break;
      case "trademark":
        ({ cost, signals, events } = await runTrademarkAdapter(entity));
        break;
      case "peds":
        ({ cost, signals, events } = await runPEDSAdapter(entity));
        break;
      case "usaspending":
        ({ cost, signals, events } = await runUSASpendingAdapter(entity));
        break;
      case "courtlistener":
        ({ cost, signals, events } = await runCourtListenerAdapter(entity));
        break;
      case "hackernews":
        ({ cost, signals, events } = await runHackerNewsAdapter(entity));
        break;
      case "worldbank":
        ({ cost, signals, events } = await runWorldBankAdapter(entity));
        break;
      case "fred":
        ({ cost, signals, events } = await runFREDAdapter(entity));
        break;
      case "sec":
        ({ cost, signals, events } = await runSECFormFourAdapter(entity));
        break;
      case "acled":
        ({ cost, signals, events } = await runACLEDAdapter(entity));
        break;
      case "gdelt":
        ({ cost, signals, events } = await runGDELTAdapter(entity));
        break;
      case "eia":
        ({ cost, signals, events } = await runEIAAdapter(entity));
        break;
      case "wayback":
        ({ cost, signals, events } = await runWaybackAdapter(entity));
        break;
      case "opensanctions":
        ({ cost, signals, events } = await runOpenSanctionsAdapter(entity));
        break;
    }
  } catch (err) {
    console.error(`[Agent] adapter ${source} failed for ${entity.name}:`, err);
  }

  await db.insert(agentCostEvents).values({
    entityId:        entity.id,
    userKey:         "system",
    operation:       `${source}_poll`,
    source,
    costUsdc:        cost.toFixed(8),
    durationMs:      Date.now() - startMs,
    resultSignals:   signals,
    efficiencyRatio: cost > 0 ? String((signals / (cost * 1000)).toFixed(6)) : "0",
  });

  return { cost, signals, events };
}

async function runMarketAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  if (!entity.symbol) return { cost: 0, signals: 0, events: 0 };
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${entity.symbol}?interval=15m&range=1d`;
    const res = await safeFetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { cost: 0, signals: 0, events: 0 };
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (!price) return { cost: 0, signals: 0, events: 0 };
    await db.execute(sql`
      INSERT INTO series_points (entity_id, metric, t, value)
      VALUES (${entity.id}, 'price', NOW(), ${price})
      ON CONFLICT DO NOTHING
    `).catch(() => {});
    return { cost: 0, signals: 1, events: 1 };
  } catch { return { cost: 0, signals: 0, events: 0 }; }
}

async function runNewsAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  if (!SERP_API_KEY) {
    // Log as skipped — no API key
    return { cost: 0, signals: 0, events: 0 };
  }
  const COST = 0.001;
  try {
    const q = encodeURIComponent(`"${entity.name}" news`);
    const res = await safeFetch(`https://serpapi.com/search.json?q=${q}&tbm=nws&num=5&api_key=${SERP_API_KEY}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { cost: COST, signals: 0, events: 0 };
    const data = await res.json();
    const items = (data.news_results ?? []).slice(0, 5);
    let inserted = 0;
    for (const item of items) {
      try {
        await db.insert(entityEvents).values({
          entityId:   entity.id,
          eventType:  "news",
          severity:   "INFO",
          title:      (item.title ?? "").slice(0, 500),
          summary:    (item.snippet ?? "").slice(0, 1000),
          sourceUrl:  item.link ?? null,
          sourceName: item.source?.name ?? null,
          occurredAt: item.date ? new Date(item.date) : new Date(),
          confidence: "0.75",
          imageUrl:   item.thumbnail ?? null,
        });
        inserted++;
      } catch { /* dedup conflict */ }
    }
    return { cost: COST, signals: 0, events: inserted };
  } catch { return { cost: COST, signals: 0, events: 0 }; }
}

async function runGitHubAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "ExergyNet-Intel/1.0",
    };
    if (GITHUB_TOKEN) headers.Authorization = `token ${GITHUB_TOKEN}`;
    // Use ground truth domain as search qualifier if available
    let searchTerm = entity.name.split(" ")[0].toLowerCase();
    if (entity.groundTruthUrl) {
      try {
        const domain = new URL(entity.groundTruthUrl).hostname.replace(/^www\./, "");
        searchTerm = domain.split(".")[0];
      } catch {}
    }

    // For well-known entities with symbols, try org repos directly (more accurate than search)
    let repos: any[] = [];
    const orgName = entity.groundTruthUrl
      ? new URL(entity.groundTruthUrl).hostname.replace(/^www\./, "").split(".")[0]
      : null;

    if (orgName && entity.symbol) {
      const orgRes = await safeFetch(`https://api.github.com/orgs/${orgName}/repos?sort=updated&per_page=5`, { headers, signal: AbortSignal.timeout(5000) });
      if (orgRes.ok) {
        repos = (await orgRes.json()).slice(0, 5);
      }
    }

    // Fall back to search if org endpoint failed or no ground truth
    if (!repos.length) {
      const q = encodeURIComponent(searchTerm);
      const res = await safeFetch(`https://api.github.com/search/repositories?q=${q}&sort=updated&per_page=5`, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { cost: 0, signals: 0, events: 0 };
      repos = ((await res.json()).items ?? []).slice(0, 5);
    }
    let inserted = 0, highSignals = 0;
    for (const repo of repos) {
      // Skip 0-star repos and very low-quality matches
      if (repo.stargazers_count < 50) continue;
      try {
        const sev = repo.stargazers_count > 1000 ? "HIGH" : repo.stargazers_count > 100 ? "LOW" : "INFO";
        await db.insert(entityEvents).values({
          entityId:   entity.id,
          eventType:  "github",
          severity:   sev,
          title:      `GitHub: ${repo.full_name} — ${repo.stargazers_count} stars`,
          summary:    (repo.description ?? "").slice(0, 500),
          sourceUrl:  repo.html_url,
          sourceName: "GitHub",
          occurredAt: new Date(repo.updated_at),
          confidence: "0.6",
        });
        inserted++;
        if (sev === "HIGH") highSignals++;
      } catch { /* dedup */ }
    }
    return { cost: 0, signals: highSignals, events: inserted };
  } catch { return { cost: 0, signals: 0, events: 0 }; }
}

async function runMempoolAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  if (entity.type !== "crypto") return { cost: 0, signals: 0, events: 0 };
  return { cost: 0.0001, signals: 0, events: 0 };
}

async function synthesizeProfile(entity: any): Promise<{ cost: number }> {
  const token = await getProxyToken();
  if (!token) return { cost: 0 };

  const recentResult = await db.execute(sql`
    SELECT event_type, severity, title, summary, occurred_at
    FROM entity_events WHERE entity_id = ${entity.id}
    ORDER BY occurred_at DESC LIMIT 10
  `);
  if (!recentResult.rows.length) return { cost: 0 };

  try {
    const res = await fetch(`${PROXY_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: "vanguard-standard",
        stream: true,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: "Intelligence analyst. Summarize entity activity in 2-3 plain prose sentences. No markdown, no bullets. Return ONLY JSON: {\"summary\":\"string\",\"key_change\":\"string\",\"risk_level\":\"LOW\"|\"MEDIUM\"|\"HIGH\"}",
          },
          {
            role: "user",
            content: JSON.stringify({ entity: { name: entity.name, type: entity.type }, events: recentResult.rows }),
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { cost: 0 };

    const text = await res.text();
    let content = "";
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (d === "[DONE]") break;
      try { const c = JSON.parse(d)?.choices?.[0]?.delta?.content; if (c) content += c; } catch {}
    }

    const cost = content.length * 0.000001;
    try {
      const parsed = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      await db.execute(sql`
        UPDATE entities SET profile_data = ${JSON.stringify({ ...parsed, updated_at: new Date().toISOString() })}
        WHERE id = ${entity.id}
      `);
    } catch {}

    return { cost };
  } catch { return { cost: 0 }; }
}
