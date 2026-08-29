# WHITEPAPER CLAIM LEDGER V3

**Finalizes:** `WHITEPAPER_CLAIM_LEDGER.md` (VNext-Final / V2) for `EXERGYNET_WHITEPAPER_PUBLIC_V3.md`.
This file is append-only relative to its source. **WP-C001–C013 and WP-C016–C024 are carried forward
unchanged** — same values, tiers, evidence, and prohibited-overclaim wording as the V2 ledger; only their
`WP section` column is updated where V3's renumbering moved them. **WP-C014 and WP-C015 are marked
SUPERSEDED, not deleted or edited in place** — their original text remains below exactly as it read in
V2, with a `Superseded by` pointer to the new claims that replace them as the paper's current-state
conclusion. **WP-C025–WP-C032 are new in this pass**, sourced from `LNES119B_EVIDENCE_LEDGER.md`
(Entries 010, 016, 017–021, 022, 023, 024), an append-only, SHA-256-hashed, adversarially-mutation-tested
experimental record — independently spot-verified against that ledger's raw entries before being copied
into this file, not taken from directive text.

> ## FROZEN INVARIANT — RHO reference-denominator semantics (do not re-derive)
> **RHO's reference-denominator value `0.0001000000` is a current protocol/accounting definition — a
> normalization constant in `RHO_COST_EQUIVALENT = C_TOTAL_NONOVERLAPPING_USD / 0.0001000000`. It is
> NOT evidence of market value, redemption value, energy equivalence, or token economics.** Genesis
> manifest expressly negates all of those (`RHO_IS_STABLECOIN=false`, `RHO_IS_USD_REDEEMABLE=false`,
> `RHO_MARKET_PRICE_DEFINED=false`, `RHO_TOKEN_PRICE_DEFINED=false`, `RHO_PHYSICAL_JOULE_UNIT=false`).
> Unchanged from V2.

## Carried forward unchanged (WP-C001–C013, WP-C016–C024)

