import { NextRequest, NextResponse } from "next/server";

const PROXY = process.env.BIOLOGICAL_PROXY_URL || "http://localhost:5000";

function adminHeaders(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return { "Content-Type": "application/json", Authorization: auth };
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search;
  const r = await fetch(`${PROXY}/api/admin/blog/articles${qs}`, {
    headers: adminHeaders(req),
    cache: "no-store",
  });
  const body = await r.json();
  return NextResponse.json(body, { status: r.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const r = await fetch(`${PROXY}/api/admin/blog/articles`, {
    method: "POST",
    headers: adminHeaders(req),
    body: JSON.stringify(body),
  });
  const res = await r.json();
  return NextResponse.json(res, { status: r.status });
}
