"""
LNES-59 Phase 5 Section 11: identical INCOMPLETE evidence, different
model output_types, different correctly-governed outcomes. Against a
REAL corpus-grounded case (LNES59-B4-004, Meridian Cove Logistics --
documents_batch4.json).

DEVELOPMENT RESULTS -- NON-BLIND.

Run: python3 test_open_world_claim_types.py
"""

from deterministic_extraction import load_corpus, extract_case_state
from state_consistency_gate_v2 import evaluate, ModelOutput, ModelOutputType as M, GateOutcome as O
import json

with open("cases_batch4.json", encoding="utf-8") as f:
    case = next(c for c in json.load(f)["cases"] if c["case_id"] == "LNES59-B4-004")

corpus = load_corpus()
committed = extract_case_state(case["grounding_document_ids"], case["predicate"], corpus)
print(f"Committed state: resolution={committed.resolution.value}, value={committed.value!r}\n")

variants = [
    ("ASSERTION -- unsupported", M.ASSERTION, "Vendor insurance is current.", O.UNSUPPORTED_STATE_ASSERTION),
    ("HYPOTHESIS -- permitted", M.HYPOTHESIS, "The certificate may simply not have been uploaded yet.", O.PERMITTED_HYPOTHESIS),
    ("RECOMMENDATION -- permitted", M.RECOMMENDATION, "Request the current certificate before proceeding.", O.PERMITTED_RECOMMENDATION),
]

results = []
for label, output_type, text, required in variants:
    decision = evaluate(committed, ModelOutput(output_type=output_type, asserted_value=text, claimed_scope=None))
    ok = decision.outcome == required
    results.append((label, ok, decision.outcome, required, decision.reason))
    marker = "PASS" if ok else "FAIL"
    print(f"[{marker}] {label}\n  text: {text!r}\n  got {decision.outcome.value} (required {required.value}) -- {decision.reason}\n")

passed = sum(1 for r in results if r[1])
print(f"{passed}/{len(results)} variants match required behavior.")

print("""
NOTE on the directive's 4th variant (ACTION_REQUEST "Purchase is
authorized" -> "evaluate separately against policy authority"): not
included here. That variant tests a DIFFERENT predicate (authority over
a purchase decision) than the other three (insurance certificate
status) -- it needs its own compare_against_predicate wired to a real
policy document to be meaningfully evaluated, the same as
LNES59-B4-003/B3-004/B3-005. Folding it into this same fixture would
compare an authority claim against an insurance-status committed state,
which is exactly the kind of unrelated-predicate collapse
LNES59_PREDICATE_SEMANTICS.md's UNRELATED_PREDICATE category warns
against. Left as a distinct, not-yet-built case rather than forced into
this one for superficial completeness.
""")

if passed != len(results):
    raise SystemExit(1)
