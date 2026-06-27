import { NextResponse } from "next/server";
import { xlmp_zk_query } from "@/lib/xlmp_ds_core";

export async function POST(req: Request) {
  try {
    const { xlmp_root, image_id, query_params } = await req.json();
    if (!xlmp_root || !image_id)
      return NextResponse.json({ error: "Missing xLMP vector" }, { status: 400 });

    const zkResult = await xlmp_zk_query(xlmp_root, image_id, query_params);

    return NextResponse.json({ success: true, data: zkResult });
  } catch {
    return NextResponse.json({ error: "xLMP_Query failure" }, { status: 500 });
  }
}
