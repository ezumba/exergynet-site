import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signals, entities, briefs, usageEvents } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { callVanguard } from "@/lib/vanguard";

export const dynamic = "force-dynamic";

export async function GET() {
  const anomalies = await db
    .select({
      entityId:   signals.entityId,
      entityName: entities.name,
      metric:     signals.metric,
      signalType: signals.signalType,
      value:      signals.value,
      t:          signals.t,
    })
    .from(signals)
    .leftJoin(entities, eq(signals.entityId, entities.id))
    .where(eq(signals.confidence, "HIGH"))
    .orderBy(desc(signals.t))
    .limit(20);

  if (anomalies.length === 0) {
    return NextResponse.json({ briefId: null, status: "no_data", narrative: "No HIGH-confidence anomalies detected." });
  }

  const [pending] = await db.insert(briefs)
    .values({ narrative: "Generating...", status: "pending" })
    .returning({ id: briefs.id });

  try {
    let worldContext = "";
    try {
      const ws = await fetch(`${process.env.ROUTER_URL || "http://localhost:8080"}/worldstate?persist=0`, { signal: AbortSignal.timeout(20000), cache: "no-store" });
      if (ws.ok) { const wd = await ws.json(); if (wd.brief) worldContext = "\n\nLIVE PLANETARY SIGNAL CONTEXT (from the MLE backplane \u2014 use it to inform why-it-matters and cross-domain signals):\n" + wd.brief; }
    } catch { /* context optional */ }
    const system = `You are an intelligence analyst for ExergyNet, a decentralized proof-of-work compute network.
Analyze these anomaly signals and return ONLY valid JSON with this exact structure:
{
  "narrative": "Three plain prose paragraphs summarizing what is happening, why it matters, and what to watch. NO markdown. NO asterisks. NO tables. NO bullet points. NO headers. Plain sentences only.",
  "topAnomalies": [
    {
      "entity": "entity name",
      "metric": "metric name",
      "signal": "SURGE|DROP|SPIKE|ANOMALY",
      "summary": "one sentence plain prose explanation",
      "zScore": 2.8,
      "direction": "up"
    }
  ],
  "topMovers": [
    { "entity": "name", "direction": "up", "magnitude": "+2.8 sigma" }
  ],
  "crossDomainSignals": [
    { "insight": "plain prose observation", "entities": ["name1", "name2"] }
  ]
}
Rules: zScore is a positive float (e.g. 2.8 means 2.8 standard deviations). direction is "up" or "down".
The narrative must be exactly three paragraphs separated by newlines. No markdown formatting anywhere.${worldContext}`;

    const vr = await callVanguard(system, JSON.stringify({ anomalies }), "vanguard-pro", false);
    const costUsdc = vr.promptTokens * (0.001 / 1000) + vr.completionTokens * (0.003 / 1000);

    await db.insert(usageEvents).values({
      operation: "daily_brief",
      promptTokens: vr.promptTokens,
      completionTokens: vr.completionTokens,
      costUsdc: costUsdc.toFixed(8),
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(vr.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    } catch {
      parsed = { narrative: vr.content, topAnomalies: [], topMovers: [], crossDomainSignals: [] };
    }

    await db.update(briefs).set({
      narrative:    String(parsed.narrative ?? vr.content),
      topAnomalies: (parsed.topAnomalies as object[])      ?? [],
      topMovers:    (parsed.topMovers as object[])          ?? [],
      crossDomain:  (parsed.crossDomainSignals as object[]) ?? [],
      costUsdc:     costUsdc.toFixed(8),
      status:       "complete",
    }).where(eq(briefs.id, pending.id));

    const [completed] = await db.select().from(briefs).where(eq(briefs.id, pending.id));
    return NextResponse.json({ ...completed, status: "complete" });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(briefs).set({ status: "error", narrative: msg }).where(eq(briefs.id, pending.id));
    return NextResponse.json({ briefId: pending.id, status: "error", narrative: msg }, { status: 500 });
  }
}
