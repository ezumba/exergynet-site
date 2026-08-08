#!/usr/bin/env node
'use strict';
// LNES-58.11 -- Production Root Compatibility Strike
//
// READ-ONLY. Zero content exfiltration. Zero dependencies (fs/path/crypto
// only, so it runs on a bare production Node install with no npm install
// step). Reuses the exact production root algorithm from
// portal/src/lib/xlmp_ds_core.ts computeXlmpRoot (verified byte-for-byte
// equivalent -- see verify_production_roots.equivalence.test.js).
//
// This script does not write, rename, delete, or migrate anything. It only
// opens objects with fs.readFileSync and prints cryptographic/structural
// telemetry (root hex, byte count, shard count, pass/fail).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const XLMP_DATA_DIR = process.env.XLMP_DATA_DIR || '/home/ubuntu/xlmp_data';
const MAX_SAMPLE = 50;
const SHARD_SIZE = 1024 * 512;

// ── Root algorithm -- identical to production computeXlmpRoot ──────────────
// (xlmp_ds_core.ts:140-152). Sequential hash chain over fixed-size shard
// digests, NOT a Merkle tree: no pairwise combination, no odd-leaf case,
// full recomputation required to verify.
function computeXlmpRoot(payload) {
  const shards = [];
  for (let i = 0; i < payload.length; i += SHARD_SIZE) {
    shards.push(payload.subarray(i, i + SHARD_SIZE));
  }
  const hash = crypto.createHash('sha256');
  for (const shard of shards) {
    const shardHash = crypto.createHash('sha256').update(shard).digest('hex');
    hash.update(shardHash);
  }
  return { root: hash.digest('hex'), shard_count: shards.length };
}

// ── Eligibility -- exact production storage convention only ────────────────
// _rootPath (xlmp_ds_core.ts:50-54) writes objects as <64-hex-root>.xlmp
// directly under XLMP_DATA_DIR. Anything else (e.g. _ownership_index.jsonl,
// stray files) is not an xLMP content object under that convention and is
// excluded, not guessed at.
const OBJECT_NAME_RE = /^([0-9a-f]{64})\.xlmp$/;

function listEligibleObjects(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return { eligible: [], skippedMalformed: 0, dirError: String(e && e.code || e) };
  }
  const eligible = [];
  let skippedMalformed = 0;
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const m = OBJECT_NAME_RE.exec(ent.name);
    if (!m) { skippedMalformed++; continue; }
    eligible.push({ filename: ent.name, expectedRoot: m[1] });
  }
  return { eligible, skippedMalformed, dirError: null };
}

// ── Deterministic sample selection ──────────────────────────────────────────
// No RNG, no seed needed: sort by filename (== content root, so this is a
// stable, content-derived order) ascending, then take an evenly-spaced
// evenly-spaced indices across the full eligible set so the sample spans it
// rather than clustering at one end.
//
// LNES-58 Status Review Phase L fix: the original implementation used
// stride = floor(N/maxSample), which degenerates to "first maxSample sorted
// objects" for any N in (maxSample, 2*maxSample) -- e.g. at N=72, maxSample=50,
// floor(72/50)=1, so it silently selected indices 0..49 only, never touching
// the last 22 objects. Confirmed in the LNES-58.11C production run (N=72).
// Replaced with evenly-spaced index_i = round(i*(N-1)/(K-1)), K=min(maxSample,N),
// which always includes index 0 and index N-1 (spans the full population) and
// is provably duplicate-free for K<=N, K>1: consecutive real-valued indices
// differ by (N-1)/(K-1) >= 1, so rounding cannot collide them.
function selectSample(eligible, dataDir, maxSample) {
  const sorted = eligible.slice().sort((a, b) => a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0);
  const n = sorted.length;
  const k = Math.min(maxSample, n);
  if (k === 0) return { sample: [], method: `no eligible objects (N=0)` };
  if (k === n) return { sample: sorted, method: `all ${n} eligible objects (<= ${maxSample} cap)` };
  const indices = [];
  const seen = new Set();
  for (let i = 0; i < k; i++) {
    const idx = k === 1 ? 0 : Math.round(i * (n - 1) / (k - 1));
    if (!seen.has(idx)) { seen.add(idx); indices.push(idx); }
  }
  const sample = indices.map(idx => sorted[idx]);
  return {
    sample,
    method: `deterministic evenly-spaced sample: eligible objects sorted by filename (content root) ascending, N=${n}, K=${k}, index_i=round(i*(N-1)/(K-1)) for i=0..K-1 -- spans full population, always includes first and last`,
  };
}

