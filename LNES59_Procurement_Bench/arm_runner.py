"""
LNES-59.2B arm orchestration. Builds, for every (case, arm) pair, the
exact prompt to send to the shared generation model plus retrieval
metadata (retrieved doc_ids, latencies) needed for scoring -- everything
EXCEPT the actual model call itself, which happens outside this process
(via an Agent-tool subagent, the established no-new-credential mechanism
for this project) since a plain Python module cannot invoke that tool.

Usage: precompute_all_prompts() returns a list of case-arm work items;
the caller issues the generation call for each item.prompt, then feeds
the raw response back through candidate_claim.parse_candidate_claim()
and (for X1/X2) state_consistency_gate_v2.evaluate().
"""

import json
import os
import time

from deterministic_extraction import extract_case_state
from rag_chunking import chunk_documents
from rag_dense import build_dense_index, dense_search
from rag_hybrid import build_bm25_index, hybrid_search
from rag_rerank import hybrid_rerank_search
from b4_structured_memory import build_fact_store, retrieve_facts
from arm_prompts import (
    build_prompt_b0, build_prompt_retrieved, build_prompt_structured_facts,
    build_prompt_x0, build_prompt_state_envelope,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ARMS = ("B0", "B1", "B2", "B3", "B4", "X0", "X1", "X2")


def load_holdout():
    with open(os.path.join(SCRIPT_DIR, "LNES59_RUNNER_HOLDOUT.json"), encoding="utf-8") as f:
        runner = json.load(f)
    with open(os.path.join(SCRIPT_DIR, "LNES59_EVALUATOR_HOLDOUT.json"), encoding="utf-8") as f:
        evaluator = json.load(f)
    docs_by_id = {d["id"]: d for d in runner["documents"]}
    return runner, evaluator, docs_by_id


def build_shared_indices(docs_by_id):
    """Built ONCE over the full holdout corpus, reused for every case's
    B1/B2/B3/B4 retrieval -- real retrieval doesn't know in advance which
    documents matter for a given query."""
    t0 = time.time()
    chunks = chunk_documents(docs_by_id)
    chunk_time = time.time() - t0

    t0 = time.time()
    dense_index, chunks = build_dense_index(chunks)
    dense_build_time = time.time() - t0

    t0 = time.time()
    bm25_index, _ = build_bm25_index(chunks)
    bm25_build_time = time.time() - t0

    fact_store = build_fact_store(docs_by_id)

    return {
        "chunks": chunks, "dense_index": dense_index, "bm25_index": bm25_index,
        "fact_store": fact_store,
        "build_times": {"chunk": chunk_time, "dense_index": dense_build_time, "bm25_index": bm25_build_time},
    }


def build_work_item(case, arm, docs_by_id, indices, arm_configs):
    query = case["query"]
    t0 = time.time()
    retrieved_doc_ids = None
    latencies = {}

    if arm == "B0":
        prompt, truncated = build_prompt_b0(case, docs_by_id.values(), arm_configs["arms"]["B0"]["max_docs"])
        latencies["retrieval"] = time.time() - t0

    elif arm == "B1":
        cfg = arm_configs["arms"]["B1"]
        results = dense_search(query, indices["dense_index"], indices["chunks"], cfg["top_k"])
        latencies["retrieval"] = time.time() - t0
        retrieved_doc_ids = [r["doc_id"] for r in results]
        prompt = build_prompt_retrieved(case, results, "B1_DENSE_RAG")

    elif arm == "B2":
        cfg = arm_configs["arms"]["B2"]
        results = hybrid_search(query, indices["dense_index"], indices["bm25_index"], indices["chunks"],
                                 cfg["dense_candidate_depth"], cfg["final_top_k"])
        latencies["retrieval"] = time.time() - t0
        retrieved_doc_ids = [r["doc_id"] for r in results]
        prompt = build_prompt_retrieved(case, results, "B2_HYBRID_RAG")

    elif arm == "B3":
        cfg = arm_configs["arms"]["B3"]
        results = hybrid_rerank_search(query, indices["dense_index"], indices["bm25_index"], indices["chunks"],
                                        cfg["hybrid_candidate_pool_depth"], cfg["final_top_k"])
        latencies["retrieval"] = time.time() - t0
        retrieved_doc_ids = [r["doc_id"] for r in results]
        prompt = build_prompt_retrieved(case, results, "B3_HYBRID_RERANKER")

    elif arm == "B4":
        facts = retrieve_facts(indices["fact_store"], query_hint=query)
        latencies["retrieval"] = time.time() - t0
        prompt = build_prompt_structured_facts(case, facts)

    elif arm == "X0":
        bounded_docs = [docs_by_id[did] for did in case["grounding_document_ids"]]
        prompt = build_prompt_x0(case, bounded_docs)
        latencies["retrieval"] = time.time() - t0

    elif arm in ("X1", "X2"):
        committed = extract_case_state(
            case["grounding_document_ids"], case["predicate"], docs_by_id,
            compare_against_predicate=case.get("compare_against_predicate"),
        )
        latencies["state_resolution"] = time.time() - t0
        prompt = build_prompt_state_envelope(case, committed)

    else:
        raise ValueError(f"unknown arm: {arm}")

    item = {
        "case_id": case["case_id"], "arm": arm, "prompt": prompt,
        "retrieved_doc_ids": retrieved_doc_ids, "latencies": latencies,
    }
    if arm in ("X1", "X2"):
        item["_committed_state"] = committed  # kept for the gate step, not serialized
    return item


def precompute_all_prompts(evaluator_cases, docs_by_id, indices, arm_configs, arms=ARMS):
    """Returns a flat list of work items across every (case, arm) pair --
    50 cases x len(arms). Each item has everything needed to issue the
    generation call except the call itself."""
    items = []
    for case in evaluator_cases:
        for arm in arms:
            items.append(build_work_item(case, arm, docs_by_id, indices, arm_configs))
    return items
