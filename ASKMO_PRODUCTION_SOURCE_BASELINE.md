# AskMo Production Source Baseline

Initially captured 2026-08-10; **refreshed 2026-08-10 (same day, after the
BLK-016 fix)**. A byte-for-byte snapshot of the currently deployed AskMo
`biological_proxy` source, taken because production has been the sole
authoritative copy of this code with no version control anywhere.

**This is the current baseline** — it reflects the BLK-016 fix (shared
`resolveAuthorizedRuntime()` now gates `vanguard-ultra`/`vanguard-race`
before dispatch; see below). The pre-fix snapshot is superseded and should
not be treated as current production.

## Provenance

- **Host**: AskMo (Azure VM), service directory
  `/home/azureuser/biological_proxy`.
- **Runtime**: `pm2` process `biological-proxy`, `ecosystem.config.js` →
  `script: './dist/index.js'`.
- **Build entrypoint**: `package.json` → `"build": "tsc"`, `"start": "node
  dist/index.js"`. `tsconfig.json` → `rootDir: ./src`, `outDir: ./dist`. So
  the deployed binary is `dist/index.js`, compiled from `src/index.ts` and
  its imports.
- **Verification method**: `sha256sum` computed independently on the remote
  host and on a local `scp`-pulled copy of every file listed below; all
  hashes matched exactly, both at initial capture and again after the
  refresh. See `ASKMO_PRODUCTION_SOURCE_SHA256SUMS.txt` (21 files — one more
  than the initial capture: `proto/inference.proto` is now also tracked,
  since the BLK-016 pass added a warning header to that dead file — see
  below). Additionally confirmed the fix is present in the **compiled
  binary actually running** (`grep -c 'resolveAuthorizedRuntime' dist/index.js`
  → 10 matches), not just the source, and confirmed call-site ordering:
  `resolveAuthorizedRuntime()` (line 2213) executes before both the
  `vanguard-ultra` (2238) and `vanguard-race` (2266) branches.

## Files that actually determine production behavior

```
src/index.ts                          (main handler -- ~4000 lines)
src/auditor.ts
src/context/ShadowContextManager.ts
src/lnes_idl.json
src/middleware/shadowContext.ts
src/tools/ToolPreWarmer.ts
src/tools/VerifiedRetrieval.ts
src/tools/WebRetrieval.ts
src/voice/codec.ts
src/voice/mediaStream.ts
src/voice/phoneRouting.ts
src/voice/piper.ts
src/voice/vad.ts
src/voice/whisper.ts
inference.proto           <-- top-level, NOT proto/inference.proto (see below)
ecosystem.config.js
package.json / package-lock.json
tsconfig.json
sympy_kernel.py            (Python subprocess, invoked by absolute path)
```

`dist/` (compiled output) is **derived**, not source of truth — reproducible
from the files above via `tsc`. Not included in the snapshot; regenerating
it from the snapshot and diffing against live `dist/` would be the
verification step once this baseline is in real version control.

## Non-obvious finding: two `inference.proto` files, only one is live

`src/index.ts` loads its gRPC contract via:

```ts
const PROTO_PATH = path.join(__dirname, '..', 'inference.proto');
```

Since the running code is `dist/index.js`, `__dirname` resolves to `dist/`,
so `..` resolves to the package root — **the top-level `inference.proto`**,
not `proto/inference.proto` one directory over. The two files define
materially different protocols:

- **`inference.proto` (loaded)**: `package vanguard`, `PromptRequest{string
  prompt, string developer_id}` — flat string prompt only. This matches
  what was independently found on the `vandropro` host's own serving-engine
  proto (see `VANGUARD_VISION_RUNTIME_RECON.md`) — consistent, not a new
  contradiction.
- **`proto/inference.proto` (NOT loaded, dead)**: `package inference`,
  `CompletionRequest{repeated ChatMessage messages, string model, float
  temperature, int32 max_tokens}` — a structured multi-message protocol.
  This file is a real footgun: it sits one directory below the live one,
  looks more complete/current, and a future editor grepping for
  "inference.proto" with no other context could easily edit the wrong file
  and see no effect. Redesigning the protobufs was explicitly out of scope
  for the BLK-016 P0 fix, but per that fix's own instruction, `proto/inference.proto`
  now carries an explicit warning header identifying it as dead/unused and
  pointing to the live file — see the file itself, deployed 2026-08-10. A
  matching comment was also added at the `PROTO_PATH` constant in
  `src/index.ts`. Actual cleanup (retiring or deleting the dead file)
  remains a separate future decision, not made here.

## Files classified as dead/legacy (not part of the build)

