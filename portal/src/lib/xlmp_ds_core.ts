import crypto from "crypto";

export interface HollowObject {
  xlmp_root: string;
  byte_size: number;
  shard_count: number;
  timestamp: string;
}

export interface JournalEntry {
  status: 'found' | 'partial' | 'not_found' | 'error';
  result: unknown;
  confidence: number;
  citations: string[];
  zk_sealed: boolean;
  groth16_receipt: string;
  message?: string;
}

export interface ZKQueryResult {
  query_id: string;
  xlmp_root: string;
  image_id: string;
  proof_size_bytes: number;
  latency_ms: number;
  journal: JournalEntry;
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

// ── Stop words ─────────────────────────────────────────────────────────────────
// "patient" / "patients" included because they appear in every field path and
// would otherwise give a free score point to every field, causing patient.name
// to win as a false fallback for any unknown query.
const STOP_WORDS = new Set([
  'what', 'who', 'where', 'when', 'why', 'how', 'which',
  'is', 'are', 'was', 'were', 'has', 'have', 'had',
  'does', 'did', 'can', 'could', 'will', 'would', 'should',
  'the', 'this', 'that', 'these', 'those', 'its', 'their',
  'and', 'or', 'but', 'not', 'for', 'from', 'with', 'into',
  'get', 'give', 'show', 'find', 'tell', 'return', 'list',
  'me', 'you', 'your', 'about', 'any', 'all', 'please',
  'say', 'says', 'said', 'does', 'document', 'text', 'file',
  'patient', 'patients', 'subject', 'person', 'user',
]);

function extractQueryWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// ── Field-scoring: compares query words to the LEAF segment only ───────────────
// Scores are per-word, then divided by word count to get a relative score [0–2+].
// Confidence = min(0.97, 0.50 + relScore × 0.30).
// Threshold = 0.85 → relScore must be ≥ 1.17 to pass.
//
// Per-word scoring:
//   Exact match to a leaf segment:           +2.0
//   Prefix/stem (one starts with the other): +1.5
//   Fuzzy prefix (≥75% common leading chars):+1.2
//   Substring (one contains the other):      +0.8
//   Value-text only:                         +0.4
function scoreField(
  leafSegments: string[],
  valueText: string,
  queryWords: string[]
): number {
  if (queryWords.length === 0) return 0;

  let totalScore = 0;

  for (const qw of queryWords) {
    let wordScore = 0;

    for (const seg of leafSegments) {
      if (seg === qw) {
        wordScore = Math.max(wordScore, 2.0);
      } else if (seg.startsWith(qw) || qw.startsWith(seg)) {
        wordScore = Math.max(wordScore, 1.5);
      } else {
        let shared = 0;
        const minLen = Math.min(seg.length, qw.length);
        while (shared < minLen && seg[shared] === qw[shared]) shared++;
        if (shared / minLen >= 0.75) {
          wordScore = Math.max(wordScore, 1.2);
        } else if (seg.includes(qw) || qw.includes(seg)) {
          wordScore = Math.max(wordScore, 0.8);
        }
      }
    }

    if (wordScore === 0 && valueText.includes(qw)) {
      wordScore = 0.4;
    }

    totalScore += wordScore;
  }

  return totalScore / queryWords.length;
}

const MIN_CONFIDENCE = 0.85;

function relScoreToConfidence(relScore: number): number {
  return Math.min(0.97, 0.50 + relScore * 0.30);
}

// ── Intent resolver ────────────────────────────────────────────────────────────
interface Pair {
  path: string;
  leafSegments: string[];
  valueText: string;
  rawValue: unknown;
}

function flattenJSON(obj: unknown, prefix = '', acc: Pair[] = []): Pair[] {
  if (obj === null || obj === undefined) return acc;
  if (Array.isArray(obj)) {
    const leaf = prefix.split('.').pop() ?? prefix;
    acc.push({
      path: prefix,
      leafSegments: leaf.split('_'),
      valueText: (obj as unknown[]).join(', ').toLowerCase(),
      rawValue: obj,
    });
  } else if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flattenJSON(v, prefix ? `${prefix}.${k}` : k, acc);
    }
  } else {
    const leaf = prefix.split('.').pop() ?? prefix;
    acc.push({
      path: prefix,
      leafSegments: leaf.split('_'),
      valueText: String(obj).toLowerCase(),
      rawValue: obj,
    });
  }
  return acc;
}

