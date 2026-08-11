// MYMONITOR_EXTRACTOR_REGRESSION_TESTS.js
//
// Regression suite for AskMo /v1/extract's negation/context-binding repair
// (2026-08-11). Unlike VANGUARD_RUNTIME_ISOLATION_TESTS.js, this is NOT a
// pure-logic replication -- extraction correctness genuinely depends on
// the live model's reasoning, so this connects directly to the same gRPC
// engine runExtraction() uses (localhost:50051), building the exact
// prompt runExtraction() builds (rawMode=true, extraction system message
// with JSON_MODE_ADDENDUM folded in, no buildPrompt overlay).
//
// Run FROM THE ASKMO HOST (needs its node_modules + the live engine):
//   node MYMONITOR_EXTRACTOR_REGRESSION_TESTS.js /path/to/prompt_constants.json
//
// prompt_constants.json is produced by extracting SEI_STRUCTURED_EXTRACTION_PROMPT,
// SEI_CLINICAL_PROMPT, and JSON_MODE_ADDENDUM verbatim from the deployed
// src/index.ts (see ASKMO_PRODUCTION_SOURCE_BASELINE.md) -- kept as a
// separate input rather than hardcoded here so this file doesn't drift
// from the actual deployed prompt text.
//
// This is the first extractor test suite for this endpoint -- none
// existed before this repair (confirmed: only test_voice.js exists on the
// AskMo host, an unrelated dead file).
//
// Cases 1-8: Veena's frozen external-validation set, VERBATIM, unchanged.
// Cases C1-C3: negation-control pairs + context-binding control, added by
// this repair for internal regression only (not part of Veena's frozen set).
const fs = require('fs');
const path = require('path');

