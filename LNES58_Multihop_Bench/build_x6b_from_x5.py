#!/usr/bin/env python3
"""
LNES-58.9 Phase 4: X6B = X5 + deterministic state-contradiction gate,
applied as a POST-HOC layer over X5's already-recorded results. No new
inference -- X5's raw_model_output and resolver_state are already
captured in X5_67_results.jsonl. Does not modify X5's own file.
"""
import json, os, time
from state_contradiction_gate import evaluate

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "set1_runs", "run1_20260806_134906")
X5_PATH = os.path.join(OUT_DIR, "X5_67_results.jsonl")
X6B_PATH = os.path.join(OUT_DIR, "X6B_67_results.jsonl")


def main():
    rows = []
    with open(X5_PATH) as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))

    ok_rows = [r for r in rows if r.get("ok")]
    out_rows = []
    n_correct_raw = 0
    n_contradictions = 0
    n_false_contradictions = 0  # CONSISTENT rows the gate incorrectly flagged -- by construction, always 0 for a correct implementation; checked explicitly below
    n_correct_authorized = 0
    n_not_assessable = 0
    policy_latencies_us = []

    for r in ok_rows:
        t0 = time.perf_counter()
        decision = evaluate(r["resolver_state"], True, r["parsed_answer"])
        policy_latencies_us.append((time.perf_counter() - t0) * 1_000_000)

        if decision.consistency_decision == "STATE_CONTRADICTION":
            n_contradictions += 1
        elif decision.consistency_decision == "NOT_ASSESSABLE":
            n_not_assessable += 1

        raw_correct = r["correct"]
        if raw_correct:
            n_correct_raw += 1

        authorized_state = decision.authorized_structured_state or r["parsed_answer"]
        authorized_correct = (
            authorized_state is not None
            and r["ground_truth"].get("interacts") == authorized_state.get("interacts")
        )
        if authorized_correct:
            n_correct_authorized += 1

        # "False contradiction" check: did the gate flag STATE_CONTRADICTION
        # on a case where the raw model output actually already matched the
        # resolver's own state (i.e. the gate made an error)? Recomputed
        # independently from the gate's own inputs, not trusting its output.
        model_asserts = bool(r["parsed_answer"] and r["parsed_answer"].get("interacts") is True)
        resolver_says_match = r["resolver_state"] == "MATCH"
        actually_consistent = (model_asserts == resolver_says_match) if r["resolver_state"] in ("MATCH", "NO_MATCH") else None
        if decision.consistency_decision == "STATE_CONTRADICTION" and actually_consistent is True:
            n_false_contradictions += 1

        out_rows.append({
            "query_id": r["query_id"],
            "raw_model_output": r["parsed_answer"],
            "resolver_state": r["resolver_state"],
            "consistency_decision": decision.consistency_decision,
            "authorized_structured_state": authorized_state,
            "raw_correct": raw_correct,
            "authorized_correct": authorized_correct,
            "schema_valid": r["schema_valid"],
        })

    with open(X6B_PATH, "w", encoding="utf-8") as f:
        for row in out_rows:
            f.write(json.dumps(row) + "\n")

    n = len(ok_rows)
    summary = {
        "n": n,
        "raw_model_accuracy": round(n_correct_raw / n, 4),
        "contradiction_detections": n_contradictions,
        "false_contradiction_detections": n_false_contradictions,
        "authorized_state_accuracy": round(n_correct_authorized / n, 4),
        "schema_valid_pct": round(100 * sum(1 for r in ok_rows if r["schema_valid"]) / n, 1),
        "not_assessable_count": n_not_assessable,
        "policy_latency_us": {
            "mean": round(sum(policy_latencies_us) / len(policy_latencies_us), 2),
            "max": round(max(policy_latencies_us), 2),
        },
        "note": "X6B built as a post-hoc deterministic layer over X5's existing recorded output -- no new inference performed. X5's own file is untouched.",
    }
    with open(os.path.join(OUT_DIR, "X6B_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
