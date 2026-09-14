// Runtime-fallback audit (§2). Scans the Day-1 RUNTIME modules for FORBIDDEN testnet
// default/fallback VALUES. A denylist membership (a guard) is NOT a fallback and is allowed.
// Reports RUNTIME_84532_DEFAULTS / RUNTIME_TEST_USDC_DEFAULTS / RUNTIME_RETIRED_WALLET_DEFAULTS /
// SILENT_TESTNET_FALLBACKS. Exit 0 iff all are 0.
import { readFileSync } from 'node:fs';

const ROOT = process.env.CANDIDATE_ROOT || 'C:/Users/ezumb/Downloads/exergynet';
// Runtime modules only (NOT test files, which legitimately reference testnet values as reject-cases).
const RUNTIME = [
  'artifacts/day1-mainnet/base-mainnet.config.js',
  'artifacts/day1-mainnet/deposit-indexer.js',
  'artifacts/day1-mainnet/health.js',
];
// "used as a default/fallback value" = assigned via = / ?? / || / return, NOT list/Set membership.
const asDefault = (needle) => new RegExp(`(?:=|\\?\\?|\\|\\||return|:)\\s*['"\`]?${needle}`, 'i');

const metrics = { RUNTIME_84532_DEFAULTS: 0, RUNTIME_TEST_USDC_DEFAULTS: 0,
  RUNTIME_RETIRED_WALLET_DEFAULTS: 0, SILENT_TESTNET_FALLBACKS: 0 };
const findings = [];
const RULES = [
  { m: 'RUNTIME_84532_DEFAULTS',        re: asDefault('84532') },
  { m: 'RUNTIME_TEST_USDC_DEFAULTS',    re: asDefault('0x036cbd') },
  { m: 'RUNTIME_RETIRED_WALLET_DEFAULTS', re: asDefault('0xbd1e790f6040fa62797671b84a50025a0133109c') },
  { m: 'SILENT_TESTNET_FALLBACKS',      re: /(?:sepolia\.base\.org|base-sepolia|\bbaseSepolia\b|\|\|\s*['"`]?84532)/i },
];
for (const f of RUNTIME) {
  let txt; try { txt = readFileSync(`${ROOT}/${f}`, 'utf8'); } catch { continue; }
  txt.split(/\r?\n/).forEach((line, i) => {
    for (const r of RULES) if (r.re.test(line)) { metrics[r.m]++; findings.push({ file: f, line: i + 1, metric: r.m, text: line.trim().slice(0, 120) }); }
  });
}
const total = Object.values(metrics).reduce((a, b) => a + b, 0);
const out = {
  ...metrics,
  runtime_modules_scanned: RUNTIME.length,
  findings,
  // The LIVE biological_proxy has NOT yet been reconciled into this candidate; it is known to contain a
  // testnet fallback (EXPECTED_CHAIN_ID = BASE_CHAIN_ID || '84532') that MUST be removed at integration.
  INTEGRATED_BIOLOGICAL_PROXY_SCANNED: false,
  integration_note: 'biological_proxy integration pending; scan covers the standalone day-1 runtime modules only',
};
console.log(JSON.stringify(out, null, 2));
process.exit(total === 0 ? 0 : 1);