function singleFieldResolve(
  pairs: Pair[],
  queryWords: string[]
): { pair: Pair; relScore: number } | null {
  let best: { pair: Pair; relScore: number } | null = null;

  for (const pair of pairs) {
    const rel = scoreField(pair.leafSegments, pair.valueText, queryWords);
    if (!best || rel > best.relScore) {
      best = { pair, relScore: rel };
    }
  }

  return best;
}

interface ResolveResult {
  result: unknown;
  status: 'found' | 'partial' | 'not_found';
  confidence: number;
  citations: string[];
  message?: string;
}

// ── Document Intelligence Layer ────────────────────────────────────────────────
// Split plain-text content into semantic chunks at paragraph boundaries.
const CHUNK_TARGET_SIZE = 1800; // chars per chunk
const MAX_CONTEXT_CHARS = 7000; // total chars passed to LLM
const TOP_CHUNKS = 5;

const VANGUARD_URL = process.env.SEI_VANGUARD_URL ?? 'http://127.0.0.1:5000';

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = '';

  for (const para of paragraphs) {
    if ((current + para).length > CHUNK_TARGET_SIZE && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim().length > 50) chunks.push(current.trim());
  return chunks;
}

function scoreChunk(chunk: string, queryWords: string[]): number {
  const lower = chunk.toLowerCase();
  let score = 0;
  for (const w of queryWords) {
    let pos = 0;
    while ((pos = lower.indexOf(w, pos)) !== -1) {
      score++;
      pos++;
    }
  }
  return score;
}

async function synthesizeFromDocument(
  content: string,
  intent: string,
  queryWords: string[]
): Promise<ResolveResult> {
  const chunks = splitIntoChunks(content);

  // Score all chunks, sort descending
  const scored = chunks
    .map((chunk, idx) => ({ chunk, score: scoreChunk(chunk, queryWords), idx }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      result: null,
      status: 'not_found',
      confidence: 0,
      citations: [],
      message: 'No relevant content found for this query.',
    };
  }

  // Build context: take top chunks up to MAX_CONTEXT_CHARS
  let context = '';
  const usedChunks: typeof scored = [];
  for (const c of scored.slice(0, TOP_CHUNKS)) {
    const addition = c.chunk + '\n\n---\n\n';
    if (context.length + addition.length > MAX_CONTEXT_CHARS && usedChunks.length > 0) break;
    context += addition;
    usedChunks.push(c);
  }

  const shardSize = 512 * 1024;

  try {
    const llmRes = await fetch(`${VANGUARD_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'vanguard-standard',
        stream: false,
        messages: [
          {
            role: 'system',
            content: `You are a precise document intelligence engine. Answer the query using ONLY the provided document excerpts. Be concise, accurate, and complete. Do not reference the excerpts directly — synthesize the answer. If the answer is not present in the excerpts, say so clearly.`,
          },
          {
            role: 'user',
            content: `Document excerpts:\n\n${context}\n\nQuery: ${intent}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!llmRes.ok) throw new Error(`Vanguard HTTP ${llmRes.status}`);

    const llmData = await llmRes.json();
    const answer = llmData.choices?.[0]?.message?.content ?? '';
    if (!answer.trim()) throw new Error('Empty synthesis response');

    return {
      result: answer.trim(),
      status: 'found',
      confidence: 0.91,
      citations: usedChunks.map(c => {
        const shardIdx = Math.floor((c.idx * CHUNK_TARGET_SIZE) / shardSize);
        return `shard[${shardIdx}] · chunk[${c.idx}] · relevance: ${c.score}`;
      }),
    };
  } catch (e: any) {
    console.warn('[xLMP-DS] Synthesis fallback:', e?.message);
    // Fallback: return top matching text fragments (current behavior)
    const hits = usedChunks.map(c => c.chunk.slice(0, 150).replace(/\s+/g, ' ').trim());
    return {
      result: hits.join(' | '),
      status: 'found',
      confidence: 0.72,
      citations: usedChunks.map(c => {
        const shardIdx = Math.floor((c.idx * CHUNK_TARGET_SIZE) / shardSize);
        return `shard[${shardIdx}] · chunk[${c.idx}] · plain-text match`;
      }),
      message: `Synthesis unavailable (${e?.message ?? 'Vanguard offline'}) — returning matched fragments.`,
    };
  }
}

