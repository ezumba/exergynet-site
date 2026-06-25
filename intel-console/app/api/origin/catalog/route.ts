import { NextResponse } from "next/server";

// Proxy: browser -> /intel/api/origin/catalog -> MLE /catalog (curated indicator search).
const ROUTER_URL = process.env.ROUTER_URL || "http://localhost:8080";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  try {
    const r = await fetch(`${ROUTER_URL}/catalog?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(8000) });
    return NextResponse.json(await r.json());
  } catch (e: any) {
    return NextResponse.json([], { status: 200 });
  }
}
