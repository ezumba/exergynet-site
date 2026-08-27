# WHITEPAPER V2 CLAIM CROSSWALK

Maps every claim-ledger entry in `WHITEPAPER_CLAIM_LEDGER.md` (WP-C001–WP-C024) to its section in
`EXERGYNET_WHITEPAPER_PUBLIC_V2.md`, and confirms its V1 section for traceability. Per VP Sales
Directive 002 §25 deliverable 6. No value, tier, or envelope is restated differently here than in
`WHITEPAPER_CLAIM_LEDGER.md` — this file only maps location, it does not re-assert evidence.

| Claim ID | Claim (short) | Tier | V1 section | V2 section | Wording change? |
|---|---|---|---|---|---|
| WP-C001 | xLMP prompt tokens ~660–820 flat, corpus 8k→285k | T1 | §3 Persistent State and xLMP | §4 Persistent State and xLMP | No |
| WP-C002 | xLMP +24.4 pts over tested RAG at equal evidence budget | T1 | §3 | §4 | No |
| WP-C003a | ~11.3× correct-task throughput vs. full-context | T1 — 1C VERIFIED | §3 | §4 | No |
| WP-C003b | ~42.7× UAT vs. full-context; ~4.0× vs. RAG | T1 *[declared]*, HOLD_FOR_EVIDENCE | §3 ("Validation scope") | §4 ("Validation scope") | No — hedge carried forward verbatim |
| WP-C004 | State-governance: false commitments 8%→0%, accuracy flat 84% | T1 | §4 Reasoning, Evidence, and Authority | §8 Reasoning, Evidence, and Authority | No (relocated only; see rebase plan §14) |
| WP-C005 | LNES-84 compact index 52,753.8× (narrow) / 0.72× (mixed) | T1 (workload-dependent) | Not in V1's Section 3–9 prose (ledger-only; not directly quoted in V1 manuscript body) | Not directly quoted in V2 manuscript body (same as V1) | No — no V1/V2 manuscript body text to compare; ledger entry unchanged |
| WP-C006 | LNES-86 routing ~1.92×/1.129× | T1 | Not directly quoted in V1 manuscript body | Not directly quoted in V2 manuscript body | No |
| WP-C007 | Prompt-injection: deterministic layer rejected after model complied | T1 (deterministic reject) | §4 | §8 | No (relocated only) |
| WP-C008 | Policy/capability gate implemented, tested, shadow-mode | T2 | §4 ("Validation scope"), §9 (maturity table) | §8 ("Validation scope"), §12 (maturity table) | No (relocated only) |
| WP-C009 | No production consequence capability exists | limit statement | §9 (maturity table, "Pilot" row) | §12 (maturity table, "Pilot" row) | No (relocated only) |
| WP-C010 | xISA taxonomy 106/106 functional, isolated research env | T3→T2 | §9 (maturity table) | §12 (maturity table) | No |
| WP-C011 | Omega/MMS: 500 RHO settled testnet, replays reverted | T1 (testnet) | §6 Machine Resource Economics | §9 Machine Resource Economics | No (relocated only) |
| WP-C012 | RHO G0 metrology, measured µRHO/op basis | T2 | §6 | §9 | No — plus one new clarifying sentence distinguishing RHO from C_Q (Directive §18); no value changed |
| WP-C013 | Same-process erase/restore 30/30, byte round-trip 9/9 | T1 (bounded) | §5 State Mobility | §5 State Mobility (relocated to sit contiguous with §4) | No |
| WP-C014 | Fresh-process: SHORT 10/10, MEDIUM 0/10, LONG 0/10 | T3 (characterized negative) | §5 | §5 | No — plus the new "Architectural objective vs. current measured portability" table restates this same hedge in two-column form (Directive §8); no value changed |
| WP-C015 | Serialized-state equality ≠ live-execution-state equality | T3 (discovery) | §5 | §5 | No |
| WP-C016 | Temporal Authority: implemented, tested, not activated | T2 | §9 (maturity table) | §12 (maturity table) | No |
| WP-C017 | AERIS: Base Sepolia testnet, Gen4 required for live settlement | T2 | §9 (maturity table) | §12 (maturity table) | No |
| WP-C018 | Vault ZK query: SHA-256 receipt, not real proof; async Groth16 once | limit / T1 (single-object) | Not directly quoted in V1 manuscript body (ledger-only) | Not directly quoted in V2 manuscript body | No |
| WP-C019 | VMN v2.0.0 published, npm | T1 | §9 (maturity table, "xLMP / Exergy Vault" row references the published local node) | §12 (maturity table) | No |
| WP-C020 | Seven authority separations defined and validated within test envelopes | T1 model / T2 enforcement | §2 The ExergyNet Architecture | §3 The ExergyNet Architecture | No |
| WP-C021 | FAA Exemption No. 26214 (fact, not endorsement) | fact, source-backed | §7 When Software Becomes Structural | §10 When Software Becomes Structural | No (relocated only) |
| WP-C022 | LNES-120 PSO — PROPOSED, no implementation | PROPOSED | Not in V1 manuscript body (ledger/internal-docs only) | Not in V2 manuscript body | No |
| WP-C023 | TransitionWitness — name on hold | PROPOSED / DEFINED-pending-artifact | Not in V1 manuscript body | Not in V2 manuscript body | No |
| WP-C024 | Tensile-Lift aviation gate: 0/50 both runs, SIMULATED_WITNESS | T2 (synthetic-holdout validated) | §7 When Software Becomes Structural | §10 When Software Becomes Structural | No (relocated only) |

**External evidence (§B of `WHITEPAPER_SOURCE_REGISTRY.md`, not WP-C### claims):** `[NVIDIA-Q2FY27]`,
`[NVIDIA-Q2FY27-CFO]`, `[NVIDIA-Q2FY27-CALL]`, `[NVIDIA-LPS]`, `[MICRON-HC2026]` — all five carried from
V1 §1 into V2 §1 (The Economic Problem) unchanged, with their existing non-validating disclaimer intact.

**New V2 content with no corresponding WP-C### entry (by design — architectural/framework framing, not
empirical claims):** the C_Q / E_Q useful-work formalism (§2), the Context/Memory/Authoritative-State
distinction (§4 box), the Model-Substitution Principle (§6), the Administrative Boundaries scenario (§7),
the "What ExergyNet Does Not Require" box, and the Proposed Comparative Evaluation Program B₀–B₅ (§12).
None of these assert a measured result; each is explicitly labeled as architectural, proposed, or
requirement-level framing in its own text (see `WHITEPAPER_POSTURE_AUDIT.md`'s new section for the
per-item check against overclaiming).

**Verification method:** every WP-C### ID in `WHITEPAPER_CLAIM_LEDGER.md` was grepped against both
`EXERGYNET_WHITEPAPER_PUBLIC_V2.md` and the rendered PDF's extracted text where the claim appears in
manuscript prose (not all ledger entries are quoted in the public manuscript body — several exist only
in the ledger as internal diligence records, matching V1's own disposition). No ID's manuscript wording
was found to differ in value, tier, or envelope between V1 and V2.
