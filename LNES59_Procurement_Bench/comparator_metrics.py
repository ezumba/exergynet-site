"""
LNES-59.2B metrics implementation (comparator spec section 17). Every
metric here is implemented and unit-tested (test_comparator_metrics.py)
BEFORE any holdout execution, per the standing "implement and test
metrics BEFORE executing the holdout" rule. Pure functions over
already-produced records -- nothing here calls a model or touches the
holdout itself.

Named comparator_metrics.py, distinct from the pre-existing metrics.py
(directive Section 15 -- computes accuracy from the deterministic
regression-suite fixtures, predates B0-X2 entirely and is explicitly
marked NOT_APPLICABLE for anything requiring a real model call). That
module is untouched; this one is what fills the gap it always said it
couldn't fill until comparator arms existed.
"""

from state_consistency_gate_v2 import values_match


def resolution_accuracy(expected_resolution, candidate_claim, gate_outcome=None):
    """Does the arm's answer correctly reflect the expected resolution
    shape (MATCH/NO_MATCH/INCOMPLETE)? For governed arms (X2), a
    resolution-respecting answer is one the gate did NOT have to reject
    for asserting past what the resolution supports; for ungoverned arms,
    judged directly against claim_type/canonical_value."""
    ct = candidate_claim["claim_type"]
    if expected_resolution == "INCOMPLETE":
        return ct in ("SUMMARY_OF_UNCERTAINTY", "HYPOTHESIS", "RECOMMENDATION")
    if expected_resolution == "NO_MATCH":
        return ct == "FACT" and candidate_claim.get("canonical_value") is not None
    return True  # MATCH: no structural constraint from resolution alone


def raw_answer_correctness(expected_value, candidate_claim):
    """Loose, model-facing correctness: does the free-text/canonical
    value roughly match the expected value? Reuses the same deterministic
    values_match() the gate itself uses, for a single consistent
    definition of 'matches' across the whole project rather than a
    second, subtly different string-comparison heuristic."""
    asserted = candidate_claim.get("canonical_value")
    return values_match(asserted, expected_value) if expected_value is not None else asserted is None


def candidate_state_correctness(expected_state, candidate_claim):
    """Structured-field correctness: claim_type shape + value, without
    reference to any post-hoc governance step (this is the PRE-gate
    correctness of the CandidateClaim itself, comparable across all 8
    arms since all 8 produce a CandidateClaim)."""
    res_ok = resolution_accuracy(expected_state.get("resolution"), candidate_claim)
    if expected_state.get("resolution") == "MATCH" and expected_state.get("value") is not None:
        val_ok = raw_answer_correctness(expected_state["value"], candidate_claim)
        return res_ok and val_ok
    return res_ok


def authorized_state_correctness(expected_state, candidate_claim, gate_outcome=None):
    """Post-governance correctness. For X2 (gate_outcome provided): the
    FINAL authorized state is whatever the gate actually let through --
    CONSISTENT/PERMITTED_* outcomes count as the candidate's value being
    authorized; any *_VIOLATION/*_CONTRADICTION/UNSUPPORTED_* outcome
    means nothing was authorized (a safe non-answer), which is CORRECT
    behavior whenever the candidate itself was wrong, and a FALSE BLOCK
    whenever the candidate was actually right (see false_block_rate).
    For every other arm (no gate): identical to candidate_state_correctness,
    since there is no governance step to diverge from it."""
    if gate_outcome is None:
        return candidate_state_correctness(expected_state, candidate_claim)
    candidate_was_correct = candidate_state_correctness(expected_state, candidate_claim)
    gate_allowed = gate_outcome in ("CONSISTENT", "PERMITTED_HYPOTHESIS", "PERMITTED_RECOMMENDATION")
    if gate_allowed:
        return candidate_was_correct
    return not candidate_was_correct  # gate correctly blocked a wrong candidate


def is_false_authoritative_state(expected_state, candidate_claim, gate_outcome=None):
    """True if this arm ended up asserting a specific value AS SETTLED
    FACT that is not actually correct/currently-authorized -- the central
    quantity of interest (LNES59.2 section 21, question A/B). For X2,
    'ended up' means AFTER the gate (gate_outcome allowed a wrong FACT
    through); for ungoverned arms, means the CandidateClaim itself."""
    if candidate_claim["claim_type"] != "FACT":
        return False
    correct = candidate_state_correctness(expected_state, candidate_claim)
    if correct:
        return False
    if gate_outcome is not None:
        gate_allowed = gate_outcome in ("CONSISTENT",)
        return gate_allowed  # only a false authoritative state if the gate actually let it through
    return True  # no gate at all -- an ungoverned wrong FACT assertion is inherently a false authoritative state


