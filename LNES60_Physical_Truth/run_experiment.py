"""
LNES-60 Phase 1 blind execution: 50 holdout cases x 3 arms = 150 primary
evaluations. Reads ONLY LNES60_RUNNER_HOLDOUT.json (no ground-truth
fields present, per the sealed leakage tests) for P0/P1/P2 execution;
ground truth is read only by the separate evaluator step, afterward.
"""

import json
import os

from lnes60 import arm_p0, arm_p1, arm_p2

RAW_DIR = "raw_results"


def main():
    with open("LNES60_RUNNER_HOLDOUT.json", encoding="utf-8") as f:
        cases = json.load(f)["cases"]

    os.makedirs(RAW_DIR, exist_ok=True)
    attempted = 0
    errors = []

    for case in cases:
        for arm_module, arm_name in ((arm_p0, "P0"), (arm_p1, "P1"), (arm_p2, "P2")):
            attempted += 1
            try:
                result = arm_module.run(case)
            except Exception as e:
                errors.append({"case_id": case["case_id"], "arm": arm_name, "error": f"{type(e).__name__}: {e}"})
                continue
            path = os.path.join(RAW_DIR, f"{case['case_id']}__{arm_name}.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)

    print(f"attempted={attempted} errors={len(errors)}")
    for e in errors:
        print(json.dumps(e))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
