"""
LNES-59.2B post-generation processing: turn one raw model response into
the full preserved record (continuous-execution directive section 5),
apply the frozen retry policy's retryability classification, run the V7
gate for X1/X2, and score with comparator_metrics.py. No model call
happens here -- the raw_response is already in hand by the time this
runs.
"""

import time

from candidate_claim import parse_candidate_claim, to_model_output, CandidateClaimParseError
from state_consistency_gate_v2 import evaluate
from comparator_metrics import compute_case_arm_metrics
from deterministic_extraction import extract_case_state


def classify_failure(raw_response):
    """Returns None if the response parses cleanly, else a retryable
    error_state string per LNES59_RETRY_POLICY.json."""
    if raw_response is None or raw_response.strip() == "":
        return "empty_completion"
    try:
        parse_candidate_claim(raw_response)
        return None
    except CandidateClaimParseError:
        return "malformed_json"


def build_raw_result(case, arm, work_item, raw_response, docs_by_id,
                      attempts_log, retry_count, error_state=None):
    """attempts_log: list of {attempt_number, raw_response_or_None,
    error_state_or_None, timestamp} -- every attempt preserved, never
    overwritten (continuous-execution directive section 5/6)."""
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    record = {
        "case_id": case["case_id"], "arm": arm, "timestamp": timestamp,
        "retry_count": retry_count, "attempts_log": attempts_log,
        "retrieved_doc_ids": work_item.get("retrieved_doc_ids"),
        "latencies": work_item.get("latencies", {}),
        "error_state": error_state,
    }
    if error_state is not None:
        record["candidate_claim"] = None
        record["gate_outcome"] = None
        record["metrics"] = None
        return record

    claim = parse_candidate_claim(raw_response)
    record["raw_response"] = raw_response
    record["candidate_claim"] = claim

    gate_outcome = None
    if arm in ("X1", "X2"):
        committed = extract_case_state(
            case["grounding_document_ids"], case["predicate"], docs_by_id,
            compare_against_predicate=case.get("compare_against_predicate"),
        )
        record["resolved_state"] = {
            "resolution": committed.resolution.value, "claim_type": committed.claim_type.value,
            "authority_status": committed.authority_status.value, "temporal_status": committed.temporal_status.value,
            "value": committed.value, "historical_values": list(committed.historical_values or ()),
        }
        if arm == "X2":
            model_output = to_model_output(claim)
            t0 = time.time()
            decision = evaluate(committed, model_output)
            record["latencies"]["gate"] = time.time() - t0
            gate_outcome = decision.outcome.value
            record["gate_outcome"] = gate_outcome
            record["gate_reason"] = decision.reason
        else:
            record["gate_outcome"] = None  # X1 is deliberately ungoverned

    expected_state = case["expected_state"]
    record["metrics"] = compute_case_arm_metrics(
        expected_state, claim, gate_outcome=gate_outcome,
        retrieved_doc_ids=work_item.get("retrieved_doc_ids"),
        gold_grounding_ids=case["grounding_document_ids"],
        latencies=record["latencies"], retry_count=retry_count,
    )
    return record
