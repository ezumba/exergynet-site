// lib/intelligence/correlation.ts
// SignalNormalizer + CorrelationScorer + CompoundSignalBuilder + CorrelationEngine
// Adapted from the SEI Group 3 architecture doc for Next.js / Intel Console

import type { NormalizedSignal, Correlation, CompoundSignal } from "./types";
import { callVanguard } from "@/lib/vanguard";

// ─── Causal pair scoring (heuristic, learned over time) ───────────────────────
const CAUSAL_PAIRS: Record<string, Record<string, number>> = {
  star_surge:        { contract_deployment: 0.9, exchange_deposit: 0.3 },
  deletion_cascade:  { exchange_deposit: 0.7, multisig_movement: 0.85 },
  release_burst:     { flash_loan: 0.6 },
  landfill_surge:    { industrial_surge: 0.8 },
  port_congestion:   { industrial_surge: 0.5 },
  exchange_deposit:  { gas_spike: 0.5 },
  gas_spike:         { exchange_deposit: 0.4 },
  // Intel DB signals ↔ external sources
  price_anomaly:     { exchange_deposit: 0.6, star_surge: 0.4 },
  volume_anomaly:    { exchange_deposit: 0.7, gas_spike: 0.5 },
};

// ─── Sector map ───────────────────────────────────────────────────────────────
const ENTITY_SECTOR_MAP: Record<string, string[]> = {
  bitcoin:    ["crypto", "bitcoin"],
  ethereum:   ["crypto", "defi"],
  coinbase:   ["crypto", "exchange"],
  binance:    ["crypto", "exchange"],
  kraken:     ["crypto", "exchange"],
  solana:     ["crypto", "depin"],
  uniswap:    ["crypto", "defi"],
  aave:       ["crypto", "defi"],
  pittsburgh: ["steel", "manufacturing"],
  houston:    ["energy", "oil"],
  detroit:    ["auto", "manufacturing"],
  shenzhen:   ["tech", "manufacturing"],
  "los angeles": ["shipping", "trade"],
  "long beach":  ["shipping", "trade"],
  shanghai:      ["shipping", "trade"],
  rotterdam:     ["shipping", "trade"],
  singapore:     ["shipping", "trade", "finance"],
};

// ─── Signal Normalizer ────────────────────────────────────────────────────────
export class SignalNormalizer {
  normalize(rawSignal: NormalizedSignal): NormalizedSignal {
    // Already normalized — ensure sectors/entities are populated
    const enriched = { ...rawSignal };
    if (enriched.sectors.length === 0) {
      enriched.sectors = this._inferSectors(enriched.entities, enriched.type);
    }
    return enriched;
  }

  // For signals coming from the Intel DB (signals table)
  fromDbSignal(dbRow: {
    entityId: string;
    entityName: string | null;
    metric: string;
    signalType: string;
    value: number | null;
    t: Date;
    confidence: string;
  }): NormalizedSignal {
    const entityName = (dbRow.entityName ?? dbRow.entityId).toLowerCase();
    const sectors = this._inferSectors([entityName], dbRow.metric);

    return {
      id: `intel_db_${dbRow.entityId}_${dbRow.metric}_${dbRow.t.getTime()}`,
      source: "intel_db",
      type: dbRow.metric.includes("volume") ? "volume_anomaly" : "price_anomaly",
      timestamp: dbRow.t.getTime(),
      confidence: dbRow.confidence === "HIGH" ? 0.85 : dbRow.confidence === "LOW" ? 0.55 : 0.40,
      severity: dbRow.confidence === "HIGH" ? "warning" : "info",
      entities: [entityName],
      locations: [],
      sectors,
      raw: {
        entityId: dbRow.entityId,
        entityName: dbRow.entityName,
        metric: dbRow.metric,
        signalType: dbRow.signalType,
        value: dbRow.value,
        confidence: dbRow.confidence,
      },
    };
  }

  private _inferSectors(entities: string[], type: string): string[] {
    const sectors = new Set<string>();
    for (const entity of entities) {
      const e = entity.toLowerCase();
      for (const [key, secs] of Object.entries(ENTITY_SECTOR_MAP)) {
        if (e.includes(key)) secs.forEach(s => sectors.add(s));
      }
    }
    if (type.includes("crypto") || type.includes("blockchain") || type.includes("gas")) sectors.add("crypto");
    if (type.includes("landfill")) sectors.add("waste");
    if (type.includes("maritime") || type.includes("port")) sectors.add("shipping");
    if (type.includes("satellite") || type.includes("industrial")) sectors.add("industrial");
    if (sectors.size === 0) sectors.add("macro");
    return Array.from(sectors);
  }
}

