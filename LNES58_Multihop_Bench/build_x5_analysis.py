#!/usr/bin/env python3
import json, os, statistics as stats

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "set1_runs", "run1_20260806_134906")

def load(path):
    rows = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows

def load_frozen_arm_interaction_subset(arm):
    rows = []
    with open(os.path.join(OUT_DIR, f"checkpoint_{arm}.jsonl")) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            r = json.loads(line)
            if r.get("ok") and r.get("type") == "interaction_check":
                rows.append(r)
    return rows

x5_rows = [r for r in load(os.path.join(OUT_DIR, "X5_67_results.jsonl")) if r.get("ok")]
assert len(x5_rows) == 67

n = len(x5_rows)
n_correct = sum(1 for r in x5_rows if r["correct"])
n_schema_valid = sum(1 for r in x5_rows if r["schema_valid"])

match_rows = [r for r in x5_rows if r["resolver_state"] == "MATCH"]
nomatch_rows = [r for r in x5_rows if r["resolver_state"] == "NO_MATCH"]
incomplete_rows = [r for r in x5_rows if r["resolver_state"] == "INCOMPLETE"]

match_correct = sum(1 for r in match_rows if r["correct"])
nomatch_correct = sum(1 for r in nomatch_rows if r["correct"])

# Confusion matrix: ground_truth_relation_required (independent) vs resolver_state
confusion = {
    "MATCH": {"relation_required": 0, "no_relation_required": 0},
    "NO_MATCH": {"relation_required": 0, "no_relation_required": 0},
    "INCOMPLETE": {"relation_required": 0, "no_relation_required": 0},
}
for r in x5_rows:
    col = "relation_required" if r["ground_truth_relation_required"] else "no_relation_required"
    confusion[r["resolver_state"]][col] += 1

# False positive rate on NO_MATCH cases (model said interacts=True despite verified NO_MATCH)
fp_on_nomatch = sum(1 for r in nomatch_rows if r["parsed_answer"] and r["parsed_answer"].get("interacts") is True)
fn_on_match = sum(1 for r in match_rows if r["parsed_answer"] and r["parsed_answer"].get("interacts") is False)

entity_recall = stats.mean(r["entity_extraction_recall"] for r in x5_rows)
relation_recall = stats.mean(r["relation_node_recall"] for r in x5_rows)
all_req_recall = sum(1 for r in x5_rows if r["all_required_evidence_recall"]) / n
resolver_state_correct_rows = [r for r in x5_rows if r["resolver_state_correct"] is not None]
negative_result_correctness = sum(1 for r in resolver_state_correct_rows if r["resolver_state_correct"]) / len(resolver_state_correct_rows)

root_fail = sum(r["root_verification_failures"] for r in x5_rows)
budget_over = sum(r["budget_exhausted_count"] for r in x5_rows)

def latstats(vals):
    v = list(vals)
    return {"mean": round(stats.mean(v), 2), "median": round(stats.median(v), 2),
            "p95": round(sorted(v)[int(len(v)*0.95)] if len(v) > 1 else v[0], 2)}

x2 = load_frozen_arm_interaction_subset("X2")
r3 = load_frozen_arm_interaction_subset("R3")
r4 = load_frozen_arm_interaction_subset("R4")
x4_rows = [r for r in load(os.path.join(OUT_DIR, "checkpoint_X4_interaction_entity_graph.jsonl")) if r.get("ok")]

def acc(rows): return sum(1 for r in rows if r["correct"]) / len(rows)

report = {
    "arm": "X5", "n": n,
    "accuracy": round(n_correct / n, 4),
    "schema_valid_pct": round(100 * n_schema_valid / n, 1),
    "state_counts": {"MATCH": len(match_rows), "NO_MATCH": len(nomatch_rows), "INCOMPLETE": len(incomplete_rows)},
    "match_accuracy": round(match_correct / len(match_rows), 4) if match_rows else None,
    "nomatch_accuracy": round(nomatch_correct / len(nomatch_rows), 4) if nomatch_rows else None,
    "false_positive_hallucinations_after_nomatch": fp_on_nomatch,
    "false_negative_after_match": fn_on_match,
    "confusion_matrix": confusion,
    "entity_extraction_recall": round(entity_recall, 4),
    "relation_node_recall": round(relation_recall, 4),
    "all_required_evidence_recall": round(all_req_recall, 4),
    "negative_result_correctness": round(negative_result_correctness, 4),
    "root_verification_failures": root_fail,
    "budget_overflows": budget_over,
    "mean_relation_nodes_per_query": round(stats.mean(r["relation_nodes_resolved"] for r in x5_rows), 3),
    "mean_evidence_tokens_per_query": round(stats.mean(r["exception_evidence_tokens_est"] for r in x5_rows), 1),
    "graph_traversal_latency_ms": latstats(r["retrieval_latency_ms"] for r in x5_rows),
    "generation_latency_ms": latstats(r["generation_latency_ms"] for r in x5_rows),
    "total_latency_ms": latstats(r["total_latency_ms"] for r in x5_rows),
    "comparison_67_query_subset": {
        "X2_frozen": {"accuracy": round(acc(x2), 4), "n": len(x2)},
        "X4_frozen": {"accuracy": round(acc(x4_rows), 4), "n": len(x4_rows)},
        "X5": {"accuracy": round(n_correct/n, 4), "n": n},
        "R3_frozen": {"accuracy": round(acc(r3), 4), "n": len(r3)},
        "R4_frozen": {"accuracy": round(acc(r4), 4), "n": len(r4)},
    },
}

with open(os.path.join(OUT_DIR, "X5_67_audit.json"), "w") as f:
    json.dump(report, f, indent=2)

print(json.dumps(report, indent=2))
