// lib/intelligence/types.ts
// Shared types across all intelligence pipelines

export interface NormalizedSignal {
  id: string;
  source: "github" | "blockchain" | "landfill" | "maritime" | "satellite" | "intel_db";
  type: string;
  timestamp: number;
  confidence: number;
  severity: "info" | "warning" | "critical";

  // Correlation dimensions
  entities: string[];   // ['bitcoin', 'coinbase', 'satoshi']
  locations: string[];  // ['pittsburgh', 'pa', 'usa']
  sectors: string[];    // ['crypto', 'steel', 'shipping']

  // Raw payload for Vanguard synthesis
  raw: Record<string, unknown>;
}

export interface Correlation {
  signalA: NormalizedSignal;
  signalB: NormalizedSignal;
  score: number;
  dimensions: {
    temporal: number;
    spatial: number;
    entity: number;
    sector: number;
    causal: number;
  };
  relationship: "supports" | "contradicts" | "independent";
  explanation: string;
}

export interface CompoundSignal {
  id: string;
  name: string;
  description: string;
  confidence: number;
  severity: "info" | "warning" | "critical";
  components: NormalizedSignal[];
  correlations: Correlation[];
  timestamp: number;
  recommendedAction: string;
}
