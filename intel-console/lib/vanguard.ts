// lib/vanguard.ts
// Calls biological_proxy at localhost:3000. Handles SSE streaming response.
// biological_proxy streams even when stream:false is requested — parse SSE chunks.
// v1.2 — vanguard-pro default, UI component generation awareness injected.

let _token: string | null = null;
let _tokenExpiry = 0;

const PROXY_BASE  = process.env.VANGUARD_PROXY_BASE  ?? "http://localhost:3000";
const PROXY_EMAIL = process.env.VANGUARD_PROXY_EMAIL ?? "dt-admin@exergynet.dev";
const PROXY_PASS  = process.env.VANGUARD_PROXY_PASS  ?? "";
const VANGUARD_MODEL = "vanguard-pro";

// ── UI Rendering Awareness ────────────────────────────────────────────────────
// Appended to every system prompt so Vanguard automatically chooses the right
// presentation format when the data warrants it.
const UI_AWARENESS = '\n\nOUTPUT FORMAT RULES - ALWAYS APPLY:\n1. TABLES: When comparing 3+ items across 2+ attributes, output a markdown table. Never use prose for comparisons.\n2. METRIC CARDS: When reporting 3+ numeric KPIs, use a markdown table: | Metric | Value | Unit |\n3. BULLETS: Use bullet lists for steps, features, or enumerated facts. Max 1 nesting level.\n4. CODE BLOCKS: Always use fenced code blocks with a language tag.\n5. SECTION HEADERS: Use ## headers when the response has 3+ logical sections.\n6. SIGNAL REPORTS: Present intelligence signals as a table: | Entity | Signal | Confidence | Severity | Summary |\n7. NEVER mix prose and list items in the same paragraph.\n8. CHARTS: When presenting time-series or ranked data, describe it as a labeled table first.';

async function getToken(): Promise<string> {
  const now = Date.now();
  if (_token && now < _tokenExpiry) return _token;

  const res = await fetch(`${PROXY_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: PROXY_EMAIL, password: PROXY_PASS }),
  });

  if (!res.ok) throw new Error(`biological_proxy auth failed: ${res.status}`);
  const data = await res.json();
  if (!data.token) throw new Error("biological_proxy returned no token");

  _token = data.token;
  _tokenExpiry = now + 50 * 60 * 1000;
  return _token!;
}

// Parse SSE stream and concatenate all delta.content chunks
async function parseSSEStream(res: Response): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const text = await res.text();
  let content = "";
  let promptTokens = 0;
  let completionTokens = 0;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const jsonStr = trimmed.slice(5).trim();
    if (jsonStr === "[DONE]") break;
    try {
      const chunk = JSON.parse(jsonStr);
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) content += delta;
      if (chunk.usage) {
        promptTokens     = chunk.usage.prompt_tokens     ?? 0;
        completionTokens = chunk.usage.completion_tokens ?? 0;
      }
    } catch { /* skip malformed chunks */ }
  }

  if (promptTokens === 0) promptTokens = Math.ceil(content.length / 4);
  if (completionTokens === 0) completionTokens = Math.ceil(content.length / 4);

  return { content, promptTokens, completionTokens };
}

export async function callVanguard(
  systemPrompt: string,
  userContent: string,
  model = VANGUARD_MODEL,
  injectUiRules = true,
  jsonMode = false,
  rawMode = false
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const token = await getToken();
  const finalSystem = injectUiRules ? systemPrompt + UI_AWARENESS : systemPrompt;

  const res = await fetch(`${PROXY_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      ...(rawMode ? { raw_mode: true } : {}),
      ...(jsonMode && !rawMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: finalSystem },
        { role: "user",   content: userContent  },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => res.status.toString());
    throw new Error(`Vanguard error ${res.status}: ${txt.slice(0, 200)}`);
  }

  return parseSSEStream(res);
}