// ─── Correlation Scorer ───────────────────────────────────────────────────────
export class CorrelationScorer {
  private temporalWindowMs = 3_600_000; // 1 hour
  private minScore = 0.55;

  findCorrelations(signals: NormalizedSignal[]): Correlation[] {
    const correlations: Correlation[] = [];
    for (let i = 0; i < signals.length; i++) {
      for (let j = i + 1; j < signals.length; j++) {
        const a = signals[i];
        const b = signals[j];
        if (Math.abs(a.timestamp - b.timestamp) > this.temporalWindowMs) continue;
        const corr = this._scorePair(a, b);
        if (corr.score >= this.minScore) correlations.push(corr);
      }
    }
    return correlations.sort((a, b) => b.score - a.score);
  }

  private _scorePair(a: NormalizedSignal, b: NormalizedSignal): Correlation {
    const temporal = this._temporalScore(a, b);
    const spatial   = this._jaccardScore(a.locations, b.locations);
    const entity    = this._jaccardScore(a.entities,  b.entities);
    const sector    = this._jaccardScore(a.sectors,   b.sectors);
    const causal    = this._causalScore(a.type, b.type);

    const score = temporal * 0.25 + spatial * 0.20 + entity * 0.25 + sector * 0.15 + causal * 0.15;
    const relationship: Correlation["relationship"] = score > 0.75 ? "supports" : score < 0.3 ? "contradicts" : "independent";

    return {
      signalA: a, signalB: b, score,
      dimensions: { temporal, spatial, entity, sector, causal },
      relationship,
      explanation: this._explain(a, b, temporal, spatial, entity, sector, causal),
    };
  }

  private _temporalScore(a: NormalizedSignal, b: NormalizedSignal): number {
    return Math.max(0, 1 - Math.abs(a.timestamp - b.timestamp) / this.temporalWindowMs);
  }

  private _jaccardScore(arrA: string[], arrB: string[]): number {
    const setA = new Set(arrA.map(s => s.toLowerCase()));
    const setB = new Set(arrB.map(s => s.toLowerCase()));
    const intersection = Array.from(setA).filter(x => setB.has(x)).length;
    const union = new Set(Array.from(setA).concat(Array.from(setB))).size;
    return union > 0 ? intersection / union : 0;
  }

  private _causalScore(typeA: string, typeB: string): number {
    return Math.max(
      CAUSAL_PAIRS[typeA]?.[typeB] ?? 0,
      CAUSAL_PAIRS[typeB]?.[typeA] ?? 0,
    );
  }

  private _explain(a: NormalizedSignal, b: NormalizedSignal, t: number, s: number, e: number, sec: number, c: number): string {
    const parts: string[] = [];
    if (t > 0.8) parts.push("occurred within minutes");
    else if (t > 0.5) parts.push("same hour");
    const sharedEntities = a.entities.filter(x => b.entities.map(y => y.toLowerCase()).includes(x.toLowerCase()));
    if (sharedEntities.length > 0) parts.push(`shared entity: ${sharedEntities[0]}`);
    const sharedSectors = a.sectors.filter(x => b.sectors.includes(x));
    if (sharedSectors.length > 0) parts.push(`sector: ${sharedSectors[0]}`);
    if (c > 0.7) parts.push("historically predictive");
    return parts.join(", ") || "weak correlation";
  }
}

// ─── Compound Signal Builder ──────────────────────────────────────────────────
export class CompoundSignalBuilder {
  private scorer = new CorrelationScorer();
  private minCompoundScore = 0.65;
  private minComponents = 2;

  buildCompounds(signals: NormalizedSignal[]): CompoundSignal[] {
    const correlations = this.scorer.findCorrelations(signals);
    const groups = this._findConnectedGroups(correlations);
    const compounds: CompoundSignal[] = [];

    for (const group of groups) {
      if (group.length < this.minComponents) continue;
      const compound = this._synthesize(group, correlations);
      if (compound.confidence >= this.minCompoundScore) compounds.push(compound);
    }

    return compounds.sort((a, b) => b.confidence - a.confidence);
  }

