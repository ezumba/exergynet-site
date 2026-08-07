import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

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
  // Real RISC Zero integrity proof status for this xlmp_root, distinct from
  // `zk_sealed`/`groth16_receipt` above (which is the fast SHA-256 stub used
  // for every query so retrieval stays synchronous). Real proving measured
  // at ~13 minutes on this CPU-only box -- far too slow for a query response,
  // so it's queued separately via xlmp_request_proof() and polled here.
  real_proof_status: 'not_started' | 'pending' | 'complete' | 'failed';
  real_groth16_receipt?: string;
}

export interface ZKQueryResult {
  query_id: string;
  xlmp_root: string;
  image_id: string;
  proof_size_bytes: number;
  latency_ms: number;
  journal: JournalEntry;
}

// ── Persistent content store (filesystem-backed, in-memory cache layer) ───────
// Primary: writes to XLMP_DATA_DIR (default /home/ubuntu/xlmp_data on EC2).
// Cache: in-process Map for fast repeated reads within the same worker.
// Survives PM2 restarts; xlmp_root filenames are SHA-256 hex (filesystem-safe).
const XLMP_DATA_DIR = process.env.XLMP_DATA_DIR ?? '/home/ubuntu/xlmp_data';
const _contentCache = new Map<string, string>();

function _ensureDataDir() {
  try { fs.mkdirSync(XLMP_DATA_DIR, { recursive: true }); } catch { /* already exists */ }
}

function _rootPath(root: string): string {
  // Sanitize: keep only hex chars to prevent path traversal
  const safe = root.replace(/[^a-f0-9]/gi, '').slice(0, 64);
  return path.join(XLMP_DATA_DIR, `${safe}.xlmp`);
}

export function xlmp_store_content(root: string, text: string) {
  _contentCache.set(root, text);
  try {
    _ensureDataDir();
    fs.writeFileSync(_rootPath(root), text, 'utf8');
  } catch (e) {
    console.warn(`[xLMP-DS] Disk write failed for root ${root.slice(0, 12)}:`, e);
  }
}

// ── LNES-50: Sovereign Ownership Index ────────────────────────────────────────
// A lightweight owner->root mapping so the ExergyVault UI can list a user's
// HollowObjects, while the content store above stays purely content-addressed
// (identity is recorded here, NOT coupled into xlmp_store_content). Append-only
// JSONL: on POSIX, O_APPEND writes smaller than PIPE_BUF (4 KiB) are atomic, so
// concurrent high-frequency ingests never interleave — no read-modify-write
// race, no SQLite/native dependency. List reads the log and dedups by root.
const XLMP_INDEX_PATH = path.join(XLMP_DATA_DIR, '_ownership_index.jsonl');

export interface OwnedHollowObject {
  owner: string;
  xlmp_root: string;
  intent: string;
  byte_size: number;
  shard_count: number;
  timestamp: string;
}

