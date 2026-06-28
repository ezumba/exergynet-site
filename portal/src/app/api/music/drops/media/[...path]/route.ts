import { NextRequest, NextResponse } from 'next/server';

const PROXY = process.env.VANGUARD_INTERNAL_URL ?? 'http://127.0.0.1:5000';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const filePath = params.path.join('/');
  try {
    const upstream = await fetch(`${PROXY}/drops-media/${filePath}`, { cache: 'force-cache' });
    if (!upstream.ok) return new NextResponse(null, { status: 404 });

    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