| ID | Claim | Evidence (source) | Envelope | Tier/Status | SAFE wording | PROHIBITED overclaim | V3 section |
|---|---|---|---|---|---|---|---|
| WP-C001 | xLMP keeps prompt tokens ~660–820 flat as corpus grows 8k→285k | EVD-001 | H200, Nemotron, synthetic corpus | T1 | "flat prompt-token cost within the tested H200 envelope" | "constant memory at any scale" | §4 |
| WP-C002 | xLMP +24.4 accuracy pts over tested RAG at equal evidence budget | EVD-001 | tested RAG impl, equal budget | T1 | "+24.4 pts vs the tested RAG baseline" | "beats all RAG" | §4 |
| WP-C003a | ~11.3× correct-task throughput vs full-context (best SLA-compliant load) | EVD-001 (hash-verified) | tested H200 workload | T1 — verified | cite with baseline | blended "×" | §4 |
| WP-C003b | ~42.7× UAT vs full-context; ~4.0× vs RAG | EVD-002 addendum (declared) | tested workloads | T1 *[declared]* — re-hash pending | "reported... not re-verified this pass" | stating as independently re-verified | §4 |
| WP-C004 | State-governance: false authoritative commits 8%→0%, model accuracy flat 84% | LNES-59 | 100 real procurement cases | T1 | "prevented unresolved evidence from being promoted to authoritative state" | "made the model more accurate" | §9 |
| WP-C005 | Compact index: 52,753.8× median (narrow) / 0.72× (realistic mixed) | EVD-013 | 1GB/100-query narrow vs mixed vault | T1 (workload-dependent) | always pair both numbers with workload | "52,753.8× retrieval" unqualified | ledger-only |
| WP-C006 | Routing ~1.92× vs full-scan / 1.886× frozen holdout | EVD-014 | tested workload/holdout | T1 | "within the tested workload" | "general-purpose multiplier" | ledger-only |
| WP-C007 | Deterministic layer rejected a live prompt-injection after the model complied; reproduced twice; 64 assertions | LNES-22 architecture | live listener; unit tests | T1 (deterministic reject) | "the model can fail without the authority system failing with it" | "blocks all attacks" | §9 |
| WP-C008 | Deterministic policy gate exists, tested, runs shadow-mode | security claim matrix | shadow/logging only | T2 | "implemented and tested; shadow mode today, not yet sole gate" | "enforces execution today" | §9, §13 |
| WP-C009 | No production consequence capability exists | PROJECT_BLOCKERS | — | limit statement | state plainly as a boundary | implying live enforcement | §13 |
| WP-C010 | xISA capability taxonomy: 106/106 functional | security claim matrix | isolated research env | T3→T2 | "research-validated in isolation" | "production capability enforcement" | §13 |
| WP-C011 | Omega/MMS 3-op economic strike: 500 RHO settled; allowances→0; replays reverted | VAULT_LEDGER MMS; LNES-118 | Base Sepolia testnet | T1 (testnet) | "settled on Base Sepolia testnet" | "production M2M market active" | §10 |
| WP-C012 | RHO G0 metrology: measured basis; ref $0.0001000000 (normalization constant) | LNES116D evidence closure | A10/c6a hardware; GPU/energy modeled | T2 | "resource-cost accounting unit with a measured G0 basis" | "RHO = joules"; "stablecoin"; "market price" | §10 |
| WP-C013 | Same-process erase/restore identical continuation: 30/30 aggregate; byte round-trip 9/9 | LNES119A5/A5.1 raw jsonl | HYBRID_KV_SSM, same process | T1 (bounded) — verified from raw | "same-process restore is lossless within the tested runtime" | "state is portable" | §5.2 |
| WP-C016 | Temporal Authority: implemented + tested; not migrated/activated | Temporal Authority source | not activated | T2 | "engineered and tested; not yet production-activated" | "temporal authority is live in production" | §13 |
| WP-C017 | AERIS membrane deployed (Base Sepolia); Gen4 required for live settlement | VAULT_LEDGER AERIS | testnet; prod runs DEV_MODE | T2 | "authenticated external-evidence membrane on testnet" | "AERIS settles real value on-chain" | §13 |
| WP-C018 | Sync Vault ZK query returns a SHA-256 receipt, not a real proof; async Groth16 verified once | EVD-009/011 | one minimal object | limit / T1 (single-object) | "dual-path... single-object verified" | "every query is ZK-proven" | ledger-only |
| WP-C019 | VMN v2.0.0 published (npm) with adaptive deterministic retrieval | published artifact | published | T1 | "published and source-synchronized" | disclose internal decision mechanics | §4, §13 |
| WP-C020 | Seven authority separations defined and validated within test envelopes | ARCHITECTURE_RECON §8 | test envelopes; production preflight partial | T1 model / T2 enforcement | "designed and validated within test envelopes" | "every layer is enforced across every deployed route" | §3 |
| WP-C021 | FAA Exemption No. 26214 exists | FAA doc | KTX/VSG regulatory record | fact, source-backed | state as a KTX/VSG regulatory fact | any ExergyNet affiliation/endorsement wording | §11 |
| WP-C022 | LNES-120 PSO — PROPOSED, no implementation | higher-order thesis component map | none | PROPOSED | "proposed... no implementation claimed" | any implemented/validated/deployed language | not in V3 body |
| WP-C023 | TransitionWitness — name on hold | — | none | PROPOSED / DEFINED-pending-artifact | "transition evidence / Temporal Authority" | presenting as a built/validated subsystem | not in V3 body |
| WP-C024 | Aviation pre-flight gate: false-release 0/50 both runs vs. 20-34% ungoverned | AI_MEMORY_CONTROL_PLANE.md frozen v1.9 baseline | sealed synthetic holdout; SIMULATED_WITNESS | T2 (synthetic-holdout validated) | "false-release held at 0/50 across two independent runs" | "flight-tested"; "production"; real-aircraft implication | §11 |

## Superseded (not deleted — original V2 text preserved verbatim below)

| ID | Original claim (verbatim, V2) | Original evidence | Original tier | Superseded by | Reason |
|---|---|---|---|---|---|
| WP-C014 | LNES-119 fresh-process continuation: SHORT 10/10, MEDIUM 0/10, LONG 0/10; `119B_READY=NO` | LNES119A5.1/A4B | T3 (characterized negative) | WP-C025 | The original MEDIUM/LONG 0/10 result was later found (LNES119A5.2 audit) to conflate cross-workload checkpoint contamination in the test harness with a genuine restoration failure. This is not a claim that the original result was fabricated or that the prior editorial decision to publish it was wrong — the correcting evidence did not exist yet when V1/V2 were published. It is superseded because newer, corrected evidence is now available. |
| WP-C015 | Serialized-state equality ≠ live-execution-state equality | LNES119A4B/A5.1 | T3 (discovery) | WP-C025, WP-C026 | The underlying distinction remains true and is preserved in V3 §5.1–5.3; it is superseded here only in the sense that it is now explained by a corrected, more precise mechanism (checkpoint contamination + first-use re-evaluation cost) rather than left as an open discovery statement. |

