# WHITEPAPER CLAIM LEDGER (Publication, VNext-Final)

**Finalizes:** `docs/whitepaper_vnext_recon/CLAIM_LEDGER.md` for `EXERGYNET_WHITEPAPER_VNEXT.md`.
Every major quantitative/architectural claim in the manuscript carries an ID here. No major claim
appears in the manuscript without an entry. Tiers: **T1 DEMONSTRATED** · **T2 ENGINEERED/EMERGING** ·
**T3 RESEARCH FRONTIER**. This file is append-only relative to its source; WP-C001–C023 are carried
forward unchanged (values, tiers, and prohibited-overclaim wording verbatim from the recon ledger,
already independently re-verified in Phase 1C — see `SEI_1C_QUANTITATIVE_BENCHMARK_AUDIT.md`). **WP-C024
is new in this pass.**

> ## FROZEN INVARIANT — RHO reference-denominator semantics (do not re-derive)
> **RHO's reference-denominator value `0.0001000000` is a current protocol/accounting definition — a
> normalization constant in `RHO_COST_EQUIVALENT = C_TOTAL_NONOVERLAPPING_USD / 0.0001000000`. It is
> NOT evidence of market value, redemption value, energy equivalence, or token economics.** Genesis
> manifest expressly negates all of those (`RHO_IS_STABLECOIN=false`, `RHO_IS_USD_REDEEMABLE=false`,
> `RHO_MARKET_PRICE_DEFINED=false`, `RHO_TOKEN_PRICE_DEFINED=false`, `RHO_PHYSICAL_JOULE_UNIT=false`).

