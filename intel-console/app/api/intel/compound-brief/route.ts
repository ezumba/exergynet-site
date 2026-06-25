// app/api/intel/compound-brief/route.ts
// Multi-source compound intelligence brief
// Pulls: Intel DB signals (existing) + GitHub events + blockchain on-chain data
// Runs correlation engine → compound signals → Vanguard synthesis
// GET /api/intel/compound-brief

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signals, entities } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { fetchGitHubSignals } from "@/lib/intelligence/github";
import { fetchBlockchainSignals } from "@/lib/intelligence/blockchain";
import { SignalNormalizer, CorrelationEngine } from "@/lib/intelligence/correlation";
import type { NormalizedSignal } from "@/lib/intelligence/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const startMs = Date.now();

  // ── 1. Pull HIGH-confidence signals from Intel DB ──────────────────────────
  const normalizer = new SignalNormalizer();
  const dbSignals = await db
    .select({
      entityId:   signals.entityId,
      entityName: entities.name,
      metric:     signals.metric,
      signalType: signals.signalType,
      value:      signals.value,
      t:          signals.t,
      confidence: signals.confidence,
    })
    .from(signals)
    .leftJoin(entities, eq(signals.entityId, entities.id))
    .where(eq(signals.confidence, "HIGH"))
    .orderBy(desc(signals.t))
    .limit(30);

  const intelSignals: NormalizedSignal[] = dbSignals.map(row =>
    normalizer.fromDbSignal({
      entityId:   row.entityId,
      entityName: row.entityName,
      metric:     row.metric,
      signalType: row.signalType,
      value:      row.value ? parseFloat(String(row.value)) : null,
      t:          row.t instanceof Date ? row.t : new Date(row.t),
      confidence: row.confidence ?? "UNVERIFIED",
    })
  );

  // ── 2. Fetch external signals in parallel ──────────────────────────────────
  const [githubSignals, blockchainSignals] = await Promise.allSettled([
    fetchGitHubSignals(100),
    fetchBlockchainSignals(),
  ]);

  const allSignals: NormalizedSignal[] = [
    ...intelSignals,
    ...(githubSignals.status === "fulfilled" ? githubSignals.value : []),
    ...(blockchainSignals.status === "fulfilled" ? blockchainSignals.value : []),
  ];

  const sourceBreakdown = {
    intel_db:   intelSignals.length,
    github:     githubSignals.status === "fulfilled" ? githubSignals.value.length : 0,
    blockchain: blockchainSignals.status === "fulfilled" ? blockchainSignals.value.length : 0,
  };

  if (allSignals.length === 0) {
    return NextResponse.json({
      status: "no_data",
      message: "No signals available from any source.",
      sources: sourceBreakdown,
    });
  }

  // ── 3. Run correlation engine ──────────────────────────────────────────────
  const engine = new CorrelationEngine();
  const { compounds, syntheses } = await engine.process(allSignals);

  const elapsedMs = Date.now() - startMs;

  if (compounds.length === 0) {
    return NextResponse.json({
      status: "no_compounds",
      message: "Signals detected but no correlated compound patterns found.",
      sources: sourceBreakdown,
      totalSignals: allSignals.length,
      elapsedMs,
    });
  }

  // ── 4. Format response ─────────────────────────────────────────────────────
  const formattedCompounds = syntheses.map(s => ({
    id:                s.compound.id,
    name:              s.compound.name,
    confidence:        s.compound.confidence,
    severity:          s.compound.severity,
    description:       s.compound.description,
    narrative:         s.narrative,
    recommendedAction: s.compound.recommendedAction,
    costUsdc:          s.costUsdc,
    componentCount:    s.compound.components.length,
    sources:           Array.from(new Set(s.compound.components.map(c => c.source))),
    correlationCount:  s.compound.correlations.length,
    timestamp:         s.compound.timestamp,
    components: s.compound.components.map(c => ({
      source:     c.source,
      type:       c.type,
      confidence: c.confidence,
      severity:   c.severity,
      entities:   c.entities.slice(0, 4),
      sectors:    c.sectors,
    })),
  }));

  const totalCost = syntheses
    .reduce((sum, s) => sum + parseFloat(s.costUsdc), 0)
    .toFixed(8);

  return NextResponse.json({
    status:       "complete",
    generatedAt:  new Date().toISOString(),
    elapsedMs,
    sources:      sourceBreakdown,
    totalSignals: allSignals.length,
    totalCompounds: compounds.length,
    totalCostUsdc:  totalCost,
    compounds:    formattedCompounds,
  });
}
