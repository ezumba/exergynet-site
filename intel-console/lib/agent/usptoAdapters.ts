// lib/agent/usptoAdapters.ts
// USPTO/Patent/Trademark adapters
// NOTE: Raw USPTO .gov domains are blocked from Azure cloud IPs.
// patent_search: uses SerpAPI Google Patents engine (SERP_API_KEY)
// patent_assignments: uses SEC EDGAR 8-K full-text search (free, no key)
// trademark: uses USPTO TSDR (needs TSDR_API_KEY from account.uspto.gov — free)
// peds: stub until USPTO API key obtained

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
    const result = await db.execute(sql`
      INSERT INTO entity_events
        (entity_id, event_type, severity, title, summary, source_url, source_name, occurred_at, confidence)
      VALUES
        (${entityId}, ${eventType}, ${severity}, ${title}, ${summary}, ${sourceUrl}, ${sourceName}, ${occurredAt}, ${confidence})
      ON CONFLICT DO NOTHING RETURNING id
    `);
    return ((result.rows ?? result) as any[]).length > 0;
  } catch { return false; }
}

// ─── 1. Patent Search — SerpAPI Google Patents engine ────────────────────────
// Activates when SERP_API_KEY is set (same key used for news adapter)
// Searches Google Patents by assignee name, returns recent filings

