import { NextRequest, NextResponse } from "next/server";

const PROXY = process.env.BIOLOGICAL_PROXY_URL || "http://localhost:5000";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search;
  const r = await fetch(`${PROXY}/api/blog/articles${qs}`, { cache: "no-store" });
  const body = await r.json();
  return NextResponse.json(body, { status: r.status, headers: CORS });
}
