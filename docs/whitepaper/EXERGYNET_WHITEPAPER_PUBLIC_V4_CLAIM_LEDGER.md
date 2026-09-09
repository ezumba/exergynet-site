# EXERGYNET WHITEPAPER V4 — CLAIM LEDGER

**Governs:** `EXERGYNET_WHITEPAPER_PUBLIC_V4.md`
**Date:** 2026-09-06
**Basis:** V3 Claim Ledger (`WHITEPAPER_CLAIM_LEDGER_V3.md`) carried forward + new V4 claims

This file is append-only relative to its source. WP-C001–C013 and WP-C016–C032 are carried
forward from V3 with V4 section mappings updated. New claims WP-C033–WP-C041 are V4 additions
sourced from sealed evidence artifacts.

## Frozen Invariants (carried from V3 — unchanged)

**RHO reference-denominator semantics:** RHO's reference-denominator value 0.0001000000 is a
current protocol/accounting definition — a normalization constant. It is NOT evidence of market
value, redemption value, energy equivalence, or token economics.

**Protocol Capability ≠ Deployment State (D-33 permanent invariant):** VALIDATED never implies
Production. Every capability claim must carry its actual maturity stage.

**Maximum defensible claim (D-62):** Use the maximum defensible claim, not the minimum
defensible, and never the maximum imaginable.

---

## Carried Forward from V3 (WP-C001–C032)

Claims WP-C001–C013 and WP-C016–C024 are unchanged in value, tier, and envelope.
WP-C014 and WP-C015 remain SUPERSEDED (original text preserved in V3 ledger).
WP-C025–C032 are carried forward from V3 unchanged.

For full V3 claim text, evidence citations, and prohibited-overclaim wording, see:
`WHITEPAPER_CLAIM_LEDGER_V3.md`

V4 section mappings for carried-forward claims:

| V3 Claim IDs | V4 Section |
|---|---|
| WP-C001, WP-C003a, WP-C003b | §13 (H200 / Accelerator Economics) |
| WP-C002 | §13 (H200 / Accelerator Economics) |
| WP-C004 | §14 (Authority) |
| WP-C005, WP-C006 | §10, §11 (Resolution) |
| WP-C007 | §14 (Authority) |
| WP-C008 | §14 / Validation Status table |
| WP-C009 | §17 (Limitations) |
| WP-C010 | §14 / Validation Status table |
| WP-C011 | §14 |
| WP-C012 | §14 |
| WP-C013 | §16 (State Mobility) |
| WP-C016 | Validation Status table |
| WP-C017 | Validation Status table |
| WP-C018 | Ledger only |
| WP-C019 | Validation Status table |
| WP-C020 | §14 |
| WP-C021 | §15 |
| WP-C022 | Ledger only (PROPOSED, not in V4 body) |
| WP-C023 | Ledger only (PROPOSED, not in V4 body) |
| WP-C024 | §15 |
| WP-C025–C032 | §16 (State Mobility) |

---

## New in V4 (WP-C033–WP-C041)

All sourced from independently-read sealed evidence artifacts. No claim copied from directive
text without artifact verification.

