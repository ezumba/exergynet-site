// ── Canonical API services manifest ──────────────────────────────────────────
// Single source of truth for every documented ExergyNet API service. Both the
// dashboard keys page (portal/src/app/dashboard/keys/page.tsx) and the public
// static docs page (api-integration.html, served via GitHub Pages — a
// completely separate deploy pipeline with no build step) read from this same
// data instead of each carrying their own hand-copied version.
//
// Why this exists: on 2026-07-10 the same wrong WebSocket URL was duplicated
// hardcoded in both places, and fixing it required editing both files by hand
// with no way to know they'd drifted apart until an external integration
// partner hit the bug in production. Adding a new service, or fixing a wrong
// one, should only ever require editing this file.
//
// Exposed publicly (no auth) at GET /api/docs/services — see
// portal/src/app/api/docs/services/route.ts — so the static HTML page can
// fetch it client-side across origins.

export interface ApiService {
  id: string;
  /** Drives the method badge on rendered docs — not a real HTTP verb for MCP/WS. */
  method: 'POST' | 'GET' | 'WS' | 'MCP';
  label: string;
  sub: string;
  /** Longer-form prose description, shown on the public docs page. */
  desc: string;
  endpoint: string;
  routing: string;
  headers: string;
  curl: string;
  ts: string;
  py: string;

  // ── Runtime capability model (added 2026-08-10) ───────────────────────────
  // Added following the Vanguard mode-routing incident (general Deep Research
  // traffic silently entering a clinical prompt/output contract meant for one
  // integration partner — see VANGUARD_MODE_ROUTING_RECON.md). The root cause
  // was exactly this: model identity, behavioral policy, output serialization,
  // and live health were never distinguished, so a single keyword match could
  // change all four at once. These fields keep them separate on purpose —
  // populate only what's actually true and verified; leave a field undefined
  // rather than guess.

  /** Model/engine identity only — must never itself imply a runtime policy or
   * an authorized application. Omit for non-model-backed services (Vault,
   * AERIS, MCP, TTS/STT, capital-queue endpoints, etc). */
  model?: string;

  /** Which behavioral/prompt policy governs inference, independent of model
   * identity. Only ever set to a profile that is genuinely implemented and
   * reachable today — do not list an aspirational profile here even if it's
   * on a roadmap. */
  runtimeProfile?: 'general' | 'clinical' | 'research' | 'physics' | 'code';

  /** Response serialization contract(s) this service actually supports.
   * Independent of runtimeProfile: a clinical runtime does not imply JSON
   * output, and JSON output does not imply a clinical runtime. */
  responseFormats?: Array<'text' | 'json_object' | 'json_schema' | 'audio' | 'binary' | 'sse'>;

  /** Who can reach this today. 'public' = any authenticated API key.
   * 'capability_gated' = intended to require a specific authorization this
   * platform does not yet enforce at the key/account level — if a field
   * would be 'capability_gated', do not also publish it as a documented
   * public service; keep it out of API_SERVICES and note it in a code
   * comment instead (see the clinical_runtime note below this array). */
  access?: 'public' | 'capability_gated' | 'internal';

  /** Publication maturity — should external developers be building on this
   * at all yet. Independent of operationalStatus below (a 'public' service
   * can still be temporarily 'degraded'; that doesn't make it less public). */
  publicationStatus?: 'public' | 'beta' | 'internal';

  /** Current live health, set only from direct verification (a live test,
   * pm2/log inspection, or a tracked-and-confirmed blocker) — never from
   * assumption. Leave undefined rather than assert 'healthy' without having
   * actually checked in the current session. */
  operationalStatus?: 'healthy' | 'degraded' | 'fallback_active' | 'unavailable' | 'unknown';

  /** One-line, public-safe explanation shown alongside a non-healthy
   * operationalStatus. Must never contain an IP, hostname, credential, or
   * internal blocker ID — those belong in this file's code comments (like
   * this one), never in a field served by GET /api/docs/services. */
  statusNote?: string;
}

const VAULT_URL = 'https://portal.exergynet.org';
const API = 'https://explorer-api.exergynet.org';

