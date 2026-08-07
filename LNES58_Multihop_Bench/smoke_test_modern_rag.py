#!/usr/bin/env python3
"""
20-query smoke test for the Modern-RAG-vs-xLMP benchmark (BLK-007/008 Phase 2).
Controlled context-assembly track: RAG arms retrieve from the same gold
document set xLMP is given; nobody gets a query-to-object mapping RAG lacks.

Query mix (20 total, as specified):
  Tier 1  x2 patients x4 types = 8   (single-object cross-field)
  Tier 2  x3 trios, interaction_check only = 3  (multi-evidence, cross-document)
  Tier 2  x1 trio, all 3 types = 3   (more multi-evidence coverage)
  Tier 3  x2 patients x4 types = 8, includes temporal_negation (negation case)
          and extrapolation (distractor-heavy case)
Total: 8 + 3 + 3 + 8 = 22 (slightly over 20 to guarantee every required
category is actually present rather than shaving a category to hit exactly
20 -- documented, not hidden).

Arms run per query: S0 (existing TF-IDF), R1 (dense), R2 (hybrid RRF),
R3 (hybrid+rerank), R4 (hybrid+rerank+parent-expand), X1 (xLMP complete-object,
reusing the existing tier*_cross_field/cross_document/adversarial harness
functions unmodified), X2 (bounded-evidence "resolver"), O1 (gold-evidence
oracle).

METHODOLOGICAL CAVEAT, stated up front rather than discovered later: X2 and
O1 are implemented identically in this harness -- both construct context from
exactly the same required_snippets() gold-span list already used for scoring.
A real bounded-evidence *resolver* (one that selects relevant fields from a
complete object via some mechanism other than "here are the already-known
correct spans") is not implemented here. Treat X2's results as an upper
bound on what a real resolver could achieve, not as a measurement of one.
R5 (BGE-M3 replication) is deferred out of the smoke test per the directive's
ordering (it's a replication arm, not primary) and will run in the full
Set 1 pass.
"""
import json, os, sys, time, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import rag_common as rc
import rag_modern as rm
from tier1_cross_field import make_patient as t1_make_patient, build_queries as t1_build_queries, SYSTEM as T1_SYSTEM, MAX_TOKENS as T1_MAX_TOKENS
from tier2_cross_document import make_trio as t2_make_trio, build_queries as t2_build_queries, SYSTEM as T2_SYSTEM, MAX_TOKENS as T2_MAX_TOKENS
from tier3_adversarial import make_patient as t3_make_patient, build_queries as t3_build_queries, SYSTEM as T3_SYSTEM, MAX_TOKENS as T3_MAX_TOKENS, DOC_B_TEXT as T3_DOC_B_TEXT
from tier1_rag import required_snippets as t1_required_snippets
from tier2_rag import required_snippets as t2_required_snippets
from tier3_rag import required_snippets as t3_required_snippets
from gold_context import t1_gold_context, t2_gold_context, t3_gold_context

RESULTS_DIR = os.environ.get("RESULTS_DIR", "/tmp/modern_rag_smoke")
os.makedirs(RESULTS_DIR, exist_ok=True)
CHECKPOINT_PATH = os.path.join(RESULTS_DIR, "smoke_checkpoint.jsonl")