| ID | Claim | Evidence (source) | Envelope | Tier/Status | SAFE wording | PROHIBITED overclaim | V4 section |
|---|---|---|---|---|---|---|---|
| WP-C033 | N→K decoupling: across 9-point development ladder (32K–4M), OLS slope = 7.834×10⁻⁷ tokens/corpus-token, SE = 1.423×10⁻⁵, t = 0.055, R² = 0.0004, 95% CI [−3.287×10⁻⁵, +3.444×10⁻⁵] includes zero | EVIDENCE_SEAL_LNES82C4M.md (sealed 2026-08-31, GCS 3-way PASS) | GCP A100 4G; adversarial synthetic corpus; 9 scales 32K–4M; nvidia/nemotron-3-nano-omni-30b-a3b-reasoning | T1 SEALED | "less than 0.1% of K variance explained by N in the 9-point tested envelope; slope not statistically distinguishable from zero" | "K is constant at any scale"; "N has no effect on K"; extrapolating beyond tested envelope | §5, §8 |
| WP-C034 | 4M genuine holdout: mean K = 902.81, median K = 925, P95 = 972, accuracy = 45.3%, 950/950 ok, 0 per-query K mismatches across 5 shuffled repetitions | EVIDENCE_SEAL_LNES82C4M.md | GCP A100 4G; 5 × 190 query holdout; sealed query SHA 341acf7d... | T1 SEALED | "4M holdout confirmed decoupling; all quality gates passed; no Q_BEND" | claiming 5 runs as independent accuracy samples | §6 |
| WP-C035 | 10M genuine holdout: mean K = 895.96, median K = 908, P95 = 985, accuracy = 39.5% (75/190 unique correct), 950/950 ok, 0 per-query K mismatches across 5 shuffled repetitions; Q_BEND formally triggered (39.5% < 40.0% floor) | EVIDENCE_SEAL_LNES82C10M_HOLDOUT.md (sealed 2026-09-04, GCS 3-way PASS) | WSL2 Ubuntu runner (retrieval/query host) + NVIDIA NIM on GCP a2-highgpu-4g (inference endpoint, SSH tunnel); ~10.1M est. tokens; adversarial synthetic corpus; sealed query SHA 341acf7d...; harness SHA c5b7849d... | T1 SEALED | "Q_BEND formally triggered at 39.5% while 950/950 executions completed status=ok" | "system failed at 10M"; "K=895 proves scaling"; claiming 5 runs as independent accuracy samples; mixing dev sweep and genuine holdout figures | §7, §8, §9 |
| WP-C036 | Q_BEND root cause: Q3 temporal-authority class scored 12.0% at 10M holdout (vs 20.0% at 4M dev); Q1=43.0%, Q2=62.5%, Q4=16.0% | EVIDENCE_SEAL_LNES82C10M_HOLDOUT.md | 10M holdout; Q-class decomposition per seal | T1 SEALED | "Q3 temporal-authority class is the primary Q_BEND driver at 10M adversarial corpus density" | "temporal authority is broken"; any extrapolation beyond tested 10M adversarial corpus | §9 |
| WP-C037 | LNES-84.1 escape boundary: indexed-discovery α ≈ −0.2183 (CI upper ≈ +0.0206); selective effective-resolution P95 α ≈ +0.7712 (strong positive SUBLINEAR, caused by 100% morph-query fallback to full-corpus scan) | LNES84_1_V3_PYPY_EVIDENCE_SEAL.md (frozen SHA 55F5F9A8...); LNES84_1_V3_PYPY_EVIDENCE_SEAL_ERRATA_002.md (ERRATA_002, 2026-09-06) | PyPy 7.3.23 / Python 3.11.15; 32MB–512MB corpus; 8 scale points | T1 SEALED (with ERRATA_002 correction) | "α=0.771 is strong positive sublinear power-law scaling (α < 1); do not call it super-linear" | "super-linear"; confusing GATE PASS on indexed path with GATE PASS on effective-resolution | §11 |
| WP-C038 | LNES-84.2 V4: morph routing 3/50→50/50 (0.06→1.00), morph fallback 1.00→0.00, selective fallback 0.25→0.00, all-query fallback 0.375→0.1667; EXACT_ROUTING_REGRESSION=0, PROTECTED_LITERAL_REGRESSION=0, I1-I5 PASS, false accepts=0, cap saturation=0, candidates_before_cap=1.0 at all 5 scales | LNES84_2_V4_EVIDENCE_SEAL.md SHA ABD1AE9C... (sealed 2026-09-06); LNES84_2_V4_RESULTS.json SHA 28DE5868... | PyPy 7.3.23 / Python 3.11.15; 32MB–512MB corpus; 5 scale points (S1–S5) | T1 SEALED | "morph escape boundary closed for tested query population; O(V) mechanism with V nearly constant in benchmark" | "O(1) retrieval"; claiming arbitrary-vocabulary generalization; importing as LNES-82C evidence | §12 |
| WP-C039 | GPU workload composition at 4M: retrieval P50 ≈ 19.8s; model E2E P50 ≈ 0.44s; retrieval share ≈ 97.8% of per-query wall time; GPU mean utilization 2.0%; GPU median utilization 0.0%; GPU peak utilization 100.0% | EVIDENCE_SEAL_LNES82C4M.md — GPU telemetry section (10,680 samples; GCS 3-way PASS) | GCP A100 4G; 4M adversarial corpus; 10,680 GPU telemetry samples | T1 VERIFIED (GPU telemetry section read 2026-09-06; FLAG-WP-C039 cleared) | "10,680 telemetry samples showed retrieval-dominated workload: P50 retrieval ≈ 19.8s vs P50 inference ≈ 0.44s; GPU mean utilization 2.0%, median 0.0%, peak 100.0%" | causal claims about GPU architecture; conflating peak-100% with average utilization | §6, §13 |
| WP-C040 | FAA Exemption No. 26214: KTX authorized to conduct VSG HL 01 "Bolt" UAS lift operations, evaluate, test, demonstrate; MTOW ≤ 275 lbs; airworthiness determination "does not create a hazard to users of the NAS or the public"; FAA characterized as "highly automated daytime operations"; Condition 11 control "rests primarily within the UA's automated systems"; FAA found "equivalent level of safety" for alternative maintenance procedures; Blanket COA authorizes NAS operations Class G ≤400 ft AGL; in public interest finding; terminates July 31, 2028 | FAA-2025-5731_Kunfirm-Innovative-Services_Exemption No. 26214.pdf (read directly 2026-09-06) | KTX/VSG regulatory record; July 15, 2026 | T1 (regulatory fact, primary source read) | State as KTX regulatory record with precise FAA-document citations | "FAA validated ExergyNet"; "FAA certified Neuro-Lock"; "FAA endorsed the ExergyNet authority architecture"; any statement that the exemption constitutes AI safety certification | §15 |
| WP-C041 | 10M dev sweep and 10M genuine holdout are distinct artifacts: different query populations, different seals | EVIDENCE_SEAL_LNES82C10M.md (dev); EVIDENCE_SEAL_LNES82C10M_HOLDOUT.md (holdout) | — | T1 (architectural boundary) | Maintain explicit distinction in all prose; never blend dev and holdout figures | "10M accuracy" without specifying dev vs holdout | §7 |

