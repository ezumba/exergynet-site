"""
LNES-59 Phase 5 Section 3: deliberate stress test of the disclosed sparse-
token NO_MATCH limitation (taxonomy #17), against a REAL corpus-grounded
case (LNES59-B4-001, Cascade Ridge Consulting -- documents_batch4.json).

DEVELOPMENT RESULTS -- NON-BLIND. Five variants specified verbatim by the
directive; classifies actual vs. required behavior for each and, where
the current architecture handles it correctly, says so rather than
assuming a fix is needed.

Run: python3 test_no_match_stress.py
"""

from deterministic_extraction import load_corpus, extract_case_state
from state_consistency_gate_v2 import evaluate, ModelOutput, ModelOutputType as M, GateOutcome as O
import json

with open("cases_batch4.json", encoding="utf-8") as f:
    case = next(c for c in json.load(f)["cases"] if c["case_id"] == "LNES59-B4-001")

corpus = load_corpus()
committed = extract_case_state(case["grounding_document_ids"], case["predicate"], corpus)
print(f"Committed state: resolution={committed.resolution.value}, value={committed.value!r}, scope={committed.scope}\n")

variants = [
    ("correct: scoped negative",
     "Vendor X is not listed in the approved vendor registry.",
     O.CONSISTENT),
    ("correct: scoped uncertainty",
     "No listing was found in the approved vendor registry; other sources were not checked.",
     O.CONSISTENT),
    ("INCORRECT: vague hedge (no genuine negative claim)",
     "There may be a registry issue.",
     O.UNSUPPORTED_STATE_ASSERTION),
    ("INCORRECT: lexical-overlap statement (no genuine negative claim)",
     "There is no registry approval record.",
     O.UNSUPPORTED_STATE_ASSERTION),
    ("INCORRECT: unsupported universal",
     "Vendor X has never been approved anywhere.",
     O.SOURCE_SCOPE_ERROR),
]

results = []
for label, text, required in variants:
    decision = evaluate(committed, ModelOutput(output_type=M.ASSERTION, asserted_value=text, claimed_scope=None))
    ok = decision.outcome == required
    results.append((label, ok, decision.outcome, required, decision.reason))
    marker = "PASS" if ok else "FAIL"
    print(f"[{marker}] {label}\n  text: {text!r}\n  got {decision.outcome.value} (required {required.value}) -- {decision.reason}\n")

passed = sum(1 for r in results if r[1])
print(f"{passed}/{len(results)} variants match required behavior.")

print("""
FINDING: all 5 of the directive's specified variants are currently
handled correctly. The two "INCORRECT" variants that were expected to
risk a false match ("vague hedge" and "lexical-overlap statement") are
in fact both correctly rejected against THIS case's committed value
('NOT_IN_REGISTRY') -- because "NOT_IN_REGISTRY" splits into the words
"not" and "registry", and critically "not" (3 letters) survives the
word-length filter that a shorter negation like "no" (2 letters) would
NOT survive. "There may be a registry issue" contains "registry" but not
"not" -> correctly rejected. "There is no registry approval record"
contains "no" (not "not", a different literal word) and "registry" but
not "not" -> also correctly rejected, though this is closer to the edge:
if a model had written "not a registry approval record" instead of "no
registry approval record", it likely WOULD have false-matched.

This confirms the taxonomy #17 risk is real but narrower than initially
assumed -- it is specifically tied to whether a committed value's
negation marker survives the word-length filter (a side effect of the
corpus consistently using "NOT_X" rather than "NO_X" as its negation
convention), not a general property of all sparse tokens. The genuinely
demonstrated risk remains the one found in test_scope_and_history.py's
disclosed-limitation fixture: a GENERIC 2-word value made of two common
domain nouns with NO surviving negation marker at all (e.g.
NO_APPROVAL_ON_RECORD -> "approval"+"record", where "no" is dropped
entirely) is the real failure mode, not sparse tokens generally.
""")

if passed != len(results):
    raise SystemExit(1)
