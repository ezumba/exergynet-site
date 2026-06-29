import { NextRequest, NextResponse } from "next/server";

const PROXY = process.env.BIOLOGICAL_PROXY_URL || "http://localhost:5000";

function adminHeaders(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return { "Content-Type": "application/json", Authorization: auth };
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const r = await fetch(`${PROXY}/api/admin/blog/articles/${params.id}`, {
    method: "PUT",
    headers: adminHeaders(req),
    body: JSON.stringify(body),
  });
  const res = await r.json();
  return NextResponse.json(res, { status: r.status });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await fetch(`${PROXY}/api/admin/blog/articles/${params.id}`, {
    method: "DELETE",
    headers: adminHeaders(req),
  });
  const res = await r.json();
  return NextResponse.json(res, { status: r.status });
}
