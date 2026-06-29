import { NextRequest, NextResponse } from "next/server";

const PROXY = process.env.BIOLOGICAL_PROXY_URL || "http://localhost:5000";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const r = await fetch(`${PROXY}/api/blog/articles/${params.slug}`, { cache: "no-store" });
  const body = await r.json();
  return NextResponse.json(body, { status: r.status });
}
