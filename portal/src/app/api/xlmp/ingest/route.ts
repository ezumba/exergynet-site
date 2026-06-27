import { NextResponse } from "next/server";
import { xlmp_shatter_payload } from "@/lib/xlmp_ds_core";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;
    if (!file) return NextResponse.json({ error: "Void payload" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const hollowObj = await xlmp_shatter_payload(buffer);

    return NextResponse.json({ success: true, hollow_object: hollowObj });
  } catch {
    return NextResponse.json({ error: "xLMP_Compress failure" }, { status: 500 });
  }
}
