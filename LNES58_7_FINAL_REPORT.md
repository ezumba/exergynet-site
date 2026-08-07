# LNES-58.7 Final Report — Verified Negative State / Explicit Null Assertion

## Result Summary (authorized language)

The query-independent Deterministic Entity Graph achieved complete entity and relation retrieval on the 67-query interaction subset under independent evaluation. X4 (silent absence of evidence on zero-match traversals) reached 79.1% accuracy. LNES-58.7 tested whether explicit, structured negative-state representation closes that gap. **X5 (explicit NO_MATCH receipt + null assertion) reached 94.0% (63/67)** — a material improvement, but short of the R4 parity gate.

## Phase 6 — 14-Case Mechanism Diagnostic (not a benchmark result)

All 14 previously-observed X4 false positives: resolver correctly re-classified all 14 as `NO_MATCH` (verified, no leakage — the resolver never accessed the historical X4 answers). After explicit null assertion was injected: **false positives dropped from 14/14 to 3/14**. Diagnostic only; not counted toward system performance.

## Phase 7-9 — Full 67-Query X5 Strike

| Metric | Value |
|---|---|
| Accuracy | **94.03% (63/67)** |
| Schema-valid | 100% |
| MATCH count / accuracy | 42 / **100%** |
| NO_MATCH count / accuracy | 25 / 84% |
| INCOMPLETE count | 0 |
| False-positive hallucinations after NO_MATCH | 4 |
| False-negative after MATCH | 0 |
| Entity extraction recall (independent) | 100% |
| Relation-node recall (independent) | 100% |
| All-required-evidence recall (independent) | 100% |
| Negative-result correctness (independent) | 100% |
| Root verification failures | 0 |
| Budget overflows | 0 |
| Mean relation nodes/query | 0.657 |
| Mean evidence tokens/query | 49.3 |
| Graph traversal latency (mean/median/p95) — **in-memory content-addressed resolver latency, `InMemoryVaultRootResolver`; not measured against, and not to be generalized to, production Exergy Vault performance (no such backend exists to test)** | 0.18 / 0.15 / 0.32 ms |
| Generation latency (mean/median/p95) | 7224.6 / 6904.8 / 11539.1 ms |
| Total latency (mean/median/p95) | 7224.8 / 6905.0 / 11539.3 ms |

## Phase 8 — Confusion Matrix (independent evaluator, resolver never self-grades)

|                    | Ground truth: relation required | Ground truth: no relation required |
|---|---|---|
| Resolver MATCH     | 42 | 0 |
| Resolver NO_MATCH  | 0  | 25 |
| Resolver INCOMPLETE| 0  | 0 |

**The diagonal is perfect.** The resolver's own state classification (MATCH vs. NO_MATCH) is 100% correct against ground truth computed independently from the real `INTERACTIONS` table — not from the resolver's own logic. Every remaining accuracy failure (4/67) is a **generation-side** failure: the model was given a correct, verified, explicit "no interaction found" statement and answered "yes, interacts" anyway.

## Phase 9 — Comparison, exact 67-query subset (not 601-query averages)

| Arm | Accuracy (67-query subset) |
|---|---|
| X2 (frozen original) | 74.6% |
| X4 (frozen, silent absence) | 79.1% |
| **X5 (explicit negative state)** | **94.0%** |
| R4 (frozen, modern hybrid+reranker+parent-doc) | 98.5% |
| R3 (frozen, modern hybrid+reranker) | 100.0% |

## Phase 10 — Causal Interpretation

The communication hypothesis (silent absence being conflated with "not searched") is **substantially but not fully supported**:
- Support: 15-point accuracy gain (79.1% → 94.0%); 14-case diagnostic showed 11/14 hallucinations disappeared with no graph/evidence changes; confusion matrix confirms zero resolver misclassification.
- Limit: 4/67 failures persist where an explicit, correctly-labeled NO_MATCH receipt was still overridden by the model's own prior. This is not evidence the resolver is wrong — the independent evaluator confirms all 4 cases were correctly resolved as NO_MATCH — it's evidence that explicit negative-state framing reduces but does not eliminate a generation-side prior toward "yes" on this question shape.

MATCH performance did not regress (100%, same as the "positive evidence found" cases always were). No oracle/query/grader leakage occurred (confirmed via the same static-import and negative-control checks as LNES-58.6). No semantic/vector search was introduced anywhere in X5.

## Phase 11 — GO / NO-GO

**Primary parity gate: X5 (63/67 = 94.0%) is below the required R4 level (66/67 ≈ 98.5%). GATE NOT MET.**

Integrity gates (all pass):
1. Zero oracle/query/grader leakage — ✅
2. Frozen graph provenance preserved — ✅
3. Independently verified positive and negative relation correctness — ✅ (100%/100%)
4. MATCH performance does not regress — ✅ (100%, unchanged)
5. NO_MATCH hallucination rate materially declines — ✅ (14/14 → 3/14 in diagnostic; 4/25 in full run)
6. No INCOMPLETE collapsed into NO_MATCH — ✅ (0 INCOMPLETE occurred; state machine enforces this structurally)
7. No semantic/vector search introduced — ✅
8. TS/Python conformance fixtures pass — ✅ (6/6)

**Decision: NO-GO on LNES-58.7B (601-query regression).** Per your own rule, an accuracy improvement alone doesn't authorize scaling — the numerical gate is the requirement, and it wasn't met.

**Remaining failure class, documented:** all 4 X5 errors are generation-side overrides of a correctly-labeled, correctly-verified NO_MATCH state, concentrated on the same underlying pattern seen since the very first oracle post-mortem (real-world-plausible drug names like ibuprofen, levothyroxine triggering a "probably interacts" prior regardless of what the evidence says). This looks like a prompt-strength or instruction-following issue at this point, not an evidence-construction or graph-topology issue — the graph and traversal have now been verified correct at every layer available to check.

## Artifacts Created

- `LNES58_7_NEGATIVE_STATE_SPEC.md`
- `negative_resolution_receipt.schema.json`
- `X5_67_results.jsonl` (in `LNES58_Multihop_Bench/set1_runs/run1_20260806_134906/`)
- `X5_67_audit.json` (same directory)
- `X5_14case_diagnostic.json` (same directory)
- `LNES58_7_PROVENANCE_MANIFEST.json`
- `LNES58_7_FINAL_REPORT.md` (this file)

All frozen benchmark history (X2, X4, R2, R3, R4, O1, the 601-query 8-arm audit) untouched. X3 remains labeled `INVALID_FOR_ARCHITECTURAL_CLAIM`.
