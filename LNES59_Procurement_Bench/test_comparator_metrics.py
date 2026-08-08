"""
Unit tests for comparator_metrics.py (comparator spec section 17's
"implement and unit-test before holdout execution begins"). Entirely
synthetic fixtures -- no holdout content, no real model calls.
"""

from comparator_metrics import (
    resolution_accuracy, raw_answer_correctness, candidate_state_correctness,
    authorized_state_correctness, is_false_authoritative_state, is_false_block,
    is_false_allow, hypothesis_preserved, recommendation_preserved,
    evidence_recall, evidence_precision, compute_case_arm_metrics,
)

FACT = lambda value: {"claim_type": "FACT", "canonical_value": value, "displayed_value": value}
HYPOTHESIS = {"claim_type": "HYPOTHESIS", "canonical_value": None, "displayed_value": "maybe"}
SUMMARY = {"claim_type": "SUMMARY_OF_UNCERTAINTY", "canonical_value": None, "displayed_value": "unclear"}
RECOMMENDATION = {"claim_type": "RECOMMENDATION", "canonical_value": None, "displayed_value": "retry later"}

CHECKS = []


def check(label, got, expected):
    ok = got == expected
    CHECKS.append(ok)
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {label}: got {got!r} (expected {expected!r})")


# --- resolution_accuracy ---
check("resolution: INCOMPLETE + SUMMARY -> True", resolution_accuracy("INCOMPLETE", SUMMARY), True)
check("resolution: INCOMPLETE + FACT -> False", resolution_accuracy("INCOMPLETE", FACT("X")), False)
check("resolution: NO_MATCH + FACT with value -> True", resolution_accuracy("NO_MATCH", FACT("NOT_IN_REGISTRY")), True)
check("resolution: NO_MATCH + SUMMARY -> False", resolution_accuracy("NO_MATCH", SUMMARY), False)
check("resolution: MATCH + anything -> True (no structural constraint)", resolution_accuracy("MATCH", HYPOTHESIS), True)

# --- raw_answer_correctness / candidate_state_correctness ---
check("raw correctness: exact match", raw_answer_correctness("ACTIVE", FACT("ACTIVE")), True)
check("raw correctness: mismatch", raw_answer_correctness("ACTIVE", FACT("INACTIVE")), False)
check("raw correctness: expected None, candidate has no value -> True", raw_answer_correctness(None, SUMMARY), True)

expected_match = {"resolution": "MATCH", "value": "21500"}
check("candidate_state_correctness: correct FACT", candidate_state_correctness(expected_match, FACT("21500")), True)
check("candidate_state_correctness: wrong FACT", candidate_state_correctness(expected_match, FACT("18000")), False)
check("candidate_state_correctness: hedge on a real MATCH -- still resolution-legal (True) but value not confirmed",
      resolution_accuracy("MATCH", SUMMARY), True)

expected_incomplete = {"resolution": "INCOMPLETE"}
check("candidate_state_correctness: honest hedge under INCOMPLETE", candidate_state_correctness(expected_incomplete, SUMMARY), True)
check("candidate_state_correctness: bare FACT under INCOMPLETE is wrong", candidate_state_correctness(expected_incomplete, FACT("VALID")), False)

# --- authorized_state_correctness (governance layer) ---
check("authorized: X2 correctly blocks a wrong FACT (STATE_CONTRADICTION) -> correct outcome",
      authorized_state_correctness(expected_match, FACT("18000"), gate_outcome="STATE_CONTRADICTION"), True)
check("authorized: X2 blocks a CORRECT FACT (false block) -> incorrect outcome",
      authorized_state_correctness(expected_match, FACT("21500"), gate_outcome="TEMPORAL_CONTRADICTION"), False)
check("authorized: X2 allows a correct FACT -> correct outcome",
      authorized_state_correctness(expected_match, FACT("21500"), gate_outcome="CONSISTENT"), True)
check("authorized: X2 allows a WRONG FACT (false allow) -> incorrect outcome",
      authorized_state_correctness(expected_match, FACT("18000"), gate_outcome="CONSISTENT"), False)
