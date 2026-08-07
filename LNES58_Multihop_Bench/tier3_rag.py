#!/usr/bin/env python3
"""
RAG baseline for Tier 3 -- identical patients/queries/ground truth as
tier3_adversarial.py (same SEED, same make_patient/build_queries/DOC_B_TEXT),
but the model receives only the top-5 TF-IDF-retrieved chunks from the
COMBINED A+B+C corpus. This tier is the sharpest test of retrieval-miss risk:
temporal_ordering needs EVERY medication's dates (a partial view can flip the
answer), and temporal_negation needs ALL 8 weeks of BP readings (missing one
week can hide or fabricate a stable window) -- these are exactly the
"needle scattered across many small facts" queries RAG structurally
struggles with.
"""
import json, time, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tier3_adversarial import make_patient, build_queries, SYSTEM as BASE_SYSTEM, MAX_TOKENS, SEED, DOC_B_TEXT
import rag_common as rc

N_PATIENTS = int(os.environ.get("N_PATIENTS", "50"))

def required_snippets(facts, qtype):
    if qtype == "temporal_ordering":
        return [facts["cardiac_event"]] + [m["drug"] for m in facts["med_timeline"]]
    if qtype == "absence_detection":
        return ["complete list of lab results", facts["diagnosis"]]
    if qtype == "extrapolation":
        return [facts["date1"], facts["date2"]]
    if qtype == "temporal_negation":
        return [f"Week {b['week']}:" for b in facts["bp_readings"]]
    return []

def run():
    print("=== RAG Baseline -- Tier 3 (adversarial reasoning) ===")
    print(f"Target: Auditor A10 ({rc.AUDITOR_URL}) -- LIVE PRODUCTION infra")
    print(f"N_PATIENTS={N_PATIENTS}  chunk_chars={rc.CHUNK_TARGET_CHARS}  top_k={rc.TOP_K}  "
          f"max_tokens={MAX_TOKENS}  concurrency=1  cooldown={rc.COOLDOWN_S}s")

    rows = []
    consecutive_failures = 0
    query_i = 0
    aborted = False

    for p in range(N_PATIENTS):
        facts, doc_a, doc_c = make_patient(f"AD{100+p}", SEED + p)
        full_corpus_text = f"{doc_a}\n{DOC_B_TEXT}\n\n{doc_c}"
        chunks = rc.chunk_text(full_corpus_text)
        queries = build_queries(facts)
        for q in queries:
            query_i += 1
            retrieved, sim_scores, top_idx = rc.retrieve_top_k(q["question"], chunks)
            retrieved_context = "\n".join(retrieved)
            req_snips = required_snippets(facts, q["type"])
            rhit = rc.retrieval_hit(retrieved_context, req_snips)

            r = rc.call_auditor(BASE_SYSTEM, retrieved_context, q["question"], MAX_TOKENS)
            if not r["ok"]:
                consecutive_failures += 1
                rc.log_trigger("request_failure_or_5xx", {"status": r.get("status"), "error": r.get("error")})
                print(f"  [{query_i}] FAIL status={r.get('status')} err={r.get('error')}")
                if consecutive_failures >= rc.ABORT_AFTER_CONSECUTIVE_FAILURES:
                    print("[ABORT] consecutive failures -- stopping to protect production.", file=sys.stderr)
                    aborted = True
                    break
                time.sleep(rc.COOLDOWN_S)
                continue
            consecutive_failures = 0
            parsed, schema_valid = rc.extract_answer_json(r["content"])
            correct = rc.score_field(parsed, schema_valid, q["ground_truth"], q["score_field"], q.get("tolerance"))
            row = {
                "query_id": q["query_id"], "type": q["type"], "category": q["category"],
                "patient_id": facts["pid"], "question": q["question"], "ground_truth": q["ground_truth"],
                "n_chunks_total": len(chunks), "n_chunks_retrieved": len(retrieved),
                "retrieval_hit": rhit, "retrieved_context": retrieved_context,
                "raw_response": r["content"], "parsed_answer": parsed,
                "schema_valid": schema_valid, "correct": correct,
                "finish_reason": r["finish_reason"], "ttft_ms": r["ttft_ms"], "e2e_ms": round(r["e2e_ms"], 1),
                "completion_tokens": (r["usage"] or {}).get("completion_tokens"),
            }
            rows.append(row)
            print(f"  [{query_i}/{N_PATIENTS*4}] {q['type']:20} correct={correct} retrieval_hit={rhit} "
                  f"chunks={len(retrieved)}/{len(chunks)} e2e_ms={row['e2e_ms']:.0f}")
            time.sleep(rc.COOLDOWN_S)
        if aborted:
            break

    n = len(rows)
    by_type = {}
    for t in ("temporal_ordering", "absence_detection", "extrapolation", "temporal_negation"):
        trows = [r for r in rows if r["type"] == t]
        by_type[t] = {
            "n": len(trows),
            "accuracy": round(sum(1 for r in trows if r["correct"]) / len(trows), 4) if trows else None,
            "schema_valid_pct": round(100 * sum(1 for r in trows if r["schema_valid"]) / len(trows), 1) if trows else None,
            "retrieval_hit_pct": round(100 * sum(1 for r in trows if r["retrieval_hit"]) / len(trows), 1) if trows else None,
        }
    temporal_rows = [r for r in rows if r["category"] in ("temporal", "extrapolation")]
    negation_rows = [r for r in rows if r["category"] == "negation"]
    overall_accuracy = round(sum(1 for r in rows if r["correct"]) / n, 4) if n else None
    overall_schema_valid_pct = round(100 * sum(1 for r in rows if r["schema_valid"]) / n, 1) if n else None
    overall_retrieval_hit_pct = round(100 * sum(1 for r in rows if r["retrieval_hit"]) / n, 1) if n else None
    hit_rows = [r for r in rows if r["retrieval_hit"]]
    accuracy_given_hit = round(sum(1 for r in hit_rows if r["correct"]) / len(hit_rows), 4) if hit_rows else None
    temporal_accuracy_pct = round(100 * sum(1 for r in temporal_rows if r["correct"]) / len(temporal_rows), 1) if temporal_rows else None
    negation_accuracy_pct = round(100 * sum(1 for r in negation_rows if r["correct"]) / len(negation_rows), 1) if negation_rows else None

    summary = {
        "system": "rag_tfidf_top5", "tier": 3, "n_queries": n, "aborted": aborted,
        "overall_accuracy": overall_accuracy, "overall_schema_valid_pct": overall_schema_valid_pct,
        "overall_retrieval_hit_pct": overall_retrieval_hit_pct,
        "accuracy_given_retrieval_hit": accuracy_given_hit,
        "temporal_reasoning_accuracy_pct": temporal_accuracy_pct,
        "negation_accuracy_pct": negation_accuracy_pct,
        "by_type": by_type,
    }
    print("\n=== TIER 3 RAG SUMMARY ===")
    print(json.dumps(summary, indent=2))
    with open("/tmp/lnes58_tier3_rag_result.json", "w") as f:
        json.dump({"summary": summary, "rows": rows}, f, indent=2)
    print("\nwritten -> /tmp/lnes58_tier3_rag_result.json")
    return summary

if __name__ == "__main__":
    run()
