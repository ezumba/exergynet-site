"""
LNES-59 X2 arm -- REAL invocation script. R&D / benchmark only.

This is the one file in this sprint that spends real money. It is not
run by any test, any other script, or automatically by anything. You run
it yourself, with your own ANTHROPIC_API_KEY in your own environment --
this script reads the key from os.environ only (via the anthropic SDK
internally); nothing in this codebase ever prints, logs, or stores it.

Usage:
    pip install anthropic --break-system-packages   # if not already installed
    export ANTHROPIC_API_KEY=sk-...                 # your key, your shell, not this file
    python run_x2_arm.py                             # runs the default 5-case smoke slice
    python run_x2_arm.py --all                        # runs all 27 dev-set cases
    python run_x2_arm.py --cases LNES59-SMOKE-001,LNES59-B3-004   # specific cases

Cost note: max_tokens=500/call, 27 cases total if --all is used. Defaults
to a 5-case slice (one per category where possible) specifically so the
first real run is cheap and its output can be sanity-checked by hand
before spending on the full 27.
"""

import argparse
import json
import sys

from arm_x2 import load_all_cases, anthropic_model_call, run_x2_case, ModelResponseParseError
from deterministic_extraction import load_corpus

# One case per category (where available), chosen for the first real,
# cheap sanity-check run -- not a scientific sample, just a smoke slice.
DEFAULT_SMOKE_SLICE = [
    "LNES59-SMOKE-005",   # weak/hedged source -> must not become confirmed fact
    "LNES59-B2-004",      # temporal supersession, corrected expected_state
    "LNES59-B3-004",      # policy authority, VP unlimited tier
    "LNES59-SMOKE-003",   # genuine conflicting evidence
    "LNES59-B3-006",      # rumor must not become confirmed contract term
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", help="run all 27 dev-set cases instead of the 5-case smoke slice")
    parser.add_argument("--cases", type=str, default=None, help="comma-separated case_ids to run instead of the default slice")
    parser.add_argument("--out", type=str, default="x2_real_run_results.json", help="output file")
    args = parser.parse_args()

    all_cases = load_all_cases()
    corpus = load_corpus()

    if args.cases:
        case_ids = [c.strip() for c in args.cases.split(",")]
    elif args.all:
        case_ids = list(all_cases.keys())
    else:
        case_ids = DEFAULT_SMOKE_SLICE

    unknown = [cid for cid in case_ids if cid not in all_cases]
    if unknown:
        print(f"Unknown case_id(s), not in the 27-case dev set: {unknown}", file=sys.stderr)
        sys.exit(1)

    print(f"Running X2 arm against a REAL model for {len(case_ids)} case(s). This spends real API budget.")
    results = []
    for cid in case_ids:
        case = all_cases[cid]
        try:
            result = run_x2_case(case, corpus, anthropic_model_call)
            print(f"  {cid}: gate={result['gate_outcome']}  (extraction={result['extracted_resolution']}/{result['extracted_claim_type']})")
        except ModelResponseParseError as e:
            result = {"case_id": cid, "error": f"ModelResponseParseError: {e}"}
            print(f"  {cid}: PARSE ERROR -- {e}")
        results.append(result)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nWrote {len(results)} result(s) to {args.out}")
    print("These are real, first-run empirical results -- not yet cross-checked against expected_state by hand. Do that before drawing any conclusion.")


if __name__ == "__main__":
    main()
