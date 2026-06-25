import { safeFetch } from './security';
import { callVanguard } from '@/lib/vanguard';
import { db } from '@/lib/db';
import { entities, entityEvents } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function buildInitialProfile(entityId: string): Promise<void> {
  const [entity] = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
  if (!entity) throw new Error(`Entity ${entityId} not found`);

  const subtype = (entity.entitySubtype as string) ?? 'standard';
  let rawData: Record<string, unknown> = {};
  let totalCost = 0;

  try {
    switch (subtype) {
      case 'person':  ({ data: rawData, cost: totalCost } = await crawlPerson(entity)); break;
      case 'company': ({ data: rawData, cost: totalCost } = await crawlOrganization(entity)); break;
      case 'crypto':  ({ data: rawData, cost: totalCost } = await crawlCrypto(entity)); break;
      case 'event':   ({ data: rawData, cost: totalCost } = await crawlEvent(entity)); break;
      default:        ({ data: rawData, cost: totalCost } = await crawlOrganization(entity)); break;
    }
  } catch (err) { console.error('[profileBuilder] crawl error:', err); }

  const profile = await synthesizeProfile(entity, rawData, subtype);
  totalCost += profile.cost;

  await db.execute(sql`
    UPDATE entities SET
      profile_data         = ${JSON.stringify({ ...profile.data, built_at: new Date().toISOString(), profile_status: 'draft' })}::jsonb,
      last_agent_run       = NOW(),
      disambiguation_score = ${(profile.data.disambiguation_confidence as number) ?? 0}
    WHERE id = ${entityId}
  `);

  await db.execute(sql`
    INSERT INTO agent_cost_events (entity_id, user_key, operation, source, cost_usdc, result_signals, status)
    VALUES (${entityId}, 'system', 'profile_build', 'multi_source', ${totalCost}, ${Object.keys(rawData).length}, 'completed')
  `);
}

async function crawlPerson(entity: any): Promise<{ data: Record<string, unknown>; cost: number }> {
  const data: Record<string, unknown> = {};
  let cost = 0;
  const gtUrl = entity.groundTruthUrl as string | null;

  if (gtUrl && gtUrl.includes('wikipedia.org')) {
    try {
      const title = decodeURIComponent((gtUrl.split('/wiki/')[1] ?? ''));
      const res = await safeFetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { 'User-Agent': 'ExergyNet-Intel/1.0' } }
      );
      if (res.ok) {
        const w = await res.json();
        data.wikipedia = {
          title: w.title, description: w.description,
          extract: (w.extract ?? '').slice(0, 600),
          imageUrl: w.thumbnail?.source ?? null,
          wikidataId: w.wikibase_item ?? null,
        };
      }
    } catch (e) { console.error('[profileBuilder] wikipedia error', e); }
  }

  const serpKey = process.env.SERP_API_KEY;
  if (serpKey && entity.name) {
    try {
      const q = encodeURIComponent('"' + entity.name + '" news');
      const res = await safeFetch(`https://serpapi.com/search.json?q=${q}&tbm=nws&num=5&api_key=${serpKey}`);
      if (res.ok) {
        const news = await res.json();
        const items = (news.news_results ?? []).slice(0, 5);
        data.recentNews = items.map((n: any) => ({
          title: n.title, source: n.source?.name, date: n.date, snippet: n.snippet, url: n.link,
        }));
        cost += 0.001;
        for (const item of items) {
          try {
            await db.execute(sql`
              INSERT INTO entity_events (entity_id, event_type, severity, title, summary, source_url, source_name, occurred_at, confidence)
              VALUES (${entity.id}, 'news', 'INFO', ${item.title ?? ''}, ${item.snippet ?? ''}, ${item.link ?? ''}, ${item.source ?? ''}, ${item.date ? new Date(item.date) : new Date()}, 0.75)
              ON CONFLICT DO NOTHING
            `);
          } catch {}
        }
      }
    } catch (e) { console.error('[profileBuilder] serp error', e); }
  }

  return { data, cost };
}

