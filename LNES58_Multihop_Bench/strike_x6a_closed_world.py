#!/usr/bin/env python3
"""
LNES-58.9 X6A: X5 + closed-world model instruction. Identical to X5 in
every respect (frozen graph, relation manifest, entity manifests,
Negative Resolution Receipts, benchmark questions, grader, model/runtime
config) except SYSTEM prompt has the authorized closed-world constraint
appended. Does not modify X5's own files at all -- separate checkpoint.
"""
import json, os, sys, time, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import rag_common as rc
from tier2_cross_document import make_trio, build_queries, SYSTEM as BASE_SYSTEM, MAX_TOKENS, SEED
from entity_graph_traversal import load_frozen_graph
from entity_graph_traversal_v2 import (
    traverse_v2, render_explicit_null_assertion, render_incomplete_assertion, DEFAULT_BUDGET,
)
from independent_evaluator import (
    score_entity_extraction_recall, score_relation_node_recall, score_all_required_evidence_recall,
    required_relation_pairs,
)

CLOSED_WORLD_INSTRUCTION = (
    "\n\nYou are operating against a closed synthetic evidence domain.\n"
    "For any fact governed by an AUTHORITATIVE GRAPH RESULT, use only the committed "
    "graph state supplied in context.\n"
    "Do not substitute outside medical knowledge.\n"
    "If the graph state is NO_MATCH and traversal_complete=true, you must not invent "
    "or infer a relation that is absent from the declared graph scope.\n"
    "Never claim that a source contains a fact unless that fact appears in the "
    "provided evidence."
)
SYSTEM_X6A = BASE_SYSTEM + CLOSED_WORLD_INSTRUCTION
TOKEN_DELTA_EST = len(CLOSED_WORLD_INSTRUCTION) // 4

FROZEN_DIR = os.path.join(HERE, "set1_runs", "run1_20260806_134906", "lnes58_6_frozen")
OUT_DIR = os.path.join(HERE, "set1_runs", "run1_20260806_134906")
CKPT_PATH = os.path.join(OUT_DIR, "X6A_67_results.jsonl")
DIAG_PATH = os.path.join(OUT_DIR, "X6A_4case_diagnostic.json")
LOG_PATH = os.environ.get("STRIKE_LOG_PATH", os.path.join(OUT_DIR, "strike_X6A.log"))

RESIDUAL_FOUR = ["TR106-interaction", "TR137-interaction", "TR140-interaction", "TR158-interaction"]


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def t2_gold_context_interaction(facts) -> str:
    return (f"Patient's current medications: {', '.join(facts['current_meds'])}. "
            f"Trial drug under evaluation: {facts['trial_drug']}.")


def build_interaction_check_dataset():
    items = {}
    for p in range(67):
        facts, doc_a, doc_c = make_trio(f"TR{100+p}", SEED + p)
        for q in build_queries(facts):
            if q["type"] != "interaction_check":
                continue
            items[q["query_id"]] = {
                "query_id": q["query_id"], "type": q["type"], "record_id": facts["pid"],
                "question": q["question"], "ground_truth": q["ground_truth"],
                "score_field": q["score_field"], "facts": facts,
            }
    return items


def build_context_and_state(item, relation_nodes, manifests_by_record, graph_manifest_hash):
    e_d = t2_gold_context_interaction(item["facts"])
    outcome = traverse_v2(item["record_id"], relation_nodes, manifests_by_record,
                           graph_manifest_hash, DEFAULT_BUDGET, run_timestamp=time.time())
    if outcome.state == "MATCH":
        exception_evidence = "\n".join(
            f"Documented relation: {' + '.join(n['canonical_entities'])} -> {n['relation_payload']}"
            for n in outcome.matched_nodes
        )
    elif outcome.state == "NO_MATCH":
        exception_evidence = render_explicit_null_assertion(outcome.negative_receipt)
    else:
        exception_evidence = render_incomplete_assertion(outcome.incomplete_receipt)
    context = f"{e_d}\n{exception_evidence}"
    return context, outcome


