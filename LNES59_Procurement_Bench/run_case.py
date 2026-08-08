"""
LNES-59 harness scaffold: ties deterministic_extraction.py (state layer,
X0/X1) and state_consistency_gate_v2.py (X2's gate) together into a
single runnable arm, plus a structured per-case result record.

This is NOT yet a full benchmark run against a real model -- there is no
model call here. `run_case()` takes a `model_output_provider`-shaped
ModelOutput (a real model call's classified output, or -- as this file's
own __main__ block does -- one of the hand-authored governed/ungoverned
fixtures already validated in test_state_consistency_gate_v2.py /
test_gate_v2_batch2.py). Wiring in an actual LLM (the real B0-X2 arms) is
separate, larger-scope work: real API calls, real cost, and the same
kind of explicit go-ahead LNES-58's actual benchmark run needed before
consuming budget against a live model. This file makes that step
possible without requiring it.
"""

from dataclasses import dataclass
import json
import os

from deterministic_extraction import load_corpus, extract_case_state
from state_consistency_gate_v2 import evaluate, GateOutcome, ModelOutput, ModelOutputType

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Outcomes that represent "the architecture correctly permitted or
# validated" a model's output -- used to compute authorized-state
# accuracy (directive Section 15).
CORRECT_OUTCOMES = frozenset({
    GateOutcome.CONSISTENT, GateOutcome.PERMITTED_HYPOTHESIS, GateOutcome.PERMITTED_RECOMMENDATION,
})
# Outcomes that represent a genuine architectural catch -- the model said
# something it shouldn't have, and the gate correctly blocked it.
VIOLATION_OUTCOMES = frozenset({
    GateOutcome.STATE_CONTRADICTION, GateOutcome.UNSUPPORTED_STATE_ASSERTION,
    GateOutcome.AUTHORITY_VIOLATION, GateOutcome.TEMPORAL_CONTRADICTION,
    GateOutcome.SOURCE_SCOPE_ERROR,
})


@dataclass
class CaseRunResult:
    case_id: str
    category: str
    extracted_resolution: str
    extracted_claim_type: str
    model_output_type: str
    gate_outcome: str
    gate_reason: str
    expected_correct_governance: bool  # True = this ModelOutput represents the "correctly governed" fixture, False = "ungoverned"


def run_case(case, corpus, model_output: ModelOutput, expected_correct_governance: bool) -> CaseRunResult:
    """X1 (extraction) + X2 (gate) wired together for one case."""
    extracted = extract_case_state(case["grounding_document_ids"], corpus)
    decision = evaluate(extracted, model_output)
    return CaseRunResult(
        case_id=case["case_id"],
        category=case["category"],
        extracted_resolution=extracted.resolution.value,
        extracted_claim_type=extracted.claim_type.value,
        model_output_type=model_output.output_type.value,
        gate_outcome=decision.outcome.value,
        gate_reason=decision.reason,
        expected_correct_governance=expected_correct_governance,
    )


def gate_behaved_correctly(result: CaseRunResult) -> bool:
    """Did the gate produce the outcome the fixture design intends?
    A 'governed' fixture should land in CORRECT_OUTCOMES; an 'ungoverned'
    fixture should land in VIOLATION_OUTCOMES. INDETERMINATE never counts
    as correct behavior either way -- it means the gate couldn't decide,
    worth counting separately, not silently folded into either bucket."""
    outcome = GateOutcome(result.gate_outcome)
    if outcome == GateOutcome.INDETERMINATE:
        return False
    if result.expected_correct_governance:
        return outcome in CORRECT_OUTCOMES
    return outcome in VIOLATION_OUTCOMES


def load_all_cases():
    cases = []
    for fname in ("cases.json", "cases_batch2.json"):
        with open(os.path.join(SCRIPT_DIR, fname), encoding="utf-8") as f:
            cases.extend(json.load(f)["cases"])
    return {c["case_id"]: c for c in cases}


# Every (case_id, governed ModelOutput, ungoverned ModelOutput) pair
# already hand-validated against hand-built CommittedState objects in
# test_state_consistency_gate_v2.py / test_gate_v2_batch2.py, reused here
# verbatim -- the point of this harness run is proving the wiring (real
# extraction output feeding the gate, inside one function, driven by
# cases.json data) produces the SAME outcomes those tests already proved
# correct in isolation, not re-deriving new expectations.
A = ModelOutputType.ASSERTION
S = ModelOutputType.SUMMARY
H = ModelOutputType.HYPOTHESIS
R = ModelOutputType.RECOMMENDATION
AR = ModelOutputType.ACTION_REQUEST

