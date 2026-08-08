# LNES-59.2B Metrics Specification

Implemented in `comparator_metrics.py`, unit-tested in
`test_comparator_metrics.py` (40/40 passing, synthetic fixtures only)
BEFORE any holdout execution, per comparator spec section 17. Named
distinctly from the pre-existing `metrics.py` (an earlier-phase module,
predating B0-X2 entirely, that computes accuracy from the deterministic
regression-suite fixtures and explicitly reports anything requiring a
real model call as NOT_APPLICABLE) -- that module is untouched and
remains valid for its own original purpose.

| Metric | Definition | Applies to |
|---|---|---|
| `resolution_accuracy` | Does the claim's shape (FACT/HYPOTHESIS/SUMMARY/etc.) respect the case's expected resolution (INCOMPLETE can't ground a bare FACT; NO_MATCH needs a scoped negative FACT)? | all 8 arms |
| `candidate_state_correctness` | Pre-governance correctness of the CandidateClaim itself: resolution-shape + value match (via the same `values_match()` the gate uses). | all 8 arms |
| `authorized_state_correctness` | Post-governance correctness. For X2: did the gate's actual outcome (allow/block) end up correct given whether the candidate itself was right? For every other arm (no gate): identical to `candidate_state_correctness`. | all 8 arms, gate-aware for X2 |
| `false_authoritative_state` (**primary metric, section 21.A/B**) | The arm ended up asserting a FACT that is not correct, AND nothing blocked it (ungoverned arms: any wrong FACT; X2: only if the gate's outcome was CONSISTENT). | all 8 arms |
| `false_block` (**primary metric, section 21.C**) | X2 only: the candidate was actually correct but the gate blocked it anyway -- the real cost of governance. | X2 |
| `false_allow` | X2 only: the gate returned CONSISTENT for a candidate that was actually wrong -- the gate's own failure mode. | X2 |
| `hypothesis_preserved` / `recommendation_preserved` (**section 21.D**) | For cases earmarking a HYPOTHESIS/RECOMMENDATION response: was it actually produced, and (if governed) correctly permitted? | all 8 arms |
| `evidence_recall` / `evidence_precision` (**section 21.F**) | B1/B2/B3 only: overlap between retrieved chunk doc_ids and the case's true `grounding_document_ids` (evaluator-only, used solely for post-hoc scoring, never supplied to the retrieval step itself). | B1, B2, B3 |
| Latencies: `retrieval`, `reranker`, `state_resolution`, `generation`, `gate`, `total` | Wall-clock seconds per stage, measured at execution time, passed through into the per-case-arm record unmodified by `comparator_metrics.py`. | arm-dependent (e.g. no `reranker` latency for B0/B4/X0-X2) |
| Tokens: `supplied`, `generated` | Prompt/response token counts, measured at execution time. | all 8 arms |
| `retry_count` | Number of retries consumed per `LNES59_RETRY_POLICY.json`, tracked separately from correctness metrics. | all 8 arms |

## Design notes

- `raw_answer_correctness` and `candidate_state_correctness` both reuse
  `state_consistency_gate_v2.values_match()` rather than a second,
  independently-invented string-comparison heuristic -- one definition of
  "matches" across the whole project, including its documented, disclosed
  limitations (taxonomy #17/#22).
- `false_authoritative_state` is deliberately gate-outcome-aware: an
  ungoverned arm's wrong FACT is *always* a false authoritative state
  (nothing stopped it); X2's wrong FACT is only a false authoritative
  state if the gate's own outcome was CONSISTENT (i.e. the gate failed to
  catch it) -- if the gate blocked it, that's correctly-governed
  behavior, not a false authoritative state, and is instead counted (if
  the candidate was actually wrong) as neither a false block nor a false
  allow, just correct governance.
- Every metric function is a pure function over already-produced
  records -- none of them call a model, touch the holdout, or run
  retrieval. They exist purely to score outputs that execution already
  produced.
