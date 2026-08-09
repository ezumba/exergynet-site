"""
LNES-59.2B frozen evaluator (continuous-execution directive section 13).
Reads every raw_results/{case_id}__{arm}.json record and computes all
primary aggregate metrics. Run only after the 400-evaluation matrix (or
whatever subset actually completed, per the frozen retry policy) is
done -- this file does not call a model or touch the holdout beyond
reading already-produced records and the evaluator holdout's expected
states.
"""

import glob
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ARMS = ("B0", "B1", "B2", "B3", "B4", "X0", "X1", "X2")


def load_all_raw_results():
    results = {}
    for path in glob.glob(os.path.join(SCRIPT_DIR, "raw_results", "*.json")):
        with open(path, encoding="utf-8") as f:
            r = json.load(f)
        results[(r["case_id"], r["arm"])] = r
    return results


def per_arm_summary(results):
    summary = {}
    for arm in ARMS:
        arm_records = [r for (cid, a), r in results.items() if a == arm]
        attempted = len(arm_records)
        errored = [r for r in arm_records if r.get("error_state")]
        scored = [r for r in arm_records if r.get("metrics")]
        n = len(scored)

        def rate(key):
            vals = [r["metrics"][key] for r in scored if r["metrics"].get(key) is not None]
            return (sum(1 for v in vals if v) / len(vals)) if vals else None

        def avg_latency(stage):
            vals = [r["metrics"]["latencies"].get(stage) for r in scored
                     if r["metrics"].get("latencies") and r["metrics"]["latencies"].get(stage) is not None]
            return (sum(vals) / len(vals)) if vals else None

        summary[arm] = {
            "attempted": attempted, "errored": len(errored), "scored": n,
            "candidate_state_correctness_rate": rate("candidate_state_correctness"),
            "authorized_state_correctness_rate": rate("authorized_state_correctness"),
            "false_authoritative_state_rate": rate("false_authoritative_state"),
            "false_block_rate": rate("false_block") if arm == "X2" else None,
            "false_allow_rate": rate("false_allow") if arm == "X2" else None,
            "evidence_recall_mean": (
                lambda vals: sum(vals) / len(vals) if vals else None
            )([r["metrics"]["evidence_recall"] for r in scored if r["metrics"].get("evidence_recall") is not None]) if arm in ("B1", "B2", "B3") else None,
            "avg_retrieval_latency_s": avg_latency("retrieval"),
            "avg_generation_latency_s": avg_latency("generation"),
            "avg_gate_latency_s": avg_latency("gate") if arm == "X2" else None,
        }
    return summary


def x1_x2_delta(results):
    x1 = {cid: r for (cid, a), r in results.items() if a == "X1"}
    x2 = {cid: r for (cid, a), r in results.items() if a == "X2"}
    common = set(x1) & set(x2)
    x1_false_states = sum(1 for cid in common if x1[cid].get("metrics", {}).get("false_authoritative_state"))
    x2_false_states = sum(1 for cid in common if x2[cid].get("metrics", {}).get("false_authoritative_state"))
    prevented = sum(
        1 for cid in common
        if x1[cid].get("metrics", {}).get("false_authoritative_state")
        and not x2[cid].get("metrics", {}).get("false_authoritative_state")
    )
    still_present = x2_false_states  # whatever X2 still has is what X1's false states weren't prevented for (plus any new ones -- see note)
    false_blocks = sum(1 for cid in common if x2[cid].get("metrics", {}).get("false_block"))
    hyp_preserved = [cid for cid in common if x2[cid].get("candidate_claim", {}) and x2[cid]["candidate_claim"].get("claim_type") == "HYPOTHESIS"]
    hyp_preserved_ok = sum(1 for cid in hyp_preserved if x2[cid]["metrics"].get("hypothesis_preserved"))
    rec_preserved = [cid for cid in common if x2[cid].get("candidate_claim", {}) and x2[cid]["candidate_claim"].get("claim_type") == "RECOMMENDATION"]
    rec_preserved_ok = sum(1 for cid in rec_preserved if x2[cid]["metrics"].get("recommendation_preserved"))
    return {
        "n_common_cases": len(common),
        "x1_false_authoritative_states": x1_false_states,
        "x2_false_authoritative_states": x2_false_states,
        "false_states_prevented_by_gate": prevented,
        "absolute_reduction": x1_false_states - x2_false_states,
        "relative_reduction_pct": (
            100 * (x1_false_states - x2_false_states) / x1_false_states if x1_false_states else None
        ),
        "false_blocks_by_gate": false_blocks,
        "hypotheses_seen": len(hyp_preserved), "hypotheses_preserved_correctly": hyp_preserved_ok,
        "recommendations_seen": len(rec_preserved), "recommendations_preserved_correctly": rec_preserved_ok,
    }


def run():
    results = load_all_raw_results()
    return {
        "n_total_records": len(results),
        "per_arm_summary": per_arm_summary(results),
        "x1_x2_delta": x1_x2_delta(results),
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