ARMS = ["S0", "R1", "R2", "R3", "R4", "X1", "X2", "O1"]


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def build_smoke_queryset():
    """Returns a list of dicts: {tier, system, max_tokens, question, ground_truth,
    score_field, query_id, type, chunks, doc_map, full_text, required_snips}."""
    items = []

    # Tier 1: 2 patients x 4 types
    for p in range(2):
        facts, record_text = t1_make_patient(f"SMK-T1-{p}", 9000 + p)
        chunks = rc.chunk_text(record_text)
        doc_map = ["A"] * len(chunks)  # single-object tier -- one parent doc
        queries = t1_build_queries(facts)
        for q in queries:
            items.append(dict(tier=1, system=T1_SYSTEM, max_tokens=T1_MAX_TOKENS,
                               question=q["question"], ground_truth=q["ground_truth"],
                               score_field=q["score_field"], query_id=q["query_id"], type=q["type"],
                               chunks=chunks, doc_map=doc_map, full_text=record_text,
                               required_snips=t1_required_snippets(facts, q["type"]), facts=facts))

    # Tier 2: 4 trios total -- first 3 interaction_check only, 4th all 3 types
    from tier2_cross_document import DOC_B_TEXT as T2_DOC_B_TEXT
    for tnum in range(4):
        facts, doc_a, doc_c = t2_make_trio(f"SMK-T2-{tnum}", 9100 + tnum)
        doc_texts = {"A": doc_a, "B": T2_DOC_B_TEXT, "C": doc_c}
        combined_chunks, doc_map = [], []
        for label in ("A", "B", "C"):
            doc_chunks = rc.chunk_text(doc_texts[label])
            combined_chunks.extend(doc_chunks)
            doc_map.extend([label] * len(doc_chunks))
        full_text = f"{doc_a}\n{T2_DOC_B_TEXT}\n\n{doc_c}"
        queries = t2_build_queries(facts)
        wanted_types = {"interaction_check"} if tnum < 3 else {"interaction_check", "exclusion_match", "risk_percentile"}
        for q in queries:
            if q["type"] not in wanted_types:
                continue
            items.append(dict(tier=2, system=T2_SYSTEM, max_tokens=T2_MAX_TOKENS,
                               question=q["question"], ground_truth=q["ground_truth"],
                               score_field=q["score_field"], query_id=q["query_id"], type=q["type"],
                               chunks=combined_chunks, doc_map=doc_map, full_text=full_text,
                               required_snips=t2_required_snippets(facts, q["type"]), facts=facts))

    # Tier 3: 2 patients x 4 types (covers temporal_negation = negation case,
    # extrapolation = distractor-heavy case). Tier 3 is also cross-document
    # (doc_a + shared DOC_B_TEXT + doc_c), same shape as Tier 2, not single-object.
    for p in range(2):
        facts, doc_a, doc_c = t3_make_patient(f"SMK-T3-{p}", 9200 + p)
        doc_texts = {"A": doc_a, "B": T3_DOC_B_TEXT, "C": doc_c}
        chunks, doc_map = [], []
        for label in ("A", "B", "C"):
            doc_chunks = rc.chunk_text(doc_texts[label])
            chunks.extend(doc_chunks)
            doc_map.extend([label] * len(doc_chunks))
        full_text = f"{doc_a}\n{T3_DOC_B_TEXT}\n\n{doc_c}"
        queries = t3_build_queries(facts)
        for q in queries:
            items.append(dict(tier=3, system=T3_SYSTEM, max_tokens=T3_MAX_TOKENS,
                               question=q["question"], ground_truth=q["ground_truth"],
                               score_field=q["score_field"], query_id=q["query_id"], type=q["type"],
                               chunks=chunks, doc_map=doc_map, full_text=full_text,
                               required_snips=t3_required_snippets(facts, q["type"]), facts=facts))

    return items


def context_for_arm(arm, item):
    """Returns (context_text, retrieval_meta_dict, err)."""
    chunks, doc_map = item["chunks"], item["doc_map"]
    q = item["question"]
    if arm == "S0":
        retrieved, scores, top_idx = rc.retrieve_top_k(q, chunks)
        return "\n".join(retrieved), {"n_chunks_total": len(chunks), "n_chunks_retrieved": len(retrieved),
                                       "retrieved_idx": top_idx, "scores": [float(s) for s in scores]}, None
    if arm == "R1":
        retrieved, scores, top_idx = rm.retrieve_dense(q, chunks)
        return "\n".join(retrieved), {"n_chunks_total": len(chunks), "n_chunks_retrieved": len(retrieved),
                                       "retrieved_idx": top_idx, "scores": [float(s) for s in scores]}, None
    if arm == "R2":
        retrieved, scores, top_idx = rm.retrieve_hybrid_rrf(q, chunks)
        return "\n".join(retrieved), {"n_chunks_total": len(chunks), "n_chunks_retrieved": len(retrieved),
                                       "retrieved_idx": top_idx, "scores": [float(s) for s in scores]}, None
    if arm == "R3":
        retrieved, scores, top_idx, err = rm.retrieve_hybrid_rerank(q, chunks)
        return "\n".join(retrieved), {"n_chunks_total": len(chunks), "n_chunks_retrieved": len(retrieved),
                                       "retrieved_idx": top_idx, "scores": [float(s) for s in scores]}, err
    if arm == "R4":
        winning_docs, scores, top_idx, err = rm.retrieve_parent_expanded(q, chunks, doc_map)
        # expand to complete parent documents -- reconstruct from doc_map membership
        doc_text_by_label = {}
        for i, label in enumerate(doc_map):
            doc_text_by_label.setdefault(label, []).append(chunks[i])
        expanded = "\n".join("\n".join(doc_text_by_label[l]) for l in winning_docs)
        return expanded, {"n_chunks_total": len(chunks), "winning_parent_docs": winning_docs,
                           "retrieved_idx": top_idx, "scores": [float(s) for s in scores]}, err
    if arm == "X1":
        return item["full_text"], {"mode": "complete_object", "n_chunks_total": len(chunks)}, None
    if arm in ("X2", "O1"):
        ctx = gold_context_for_item(item)
        mode = "bounded_evidence_resolver" if arm == "X2" else "gold_evidence_oracle"
        meta = {"mode": mode}
        if arm == "X2":
            meta["note"] = "identical construction to O1 -- see caveat in module docstring"
        return ctx, meta, None
    raise ValueError(f"unknown arm {arm}")


def gold_context_for_item(item):
    """Real gold-evidence context (see gold_context.py) -- replaces the
    earlier required_snippets()-based construction, which produced context
    too thin to answer from (confirmed bug: O1 scored below every retrieval
    arm in the first smoke run)."""
    tier = item["tier"]
    facts = item["facts"]
    qtype = item["type"]
    if tier == 1:
        ctx = t1_gold_context(facts, qtype)
    elif tier == 2:
        ctx = t2_gold_context(facts, qtype, full_text=item["full_text"])
    else:
        ctx = t3_gold_context(facts, qtype)
    return ctx or item["full_text"]