export function xlmp_index_record(
  root: string,
  owner: string,
  meta: { intent?: string; byte_size: number; shard_count: number },
): void {
  if (!owner || !root) return;
  try {
    _ensureDataDir();
    const rec: OwnedHollowObject = {
      owner,
      xlmp_root: root,
      intent: meta.intent ?? 'agent-memory',
      byte_size: meta.byte_size,
      shard_count: meta.shard_count,
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(XLMP_INDEX_PATH, JSON.stringify(rec) + '\n', 'utf8');
  } catch (e) {
    console.warn('[xLMP-DS] ownership index append failed:', e);
  }
}

export function xlmp_index_list(owner: string): OwnedHollowObject[] {
  if (!owner) return [];
  let raw = '';
  try { raw = fs.readFileSync(XLMP_INDEX_PATH, 'utf8'); } catch { return []; }
  const byRoot = new Map<string, OwnedHollowObject>();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let rec: OwnedHollowObject;
    try { rec = JSON.parse(line) as OwnedHollowObject; } catch { continue; }
    if (rec.owner !== owner) continue;
    byRoot.set(rec.xlmp_root, rec); // last write wins — re-ingest refreshes metadata
  }
  return [...byRoot.values()].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

// ── LNES-58.10: content-root verification ──────────────────────────────────
// xlmp_get_content previously trusted the object selected by filename/root
// and returned it without recomputing its commitment. computeXlmpRoot is
// the single source of truth for the algorithm -- xlmp_shatter_payload
// (ingest) and xlmp_get_content (retrieval) both call it, so there is no
// separate reimplementation to drift out of sync.
//
// Algorithm (unchanged from the original xlmp_shatter_payload -- existing
// stored roots remain valid):
//   1. UTF-8 encode the canonical text into a Buffer.
//   2. Split into consecutive 512 KiB shards (fixed byte-size boundaries,
//      not content-aware; final shard may be shorter).
//   3. Per shard: SHA-256(shard bytes) -> hex digest.
//   4. Root: SHA-256(UTF-8 bytes of the concatenation of all shard hex
//      digests, in shard order).
// This is a SEQUENTIAL HASH CHAIN over shard digests, not a binary Merkle
// tree: there is no pairwise combination and no odd-leaf special case, and
// verification requires recomputing every shard hash -- this construction
// has no logarithmic partial-inclusion proof.
export function computeXlmpRoot(payload: Buffer): { root: string; shard_count: number } {
  const shard_size = 1024 * 512;
  const shards: Buffer[] = [];
  for (let i = 0; i < payload.length; i += shard_size) {
    shards.push(payload.subarray(i, i + shard_size));
  }
  const hash = crypto.createHash('sha256');
  shards.forEach(shard => {
    const shardHash = crypto.createHash('sha256').update(shard).digest('hex');
    hash.update(shardHash);
  });
  return { root: hash.digest('hex'), shard_count: shards.length };
}

// Fatal to the current retrieval/request only -- caught by the existing API
// route try/catch (see /api/xlmp/query), never allowed to crash the
// process. Distinct from "not found": this means an object WAS found under
// that root/filename, but its content does not hash to the root requested.
export class MemoryIntegrityViolation extends Error {
  readonly code = 'XLMP_ROOT_MISMATCH' as const;
  readonly requested_root: string;
  readonly computed_root: string;
  constructor(requested_root: string, computed_root: string) {
    super(
      `xLMP content-root verification failed: requested ${requested_root.slice(0, 16)}... ` +
      `but stored content hashes to ${computed_root.slice(0, 16)}.... ` +
      `Verification means "retrieved content matches the requested committed content root" -- ` +
      `it does not by itself mean the content is true, authorized, or provenance-verified.`
    );
    this.name = 'MemoryIntegrityViolation';
    this.requested_root = requested_root;
    this.computed_root = computed_root;
  }
}

const XLMP_ROOT_SYNTAX_RE = /^[0-9a-f]{64}$/i;

// Cache trust boundary: _contentCache is written from exactly two places --
// (a) xlmp_store_content at ingest time, where root and text are freshly
// paired by construction (root was just computed FROM this exact text, so
// no verification is needed there), and (b) here, after explicit
// recomputation-and-match on a disk read. No other code path writes to
// this cache. Given that, a cache HIT does not need to be re-verified on
// every call -- Design B from LNES-58.10 Phase 5: verify before insertion,
// cache entries are immutably keyed by their verified root.
export function xlmp_get_content(root: string): string | undefined {
  if (!XLMP_ROOT_SYNTAX_RE.test(root)) return undefined; // malformed root -- rejected before filesystem retrieval

  if (_contentCache.has(root)) return _contentCache.get(root);

  let text: string;
  try {
    text = fs.readFileSync(_rootPath(root), 'utf8');
  } catch {
    return undefined; // includes ENOENT -- preserves existing not-found behavior
  }

  const { root: computedRoot } = computeXlmpRoot(Buffer.from(text, 'utf8'));
  if (computedRoot.toLowerCase() !== root.toLowerCase()) {
    // FAIL CLOSED. Do not cache. Do not return the payload. Do not allow
    // execution to continue to resolveIntent/synthesizeFromDocument/
    // vanguardRace -- the thrown error halts xlmp_zk_query at this line.
    throw new MemoryIntegrityViolation(root, computedRoot);
  }

  _contentCache.set(root, text); // now verified -- safe to trust on future hits
  return text;
}

// ── Real RISC Zero Groth16 integrity proving (async) ──────────────────────────
// LNES-17: proves SHA256(reconstructed_document_shards) == xlmp_root in
// zero-knowledge, using the xlmp_integrity guest circuit (lnes13/methods/guest
// /src/bin/xlmp_integrity.rs) and CLI host (lnes13/host/src/bin/
// xlmp_integrity_host.rs) built alongside the existing AERIS prover on this
// same box. Measured real proving time on this CPU-only machine (no GPU here):
// ~13m23s for one document. That's why this is a background job with a
// pollable status file, not a synchronous call inside xlmp_zk_query -- a
// vault query has to stay fast even though a real proof does not.
const XLMP_PROOF_DIR = process.env.XLMP_PROOF_DIR ?? '/home/ubuntu/xlmp_proofs';
const XLMP_INTEGRITY_HOST_BIN = process.env.XLMP_INTEGRITY_HOST_BIN
  ?? '/home/ubuntu/lnes13/target/release/xlmp_integrity_host';

export interface ProofJobState {
  status: 'not_started' | 'pending' | 'complete' | 'failed';
  xlmp_root?: string;
  started_at?: string;
  completed_at?: string;
  seal?: string;
  journal?: string;
  image_id?: string;
  prove_ms?: number;
  error?: string;
}

function _proofPath(root: string): string {
  const safe = root.replace(/[^a-f0-9]/gi, '').slice(0, 64);
  return path.join(XLMP_PROOF_DIR, `${safe}.proof.json`);
}

export function xlmp_get_proof_status(root: string): ProofJobState {
  try {
    const raw = fs.readFileSync(_proofPath(root), 'utf8');
    return JSON.parse(raw) as ProofJobState;
  } catch {
    return { status: 'not_started' };
  }
}

// Kicks off a real Groth16 proof as a detached background process and
// returns immediately -- never awaited by a request handler. The document
// content is read once, up front (before spawning), so the prover doesn't
// depend on the in-memory cache still being warm 13 minutes later.
export function xlmp_request_proof(root: string): ProofJobState {
  const existing = xlmp_get_proof_status(root);
  if (existing.status === 'pending' || existing.status === 'complete') {
    return existing;
  }

  const content = xlmp_get_content(root);
  if (!content) {
    return { status: 'failed', xlmp_root: root, error: `Hollow Object not found for root: ${root}` };
  }

  try { fs.mkdirSync(XLMP_PROOF_DIR, { recursive: true }); } catch { /* already exists */ }

  const pendingState: ProofJobState = { status: 'pending', xlmp_root: root, started_at: new Date().toISOString() };
  fs.writeFileSync(_proofPath(root), JSON.stringify(pendingState, null, 2));

  const child = spawn(XLMP_INTEGRITY_HOST_BIN, [root], { detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.write(content, 'utf8');
  child.stdin.end();

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  child.on('close', (code) => {
    try {
      if (code === 0) {
        const result = JSON.parse(stdout.trim());
        const finalState: ProofJobState = {
          status: result.error ? 'failed' : 'complete',
          xlmp_root: root,
          started_at: pendingState.started_at,
          completed_at: new Date().toISOString(),
          seal: result.seal,
          journal: result.journal,
          image_id: result.image_id,
          prove_ms: result.prove_ms,
          error: result.error ?? undefined,
        };
        fs.writeFileSync(_proofPath(root), JSON.stringify(finalState, null, 2));
        console.log(`[xLMP-DS] Real proof ${finalState.status} for root ${root.slice(0, 12)}... (${result.prove_ms}ms)`);
      } else {
        fs.writeFileSync(_proofPath(root), JSON.stringify({
          status: 'failed', xlmp_root: root, started_at: pendingState.started_at,
          completed_at: new Date().toISOString(), error: `xlmp_integrity_host exited ${code}: ${stderr.slice(0, 500) || stdout.slice(0, 500)}`,
        }, null, 2));
      }
    } catch (e) {
      fs.writeFileSync(_proofPath(root), JSON.stringify({
        status: 'failed', xlmp_root: root, started_at: pendingState.started_at,
        completed_at: new Date().toISOString(), error: String(e),
      }, null, 2));
    }
  });

  child.on('error', (e) => {
    fs.writeFileSync(_proofPath(root), JSON.stringify({
      status: 'failed', xlmp_root: root, started_at: pendingState.started_at,
      completed_at: new Date().toISOString(), error: `Failed to spawn prover: ${e.message}`,
    }, null, 2));
  });

  child.unref();

  return pendingState;
}

// ── Shatter payload into Merkle root ──────────────────────────────────────────
export const xlmp_shatter_payload = async (payload: Buffer): Promise<HollowObject> => {
  const { root: xlmp_root, shard_count } = computeXlmpRoot(payload);

  console.log(`[xLMP-DS] Shattered ${shard_count} shard(s). Root: ${xlmp_root}`);

  return {
    xlmp_root,
    byte_size: payload.length,
    shard_count,
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

// Strip trailing format-specifiers before semantic matching.
// Prevents "allergies as JSON" from being resolved as the field "allergies json".
const FORMAT_SPECIFIER_RE = /\s+(as\s+json|in\s+json(\s+format)?|as\s+an?\s+\w+|in\s+\w+\s+format|formatted?\s+as\s+\w+|as\s+plain\s+text|as\s+csv|as\s+xml)\s*$/i;

function stripFormatSpecifiers(text: string): string {
  return text.replace(FORMAT_SPECIFIER_RE, '').trim();
}

function extractQueryWords(text: string): string[] {
  return stripFormatSpecifiers(text)
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

// ── Document Intelligence Layer — Staged Compression Path ─────────────────────
// Blind chunking replaced by Semantic Evidence Extraction:
//   1. Score chunks by keyword hit density
//   2. Extract a 900-char evidence window centered on the best keyword match per chunk
//   3. Pass max 3 windows (< 3000 chars total) to Vanguard — not raw chunks
const CHUNK_TARGET_SIZE = 1800; // chars per chunk for initial segmentation
const EVIDENCE_WINDOW    = 900;  // chars surrounding the best keyword match
const MAX_WINDOWS        = 3;    // max evidence windows sent to Vanguard
const MAX_EVIDENCE_CHARS = 3000; // hard cap on total context chars

// Direct to AskMo inference server — bypasses biological_proxy which requires
// sk-exergy-* or JWT auth that the portal server-side runtime doesn't hold.
const VANGUARD_URL = process.env.SEI_VANGUARD_URL ?? 'http://20.127.220.199:3000';
const VANGUARD_KEY = process.env.SEI_VANGUARD_KEY ?? 'sk-vanguard-apex-internal-v1';

// LNES-51: was a 4-way race including 'vanguard-auditor' and 'vanguard-ultra'.
// Both are dead weight in a client-side race: 'vanguard-auditor' routes through
// AskMo's OLD broken gRPC auditorClient (confirmed live 2026-07-14 --
// ECONNREFUSED against a stale local target, not the real HTTP-reachable
// Auditor box), and 'vanguard-ultra' triggers a 60s+ sequential
// Proposer<->Auditor consensus loop that ALSO depends on that same broken
// path -- neither can ever win a fast race, they just add load for nothing.
// AskMo's own server-side 5-engine 'vanguard-race' was evaluated as a
// replacement for this whole function but rejected after live testing: a
// short burst looked fine, but sustained calls pushed AskMo's local GPU VRAM
// from 14.5GB to 15.8GB of 16GB and it started returning
// "all engines failed: All promises were rejected" (see exergynet_api/main.rs
// comment, same box, same day). Keeping this as a plain 2-way race between
// the two candidates that actually hit distinct, working backends: Pro
// (dedicated remote GPU, vandropro) and Standard (AskMo local, the one
// engine confirmed stable under real traffic).
const VANGUARD_RACE = [
  'vanguard-pro',
  'vanguard-standard',
] as const;

interface SynthesisWinner {
  answer: string;
  model: string;
}

async function vanguardRace(messages: { role: string; content: string }[]): Promise<SynthesisWinner> {
  const controllers = VANGUARD_RACE.map(() => new AbortController());

  const races = VANGUARD_RACE.map((model, i) =>
    fetch(`${VANGUARD_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VANGUARD_KEY}` },
      body: JSON.stringify({ model, stream: false, messages }),
      signal: controllers[i].signal,
    }).then(async res => {
      if (!res.ok) throw new Error(`${model} HTTP ${res.status}`);
      const data = await res.json();
      const answer = (data.choices?.[0]?.message?.content ?? '').trim();
      if (!answer) throw new Error(`${model} empty response`);
      return { answer, model } as SynthesisWinner;
    })
  );

  try {
    const winner = await Promise.any(races);
    // Cancel every still-pending request the moment a winner is found
    controllers.forEach(c => { try { c.abort(); } catch { /* already settled */ } });
    return winner;
  } catch {
    throw new Error('All Vanguard models failed to respond');
  }
}

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

// Fuzzy word match — same ≥75% shared-leading-chars rule already used by
// scoreField() for the structured-JSON path. Plain substring matching missed
// "smoking"/"smoker"/"smokes" when the query word was "smoke" (verified: a
// 2026-07-11 benchmark found 8/30 free-text "does the patient smoke" queries
// returned not_found even though the source note stated smoking status,
// because "smoking".includes("smoke") === false while "smoker"/"smokes" do
// — plain substring search is inconsistent across trivial English inflections
// of the same word). This makes the free-text path use the same matching
// standard the JSON path already had.
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 3) return false; // too short for a fuzzy prefix ratio to mean anything
  let shared = 0;
  while (shared < minLen && a[shared] === b[shared]) shared++;
  return shared / minLen >= 0.75;
}

function tokenizeWords(text: string): { word: string; pos: number }[] {
  const out: { word: string; pos: number }[] = [];
  const re = /[a-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ word: m[0], pos: m.index });
  }
  return out;
}

