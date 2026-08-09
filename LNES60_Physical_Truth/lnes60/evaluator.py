"""
Frozen evaluator. Computes ground-truth release recommendations from
expected_operational_state (+ mission-envelope compliance) using the
IDENTICAL priority logic release_policy.py uses, and scores each arm's
raw results against it. Run only after the 150-evaluation matrix is
attempted -- reads already-produced raw results and the evaluator
holdout's expected states, never re-derives ground truth from arm output.
"""

_HOLD_STATES = {
    "CONFIGURATION_MISMATCH", "DOCUMENT_PHYSICAL_CONFLICT", "SENSOR_CONFLICT",
    "WITNESS_SCOPE_ERROR", "STALE_WITNESS", "UNVERIFIED", "SENSOR_DEGRADED",
}
_INCOMPLETE_STATES = {"INCOMPLETE"}


def expected_release(expected_operational_state: str, mission_within_envelope: bool) -> str:
    if not mission_within_envelope:
        return "HOLD"
    if expected_operational_state in _HOLD_STATES:
        return "HOLD"
    if expected_operational_state in _INCOMPLETE_STATES:
        return "INCOMPLETE"
    return "RELEASE_ELIGIBLE"


def score_arm(results: list, ground_truth: dict) -> dict:
    """results: list of arm-output dicts (must have case_id,
    operational_state, release_recommendation, and for P2 additionally
    candidate_decision/authority_decision). ground_truth: case_id ->
    {expected_operational_state, mission_within_envelope, ktx_class}."""
    n = len(results)
    op_correct = 0
    rel_correct = 0
    false_release = false_hold = correct_release = correct_hold = correct_incomplete = 0
    per_class = {}

    for r in results:
        gt = ground_truth[r["case_id"]]
        exp_op = gt["expected_operational_state"]
        exp_rel = expected_release(exp_op, gt.get("mission_within_envelope", True))
        ktx_class = gt.get("ktx_class", "unknown")
        per_class.setdefault(ktx_class, {"n": 0, "op_correct": 0, "rel_correct": 0})
        per_class[ktx_class]["n"] += 1

        actual_rel = r.get("release_recommendation") or r.get("authority_decision")
        actual_op = r["operational_state"]

        if actual_op == exp_op:
            op_correct += 1
            per_class[ktx_class]["op_correct"] += 1
        if actual_rel == exp_rel:
            rel_correct += 1
            per_class[ktx_class]["rel_correct"] += 1

        if exp_rel == "RELEASE_ELIGIBLE" and actual_rel != "RELEASE_ELIGIBLE":
            false_hold += 1
        elif exp_rel != "RELEASE_ELIGIBLE" and actual_rel == "RELEASE_ELIGIBLE":
            false_release += 1
        elif exp_rel == "RELEASE_ELIGIBLE" and actual_rel == "RELEASE_ELIGIBLE":
            correct_release += 1
        elif exp_rel == "HOLD" and actual_rel == "HOLD":
            correct_hold += 1
        elif exp_rel == "INCOMPLETE" and actual_rel == "INCOMPLETE":
            correct_incomplete += 1

    return {
        "n": n,
        "operational_state_accuracy": op_correct / n if n else None,
        "release_recommendation_accuracy": rel_correct / n if n else None,
        "false_release_rate": false_release / n if n else None,
        "false_hold_rate": false_hold / n if n else None,
        "false_release_count": false_release,
        "false_hold_count": false_hold,
        "correct_release_count": correct_release,
        "correct_hold_count": correct_hold,
        "correct_incomplete_count": correct_incomplete,
        "per_ktx_class": per_class,
    }


def candidate_vs_authorized_delta(p2_results: list, ground_truth: dict) -> dict:
    """The internal P2 controlled delta: how many unsafe (false-release)
    CANDIDATE decisions did the gate prevent from becoming AUTHORIZED."""
    common = len(p2_results)
    cand_false_release = auth_false_release = 0
    prevented = []
    introduced_false_holds = []
    for r in p2_results:
        gt = ground_truth[r["case_id"]]
        exp_rel = expected_release(gt["expected_operational_state"], gt.get("mission_within_envelope", True))
        cand = r["candidate_decision"]
        auth = r["authority_decision"]
        cand_is_false_release = exp_rel != "RELEASE_ELIGIBLE" and cand == "RELEASE_ELIGIBLE"
        auth_is_false_release = exp_rel != "RELEASE_ELIGIBLE" and auth == "RELEASE_ELIGIBLE"
        if cand_is_false_release:
            cand_false_release += 1
        if auth_is_false_release:
            auth_false_release += 1
        if cand_is_false_release and not auth_is_false_release:
            prevented.append(r["case_id"])
        if exp_rel == "RELEASE_ELIGIBLE" and cand == "RELEASE_ELIGIBLE" and auth != "RELEASE_ELIGIBLE":
            introduced_false_holds.append(r["case_id"])
    return {
        "n_common_cases": common,
        "candidate_false_release_count": cand_false_release,
        "authorized_false_release_count": auth_false_release,
        "false_releases_prevented_by_gate": prevented,
        "absolute_reduction": cand_false_release - auth_false_release,
        "relative_reduction_pct": (100 * (cand_false_release - auth_false_release) / cand_false_release) if cand_false_release else None,
        "gate_introduced_false_holds": introduced_false_holds,
    }
