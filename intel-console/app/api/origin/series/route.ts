import { NextResponse } from "next/server";

// Server-side proxy: browser -> /intel/api/origin/series -> MLE router /series.
// Keeps keys server-side, sidesteps CORS, returns the uniform Origin series contract.
const ROUTER_URL = process.env.ROUTER_URL || "http://localhost:8080";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source    = searchParams.get("source")    ?? "";
  const indicator = searchParams.get("indicator") ?? "";
  const geo       = searchParams.get("geo")       ?? "";
  const window    = searchParams.get("window")    ?? "";
  if (!source || !indicator) {
    return NextResponse.json(
      { status: "unavailable", val: null, series: [], error: "source and indicator required" },
      { status: 400 },
    );
  }
  const qs = new URLSearchParams({ source, indicator, geo, window }).toString();
  try {
    const r = await fetch(`${ROUTER_URL}/series?${qs}`, { signal: AbortSignal.timeout(20000) });
    const body = await r.json();
    return NextResponse.json(body);
  } catch (e: any) {
    return NextResponse.json(
      { status: "unavailable", source, indicator, val: null, series: [], error: String(e?.message || e).slice(0, 200) },
    );
  }
}
