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
}

const VAULT_URL = 'https://portal.exergynet.org';
const API = 'https://explorer-api.exergynet.org';

export const API_SERVICES: ApiService[] = [
  {
    id: 'vault-ingest',
    method: 'POST',
    label: 'Vault: Ingest',
    sub: 'X-LMP Protocol · Merkle shard upload · Hollow Object generation',
    desc: 'X-LMP Protocol — multipart file upload. Shatters the payload into SHA-256 Merkle shards and returns a xlmp_root handle (a "Hollow Object") to store and query against later. Raw data never leaves this call again — only the root hash is referenced afterward.',
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
    desc: 'OpenAI-compatible chat completions, fast and streaming. Point any OpenAI SDK at this base URL with model: "vanguard-standard" — routes to Node 4, the quickest of the three Vanguard tiers.',
    endpoint: `${API}/v1/chat/completions`,
    routing: 'Node 4 — 74.235.106.10:50051',
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
    sub: 'High-fidelity reasoning · Vanguard Pro · Node 3',
    desc: 'OpenAI-compatible chat completions, high-fidelity and streaming. model: "vanguard-pro" routes to Node 3 for deeper reasoning than Standard, still streaming.',
    endpoint: `${API}/v1/chat/completions`,
    routing: 'Node 3 — 40.124.170.30:50051',
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
    sub: 'Consensus loop · Bilateral Proposer ↔ Auditor debate · high latency (up to 60s+), not for interactive use',
    desc: 'OpenAI-compatible chat completions via bilateral Proposer↔Auditor consensus. model: "vanguard-ultra" runs a multi-round debate loop for higher accuracy — non-streaming, and confirmed live to take 60s+. Use for offline/batch jobs where accuracy matters more than speed, not interactive or voice flows.',
    endpoint: `${API}/v1/chat/completions`,
    routing: 'Proposer 74.235.106.10 ↔ Auditor 40.124.170.30',
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
    routing: 'AskMo Node 1 — 20.127.220.199:3000',
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
    sub: 'Capital loop · 5% task recursion tax · admin-gated market strike',
    desc: 'Queues a reserve entry — the 5% task-recursion tax skimmed from compute job rewards — toward the $RHO buyback threshold. Pair with GET /api/rho/sump/status to check progress toward the market-strike threshold.',
    endpoint: `${VAULT_URL}/api/rho/sump`,
    routing: 'Next.js → biological_proxy port 5000 → rho_buyback_queue table',
    headers: `Authorization: Bearer <key>\nContent-Type: application/json`,
    curl: `# Queue a reserve entry (5% of task reward)
curl -X POST https://portal.exergynet.org/api/rho/sump \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "node_id":  "your_agent_miner_id",
    "task_id":  "task_abc123",
    "sump":     250,
    "memo":     "5% recursion tax — compute job"
  }'

# Check queue status
curl https://portal.exergynet.org/api/rho/sump/status \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY"`,
    ts: `// Queue a reserve entry
const res = await fetch('https://portal.exergynet.org/api/rho/sump', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ node_id: agentId, task_id: taskId, sump: 250, memo: '5% recursion tax' }),
});
const { sump_id, pending_queue_total, market_strike } = await res.json();

// Check status
const status = await fetch('https://portal.exergynet.org/api/rho/sump/status', {
  headers: { 'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\` },
}).then(r => r.json());
// status.pending_micro_usdc — total queued
// status.threshold_pct — % toward 50,000 µUSDC strike threshold`,
    py: `import requests

# Queue entry
resp = requests.post(
    "https://portal.exergynet.org/api/rho/sump",
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    json={"node_id": agent_id, "task_id": task_id, "sump": 250, "memo": "5% recursion tax"},
)
data = resp.json()
print(data["sump_id"], data["pending_queue_total"])

# Status
status = requests.get(
    "https://portal.exergynet.org/api/rho/sump/status",
    headers={"Authorization": f"Bearer {API_KEY}"},
).json()
print(f"Queue: {status['pending_micro_usdc']} µUSDC ({status['threshold_pct']}% to strike)")`,
  },
  {
    id: 'voice',
    method: 'WS',
    label: 'Acoustic Voice Stream',
    sub: 'WebSocket · G.711 µ-law · 8kHz mono · Twilio media-stream protocol — phone-call routing only, see limitation note below',
    desc: 'Bidirectional WebSocket, G.711 µ-law 8kHz mono, Twilio media-stream framing. Current limitation: this endpoint is built for real Twilio phone calls — it resolves routing/billing from a phone number in customParameters.To, not from any Authorization header or field, so there is no supported way to authenticate a non-Twilio client today. It only ever emits mark/clear control events, never transcript or extraction. Contact the platform team before integrating a direct browser/API client against this endpoint.',
    endpoint: `wss://dt.portal.exergynet.org/media-stream`,
    routing: 'Portal (52.44.165.199) → AskMo Node 1 — 20.127.220.199:3000',
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
];
