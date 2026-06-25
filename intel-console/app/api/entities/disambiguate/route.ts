import { NextRequest, NextResponse } from 'next/server';
import { searchWikidata, verifyGroundTruthUrl } from '@/lib/agent/disambiguate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q   = req.nextUrl.searchParams.get('q') ?? '';
  const url = req.nextUrl.searchParams.get('url') ?? '';
  if (!q && !url) return NextResponse.json({ error: 'q or url required' }, { status: 400 });

  if (url) {
    const result = await verifyGroundTruthUrl(url, q);
    return NextResponse.json({ candidates: result.candidate ? [result.candidate] : [], autoResolved: result.confidence >= 0.85 });
  }

  const candidates = await searchWikidata(q);
  return NextResponse.json({ candidates, autoResolved: false });
}
