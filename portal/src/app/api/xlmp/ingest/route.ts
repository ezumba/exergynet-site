import { NextResponse } from "next/server";
import { xlmp_shatter_payload, xlmp_store_content } from "@/lib/xlmp_ds_core";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;
    if (!file) return NextResponse.json({ error: "Void payload" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const hollowObj = await xlmp_shatter_payload(buffer);

    // Store raw content so query can resolve intents against it
    xlmp_store_content(hollowObj.xlmp_root, buffer.toString("utf8"));

    return NextResponse.json({
      success: true,
      hollow_object: hollowObj,
      next_step: {
        endpoint: '/api/xlmp/query',
        required_fields: ['xlmp_root', 'image_id', 'query_params.intent'],
        image_id_source: 'API Keys → Vault: ZK Query',
        note: 'image_id is a fixed Groth16 verifier ID — find it on your API Keys page, not in this response.',
      },
    });
  } catch {
    return NextResponse.json({ error: "xLMP_Compress failure" }, { status: 500 });
  }
}
