import { NextResponse } from "next/server";

// Proxy: Origin -> /intel/api/origin/forecast -> MLE /forecast (statistical model on a series).
const ROUTER_URL = process.env.ROUTER_URL || "http://localhost:8080";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const r = await fetch(`${ROUTER_URL}/forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(15000),
    });
    return NextResponse.json(await r.json());
  } catch (e: any) {
    return NextResponse.json({ model: "unavailable", forecast: [], anomalies: [], error: String(e?.message || e).slice(0, 200) });
  }
}
