"""Frozen-evaluator pass: loads raw_results/*.json + evaluator holdout
ground truth, computes per-arm metrics and the P0->P1, P1->P2, and P2
candidate->authorized deltas."""

import json
import glob
import os

from lnes60.evaluator import score_arm, candidate_vs_authorized_delta


def main():
    with open("LNES60_EVALUATOR_HOLDOUT.json", encoding="utf-8") as f:
        eval_cases = json.load(f)["cases"]
    ground_truth = {
        c["case_id"]: {
            "expected_operational_state": c["expected_operational_state"],
            "mission_within_envelope": c.get("mission_within_envelope", True),
            "ktx_class": c["ktx_class"],
        }
        for c in eval_cases
    }

    results_by_arm = {"P0": [], "P1": [], "P2": []}
    for path in sorted(glob.glob("raw_results/*.json")):
        with open(path, encoding="utf-8") as f:
            r = json.load(f)
        results_by_arm[r["arm"]].append(r)

    scores = {arm: score_arm(results, ground_truth) for arm, results in results_by_arm.items()}
    p2_delta = candidate_vs_authorized_delta(results_by_arm["P2"], ground_truth)

    p0_release_acc = scores["P0"]["release_recommendation_accuracy"]
    p1_release_acc = scores["P1"]["release_recommendation_accuracy"]
    p2_auth_release_acc = scores["P2"]["release_recommendation_accuracy"]

    output = {
        "n_holdout_cases": len(eval_cases),
        "n_total_evaluations": sum(len(v) for v in results_by_arm.values()),
        "per_arm": scores,
        "p2_candidate_vs_authorized_delta": p2_delta,
        "p0_to_p1_delta": {
            "release_accuracy_change": p1_release_acc - p0_release_acc,
            "false_release_rate_change": scores["P1"]["false_release_rate"] - scores["P0"]["false_release_rate"],
        },
        "p1_to_p2_authorized_delta": {
            "release_accuracy_change": p2_auth_release_acc - p1_release_acc,
            "false_release_rate_change": scores["P2"]["false_release_rate"] - scores["P1"]["false_release_rate"],
        },
    }

    with open("LNES60_evaluator_output.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(json.dumps({
        "n_holdout_cases": output["n_holdout_cases"],
        "n_total_evaluations": output["n_total_evaluations"],
        "P0": {k: v for k, v in scores["P0"].items() if k != "per_ktx_class"},
        "P1": {k: v for k, v in scores["P1"].items() if k != "per_ktx_class"},
        "P2": {k: v for k, v in scores["P2"].items() if k != "per_ktx_class"},
        "p2_delta": p2_delta,
    }, indent=2))


if __name__ == "__main__":
    main()
