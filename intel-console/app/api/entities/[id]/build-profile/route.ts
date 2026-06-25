import { NextRequest, NextResponse } from "next/server";
import { buildInitialProfile } from "@/lib/agent/profileBuilder";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  buildInitialProfile(params.id).catch(err => console.error("Profile build failed for", params.id, err));
  return NextResponse.json({ status: "building", entityId: params.id, message: "Profile build started. Check back in 30-60 seconds." });
}