| WP-C042 | 10M development sweep OLS regression (32K–10M): b = 2.79×10⁻⁶ tokens/corpus-token, R² = 0.0384, 95% CI [−8.59×10⁻⁶, +1.42×10⁻⁵] includes zero | EVIDENCE_SEAL_LNES82C10M.md (dev sweep; 7/7 raw artifacts GCS-verified 2026-09-03; seal document pending operator upload) | Different query population from 10M genuine holdout; GCP A100 4G (same hardware as development ladder) | T1 DEVELOPMENT (data GCS-verified; seal upload pending) | "Extending to 10M development sweep: slope = 2.79×10⁻⁶, R²=0.0384, CI includes zero; not statistically distinguishable from zero" | Conflating dev sweep regression with sealed holdout evidence; the raw data is GCS-verified but the seal document itself awaits operator upload | §5, §8 |
| WP-C043 | Neuro-Lock distributed flight-control architecture: described in VSG-HL-01 UFM as "Neuro-Lock Control System" (distributed digital flight-control architecture); identified in VSG-TRRM-01 as "Neuro-Lock Start" mitigation (800 Hz distributed edge stabilization); described in VSG-HL-01 CONOPS as operational safety architecture | VSG-HL-01 UFM (primary operating document, filed with FAA petition Dec 2025); VSG-TRRM-01 (technical risk register); VSG-HL-01 CONOPS | KTX petition package submitted December 2025, FAA Docket FAA-2025-5731 | T1 (primary operating documents, regulatory record) | "The December 2025 petition described a distributed flight-control architecture including Neuro-Lock distributed edge stabilization..." | "FAA certified Neuro-Lock"; "Neuro-Lock was independently validated by FAA"; implying the exemption itself names Neuro-Lock (it names the aircraft and operator, not the software subsystem) | §15 |
| WP-C044 | State-to-active-context ratio: 10,116,589 / 895.96 ≈ 11,291:1. Accumulated corpus tokens (N) at 10M holdout divided by mean active model-facing inference tokens (K) at 10M holdout. | Derived from EVIDENCE_SEAL_LNES82C10M_HOLDOUT.md (GCS 3-way PASS; sealed 2026-09-04) — N = 10,116,589 est. tokens; mean K = 895.96 | 10M genuine holdout; arithmetic derived from independently GCS-verified sealed measurements | T1 DERIVED FROM SEALED HOLDOUT | "State-to-active-context ratio ≈ 11,291:1; derived from sealed holdout measurements; not a compression ratio, storage ratio, or assertion that every query accessed every corpus token" | Calling this a compression ratio; calling it a storage ratio; claiming every query token "saw" all N corpus tokens; citing without the derivation qualifier | Abstract, §2, §3, §5, §7, §8, Executive Summary |
| WP-C045 | Cross-accelerator throughput portability (LNES-82C.R6): R = S_TPU/S_A100 declined 0.9492→0.8985→0.8557 across C=1/2/4; zero errors, zero timeouts across all 12 scored cells; A100 and TPU full-context accuracy 100%; xLMP accuracy envelope 96.77%–97.10% | LNES82C_R6_CROSS_ACCELERATOR_REPORT.md; independently re-verified in `docs/recon/LNES82C_R6_INDEPENDENT_VERIFICATION_2026-09-06.md` (execution-schedule hash re-confirmed, harness/treatment hashes re-confirmed via archive copies, all CTT/S/R values independently recomputed from raw JSON, no discrepancy found) | `Qwen2.5-7B-Instruct` (BF16); NVIDIA A100 (`a2-highgpu-1g`) vs. Google TPU v6e (`v2-alpha-tpuv6e`); ~20,000-token synthetic corpus, 100-question population; C=1/2/4 | T1 (tested envelope; execution schedule + harness/treatment code hash-verified; raw result files have no historical digest to check against — see provenance note) | "R6 satisfies H82's preregistered directional criterion for the substituted workload"; R is a ratio-of-ratios (S_TPU/S_A100), not a raw TPU-vs-A100 throughput comparison; AMD/ROCm portability remains untested; 10M-scale N→K portability to TPU remains untested | "R6 proves accelerator independence"; "R6 reproduces H200 on TPU"; "TPU reproduces the 11.3× H200 result"; "R6 confirms hardware-independent magnitude"; averaging, blending, or multiplying with WP-C003a's H200 figure | §13.3, Appendix A |
| WP-C046 | Network data movement as a scaling constraint: Cisco 2026 reports up to 450% more total network traffic per agentic task than an equivalent human-performed task, with ~70% attributable to AI inference. xLMP's bounded model-facing evidence property (mean K=895.96 at 10M holdout; 9-pt 32K–4M slope 7.834×10⁻⁷, indistinguishable from zero) attacks one structural source — repeated transmission of accumulated context — of that network problem. | **EXTERNAL:** Cisco Systems, "AI Impact on Wide Area Networks 2026" (cisco.com AI-impact-campus-branch-networks page; "Up to 450% more total traffic is generated per task when performed by an agent" / "Approximately 70% of that traffic is AI inference" — both quotations independently confirmed via web fetch 2026-09-09). **INTERNAL linkage:** EVIDENCE_SEAL_LNES82C10M_HOLDOUT.md (K values, GCS 3-way PASS) + EVIDENCE_SEAL_LNES82C4M.md (9-pt regression). | External industry measurement (service-provider WAN, agentic tasks); internal N→K envelope 32K–10M adversarial synthetic corpus | **EXTERNAL_INDUSTRY_EVIDENCE + ARCHITECTURAL_INTERPRETATION** — NOT an ExergyNet bandwidth benchmark | "Cisco independently measured the network problem; ExergyNet independently measured a bounded model-facing evidence property that attacks one structural source of it; end-to-end network-byte reduction under xLMP is a separate, unmeasured validation target" | "Cisco proved full-context replay caused the 450%"; "xLMP measured network-bandwidth reduction"; "all legacy agents retransmit their entire history"; "O(N) network traffic was empirically converted to O(\|E(q)\|)"; "the 450% was driven by the separately reported 14× token figure" | §3, References [8] |

