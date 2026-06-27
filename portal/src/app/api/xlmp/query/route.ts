import { NextResponse } from "next/server";
import { xlmp_zk_query } from "@/lib/xlmp_ds_core";

export async function POST(req: Request) {
  try {
    let xlmp_root: string | undefined;
    let image_id: string | undefined;
    let query_params: { intent: string } | undefined;

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      xlmp_root  = (fd.get("xlmp_root")  ?? fd.get("xlmp_vector") ?? "") as string;
      image_id   = (fd.get("image_id")   ?? "") as string;
      const intent = (fd.get("intent") ?? fd.get("query") ?? "") as string;
      if (intent) query_params = { intent };
    } else {
      const body = await req.json().catch(() => ({}));
      xlmp_root  = body?.xlmp_root  ?? body?.xlmp_vector ?? "";
      image_id   = body?.image_id   ?? "";
      query_params = body?.query_params ?? (body?.intent ? { intent: body.intent } : undefined);
    }

    if (!xlmp_root) {
      return NextResponse.json(
        { error: 'Missing xlmp_root — send: { "xlmp_root": "...", "image_id": "...", "query_params": { "intent": "..." } }' },
        { status: 400 }
      );
    }
    if (!image_id) {
      return NextResponse.json(
        { error: 'Missing image_id — the Groth16 image ID is shown on your API Keys page under Vault: ZK Query' },
        { status: 400 }
      );
    }
    if (!query_params?.intent) {
      return NextResponse.json(
        { error: 'Missing query_params.intent — send: { "query_params": { "intent": "your question here" } }' },
        { status: 400 }
      );
    }

    // Strip optional 0x prefix from both fields
    const root = xlmp_root.replace(/^0x/, "");
    const imgId = image_id.replace(/^0x/, "");

    const result = await xlmp_zk_query(root, imgId, query_params);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "xLMP_Query failure";
    const isNotFound = msg.includes("not found");
    return NextResponse.json({ error: msg }, { status: isNotFound ? 404 : 500 });
  }
}