## New in V3 (WP-C025–WP-C032)

All sourced from `LNES119B_EVIDENCE_LEDGER.md` (append-only, SHA-256-hashed per artifact, adversarial-mutation-tested harness with a formal protocol-manifest version history).

| ID | Claim | Evidence (source) | Envelope | Tier/Status | SAFE wording | PROHIBITED overclaim | V3 section |
|---|---|---|---|---|---|---|---|
| WP-C025 | Corrected fresh-process characterization: the original MEDIUM/LONG 0/10 result was caused by cross-workload checkpoint contamination in the harness, not a general restoration failure; corrected harness re-establishes per-workload token-reference baselines (9/9 realizations, 3/3 stability each for SHORT/MEDIUM/LONG) | LNES119B_EVIDENCE_LEDGER.md Entry 003; LNES119A51/A52/A53 completion reports | Same model, same runtime, corrected harness | T1 (bounded correction) | "the original medium/long negative result is superseded by a harness correction, not by a new capability" | "fresh-process restoration was always working" (it wasn't tested correctly, which is a different claim) | §5.2–5.3 |
| WP-C026 | First-use realization: a restored checkpoint requires partial re-evaluation of a small, fixed token count (4, in the tested configuration) before reaching steady state — a distinct property from core capsule correctness | LNES119B_EVIDENCE_LEDGER.md Entries 004–005 (`PATH_CLASSIFICATION = PARTIAL_REEVALUATION_4`, all workloads) | Same model/runtime, corrected harness | T1 (bounded) | "first-use cost is small and fixed in the tested configuration, distinct from correctness" | claiming zero re-evaluation cost | §5.3 |
| WP-C027 | Cross-host state-component realization: transplanting the source host's `R_CONV` component alone, or its `S_SSM` component alone, onto the destination host's otherwise-native state independently reproduces the source host's reference trajectory on the tested MEDIUM workload | LNES119B_EVIDENCE_LEDGER.md Entry 016 (F5B), `R_CONV_A_ORIGIN_SUFFICIENT_FOR_DESTINATION_DIVERGENCE=YES`, `S_SSM_A_ORIGIN_SUFFICIENT_FOR_DESTINATION_DIVERGENCE=YES` | Frozen same model/runtime/quantization; AMD EPYC 74F3 (GPU) source host, Intel Xeon Platinum 8573C (CPU-only) destination host; one MEDIUM workload | T1 (bounded, same-model cross-host) | "a named component of live execution state was shown to transfer and correctly re-realize across two physically distinct x86-64 hosts" | "execution state is portable across hosts" unqualified; any cross-model or cross-runtime claim | §5.5 |
| WP-C028 | S-state block 9 (sidecar ordinal 4) individually sufficient to reproduce the source-host trajectory | LNES119B_EVIDENCE_LEDGER.md Entry 022 (F6B), `S_low_lo_hi_lo_lo_4-4` trial, `MATCH_NODE_A_FRESH (POSITIVE) MINIMAL` | As WP-C027, adaptive bisection search within tested region | T1 (bounded) | "block 9 alone was independently sufficient within the tested search" | "block 9 is the unique cause" | §5.6 |
| WP-C029 | S-state block 11 (sidecar ordinal 5) independently sufficient to reproduce the source-host trajectory | LNES119B_EVIDENCE_LEDGER.md Entry 022 (F6B), `S_low_lo_hi_lo_hi_5-5` trial, `MATCH_NODE_A_FRESH (POSITIVE) ALSO SUFFICIENT` | As WP-C028 | T1 (bounded) | "block 11 alone was also independently sufficient" | implying block 11 is required given block 9 already suffices | §5.6 |
| WP-C030 | Neither block 9 nor block 11 is individually required under the full positive S-state background (ordinals 1–11); removing either alone leaves the region sufficient | LNES119B_EVIDENCE_LEDGER.md Entry 023 (F6C), `S_REDUNDANCY_CLASS = ALTERNATIVE_SUFFICIENT`, both deletion trials `MATCH_NODE_A_FRESH` | As WP-C028/029 | T1 (bounded) | "alternative sufficient — multiple sub-configurations reproduce the effect" | "block 9 and 11 are the complete causal set" (only tested within the eleven-block background) | §5.6 |
| WP-C031 | R-state reduces to a 1-minimal sufficient pair, model blocks 4 and 21 (sidecar ordinals 2 and 9), within the tested adaptive delta-debugging search; no alternative sufficient route observed | LNES119B_EVIDENCE_LEDGER.md Entry 024 (F6D), `R_MINIMAL_SUFFICIENT_MODEL_BLOCKS=[4,21]`, `R_MINIMAL_WITHIN_TESTED_SEARCH=YES`, `ALTERNATIVE_R_SUFFICIENT_ROUTE=NOT_OBSERVED` | As WP-C028, 13 realizations, adaptive delta-debugging | T1 (bounded) | "1-minimal sufficient set within the tested search" | "globally minimum cardinality"; "the only possible pair" | §5.7 |
| WP-C032 | Portable Intelligence Packaging is a named architectural specification distinguishing project/model/runtime/execution-state/persistent-state/evidence/capability/economic-authority/consequence-authority/compatibility as separate properties, with the invariant STATE_REALIZED ≠ AUTHORIZED | This paper, §7 (architectural framing, not an empirical result) | N/A — specification | DEFINED / SPECIFICATION | "reference architecture; full production implementation not claimed" | describing PIP as implemented or deployed | §7 |

### Root cause — explicitly not claimed

No WP-C### entry in this ledger claims a mechanism for *why* cross-host recurrent-state divergence occurs in the first place. `LNES119B_EVIDENCE_LEDGER.md` Entry 006 explicitly rejects an earlier candidate explanation ("Intel Xeon vs AMD EPYC caused different subword tokenization path") as unsupported by direct evidence, and every subsequent entry through Entry 024 records `ROOT_CAUSE = UNKNOWN`. V3 §5.9 states this plainly. This is a **prohibited overclaim boundary for all of WP-C027–WP-C031**: none may be cited as evidence for a specific causal mechanism (CPU floating-point behavior, KV/state-cache fidelity, or otherwise) — only for the structural/mobility finding each one specifically states.

### Retired / prohibited (must NOT appear as ExergyNet capability) — carried forward, plus new entries

- **WP-X01–WP-X05** — carried forward unchanged from V2 (FAA endorsement implications; "Nemotron state is portable" superseded framing now via WP-C025–031's bounded claims rather than WP-C014's flat negative; RHO monetary-value framing; unsourced commercial valuations; NVIDIA/Micron content beyond bounded citation).
- **WP-X06 (new)** — "cross-architecture portability" as a description of the AMD EPYC / Intel Xeon result. Both are x86-64 platforms; this paper reserves "cross-architecture" for a future ISA/runtime-class experiment (e.g., ARM, a different accelerator class) and uses "cross-host," "cross-machine," or "cross-vendor CPU platform" for the result actually demonstrated.
- **WP-X07 (new)** — describing the current public npm MCP package as "vulnerability-free." The safe wording is "a fresh consumer installation reported zero npm-audit findings in the tested dependency tree" of the specific version actually installed — see §12 and the operational note below.

### Operational note on MCP version (verified independently at time of this ledger's authorship, not copied from any directive)

As of this ledger's authorship, `exergynet-mcp-server@0.2.5` is the version published to npm and returned by an ordinary unpinned install; a follow-up release, `0.2.6`, which resolves a set of moderate dependency-audit findings that did not reach ordinary consumer installs of 0.2.5, has been merged to the package's source repository but was not yet published to npm at time of writing. §12 of the V3 manuscript describes only what is true of the currently published release and does not assume a version number that has not actually shipped.

**Post-edit verification (this pass):** every new WP-C### ID (025–032) was checked against its cited `LNES119B_EVIDENCE_LEDGER.md` entry directly, not copied from directive text; WP-C014/C015 were not edited in place, only marked superseded with a pointer; no WP-C001–C013/C016–C024 value, tier, or envelope was changed from V2.