- Top-level loose `index.ts` (8.8KB — a much older/smaller prototype,
  predates the `src/` + `tsc` structure) and `index.js` /
  `index.js.bak_precredit` — none are referenced by `tsconfig.json`'s
  `include` (`src/**/*` only) or by `ecosystem.config.js`'s script path.
- `proto/inference.proto` — see above.
- ~20 timestamped `src/index.ts.bak*` snapshots and similar `.bak` files
  elsewhere (`stripe_routes_patch.ts.bak`, `sympy_kernel.py.bak`,
  `ecosystem.config.js.bak.*`) — valuable forensic history (several were
  used earlier this session to date when specific bugs were introduced),
  but not live source. Worth preserving as history once real version
  control exists (e.g. as the actual git history, or an `archive/` folder),
  not as loose files sitting next to the live ones.
- `test_voice.js` — not referenced anywhere in `src/`; a standalone manual
  test script, not production code.
- `bun.lock` — present alongside `package-lock.json`, but the build/runtime
  both use `tsc`/`node` via npm scripts, not `bun`. Likely a stale artifact
  from an earlier tooling experiment. Not excluded from the snapshot (it's
  not a secret), but flagged as ambiguous — confirm with the operator
  whether `bun` is still intended to be supported before treating it as
  live.

## Explicitly excluded (credentials — never captured)

`.env`, and every `.env.bak*` variant (`.env.bak.20260709231551`,
`.env.bak_1781718568`, `.env.bak_a1secret`, `.env.bak_creditsecret`,
`.env.bak_provm_1781722811`, `.env.bak_reroute.1780781156`). `.env.example`
(a template with no real values) was inspected but also not included in the
snapshot, out of caution, since this baseline's job is source code, not
config.

## Fixes verified present in this exact captured baseline

Per instruction not to rely on terminal-report claims alone, each of the
following was independently `grep`-confirmed in the captured `src/index.ts`
(not the live report from the prior turn):

| Fix | Verified via |
|---|---|
| `buildPrompt()` `modeOverride` parameter | 3 occurrences (definition + 2 doc references) |
| Explicit-clinical interim 403 authorization | 5 occurrences (`clinicalAuthorized`, `chainClinicalAuthorized`) |
| Realtime keyword isolation | 6 occurrences (`safeKeywordMode`) |
| Batch isolation (`developer_email` capture + gate) | 6 occurrences |
| Batch-chain isolation | 8 occurrences |
| General-JSON/biotech decoupling | the old buggy pattern `isJsonMode ? 'biotech'` appears exactly once, and only inside an explanatory code comment describing what was fixed — **absent from executable code** |
| MyMonitor legacy-shim preservation | 10 occurrences (`isMyMonitorAccount`, `LEGACY_COMPATIBILITY`) |

## BLK-016 finding: two routes bypassed all runtime-mode gating — FIXED 2026-08-10

`/v1/chat/completions` contained two early-return intercepts — `model ===
'vanguard-ultra'` and `model === 'vanguard-race'` — that executed **before**
any of the `inferenceMode`/`clinicalAuthorized` gating logic in the same
handler. Both took the caller's own `system`-role message verbatim
(`messages.find(m => m.role === 'system')?.content || SEI_SYSTEM_PROMPT`)
and passed it straight through to `executeBilateralConsensus()` /
`executeVanguardRace()`, which forwarded it directly to the underlying
engines with no `detectMode()`, no `buildPrompt()`, no authorization check
of any kind — old or new. Not a clinical-keyword leak specifically; a
complete bypass of the entire authorization apparatus, for these two model
aliases.

**Fixed**: a shared `resolveAuthorizedRuntime()` function now runs once,
immediately after `messages` is assembled and before either alias's
dispatch branch. Both branches now compose their system prompt via
`selectPlatformPolicy(inferenceMode)` (the same platform-policy selection
`buildPrompt()` uses internally), with the caller's own system message —
if any — appended as a clearly subordinate, informational block, never a
replacement. `buildPrompt()`'s internal mode-selection was also refactored
to call the same shared `selectPlatformPolicy()` helper, removing the
duplication. A full alias sweep (`model ===`, `model ==`, `switch(model)`,
every route declaration) confirmed no third alias exists with the same gap
— `vanguard-auditor`/`vanguard-aligned`/`vanguard-proposer` are backend
selections inside `getInferenceClient()`, reached only from the already-
gated default path, not separate early-return branches.

Verified: 20/20 regression tests passing (`VANGUARD_RUNTIME_ISOLATION_TESTS.js`,
cases 11–14), fix confirmed present in the actual compiled `dist/index.js`
binary (not just source), call-site ordering confirmed directly in the
refreshed baseline.