def run_one(item, relation_nodes, manifests_by_record, graph_manifest_hash):
    t_r0 = time.time()
    context, outcome = build_context_and_state(item, relation_nodes, manifests_by_record, graph_manifest_hash)
    retrieval_latency_ms = (time.time() - t_r0) * 1000

    t_g0 = time.time()
    r = rc.call_auditor(SYSTEM_X6A, context, item["question"], MAX_TOKENS)
    gen_latency_ms = (time.time() - t_g0) * 1000
    total_latency_ms = retrieval_latency_ms + gen_latency_ms

    if not r.get("ok"):
        return {"query_id": item["query_id"], "ok": False, "error": r.get("error"), "status": r.get("status")}, outcome

    parsed, schema_valid = rc.extract_answer_json(r["content"])
    correct = rc.score_field(parsed, schema_valid, item["ground_truth"], item["score_field"])
    citation_fabrication = bool(
        parsed and parsed.get("interacts") is True and outcome.state == "NO_MATCH"
    )

    row = {
        "query_id": item["query_id"], "type": item["type"], "ok": True,
        "question": item["question"], "ground_truth": item["ground_truth"],
        "raw_response": r["content"], "parsed_answer": parsed, "schema_valid": schema_valid,
        "correct": correct,
        "resolver_state": outcome.state,
        "citation_fabrication_suspected": citation_fabrication,
        "retrieval_latency_ms": round(retrieval_latency_ms, 3),
        "generation_latency_ms": round(gen_latency_ms, 1),
        "total_latency_ms": round(total_latency_ms, 1),
        "timestamp": time.time(),
    }
    return row, outcome


def main():
    relation_nodes, manifests_by_record = load_frozen_graph(FROZEN_DIR)
    graph_manifest_hash = hashlib.sha256(
        json.dumps(list(manifests_by_record.values()), sort_keys=True).encode()
    ).hexdigest()
    items = build_interaction_check_dataset()
    log(f"Token delta from closed-world instruction (est): {TOKEN_DELTA_EST}")

    # Phase 1a: 4-case diagnostic (residual X5 failures), NOT published as benchmark performance
    log("=== X6A 4-case diagnostic (mechanism check only) ===")
    diag_results = []
    for qid in RESIDUAL_FOUR:
        row, outcome = run_one(items[qid], relation_nodes, manifests_by_record, graph_manifest_hash)
        diag_results.append(row)
        log(f"  [diag] [{qid}] correct={row.get('correct')} fabrication={row.get('citation_fabrication_suspected')}")
        time.sleep(rc.COOLDOWN_S)
    with open(DIAG_PATH, "w", encoding="utf-8") as f:
        json.dump({"note": "MECHANISM DIAGNOSTIC ONLY -- not benchmark performance", "rows": diag_results}, f, indent=2)

    # Phase 1b: full 67
    log("=== X6A full 67-query run ===")
    done_ids = set()
    if os.path.exists(CKPT_PATH):
        with open(CKPT_PATH) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        done_ids.add(json.loads(line)["query_id"])
                    except Exception:
                        pass

    consecutive_failures = 0
    for qid, item in items.items():
        if qid in done_ids:
            continue
        row, outcome = run_one(item, relation_nodes, manifests_by_record, graph_manifest_hash)
        with open(CKPT_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(row) + "\n")
        if not row.get("ok"):
            consecutive_failures += 1
            log(f"  [{qid}] FAIL {row.get('error')}")
            if consecutive_failures >= 3:
                log("[STOP] 3 consecutive failures.")
                return 1
        else:
            consecutive_failures = 0
            log(f"  [{qid}] state={row['resolver_state']} correct={row['correct']} total_ms={row['total_latency_ms']:.0f}")
        time.sleep(rc.COOLDOWN_S)

    log("=== X6A complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