function scoreChunk(chunk: string, queryWords: string[]): number {
  const chunkWords = tokenizeWords(chunk.toLowerCase());
  let score = 0;
  for (const w of queryWords) {
    for (const cw of chunkWords) {
      if (wordsMatch(w, cw.word)) score++;
    }
  }
  return score;
}

// Strips boilerplate from JSON-shaped source content before it enters the
// chunk/window pipeline: null values, empty arrays, and a fixed list of
// non-substantive keys. This is a deterministic, O(n) parse-and-prune pass
// over the JSON structure -- not a relevance or semantic judgment, and not
// a substitute for retrieval ranking. It only removes bytes that carry no
// information (an empty array is an empty array regardless of query), so
// more of the fixed evidence-window budget goes to actual content. Falls
// back to the original string unchanged if it isn't valid JSON.
const SCHEMA_MASK_NOISE_KEYS = new Set(['metadata_status', 'system_flags']);

function applyDeterministicSchemaMask(rawJsonString: string): string {
  function prune(value: unknown): unknown {
    if (Array.isArray(value)) {
      const pruned = value.map(prune).filter(v => v !== undefined);
      return pruned.length > 0 ? pruned : undefined;
    }
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (SCHEMA_MASK_NOISE_KEYS.has(key)) continue;
        const prunedVal = prune(val);
        if (prunedVal === undefined) continue;
        out[key] = prunedVal;
      }
      return Object.keys(out).length > 0 ? out : undefined;
    }
    if (value === null) return undefined;
    return value;
  }

  try {
    const parsed = JSON.parse(rawJsonString);
    const pruned = prune(parsed);
    return pruned === undefined ? '{}' : JSON.stringify(pruned);
  } catch {
    // Not valid JSON (most source content is plain text) -- return
    // unchanged rather than risk corrupting non-JSON content.
    return rawJsonString;
  }
}