check("authorized: no gate (X1/B0-B4) -- identical to candidate_state_correctness",
      authorized_state_correctness(expected_match, FACT("21500"), gate_outcome=None), True)

# --- false_authoritative_state / false_block / false_allow ---
check("false_authoritative_state: ungoverned wrong FACT (X1/B-arms) -> True",
      is_false_authoritative_state(expected_match, FACT("18000"), gate_outcome=None), True)
check("false_authoritative_state: X2 blocks the same wrong FACT -> False (gate caught it)",
      is_false_authoritative_state(expected_match, FACT("18000"), gate_outcome="STATE_CONTRADICTION"), False)
check("false_authoritative_state: X2 lets the wrong FACT through -> True (false allow become false auth state)",
      is_false_authoritative_state(expected_match, FACT("18000"), gate_outcome="CONSISTENT"), True)
check("false_authoritative_state: correct FACT -> never a false authoritative state",
      is_false_authoritative_state(expected_match, FACT("21500"), gate_outcome=None), False)
check("false_authoritative_state: HYPOTHESIS is never a FACT claim -> False regardless of correctness",
      is_false_authoritative_state(expected_match, HYPOTHESIS, gate_outcome=None), False)

check("false_block: correct FACT blocked -> True",
      is_false_block(expected_match, FACT("21500"), "TEMPORAL_CONTRADICTION"), True)
check("false_block: wrong FACT blocked -> False (correctly blocked)",
      is_false_block(expected_match, FACT("18000"), "STATE_CONTRADICTION"), False)
check("false_block: no gate -> False (concept doesn't apply)",
      is_false_block(expected_match, FACT("21500"), None), False)

check("false_allow: wrong FACT allowed -> True",
      is_false_allow(expected_match, FACT("18000"), "CONSISTENT"), True)
check("false_allow: correct FACT allowed -> False (correctly allowed)",
      is_false_allow(expected_match, FACT("21500"), "CONSISTENT"), False)

# --- hypothesis / recommendation preservation ---
check("hypothesis_preserved: produced + gate permits", hypothesis_preserved({}, HYPOTHESIS, "PERMITTED_HYPOTHESIS"), True)
check("hypothesis_preserved: produced but ungoverned (no gate) -> True by production alone",
      hypothesis_preserved({}, HYPOTHESIS, None), True)
check("hypothesis_preserved: not produced (FACT instead)", hypothesis_preserved({}, FACT("X"), None), False)
check("recommendation_preserved: produced + gate permits",
      recommendation_preserved({}, RECOMMENDATION, "PERMITTED_RECOMMENDATION"), True)

# --- evidence recall / precision ---
check("evidence_recall: full overlap", evidence_recall(["A", "B"], ["A", "B"]), 1.0)
check("evidence_recall: half overlap", evidence_recall(["A", "C"], ["A", "B"]), 0.5)
check("evidence_recall: no gold -> None", evidence_recall(["A"], []), None)
check("evidence_precision: half precision", evidence_precision(["A", "C"], ["A", "B"]), 0.5)
check("evidence_precision: nothing retrieved -> None", evidence_precision([], ["A"]), None)

# --- compute_case_arm_metrics smoke test ---
agg = compute_case_arm_metrics(expected_match, FACT("21500"), gate_outcome="CONSISTENT",
                                retrieved_doc_ids=["DOC-A", "DOC-B"], gold_grounding_ids=["DOC-A"],
                                latencies={"generation": 1.2}, tokens={"supplied": 500}, retry_count=0)
check("compute_case_arm_metrics: aggregate correctness True", agg["candidate_state_correctness"], True)
check("compute_case_arm_metrics: evidence_recall present", agg["evidence_recall"], 1.0)
check("compute_case_arm_metrics: evidence_precision present", agg["evidence_precision"], 0.5)

print()
print(f"{sum(CHECKS)}/{len(CHECKS)} comparator metrics checks passed.")
if sum(CHECKS) != len(CHECKS):
    raise SystemExit(1)