function main() {
  console.log(`XLMP_DATA_DIR=${XLMP_DATA_DIR}`);

  const { eligible, skippedMalformed, dirError } = listEligibleObjects(XLMP_DATA_DIR);
  if (dirError) {
    console.log(`DIR_READ_ERROR=${dirError}`);
    console.log('STOP: could not enumerate XLMP_DATA_DIR safely.');
    process.exit(1);
  }

  console.log(`eligible_object_count=${eligible.length}`);
  console.log(`skipped_malformed_count=${skippedMalformed}`);

  const { sample, method } = selectSample(eligible, XLMP_DATA_DIR, MAX_SAMPLE);
  console.log(`sample_selection_method=${method}`);
  console.log('');

  const headers = ['EXPECTED_ROOT', 'COMPUTED_ROOT', 'BYTES', 'SHARDS', 'STATUS'];
  console.log(headers.join('\t'));
  console.log(headers.map(h => '-'.repeat(h.length)).join('\t'));

  let pass = 0, fail = 0, skipped = 0, multiShardTested = 0;

  for (const obj of sample) {
    const filePath = path.join(XLMP_DATA_DIR, obj.filename);
    let payload;
    try {
      payload = fs.readFileSync(filePath); // raw bytes -- production reads 'utf8' then re-encodes to Buffer('utf8') in computeXlmpRoot, which is byte-identical for valid UTF-8 content; reading raw bytes here avoids any risk of transcoding a malformed-UTF-8 file into different bytes than what's on disk.
    } catch (e) {
      console.log(`${obj.expectedRoot}\tREAD_ERROR\t-\t-\tSKIPPED`);
      skipped++;
      continue;
    }
    const { root: computedRoot, shard_count } = computeXlmpRoot(payload);
    const status = computedRoot.toLowerCase() === obj.expectedRoot.toLowerCase() ? 'PASS' : 'FAIL';
    if (status === 'PASS') pass++; else fail++;
    if (shard_count > 1) multiShardTested++;
    console.log(`${obj.expectedRoot}\t${computedRoot}\t${payload.length}\t${shard_count}\t${status}`);
  }

  console.log('');
  console.log(`ELIGIBLE_OBJECTS=${eligible.length}`);
  console.log(`OBJECTS_TESTED=${sample.length}`);
  console.log(`PASS=${pass}`);
  console.log(`FAIL=${fail}`);
  console.log(`SKIPPED=${skipped}`);
  console.log(`MULTI_SHARD_TESTED=${multiShardTested}`);

  if (fail > 0) {
    console.log('');
    console.log('PRODUCTION_ROOT_COMPATIBILITY_FAILURE');
  } else if (sample.length === 0) {
    console.log('');
    console.log('NO_ELIGIBLE_OBJECTS_FOUND');
  } else {
    console.log('');
    console.log('SAMPLED_PRODUCTION_COMPATIBILITY_PASS');
    console.log(`(${pass}/${sample.length} sampled objects recomputed to their expected roots -- this is direct production evidence for the sampled objects only, not a claim about the full ${eligible.length}-object population.)`);
  }
}

module.exports = { computeXlmpRoot, listEligibleObjects, selectSample, OBJECT_NAME_RE, SHARD_SIZE };

// `require.main === module` covers plain `node verify_production_roots.js`
// execution (and correctly stays false when this file is require()'d by
// probe_local_test.js). It does NOT cover the LNES-58.11C zero-write
// invocation (`cat verify_production_roots.js | ssh ... 'node -'`): when a
// script's source comes from stdin, `require.main` is `undefined` --
// confirmed empirically -- so that check alone silently never runs main().
// `module.id === '[stdin]'` is Node's own marker for exactly that case, and
// only applies to the entry-point script itself, never to a required file.
if (require.main === module || module.id === '[stdin]') {
  main();
}