| ID | Claim | Evidence (source) | Envelope | Tier/Status | SAFE wording | PROHIBITED overclaim | WP section |
|---|---|---|---|---|---|---|---|
| WP-C001 | xLMP keeps prompt tokens ~660–820 flat as corpus grows 8k→285k | EVD-001 | H200, Nemotron, synthetic corpus | T1 | "flat prompt-token cost within the tested H200 envelope" | "constant memory at any scale" | §5.1 |
| WP-C002 | xLMP +24.4 accuracy pts over tested RAG at equal evidence budget | EVD-001 | tested RAG impl, equal budget | T1 | "+24.4 pts vs the tested RAG baseline" | "beats all RAG" | §5.1 |
| WP-C003a | ~11.3× correct-task throughput vs full-context (best SLA-compliant load) | EVD-001 (hash-verified `7005fa07…`) | tested H200 workload | T1 — 1C VERIFIED | cite with baseline | blended "×" | §5.1 |
| WP-C003b | ~42.7× UAT vs full-context; ~4.0× vs RAG | EVD-002 addendum (declared `97559fb4…`) | tested workloads | T1 *[declared]* — re-hash pending | "reported in EVD-002 addendum, not re-verified this pass" | stating as independently re-verified | §5.1, §5.10 |
| WP-C004 | LNES-59 state-governance: false authoritative commits 8%→0%, model accuracy flat 84% | LNES-59 | 100 real procurement cases | T1 | "prevented unresolved evidence from being promoted to authoritative state" | "made the model more accurate" | §5.2 |
| WP-C005 | LNES-84 compact index: 52,753.8× median (narrow) / 0.72× (realistic mixed) | EVD-013 | 1GB/100-query narrow vs mixed vault | T1 (workload-dependent) | always pair both numbers with workload | "52,753.8× retrieval" unqualified; "universal O(1)" | §5.3 |
| WP-C006 | LNES-86 routing ~1.92× vs full-scan / 1.886× frozen holdout | EVD-014 | tested workload/holdout | T1 | "within the tested workload" | "general-purpose multiplier"; disclose mechanics | §5.3 |
| WP-C007 | LNES-22 deterministic layer rejected a live prompt-injection after the model complied; reproduced twice; 64 assertions | LNES-22 architecture; security claim matrix | live listener; unit tests | T1 (deterministic reject) | "the model can fail without the authority system failing with it" | "141-test validation" (searched, not found); "blocks all attacks" | §5.4 |
| WP-C008 | LNES-22 deterministic policy gate exists, tested (23 assertions), runs shadow-mode | security claim matrix | shadow/logging only | T2 | "implemented and tested; shadow mode today, not yet sole gate" | "enforces execution today" | §5.4, Part VI |
| WP-C009 | No production consequence capability exists (no live financial/infra/physical action is gated by LNES-22) | PROJECT_BLOCKERS BLK-022/023/024 | — | limit statement | state plainly as a boundary | implying live enforcement | Part VI |
| WP-C010 | xISA capability taxonomy: 106/106 functional; 10k-decision corpus; 100k-decision perf — isolated | security claim matrix | isolated research env | T3→T2 (validated, not active) | "research-validated in isolation; production activation requires separate authorization" | "production capability enforcement" | §5.4 |
| WP-C011 | Omega/MMS full 3-op economic strike: 500 RHO settled; allowances→0; replays reverted; 38/39 adversarial; 100/100 concurrency | VAULT_LEDGER MMS; LNES-118 | Base Sepolia testnet | T1 (testnet) | "settled on Base Sepolia testnet" | "production M2M market active"; "RHO has monetary value" | §5.5 |
| WP-C012 | RHO G0 metrology: measured µRHO/op basis (RECALL 494–660, WRITE 759–1,028, QUERY 25.1M–106.8M); ref $0.0001000000 (normalization constant) | LNES116D evidence closure; rho_cost_equivalents_g0.json | A10/c6a hardware; GPU/energy NOT_OBSERVABLE; token proxy | T2 | "resource-cost accounting unit with a measured G0 basis" | "RHO = joules"; "stablecoin"; "market price"; "energy" | §5.6 |
| WP-C013 | LNES-119 same-process erase/restore identical continuation: 10/10 each for SHORT/MEDIUM/LONG (30/30 aggregate); byte round-trip 9/9 | LNES119A5/A5.1 raw jsonl | nemotron_h_moe HYBRID_KV_SSM, same process | T1 (bounded) — 1C VERIFIED from raw | "same-process restore is lossless within the tested runtime" | "state is portable" | §5.7 |
| WP-C014 | LNES-119 fresh-process continuation: SHORT 10/10, MEDIUM 0/10, LONG 0/10; `119B_READY=NO` | LNES119A5.1/A4B | fresh llama_context, same model | T3 (characterized negative) | "cross-process continuation not yet achieved for medium/long tested contexts; localized to runtime cache reconstruction semantics" | "Nemotron state is portable across machines"; asserting the exact missing field as fact | §5.7 |
| WP-C015 | Serialized-state equality ≠ live-execution-state equality | LNES119A4B/A5.1 | as above | T3 (discovery) | "execution state is a first-class object broader than serialized bytes" | claiming a solved portability format | §5.7 |
| WP-C016 | Temporal Authority: journal/anchor/checkpoint/recovery/issuer-rotation implemented + tested; RDS provisioned | Temporal Authority source | not migrated/activated | T2 | "engineered and tested; not yet production-activated" | "temporal authority is live in production" | Part IV, VI |
| WP-C017 | AERIS membrane deployed (Base Sepolia), Groth16 image router-verified; Gen4 required for live settlement | VAULT_LEDGER AERIS | testnet; prod runs DEV_MODE | T2 | "authenticated external-evidence membrane on testnet" | "AERIS settles real value on-chain" | Part IV, VI |
| WP-C018 | Sync Vault ZK query returns a SHA-256 receipt, not a real proof; async Groth16 verified once (98-byte object, CPU, ~13.5m) | EVD-009/011 | one minimal object | limit / T1 (single-object) | "dual-path: SHA-256 hot path / async real-proof cold path (single-object verified)" | "every query is ZK-proven"; "ZK-STARK VERIFIED on mainnet" | §5.8 |
| WP-C019 | VMN v2.0.0 published (npm) with adaptive deterministic retrieval | published artifact | published | T1 | "published and source-synchronized" | disclose internal decision mechanics | Part IV |
| WP-C020 | The seven authority separations are defined and validated within test envelopes | ARCHITECTURE_RECON §8 | test envelopes; production preflight partial | T1 model / T2 enforcement | "designed and validated within test envelopes; `FULL_PRODUCTION_ENFORCEMENT=NO`" | "every layer is enforced across every deployed route" | §3.2 |
| WP-C021 | FAA Exemption No. 26214 (VSG-HL-01/Bolt, up to 275 lb MTOW, controlled testing/eval/demo ops) exists | FAA doc; audit/FAA_NEUROLOCK_WEB_AUDIT | KTX/VSG regulatory record | fact, source-backed | state as a KTX/VSG regulatory fact | any ExergyNet affiliation/endorsement wording | Part VIII |
| WP-C022 | LNES-120 PSO — PROPOSED, no implementation | higher-order thesis component map | none | PROPOSED | "proposed response to a derived requirement; no implementation, validation, or deployment claimed" | any implemented/validated/deployed language | Part VII |
| WP-C023 | TransitionWitness — name on hold, no defining artifact | — | none | PROPOSED / DEFINED-pending-artifact | "transition evidence / Temporal Authority" | presenting as a built/validated subsystem | Part IV, VII |
| **WP-C024** | **(NEW)** Aviation pre-flight authorization gate (Tensile-Lift/KTX target domain): governed by LNES-22, false-release rate 0/50 in both Phase 1 (rule-based simulator) and Phase 1.5 (real model, claude-sonnet-5); ungoverned raw telemetry 34% (Phase 1) / 20% (Phase 1.5) false-release on the identical holdout | `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md:1664–1689` (frozen v1.9 baseline; carried forward, not re-run this session) | sealed 50-case synthetic holdout, 20 adversarial test classes ≥2 instances each; **all witness data `SIMULATED_WITNESS` — no real sensor hardware or aircraft** | T2 (synthetic-holdout validated) | "governed by the LNES-22 gate, false-release held at 0/50 across two independent runs against a synthetic 20–34% ungoverned baseline" | "flight-tested"; "hardware-in-the-loop"; "production"; any implication of real-aircraft validation | §5.9, Part VIII |

