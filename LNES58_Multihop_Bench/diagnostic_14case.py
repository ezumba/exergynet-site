#!/usr/bin/env python3
"""
Phase 6: 14-case diagnostic ONLY. Uses the exact 14 query_ids that failed
in X4 (all NO_MATCH, ground_truth interacts=False, model hallucinated
interacts=True). This is a mechanism diagnostic, not a benchmark result --
not counted toward, and not published as, system performance.

The resolver does not access these rows' historical X4 answers; it just
happens to traverse the same record_ids again, using only the frozen graph.
"""
import json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import rag_common as rc
from tier2_cross_document import make_trio, build_queries, SYSTEM, MAX_TOKENS, SEED
from entity_graph_traversal import load_frozen_graph
from entity_graph_traversal_v2 import traverse_v2, render_explicit_null_assertion, render_incomplete_assertion, DEFAULT_BUDGET
import hashlib

FROZEN_DIR = os.path.join(HERE, "set1_runs", "run1_20260806_134906", "lnes58_6_frozen")
OUT_PATH = os.path.join(HERE, "set1_runs", "run1_20260806_134906", "X5_14case_diagnostic.json")
LOG_PATH = os.environ.get("STRIKE_LOG_PATH", os.path.join(HERE, "set1_runs", "run1_20260806_134906", "diagnostic_14case.log"))

PREVIOUSLY_FAILED = [
    "TR101-interaction", "TR104-interaction", "TR106-interaction", "TR109-interaction",
    "TR121-interaction", "TR123-interaction", "TR125-interaction", "TR130-interaction",
    "TR137-interaction", "TR141-interaction", "TR149-interaction", "TR150-interaction",
    "TR153-interaction", "TR158-interaction",
]


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def t2_gold_context_interaction(facts) -> str:
    return (f"Patient's current medications: {', '.join(facts['current_meds'])}. "
            f"Trial drug under evaluation: {facts['trial_drug']}.")


def build_all_interaction_items():
    items = {}
    for p in range(67):
        facts, doc_a, doc_c = make_trio(f"TR{100+p}", SEED + p)
        for q in build_queries(facts):
            if q["type"] == "interaction_check":
                items[q["query_id"]] = {
                    "query_id": q["query_id"], "record_id": facts["pid"],
                    "question": q["question"], "ground_truth": q["ground_truth"],
                    "score_field": q["score_field"], "facts": facts,
                }
    return items


def main():
    relation_nodes, manifests_by_record = load_frozen_graph(FROZEN_DIR)
    graph_manifest_hash = hashlib.sha256(
        json.dumps(list(manifests_by_record.values()), sort_keys=True).encode()
    ).hexdigest()

    all_items = build_all_interaction_items()
    targets = [all_items[qid] for qid in PREVIOUSLY_FAILED]
    log(f"=== 14-case diagnostic (mechanism check only, NOT a benchmark result) ===")

    results = []
    n_no_match = 0
    n_incomplete = 0
    n_fp_before = len(PREVIOUSLY_FAILED)  # by construction -- these were exactly the 14 false positives in X4
    n_fp_after = 0
    n_schema_valid = 0

    for item in targets:
        outcome = traverse_v2(item["record_id"], relation_nodes, manifests_by_record,
                               graph_manifest_hash, DEFAULT_BUDGET, run_timestamp=time.time())

        e_d = t2_gold_context_interaction(item["facts"])
        if outcome.state == "NO_MATCH":
            n_no_match += 1
            assertion = render_explicit_null_assertion(outcome.negative_receipt)
        elif outcome.state == "INCOMPLETE":
            n_incomplete += 1
            assertion = render_incomplete_assertion(outcome.incomplete_receipt)
        else:
            assertion = ""  # MATCH shouldn't occur here since these were all zero-node cases originally

        context = f"{e_d}\n{assertion}" if assertion else e_d

        r = rc.call_auditor(SYSTEM, context, item["question"], MAX_TOKENS)
        if not r.get("ok"):
            log(f"  [{item['query_id']}] FAIL {r.get('error')}")
            time.sleep(rc.COOLDOWN_S)
            continue

        parsed, schema_valid = rc.extract_answer_json(r["content"])
        if schema_valid:
            n_schema_valid += 1
        correct = rc.score_field(parsed, schema_valid, item["ground_truth"], item["score_field"])
        still_false_positive = bool(parsed and parsed.get("interacts") is True)
        if still_false_positive:
            n_fp_after += 1

        results.append({
            "query_id": item["query_id"], "state": outcome.state,
            "correct": correct, "schema_valid": schema_valid,
            "parsed_answer": parsed, "ground_truth": item["ground_truth"],
            "false_positive_persisted": still_false_positive,
        })
        log(f"  [{item['query_id']}] state={outcome.state} correct={correct} fp_persisted={still_false_positive}")
        time.sleep(rc.COOLDOWN_S)

    summary = {
        "note": "MECHANISM DIAGNOSTIC ONLY -- not a benchmark result, not published as system performance",
        "n_cases": len(PREVIOUSLY_FAILED),
        "no_match_count": n_no_match,
        "incomplete_count": n_incomplete,
        "false_positive_count_before": n_fp_before,
        "false_positive_count_after": n_fp_after,
        "schema_valid_count": n_schema_valid,
        "rows": results,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    log(json.dumps({k: v for k, v in summary.items() if k != "rows"}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