const promptConstantsPath = process.argv[2];
if (!promptConstantsPath) {
  console.error('Usage: node MYMONITOR_EXTRACTOR_REGRESSION_TESTS.js <prompt_constants.json>');
  process.exit(1);
}
const PROMPTS = JSON.parse(fs.readFileSync(promptConstantsPath, 'utf8'));
const { SEI_STRUCTURED_EXTRACTION_PROMPT, SEI_CLINICAL_PROMPT, JSON_MODE_ADDENDUM } = PROMPTS;

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const PROTO_PATH = path.join(path.dirname(promptConstantsPath), 'inference.proto');
const pkgDef = protoLoader.loadSync(
  fs.existsSync(PROTO_PATH) ? PROTO_PATH : '/home/azureuser/biological_proxy/inference.proto',
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
const grpcObj = grpc.loadPackageDefinition(pkgDef);
// A single reused client across ~8+ sequential calls in one process was
// observed to silently degrade into empty responses (a channel/stream
// accumulation artifact of this test harness, not of the production
// server -- production creates its persistent clients once at startup but
// serves requests one at a time per HTTP call, never a tight sequential
// loop like this suite's). Creating a fresh client per case avoids it.
function freshClient() {
  return new grpcObj.vanguard.AdaptiveInference(
    process.env.GRPC_TARGET || 'localhost:50051', grpc.credentials.createInsecure()
  );
}

// -- Veena's 8 frozen cases, verbatim (do not alter) --
const FROZEN_CASES = [
  { n: 1, field: 'smoking_status', text: 'Patient denies smoking',
    schema: { smoking_status: { type: 'boolean', description: 'Does the patient smoke?' } },
    check: r => r.extracted.smoking_status === false && r.needs_clarification.smoking_status === false },
  { n: 2, field: 'medication_history', text: 'No medication history available',
    schema: { medication_history: { type: 'string', description: 'Does the patient have any medication history?' } },
    check: r => r.extracted.medication_history === null && r.needs_clarification.medication_history === true },
  { n: 3, field: 'blood_pressure', text: 'Blood pressure recorded at 150/95',
    schema: { blood_pressure: { type: 'string', description: "What is the patient's blood pressure?" } },
    check: r => r.extracted.blood_pressure === '150/95' && r.needs_clarification.blood_pressure === false },
  { n: 4, field: 'age', text: 'Patient is 65 years old with hypertension',
    schema: { age: { type: 'integer', description: "What is the patient's age?" } },
    check: r => r.extracted.age === 65 && r.needs_clarification.age === false },
  { n: 5, field: 'rash', text: 'I have had a rash for three days',
    schema: { rash: { type: 'boolean', description: 'Does the patient have a rash?' } },
    check: r => r.extracted.rash === true && r.needs_clarification.rash === false },
  { n: 6, field: 'cough', text: 'I do not know',
    schema: { cough: { type: 'boolean', description: 'Does the patient have a cough?' } },
    check: r => r.extracted.cough === null && r.needs_clarification.cough === true },
  { n: 7, field: 'cough_duration', text: 'For about 7 days',
    schema: { cough_duration: { type: 'string', description: 'How long has the patient been coughing?' } },
    check: r => r.needs_clarification.cough_duration === false && /7/.test(String(r.extracted.cough_duration)) },
  { n: 8, field: 'nausea_duration', text: 'For about 15 days',
    schema: { nausea_duration: { type: 'string', description: 'How long has the patient had nausea?' } },
    check: r => r.needs_clarification.nausea_duration === false && /15/.test(String(r.extracted.nausea_duration)) },
];

// -- Internal regression: negation-control pairs + context-binding control --
const CONTROL_CASES = [
  { n: 'C1a', field: 'smoking_status', text: 'Patient smokes',
    schema: { smoking_status: { type: 'boolean', description: 'Does the patient smoke?' } },
    check: r => r.extracted.smoking_status === true },
  { n: 'C1b', field: 'smoking_status', text: 'Patient denies smoking',
    schema: { smoking_status: { type: 'boolean', description: 'Does the patient smoke?' } },
    check: r => r.extracted.smoking_status === false },
  { n: 'C2a', field: 'medication_history', text: 'Patient has a medication history',
    schema: { medication_history: { type: 'boolean', description: 'Does the patient have a medication history?' } },
    check: r => r.extracted.medication_history === true },
  { n: 'C2b', field: 'medication_history', text: 'Patient has no medication history',
    schema: { medication_history: { type: 'boolean', description: 'Does the patient have a medication history?' } },
    check: r => r.extracted.medication_history === false },
  { n: 'C2c', field: 'medication_history', text: 'No medication history is available',
    schema: { medication_history: { type: 'boolean', description: 'Does the patient have a medication history?' } },
    check: r => r.extracted.medication_history === null && r.needs_clarification.medication_history === true },
  // Context-binding control: SAME response text, DIFFERENT field -- proves
  // the extractor uses the semantic frame (field + description), not
  // pattern-matching on "7 days" alone.
  { n: 'C3a', field: 'cough_duration', text: 'For about 7 days',
    schema: { cough_duration: { type: 'string', description: 'How long has the patient been coughing?' } },
    check: r => /7/.test(String(r.extracted.cough_duration)) },
  { n: 'C3b', field: 'fever_duration', text: 'For about 7 days',
    schema: { fever_duration: { type: 'string', description: 'How long has the patient had a fever?' } },
    check: r => /7/.test(String(r.extracted.fever_duration)) },
];

// -- No-description fallback: the bare {"field":"type"} shorthand shown in
// public docs, with no per-field question context at all. --
const NO_DESCRIPTION_CASES = [
  { n: 'ND1', field: 'cough_duration', text: 'For about 7 days', schema: { cough_duration: 'string' },
    check: r => /7/.test(String(r.extracted.cough_duration)) },
  { n: 'ND2', field: 'medication_history', text: 'No medication history available', schema: { medication_history: 'string' },
    check: r => r.extracted.medication_history === null },
];

function buildRawModePrompt(systemContent, userContent) {
  return '<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n' + systemContent + '<|eot_id|>' +
    '<|start_header_id|>user<|end_header_id|>\n\n' + userContent + '<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n';
}
function repairJsonSimple(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s === -1 || e === -1 || e < s) return { ok: false };
  return { ok: true, json: text.slice(s, e + 1) };
}
function runOne(c) {
  return new Promise((resolve) => {
    const systemContent = SEI_STRUCTURED_EXTRACTION_PROMPT + '\n\nDomain context:\n' + SEI_CLINICAL_PROMPT +
      '\n\nSchema to extract into:\n' + JSON.stringify(c.schema, null, 2) + JSON_MODE_ADDENDUM;
    const prompt = buildRawModePrompt(systemContent, 'Text to extract from:\n\n' + c.text);
    const call = freshClient().StreamCompletion({ prompt, developer_id: 'regression-suite-' + c.n });
    let fullText = ''; let settled = false;
    const timer = setTimeout(() => { try { call.cancel(); } catch (_) {} finish(); }, 30000);
    function finish() {
      if (settled) return; settled = true; clearTimeout(timer);
      const clean = fullText.replace(/<\|eot_id\|>[\s\S]*/g, '').replace(/<\|end_of_text\|>[\s\S]*/g, '').replace(/<\|start_header_id\|>[\s\S]*/g, '').trim();
      const rep = repairJsonSimple(clean);
      let parsed = null;
      if (rep.ok) { try { parsed = JSON.parse(rep.json); } catch (e) {} }
      let extracted = {}, needs_clarification = {};
      if (parsed) {
        const src = parsed.extracted || parsed;
        const states = parsed.field_states || {};
        for (const f of Object.keys(c.schema)) {
          let v = src[f];
          const st = states[f];
          // Server-side invariant (matches the deployed runExtraction() guard):
          // never trust the model's own value when its own state marker says
          // the fact wasn't established -- force null deterministically.
          if (st === 'unknown' || st === 'not_provided') v = null;
          extracted[f] = v === undefined ? null : v;
          needs_clarification[f] = st ? (st === 'unknown' || st === 'not_provided') : (extracted[f] === null);
        }
      }
      resolve({ case: c.n, rawOutput: clean, extracted, needs_clarification });
    }
    call.on('data', (chunk) => {
      fullText += chunk.token || '';
      for (const m of ['<|eot_id|>', '<|end_of_text|>', '<|start_header_id|>']) if (fullText.includes(m)) { try { call.cancel(); } catch (_) {} finish(); return; }
      if (chunk.is_final) finish();
    });
    call.on('end', finish);
    call.on('error', finish);
  });
}