export async function runPatentSearchAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const serpKey = process.env.SERP_API_KEY;
  if (!serpKey) {
    console.log(`[USPTO PatentSearch] SKIPPED for ${entity.name}: add SERP_API_KEY to activate`);
    return { cost: 0, signals: 0, events: 0 };
  }

  const name = entity.name as string;
  const searchTerm = name.replace(/,? (Inc|Corp|Ltd|LLC|Co)\.?$/i, '').trim();

  try {
    const url = `https://serpapi.com/search.json?engine=google_patents&q=assignee%3A%22${encodeURIComponent(searchTerm)}%22&sort=new&num=5&api_key=${serpKey}`;
    const res = await safeFetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { cost: 0, signals: 0, events: 0 };

    const data: any = await res.json();
    const patents: any[] = data.organic_results ?? [];
    let written = 0;

    for (const p of patents.slice(0, 5)) {
      const title   = `Patent: ${p.title ?? 'Untitled'}`;
      const summary = (p.snippet ?? p.publication_date ?? '').slice(0, 300);
      const link    = p.pdf ?? p.link ?? `https://patents.google.com/?assignee=${encodeURIComponent(searchTerm)}&sort=new`;
      const date    = p.publication_date ? new Date(p.publication_date) : new Date();

      const ok = await writeEvent(entity.id, 'patent', 'INFO', title, summary, link, 'Google Patents', date, 0.88);
      if (ok) written++;
    }

    const cost = written > 0 ? 0.001 : 0; // SerpAPI costs per query
    return { cost, signals: written, events: written };
  } catch (err) {
    console.error('[USPTO PatentSearch] failed for', name, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}

// ─── 2. Patent Assignments — SEC EDGAR 8-K IP filings ────────────────────────
// SEC EDGAR full-text search is free, no key, accessible from any IP
// Searches 8-K filings containing IP transfer language for the entity

export async function runPatentAssignmentsAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const name = entity.name as string;
  if (!name) return { cost: 0, signals: 0, events: 0 };

  const searchTerm = name.replace(/,? (Inc|Corp|Ltd|LLC|Co)\.?$/i, '').trim();

  try {
    // EDGAR full-text search for IP assignment 8-K filings
    const q = `"${searchTerm}" "intellectual property" OR "patent assignment" OR "trademark assignment"`;
    const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&dateRange=custom&startdt=2025-01-01&forms=8-K&hits.hits.total.value=true&hits.hits._source.period_of_report=true&hits.hits.highlight=true&hits.hits._source.file_date=true&hits.hits._source.display_names=true`;

    const res = await safeFetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ExergyNet-Intel/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { cost: 0, signals: 0, events: 0 };

    const data: any = await res.json();
    const hits: any[] = data.hits?.hits ?? [];
    let written = 0;

    for (const h of hits.slice(0, 5)) {
      const src   = h._source ?? {};
      const title = `IP Filing: ${src.file_date ?? ''} 8-K — ${(src.display_names ?? []).join(', ')}`;
      const hl    = h.highlight?.['file_text'] ?? [];
      const summary = hl.slice(0, 2).join(' ').replace(/<[^>]+>/g, '').slice(0, 300);
      const refUrl  = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(searchTerm)}&type=8-K&dateb=&owner=include&count=40`;
      const date    = src.file_date ? new Date(src.file_date) : new Date();

      const ok = await writeEvent(entity.id, 'patent_assignment', 'MEDIUM', title, summary, refUrl, 'SEC EDGAR', date, 0.75);
      if (ok) written++;
    }

    return { cost: 0, signals: written, events: written };
  } catch (err) {
    console.error('[Patent Assignments/EDGAR] failed for', name, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}

// ─── 3. Trademark — USPTO TSDR API ───────────────────────────────────────────
// Requires TSDR_API_KEY (free — register at account.uspto.gov)
// Until key is set, falls back to EDGAR trademark-related filings

export async function runTrademarkAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const name = entity.name as string;
  if (!name) return { cost: 0, signals: 0, events: 0 };

  const tsdrKey = process.env.TSDR_API_KEY;
  const searchTerm = name.replace(/,? (Inc|Corp|Ltd|LLC|Co)\.?$/i, '').trim();

  if (tsdrKey) {
    // TSDR owner search with API key
    try {
      const url = `https://tsdrapi.uspto.gov/ts/cd/casestatus/ownerName/${encodeURIComponent(searchTerm)}/status.json`;
      const res = await safeFetch(url, {
        headers: { 'USPTO-API-KEY': tsdrKey, 'Accept': 'application/json', 'User-Agent': 'ExergyNet-Intel/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const cases: any[] = data.TrademarkStatusAndDocumentRetrieval ?? [];
        let written = 0;
        for (const tm of cases.slice(0, 5)) {
          const title   = `Trademark: ${tm.MarkVerbalElementText ?? tm.mark ?? name}`;
          const summary = `Status: ${tm.caseStatus ?? ''} | Class: ${tm.InternationalClassNumber ?? ''} | Serial: ${tm.ApplicationNumber ?? ''}`;
          const refUrl  = `https://tsdr.uspto.gov/#caseNumber=${tm.ApplicationNumber}&caseType=SERIAL_NO&searchType=statusSearch`;
          const date    = tm.FilingDate ? new Date(tm.FilingDate) : new Date();
          const ok = await writeEvent(entity.id, 'trademark', 'INFO', title, summary, refUrl, 'USPTO TSDR', date, 0.88);
          if (ok) written++;
        }
        return { cost: 0, signals: written, events: written };
      }
    } catch (err) {
      console.error('[TSDR] failed for', name, ':', err);
    }
  } else {
    console.log(`[USPTO Trademark] SKIPPED for ${name}: add TSDR_API_KEY from account.uspto.gov to activate`);
  }

  // Fallback: EDGAR trademark-related SEC filings
  try {
    const q = `"${searchTerm}" "trademark" OR "trade dress" OR "brand registration"`;
    const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&dateRange=custom&startdt=2025-01-01&forms=8-K&hits.hits._source.file_date=true&hits.hits._source.display_names=true`;
    const res = await safeFetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ExergyNet-Intel/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { cost: 0, signals: 0, events: 0 };
    const data: any = await res.json();
    const hits: any[] = data.hits?.hits ?? [];
    let written = 0;
    for (const h of hits.slice(0, 3)) {
      const src     = h._source ?? {};
      const title   = `Trademark Filing: ${(src.display_names ?? []).join(', ')} — ${src.file_date ?? ''}`;
      const hl      = h.highlight?.['file_text'] ?? [];
      const summary = hl.slice(0, 1).join(' ').replace(/<[^>]+>/g, '').slice(0, 200);
      const refUrl  = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&forms=8-K`;
      const date    = src.file_date ? new Date(src.file_date) : new Date();
      const ok = await writeEvent(entity.id, 'trademark', 'INFO', title, summary, refUrl, 'SEC EDGAR (TM)', date, 0.70);
      if (ok) written++;
    }
    return { cost: 0, signals: written, events: written };
  } catch { return { cost: 0, signals: 0, events: 0 }; }
}

// ─── 4. PEDS — Patent Examination Data ───────────────────────────────────────
// ped.uspto.gov is unreachable from cloud IPs.
// Falls back to EDGAR R&D disclosures as a proxy signal.

export async function runPEDSAdapter(entity: any): Promise<{ cost: number; signals: number; events: number }> {
  const name = entity.name as string;
  if (!name) return { cost: 0, signals: 0, events: 0 };

  const searchTerm = name.replace(/,? (Inc|Corp|Ltd|LLC|Co)\.?$/i, '').trim();
  console.log(`[PEDS] Using EDGAR R&D proxy for ${name} (ped.uspto.gov blocked from cloud IPs)`);

  try {
    // EDGAR full-text: 10-K/10-Q R&D and patent mentions
    const q = `"${searchTerm}" "research and development" "patent pending" OR "patent application"`;
    const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&dateRange=custom&startdt=2025-01-01&forms=10-K,10-Q&hits.hits._source.file_date=true&hits.hits._source.display_names=true&hits.hits._source.form_type=true`;

    const res = await safeFetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ExergyNet-Intel/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { cost: 0, signals: 0, events: 0 };

    const data: any = await res.json();
    const hits: any[] = data.hits?.hits ?? [];
    let written = 0;

    for (const h of hits.slice(0, 4)) {
      const src     = h._source ?? {};
      const form    = src.form_type ?? '10-K';
      const title   = `Patent R&D Disclosure: ${form} — ${(src.display_names ?? []).join(', ')}`;
      const hl      = h.highlight?.['file_text'] ?? [];
      const summary = hl.slice(0, 2).join(' ').replace(/<[^>]+>/g, '').slice(0, 300);
      const refUrl  = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&forms=10-K,10-Q`;
      const date    = src.file_date ? new Date(src.file_date) : new Date();

      const ok = await writeEvent(entity.id, 'patent_application', 'INFO', title, summary, refUrl, 'SEC EDGAR (R&D)', date, 0.72);
      if (ok) written++;
    }

    return { cost: 0, signals: written, events: written };
  } catch (err) {
    console.error('[PEDS/EDGAR] failed for', name, ':', err);
    return { cost: 0, signals: 0, events: 0 };
  }
}