---

## Retired / Prohibited (V4 additions to existing list)

Carried forward from V3: WP-X01–WP-X07.

New in V4:

- **WP-X08:** "The regression slope proves N has no effect on K." The slope being statistically indistinguishable from zero does not prove zero effect; it proves the effect, if present, is smaller than the measurement precision within the tested envelope. Safe wording: "not statistically distinguishable from zero within the tested envelope."
- **WP-X09:** "Q_BEND proves the system failed at 10M." Q_BEND is a retrieval-quality threshold exceedance; 950/950 executions completed with status=ok. Safe wording: "Q_BEND was formally triggered; the system returned valid output for all 950 executions."
- **WP-X10:** Describing the LNES-84.2 V4 morph closure as "O(1) retrieval" or "constant-cost retrieval." The mechanism is O(V) prefix scan. V was constant in V4 benchmark. V→R scaling under vocabulary growth is untested. Never claim O(1).
- **WP-X11:** Mixing the 4M A100 retrieval latency figures with the 10M WSL2 latency figures as if they are hardware-comparable. The environments differ; the ratio is not evidence-grade.
- **WP-X12:** Describing the FAA Blanket COA as applying exclusively to KTX. The Blanket COA is issued to "Any Operator with a valid 49 U.S.C. § 44807 Grant of Exemption." KTX's Exemption 26214 is what ties it to KTX.
- **WP-X13:** Citing ~42.7× (efficiency vs full-context extended) or ~4.0× (efficiency vs RAG) from EVD-002 addendum. EVD-002 was not found as a verifiable artifact. Both figures have been removed from the V4 paper (NVIDIA freeze pass 2026-09-06). These numbers must not reappear in any NVIDIA-facing document without a re-hashed, independently-verified artifact.