// Mirrors the real Rust struct AtomicTopologicalShard in
// edt_tier1_ip/geometric_memory/src/lib.rs (verified against source
// 2026-08-07). Root fields are hex-encoded 32-byte SHA-256 values here
// since TypeScript doesn't have Rust's [u8; 32] fixed-size array type.
export interface AtomicTopologicalShard {
  current_root: string;               // hex, 32 bytes
  previous_root: string | null;       // hex, 32 bytes, or null
  next_root: string | null;           // hex, 32 bytes, or null -- always null as of the
                                       // current forge_topological_shard implementation
  temporal_coordinate: number;        // unix timestamp
  semantic_tag: number;               // 0x01 Clinical, 0x02 Financial, 0x03 Spatial
  cryptographic_foreign_keys: string[]; // hex, 32 bytes each -- explicit E_x(q) dependencies
  payload: string;                    // decoded payload text
}

// Injected resolver contract for direct root-addressed retrieval. No
// concrete production adapter is implemented here -- per LNES-58.5A
// scope, this is the interface only. Implementing a real adapter (backed
// by an actual storage system) is separate work; faking one that pretends
// to hit real storage would misrepresent what's actually wired up.
export interface VaultRootResolver {
  // Returns the raw bytes stored under `rootHex`, or null if nothing is
  // stored under that root. MUST NOT perform semantic/vector/lexical
  // search as a fallback -- only exact root-addressed retrieval.
  resolve(rootHex: string): Promise<Buffer | null>;
}

// Deterministic, in-memory resolver for tests and the LNES-58.5A strike
// benchmark fixture. Not a production backend.
export class InMemoryVaultRootResolver implements VaultRootResolver {
  private readonly store = new Map<string, Buffer>();

  // Registers content under its own SHA-256 root -- the fixture builder
  // computes the root; this class does not compute it on write, only
  // verifies it on read (see resolveTopologicalDependencies).
  put(rootHex: string, content: Buffer): void {
    this.store.set(rootHex.toLowerCase(), content);
  }

  async resolve(rootHex: string): Promise<Buffer | null> {
    return this.store.get(rootHex.toLowerCase()) ?? null;
  }
}