### New components from the higher-order directive (bounded — not implemented/validated)
- **WP-C022 — LNES-120 PSO.** PROPOSED only. Prohibited: any implemented/validated/deployed language.
- **WP-C023 — TransitionWitness.** Name on hold pending a defining source artifact (D-17/D-25).

### Retired / prohibited (must NOT appear as ExergyNet capability)
- **WP-X01** — FAA facts (Exemption 26214, VSG-HL-01/Bolt, 275 lb MTOW, controlled testing) are supported
  and stated (WP-C021). Prohibited: FAA validation/endorsement of ExergyNet, FAA endorsement of
  NEURO-LOCK, government validation of the architecture, "7th company in U.S. history" (unseparately
  sourced), any causal implication that the exemption validates the AI architecture.
- **WP-X02** — "Nemotron state is portable" — contradicted by WP-C014.
- **WP-X03** — RHO monetary value / joules / stablecoin — contradicted by WP-C012.
- **WP-X04** — Commercial valuations ($5B/$8B/$15B), Poolside/NVIDIA licensing demand — out of scope; see
  `docs/whitepaper_vnext_recon/NVIDIA_RELEVANCE_NOT_FOR_WHITEPAPER.md`.
- **WP-X05 (new)** — NVIDIA/Micron content beyond §1.1/§2.5's bounded, cited, dated external-evidence
  framing. No NVIDIA/Micron figure may be presented as ExergyNet evidence, as validation of this
  architecture, or without its `[NVIDIA-...]`/`[MICRON-...]` citation (see `WHITEPAPER_SOURCE_REGISTRY.md`).

**Post-edit verification (this pass):** grep for every WP-C### ID confirms each appears in
`EXERGYNET_WHITEPAPER_VNEXT.md` with tier and envelope stated adjacent; no ID appears without an entry
here; no entry's tier was raised without new evidence (only WP-C024 is new; WP-C001–C023 values,
tiers, and prohibited-overclaim wording are unchanged from the recon ledger).