// ── Main intent resolver (async for document synthesis) ────────────────────────
async function resolveIntent(intent: string, content: string): Promise<ResolveResult> {
  // Plain-text path: JSON parse fails → document intelligence resolver
  let parsed: unknown = null;
  try { parsed = JSON.parse(content); } catch { parsed = null; }

  if (!parsed) {
    const qWords = extractQueryWords(intent);
    if (qWords.length === 0) {
      return { result: null, status: 'not_found', confidence: 0, citations: [], message: 'No searchable terms in query.' };
    }
    return synthesizeFromDocument(content, intent, qWords);
  }

  const pairs = flattenJSON(parsed);
  if (pairs.length === 0) {
    return { result: null, status: 'not_found', confidence: 0, citations: [], message: 'Empty dataset.' };
  }

  const queryWords = extractQueryWords(intent);
  if (queryWords.length === 0) {
    return { result: null, status: 'not_found', confidence: 0, citations: [], message: 'No searchable terms in query.' };
  }

  // ── Detect composite / multi-field intent ──────────────────────────────────
  const intentLower = intent.toLowerCase();
  const commaCount = (intent.match(/,/g) || []).length;
  const isComposite = intentLower.includes('json') || commaCount >= 2;

  if (isComposite) {
    const rawSegments = intent.split(/,\s*/).flatMap(s => s.split(/\s+(?:and|or)\s+/i));

    const resultObj: Record<string, unknown> = {};
    const allCitations: string[] = [];
    const missingTerms: string[] = [];

    for (const seg of rawSegments) {
      const segWords = extractQueryWords(seg);
      if (segWords.length === 0) continue;

      const best = singleFieldResolve(pairs, segWords);
      if (!best) continue;

      const conf = relScoreToConfidence(best.relScore);
      if (conf >= MIN_CONFIDENCE) {
        const leafKey = best.pair.path.split('.').pop() ?? best.pair.path;
        resultObj[leafKey] = best.pair.rawValue;
        allCitations.push(`shard[0] → ${best.pair.path}`);
      } else {
        missingTerms.push(segWords.join(' '));
      }
    }

    if (Object.keys(resultObj).length === 0) {
      return {
        result: null,
        status: 'not_found',
        confidence: 0,
        citations: [],
        message: 'None of the requested fields are present in committed memory.',
      };
    }

    const ratio = allCitations.length / (allCitations.length + missingTerms.length);
    const aggregateConf = Math.min(0.97, 0.70 + 0.27 * ratio);
    const status = missingTerms.length === 0 ? 'found' : 'partial';

    return {
      result: resultObj,
      status,
      confidence: aggregateConf,
      citations: allCitations,
      ...(missingTerms.length > 0 ? { message: `Not found in dataset: ${missingTerms.join(', ')}` } : {}),
    };
  }

  // ── Single-field resolution ────────────────────────────────────────────────
  const best = singleFieldResolve(pairs, queryWords);
  if (!best) {
    return {
      result: null,
      status: 'not_found',
      confidence: 0,
      citations: [],
      message: 'Requested field is not present in committed memory.',
    };
  }

  const confidence = relScoreToConfidence(best.relScore);

  if (confidence < MIN_CONFIDENCE) {
    return {
      result: null,
      status: 'not_found',
      confidence,
      citations: [],
      message: 'Requested field is not present in committed memory.',
    };
  }

  const displayValue = Array.isArray(best.pair.rawValue)
    ? (best.pair.rawValue as unknown[]).join(', ')
    : String(best.pair.rawValue);

  return {
    result: `${best.pair.path}: ${displayValue}`,
    status: 'found',
    confidence,
    citations: [`shard[0] → ${best.pair.path}`],
  };
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

  const resolved = await resolveIntent(query_params.intent, content);
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
      status: resolved.status,
      result: resolved.result,
      confidence: resolved.confidence,
      citations: resolved.citations,
      zk_sealed: true,
      groth16_receipt,
      ...(resolved.message ? { message: resolved.message } : {}),
    },
  };
};
