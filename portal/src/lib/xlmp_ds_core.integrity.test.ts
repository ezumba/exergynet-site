// LNES-58.10 root-verification tests. Dedicated storage-integrity fixtures
// -- no frozen benchmark artifacts touched. Uses the REAL xlmp_ds_core.ts
// module (ingest and retrieval share one algorithm via computeXlmpRoot),
// with XLMP_DATA_DIR pointed at a scratch temp directory via env var so
// no production filesystem access is needed or attempted.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// NOTE: static `import` statements are hoisted above all other code in
// ESM, so setting process.env.XLMP_DATA_DIR before a static import of
// xlmp_ds_core.ts would NOT actually run first -- the module-level
// `XLMP_DATA_DIR = process.env.XLMP_DATA_DIR ?? ...` would already have
// evaluated. Using a dynamic import() (not hoisted) after setting the env
// var, so the real module genuinely reads the scratch directory and no
// production filesystem path is touched.
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlmp-integrity-test-'));
process.env.XLMP_DATA_DIR = scratchDir;

const {
  xlmp_shatter_payload,
  xlmp_store_content,
  xlmp_get_content,
  computeXlmpRoot,
  MemoryIntegrityViolation,
} = await import('./xlmp_ds_core.ts');

after(() => {
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

async function ingest(text: string): Promise<string> {
  const hollow = await xlmp_shatter_payload(Buffer.from(text, 'utf8'));
  xlmp_store_content(hollow.xlmp_root, text);
  return hollow.xlmp_root;
}

// ── Phase 6: backward compatibility ─────────────────────────────────────────

test('Phase 6: single-shard object round-trips and verifies', async () => {
  const root = await ingest('small legitimate xLMP object');
  const retrieved = xlmp_get_content(root);
  assert.equal(retrieved, 'small legitimate xLMP object');
});

test('Phase 6: multi-shard object (>512KiB) round-trips and verifies', async () => {
  const big = 'x'.repeat(1024 * 512 * 3 + 777); // 3 full shards + partial
  const root = await ingest(big);
  const retrieved = xlmp_get_content(root);
  assert.equal(retrieved, big);
});

test('Phase 6: recomputed root exactly matches ingest-computed root for multiple objects', async () => {
  const samples = ['alpha', 'a longer piece of prose about clinical trial protocols', '{"json":"conversation-shaped content"}', 'x'.repeat(1_500_000)];
  for (const text of samples) {
    const hollow = await xlmp_shatter_payload(Buffer.from(text, 'utf8'));
    const recomputed = computeXlmpRoot(Buffer.from(text, 'utf8'));
    assert.equal(recomputed.root, hollow.xlmp_root, `mismatch for sample of length ${text.length}`);
    assert.equal(recomputed.shard_count, hollow.shard_count);
  }
});

// ── Phase 7: adversarial integrity tests ────────────────────────────────────

test('1. valid root + valid payload -> PASS', async () => {
  const root = await ingest('adversarial test case 1');
  assert.equal(xlmp_get_content(root), 'adversarial test case 1');
});

// NOTE on tests 2/3/9: xlmp_store_content() writes to BOTH disk and the
// in-memory cache at ingest time. Tampering a file AFTER calling ingest()
// (which uses xlmp_store_content) in the SAME process would be caught by
// the already-warm cache and never reach disk at all -- correct Design B
// behavior, not a bypass, but the wrong way to test "attacker corrupts a
// file directly on disk, bypassing the ingest API." These tests place
// tampered bytes at a computed-but-never-cached root via raw fs writes,
// so xlmp_get_content's first read for that root is a genuine cache miss.

test('2. valid filename/root + one-byte payload modification -> MemoryIntegrityViolation', () => {
  const original = 'adversarial test case 2 original';
  const legitRoot = computeXlmpRoot(Buffer.from(original, 'utf8')).root;
  const filePath = path.join(scratchDir, `${legitRoot}.xlmp`);
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.writeFileSync(filePath, 'adversarial test case 2 TAMPERED', 'utf8'); // written directly, cache never touched
  assert.throws(() => xlmp_get_content(legitRoot), MemoryIntegrityViolation);
});

test('3. root A requesting content physically copied from object B -> MemoryIntegrityViolation', () => {
  const contentA = 'object A content, never cached';
  const contentB = 'object B content, completely different, never cached';
  const rootA = computeXlmpRoot(Buffer.from(contentA, 'utf8')).root;
  fs.writeFileSync(path.join(scratchDir, `${rootA}.xlmp`), contentB, 'utf8'); // A's filename, B's bytes
  assert.throws(() => xlmp_get_content(rootA), MemoryIntegrityViolation);
});

test('4. malformed root -> rejected before filesystem retrieval (returns undefined, not thrown)', () => {
  assert.equal(xlmp_get_content('not-a-valid-root'), undefined);
  assert.equal(xlmp_get_content('ab'.repeat(16)), undefined); // 32 hex chars, wrong length
  assert.equal(xlmp_get_content(''), undefined);
});

test('5. missing object -> existing not-found behavior, distinct from integrity failure', () => {
  const neverStored = computeXlmpRoot(Buffer.from('never actually stored', 'utf8')).root;
  const result = xlmp_get_content(neverStored);
  assert.equal(result, undefined); // not-found: returns undefined, does NOT throw
});

test('6. tampered cached value must not be returned as trusted content', async () => {
  const root = await ingest('cache trust test -- original content');
  // Prime the cache via a normal, verified read.
  assert.equal(xlmp_get_content(root), 'cache trust test -- original content');
  // Now tamper the underlying file. Per the documented trust boundary, the
  // cache entry (inserted only after verification) is what's trusted for
  // subsequent hits -- verifying that a POST-cache disk tamper does NOT
  // retroactively corrupt what's already been verified and cached is the
  // correct behavior for Design B, and is checked explicitly here so the
  // trust boundary is enforced by a test, not just a comment.
  const filePath = path.join(scratchDir, `${root}.xlmp`);
  fs.writeFileSync(filePath, 'tampered after caching', 'utf8');
  assert.equal(xlmp_get_content(root), 'cache trust test -- original content',
    'cached (already-verified) value must still be served; this documents the Design B trust boundary explicitly');
});

test('7. canonicalization-sensitive content -- recomputation matches ingest exactly', async () => {
  const unicodeText = 'clinical note with unicode: café, 日本語, emoji 🩺, and\ttabs\nand newlines';
  const root = await ingest(unicodeText);
  const retrieved = xlmp_get_content(root);
  assert.equal(retrieved, unicodeText);
  const recomputed = computeXlmpRoot(Buffer.from(retrieved!, 'utf8'));
  assert.equal(recomputed.root, root);
});

test('8. multi-shard object -- reconstruction succeeds', async () => {
  const shardSize = 1024 * 512;
  const exactlyTwoShards = 'y'.repeat(shardSize * 2);
  const root = await ingest(exactlyTwoShards);
  const hollow = await xlmp_shatter_payload(Buffer.from(exactlyTwoShards, 'utf8'));
  assert.equal(hollow.shard_count, 2);
  assert.equal(xlmp_get_content(root), exactlyTwoShards);
});

test('9. one modified shard in multi-shard object -> root mismatch', () => {
  const shardSize = 1024 * 512;
  const original = 'a'.repeat(shardSize) + 'b'.repeat(shardSize) + 'c'.repeat(1000);
  const legitRoot = computeXlmpRoot(Buffer.from(original, 'utf8')).root;
  // Modify one byte inside the second shard only, written directly (never cached).
  const tampered = 'a'.repeat(shardSize) + 'B' + 'b'.repeat(shardSize - 1) + 'c'.repeat(1000);
  fs.writeFileSync(path.join(scratchDir, `${legitRoot}.xlmp`), tampered, 'utf8');
  assert.throws(() => xlmp_get_content(legitRoot), MemoryIntegrityViolation);
});

test('10. empty payload -- behavior matches ingest semantics', async () => {
  const hollow = await xlmp_shatter_payload(Buffer.from('', 'utf8'));
  assert.equal(hollow.shard_count, 0);
  xlmp_store_content(hollow.xlmp_root, '');
  assert.equal(xlmp_get_content(hollow.xlmp_root), '');
});
