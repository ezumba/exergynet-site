"""
Ground-truth leakage test against the actual sealed holdout files and the
actual runner-facing case-loading path used by arm_p0/p1/p2. Per the
directive: any leakage is a HARD STOP, not a routine defect -- this test
exists to make that check automatic and repeatable, not a one-off manual
sweep.
"""

import json
import os

HOLDOUT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BANNED_FIELDS = {"expected_operational_state", "expected_release", "hand_trace", "ktx_class"}


def _runner_holdout():
    path = os.path.join(HOLDOUT_DIR, "LNES60_RUNNER_HOLDOUT.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def test_no_ground_truth_fields_in_runner_holdout():
    data = _runner_holdout()
    for case in data["cases"]:
        leaked = BANNED_FIELDS & set(case.keys())
        assert not leaked, f"case {case.get('case_id')} leaks ground-truth fields: {leaked}"


def test_no_ground_truth_strings_anywhere_in_runner_file():
    path = os.path.join(HOLDOUT_DIR, "LNES60_RUNNER_HOLDOUT.json")
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    for term in ("ktx_class", "hand_trace", "expected_operational_state", "expected_release"):
        assert term not in raw, f"banned key name '{term}' present in runner holdout raw text"


def test_case_ids_and_aircraft_ids_disjoint_from_dev_corpus():
    import sys
    sys.path.insert(0, HOLDOUT_DIR)
    from lnes60.synthetic_generator import generate_dataset
    dev = generate_dataset(n=100, seed=60)
    hold_data = _runner_holdout()
    dev_ids = {c.case_id for c in dev}
    dev_aircraft = {c.aircraft_id for c in dev}
    hold_ids = {c["case_id"] for c in hold_data["cases"]}
    hold_aircraft = {c["aircraft_id"] for c in hold_data["cases"]}
    assert not (dev_ids & hold_ids), f"case_id collision: {dev_ids & hold_ids}"
    assert not (dev_aircraft & hold_aircraft), f"aircraft_id collision: {dev_aircraft & hold_aircraft}"


def test_evaluator_holdout_has_ground_truth_for_every_runner_case():
    """Sanity check the split itself is complete and consistent, not just
    leak-free -- an evaluator file missing entries would silently break
    scoring later."""
    runner = _runner_holdout()
    eval_path = os.path.join(HOLDOUT_DIR, "LNES60_EVALUATOR_HOLDOUT.json")
    with open(eval_path, encoding="utf-8") as f:
        evaluator = json.load(f)
    runner_ids = {c["case_id"] for c in runner["cases"]}
    eval_ids = {c["case_id"] for c in evaluator["cases"]}
    assert runner_ids == eval_ids
    for c in evaluator["cases"]:
        assert c.get("expected_operational_state"), f"{c['case_id']} missing expected_operational_state"
