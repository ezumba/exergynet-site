"""
LNES-59 metrics (directive Section 15). R&D / benchmark only.

Computes what's genuinely calculable from the current harness's mock/
fixture data (run_case.py's hand-verified ModelOutput pairs run through
the REAL extraction+gate pipeline). Several directive-listed metrics
(evidence tokens/query, retrieval/generation/gate latency, generation
latency) require an actual model call to exist at all -- there is none
yet (see run_case.py's own module docstring: B0-X2 comparator arms are
separate, larger-scope work needing explicit go-ahead for real API cost).
This module reports those as NOT_APPLICABLE rather than a fabricated
number, per the directive's own explicit instruction (Section 12: "If
not: DO NOT speculate... Record: NOT_TESTED").
"""

import json
import os
import time

from deterministic_extraction import load_corpus, extract_case_state
from state_consistency_gate_v2 import evaluate, GateOutcome, ClaimType, ResolutionState
from run_case import load_all_cases, run_case, gate_behaved_correctly, _FIXTURES

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

CORRECT_OUTCOMES = frozenset({GateOutcome.CONSISTENT, GateOutcome.PERMITTED_HYPOTHESIS, GateOutcome.PERMITTED_RECOMMENDATION})
VIOLATION_OUTCOMES = frozenset({
    GateOutcome.STATE_CONTRADICTION, GateOutcome.UNSUPPORTED_STATE_ASSERTION,
    GateOutcome.AUTHORITY_VIOLATION, GateOutcome.TEMPORAL_CONTRADICTION, GateOutcome.SOURCE_SCOPE_ERROR,
})


def compute_metrics():
    corpus = load_corpus()
    cases_by_id = load_all_cases()

    # ── authorized-state accuracy: exact-match against each fixture's own
    # expected gate outcome (what run_case.py's harness already checks,
    # aggregated here). This IS "raw model accuracy" and "authorized-state
    # accuracy" collapsed into one number for now, because every fixture's
    # ModelOutput was hand-designed to BE either correctly-governed or a
    # specific known failure mode -- there is no real model in the loop
    # yet whose raw (ungated) output could diverge from its gated output
    # in a way worth reporting as two separate numbers. Once B0-X2 run
    # real models, this split becomes meaningful and should be recomputed
    # properly, not estimated from mock data.
    results = []
    gate_latencies_us = []
    for case_id, label, model_output, expected_outcome in _FIXTURES:
        case = cases_by_id[case_id]
        t0 = time.perf_counter()
        result = run_case(case, corpus, model_output, expected_outcome)
        gate_latencies_us.append((time.perf_counter() - t0) * 1_000_000)
        results.append(result)

    total = len(results)
    authorized_state_correct = sum(1 for r in results if gate_behaved_correctly(r))

    # ── MATCH / NO_MATCH / INCOMPLETE correctness: compare the pipeline's
    # extracted resolution against each case's own hand-authored
    # expected_state.resolution (ground truth independently authored
    # before the pipeline saw the case -- same data
    # validate_extraction_against_cases.py checks, aggregated per
    # resolution type here). ──
    resolution_correct = {"MATCH": [0, 0], "NO_MATCH": [0, 0], "INCOMPLETE": [0, 0]}  # [correct, total]
    for case in cases_by_id.values():
        expected_res = case["expected_state"].get("resolution")
        if expected_res not in resolution_correct:
            continue
        extracted = extract_case_state(
            case["grounding_document_ids"], case["predicate"], corpus,
            compare_against_predicate=case.get("compare_against_predicate"),
        )
        resolution_correct[expected_res][1] += 1
        if extracted.resolution.value == expected_res:
            resolution_correct[expected_res][0] += 1

    # ── state contradiction / unsupported-assertion detection and their
    # false-positive counterparts, computed from the same fixture set:
    # a fixture whose expected_outcome is in VIOLATION_OUTCOMES is a case
    # the gate SHOULD flag; one in CORRECT_OUTCOMES is one it SHOULD NOT. ──
    should_flag = [r for r in results if GateOutcome(r.expected_outcome) in VIOLATION_OUTCOMES]
    should_pass = [r for r in results if GateOutcome(r.expected_outcome) in CORRECT_OUTCOMES]
    correctly_flagged = sum(1 for r in should_flag if GateOutcome(r.gate_outcome) in VIOLATION_OUTCOMES)
    false_flags = sum(1 for r in should_pass if GateOutcome(r.gate_outcome) in VIOLATION_OUTCOMES)

    return {
        "n_cases": len(cases_by_id),
        "n_fixture_runs": total,
        "raw_model_accuracy": "NOT_APPLICABLE -- no real model in the loop yet; every fixture's ModelOutput was hand-authored to represent a specific known-correct or known-failure behavior, not sampled from an actual model",
        "authorized_state_accuracy": f"{authorized_state_correct}/{total} ({100*authorized_state_correct/total:.1f}%)",
        "resolution_correctness": {
            k: (f"{c}/{t} ({100*c/t:.1f}%)" if t else "NOT_APPLICABLE -- no cases of this resolution type yet")
            for k, (c, t) in resolution_correct.items()
        },
        # NOTE on naming: "detection" metrics are framed as X/Y where X is
        # the count of the NAMED EVENT and higher is better for the first,
        # lower is better for the second -- state_contradiction_detection
        # 26/26 means "caught 26 of 26 real violations" (good, high);
        # false_contradiction_rate 0/24 means "0 of 24 correct fixtures
        # were WRONGLY flagged" (good, low). Kept as separate, differently-
        # named keys specifically so a reader can't misread a 0% rate as a
        # bad detection score by pattern-matching the wrong field.
        "state_contradiction_detection": (
            f"{correctly_flagged}/{len(should_flag)} ({100*correctly_flagged/len(should_flag):.1f}% of real violations caught)" if should_flag else "NOT_APPLICABLE"
        ),
        "false_contradiction_rate": (
            f"{false_flags}/{len(should_pass)} ({100*false_flags/len(should_pass):.1f}% of correct fixtures wrongly flagged -- lower is better, 0% is ideal)" if should_pass else "NOT_APPLICABLE"
        ),
        "claim_type_accuracy": "NOT_APPLICABLE -- would require a per-case hand-authored expected claim_type as a strictly-typed field (currently free-form prose in claim_type_present); tracked as follow-up, see LNES59_STATE_SCHEMA.md",
        "authority_status_accuracy": "NOT_APPLICABLE -- same reason as claim_type_accuracy; only the 4 policy_authority cases have this meaningfully exercised so far (see state_consistency_gate_v2's POLICY_TIERS unit tests for direct, isolated coverage of this specific mechanism instead)",
        "temporal_state_accuracy": "NOT_APPLICABLE -- same reason; direct coverage exists via B3-001's multi-hop supersession case and STRUCTURAL note (13) in LNES59_FAILURE_TAXONOMY.md",
        "evidence_tokens_per_query": "NOT_APPLICABLE -- no retrieval/prompt-construction step exists yet (comparator arms not built)",
        "retrieval_latency": "NOT_APPLICABLE -- no retrieval arm exists yet",
        "state_resolution_latency_us_mean": (
            f"{sum(gate_latencies_us)/len(gate_latencies_us):.1f}us (extraction + gate combined -- this benchmark doesn't yet separate the two; both are pure Python, no I/O, so this number is dominated by interpreter overhead, not meaningful architecture cost)"
        ),
        "generation_latency": "NOT_APPLICABLE -- no model call exists yet",
        "total_latency": "NOT_APPLICABLE -- same reason",
    }


if __name__ == "__main__":
    m = compute_metrics()
    print(json.dumps(m, indent=2))