async function crawlOrganization(entity: any): Promise<{ data: Record<string, unknown>; cost: number }> {
  const data: Record<string, unknown> = {};
  let cost = 0;
  const gtUrl = entity.groundTruthUrl as string | null;

  if (gtUrl && gtUrl.includes('wikipedia.org')) {
    try {
      const title = decodeURIComponent((gtUrl.split('/wiki/')[1] ?? ''));
      const res = await safeFetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { 'User-Agent': 'ExergyNet-Intel/1.0' } }
      );
      if (res.ok) {
        const w = await res.json();
        data.wikipedia = { title: w.title, description: w.description, extract: (w.extract ?? '').slice(0, 500) };
      }
    } catch {}
  }

  if (gtUrl) {
    try {
      const domain = new URL(gtUrl).hostname.replace(/^www\./, '').split('.')[0];
      const ghHeaders: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ExergyNet-Intel/1.0' };
      if (process.env.GITHUB_TOKEN) ghHeaders['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      const res = await safeFetch(`https://api.github.com/orgs/${domain}/repos?sort=updated&per_page=5`, { headers: ghHeaders });
      if (res.ok) {
        const repos = await res.json();
        data.github = {
          orgName: domain,
          repos: repos.slice(0, 5).map((r: any) => ({ name: r.full_name, stars: r.stargazers_count, url: r.html_url, updated: r.updated_at })),
        };
      }
    } catch {}
  }

  const serpKey = process.env.SERP_API_KEY;
  if (serpKey && entity.name) {
    try {
      const q = encodeURIComponent('"' + entity.name + '" news');
      const res = await safeFetch(`https://serpapi.com/search.json?q=${q}&tbm=nws&num=5&api_key=${serpKey}`);
      if (res.ok) { const news = await res.json(); data.recentNews = (news.news_results ?? []).slice(0, 5); cost += 0.001; }
    } catch {}
  }

  return { data, cost };
}

async function crawlCrypto(entity: any): Promise<{ data: Record<string, unknown>; cost: number }> {
  const symbol = entity.symbol as string | null;
  if (!symbol) return { data: {}, cost: 0 };
  try {
    const coinId = symbol.toLowerCase().replace('-usd', '');
    const res = await safeFetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=true`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (res.ok) {
      const c = await res.json();
      return { data: { coingecko: { name: c.name, symbol: c.symbol, description: (c.description?.en ?? '').slice(0, 300), marketCap: c.market_data?.market_cap?.usd, currentPrice: c.market_data?.current_price?.usd, githubStars: c.developer_data?.stars } }, cost: 0 };
    }
  } catch {}
  return { data: {}, cost: 0 };
}

async function crawlEvent(entity: any): Promise<{ data: Record<string, unknown>; cost: number }> {
  const data: Record<string, unknown> = {};
  let cost = 0;
  const gtUrl = entity.groundTruthUrl as string | null;

  if (gtUrl && gtUrl.includes('wikipedia.org')) {
    try {
      const title = decodeURIComponent((gtUrl.split('/wiki/')[1] ?? ''));
      const res = await safeFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { 'User-Agent': 'ExergyNet-Intel/1.0' } });
      if (res.ok) { const w = await res.json(); data.wikipedia = { title: w.title, description: w.description, extract: (w.extract ?? '').slice(0, 600) }; }
    } catch {}
  }

  const serpKey = process.env.SERP_API_KEY;
  if (serpKey && entity.name) {
    try {
      const q = encodeURIComponent('"' + entity.name + '" latest news');
      const res = await safeFetch(`https://serpapi.com/search.json?q=${q}&tbm=nws&num=10&api_key=${serpKey}`);
      if (res.ok) { const news = await res.json(); data.recentNews = (news.news_results ?? []).slice(0, 10); cost += 0.001; }
    } catch {}
  }

  return { data, cost };
}