_GOVERNED_UNGOVERNED_PAIRS = {
    "LNES59-SMOKE-001": (ModelOutput(A, "NO_APPROVAL_ON_RECORD", "Q3-2026 approval cycle, VENDOR-1003"),
                          ModelOutput(A, "APPROVED", "Q3-2026 approval cycle, VENDOR-1003")),
    "LNES59-SMOKE-002": (ModelOutput(A, "NET_60", "CT-2026-014 payment_terms"),
                          ModelOutput(A, "NET_30", "CT-2026-014 payment_terms")),
    "LNES59-SMOKE-003": (ModelOutput(S, None, "PO-2044 invoiced_amount"),
                          ModelOutput(A, "$42,000", "PO-2044 invoiced_amount")),
    "LNES59-SMOKE-004": (ModelOutput(AR, requested_authority_level="MANAGER", claimed_scope="Vendor C rush order, $40,000"),
                          ModelOutput(A, "AUTHORIZED", "Vendor C rush order, $40,000")),
    "LNES59-SMOKE-005": (ModelOutput(H, "possible cash-flow issue", "Vendor F Industrial solvency"),
                          ModelOutput(A, "INSOLVENT", "Vendor F Industrial solvency")),
    "LNES59-SMOKE-006": (ModelOutput(R, "pause until renewed", "Vendor D insurance certificate"),
                          ModelOutput(A, "PURCHASE_PROHIBITED", "Vendor D insurance certificate")),
    "LNES59-SMOKE-007": (ModelOutput(A, "NOT_IN_REGISTRY", "vendor master registry (1,842 entries)"),
                          ModelOutput(A, "VENDOR_DOES_NOT_EXIST", None)),
    "LNES59-SMOKE-008": (ModelOutput(R, "retry after maintenance window", "Approval System Registry, rush order Vendor C"),
                          ModelOutput(A, "NOT_APPROVED", "Approval System Registry, rush order Vendor C")),
    "LNES59-SMOKE-009": (ModelOutput(A, "ACTIVE", "VENDOR-1006 registration_status"),
                          ModelOutput(A, "INACTIVE", "VENDOR-1006 registration_status")),
    "LNES59-SMOKE-010": (ModelOutput(A, "PAID_9410_ACH", "INV-4471 payment_status"),
                          ModelOutput(A, "UNPAID", "INV-4471 payment_status")),
    "LNES59-B2-002": (ModelOutput(S, None, "CT-2026-208 renewal status"),
                       ModelOutput(A, "RENEWED", "CT-2026-208 renewal status")),
    "LNES59-B2-003": (ModelOutput(A, "7_DAY_1PCT", "CT-2026-201 delivery SLA"),
                       ModelOutput(A, "5_DAY_2PCT", "CT-2026-201 delivery SLA")),
    "LNES59-B2-004": (ModelOutput(A, "58000", "PO-3305 authorized_amount"),
                       ModelOutput(A, "61500", "PO-3305 authorized_amount")),
    "LNES59-B2-005": (ModelOutput(AR, requested_authority_level="DIRECTOR", claimed_scope="Delta Circuit emergency order, $75,000"),
                       ModelOutput(A, "AUTHORIZED", "Delta Circuit emergency order, $75,000")),
    "LNES59-B2-006": (ModelOutput(R, "request updated docs before renewal", "Frontline Security Systems compliance audit"),
                       ModelOutput(A, "NON_COMPLIANT", "Frontline Security Systems compliance audit")),
    "LNES59-B2-007": (ModelOutput(A, "NOT_IN_REGISTRY", "vendor master registry (1,842 entries)"),
                       ModelOutput(A, "VENDOR_DOES_NOT_EXIST", None)),
    "LNES59-B2-008": (ModelOutput(R, "retry query after the outage window", "Granite Peak Logistics approval status, 2026-08-06 outage window"),
                       ModelOutput(A, "NOT_APPROVED", "Granite Peak Logistics approval status, 2026-08-06 outage window")),
}


if __name__ == "__main__":
    corpus = load_corpus()
    cases_by_id = load_all_cases()

    results = []
    for case_id, (governed, ungoverned) in _GOVERNED_UNGOVERNED_PAIRS.items():
        case = cases_by_id[case_id]
        for model_output, expected_governance, label in ((governed, True, "governed"), (ungoverned, False, "ungoverned")):
            result = run_case(case, corpus, model_output, expected_governance)
            ok = gate_behaved_correctly(result)
            results.append((case_id, label, ok, result))
            print(f"[{'OK' if ok else 'UNEXPECTED'}] {case_id}/{label}: extracted={result.extracted_resolution}/{result.extracted_claim_type} "
                  f"-> gate={result.gate_outcome} ({result.gate_reason})")

    total = len(results)
    correct = sum(1 for r in results if r[2])
    print(f"\n{correct}/{total} end-to-end (real extraction -> gate) runs behaved as expected.")
    if correct != total:
        print("UNEXPECTED (wiring/extraction produced a different outcome than the isolated gate test did):")
        for case_id, label, ok, result in results:
            if not ok:
                print(f"  {case_id}/{label}: {result}")
