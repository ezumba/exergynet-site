import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { briefs } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const [brief] = await db.select().from(briefs).where(eq(briefs.id, params.id));
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(brief);
}