  private _findConnectedGroups(correlations: Correlation[]): NormalizedSignal[][] {
    const adj = new Map<string, Set<string>>();
    const sigMap = new Map<string, NormalizedSignal>();

    for (const corr of correlations) {
      const aId = corr.signalA.id;
      const bId = corr.signalB.id;
      if (!adj.has(aId)) adj.set(aId, new Set());
      if (!adj.has(bId)) adj.set(bId, new Set());
      adj.get(aId)!.add(bId);
      adj.get(bId)!.add(aId);
      sigMap.set(aId, corr.signalA);
      sigMap.set(bId, corr.signalB);
    }

    const visited = new Set<string>();
    const groups: NormalizedSignal[][] = [];

    for (const [id] of adj) {
      if (visited.has(id)) continue;
      const group: NormalizedSignal[] = [];
      const queue = [id];
      visited.add(id);
      while (queue.length > 0) {
        const cur = queue.shift()!;
        const sig = sigMap.get(cur);
        if (sig) group.push(sig);
        for (const neighbor of adj.get(cur) ?? []) {
          if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
        }
      }
      groups.push(group);
    }
    return groups;
  }

  private _synthesize(components: NormalizedSignal[], allCorrelations: Correlation[]): CompoundSignal {
    const avgConf = components.reduce((s, c) => s + c.confidence, 0) / components.length;
    const relevantCorrs = allCorrelations.filter(c =>
      components.some(comp => comp.id === c.signalA.id || comp.id === c.signalB.id)
    );
    const boost = Math.min(relevantCorrs.length / components.length * 0.1, 0.15);
    const confidence = Math.min(avgConf + boost, 0.99);

    const severityOrder = { info: 0, warning: 1, critical: 2 } as const;
    const severity = components.reduce<"info" | "warning" | "critical">((max, c) =>
      severityOrder[c.severity] > severityOrder[max] ? c.severity : max, "info");

    const allSectors = components.flatMap(c => c.sectors);
    const sectorCounts = new Map<string, number>();
    for (const s of allSectors) sectorCounts.set(s, (sectorCounts.get(s) ?? 0) + 1);
    const dominantSector = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "macro";

    const types = [...new Set(components.map(c => c.type))];
    const name = this._nameLookup(dominantSector, types);

    const description = components.map(c => {
      if (c.source === "github") return `GitHub: ${c.type} on ${(c.raw as Record<string, unknown>).repo ?? c.entities[0]}`;
      if (c.source === "blockchain") return `On-chain: ${c.type} (${((c.raw as Record<string, unknown>).valueEth as number | undefined)?.toFixed(1) ?? "?"} ETH)`;
      if (c.source === "intel_db") return `Intel: ${c.type} on ${c.entities[0]}`;
      return `${c.source}: ${c.type}`;
    }).join(" · ");

    return {
      id: `compound_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name,
      description,
      confidence,
      severity,
      components,
      correlations: relevantCorrs,
      timestamp: Math.max(...components.map(c => c.timestamp)),
      recommendedAction: this._action(dominantSector, types, severity),
    };
  }

  private _nameLookup(sector: string, types: string[]): string {
    const key = [...types].sort().join(",");
    const lookup: Record<string, Record<string, string>> = {
      crypto: {
        "contract_deployment,star_surge": "Protocol Launch Imminent",
        "deletion_cascade,exchange_deposit": "Team Exit + Liquidity Event",
        "exchange_deposit,star_surge": "Whale Accumulation Signal",
        "exchange_deposit,gas_spike": "Large Exchange Flow + Network Stress",
        "gas_spike,price_anomaly": "Network Stress + Price Anomaly",
        "exchange_deposit,volume_anomaly": "On-chain Volume Surge",
      },
      steel: { "industrial_surge,landfill_surge": "Steel Production Acceleration" },
      shipping: { "industrial_surge,port_congestion": "Export Demand Surge" },
    };
    return lookup[sector]?.[key] ?? `${sector.charAt(0).toUpperCase() + sector.slice(1)}: Multi-Source Alert`;
  }

  private _action(sector: string, types: string[], severity: "info" | "warning" | "critical"): string {
    if (sector === "crypto" && types.includes("deletion_cascade")) {
      return "Monitor exchange order books for sell pressure. Verify team status via social channels.";
    }
    if (sector === "crypto" && types.includes("star_surge") && types.includes("contract_deployment")) {
      return "Research protocol fundamentals. Check for token launch or airdrop within 72h.";
    }
    if (sector === "crypto" && types.includes("exchange_deposit")) {
      return "Large ETH flow to exchange. Monitor for subsequent spot sell order.";
    }
    if (sector === "steel" && severity !== "info") {
      return "Consider long steel futures or XLE. Monitor construction permits for confirmation.";
    }
    if (sector === "shipping" && severity === "critical") {
      return "Long container shipping equities. Short retailers dependent on just-in-time inventory.";
    }
    return "Monitor for additional confirming signals before action.";
  }
}

// ─── Correlation Engine (Vanguard-integrated) ─────────────────────────────────
export class CorrelationEngine {
  private normalizer = new SignalNormalizer();
  private builder = new CompoundSignalBuilder();

  async process(signals: NormalizedSignal[]): Promise<{
    compounds: CompoundSignal[];
    syntheses: Array<{ compound: CompoundSignal; narrative: string; costUsdc: string }>;
  }> {
    const normalized = signals.map(s => this.normalizer.normalize(s));
    const compounds = this.builder.buildCompounds(normalized);

    const syntheses: Array<{ compound: CompoundSignal; narrative: string; costUsdc: string }> = [];

    // Only call Vanguard for compound signals with ≥2 different sources and confidence ≥ 0.7
    const worthy = compounds.filter(c => {
      const sources = new Set(c.components.map(s => s.source));
      return sources.size >= 2 && c.confidence >= 0.70;
    });

    for (const compound of worthy.slice(0, 5)) { // Max 5 Vanguard calls per run
      const systemPrompt = `You are a macro intelligence analyst for ExergyNet DePIN network.
Synthesize compound multi-source signals into actionable intelligence briefs.
Return ONLY valid JSON: {"narrative": "3-sentence brief", "confidence": 0.0-1.0, "action": "recommended action"}`;

      const userContent = formatCompoundPrompt(compound);

      try {
        const vr = await callVanguard(systemPrompt, userContent);
        const costUsdc = (vr.promptTokens * (0.001 / 1000) + vr.completionTokens * (0.003 / 1000)).toFixed(8);

        let parsed: { narrative?: string; confidence?: number; action?: string } = {};
        try {
          parsed = JSON.parse(vr.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
        } catch {
          parsed = { narrative: vr.content };
        }

        syntheses.push({
          compound,
          narrative: String(parsed.narrative ?? vr.content),
          costUsdc,
        });
      } catch {
        // Vanguard call failed — include compound without synthesis
        syntheses.push({ compound, narrative: compound.description, costUsdc: "0" });
      }
    }

    // Include remaining compounds without Vanguard synthesis
    for (const compound of compounds.filter(c => !worthy.includes(c))) {
      syntheses.push({ compound, narrative: compound.description, costUsdc: "0" });
    }

    return { compounds, syntheses };
  }
}

function formatCompoundPrompt(compound: CompoundSignal): string {
  const componentLines = compound.components.map(c =>
    `  - [${c.source.toUpperCase()}] ${c.type} | confidence: ${c.confidence.toFixed(2)} | entities: ${c.entities.slice(0, 3).join(", ")}`
  ).join("\n");

  const corrLines = compound.correlations.slice(0, 5).map(c =>
    `  - ${c.signalA.type} ↔ ${c.signalB.type} | score: ${c.score.toFixed(2)} | ${c.explanation}`
  ).join("\n");

  return `COMPOUND SIGNAL: ${compound.name}
CONFIDENCE: ${compound.confidence.toFixed(2)}
SEVERITY: ${compound.severity}

COMPONENTS (${compound.components.length} signals from ${new Set(compound.components.map(c => c.source)).size} sources):
${componentLines}

CORRELATIONS:
${corrLines}

RECOMMENDED ACTION: ${compound.recommendedAction}

TASK: Generate a 3-sentence intelligence brief.
Sentence 1: What happened (cite specific sources and entities).
Sentence 2: Why it matters (market implication).
Sentence 3: What to do (specific, actionable).`;
}
