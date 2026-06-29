import { NextRequest, NextResponse } from "next/server";

const PROXY = process.env.BIOLOGICAL_PROXY_URL || "http://localhost:5000";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const formData = await req.formData();

  // Re-stream multipart to biological_proxy
  const proxyForm = new FormData();
  for (const [key, value] of formData.entries()) {
    proxyForm.append(key, value);
  }

  const r = await fetch(`${PROXY}/api/admin/blog/upload-cover`, {
    method: "POST",
    headers: { Authorization: auth },
    body: proxyForm,
  });
  const res = await r.json();
  return NextResponse.json(res, { status: r.status });
}
