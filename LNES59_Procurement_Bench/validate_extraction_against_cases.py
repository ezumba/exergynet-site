"""
Cross-checks deterministic_extraction.py's automated output against the
hand-authored expected_state.resolution field for all 21 cases (both
batches). This is a real correctness test in both directions -- a
mismatch could mean the extraction pipeline is wrong, OR that the
hand-authored expectation was wrong. Both are worth knowing.

Only checks `resolution` strictly (MATCH/NO_MATCH/INCOMPLETE) -- the
other expected_state fields are free-form prose in cases.json/
cases_batch2.json, not strictly enough typed for an automated string
comparison without a real risk of false failures. Flagged as a
follow-up: making expected_state itself strictly typed would let this
check cover claim_type/temporal_status too.

Run: python3 validate_extraction_against_cases.py
"""

import json
import os

from deterministic_extraction import load_corpus, extract_case_state

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_all_cases():
    cases = []
    for fname in ("cases.json", "cases_batch2.json"):
        with open(os.path.join(SCRIPT_DIR, fname), encoding="utf-8") as f:
            cases.extend(json.load(f)["cases"])
    return cases


def main():
    corpus = load_corpus()
    cases = load_all_cases()
    print(f"Loaded {len(corpus)} documents, {len(cases)} cases.\n")

    matches, mismatches = 0, []
    for case in cases:
        expected_resolution = case["expected_state"].get("resolution")
        if expected_resolution is None:
            print(f"[SKIP] {case['case_id']}: no explicit expected_state.resolution field to check")
            continue
        extracted = extract_case_state(
            case["grounding_document_ids"], case["predicate"], corpus,
            compare_against_predicate=case.get("compare_against_predicate"),
        )
        got = extracted.resolution.value
        if got == expected_resolution:
            matches += 1
            print(f"[MATCH] {case['case_id']}: extracted={got} (claim_type={extracted.claim_type.value})")
        else:
            mismatches.append((case["case_id"], expected_resolution, got, extracted))
            print(f"[MISMATCH] {case['case_id']}: expected resolution={expected_resolution}, extracted={got} (claim_type={extracted.claim_type.value})")

    print(f"\n{matches}/{matches + len(mismatches)} resolution fields match between hand-authored expectations and automated extraction.")
    if mismatches:
        print("\nMismatches to investigate (pipeline bug or hand-authored expectation error -- not assumed to be either without checking):")
        for case_id, expected, got, extracted in mismatches:
            print(f"  {case_id}: expected={expected} extracted={got} (claim_type={extracted.claim_type.value}, temporal={extracted.temporal_status.value})")


if __name__ == "__main__":
    main()
