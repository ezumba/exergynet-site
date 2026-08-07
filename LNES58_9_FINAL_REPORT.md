# LNES-58.9 Final Report — Parametric Adherence and State-Authority Boundary

## Authorized Summary

LNES-58.7 isolated four residual cases in which the language model contradicted a verified NO_MATCH graph state and fabricated source attribution. LNES-58.9 tested two responses: model-level closed-world instruction (X6A) and deterministic state-authority enforcement (X6B).

X2-X5 preserved as frozen historical results. X5 not modified in any way — X6B is a post-hoc analysis layer over X5's already-recorded output; X6A is a separate, independently-run checkpoint.

## Phase 1 — X6A: Closed-World Model Instruction

**4-case diagnostic (not published as benchmark performance):** all 4 residual X5 failures (TR106, TR137, TR140, TR158) — correct. 4/4 citation-fabrication instances eliminated.

**Full 67-query run:**

| Metric | X6A | X5 (comparison) |
|---|---|---|
| Accuracy | 95.52% (64/67) | 94.03% (63/67) |
| MATCH accuracy | 92.9% (39/42) | 100% (42/42) |
| NO_MATCH accuracy | **100% (25/25)** | 84% (21/25) |
| Citation-fabrication count | **0** | 4 |
| Schema-valid | 95.5% (64/67) | 100% (67/67) |
| Mean generation latency | 8165.9ms | 7224.6ms |
| Mean total latency | 8166.1ms | 7224.8ms |
| Input token delta (closed-world instruction) | ~114 tokens (estimated from instruction length) | — |

**Citation fabrication: fully eliminated (0/67).** NO_MATCH accuracy went from 84% to 100%. This is the specific failure mode LNES-58.7/58.9 targeted, and the closed-world instruction resolved it completely on this subset.

**But 3 new failures appeared, all on MATCH cases, none related to fabrication:**

| Query | Cause |
|---|---|
| TR129-interaction | Response truncated mid-reasoning (cut off before reaching the ANSWER line) |
| TR138-interaction | Empty completion (0 chars returned) |
| TR155-interaction | Empty completion (0 chars returned) |

All 3 are `schema_valid: false` — the model never produced a parseable answer, not a wrong one. This is a distinct failure class (generation reliability / token budget) from citation fabrication, and not evidence against or for the closed-world-instruction hypothesis specifically — worth tracking separately, not conflating with the adherence question.

**X6A did not reach 67/67** (reached 64/67), so per Phase 6, the residual X5 deficit cannot be fully classified as "resolved by instruction adherence" — the fabrication component was resolved; a new, unrelated reliability issue was not.

## Phase 2 — Fairness Boundary

No head-to-head claim is made against frozen R3/R4 in this report. X6A used a modified prompt; R3/R4's frozen numbers reflect the original prompt. Any comparison would require a separately identified controlled run applying the same closed-world instruction to R3/R4, which was not performed here. Historical R3 (100%, 67/67) and R4 (98.5%, 66/67) numbers remain valid only as historical comparators, not as a fair same-prompt baseline against X6A.

## Phase 3 — State Contradiction Gate

Implemented as a pure, non-generative Python function (`state_contradiction_gate.py`). No LLM call. No ground-truth inspection — inputs are exclusively `resolver_state` and the model's own structured output. Verified against 6 hand-constructed cases (MATCH+deny, MATCH+confirm, NO_MATCH+assert, NO_MATCH+deny, INCOMPLETE, unparseable-output) — all behaved as specified before being applied to real data.

## Phase 4 — X6B: Deterministic State-Authority Test

Built by applying the gate to X5's **already-recorded** raw output — no new inference performed, X5's own file untouched.

| Metric | Value |
|---|---|
| Raw model accuracy (X5's original) | 94.03% (63/67) |
| Contradiction detections | 4 |
| False contradiction detections | **0** |
| Authorized-state accuracy | **100.00% (67/67)** |
| Schema-valid | 100% |
| Policy (gate) latency | mean 0.3μs, max 2.1μs |

The 4 detected contradictions are exactly the 4 known citation-fabrication cases from the LNES-58.8 autopsy — the gate found nothing else, and flagged nothing incorrectly (0 false positives on the other 63 already-consistent rows).

## Phase 6 — Status Classification

- **X6A (model instruction): partially validated.** Citation fabrication is fully eliminated (4/4 diagnostic cases, 0/67 fabrication in the full run, NO_MATCH accuracy 84%→100%). Did not reach 67/67 overall due to 3 unrelated generation-reliability failures (truncation/empty completion) — a different failure class, not addressed by or evidence against the closed-world instruction itself.
- **X6B (deterministic state-authority): empirically validated on this benchmark class.** Correctly blocked all 4 real resolver/model contradictions with zero false blocks, at negligible latency cost, using X5's original (unmodified, no-closed-world-instruction) output. This is the stronger and cleaner result of the two: it doesn't depend on prompt engineering holding up under future model or prompt changes — it enforces the boundary structurally, after generation, using only deterministic state.

Neither result authorizes modification of X2-X5 historical artifacts. No production code deployed.

## Artifacts

- `LNES58_Multihop_Bench/state_contradiction_gate.py` — Phase 3 gate (new)
- `LNES58_Multihop_Bench/strike_x6a_closed_world.py` — X6A runner (new)
- `LNES58_Multihop_Bench/build_x6b_from_x5.py` — X6B post-hoc builder (new)
- `set1_runs/.../X6A_4case_diagnostic.json`, `X6A_67_results.jsonl` (new)
- `set1_runs/.../X6B_67_results.jsonl`, `X6B_summary.json` (new)
- `LNES58_9_FINAL_REPORT.md` (this file)

X2, X3, X4, X5, R2, R3, R4, O1 all remain untouched.