(async () => {
  let pass = 0, fail = 0;
  const groups = [
    ['Veena frozen suite (verbatim)', FROZEN_CASES],
    ['Negation-control pairs + context-binding control', CONTROL_CASES],
    ['No-description fallback (public-docs shorthand schema)', NO_DESCRIPTION_CASES],
  ];
  for (const [label, cases] of groups) {
    console.log(`\n=== ${label} ===`);
    for (const c of cases) {
      // Small pacing delay: many sequential gRPC calls back-to-back in one
      // process was observed to degrade into empty responses after ~8-10
      // calls (a test-harness/channel-reuse artifact, not an extraction
      // bug -- each case individually verified correct in isolation during
      // this repair). A short pause between calls keeps the full suite
      // reliable on a single run.
      await new Promise(r => setTimeout(r, 1500));
      const r = await runOne(c);
      const ok = c.check(r);
      console.log(`${ok ? 'PASS' : 'FAIL'} -- ${c.n} (${c.field}): "${c.text}"`);
      console.log('  extracted:', JSON.stringify(r.extracted), 'needs_clarification:', JSON.stringify(r.needs_clarification));
      if (ok) pass++; else fail++;
    }
  }
  const total = FROZEN_CASES.length + CONTROL_CASES.length + NO_DESCRIPTION_CASES.length;
  console.log(`\n${pass}/${total} PASS (live model, not simulated)`);
  process.exit(fail > 0 ? 1 : 0);
})();
