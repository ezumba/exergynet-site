import { NextResponse } from "next/server";
import { xlmp_shatter_payload, xlmp_store_content } from "@/lib/xlmp_ds_core";

// Structural noise keys injected by AI Studio export format and similar tools.
// These add 0 retrieval value and bloat shard content, reducing retrieval precision.
const STRIP_KEYS = new Set(['runSettings', 'safetySettings', 'systemInstruction', 'config']);

function stripMetadata(obj: unknown): unknown {
  if (Array.isArray(obj)) return (obj as unknown[]).map(stripMetadata);
  if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (!STRIP_KEYS.has(k)) cleaned[k] = stripMetadata(v);
    }
    return cleaned;
  }
  return obj;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;
    if (!file) return NextResponse.json({ error: "Void payload" }, { status: 400 });

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const rawText = rawBuffer.toString("utf8");

    // Attempt metadata strip: only applies to JSON payloads containing noise keys
    let cleanText = rawText;
    let metadata_stripped = false;
    let stripped_keys: string[] = [];

    try {
      const parsed = JSON.parse(rawText);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const presentNoise = (Object.keys(parsed) as string[]).filter(k => STRIP_KEYS.has(k));
        if (presentNoise.length > 0) {
          const cleaned = stripMetadata(parsed);
          cleanText = JSON.stringify(cleaned, null, 2);
          metadata_stripped = true;
          stripped_keys = presentNoise;
        }
      }
    } catch {
      // Not JSON — plain text, pass through unchanged
    }

    const cleanBuffer = Buffer.from(cleanText, "utf8");
    const hollowObj = await xlmp_shatter_payload(cleanBuffer);
    xlmp_store_content(hollowObj.xlmp_root, cleanText);

    return NextResponse.json({
      success: true,
      hollow_object: hollowObj,
      ...(metadata_stripped ? { metadata_stripped: true, stripped_keys } : {}),
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
