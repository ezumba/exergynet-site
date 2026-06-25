import { safeFetch, validateUrl } from './security';

export interface EntityCandidate {
  label: string;
  description: string;
  url: string;
  wikidataId: string | null;
  entityType: 'person' | 'organization' | 'crypto' | 'event' | 'unknown';
  confidence: number;
  imageUrl: string | null;
}

export async function searchWikidata(query: string): Promise<EntityCandidate[]> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=5&format=json&origin=*`;
  try {
    const res = await safeFetch(url, { headers: { 'User-Agent': 'ExergyNet-Intel/1.0 (intel@exergynet.org)' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.search ?? []).slice(0, 3).map((r: any) => ({
      label:       r.label ?? query,
      description: r.description ?? '',
      url:         r.url ?? `https://www.wikidata.org/wiki/${r.id}`,
      wikidataId:  r.id ?? null,
      entityType:  inferEntityType(r.description ?? ''),
      confidence:  r.match?.type === 'label' ? 0.90 : 0.70,
      imageUrl:    null,
    }));
  } catch { return []; }
}

export async function verifyGroundTruthUrl(url: string, query: string): Promise<{ confidence: number; candidate: EntityCandidate | null }> {
  const v = validateUrl(url);
  if (!v.valid) return { confidence: 0, candidate: null };

  if (url.includes('wikipedia.org/wiki/')) {
    const title = url.split('/wiki/')[1];
    try {
      const res = await safeFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: { 'User-Agent': 'ExergyNet-Intel/1.0' }
      });
      if (!res.ok) return { confidence: 0.60, candidate: null };
      const s = await res.json();
      const conf = s.title?.toLowerCase().includes(query.toLowerCase().split(' ')[0]) ? 0.92 : 0.70;
      return { confidence: conf, candidate: {
        label: s.title ?? query, description: s.description ?? s.extract?.slice(0, 120) ?? '',
        url, wikidataId: s.wikibase_item ?? null, entityType: inferEntityType(s.description ?? ''),
        confidence: conf, imageUrl: s.thumbnail?.source ?? null,
      }};
    } catch { return { confidence: 0, candidate: null }; }
  }

  return { confidence: 0.60, candidate: { label: query, description: 'User-provided URL', url, wikidataId: null, entityType: 'unknown', confidence: 0.60, imageUrl: null }};
}

function inferEntityType(d: string): EntityCandidate['entityType'] {
  const dl = d.toLowerCase();
  if (/rapper|singer|actor|athlete|politician|ceo|founder|executive|director|author/.test(dl)) return 'person';
  if (/company|corporation|organization|firm|enterprise|startup/.test(dl)) return 'organization';
  if (/cryptocurrency|token|protocol|blockchain|defi/.test(dl)) return 'crypto';
  if (/war|conflict|election|crisis|event|summit/.test(dl)) return 'event';
  return 'unknown';
}
