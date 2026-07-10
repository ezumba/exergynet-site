import { NextResponse } from "next/server";
import { API_SERVICES } from "@/lib/apiServicesManifest";

// Public, unauthenticated — this is documentation data, not a metered service.
// Fetched cross-origin by the static api-integration.html page (served via
// GitHub Pages on exergynet.org, a different origin than portal.exergynet.org),
// as well as imported directly by the dashboard keys page. See
// portal/src/lib/apiServicesManifest.ts for why this exists as a single source
// instead of being hand-duplicated in both places.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=300", // 5 min — balance freshness vs. load
};

export async function GET() {
  return NextResponse.json({ services: API_SERVICES }, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
