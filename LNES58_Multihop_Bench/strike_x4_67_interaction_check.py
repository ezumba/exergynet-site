#!/usr/bin/env python3
"""
LNES-58.6 X4 strike run: 67 interaction_check queries, evidence assembled
via the frozen, query-independent Deterministic Entity Graph.

Query text/type is read HERE, in the strike runner, to know what to ask
the model and how to score correctness -- exactly as A0/X2 did. It is
NEVER passed into entity_graph_traversal.traverse(), which only ever sees
a record_id. That separation is the whole point.
"""
import json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import rag_common as rc
from tier2_cross_document import make_trio, build_queries, SYSTEM, MAX_TOKENS, SEED
from entity_graph_traversal import load_frozen_graph, traverse, DEFAULT_BUDGET
from independent_evaluator import (
    score_entity_extraction_recall, score_relation_node_recall, score_all_required_evidence_recall,
)

N_TRIOS = 67
FROZEN_DIR = os.path.join(HERE, "set1_runs", "run1_20260806_134906", "lnes58_6_frozen")
OUT_DIR = os.path.join(HERE, "set1_runs", "run1_20260806_134906")
CKPT_PATH = os.path.join(OUT_DIR, "checkpoint_X4_interaction_entity_graph.jsonl")
LOG_PATH = os.environ.get("STRIKE_LOG_PATH", os.path.join(OUT_DIR, "strike_X4.log"))


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def t2_gold_context_interaction(facts) -> str:
    return (f"Patient's current medications: {', '.join(facts['current_meds'])}. "
            f"Trial drug under evaluation: {facts['trial_drug']}.")


def build_interaction_check_dataset():
    items = []
    for p in range(N_TRIOS):
        facts, doc_a, doc_c = make_trio(f"TR{100+p}", SEED + p)
        for q in build_queries(facts):
            if q["type"] != "interaction_check":
                continue
            items.append({
                "query_id": q["query_id"], "type": q["type"], "record_id": facts["pid"],
                "question": q["question"], "ground_truth": q["ground_truth"],
                "score_field": q["score_field"], "facts": facts,
            })
    return items


def load_done_ids():
    done = set()
    if not os.path.exists(CKPT_PATH):
        return done
    with open(CKPT_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    done.add(json.loads(line)["query_id"])
                except Exception:
                    pass
    return done


def main():
    relation_nodes, manifests_by_record = load_frozen_graph(FROZEN_DIR)
    log(f"Loaded frozen graph: {len(relation_nodes)} relation nodes, {len(manifests_by_record)} record manifests")

    items = build_interaction_check_dataset()
    assert len(items) == 67, f"expected 67, got {len(items)}"
    log(f"=== LNES-58.6 strike: X4 (Deterministic Entity Graph), {len(items)} interaction_check queries ===")

    done_ids = load_done_ids()
    remaining = [it for it in items if it["query_id"] not in done_ids]
    log(f"{len(done_ids)} already done, {len(remaining)} remaining")

    consecutive_failures = 0
    for item in remaining:
        t_r0 = time.time()

        e_d = t2_gold_context_interaction(item["facts"])
        traversal = traverse(item["record_id"], relation_nodes, manifests_by_record, DEFAULT_BUDGET)
        exception_evidence = "\n".join(
            f"Documented relation: {' + '.join(n['canonical_entities'])} -> {n['relation_payload']}"
            for n in traversal.matched_nodes
        )
        context = f"{e_d}\n{exception_evidence}" if exception_evidence else e_d

        retrieval_latency_ms = (time.time() - t_r0) * 1000

        t_g0 = time.time()
        r = rc.call_auditor(SYSTEM, context, item["question"], MAX_TOKENS)
        gen_latency_ms = (time.time() - t_g0) * 1000
        total_latency_ms = retrieval_latency_ms + gen_latency_ms

        if not r.get("ok"):
            consecutive_failures += 1
            row = {"query_id": item["query_id"], "type": item["type"], "ok": False,
                   "error": r.get("error"), "status": r.get("status"), "timestamp": time.time()}
            with open(CKPT_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")
            log(f"  [{item['query_id']}] FAIL {r.get('error')}")
            if consecutive_failures >= 3:
                log("[STOP] 3 consecutive failures.")
                return 1
            time.sleep(rc.COOLDOWN_S)
            continue
        consecutive_failures = 0

        parsed, schema_valid = rc.extract_answer_json(r["content"])
        correct = rc.score_field(parsed, schema_valid, item["ground_truth"], item["score_field"])

        # Independent evaluator -- does NOT touch resolver internals.
        manifest_entities = manifests_by_record.get(item["record_id"], {}).get("entities", [])
        entity_recall = score_entity_extraction_recall(manifest_entities, item["facts"])
        relation_recall = score_relation_node_recall(traversal.matched_nodes, item["facts"])
        all_required_recall = score_all_required_evidence_recall(traversal.matched_nodes, item["facts"])

        row = {
            "query_id": item["query_id"], "type": item["type"], "ok": True,
            "question": item["question"], "ground_truth": item["ground_truth"],
            "context_chars": len(context), "e_d_chars": len(e_d), "exception_evidence_chars": len(exception_evidence),
            "raw_response": r["content"], "parsed_answer": parsed, "schema_valid": schema_valid,
            "correct": correct,
            "retrieval_latency_ms": round(retrieval_latency_ms, 3),
            "generation_latency_ms": round(gen_latency_ms, 1),
            "total_latency_ms": round(total_latency_ms, 1),
            "relation_nodes_resolved": len(traversal.matched_nodes),
            "exception_evidence_tokens_est": len(exception_evidence) // 4,
            "root_verification_failures": traversal.root_verification_failures,
            "budget_exhausted_count": traversal.budget_exhausted_count,
            "traversal_complete": traversal.complete,
            "entity_extraction_recall": entity_recall,
            "relation_node_recall": relation_recall,
            "all_required_evidence_recall": all_required_recall,
            "timestamp": time.time(),
        }
        with open(CKPT_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(row) + "\n")

        log(f"  [{item['query_id']}] correct={correct} schema_valid={schema_valid} "
            f"nodes={len(traversal.matched_nodes)} rel_recall={relation_recall:.2f} total_ms={total_latency_ms:.0f}")
        time.sleep(rc.COOLDOWN_S)

    log("=== X4 strike run complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