export const API_SERVICES: ApiService[] = [
  {
    id: 'vault-ingest',
    method: 'POST',
    label: 'Vault: Ingest',
    sub: 'X-LMP Protocol · ordered-aggregate shard upload · Hollow Object generation',
    desc: 'X-LMP Protocol — multipart file upload. Shatters the payload into SHA-256 shards and returns a xlmp_root handle (a "Hollow Object") to store and query against later — the root is a SHA-256 hash over the ordered concatenation of shard digests, not a Merkle tree. Raw data never leaves this call again — only the root hash is referenced afterward.',
    endpoint: `${VAULT_URL}/api/xlmp/ingest`,
    routing: 'Next.js Edge · portal.exergynet.org → xlmp_ds_core.ts shard engine',
    headers: `Authorization: Bearer <key>\nContent-Type: multipart/form-data`,
    curl: `curl -X POST https://portal.exergynet.org/api/xlmp/ingest \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -F "file=@./my_dataset.json"

# Response:
# {
#   "xlmp_root": "0xabc123...",
#   "shard_count": 4,
#   "total_bytes": 2048000,
#   "created_at": "2026-06-27T12:00:00Z"
# }`,
    ts: `const form = new FormData();
form.append('file', fileBlob, 'dataset.json');

const res = await fetch('https://portal.exergynet.org/api/xlmp/ingest', {
  method: 'POST',
  headers: { 'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\` },
  body: form,
});
const { xlmp_root, shard_count, total_bytes } = await res.json();
// Store xlmp_root — it's your Hollow Object handle`,
    py: `import requests

with open("dataset.json", "rb") as f:
    resp = requests.post(
        "https://portal.exergynet.org/api/xlmp/ingest",
        headers={"Authorization": f"Bearer {API_KEY}"},
        files={"file": ("dataset.json", f, "application/json")},
    )
data = resp.json()
xlmp_root = data["xlmp_root"]  # store this handle`,
  },
  {
    id: 'vault-query',
    method: 'POST',
    label: 'Vault: ZK Query',
    sub: 'X-LMP Protocol · Groth16 sealed execution · Query-In-Place · requires a xlmp_root from Vault: Ingest first',
    desc: 'Query-in-place against a xlmp_root without ever decrypting the underlying shards client-side. Returns a ZK journal: extracted result, confidence score, and citations. The xlmp_root must come from a prior Vault: Ingest response — a self-computed hash will fail with "Hollow Object not found."',
    endpoint: `${VAULT_URL}/api/xlmp/query`,
    routing: 'Next.js Edge · portal.exergynet.org → Groth16 verifier (simulated)',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `curl -X POST https://portal.exergynet.org/api/xlmp/query \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "xlmp_root": "0xabc123...",
    "image_id": "0xb226f60a6a3406e5cd3792b4bbe86ed996e2e2cc8dd31ddbe7989a20a897092d",
    "query_params": { "intent": "What is the average blood pressure?" }
  }'

# xlmp_root MUST come from a prior /api/xlmp/ingest response — it is not a
# hash you compute yourself. A self-computed root returns:
# { "error": "Hollow Object not found for root: <hash>" }
#
# Response:
# {
#   "query_id": "qry_...",
#   "proof_size_bytes": 256,
#   "latency_ms": 1500,
#   "journal": { "result": "142/91 mmHg", "confidence": 0.94, "citations": [...] }
# }`,
    ts: `const res = await fetch('https://portal.exergynet.org/api/xlmp/query', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    xlmp_root: '0xabc123...', // from a prior /api/xlmp/ingest response, not self-computed
    image_id: '0xb226f60a6a3406e5cd3792b4bbe86ed996e2e2cc8dd31ddbe7989a20a897092d',
    query_params: { intent: 'What is the average blood pressure?' },
  }),
});
const { journal, latency_ms } = await res.json();
// journal.result — ZK-sealed answer
// journal.confidence — extraction confidence [0–1]`,
    py: `import requests

resp = requests.post(
    "https://portal.exergynet.org/api/xlmp/query",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "xlmp_root": "0xabc123...",  # from a prior /api/xlmp/ingest response
        "image_id": "0xb226f60a6a3406e5cd3792b4bbe86ed996e2e2cc8dd31ddbe7989a20a897092d",
        "query_params": {"intent": "What is the average blood pressure?"},
    },
)
journal = resp.json()["journal"]
print(journal["result"])  # ZK-sealed answer`,
  },
  {
    id: 'standard',
    method: 'POST',
    label: 'Vanguard Standard',
    sub: 'Fast completions · Sovereign Inference Engine · Node 4',
    desc: 'OpenAI-compatible chat completions, fast and streaming. Point any OpenAI SDK at this base URL with model: "vanguard-standard" — the quickest of the three Vanguard tiers.',
    endpoint: `${API}/v1/chat/completions`,
    routing: 'Primary Proposer engine',
    model: 'vanguard-standard',
    runtimeProfile: 'general',
    responseFormats: ['text', 'json_object'],
    access: 'public',
    publicationStatus: 'public',
    operationalStatus: 'healthy',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `curl ${API}/v1/chat/completions \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "vanguard-standard",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'`,
    ts: `const res = await fetch(\`\${process.env.EXERGYNET_BASE_URL}/v1/chat/completions\`, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'vanguard-standard',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: true,
  }),
});`,
    py: `import requests
resp = requests.post(
    f"{BASE_URL}/v1/chat/completions",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"model": "vanguard-standard",
          "messages": [{"role": "user", "content": "Hello"}],
          "stream": True},
    stream=True,
)`,
  },
  {
    id: 'pro',
    method: 'POST',
    label: 'Vanguard Pro',
    sub: 'High-fidelity reasoning · Vanguard Pro · DEGRADED right now — see status note',
    desc: 'OpenAI-compatible chat completions, designed for high-fidelity streaming reasoning beyond Standard. model: "vanguard-pro" routes to a dedicated reasoning node. CURRENT STATUS: the model remains available and will respond, but expected accelerator-backed performance is not currently guaranteed — requests may run significantly slower than normal while this is being resolved.',
    endpoint: `${API}/v1/chat/completions`,
    routing: 'Dedicated Pro-tier node — degraded, see status note',
    model: 'vanguard-pro',
    runtimeProfile: 'general',
    responseFormats: ['text', 'json_object'],
    access: 'public',
    publicationStatus: 'public',
    operationalStatus: 'degraded',
    statusNote: 'Model remains available, but expected accelerator-backed (GPU) performance is not currently guaranteed — requests may run significantly slower than normal.',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `curl ${API}/v1/chat/completions \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "vanguard-pro",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'`,
    ts: `const res = await fetch(\`\${process.env.EXERGYNET_BASE_URL}/v1/chat/completions\`, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'vanguard-pro',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: true,
  }),
});`,
    py: `import requests
resp = requests.post(
    f"{BASE_URL}/v1/chat/completions",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"model": "vanguard-pro",
          "messages": [{"role": "user", "content": "Hello"}],
          "stream": True},
    stream=True,
)`,
  },
  {
    id: 'ultra',
    method: 'POST',
    label: 'Vanguard Ultra',
    sub: 'Consensus loop · Designed: bilateral Proposer ↔ Auditor debate · FALLBACK ACTIVE right now — see status note',
    desc: 'Designed capability: OpenAI-compatible chat completions via bilateral Proposer↔Auditor consensus — model: "vanguard-ultra" is built to run a multi-round debate loop for higher accuracy, non-streaming, intended for offline/batch jobs where accuracy matters more than speed rather than interactive or voice flows. CURRENT SERVICE STATE: the Auditor engine is not currently authenticating, so every request is served through Proposer-only fallback — the debate/consensus step is not happening right now. In its current state this is functionally equivalent to vanguard-standard at higher latency, with none of the accuracy benefit the design targets. No client-side change will be needed once this is resolved.',
    endpoint: `${API}/v1/chat/completions`,
    routing: 'Bilateral Proposer/Auditor engine — Auditor fallback active, see status note',
    model: 'vanguard-ultra',
    runtimeProfile: 'general',
    responseFormats: ['text'],
    access: 'public',
    publicationStatus: 'public',
    operationalStatus: 'fallback_active',
    statusNote: 'Auditor authentication is currently unavailable; requests are served through Proposer fallback only, so responses do not currently reflect bilateral consensus. No client-side change is needed once this is resolved.',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `curl ${API}/v1/chat/completions \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "vanguard-ultra",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
# This runs a multi-round Proposer/Auditor consensus loop — expect up to 60s+
# latency. Don't use for interactive/voice flows; better for offline/batch
# jobs where accuracy matters more than speed.`,
    ts: `const res = await fetch(\`\${process.env.EXERGYNET_BASE_URL}/v1/chat/completions\`, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'vanguard-ultra',
    messages: [{ role: 'user', content: 'Hello' }],
  }),
});`,
    py: `import requests
resp = requests.post(
    f"{BASE_URL}/v1/chat/completions",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"model": "vanguard-ultra",
          "messages": [{"role": "user", "content": "Hello"}]},
)`,
  },
  {
    id: 'extract',
    method: 'POST',
    label: 'Sovereign Clinical Extractor',
    sub: 'Structured REST · Schema-aware extraction · SEI',
    desc: 'Schema-aware structured extraction from free text. Pass a target schema (an object mapping field names to types — not a preset name/version string) and a domain hint; get typed fields back instead of prose.',
    endpoint: `${API}/v1/extract`,
    routing: 'Sovereign Extraction Node · Structured REST backend',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `curl -X POST ${API}/v1/extract \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Patient denies smoking. BP 150/95.",
    "schema": {"smoking_status": "boolean", "blood_pressure": "string"},
    "domain": "clinical"
  }'
# "schema" must be an object mapping field names to types — not a preset
# name/version string like "clinical-esource-v1".`,
    ts: `const res = await fetch(\`\${process.env.EXERGYNET_BASE_URL}/v1/extract\`, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Patient denies smoking. BP 150/95.',
    schema: { smoking_status: 'boolean', blood_pressure: 'string' }, // field-name -> type map, not a preset string
    domain: 'clinical',
  }),
});
const { extraction } = await res.json();`,
    py: `import requests
resp = requests.post(
    f"{BASE_URL}/v1/extract",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "text": "Patient denies smoking. BP 150/95.",
        "schema": {"smoking_status": "boolean", "blood_pressure": "string"},
        "domain": "clinical",
    },
)
print(resp.json()["extraction"])`,
  },

  // ── INTERNAL — clinical_runtime capability, NOT a public documentation
  // entry (added 2026-08-10, following the Vanguard mode-routing incident —
  // see VANGUARD_MODE_ROUTING_RECON.md) ──────────────────────────────────────
  //
  // As implemented today, POST /v1/chat/completions with { mode:
  // "clinical_runtime" } (or "clinical") is honored for ANY authenticated API
  // key — that's a verified implementation fact, not a policy decision this
  // platform has made. It is deliberately NOT added to API_SERVICES above,
  // and no developer-facing copy should ever say "any API key can invoke
  // Clinical Runtime" — there is no per-key runtime-authorization layer yet,
  // so publishing that contract would document an access-control gap as if
  // it were a feature.
  //
  // The @mymonitor.ai email-domain check inside AskMo's detectMode() gating
  // (biological_proxy/src/index.ts) exists SOLELY to preserve one
  // integration partner's pre-existing client behavior through the
  // keyword-fallback path — it is a one-off compatibility shim, not a
  // pattern. Do not hardcode additional customer domains into it; a new
  // integration has no legacy behavior to preserve, so it should simply use
  // the explicit mode="clinical_runtime" signal from day one once that
  // signal has real key-level gating in front of it.
  //
  // Recommended future public contract, once real authorization exists:
  //   runtimeProfile: "clinical", access: "capability_gated"
  // — an explicit allowlist flag on the developer/API-key record, checked
  // server-side, not an email-domain string or raw prompt keywords.
  //
  // STATUS until then: internal / capability-gating pending. Tracked here,
  // not published, not documented as an external integration path.

  {
    id: 'omega-carrier',
    method: 'MCP',
    label: 'Omega Carrier MCP',
    sub: 'MCP SSE · Agent identity, vault memory, AERIS proof, reserve',
    desc: 'Model Context Protocol SSE bridge for autonomous agents — sovereign identity bootstrap, vault memory tools, AERIS proof requests, and RHO reserve signals as callable MCP tools instead of raw REST. Also runs in stdio mode for local agents (Claude Desktop, etc.).',
    endpoint: 'https://mcp.exergynet.org/sse',
    routing: 'Instance Beta · port 8765 · PM2 omega-carrier',
    headers: `Authorization: Bearer <key>\nAccept: text/event-stream`,
    curl: `# Connect via MCP SSE (custom agent / swarm)
curl -N -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
     -H "Accept: text/event-stream" \\
     https://mcp.exergynet.org/sse

# stdio mode — Claude Desktop (mcp_config.json)
# { "mcpServers": { "omega-carrier": { "command": "python", "args": ["-m", "mcp", "run", "omega_carrier_mcp.py"] } } }`,
    ts: `import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport(
  new URL('https://mcp.exergynet.org/sse'),
  { headers: { Authorization: \`Bearer \${process.env.EXERGYNET_API_KEY}\` } }
);
const client = new Client({ name: 'my-agent', version: '1.0.0' }, {});
await client.connect(transport);

// Initialize sovereign identity
const result = await client.callTool('initialize_sovereign_identity', {
  agent_label: 'my-agent-001',
  bearer_token: process.env.EXERGYNET_API_KEY,
});`,
    py: `from mcp import ClientSession
from mcp.client.sse import sse_client

async with sse_client(
    "https://mcp.exergynet.org/sse",
    headers={"Authorization": f"Bearer {API_KEY}"}
) as (r, w):
    async with ClientSession(r, w) as session:
        await session.initialize()
        result = await session.call_tool(
            "initialize_sovereign_identity",
            {"agent_label": "my-agent-001", "bearer_token": API_KEY}
        )`,
  },
  {
    id: 'aeris-witness',
    method: 'POST',
    label: 'AERIS Witness',
    sub: 'zkTLS external site proof · content-addressed output · ZK metadata',
    desc: "zkTLS proof of an external site's live content at a point in time. Fetches target_url, extracts the field at data_selector, and returns a content hash with a real Groth16-sealed proof (RISC Zero, Base Sepolia) — the LNES-13 AERIS circuit. Proving takes several minutes; this is a long-poll endpoint, not instant.",
    endpoint: `${VAULT_URL}/api/aeris/witness`,
    routing: 'Next.js Edge · portal.exergynet.org → AERIS bouncer',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `curl -X POST https://portal.exergynet.org/api/aeris/witness \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "target_url": "https://api.weather.gov/points/40.7128,-74.0060",
    "data_selector": "properties.forecast",
    "intent": "witness:weather:nyc"
  }'

# Response:
# {
#   "witness_id": "wit_...",
#   "target_url": "...",
#   "content_hash": "0xabc...",
#   "proof_meta": { "verified": true, "timestamp": "...", "tls_version": "1.3" },
#   "excerpt": "..."
# }`,
    ts: `const res = await fetch('https://portal.exergynet.org/api/aeris/witness', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    target_url: 'https://api.weather.gov/points/40.7128,-74.0060',
    data_selector: 'properties.forecast',
    intent: 'witness:weather:nyc',
  }),
});
const { witness_id, content_hash, proof_meta } = await res.json();
// proof_meta.verified — true if zkTLS proof validated`,
    py: `import requests

resp = requests.post(
    "https://portal.exergynet.org/api/aeris/witness",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "target_url": "https://api.weather.gov/points/40.7128,-74.0060",
        "data_selector": "properties.forecast",
        "intent": "witness:weather:nyc",
    },
)
data = resp.json()
print(data["witness_id"], data["proof_meta"]["verified"])`,
  },
  {
    id: 'rho-sump',
    method: 'POST',
    label: 'RHO Reserve Queue',
    sub: 'Capital loop · task-recursion tax sump · requires SIPHON_OPERATOR_PK configured server-side',
    desc: 'Queues a micro-USDC sump amount — e.g. the task-recursion tax skimmed from a compute job reward — toward the $RHO on-chain mint/buyback loop. Requires SIPHON_OPERATOR_PK to be configured on the server; returns 503 with an explicit "gap" field if it is not.',
    endpoint: `${VAULT_URL}/api/billing/rho-sump`,
    routing: 'Next.js Edge · portal.exergynet.org → Base Sepolia RHO mint (ethers)',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `curl -X POST https://portal.exergynet.org/api/billing/rho-sump \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sump_micro_usdc": 250000,
    "miner_id": "your_agent_miner_id"
  }'

# If SIPHON_OPERATOR_PK isn't configured on the server, this returns:
# { "error": "SIPHON_OPERATOR_PK not configured on server", "gap": "Set SIPHON_OPERATOR_PK in portal .env" }
# with HTTP 503.`,
    ts: `const res = await fetch('https://portal.exergynet.org/api/billing/rho-sump', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sump_micro_usdc: 250000, miner_id: agentId }),
});
// 503 with { error, gap } if SIPHON_OPERATOR_PK isn't configured server-side`,
    py: `import requests

resp = requests.post(
    "https://portal.exergynet.org/api/billing/rho-sump",
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    json={"sump_micro_usdc": 250000, "miner_id": agent_id},
)
# 503 with {"error": ..., "gap": ...} if SIPHON_OPERATOR_PK isn't configured server-side
print(resp.json())`,
  },
  {
    id: 'voice',
    method: 'WS',
    label: 'Acoustic Voice Stream',
    sub: 'WebSocket · G.711 µ-law · 8kHz mono · Twilio media-stream protocol — phone-call routing only, see limitation note below',
    desc: 'Bidirectional WebSocket, G.711 µ-law 8kHz mono, Twilio media-stream framing. Current limitation: this endpoint is built for real Twilio phone calls — it resolves routing/billing from a phone number in customParameters.To, not from any Authorization header or field, so there is no supported way to authenticate a non-Twilio client today. It only ever emits mark/clear control events, never transcript or extraction. Contact the platform team before integrating a direct browser/API client against this endpoint.',
    endpoint: `wss://dt.portal.exergynet.org/media-stream`,
    routing: 'Portal Edge → Sovereign Extraction Node · media relay',
    headers: `Upgrade: websocket\nConnection: Upgrade`,
    curl: `# WebSocket upgrade (use wscat or native ws client)
# NOTE: this endpoint does not check any Authorization header or field —
# see the limitation note below before integrating.
wscat -c "wss://dt.portal.exergynet.org/media-stream"`,
    ts: `import WebSocket from 'ws';
// LIMITATION (as of 2026-07-10): this endpoint is built for real Twilio phone
// calls, not direct API-key-authenticated clients. It resolves billing/routing
// from a phone number in customParameters.To, not from any auth header or
// field — there is currently no supported way to authenticate a non-Twilio
// client here. It also only ever emits "mark"/"clear" control events, never
// "transcript" or "extraction" — do not build against those event names.
// If your integration needs authenticated browser-to-Vanguard voice, contact
// the platform team before building against this endpoint.
const ws = new WebSocket('wss://dt.portal.exergynet.org/media-stream');
ws.on('open', () => {
  ws.send(JSON.stringify({
    event: 'start', streamSid: 'MZ_your_sid',
    mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
  }));
});`,
    py: `import asyncio, websockets, json
# LIMITATION (as of 2026-07-10): Twilio-call-shaped endpoint, no client auth
# support, no "transcript"/"extraction" events — see the TS example above.
async def stream():
    uri = "wss://dt.portal.exergynet.org/media-stream"
    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({
            "event": "start", "streamSid": "MZ_your_sid",
            "mediaFormat": {"encoding": "audio/x-mulaw", "sampleRate": 8000, "channels": 1},
        }))
asyncio.run(stream())`,
  },
  {
    id: 'vision-describe',
    method: 'POST',
    label: 'Vision: Describe (Image → Text)',
    sub: 'Image-to-speech prep · relevance-filtered extraction · unbilled · UNAVAILABLE right now — see status note',
    desc: 'Reads an image and extracts only the content worth reading aloud — skips navigation chrome, decorative icons, ads, and boilerplate, returning plain text in natural reading order. Designed to feed straight into Voice: Generate for image-to-speech. Accepts base64-encoded image data (~9MB decoded cap). Unbilled — only the downstream TTS step deducts Exergy Credits. CURRENT STATUS: this endpoint shares its backing model with Vanguard Pro, which is currently degraded — a live test request did not return a response within several minutes. This endpoint enforces a 25-second timeout, so real calls are failing today, not merely running slow.',
    endpoint: `${VAULT_URL}/api/vision/describe`,
    routing: 'Next.js Edge · portal.exergynet.org → Vanguard vision engine',
    model: 'vanguard-pro',
    runtimeProfile: 'general',
    responseFormats: ['text'],
    access: 'public',
    publicationStatus: 'public',
    operationalStatus: 'unavailable',
    statusNote: 'Shares its backing model with Vanguard Pro (currently degraded). A live test request produced no response within several minutes before the connection failed; this endpoint has a 25-second timeout, so real calls fail today rather than merely running slow.',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `curl -X POST https://portal.exergynet.org/api/vision/describe \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "image_b64": "<base64-encoded image bytes>",
    "mime": "image/png"
  }'

# Response:
# { "text": "..." }
#
# Pipe straight into Voice: Generate to speak it:
# curl -X POST https://portal.exergynet.org/api/voice/generate \\
#   -H "Authorization: Bearer $EXERGYNET_API_KEY" -H "Content-Type: application/json" \\
#   -d '{"text": "<text from above>"}'`,
    ts: `const imgRes = await fetch('https://portal.exergynet.org/api/vision/describe', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ image_b64: base64Image, mime: 'image/png' }),
});
const { text } = await imgRes.json();

// Feed straight into TTS
const speechRes = await fetch('https://portal.exergynet.org/api/voice/generate', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text }),
});
const { audioUrl } = await speechRes.json();`,
    py: `import requests

img_resp = requests.post(
    "https://portal.exergynet.org/api/vision/describe",
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    json={"image_b64": base64_image, "mime": "image/png"},
)
text = img_resp.json()["text"]

speech_resp = requests.post(
    "https://portal.exergynet.org/api/voice/generate",
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    json={"text": text},
)
print(speech_resp.json()["audioUrl"])`,
  },
  {
    id: 'voice-generate',
    method: 'POST',
    label: 'Voice: Generate (TTS)',
    sub: 'Standalone REST TTS · Piper · bills 1 Exergy Credit per character',
    desc: 'Standalone text-to-speech, separate from the Acoustic Voice Stream WebSocket. Returns a URL to the generated audio. Bills 1 Exergy Credit per character of input text, deducted atomically only after generation succeeds — failed generations are never charged. 10,000 character hard cap per request.',
    endpoint: `${VAULT_URL}/api/voice/generate`,
    routing: 'Next.js Edge · portal.exergynet.org → Piper TTS (internal)',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `curl -X POST https://portal.exergynet.org/api/voice/generate \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Hello from ExergyNet.",
    "voice_id": "sovereign-meridian"
  }'

# voice_id is optional — defaults to "sovereign-meridian". Stock IDs:
# sovereign-meridian, sovereign-atlas, sovereign-lyra, sovereign-nova,
# sovereign-cipher, sovereign-kael
#
# Response:
# { "success": true, "audioUrl": "...", "duration": 3, "cost": 22, "credits_remaining": 9978 }
#
# 402 if balance < text.length: { "error": "Insufficient Exergy Credits...", "balance": 10 }`,
    ts: `const res = await fetch('https://portal.exergynet.org/api/voice/generate', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text: 'Hello from ExergyNet.', voice_id: 'sovereign-meridian' }),
});
const { audioUrl, cost, credits_remaining } = await res.json();
// audioUrl points to the generated file — fetch it separately to get the audio bytes`,
    py: `import requests

resp = requests.post(
    "https://portal.exergynet.org/api/voice/generate",
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    json={"text": "Hello from ExergyNet.", "voice_id": "sovereign-meridian"},
)
data = resp.json()
print(data["audioUrl"], data["credits_remaining"])`,
  },
  {
    id: 'voice-transcribe',
    method: 'POST',
    label: 'Voice: Transcribe (STT)',
    sub: 'Standalone REST STT · Whisper · multipart upload · unbilled',
    desc: 'Standalone speech-to-text. Multipart form upload — the audio file field must be named "file" (not "audio"). 25 MB hard cap. Unlike Generate, this endpoint does not deduct Exergy Credits.',
    endpoint: `${VAULT_URL}/api/voice/transcribe`,
    routing: 'Next.js Edge · portal.exergynet.org → Whisper STT (internal)',
    headers: `Authorization: Bearer <key>\nContent-Type: multipart/form-data`,
    curl: `curl -X POST https://portal.exergynet.org/api/voice/transcribe \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -F "file=@./recording.wav"

# The form field MUST be named "file" — other field names are ignored and
# the request will fail with 400 "audio file required".
#
# Response:
# { "text": "...", "duration": 4.2, "language": "en" }`,
    ts: `const form = new FormData();
form.append('file', audioBlob, 'recording.wav'); // field name must be "file"

const res = await fetch('https://portal.exergynet.org/api/voice/transcribe', {
  method: 'POST',
  headers: { 'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\` },
  body: form,
});
const { text, duration, language } = await res.json();`,
    py: `import requests

with open("recording.wav", "rb") as f:
    resp = requests.post(
        "https://portal.exergynet.org/api/voice/transcribe",
        headers={"Authorization": f"Bearer {API_KEY}"},
        files={"file": ("recording.wav", f, "audio/wav")},  # field name must be "file"
    )
print(resp.json()["text"])`,
  },
  {
    id: 'voice-preview',
    method: 'GET',
    label: 'Voice: Preview',
    sub: 'Stock voice sample phrases · server-cached · strict voiceId allowlist',
    desc: 'Returns a short cached sample audio clip for one of the six stock voice IDs, so a client can preview a voice before committing credits to a real Generate call. voiceId is checked against a strict allowlist server-side — unrecognized IDs are rejected before reaching the TTS backend.',
    endpoint: `${VAULT_URL}/api/voice/preview`,
    routing: 'Next.js Edge · portal.exergynet.org → Piper TTS (internal, server-cached)',
    headers: `Authorization: Bearer <key>`,
    curl: `curl "https://portal.exergynet.org/api/voice/preview?voiceId=sovereign-lyra" \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY"

# Allowed voiceId values: sovereign-meridian, sovereign-atlas, sovereign-lyra,
# sovereign-nova, sovereign-cipher, sovereign-kael — anything else returns
# 400 { "error": "Unknown voice ID" }
#
# Response: { "success": true, "audioUrl": "..." }`,
    ts: `const res = await fetch('https://portal.exergynet.org/api/voice/preview?voiceId=sovereign-lyra', {
  headers: { 'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\` },
});
const { audioUrl } = await res.json();`,
    py: `import requests

resp = requests.get(
    "https://portal.exergynet.org/api/voice/preview",
    headers={"Authorization": f"Bearer {API_KEY}"},
    params={"voiceId": "sovereign-lyra"},
)
print(resp.json()["audioUrl"])`,
  },
  {
    id: 'voice-forge-register',
    method: 'POST',
    label: 'Voice: Forge (Custom Voice)',
    sub: 'Register a custom voice profile · pitch-shifted stock model, not ML voice cloning',
    desc: 'Registers a custom voice profile from up to 10 WebM recordings (5 MB each). Important limitation: this is a pitch-shifted stock Piper voice keyed to a pitchRatio, not true ML voice cloning — the recordings establish a pitch target, they are not used to train a new voice model. Treat this as "pick a base model and a pitch," not "clone my voice."',
    endpoint: `${VAULT_URL}/api/voice/forge/register`,
    routing: 'Next.js Edge · portal.exergynet.org → sovereign-tts registration server (internal)',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `curl -X POST https://portal.exergynet.org/api/voice/forge/register \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "voiceId": "my-custom-voice",
    "displayName": "My Custom Voice",
    "pitchRatio": 1.08,
    "baseModel": "sovereign-meridian",
    "recordings": ["data:audio/webm;base64,GkXfo..."]
  }'

# recordings are optional but capped: max 10, 5 MB each, must be
# "data:audio/webm;base64,..." data URIs with valid WebM magic bytes.
# This registers a pitch-shifted stock model, not a trained clone.
#
# Response: { "success": true, "voiceId": "my-custom-voice", "displayName": "My Custom Voice" }`,
    ts: `const res = await fetch('https://portal.exergynet.org/api/voice/forge/register', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    voiceId: 'my-custom-voice',
    displayName: 'My Custom Voice',
    pitchRatio: 1.08,       // required — this is what actually differentiates the voice
    baseModel: 'sovereign-meridian',
    recordings: [],          // optional, data:audio/webm;base64,... entries, 10 max / 5MB each
  }),
});`,
    py: `import requests

resp = requests.post(
    "https://portal.exergynet.org/api/voice/forge/register",
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    json={
        "voiceId": "my-custom-voice",
        "displayName": "My Custom Voice",
        "pitchRatio": 1.08,
        "baseModel": "sovereign-meridian",
        "recordings": [],
    },
)
print(resp.json())`,
  },
  {
    id: 'voice-marketplace',
    method: 'GET',
    label: 'Voice: Marketplace',
    sub: 'Browse/publish community voice profiles · pricePerUse field exists, payout is not implemented',
    desc: 'List other users\' published custom voice profiles (GET), or publish/unpublish your own with a pricePerUse (POST). Important limitation: pricePerUse and uses are tracked fields, but nothing in the current backend actually charges a listener or pays out a creator royalty — treat this as a listing/visibility mechanism only, not a working payments flow.',
    endpoint: `${VAULT_URL}/api/voice/marketplace`,
    routing: 'Next.js Edge · portal.exergynet.org → custom_profiles.json (file-lock serialized)',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `# List community voices (excludes your own)
curl https://portal.exergynet.org/api/voice/marketplace \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY"

# Publish one of your own registered voices
curl -X POST https://portal.exergynet.org/api/voice/marketplace \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "voiceId": "my-custom-voice", "published": true, "pricePerUse": 5 }'

# NOTE: pricePerUse is stored and returned, but no billing/payout logic
# consumes it yet — a listener is never actually charged.`,
    ts: `// List
const res = await fetch('https://portal.exergynet.org/api/voice/marketplace', {
  headers: { 'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\` },
});
const { voices } = await res.json();

// Publish
await fetch('https://portal.exergynet.org/api/voice/marketplace', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ voiceId: 'my-custom-voice', published: true, pricePerUse: 5 }),
});
// pricePerUse is stored, not enforced — no payout mechanism exists yet`,
    py: `import requests

# List
resp = requests.get(
    "https://portal.exergynet.org/api/voice/marketplace",
    headers={"Authorization": f"Bearer {API_KEY}"},
)
print(resp.json()["voices"])

# Publish — pricePerUse is stored, not enforced (no payout mechanism yet)
requests.post(
    "https://portal.exergynet.org/api/voice/marketplace",
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    json={"voiceId": "my-custom-voice", "published": True, "pricePerUse": 5},
)`,
  },
];
