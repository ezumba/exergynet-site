"""
LNES-59 automated leakage test. Fails if evaluator-only information
(gold state, predicate labels, category, failure taxonomy, ...) reaches
anything runner-facing -- both structurally (case_view.py's own
allowlist) and transitively, through the REAL prompt-construction code
path (arm_x2.py's build_prompt), against every real case in the current
dataset, not synthetic examples only.

Run: python3 test_leakage.py
"""

from case_view import to_runner_case, to_evaluator_case, assert_no_leakage, EVALUATOR_ONLY_FIELD_NAMES
from deterministic_extraction import load_corpus
from run_case import load_all_cases
from arm_x2 import build_prompt

results = []


def check(label, condition):
    results.append((label, bool(condition)))
    print(f"[{'PASS' if condition else 'FAIL'}] {label}")


# ── Structural: to_runner_case() never carries an evaluator-only field ──
cases = load_all_cases()
corpus = load_corpus()

for case_id, case in cases.items():
    runner_case = to_runner_case(case)
    try:
        assert_no_leakage(runner_case)
        check(f"{case_id}: to_runner_case() has no evaluator-only fields", True)
    except AssertionError as e:
        check(f"{case_id}: to_runner_case() has no evaluator-only fields ({e})", False)

# ── Checker self-test: assert_no_leakage() actually catches a real leak,
# at the top level AND nested inside a list/dict, not just a no-op ──
leaky_flat = {"case_id": "X", "query": "Q", "expected_state": {"resolution": "MATCH"}}
try:
    assert_no_leakage(leaky_flat)
    check("checker catches a top-level leaked field", False)
except AssertionError:
    check("checker catches a top-level leaked field", True)

leaky_nested = {"case_id": "X", "query": "Q", "documents": [{"id": "D1", "meta": {"predicate": "X.y"}}]}
try:
    assert_no_leakage(leaky_nested)
    check("checker catches a leaked field nested inside a list/dict", False)
except AssertionError:
    check("checker catches a leaked field nested inside a list/dict", True)

clean = {"case_id": "X", "query": "Q", "grounding_document_ids": ["D1", "D2"]}
try:
    assert_no_leakage(clean)
    check("checker does not false-positive on a genuinely clean runner_case", True)
except AssertionError:
    check("checker does not false-positive on a genuinely clean runner_case", False)

# ── Transitive: the REAL prompt-construction path (arm_x2.build_prompt)
# must not emit the case's predicate/category/expected_state text into
# the actual rendered prompt, for every real case in the dataset ──
gold_leak_count = 0
for case_id, case in cases.items():
    runner_case = to_runner_case(case)
    documents_by_id = {doc_id: corpus[doc_id] for doc_id in runner_case["grounding_document_ids"]}
    prompt = build_prompt(runner_case, documents_by_id)

    evaluator_case = to_evaluator_case(case)
    leaked_fields = []
    predicate = evaluator_case.get("predicate")
    if predicate and predicate in prompt:
        leaked_fields.append(f"predicate {predicate!r}")
    category = evaluator_case.get("category")
    if category and category.replace("_", " ") in prompt.lower():
        leaked_fields.append(f"category {category!r}")

    ok = not leaked_fields
    if not ok:
        gold_leak_count += 1
    check(f"{case_id}: build_prompt() output contains no gold predicate/category text" + ("" if ok else f" -- FOUND: {leaked_fields}"), ok)

print()
passed = sum(1 for _, ok in results if ok)
print(f"{passed}/{len(results)} leakage checks passed.")
print(f"EVALUATOR_ONLY_FIELD_NAMES tracked: {sorted(EVALUATOR_ONLY_FIELD_NAMES)}")
if passed != len(results):
    raise SystemExit(1)
