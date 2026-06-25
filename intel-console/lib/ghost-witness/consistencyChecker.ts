// lib/ghost-witness/consistencyChecker.ts
// Calls Vanguard (via lib/vanguard.ts) to check logical consistency of claims.
// Uses callVanguard() — inherits biological_proxy auth, SSE parsing, token refresh.

import { callVanguard } from "@/lib/vanguard";
import type { ExtractedClaim, ConversationMessage } from "./claimExtractor";

export interface ConsistencyFlag {
  claimId:    string;
  claimText:  string;
  claimType:  string;
  issue:      string;
  severity:   "critical" | "high" | "low" | "info";
  confidence: number;
}

export interface ConsistencyResult {
  consistent:        boolean;
  flags:             ConsistencyFlag[];
  overallScore:      number;
  hallucinationRisk: number;
  vanguardCost:      number;
  reasoning:         string;
}

const SYSTEM_PROMPT = `You are an AI audit specialist performing logical consistency analysis on an AI agent conversation.

Your task: identify claims made by the agent that are:
1. Internally contradictory (the agent contradicts itself across the conversation)
2. Factually implausible (the claim defies common knowledge without evidence)
3. Logically inconsistent (the conclusion does not follow from the premises)
4. Potentially fabricated (specific numbers, studies, or facts that appear invented)

You are NOT checking real-world factual accuracy (that requires external data).
You ARE checking internal logical consistency and plausibility.

Return ONLY valid JSON. No markdown. No preamble. Schema:
{
  "consistent": boolean,
  "flags": [
    {
      "claim_id": string,
      "claim_text": string,
      "claim_type": string,
      "issue": string,
      "severity": "critical" | "high" | "low" | "info",
      "confidence": number
    }
  ],
  "overall_score": number,
  "hallucination_risk": number,
  "reasoning": string
}`;

export async function checkConsistency(
  claims: ExtractedClaim[],
  conversation: ConversationMessage[]
): Promise<ConsistencyResult> {
  const payload = {
    claims: claims.map(c => ({
      id:      c.id,
      text:    c.text,
      type:    c.type,
      context: c.context,
    })),
    conversation_summary: conversation
      .filter(m => m.role === "agent")
      .map(m => m.content)
      .join("\n\n")
      .slice(0, 3000),
  };

  const { content, promptTokens, completionTokens } = await callVanguard(
    SYSTEM_PROMPT,
    JSON.stringify(payload),
    "vanguard-pro",
    false,   // no UI formatting rules — we need raw JSON
    false,   // jsonMode — ignored when rawMode=true
    true     // rawMode: true — suppresses identity preamble, returns bare JSON
  );

  const cost = (promptTokens * 0.001 / 1000) + (completionTokens * 0.003 / 1000);

  let parsed: Record<string, unknown>;
  try {
    // Extract JSON block regardless of any preamble (e.g. "I am SEI Vanguard.")
    const stripped = content.replace(/```json|```/g, "");
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Vanguard returned unparseable response: ${content.slice(0, 300)} — ${String(e)}`);
  }

  // Normalise flag keys: spec uses snake_case from Vanguard, interface uses camelCase
  const rawFlags = (parsed.flags as Record<string, unknown>[] | undefined) ?? [];
  const flags: ConsistencyFlag[] = rawFlags.map(f => ({
    claimId:    String(f.claim_id   ?? f.claimId   ?? ""),
    claimText:  String(f.claim_text ?? f.claimText ?? ""),
    claimType:  String(f.claim_type ?? f.claimType ?? ""),
    issue:      String(f.issue ?? ""),
    severity:   (f.severity ?? "info") as ConsistencyFlag["severity"],
    confidence: Number(f.confidence ?? 0.5),
  }));

  return {
    consistent:        Boolean(parsed.consistent),
    flags,
    overallScore:      Number(parsed.overall_score      ?? 0.5),
    hallucinationRisk: Number(parsed.hallucination_risk ?? 0.5),
    vanguardCost:      cost,
    reasoning:         String(parsed.reasoning ?? ""),
  };
}