async function synthesizeProfile(
  entity: any,
  rawData: Record<string, unknown>,
  subtype: string
): Promise<{ data: Record<string, unknown>; cost: number }> {
  const wiki   = rawData.wikipedia as any;
  const github = rawData.github    as any;
  const gecko  = rawData.coingecko as any;
  const news   = (rawData.recentNews as any[]) ?? [];

  // Build base profile from raw crawl data
  const description = wiki?.extract?.slice(0, 300)
    ?? wiki?.description
    ?? gecko?.description?.slice(0, 300)
    ?? `${entity.name} is a watched ${subtype} entity. Agent is collecting baseline data.`;

  const keyFacts: Record<string, string[]> = {};
  if (wiki?.description) keyFacts['Overview'] = [wiki.description];
  if (entity.symbol)     keyFacts['Market']   = [`Symbol: ${entity.symbol}`, `Type: ${entity.type}`];
  if (github?.repos?.length) {
    keyFacts['GitHub'] = github.repos.slice(0, 4).map((r: any) => `${r.name} (${r.stars} ⭐)`);
  }
  if (gecko) {
    keyFacts['Market Data'] = [
      gecko.currentPrice ? `Price: $${gecko.currentPrice.toLocaleString()}` : '',
      gecko.marketCap    ? `Market cap: $${(gecko.marketCap / 1e9).toFixed(2)}B` : '',
    ].filter(Boolean);
  }
  if (news.length) {
    keyFacts['Recent News'] = news.slice(0, 3).map((n: any) => n.title ?? '').filter(Boolean);
  }

  const sourcesUsed: string[] = [];
  if (wiki)        sourcesUsed.push('Wikipedia');
  if (github)      sourcesUsed.push('GitHub');
  if (gecko)       sourcesUsed.push('CoinGecko');
  if (news.length) sourcesUsed.push('News');

  const recentSummary = news.length > 0
    ? `Recent coverage includes: ${news.slice(0, 2).map((n: any) => n.title).join('; ')}.`
    : `No recent news collected yet. Agent is building baseline data for ${entity.name}.`;

  const baseProfile: Record<string, unknown> = {
    display_name:             entity.name,
    description,
    entity_type:              subtype,
    key_facts:                keyFacts,
    recent_activity_summary:  recentSummary,
    risk_level:               'LOW',
    disambiguation_confidence: entity.disambiguationScore ? parseFloat(entity.disambiguationScore as string) : 0.5,
    profile_status:           'draft',
    sources_used:             sourcesUsed,
  };

  // Enrich with Vanguard synthesis via raw_mode (skips SEI identity preamble)
  try {
    const personPrompt = 'Intelligence analyst mode. Output ONLY valid JSON. No markdown. Schema: {"display_name":string,"description":string,"entity_type":"person","key_facts":{"Identity":["nationality","birthplace"],"Career":["primary role","known for"],"Recent activity":["latest news"]},"recent_activity_summary":string,"risk_level":"LOW","disambiguation_confidence":0.9,"profile_status":"draft","sources_used":["Wikipedia"]}';
  const orgPrompt   = 'Intelligence analyst mode. Output ONLY valid JSON. No markdown. Schema: {"display_name":string,"description":string,"entity_type":"organization","key_facts":{"Overview":["industry","founded"],"Market":["ticker","valuation"],"Recent activity":["latest development"]},"recent_activity_summary":string,"risk_level":"LOW","disambiguation_confidence":0.85,"profile_status":"draft","sources_used":["Wikipedia"]}';
  const systemPrompt = subtype === "person" ? personPrompt : orgPrompt;
    const userContent = JSON.stringify({ entity: { name: entity.name, subtype }, rawData });
    // rawMode=true bypasses the SEI identity system prompt so the model follows our schema
    const vr = await callVanguard(systemPrompt, userContent, 'vanguard-standard', false, false, true);
    const jStart = vr.content.indexOf('{');
    const jEnd   = vr.content.lastIndexOf('}');
    if (jStart >= 0 && jEnd > jStart) {
      const parsed = JSON.parse(vr.content.slice(jStart, jEnd + 1));
      // Merge: Vanguard fills description/summary; keep our structured key_facts if Vanguard omits
      const cost = vr.promptTokens * (0.001 / 1000) + vr.completionTokens * (0.003 / 1000);
      return {
        data: {
          ...baseProfile,
          ...parsed,
          // Only override non-empty string fields from Vanguard
          description:             parsed.description             || baseProfile.description,
          recent_activity_summary: parsed.recent_activity_summary || baseProfile.recent_activity_summary,
          key_facts:               (parsed.key_facts && Object.keys(parsed.key_facts).length > 0) ? parsed.key_facts : baseProfile.key_facts,
          sources_used:            parsed.sources_used ?? sourcesUsed,
          profile_status: 'draft',
        },
        cost,
      };
    }
  } catch (err) {
    console.error('[profileBuilder] Vanguard enrichment error:', err);
  }

  // Fallback: return base profile built from raw data
  return { data: baseProfile, cost: 0 };
}
