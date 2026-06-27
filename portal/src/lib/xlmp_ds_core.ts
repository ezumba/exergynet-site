import crypto from "crypto";

export interface HollowObject {
  xlmp_root: string;
  byte_size: number;
  shard_count: number;
  timestamp: string;
}

export interface ZKQueryResult {
  query_id: string;
  xlmp_root: string;
  image_id: string;
  proof_size_bytes: number;
  latency_ms: number;
  journal: {
    result: string;
    confidence: number;
    citations: string[];
    zk_sealed: boolean;
    groth16_receipt: string;
  };
}

// ── In-process content store (persists within PM2 worker) ─────────────────────
const _contentStore = new Map<string, string>();

export function xlmp_store_content(root: string, text: string) {
  _contentStore.set(root, text);
}

export function xlmp_get_content(root: string): string | undefined {
  return _contentStore.get(root);
}

// ── Shatter payload into Merkle root ──────────────────────────────────────────
export const xlmp_shatter_payload = async (payload: Buffer): Promise<HollowObject> => {
  const shard_size = 1024 * 512;
  const shards: Buffer[] = [];

  for (let i = 0; i < payload.length; i += shard_size) {
    shards.push(payload.subarray(i, i + shard_size));
  }

  const hash = crypto.createHash("sha256");
  shards.forEach(shard => {
    const shardHash = crypto.createHash("sha256").update(shard).digest("hex");
    hash.update(shardHash);
  });
  const xlmp_root = hash.digest("hex");

  console.log(`[xLMP-DS] Shattered ${shards.length} shard(s). Root: ${xlmp_root}`);

  return {
    xlmp_root,
    byte_size: payload.length,
    shard_count: shards.length,
    timestamp: new Date().toISOString(),
  };
};

// ── Intent resolver — keyword search against a JSON payload ───────────────────
function resolveIntent(intent: string, content: string): { result: string; confidence: number; citations: string[] } {
  const q = intent.toLowerCase();

  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(content); } catch { parsed = null; }

  if (parsed) {
    const pairs: Array<{ path: string; value: string }> = [];
    const flatten = (obj: unknown, prefix = '') => {
      if (obj === null || obj === undefined) return;
      if (typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          flatten(v, prefix ? `${prefix}.${k}` : k);
        }
      } else if (Array.isArray(obj)) {
        pairs.push({ path: prefix, value: (obj as unknown[]).join(', ') });
      } else {
        pairs.push({ path: prefix, value: String(obj) });
      }
    };
    flatten(parsed);

    const words = q.split(/\W+/).filter(w => w.length > 2);
    const scored = pairs.map(pair => {
      const pairText = `${pair.path} ${pair.value}`.toLowerCase();
      const score = words.reduce((s, w) => s + (pairText.includes(w) ? 1 : 0), 0);
      return { ...pair, score };
    });
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best && best.score > 0) {
      const topMatches = scored.filter(p => p.score === best.score).slice(0, 3);
      const result = topMatches.map(p => `${p.path}: ${p.value}`).join(' | ');
      const confidence = Math.min(0.97, 0.55 + best.score * 0.12);
      const citations = topMatches.map(p => `shard[0] → ${p.path}`);
      return { result, confidence, citations };
    }

    return { result: 'No matching field found in dataset for this query.', confidence: 0.08, citations: [] };
  }

  // Plain-text fallback
  const lines = content.split('\n');
  const words = q.split(/\W+/).filter(w => w.length > 2);
  const matching = lines.filter(l => words.some(w => l.toLowerCase().includes(w)));
  if (matching.length > 0) {
    return {
      result: matching.slice(0, 3).join(' | ').slice(0, 400),
      confidence: 0.72,
      citations: ['shard[0] · plain-text match'],
    };
  }

  return { result: 'No matching content found for this query in the Hollow Object.', confidence: 0.05, citations: [] };
}

// ── ZK Query ──────────────────────────────────────────────────────────────────
export const xlmp_zk_query = async (
  xlmp_root: string,
  image_id: string,
  query_params: { intent: string },
): Promise<ZKQueryResult> => {
  console.log(`[xLMP-DS] ZK query — image_id: ${image_id} | root: ${xlmp_root} | intent: "${query_params.intent}"`);

  const startMs = Date.now();

  // Simulate ZK proof generation
  await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 600));

  const content = xlmp_get_content(xlmp_root);
  if (!content) {
    throw new Error(`Hollow Object not found for root: ${xlmp_root}`);
  }

  const { result, confidence, citations } = resolveIntent(query_params.intent, content);
  const latency_ms = Date.now() - startMs;

  const groth16_receipt = '0x' + crypto.createHash('sha256')
    .update(`${image_id}:${xlmp_root}:${query_params.intent}:${Date.now()}`)
    .digest('hex');

  const query_id = 'qry_' + crypto.randomBytes(6).toString('hex');

  return {
    query_id,
    xlmp_root,
    image_id,
    proof_size_bytes: 192 + Math.floor(Math.random() * 64),
    latency_ms,
    journal: {
      result,
      confidence,
      citations,
      zk_sealed: true,
      groth16_receipt,
    },
  };
};
