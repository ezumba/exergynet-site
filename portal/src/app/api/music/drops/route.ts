import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const PROXY = process.env.VANGUARD_INTERNAL_URL ?? 'http://127.0.0.1:5000';

// ── GET /api/music/drops — public feed ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const genre = searchParams.get('genre') ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '24'), 60);

  try {
    const res = await fetch(
      `${PROXY}/api/music/drops?genre=${encodeURIComponent(genre)}&limit=${limit}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json({ drops: [] });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ drops: [] });
  }
}

// ── POST /api/music/drops — publish a drop (auth required) ──────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Sign in to publish' }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const title       = (form.get('title')       as string ?? '').trim().slice(0, 120);
    const artist      = (form.get('artist')       as string ?? session.user.name ?? 'Artist').slice(0, 80);
    const genre       = (form.get('genre')        as string ?? '').slice(0, 40);
    const description = (form.get('description')  as string ?? '').slice(0, 500);
    const audioFile   = form.get('audio') as File | null;
    const videoFile   = form.get('video') as File | null;
    const coverFile   = form.get('cover') as File | null;

    if (!title)     return NextResponse.json({ error: 'Title required' }, { status: 400 });
    if (!audioFile) return NextResponse.json({ error: 'Audio file required' }, { status: 400 });

    if (audioFile.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio must be under 30 MB' }, { status: 400 });
    }
    if (videoFile && videoFile.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: 'Video must be under 200 MB' }, { status: 400 });
    }

    // Forward multipart to biological_proxy for DB storage + CDN upload
    const upstream = new FormData();
    upstream.append('title',       title);
    upstream.append('artist',      artist);
    upstream.append('genre',       genre);
    upstream.append('description', description);
    upstream.append('email',       session.user.email);
    upstream.append('audio',       audioFile, audioFile.name);
    if (videoFile) upstream.append('video', videoFile, videoFile.name);
    if (coverFile) upstream.append('cover', coverFile, coverFile.name);

    const proxyRes = await fetch(`${PROXY}/api/music/drops`, {
      method: 'POST',
      body: upstream,
    });

    const data = await proxyRes.json();
    if (!proxyRes.ok) {
      return NextResponse.json({ error: data.error ?? 'Publish failed' }, { status: proxyRes.status });
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Publish failed' }, { status: 500 });
  }
}