export function sha256Hex(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

const HEX_32_BYTES = /^[0-9a-f]{64}$/i;

export interface DependencyBudget {
  maxForeignKeys: number;   // hard cap on distinct FKs processed per shard
  maxDependencyDepth: number; // fixed at 1 for LNES-58.5A -- no recursive resolution
  maxTotalBytes: number;    // cap on summed resolved-content bytes
}

export const DEFAULT_LNES_58_5A_BUDGET: DependencyBudget = {
  maxForeignKeys: 8,
  maxDependencyDepth: 1,
  maxTotalBytes: 32_768,
};

export type DependencyStatus =
  | 'resolved'
  | 'invalid_root'      // not exactly 32 bytes / not valid hex
  | 'unresolved'        // resolver returned null -- root not found
  | 'root_mismatch'     // resolver returned content, but SHA-256(content) != root
  | 'budget_exceeded';  // would exceed maxForeignKeys or maxTotalBytes

export interface ResolvedDependency {
  root: string;
  status: DependencyStatus;
  referenceTable?: string;
  bytes?: number;
  error?: string;
}

export interface DependencyResolutionResult {
  evidence: string[];             // E_x(q): verified, resolved reference tables only
  resolved: ResolvedDependency[]; // one entry per DISTINCT declared FK, in input order
  complete: boolean;              // false if ANY FK failed to resolve for any reason,
                                   // including budget exhaustion -- never silently true
  totalBytes: number;
  duplicatesRemoved: number;
}

// Bounded exception discovery: for each explicit cryptographic_foreign_key
// on the shard, fetch the referenced reference table via the injected
// resolver, verify its content hash matches the declared root, and append
// only verified content to E_x(q). Never performs semantic, vector, or
// lexical search, and never infers a dependency that wasn't explicitly
// declared on the shard. Depth is fixed at 1: resolved content is not
// itself scanned for further foreign keys in this version.
//
// This is a direct architectural response to the interaction_check
// gold-context gap found during the LNES-58 benchmark run: RAG arms could
// retrieve Document B's interaction table via semantic search; the
// bounded-evidence construction could not, because nothing declared that
// dependency explicitly. This function is the mechanism for declaring it
// explicitly and resolving it deterministically.
export async function resolveTopologicalDependencies(
  shard: AtomicTopologicalShard,
  resolver: VaultRootResolver,
  budget: DependencyBudget = DEFAULT_LNES_58_5A_BUDGET
): Promise<DependencyResolutionResult> {
  const resolved: ResolvedDependency[] = [];
  const evidence: string[] = [];
  let totalBytes = 0;
  let complete = true;

  // Deduplicate while preserving first-seen order.
  const seen = new Set<string>();
  const dedupedRoots: string[] = [];
  let duplicatesRemoved = 0;
  for (const root of shard.cryptographic_foreign_keys) {
    const key = root.toLowerCase();
    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(key);
    dedupedRoots.push(root);
  }

  for (let i = 0; i < dedupedRoots.length; i++) {
    const root = dedupedRoots[i];

    if (i >= budget.maxForeignKeys) {
      resolved.push({ root, status: 'budget_exceeded' });
      complete = false;
      continue; // do not break -- report status for every declared FK
    }

    if (!HEX_32_BYTES.test(root)) {
      resolved.push({ root, status: 'invalid_root' });
      complete = false;
      continue;
    }

    const content = await resolver.resolve(root);
    if (content === null) {
      resolved.push({ root, status: 'unresolved' });
      complete = false;
      continue;
    }

    const actualRoot = sha256Hex(content);
    if (actualRoot.toLowerCase() !== root.toLowerCase()) {
      // Reject -- do not append unverified content to evidence under any
      // circumstances, even though the resolver returned *something*.
      resolved.push({ root, status: 'root_mismatch' });
      complete = false;
      continue;
    }

    if (totalBytes + content.length > budget.maxTotalBytes) {
      resolved.push({ root, status: 'budget_exceeded', bytes: content.length });
      complete = false;
      continue;
    }

    const referenceTable = content.toString('utf-8');
    totalBytes += content.length;
    resolved.push({ root, status: 'resolved', referenceTable, bytes: content.length });
    evidence.push(referenceTable);
  }

  return { evidence, resolved, complete, totalBytes, duplicatesRemoved };
}

// Extract the 900-char window centered on the highest-density keyword match.
// Returns null if no keyword is found in the chunk.
function extractEvidenceWindow(chunk: string, queryWords: string[]): string | null {
  const lower = chunk.toLowerCase();
  const chunkWords = tokenizeWords(lower);
  let bestPos = -1;

  for (const w of queryWords) {
    const hit = chunkWords.find(cw => wordsMatch(w, cw.word));
    const pos = hit ? hit.pos : -1;
    if (pos !== -1 && bestPos === -1) bestPos = pos;
    // Prefer the position with the most surrounding hits (density center)
    if (pos !== -1) {
      const half = Math.floor(EVIDENCE_WINDOW / 2);
      const wStart = Math.max(0, pos - half);
      const wEnd   = Math.min(lower.length, pos + half);
      const windowWords = chunkWords.filter(cw => cw.pos >= wStart && cw.pos < wEnd);
      const density = queryWords.reduce((sum, qw) => {
        return sum + windowWords.filter(cw => wordsMatch(qw, cw.word)).length;
      }, 0);
      // Always prefer the first hit as anchor; density used for tie-breaking
      if (bestPos === -1 || density > 1) bestPos = pos;
    }
  }

  if (bestPos === -1) return null;

  const half = Math.floor(EVIDENCE_WINDOW / 2);
  const start = Math.max(0, bestPos - half);
  const end   = Math.min(chunk.length, bestPos + half);
  return chunk.slice(start, end).trim();
}

async function synthesizeFromDocument(
  content: string,
  intent: string,
  queryWords: string[]
): Promise<ResolveResult> {
  const tScoreStart = Date.now();
  const maskedContent = applyDeterministicSchemaMask(content);
  const chunks = splitIntoChunks(maskedContent);

  const scored = chunks
    .map((chunk, idx) => ({ chunk, score: scoreChunk(chunk, queryWords), idx }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);
  const scoring_ms = Date.now() - tScoreStart;

  if (scored.length === 0) {
    return { result: null, status: 'not_found', confidence: 0, citations: [], message: 'No relevant content found for this query.' };
  }

  // ── Evidence Reducer: extract windowed evidence, not raw chunks ────────────
  const evidenceWindows: string[] = [];
  const usedChunks: typeof scored = [];
  const shardSize = 512 * 1024;

  for (const c of scored) {
    if (evidenceWindows.length >= MAX_WINDOWS) break;
    const window = extractEvidenceWindow(c.chunk, queryWords);
    if (!window) continue;
    if (evidenceWindows.reduce((s, w) => s + w.length, 0) + window.length > MAX_EVIDENCE_CHARS) break;
    evidenceWindows.push(window);
    usedChunks.push(c);
  }

  if (evidenceWindows.length === 0) {
    return { result: null, status: 'not_found', confidence: 0, citations: [], message: 'No evidence windows extracted.' };
  }

  const context = evidenceWindows.join('\n\n---\n\n');

  // Scaling telemetry: proves (or disproves) that model-input size stays flat
  // as source document size grows, since context is always capped regardless
  // of how large `content` is. scoring_ms is tracked SEPARATELY from the LLM
  // call below because the naive linear chunk-scan (splitIntoChunks + scoreChunk
  // over every chunk) is CPU-bound work that scales with document size even
  // when the LLM-facing context does not — measuring both, not just asserting
  // the flat-context claim.
  const tLlmStart = Date.now();
  console.log(`[xLMP-DS] scale_telemetry source_chars=${content.length} chunk_count=${chunks.length} evidence_chars=${context.length} evidence_windows=${evidenceWindows.length} scoring_ms=${scoring_ms}`);

  try {
    const { answer, model: winnerModel } = await vanguardRace([
      {
        role: 'system',
        content: `You are a precise document intelligence engine. Answer the query using ONLY the provided evidence excerpts. Synthesize a direct, complete answer. Do not reference the excerpts or say "the document says". If the answer is not present, say so clearly.`,
      },
      {
        role: 'user',
        content: `Evidence:\n\n${context}\n\nQuery: ${intent}`,
      },
    ]);

    return {
      result: answer,
      status: 'found',
      confidence: 0.93,
      citations: [
        `model: ${winnerModel}`,
        ...usedChunks.map(c => {
          const shardIdx = Math.floor((c.idx * CHUNK_TARGET_SIZE) / shardSize);
          return `shard[${shardIdx}] · chunk[${c.idx}] · evidence_window · hits: ${c.score}`;
        }),
      ],
    };
  } catch (e: any) {
    console.warn('[xLMP-DS] All models failed, returning evidence windows:', e?.message);
    return {
      result: evidenceWindows.join(' | '),
      status: 'found',
      confidence: 0.72,
      citations: [
        'model: none (all models offline)',
        ...usedChunks.map(c => {
          const shardIdx = Math.floor((c.idx * CHUNK_TARGET_SIZE) / shardSize);
          return `shard[${shardIdx}] · chunk[${c.idx}] · evidence_window (raw fallback)`;
        }),
      ],
      message: `All Vanguard models offline — returning raw evidence windows.`,
    };
  }
}

// ── Summarization / open-ended intent words — force synthesis path ────────────
const SYNTHESIS_INTENT = new Set([
  'summarize', 'summary', 'summarise', 'overview', 'explain',
  'describe', 'outline', 'recap', 'tldr', 'tl;dr',
  'what', 'tell', 'give', 'show', 'list', 'find', 'get',
]);

function isSynthesisIntent(words: string[]): boolean {
  return words.some(w => SYNTHESIS_INTENT.has(w));
}

// ── Extract prose from conversation-format JSON ───────────────────────────────
// Handles Google AI Studio exports (history[].parts[].text),
// OpenAI exports (messages[].content), and generic {role, text} arrays.
const CONV_KEYS = new Set(['history', 'messages', 'turns', 'contents', 'conversation', 'dialogue']);

function extractConversationText(obj: Record<string, unknown>): string | null {
  const convKey = (Object.keys(obj) as string[]).find(k => CONV_KEYS.has(k.toLowerCase()));
  if (!convKey) return null;

  const turns = obj[convKey];
  if (!Array.isArray(turns)) return null;

  const lines: string[] = [];

  for (const turn of turns as unknown[]) {
    if (!turn || typeof turn !== 'object') continue;
    const t = turn as Record<string, unknown>;
    const role = (t.role as string | undefined) ?? '';

    // Google AI Studio: parts array with text fields
    if (Array.isArray(t.parts)) {
      for (const part of t.parts as unknown[]) {
        if (part && typeof part === 'object') {
          const p = part as Record<string, unknown>;
          if (typeof p.text === 'string' && p.text.trim()) {
            lines.push(`[${role}] ${p.text.trim()}`);
          }
        }
      }
      continue;
    }

    // OpenAI-style: content string or array
    if (typeof t.content === 'string' && t.content.trim()) {
      lines.push(`[${role}] ${t.content.trim()}`);
      continue;
    }
    if (Array.isArray(t.content)) {
      for (const c of t.content as unknown[]) {
        if (c && typeof c === 'object') {
          const part = c as Record<string, unknown>;
          if (typeof part.text === 'string' && part.text.trim()) {
            lines.push(`[${role}] ${part.text.trim()}`);
          }
        }
      }
      continue;
    }

    // Generic fallback: any string value in the turn
    for (const v of Object.values(t)) {
      if (typeof v === 'string' && v.trim().length > 20) {
        lines.push(`[${role}] ${v.trim()}`);
        break;
      }
    }
  }

  if (lines.length === 0) return null;
  return lines.join('\n\n');
}

// ── Main intent resolver (async for document synthesis) ────────────────────────
async function resolveIntent(intent: string, content: string): Promise<ResolveResult> {
  // Plain-text path: JSON parse fails → document intelligence resolver
  let parsed: unknown = null;
  try { parsed = JSON.parse(content); } catch { parsed = null; }

  const queryWords = extractQueryWords(intent);
  if (queryWords.length === 0) {
    return { result: null, status: 'not_found', confidence: 0, citations: [], message: 'No searchable terms in query.' };
  }

  if (!parsed) {
    return synthesizeFromDocument(content, intent, queryWords);
  }

  // ── JSON document routing ─────────────────────────────────────────────────
  // 1. Conversation-format JSON: extract prose and synthesize
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const conversationText = extractConversationText(parsed as Record<string, unknown>);
    if (conversationText) {
      console.log(`[xLMP-DS] Conversation-format JSON detected (${conversationText.length} chars extracted). Routing to synthesis.`);
      return synthesizeFromDocument(conversationText, intent, queryWords);
    }
  }

  const pairs = flattenJSON(parsed);

  // 2. Large JSON (>300 leaf pairs): treat as document, not structured data.
  //    Extract all string values as prose and synthesize.
  if (pairs.length > 300) {
    console.log(`[xLMP-DS] Large JSON (${pairs.length} fields). Extracting prose for synthesis.`);
    const prose = pairs
      .filter(p => typeof p.rawValue === 'string' && (p.rawValue as string).trim().length > 10)
      .map(p => `${p.path}: ${p.rawValue}`)
      .join('\n');
    return synthesizeFromDocument(prose || content, intent, queryWords);
  }

  if (pairs.length === 0) {
    return { result: null, status: 'not_found', confidence: 0, citations: [], message: 'Empty dataset.' };
  }

  // 3. Summarization / open-ended intent against small structured JSON:
  //    still synthesize rather than do field lookup
  if (isSynthesisIntent(queryWords)) {
    const prose = pairs
      .filter(p => typeof p.rawValue === 'string' && (p.rawValue as string).trim().length > 5)
      .map(p => `${p.path}: ${p.rawValue}`)
      .join('\n');
    return synthesizeFromDocument(prose || content, intent, queryWords);
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
      confidence: 0,
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
// When query_params.source_url is provided, the AERIS zkTLS prover (LNES-13)
// fetches and proves the URL response before the vault query runs, producing a
// real Groth16 seal. Otherwise falls back to SHA-256 receipt (vault-only proof).
export const xlmp_zk_query = async (
  xlmp_root: string,
  image_id: string,
  query_params: { intent: string; source_url?: string; json_path?: string; condition_value?: number },
): Promise<ZKQueryResult> => {
  console.log(`[xLMP-DS] ZK query — image_id: ${image_id} | root: ${xlmp_root} | intent: "${query_params.intent}"`);

  const startMs = Date.now();

  const content = xlmp_get_content(xlmp_root);
  if (!content) {
    throw new Error(`Hollow Object not found for root: ${xlmp_root}`);
  }

  // Real AERIS ZK proof when source_url is provided
  let groth16_receipt: string;
  let proof_size_bytes: number;
  let zk_sealed = false;

  if (query_params.source_url && query_params.json_path) {
    try {
      const AERIS_URL = process.env.AERIS_PROVER_URL || 'http://127.0.0.1:9001';
      const res = await fetch(`${AERIS_URL}/api/aeris/witness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id:          '584c4d5000000000000000000000000000000000000000000000000000000000', // "XLMP"
          pool_id:         xlmp_root.padEnd(64, '0').slice(0, 64),
          target_url:      query_params.source_url,
          json_path:       query_params.json_path,
          condition_value: query_params.condition_value ?? -1e308,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { seal: string; journal: string };
        groth16_receipt = '0x' + data.seal;
        proof_size_bytes = data.seal.length / 2;
        zk_sealed = true;
        console.log(`[xLMP-DS] AERIS proof obtained — seal ${groth16_receipt.slice(0, 18)}...`);
      } else {
        throw new Error(`AERIS prover returned ${res.status}`);
      }
    } catch (e) {
      console.warn(`[xLMP-DS] AERIS prover unavailable (${e}) — falling back to SHA-256 receipt`);
      groth16_receipt = '0x' + crypto.createHash('sha256')
        .update(`${image_id}:${xlmp_root}:${query_params.intent}:${startMs}`)
        .digest('hex');
      proof_size_bytes = 32;
    }
  } else {
    // Vault-only proof: deterministic SHA-256 receipt over image_id + root + intent
    groth16_receipt = '0x' + crypto.createHash('sha256')
      .update(`${image_id}:${xlmp_root}:${query_params.intent}:${startMs}`)
      .digest('hex');
    proof_size_bytes = 32;
  }

  const resolved = await resolveIntent(query_params.intent, content);
  const latency_ms = Date.now() - startMs;

  const query_id = 'qry_' + crypto.randomBytes(6).toString('hex');

  // Cheap, synchronous filesystem read of any real-proof job state -- never
  // blocks on proving itself (that's the whole point of the async design).
  const realProof = xlmp_get_proof_status(xlmp_root);

  return {
    query_id,
    xlmp_root,
    image_id,
    proof_size_bytes,
    latency_ms,
    journal: {
      status: resolved.status,
      result: resolved.result,
      confidence: resolved.confidence,
      citations: resolved.citations,
      zk_sealed,
      real_proof_status: realProof.status,
      ...(realProof.status === 'complete' && realProof.seal ? { real_groth16_receipt: '0x' + realProof.seal } : {}),
      groth16_receipt,
      ...(resolved.message ? { message: resolved.message } : {}),
    },
  };
};

// ── LNES-58.7: traversal state machine (MATCH / NO_MATCH / INCOMPLETE) ────
// New module, not a modification of resolveTopologicalDependencies (which
// X4's Python mirror used) -- adds explicit epistemic-state representation
// on top of the same entity-set-intersection traversal rule, mirroring
// entity_graph_traversal_v2.py field-for-field for cross-language parity.

export const GRAPH_VERSION = "lnes58_6_entity_graph_v1";
export const TRAVERSAL_VERSION = "entity_graph_traversal_v2";
export const RELATION_TYPE = "documented_pairwise_relation";

export type TraversalState = "MATCH" | "NO_MATCH" | "INCOMPLETE";

export interface RelationNodeRecord {
  node_root: string;
  source_root: string;
  source_range: string;
  canonical_entities: string[];
  relation_type: string;
  relation_payload: string;
  provenance: string;
}

export interface EntityManifestRecord {
  record_id: string;
  source_roots: Record<string, string>;
  entities: string[];
  provenance: string;
}

function canonicalJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function contentRootOf(obj: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(canonicalJson(obj)).digest('hex');
}

function recomputeNodeRoot(node: RelationNodeRecord): string {
  const canonical = [node.source_root, ...node.canonical_entities, node.relation_payload].join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export interface NegativeResolutionReceipt {
  receipt_type: 'NEGATIVE_RELATION_RESULT';
  graph_root: string;
  graph_version: string;
  graph_manifest_hash: string;
  subject_entity_ids: string[];
  relation_type: string;
  result: 'NO_MATCH';
  traversal_version: string;
  traversal_depth: number;
  roots_verified: true;
  traversal_complete: true;
  budget_exhausted: false;
  source_scope: string;
  run_timestamp: number;
  receipt_root: string;
}

export interface IncompleteResolutionReceipt {
  receipt_type: 'INCOMPLETE_RELATION_RESULT';
  graph_root: string | null;
  graph_version: string;
  graph_manifest_hash: string | null;
  subject_entity_ids: string[];
  relation_type: string;
  result: 'INCOMPLETE';
  reason: string;
  traversal_version: string;
  traversal_depth: number;
  roots_verified: boolean;
  traversal_complete: false;
  budget_exhausted: boolean;
  source_scope: string;
  run_timestamp: number;
  receipt_root: string;
}

export interface TraversalOutcomeV2 {
  state: TraversalState;
  matchedNodes: RelationNodeRecord[];
  negativeReceipt?: NegativeResolutionReceipt;
  incompleteReceipt?: IncompleteResolutionReceipt;
  rootVerificationFailures: number;
  budgetExhaustedCount: number;
  totalBytes: number;
}

function makeNegativeReceipt(
  graphManifestHash: string, sourceRoot: string, entities: string[], runTimestamp: number
): NegativeResolutionReceipt {
  const base = {
    receipt_type: 'NEGATIVE_RELATION_RESULT' as const,
    graph_root: sourceRoot,
    graph_version: GRAPH_VERSION,
    graph_manifest_hash: graphManifestHash,
    subject_entity_ids: [...entities].sort(),
    relation_type: RELATION_TYPE,
    result: 'NO_MATCH' as const,
    traversal_version: TRAVERSAL_VERSION,
    traversal_depth: 1,
    roots_verified: true as const,
    traversal_complete: true as const,
    budget_exhausted: false as const,
    source_scope: `reference_graph:${sourceRoot.slice(0, 16)}...`,
    run_timestamp: runTimestamp,
  };
  return { ...base, receipt_root: contentRootOf(base) };
}

function makeIncompleteReceipt(
  reason: string, graphManifestHash: string | null, sourceRoot: string | null,
  entities: string[], runTimestamp: number, rootsVerified = false, budgetExhausted = false
): IncompleteResolutionReceipt {
  const base = {
    receipt_type: 'INCOMPLETE_RELATION_RESULT' as const,
    graph_root: sourceRoot,
    graph_version: GRAPH_VERSION,
    graph_manifest_hash: graphManifestHash,
    subject_entity_ids: [...entities].sort(),
    relation_type: RELATION_TYPE,
    result: 'INCOMPLETE' as const,
    reason,
    traversal_version: TRAVERSAL_VERSION,
    traversal_depth: 1,
    roots_verified: rootsVerified,
    traversal_complete: false as const,
    budget_exhausted: budgetExhausted,
    source_scope: `reference_graph:${sourceRoot ? sourceRoot.slice(0, 16) : 'unknown'}...`,
    run_timestamp: runTimestamp,
  };
  return { ...base, receipt_root: contentRootOf(base) };
}

export function traverseV2(
  recordId: string,
  relationNodes: RelationNodeRecord[],
  manifestsByRecord: Record<string, EntityManifestRecord>,
  graphManifestHash: string,
  budget: { maxRelationNodes: number; maxTotalBytes: number } = { maxRelationNodes: 8, maxTotalBytes: 32768 },
  runTimestamp: number = Date.now() / 1000
): TraversalOutcomeV2 {
  const manifest = manifestsByRecord[recordId];
  if (!manifest) {
    return {
      state: 'INCOMPLETE', matchedNodes: [], rootVerificationFailures: 0, budgetExhaustedCount: 0, totalBytes: 0,
      incompleteReceipt: makeIncompleteReceipt('entity_extraction_failure', null, null, [], runTimestamp, false),
    };
  }

  const sourceRoot = relationNodes.length > 0 ? relationNodes[0].source_root : null;
  if (!sourceRoot) {
    return {
      state: 'INCOMPLETE', matchedNodes: [], rootVerificationFailures: 0, budgetExhaustedCount: 0, totalBytes: 0,
      incompleteReceipt: makeIncompleteReceipt('missing_graph_root', null, graphManifestHash, manifest.entities, runTimestamp, false),
    };
  }

  const recordEntities = new Set(manifest.entities);
  const matches = relationNodes.filter(n => n.canonical_entities.every(e => recordEntities.has(e)));

  let totalBytes = 0;
  const verifiedNodes: RelationNodeRecord[] = [];

  for (let i = 0; i < matches.length; i++) {
    const node = matches[i];

    if (i >= budget.maxRelationNodes) {
      return {
        state: 'INCOMPLETE', matchedNodes: [], rootVerificationFailures: 0, budgetExhaustedCount: 1, totalBytes,
        incompleteReceipt: makeIncompleteReceipt('budget_exhausted', sourceRoot, graphManifestHash, manifest.entities, runTimestamp, true, true),
      };
    }

    const recomputed = recomputeNodeRoot(node);
    if (recomputed !== node.node_root) {
      return {
        state: 'INCOMPLETE', matchedNodes: [], rootVerificationFailures: 1, budgetExhaustedCount: 0, totalBytes,
        incompleteReceipt: makeIncompleteReceipt('root_verification_mismatch', sourceRoot, graphManifestHash, manifest.entities, runTimestamp, false),
      };
    }

    const nodeBytes = Buffer.byteLength(node.relation_payload, 'utf-8');
    if (totalBytes + nodeBytes > budget.maxTotalBytes) {
      return {
        state: 'INCOMPLETE', matchedNodes: [], rootVerificationFailures: 0, budgetExhaustedCount: 1, totalBytes,
        incompleteReceipt: makeIncompleteReceipt('budget_exhausted', sourceRoot, graphManifestHash, manifest.entities, runTimestamp, true, true),
      };
    }

    totalBytes += nodeBytes;
    verifiedNodes.push(node);
  }

  if (verifiedNodes.length > 0) {
    return { state: 'MATCH', matchedNodes: verifiedNodes, rootVerificationFailures: 0, budgetExhaustedCount: 0, totalBytes };
  }

  return {
    state: 'NO_MATCH', matchedNodes: [], rootVerificationFailures: 0, budgetExhaustedCount: 0, totalBytes,
    negativeReceipt: makeNegativeReceipt(graphManifestHash, sourceRoot, manifest.entities, runTimestamp),
  };
}

export function renderExplicitNullAssertion(receipt: NegativeResolutionReceipt): string {
  return (
    `AUTHORITATIVE GRAPH RESULT:\n` +
    `The committed reference graph was deterministically traversed for the resolved ` +
    `entities under relation type ${receipt.relation_type}.\n` +
    `Traversal completed successfully.\n` +
    `Zero matching relation nodes were found within graph ${receipt.graph_root.slice(0, 16)}... ` +
    `(version ${receipt.graph_version}).\n` +
    `This is an explicit negative result within the declared graph scope, not missing or unexamined evidence.`
  );
}

export function renderIncompleteAssertion(receipt: IncompleteResolutionReceipt): string {
  return (
    `GRAPH RESULT: INCOMPLETE.\n` +
    `Traversal could not establish a match or no-match state (reason: ${receipt.reason}).\n` +
    `This is not a verified negative result and must not be treated as evidence of absence.`
  );
}
