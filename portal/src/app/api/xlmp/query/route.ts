import { NextResponse } from "next/server";
import { xlmp_zk_query } from "@/lib/xlmp_ds_core";

export async function POST(req: Request) {
  try {
    // Accept both JSON body and multipart form-data
    let xlmp_root: string | undefined;
    let intent: string | undefined;

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      xlmp_root = (fd.get("xlmp_root") ?? fd.get("xlmp_vector") ?? fd.get("root") ?? fd.get("vector") ?? "") as string;
      intent    = (fd.get("intent") ?? fd.get("query") ?? "") as string;
    } else {
      // Default: JSON body
      const body = await req.json().catch(() => ({}));
      xlmp_root = body?.xlmp_root ?? body?.xlmp_vector ?? body?.hollow_object?.xlmp_root ?? body?.root ?? body?.vector ?? "";
      intent    = body?.query_params?.intent ?? body?.intent ?? body?.query ?? "";
    }

    if (!xlmp_root) {
      return NextResponse.json({ error: "Missing xlmp_root — pass as { \"xlmp_root\": \"...\", \"query_params\": { \"intent\": \"...\" } }" }, { status: 400 });
    }
    if (!intent) {
      return NextResponse.json({ error: "Missing intent — pass as query_params.intent or intent" }, { status: 400 });
    }

    // Strip optional 0x prefix
    const root = xlmp_root.replace(/^0x/, "");

    const result = await xlmp_zk_query(root, intent);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "xLMP_Query failure";
    const isNotFound = msg.includes("not found");
    return NextResponse.json({ error: msg }, { status: isNotFound ? 404 : 500 });
  }
}