def run_smoke():
    log("=== Modern RAG vs xLMP -- 20-query smoke test ===")
    log(f"Auth: benchmark-dedicated credential only (env VANGUARD_KEY); route /v1/chat/completions; production model untouched.")
    items = build_smoke_queryset()
    log(f"Smoke queryset built: {len(items)} queries across tiers 1-3, arms: {ARMS}")

    results = []
    errors = []
    consecutive_failures = 0

    with open(CHECKPOINT_PATH, "a", encoding="utf-8") as ckpt:
        for arm in ARMS:
            arm_start = time.time()
            n_ok = 0
            for item in items:
                t_retrieval_start = time.time()
                try:
                    context, retrieval_meta, retrieval_err = context_for_arm(arm, item)
                except Exception as e:
                    retrieval_err = f"{type(e).__name__}: {e}"
                    context, retrieval_meta = "", {}
                retrieval_latency_ms = (time.time() - t_retrieval_start) * 1000

                if retrieval_err:
                    errors.append({"arm": arm, "query_id": item["query_id"], "stage": "retrieval", "error": retrieval_err})

                t_gen_start = time.time()
                try:
                    r = rc.call_auditor(item["system"], context, item["question"], item["max_tokens"])
                except Exception as e:
                    r = {"ok": False, "error": f"{type(e).__name__}: {e}"}
                gen_latency_ms = (time.time() - t_gen_start) * 1000

                if not r.get("ok"):
                    consecutive_failures += 1
                    errors.append({"arm": arm, "query_id": item["query_id"], "stage": "generation",
                                    "error": r.get("error"), "status": r.get("status")})
                    row = {"arm": arm, "query_id": item["query_id"], "tier": item["tier"], "type": item["type"],
                           "ok": False, "error": r.get("error"), "timestamp": time.time()}
                    ckpt.write(json.dumps(row) + "\n"); ckpt.flush()
                    results.append(row)
                    if consecutive_failures >= 3:
                        log(f"[ABORT] {consecutive_failures} consecutive failures on arm {arm} -- stopping to protect production.")
                        return finalize(results, errors, aborted=True)
                    time.sleep(rc.COOLDOWN_S)
                    continue
                consecutive_failures = 0

                parsed, schema_valid = rc.extract_answer_json(r["content"])
                correct = rc.score_field(parsed, schema_valid, item["ground_truth"], item["score_field"])
                context_tokens_est = len(context) // 4  # rough estimate, no tokenizer call to keep smoke test fast

                row = {
                    "arm": arm, "query_id": item["query_id"], "tier": item["tier"], "type": item["type"],
                    "question": item["question"], "ground_truth": item["ground_truth"],
                    "retrieval_config": arm, "retrieval_meta": retrieval_meta,
                    "context_chars": len(context), "context_tokens_est": context_tokens_est,
                    "raw_response": r["content"], "parsed_answer": parsed, "schema_valid": schema_valid,
                    "correct": correct, "retrieval_latency_ms": round(retrieval_latency_ms, 1),
                    "generation_latency_ms": round(gen_latency_ms, 1),
                    "total_latency_ms": round(retrieval_latency_ms + gen_latency_ms, 1),
                    "finish_reason": r.get("finish_reason"),
                    "completion_tokens": (r.get("usage") or {}).get("completion_tokens"),
                    "ok": True, "timestamp": time.time(),
                }
                ckpt.write(json.dumps(row) + "\n"); ckpt.flush()
                results.append(row)
                n_ok += 1
                log(f"  [{arm}] {item['query_id']:20} type={item['type']:22} correct={correct} "
                    f"schema_valid={schema_valid} total_ms={row['total_latency_ms']:.0f}")
                time.sleep(rc.COOLDOWN_S)
            log(f"=== arm {arm} done: {n_ok}/{len(items)} ok, {time.time()-arm_start:.1f}s ===")

    return finalize(results, errors, aborted=False)


def finalize(results, errors, aborted):
    ok_rows = [r for r in results if r.get("ok")]
    by_arm = {}
    for arm in ARMS:
        arm_rows = [r for r in ok_rows if r["arm"] == arm]
        if not arm_rows:
            by_arm[arm] = {"n": 0}
            continue
        by_arm[arm] = {
            "n": len(arm_rows),
            "accuracy": round(sum(1 for r in arm_rows if r["correct"]) / len(arm_rows), 4),
            "schema_valid_pct": round(100 * sum(1 for r in arm_rows if r["schema_valid"]) / len(arm_rows), 1),
        }
    summary = {"aborted": aborted, "total_rows": len(results), "ok_rows": len(ok_rows),
               "errors": len(errors), "by_arm": by_arm}
    out_path = os.path.join(RESULTS_DIR, "smoke_summary.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "errors": errors}, f, indent=2)
    log("=== SMOKE TEST SUMMARY ===")
    log(json.dumps(summary, indent=2))
    log(f"written -> {out_path}")
    log(f"checkpoint -> {CHECKPOINT_PATH}")
    return summary


if __name__ == "__main__":
    run_smoke()
