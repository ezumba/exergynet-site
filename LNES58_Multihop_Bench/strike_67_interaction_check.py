#!/usr/bin/env python3
"""
LNES-58.5A strike benchmark: 67 interaction_check queries only.
A0 = frozen original X2 (read from the existing, unmodified checkpoint --
     NOT re-run, per "do not modify the frozen 8-arm benchmark artifacts").
A1 = X2 evidence (E_d) + deterministic FK-resolved Document B (E_x), live run.

Same model, same system prompt, same max_tokens, same scoring, same query
set (same seed=4242, same trio construction) as the frozen run -- only the
evidence construction differs for A1.
"""
import json, os, sys, time, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import rag_common as rc
from tier2_cross_document import make_trio, build_queries, SYSTEM, MAX_TOKENS, SEED, DOC_B_TEXT
from deterministic_fk_resolver import (
    InMemoryVaultRootResolver, resolve_topological_dependencies,
    DEFAULT_LNES_58_5A_BUDGET, sha256_hex,
)

N_TRIOS = 67
RUN_ID = os.environ.get("SET1_RUN_ID", "strike_67_interaction_check")
OUT_DIR = os.path.join(HERE, "set1_runs", "run1_20260806_134906")
CKPT_PATH = os.path.join(OUT_DIR, "checkpoint_A1_interaction_fk.jsonl")
LOG_PATH = os.environ.get("STRIKE_LOG_PATH", os.path.join(OUT_DIR, "strike_A1.log"))


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


# Fixture: register the REAL Document B content under its REAL SHA-256 root.
DOC_B_ROOT = sha256_hex(DOC_B_TEXT.encode("utf-8"))
resolver = InMemoryVaultRootResolver()
resolver.put(DOC_B_ROOT, DOC_B_TEXT.encode("utf-8"))


def t2_gold_context_interaction(facts) -> str:
    # Unchanged E_d(q) -- identical to the current gold_context.py branch.
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
                "query_id": q["query_id"], "type": q["type"],
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
    items = build_interaction_check_dataset()
    assert len(items) == 67, f"expected 67 interaction_check queries, got {len(items)}"
    log(f"=== LNES-58.5A strike: A1 (X2 + deterministic FK resolver), {len(items)} interaction_check queries ===")

    done_ids = load_done_ids()
    remaining = [it for it in items if it["query_id"] not in done_ids]
    log(f"{len(done_ids)} already done, {len(remaining)} remaining")

    consecutive_failures = 0
    for idx, item in enumerate(remaining):
        t_r0 = time.time()

        e_d = t2_gold_context_interaction(item["facts"])
        resolution = resolve_topological_dependencies([DOC_B_ROOT], resolver, DEFAULT_LNES_58_5A_BUDGET)
        e_x = "\n".join(resolution.evidence)
        context = f"{e_d}\n{e_x}" if e_x else e_d

        retrieval_latency_ms = (time.time() - t_r0) * 1000

        t_g0 = time.time()
        r = rc.call_auditor(SYSTEM, context, item["question"], MAX_TOKENS)
        gen_latency_ms = (time.time() - t_g0) * 1000
        total_latency_ms = retrieval_latency_ms + gen_latency_ms

        if not r.get("ok"):
            consecutive_failures += 1
            status = r.get("status")
            row = {"query_id": item["query_id"], "type": item["type"], "ok": False,
                   "error": r.get("error"), "status": status, "timestamp": time.time()}
            with open(CKPT_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")
            log(f"  [{item['query_id']}] FAIL status={status} err={r.get('error')}")
            if consecutive_failures >= 3:
                log("[STOP] 3 consecutive failures -- halting.")
                return 1
            time.sleep(rc.COOLDOWN_S)
            continue
        consecutive_failures = 0

        parsed, schema_valid = rc.extract_answer_json(r["content"])
        correct = rc.score_field(parsed, schema_valid, item["ground_truth"], item["score_field"])

        n_resolved = sum(1 for d in resolution.resolved if d.status == "resolved")
        n_unresolved = sum(1 for d in resolution.resolved if d.status == "unresolved")
        n_invalid_root = sum(1 for d in resolution.resolved if d.status == "invalid_root")
        n_budget_exceeded = sum(1 for d in resolution.resolved if d.status == "budget_exceeded")
        exception_evidence_tokens = len(e_x) // 4  # rough token estimate, chars/4

        row = {
            "query_id": item["query_id"], "type": item["type"], "ok": True,
            "question": item["question"], "ground_truth": item["ground_truth"],
            "context_chars": len(context), "e_d_chars": len(e_d), "e_x_chars": len(e_x),
            "raw_response": r["content"], "parsed_answer": parsed, "schema_valid": schema_valid,
            "correct": correct,
            "retrieval_latency_ms": round(retrieval_latency_ms, 2),
            "generation_latency_ms": round(gen_latency_ms, 1),
            "total_latency_ms": round(total_latency_ms, 1),
            "fk_declared": 1, "fk_resolved": n_resolved, "fk_unresolved": n_unresolved,
            "fk_invalid_root": n_invalid_root, "fk_budget_exceeded": n_budget_exceeded,
            "exception_evidence_tokens_est": exception_evidence_tokens,
            "resolution_complete": resolution.complete,
            "timestamp": time.time(),
        }
        with open(CKPT_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(row) + "\n")

        log(f"  [{item['query_id']}] correct={correct} schema_valid={schema_valid} "
            f"fk_resolved={n_resolved}/1 total_ms={total_latency_ms:.0f}")
        time.sleep(rc.COOLDOWN_S)

    log("=== A1 strike run complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
