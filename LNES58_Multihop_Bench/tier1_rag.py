#!/usr/bin/env python3
"""
RAG baseline for Tier 1 -- identical patients/queries/ground truth as
tier1_cross_field.py (same SEED, same make_patient/build_queries), but the
model receives only the top-5 TF-IDF-retrieved chunks of the patient record
instead of the complete hollow object.

Expectation, stated up front: Tier 1's patient record is short (~6 lines) --
chunking it may yield fewer than 5 chunks total, so top-5 retrieval could
trivially include everything. If so, that's a real and reportable finding
in itself (RAG only differs from xLMP once the source material is large
enough to fragment), not a null result to hide.
"""
import json, time, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tier1_cross_field import make_patient, build_queries, SYSTEM as BASE_SYSTEM, MAX_TOKENS
import rag_common as rc

N_PATIENTS = int(os.environ.get("N_PATIENTS", "50"))
SEED = 42  # identical to tier1_cross_field.SEED -- same patients, same ground truth

def required_snippets(facts, qtype):
    if qtype == "bmi_obesity":
        return [f"{facts['height_cm']} cm", f"{facts['weight_kg']} kg"]
    if qtype == "days_elapsed":
        return [facts["admission_date"], facts["last_lab_date"]]
    if qtype == "dosage_appropriateness":
        return [f"{facts['prescribed_dosage_mg']} mg", f"{facts['weight_kg']} kg"]
    if qtype == "contraindication":
        snips = ["current medications"]
        return snips
    return []

def run():
    print("=== RAG Baseline -- Tier 1 (cross-field inference) ===")
    print(f"Target: Auditor A10 ({rc.AUDITOR_URL}) -- LIVE PRODUCTION infra")
    print(f"N_PATIENTS={N_PATIENTS}  chunk_chars={rc.CHUNK_TARGET_CHARS}  top_k={rc.TOP_K}  "
          f"max_tokens={MAX_TOKENS}  concurrency=1  cooldown={rc.COOLDOWN_S}s")

    rows = []
    consecutive_failures = 0
    query_i = 0
    aborted = False

    for p in range(N_PATIENTS):
        facts, record_text = make_patient(f"MH{100+p}", SEED + p)
        chunks = rc.chunk_text(record_text)
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
            correct = rc.score_field(parsed, schema_valid, q["ground_truth"], q["score_field"])
            row = {
                "query_id": q["query_id"], "type": q["type"], "patient_id": facts["pid"],
                "question": q["question"], "ground_truth": q["ground_truth"],
                "n_chunks_total": len(chunks), "n_chunks_retrieved": len(retrieved),
                "retrieval_hit": rhit, "retrieved_context": retrieved_context,
                "raw_response": r["content"], "parsed_answer": parsed,
                "schema_valid": schema_valid, "correct": correct,
                "finish_reason": r["finish_reason"], "ttft_ms": r["ttft_ms"], "e2e_ms": round(r["e2e_ms"], 1),
                "completion_tokens": (r["usage"] or {}).get("completion_tokens"),
            }
            rows.append(row)
            print(f"  [{query_i}/{N_PATIENTS*4}] {q['type']:24} correct={correct} retrieval_hit={rhit} "
                  f"chunks={len(retrieved)}/{len(chunks)} e2e_ms={row['e2e_ms']:.0f}")
            time.sleep(rc.COOLDOWN_S)
        if aborted:
            break

    n = len(rows)
    by_type = {}
    for t in ("bmi_obesity", "days_elapsed", "dosage_appropriateness", "contraindication"):
        trows = [r for r in rows if r["type"] == t]
        by_type[t] = {
            "n": len(trows),
            "accuracy": round(sum(1 for r in trows if r["correct"]) / len(trows), 4) if trows else None,
            "schema_valid_pct": round(100 * sum(1 for r in trows if r["schema_valid"]) / len(trows), 1) if trows else None,
            "retrieval_hit_pct": round(100 * sum(1 for r in trows if r["retrieval_hit"]) / len(trows), 1) if trows else None,
        }
    overall_accuracy = round(sum(1 for r in rows if r["correct"]) / n, 4) if n else None
    overall_schema_valid_pct = round(100 * sum(1 for r in rows if r["schema_valid"]) / n, 1) if n else None
    overall_retrieval_hit_pct = round(100 * sum(1 for r in rows if r["retrieval_hit"]) / n, 1) if n else None
    # Accuracy conditioned on retrieval actually succeeding -- isolates model
    # reasoning quality from retrieval-miss noise.
    hit_rows = [r for r in rows if r["retrieval_hit"]]
    accuracy_given_hit = round(sum(1 for r in hit_rows if r["correct"]) / len(hit_rows), 4) if hit_rows else None

    summary = {
        "system": "rag_tfidf_top5", "tier": 1, "n_queries": n, "aborted": aborted,
        "overall_accuracy": overall_accuracy, "overall_schema_valid_pct": overall_schema_valid_pct,
        "overall_retrieval_hit_pct": overall_retrieval_hit_pct,
        "accuracy_given_retrieval_hit": accuracy_given_hit,
        "by_type": by_type,
    }
    print("\n=== TIER 1 RAG SUMMARY ===")
    print(json.dumps(summary, indent=2))
    with open("/tmp/lnes58_tier1_rag_result.json", "w") as f:
        json.dump({"summary": summary, "rows": rows}, f, indent=2)
    print("\nwritten -> /tmp/lnes58_tier1_rag_result.json")
    return summary

if __name__ == "__main__":
    run()
