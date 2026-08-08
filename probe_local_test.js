// Local validation for verify_production_roots.js (LNES-58.11).
// Run: node probe_local_test.js
// Proves: (1) the probe's computeXlmpRoot is byte-identical to the real
// production implementation in xlmp_ds_core.ts across single-shard,
// multi-shard, and unicode fixtures; (2) eligibility filtering rejects
// non-convention filenames; (3) sample selection is deterministic; (4) the
// full main() run against a synthetic fixture directory (with one
// deliberately tampered object) emits zero payload content and correctly
// reports PASS/FAIL/eligible counts.

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const probe = require('./verify_production_roots.js');

async function main() {
  // ── 1. Equivalence against the REAL production computeXlmpRoot ───────────
  // Relative to this file's own location so this works from any clone/path,
  // not just this machine.
  const prodCorePath = path.join(__dirname, 'portal', 'src', 'lib', 'xlmp_ds_core.ts');
  const prodUrl = 'file:///' + prodCorePath.replace(/\\/g, '/');
  const { computeXlmpRoot: realComputeXlmpRoot } = await import(prodUrl);

  const fixtures = [
    Buffer.from('', 'utf8'),
    Buffer.from('small legitimate object', 'utf8'),
    Buffer.from('x'.repeat(1024 * 512), 'utf8'), // exactly one shard
    Buffer.from('y'.repeat(1024 * 512 + 1), 'utf8'), // one shard + 1 byte
    Buffer.from('z'.repeat(1024 * 512 * 3 + 777), 'utf8'), // 3 shards + partial
    Buffer.from('unicode: café, 日本語, emoji 🩺, tabs\tand\nnewlines', 'utf8'),
  ];
  for (const payload of fixtures) {
    const real = realComputeXlmpRoot(payload);
    const mine = probe.computeXlmpRoot(payload);
    assert.equal(mine.root, real.root, `root mismatch for payload length ${payload.length}`);
    assert.equal(mine.shard_count, real.shard_count, `shard_count mismatch for payload length ${payload.length}`);
  }
  console.log('[1/5] PASS -- probe computeXlmpRoot byte-identical to production computeXlmpRoot across 6 fixtures (empty, small, exactly-1-shard, 1-shard+1B, multi-shard, unicode)');

  // ── 2. Eligibility filtering ─────────────────────────────────────────────
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'xlmp-probe-fixture-'));
  const validRoot1 = probe.computeXlmpRoot(Buffer.from('object A', 'utf8')).root;
  const validRoot2 = probe.computeXlmpRoot(Buffer.from('object B, a bit longer', 'utf8')).root;
  fs.writeFileSync(path.join(scratch, `${validRoot1}.xlmp`), 'object A', 'utf8');
  fs.writeFileSync(path.join(scratch, `${validRoot2}.xlmp`), 'object B, a bit longer', 'utf8');
  fs.writeFileSync(path.join(scratch, '_ownership_index.jsonl'), '{"owner":"x"}\n', 'utf8'); // must be rejected
  fs.writeFileSync(path.join(scratch, 'not-a-root.xlmp'), 'garbage', 'utf8'); // must be rejected
  fs.writeFileSync(path.join(scratch, `${validRoot1}.txt`), 'wrong extension', 'utf8'); // must be rejected
  const dirLikeRoot = probe.computeXlmpRoot(Buffer.from('object C, would-be directory', 'utf8')).root;
  fs.mkdirSync(path.join(scratch, `${dirLikeRoot}.xlmp`)); // directory, not file -- must be rejected despite matching name pattern

  const { eligible, skippedMalformed } = probe.listEligibleObjects(scratch);
  assert.equal(eligible.length, 2, 'both genuine <root>.xlmp FILEs should be eligible; the directory with a matching name must not be');
  assert.deepEqual(eligible.map(e => e.expectedRoot).sort(), [validRoot1, validRoot2].sort());
  assert.equal(skippedMalformed, 3, '_ownership_index.jsonl, not-a-root.xlmp, and the wrong-extension file should all be rejected (the directory is excluded via isFile(), not counted as malformed)');
  console.log('[2/5] PASS -- eligibility filter accepts only genuine <64-hex-root>.xlmp files, rejects index file / malformed names / wrong extension / directories');

  // ── 3. Deterministic, spanning sample selection (LNES-58 Status Review Phase L) ──
  // Regresses the specific bug found in the real LNES-58.11C run: at N=72,
  // maxSample=50, the old floor(N/maxSample)=1 stride degenerated to "first
  // 50 sorted objects only" -- never touching the last 22. The fix must span
  // the full population (include first AND last index), never duplicate an
  // index, and return exactly min(maxSample, N) objects.
  function makeEligible(n) {
    return Array.from({ length: n }, (_, i) => ({ filename: `${i.toString(16).padStart(64, '0')}.xlmp`, expectedRoot: i.toString(16).padStart(64, '0') }));
  }
  for (const n of [1, 10, 49, 50, 51, 72, 99, 100, 137]) {
    const eligible = makeEligible(n);
    const maxSample = 50;
    const k = Math.min(maxSample, n);
    const sel = probe.selectSample(eligible, scratch, maxSample);
    assert.equal(sel.sample.length, k, `N=${n}: expected exactly min(${maxSample},${n})=${k} objects, got ${sel.sample.length}`);
    const filenames = sel.sample.map(s => s.filename);
    assert.equal(new Set(filenames).size, filenames.length, `N=${n}: no duplicate objects in sample`);
    if (k > 1) {
      assert.equal(sel.sample[0].filename, eligible[0].filename, `N=${n}: sample must include the first sorted object`);
      assert.equal(sel.sample[sel.sample.length - 1].filename, eligible[n - 1].filename, `N=${n}: sample must include the last sorted object`);
    }
    // Determinism: repeated calls on the same input produce the same sample.
    const sel2 = probe.selectSample(eligible, scratch, maxSample);
    assert.deepEqual(filenames, sel2.sample.map(s => s.filename), `N=${n}: selection must be deterministic across repeated calls (no RNG)`);
  }
  // The specific regression case: N=72 must NOT collapse to "first 50" anymore.
  const seventyTwo = makeEligible(72);
  const sel72 = probe.selectSample(seventyTwo, scratch, 50);
  const indices72 = sel72.sample.map(s => parseInt(s.expectedRoot, 16));
  assert.ok(Math.max(...indices72) >= 60, `N=72 regression: sample must reach well past index 49 (old bug capped at 49), got max index ${Math.max(...indices72)}`);
  console.log('[3/5] PASS -- sample selection deterministic, spans full population (first+last always included, no duplicates) across N=1,10,49,50,51,72,99,100,137; N=72 regression confirmed fixed');

  // ── 4. Full main() run: PASS/FAIL classification + zero content leakage ──
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlmp-probe-run-'));
  const okRoot = probe.computeXlmpRoot(Buffer.from('SENTINEL_SHOULD_NEVER_APPEAR_IN_OUTPUT_ok', 'utf8')).root;
  fs.writeFileSync(path.join(runDir, `${okRoot}.xlmp`), 'SENTINEL_SHOULD_NEVER_APPEAR_IN_OUTPUT_ok', 'utf8');
  // Tampered object: filename claims one root, bytes hash to a different one.
  const claimedRoot = probe.computeXlmpRoot(Buffer.from('SENTINEL_SHOULD_NEVER_APPEAR_IN_OUTPUT_original', 'utf8')).root;
  fs.writeFileSync(path.join(runDir, `${claimedRoot}.xlmp`), 'SENTINEL_SHOULD_NEVER_APPEAR_IN_OUTPUT_TAMPERED', 'utf8');
  // Multi-shard object.
  const bigText = 'SENTINEL_SHOULD_NEVER_APPEAR_IN_OUTPUT_big' + 'q'.repeat(1024 * 512 * 2);
  const bigRoot = probe.computeXlmpRoot(Buffer.from(bigText, 'utf8')).root;
  fs.writeFileSync(path.join(runDir, `${bigRoot}.xlmp`), bigText, 'utf8');
  fs.writeFileSync(path.join(runDir, '_ownership_index.jsonl'), '{"owner":"SENTINEL_SHOULD_NEVER_APPEAR_IN_OUTPUT"}\n', 'utf8');

  const out = execFileSync(process.execPath, [path.join(__dirname, 'verify_production_roots.js')], {
    env: { ...process.env, XLMP_DATA_DIR: runDir },
    encoding: 'utf8',
  });

  assert.ok(!out.includes('SENTINEL_SHOULD_NEVER_APPEAR_IN_OUTPUT'), 'no payload content of any kind may appear in stdout');
  assert.ok(out.includes('eligible_object_count=3'), 'expected 3 eligible objects (ownership index excluded)');
  assert.ok(out.includes('PASS=2'));
  assert.ok(out.includes('FAIL=1'));
  assert.ok(out.includes('MULTI_SHARD_TESTED=1'));
  assert.ok(out.includes('PRODUCTION_ROOT_COMPATIBILITY_FAILURE'), 'must classify as compatibility failure when any FAIL is present, matching Phase 7/8 spec');
  console.log('[4/5] PASS -- full run against synthetic fixtures: correct PASS/FAIL/eligible counts, zero content in stdout, correct failure classification');

  // ── 5. Malformed expected root / non-.xlmp files never reach root compare ─
  const { eligible: eligibleFromRunDir } = probe.listEligibleObjects(runDir);
  assert.ok(eligibleFromRunDir.every(o => /^[0-9a-f]{64}$/.test(o.expectedRoot)));
  console.log('[5/5] PASS -- all eligible expectedRoot values are well-formed 64-hex before any comparison is attempted');

  fs.rmSync(scratch, { recursive: true, force: true });
  fs.rmSync(runDir, { recursive: true, force: true });

  console.log('\nALL LOCAL VALIDATION TESTS PASSED');
}

main().catch(e => { console.error('LOCAL VALIDATION FAILED:', e); process.exit(1); });
