# WHITEPAPER V3 CLAIM CROSSWALK

Maps every claim-ledger entry in `WHITEPAPER_CLAIM_LEDGER_V3.md` (WP-C001–WP-C032) to its section in
`EXERGYNET_WHITEPAPER_PUBLIC_V3.md`, and confirms its V2 section for traceability. No value, tier, or
envelope is restated differently here than in `WHITEPAPER_CLAIM_LEDGER_V3.md` — this file only maps
location, it does not re-assert evidence. Historical superseded claims (WP-C014, WP-C015) are marked as
such and do not appear as a current-state conclusion anywhere in the V3 manuscript body.

| Claim ID | Claim (short) | Tier | V2 section | V3 section | Wording change? |
|---|---|---|---|---|---|
| WP-C001 | xLMP prompt tokens ~660–820 flat, corpus 8k→285k | T1 | §4 | §4 | No |
| WP-C002 | xLMP +24.4 pts over tested RAG at equal evidence budget | T1 | §4 | §4 | No |
| WP-C003a | ~11.3× correct-task throughput vs. full-context | T1 — verified | §4 | §4 | No |
| WP-C003b | ~42.7× UAT vs. full-context; ~4.0× vs. RAG | T1 *[declared]*, hedge carried forward | §4 ("Validation scope") | §4 ("Validation scope") | No |
| WP-C004 | State-governance: false commitments 8%→0%, accuracy flat 84% | T1 | §8 | §9 | No (renumbered only — PIP §7 insertion shifted §7→§8, §8→§9, §9→§10, §10→§11, §11→§12, §12→§13) |
| WP-C005 | Compact index 52,753.8× (narrow) / 0.72× (mixed) | T1 (workload-dependent) | ledger-only | ledger-only | No |
| WP-C006 | Routing ~1.92×/1.129× | T1 | ledger-only | ledger-only | No |
| WP-C007 | Prompt-injection: deterministic layer rejected after model complied | T1 (deterministic reject) | §8 | §9 | No (renumbered only) |
| WP-C008 | Policy/capability gate implemented, tested, shadow-mode | T2 | §8, §12 | §9, §13 | No (renumbered only) |
| WP-C009 | No production consequence capability exists | limit statement | §12 | §13 | No (renumbered only) |
| WP-C010 | xISA taxonomy 106/106 functional, isolated research env | T3→T2 | §12 | §13 | No |
| WP-C011 | Omega/MMS: 500 RHO settled testnet, replays reverted | T1 (testnet) | §9 | §10 | No (renumbered only) |
| WP-C012 | RHO G0 metrology, measured µRHO/op basis | T2 | §9 | §10 | New sentence added distinguishing STATE_REALIZED ≠ AUTHORIZED framing from §7; no value changed |
| WP-C013 | Same-process erase/restore 30/30, byte round-trip 9/9 | T1 (bounded) | §5 | §5.2 | Condensed into the new §5 subsection structure; no value changed |
| WP-C014 | Fresh-process: SHORT 10/10, MEDIUM 0/10, LONG 0/10 | T3 — **SUPERSEDED** | §5 | Not a current-state conclusion anywhere in V3; historical framing only in §5.2 ("An initial characterization... found... divergence... That original... characterization was later found to conflate two distinct effects, corrected in the following section") | See `WHITEPAPER_CLAIM_LEDGER_V3.md` supersession entry |
| WP-C015 | Serialized-state equality ≠ live-execution-state equality | T3 — **superseded by more precise mechanism, underlying distinction preserved** | §5 | §5.1–§5.3 | Distinction preserved verbatim in spirit; now explained rather than left as an open discovery statement |
| WP-C016 | Temporal Authority: implemented, tested, not activated | T2 | §12 | §13 | No (renumbered only) |
| WP-C017 | AERIS: Base Sepolia testnet, Gen4 required for live settlement | T2 | §12 | §13 | No (renumbered only) |
| WP-C018 | Vault ZK query: SHA-256 receipt, not real proof; async Groth16 once | limit / T1 (single-object) | ledger-only | ledger-only | No |
| WP-C019 | VMN v2.0.0 published, npm | T1 | §12 | §4, §13 | §4 gained one new clarifying paragraph distinguishing VMN's local persistent-state role from the §5 execution-state research; no value changed |
| WP-C020 | Seven authority separations defined and validated within test envelopes | T1 model / T2 enforcement | §3 | §3 | No |
| WP-C021 | FAA Exemption No. 26214 | fact, source-backed | §10 | §11 | No (renumbered only) |
| WP-C022 | LNES-120 PSO — PROPOSED, no implementation | PROPOSED | not in body | not in body | No |
| WP-C023 | TransitionWitness — name on hold | PROPOSED / DEFINED-pending-artifact | not in body | not in body | No |
| WP-C024 | Tensile-Lift aviation gate: 0/50 both runs, SIMULATED_WITNESS | T2 (synthetic-holdout validated) | §10 | §11 | No (renumbered only) |
| WP-C025 | Corrected fresh-process characterization (checkpoint-contamination root cause) | T1 (bounded correction) | not present in V2 | §5.2–§5.3 | New |
| WP-C026 | First-use realization: fixed small re-evaluation cost distinct from correctness | T1 (bounded) | not present in V2 | §5.3 | New |
| WP-C027 | Cross-host R_CONV / S_SSM component realization (same model) | T1 (bounded, same-model cross-host) | not present in V2 | §5.4–§5.5 | New |
| WP-C028 | S-state block 9 individually sufficient | T1 (bounded) | not present in V2 | §5.6 | New |
| WP-C029 | S-state block 11 independently sufficient | T1 (bounded) | not present in V2 | §5.6 | New |
| WP-C030 | Neither block 9 nor 11 individually required (alternative sufficient) | T1 (bounded) | not present in V2 | §5.6 | New |
| WP-C031 | R-state 1-minimal pair {4, 21} | T1 (bounded) | not present in V2 | §5.7 | New |
| WP-C032 | Portable Intelligence Packaging specification | DEFINED / SPECIFICATION | not present in V2 | §7 | New |

**External evidence (§B of `WHITEPAPER_SOURCE_REGISTRY.md`, not WP-C### claims):** `[NVIDIA-Q2FY27]`,
`[NVIDIA-Q2FY27-CFO]`, `[NVIDIA-Q2FY27-CALL]`, `[NVIDIA-LPS]`, `[MICRON-HC2026]` — carried unchanged into
V3 §1, same non-validating disclaimer intact.

**New V3 content with no corresponding WP-C### entry (by design — architectural/framework framing, not
empirical claims):** the two-portability-class table in §6 (Persistent/Authoritative vs. Model-Native
Execution State) is a restatement of the boundary already established by WP-C019, WP-C025–031, and the
V2 architecture — not a new empirical claim in its own right. The MCP interface paragraph in §12 restates
operational facts already governed by the ExergyNet MCP incident-response documentation (a separate
repository's own record), not a new whitepaper-level claim.

**Verification method:** every new WP-C### ID (025–032) was checked directly against its cited entry in
`LNES119B_EVIDENCE_LEDGER.md` before this crosswalk was written, not inferred from the V3 manuscript
text or from directive text. Every carried-forward ID (001–013, 016–024) was grepped against
`EXERGYNET_WHITEPAPER_PUBLIC_V3.md` to confirm it still appears with the same value, tier, and envelope
as `WHITEPAPER_CLAIM_LEDGER_V3.md` states. WP-C014 and WP-C015 were confirmed **not** to appear as a
current-state conclusion anywhere in the V3 manuscript body — only as historical framing explicitly
marked as superseded.