---

## Post-edit verification (V4 pass)

WP-C033–C041: derived from evidence artifacts read directly in the V4 pass (EVIDENCE_SEAL_LNES82C4M.md, EVIDENCE_SEAL_LNES82C10M_HOLDOUT.md, LNES84_2_V4_EVIDENCE_SEAL.md, LNES84_1_V3_PYPY_EVIDENCE_SEAL_ERRATA_002.md, FAA exemption PDF). No claim was copied from directive text without artifact verification.

## Post-edit verification (V4.1 pass — 2026-09-06)

WP-C039: FLAG-WP-C039 cleared. GPU telemetry section of EVIDENCE_SEAL_LNES82C4M.md confirmed as the source for: retrieval P50 ≈ 19.8s, model E2E P50 ≈ 0.44s, 10,680 telemetry samples, GPU mean 2.0%, median 0.0%, peak 100.0%. Claim status updated to T1 VERIFIED.

WP-C042: Added. 10M development sweep regression values (b=2.79×10⁻⁶, R²=0.0384, CI includes zero) sourced from EVIDENCE_SEAL_LNES82C10M.md per operator directive; dev seal's GCS provenance was pending operator final sign-off at time of writing. Marked T1 DEVELOPMENT (GCS sign-off pending) accordingly.

WP-C043: Added. Neuro-Lock source backing upgraded from OPERATOR-STATED to T1 (primary operating documents). Sources: VSG-HL-01 UFM ("Neuro-Lock Control System"), VSG-TRRM-01 ("Neuro-Lock Start", 800 Hz edge stabilization), VSG-HL-01 CONOPS (operational safety architecture). All filed with FAA as part of KTX petition December 2025.

## Post-edit verification (NVIDIA Pre-Release Freeze — 2026-09-06)

10M_DEV_PROVENANCE_RESOLUTION: WP-C042 updated. 7/7 raw artifacts GCS-verified 2026-09-03; seal document pending operator upload. Status changed from "GCS sign-off pending" to "data GCS-verified / seal upload pending."

EVD-002_RESOLUTION: EVD-002 artifact not found. ~42.7× and ~4.0× figures removed from §13.1 H200 table and Appendix A. WP-X13 added to prohibited list. Removal confirmed in V4 paper text.

## Post-edit verification (R6 Integration Pass — 2026-09-06)