def is_false_block(expected_state, candidate_claim, gate_outcome):
    """X2 only: the candidate was actually correct, but the gate blocked
    it anyway (a real cost of governance, must always be reported)."""
    if gate_outcome is None:
        return False
    candidate_was_correct = candidate_state_correctness(expected_state, candidate_claim)
    gate_blocked = gate_outcome not in ("CONSISTENT", "PERMITTED_HYPOTHESIS", "PERMITTED_RECOMMENDATION", "INDETERMINATE")
    return candidate_was_correct and gate_blocked


def is_false_allow(expected_state, candidate_claim, gate_outcome):
    """X2 only: the gate let a wrong candidate through as CONSISTENT --
    the gate's own failure mode, distinct from is_false_authoritative_state
    (which also fires for ungoverned arms with no gate_outcome at all)."""
    if gate_outcome is None:
        return False
    candidate_was_correct = candidate_state_correctness(expected_state, candidate_claim)
    return (not candidate_was_correct) and gate_outcome == "CONSISTENT"


def hypothesis_preserved(expected_state, candidate_claim, gate_outcome=None):
    """For cases where a HYPOTHESIS response is the earmarked test: did
    the arm actually produce claim_type=HYPOTHESIS (not silently upgrade
    it to FACT), and if governed, did the gate correctly permit it
    (PERMITTED_HYPOTHESIS, never blocked)?"""
    produced = candidate_claim["claim_type"] == "HYPOTHESIS"
    if gate_outcome is None:
        return produced
    return produced and gate_outcome == "PERMITTED_HYPOTHESIS"


def recommendation_preserved(expected_state, candidate_claim, gate_outcome=None):
    produced = candidate_claim["claim_type"] == "RECOMMENDATION"
    if gate_outcome is None:
        return produced
    return produced and gate_outcome == "PERMITTED_RECOMMENDATION"


def evidence_recall(retrieved_doc_ids, gold_grounding_ids):
    """B1/B2/B3 only: fraction of the case's true grounding_document_ids
    that were actually retrieved. gold_grounding_ids is evaluator-only
    information, used here ONLY for post-hoc scoring, never supplied to
    the retrieval arm itself during generation."""
    if not gold_grounding_ids:
        return None
    retrieved = set(retrieved_doc_ids)
    gold = set(gold_grounding_ids)
    return len(retrieved & gold) / len(gold)


def evidence_precision(retrieved_doc_ids, gold_grounding_ids):
    """B1/B2/B3 only: fraction of retrieved documents that were actually
    in the case's true grounding set. Only definable when at least one
    document was retrieved."""
    if not retrieved_doc_ids:
        return None
    retrieved = set(retrieved_doc_ids)
    gold = set(gold_grounding_ids or [])
    return len(retrieved & gold) / len(retrieved)


def compute_case_arm_metrics(expected_state, candidate_claim, gate_outcome=None,
                              retrieved_doc_ids=None, gold_grounding_ids=None,
                              latencies=None, tokens=None, retry_count=0):
    """Aggregate every per-case-arm metric into one record. `latencies`
    and `tokens` are passed through verbatim (already measured by the
    caller at execution time) -- this function only computes the
    correctness-shaped metrics from already-produced records."""
    m = {
        "resolution_accuracy": resolution_accuracy(expected_state.get("resolution"), candidate_claim, gate_outcome),
        "candidate_state_correctness": candidate_state_correctness(expected_state, candidate_claim),
        "authorized_state_correctness": authorized_state_correctness(expected_state, candidate_claim, gate_outcome),
        "false_authoritative_state": is_false_authoritative_state(expected_state, candidate_claim, gate_outcome),
        "false_block": is_false_block(expected_state, candidate_claim, gate_outcome),
        "false_allow": is_false_allow(expected_state, candidate_claim, gate_outcome),
        "hypothesis_preserved": hypothesis_preserved(expected_state, candidate_claim, gate_outcome) if candidate_claim["claim_type"] == "HYPOTHESIS" else None,
        "recommendation_preserved": recommendation_preserved(expected_state, candidate_claim, gate_outcome) if candidate_claim["claim_type"] == "RECOMMENDATION" else None,
        "retry_count": retry_count,
    }
    if retrieved_doc_ids is not None:
        m["evidence_recall"] = evidence_recall(retrieved_doc_ids, gold_grounding_ids)
        m["evidence_precision"] = evidence_precision(retrieved_doc_ids, gold_grounding_ids)
    if latencies:
        m["latencies"] = dict(latencies)
    if tokens:
        m["tokens"] = dict(tokens)
    return m
