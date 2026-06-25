// lib/ghost-witness/claimExtractor.ts
// Extracts verifiable claims from an agent conversation log.
// A "claim" is any assertion the agent makes that can be true or false.

export interface ConversationMessage {
  role:       "agent" | "user" | "system";
  content:    string;
  timestamp?: string;
}

export type ClaimType =
  | "factual"
  | "medical"
  | "financial"
  | "legal"
  | "statistical"
  | "temporal"
  | "identity"
  | "capability";

export interface ExtractedClaim {
  id:           string;
  text:         string;
  type:         ClaimType;
  confidence:   number;
  context:      string;
  messageIndex: number;
}

const CLAIM_PATTERNS: Record<ClaimType, RegExp[]> = {
  factual:     [/costs?\s+\$[\d,]+/, /price\s+is\s+\$[\d,]+/, /available\s+in\s+\d+/i],
  medical:     [/treats?\s+\w+/i, /cures?\s+\w+/i, /medication\s+for/i, /symptoms?\s+of/i],
  financial:   [/\$[\d,.]+/, /interest\s+rate/i, /apr\s+of/i, /balance\s+is/i, /returns?\s+\d+%/i],
  legal:       [/you\s+are\s+entitled/i, /legally\s+required/i, /compliant\s+with/i],
  statistical: [/\d+%\s+of/, /studies?\s+show/i, /research\s+indicates/i],
  temporal:    [/expires?\s+(on|in)/i, /available\s+until/i, /deadline\s+is/i, /ships?\s+in\s+\d+/i, /takes?\s+\d+.*days?/i],
  identity:    [/i\s+am\s+\w+/i, /my\s+name\s+is/i, /representing/i],
  capability:  [/i\s+can\s+help/i, /i\s+am\s+able/i, /i\s+will\s+\w+/i],
};

export function extractClaims(
  conversation: ConversationMessage[],
  options: { agentOnly?: boolean; stripPII?: boolean } = {}
): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const { agentOnly = true, stripPII = false } = options;

  conversation.forEach((message, index) => {
    if (agentOnly && message.role !== "agent") return;

    let content = message.content;
    if (stripPII) {
      content = content
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]")
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
        .replace(/\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+\b/g, "[NAME]");
    }

    const sentences = content.match(/[^.!?]+[.!?]+/g) ?? [content];

    sentences.forEach(sentence => {
      for (const [type, patterns] of Object.entries(CLAIM_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(sentence)) {
            const pos = content.indexOf(sentence);
            claims.push({
              id:           crypto.randomUUID(),
              text:         sentence.trim(),
              type:         type as ClaimType,
              confidence:   0.75,
              context:      content.slice(Math.max(0, pos - 100), pos + sentence.length + 100),
              messageIndex: index,
            });
            break;
          }
        }
      }
    });
  });

  return claims;
}