WP-C045: Added. New row only — no existing row was modified. WP-C025 (unrelated LNES-119B corrected fresh-process claim, §16) and WP-C044 (11,291:1 state-to-active-context ratio, unchanged above) were re-checked after this edit and confirmed unaltered in value, tier, and envelope. WP-C045 values (CTT/S/R for all 12 cells) sourced from `LNES82C_R6_CROSS_ACCELERATOR_REPORT.md` and cross-checked against the independent re-verification in `docs/recon/LNES82C_R6_INDEPENDENT_VERIFICATION_2026-09-06.md`, which found no discrepancy. Body placement: new §13.3 (immediately after §13.2, before §14 — the directive's assumed placement "before §15.1" did not match the live document, which has a §14 between §13.2 and §15.1; corrected against the live file). H200 non-merge reference confirmed as **WP-C003a** (carried into V4 §13 from `WHITEPAPER_CLAIM_LEDGER_V3.md` line 28, per the V3→V4 section-mapping table above) — this is the correct ID in *this* ledger's own lineage, not a VNEXT-only ID.

**Cross-lineage note:** VNEXT WP-C025 ↔ PUBLIC_V4 WP-C045 — same R6 evidence, different ledger namespaces.

## Post-edit verification (Cisco Network-Traffic Insertion — 2026-09-09)

WP-C046: Added. New row only — no existing row was modified. Classified **EXTERNAL_INDUSTRY_EVIDENCE + ARCHITECTURAL_INTERPRETATION**, explicitly *not* an ExergyNet bandwidth benchmark. External fact independently confirmed 2026-09-09 via web fetch of Cisco's AI-impact page: exact wording "Up to 450% more total traffic is generated per task when performed by an agent" and "Approximately 70% of that traffic is AI inference," sourced to Cisco "AI Impact on Wide Area Networks 2026." Reference 8 added to V4 paper (`Cisco Systems. AI Impact on Wide Area Networks: 2026 Report. Cisco, 2026.`).

Body placement: §3 (xLMP Architecture), immediately after the "Position relative to the model" paragraph and before §4 — matched against the live document (the directive's older "Repeated Context Ingestion / Data-Movement Problem" heading no longer exists in V4). Insertion maintains strict MEASURED / DERIVED / ARCHITECTURAL separation: the LNES-82C K values (mean 895.96, median 908, P95 985, 950/950 ok) and the 9-point slope (7.834×10⁻⁷) are MEASURED and unchanged; the "≈ within 12 tokens of the 32K mean / >300× corpus" framing reuses existing §8 bounded-scaling language; the network implication is stated as ARCHITECTURAL, with end-to-end network-byte reduction named as a separate unmeasured validation target.

FINAL-GATE compliance: no existing LNES-82C numeric value changed; Q_BEND characterization untouched; tested envelope not broadened; no internal claim copied from directive text without artifact/source verification. The five prohibited overclaims in WP-C046's PROHIBITED column mirror the directive's DO NOT CLAIM list and are explicitly excluded from the inserted prose.

**WP-C046 NEXT_VALIDATION.** The unmeasured target left open by WP-C046 — "Direct measurement of end-to-end network-byte reduction under xLMP remains a separate validation target" (V4 §3) — is named and specified as:

- **NEXT_VALIDATION:** LNES-82N — Network Data-Movement Scaling (`ExergyNet_xLMP_500K_Scaling_Validation/LNES82N_NETWORK_DATA_MOVEMENT_PROTOCOL_2026-09-09.md`; SEALED protocol only, NOT executed as of 2026-09-09).
- **MEASUREMENT_TARGET:** N → B, where B = actual network bytes moved per completed task (decomposed per network plane; normalized to bytes per correct task).

This closes the intellectual loop: Cisco (external — agents impose materially greater network traffic) → LNES-82C (measured — N→K decoupled within the tested envelope) → open question (does that architectural property produce a measurable reduction in actual bytes moved?) → LNES-82N (N→B answers it). The §3 "separate validation target" sentence is retained deliberately; once LNES-82N seals, and only then, it may be upgraded to a measured statement with a new sealed-evidence claim ID.
