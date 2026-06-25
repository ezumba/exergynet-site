import { NextResponse } from "next/server";
import { validateUrl } from "@/lib/agent/security";
import { db } from "@/lib/db";
import { entities } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { triggerAgentCycle } from "@/lib/agent/watchlistAgent";

export async function GET() {
  const rows = await db.select().from(entities).where(eq(entities.active, "true"));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, symbol, type, entitySubtype, groundTruthUrl, agentSources, agentFrequency, tags, agentEnabled } = body;

  // Genesis anchor enforcement: persons require a ground truth URL (SEI C20)
  // SSRF protection
  if (groundTruthUrl) {
    const ssrf = validateUrl(groundTruthUrl);
    if (!ssrf.valid) return NextResponse.json({ error: 'Invalid ground truth URL: ' + ssrf.reason, field: 'groundTruthUrl' }, { status: 422 });
  }

  const requiresGroundTruth = entitySubtype === "person" || (!symbol && entitySubtype !== "standard");
  if (requiresGroundTruth && !groundTruthUrl) {
    return NextResponse.json({
      error: "Ground truth URL is required for persons and entities without a ticker symbol. This is the Genesis anchor.",
      field: "groundTruthUrl",
    }, { status: 422 });
  }

  const validTypes = ["equity", "crypto", "macro", "sensor"] as const;
  const safeType = validTypes.includes(type) ? type as typeof validTypes[number] : "equity";

  const [row] = await db.insert(entities).values({
    name,
    symbol: symbol || null,
    type: safeType,
    active: "true",
    entitySubtype: entitySubtype ?? "standard",
    groundTruthUrl: groundTruthUrl ?? null,
    agentSources: agentSources ?? ["market", "news", "github"],
    agentFrequency: agentFrequency ?? "15min",
    tags: tags ?? [],
    agentEnabled: agentEnabled !== false,
  }).returning();

  // Trigger initial agent cycle asynchronously — do not block response
  triggerAgentCycle(row.id).catch(err => console.error("[Agent] initial cycle failed:", err));

  return NextResponse.json(row, { status: 201 });
}
