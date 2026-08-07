#!/usr/bin/env python3
"""
Full Set 1 benchmark: Modern RAG vs xLMP, real dataset (601 queries: T1 50x4=200,
T2 67x3=201, T3 50x4=200), 8 arms (S0, R1, R2, R3, R4, X1, X2, O1), default
chunking config -- the primary head-to-head comparison specified in the
operator's Phase 2 directive. Uses the SAME generator calls / seeds / patient-id
prefixes as the original tier{1,2,3}_cross_field/cross_document/adversarial.py
scripts (SEED=42/4242/8181, MH/TR/AD id prefixes) so this is the original
dataset/questions/ground truth, not a new sample.

Chunking-policy sweep (Section 5), full statistical analysis (Section 8), and
R5 (BGE-M3 replication) are follow-on passes layered on top of this run's
checkpoints -- not duplicated here.

Resumable: each arm's checkpoint is an append-only JSONL keyed by query_id;
a restart skips rows already present so a killed/interrupted run can continue
without re-spending API calls or losing prior data.
"""
import json, os, sys, time, hashlib, platform, shutil, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import rag_common as rc
import rag_modern as rm
from tier1_cross_field import make_patient as t1_make_patient, build_queries as t1_build_queries, SYSTEM as T1_SYSTEM, MAX_TOKENS as T1_MAX_TOKENS, SEED as T1_SEED
from tier2_cross_document import make_trio as t2_make_trio, build_queries as t2_build_queries, SYSTEM as T2_SYSTEM, MAX_TOKENS as T2_MAX_TOKENS, SEED as T2_SEED, DOC_B_TEXT as T2_DOC_B_TEXT
from tier3_adversarial import make_patient as t3_make_patient, build_queries as t3_build_queries, SYSTEM as T3_SYSTEM, MAX_TOKENS as T3_MAX_TOKENS, SEED as T3_SEED, DOC_B_TEXT as T3_DOC_B_TEXT
from tier1_rag import required_snippets as t1_required_snippets
from tier2_rag import required_snippets as t2_required_snippets
from tier3_rag import required_snippets as t3_required_snippets
from gold_context import t1_gold_context, t2_gold_context, t3_gold_context

N_T1 = int(os.environ.get("N_T1", "50"))
N_T2 = int(os.environ.get("N_T2", "67"))
N_T3 = int(os.environ.get("N_T3", "50"))

ARMS = ["S0", "X1", "X2", "O1", "R1", "R2", "R3", "R4"]  # lightweight arms (no embedding/reranker models) first --
                                                          # R1-R4 need multi-GB models loaded and are deferred until
                                                          # sustained RAM headroom is available; order doesn't affect
                                                          # per-arm results, checkpoints are keyed by arm independently

RUN_ID = os.environ.get("SET1_RUN_ID")
if not RUN_ID:
    print("ERROR: SET1_RUN_ID must be supplied by the caller (no Date.now()-equivalent here).", file=sys.stderr)
    sys.exit(2)
RESULTS_DIR = os.environ.get("RESULTS_DIR", os.path.join(HERE, "set1_runs", RUN_ID))
os.makedirs(RESULTS_DIR, exist_ok=True)
MANIFEST_PATH = os.path.join(RESULTS_DIR, "manifest.json")
PROGRESS_LOG = os.path.join(RESULTS_DIR, "progress_log.txt")

# --- stop-condition thresholds (operator Section 9) ---
MIN_DISK_GB = 15.0
MIN_RAM_GB = 8.0
LATENCY_SPIKE_FACTOR = 2.0
LATENCY_SPIKE_WINDOW_S = 300  # 5 minutes
ERROR_RATE_WINDOW = 20
ERROR_RATE_THRESHOLD = 0.20


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(PROGRESS_LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def check_resources():
    """Returns (ok, reason). Checks disk and RAM against the operator's
    stop-condition floors. RAM check degrades gracefully if psutil is absent."""
    disk_free_gb = shutil.disk_usage(HERE).free / 1e9
    if disk_free_gb < MIN_DISK_GB:
        return False, f"disk_free={disk_free_gb:.1f}GB < {MIN_DISK_GB}GB floor"
    try:
        import psutil
        avail_gb = psutil.virtual_memory().available / 1e9
        if avail_gb < MIN_RAM_GB:
            return False, f"ram_available={avail_gb:.1f}GB < {MIN_RAM_GB}GB floor"
    except ImportError:
        pass
    return True, None


def build_dataset():
    """Reproduces the ORIGINAL 601-query dataset: same generator functions,
    same seeds, same id prefixes as tier{1,2,3}_{cross_field,cross_document,
    adversarial}.py -- not a fresh random sample."""
    items = []

    for p in range(N_T1):
        facts, record_text = t1_make_patient(f"MH{100+p}", T1_SEED + p)
        chunks = rc.chunk_text(record_text)
        doc_map = ["A"] * len(chunks)
        for q in t1_build_queries(facts):
            items.append(dict(tier=1, system=T1_SYSTEM, max_tokens=T1_MAX_TOKENS,
                               question=q["question"], ground_truth=q["ground_truth"],
                               score_field=q["score_field"], query_id=q["query_id"], type=q["type"],
                               chunks=chunks, doc_map=doc_map, full_text=record_text,
                               required_snips=t1_required_snippets(facts, q["type"]), facts=facts))

    for p in range(N_T2):
        facts, doc_a, doc_c = t2_make_trio(f"TR{100+p}", T2_SEED + p)
        doc_texts = {"A": doc_a, "B": T2_DOC_B_TEXT, "C": doc_c}
        combined_chunks, doc_map = [], []
        for label in ("A", "B", "C"):
            dc = rc.chunk_text(doc_texts[label])
            combined_chunks.extend(dc)
            doc_map.extend([label] * len(dc))
        full_text = f"{doc_a}\n{T2_DOC_B_TEXT}\n\n{doc_c}"
        for q in t2_build_queries(facts):
            items.append(dict(tier=2, system=T2_SYSTEM, max_tokens=T2_MAX_TOKENS,
                               question=q["question"], ground_truth=q["ground_truth"],
                               score_field=q["score_field"], query_id=q["query_id"], type=q["type"],
                               chunks=combined_chunks, doc_map=doc_map, full_text=full_text,
                               required_snips=t2_required_snippets(facts, q["type"]), facts=facts))

    for p in range(N_T3):
        facts, doc_a, doc_c = t3_make_patient(f"AD{100+p}", T3_SEED + p)
        doc_texts = {"A": doc_a, "B": T3_DOC_B_TEXT, "C": doc_c}
        chunks, doc_map = [], []
        for label in ("A", "B", "C"):
            dc = rc.chunk_text(doc_texts[label])
            chunks.extend(dc)
            doc_map.extend([label] * len(dc))
        full_text = f"{doc_a}\n{T3_DOC_B_TEXT}\n\n{doc_c}"
        for q in t3_build_queries(facts):
            items.append(dict(tier=3, system=T3_SYSTEM, max_tokens=T3_MAX_TOKENS,
                               question=q["question"], ground_truth=q["ground_truth"],
                               score_field=q["score_field"], query_id=q["query_id"], type=q["type"],
                               chunks=chunks, doc_map=doc_map, full_text=full_text,
                               required_snips=t3_required_snippets(facts, q["type"]), facts=facts))

    return items


def gold_context_for_item(item):
    tier, facts, qtype = item["tier"], item["facts"], item["type"]
    if tier == 1:
        ctx = t1_gold_context(facts, qtype)
    elif tier == 2:
        ctx = t2_gold_context(facts, qtype, full_text=item["full_text"])
    else:
        ctx = t3_gold_context(facts, qtype)
    return ctx or item["full_text"]


def context_for_arm(arm, item):
    chunks, doc_map, q = item["chunks"], item["doc_map"], item["question"]
    if arm == "S0":
        retrieved, scores, top_idx = rc.retrieve_top_k(q, chunks)
        return "\n".join(retrieved), {"n_chunks_total": len(chunks), "retrieved_idx": top_idx,
                                       "scores": [float(s) for s in scores]}, None
    if arm == "R1":
        retrieved, scores, top_idx = rm.retrieve_dense(q, chunks)
        return "\n".join(retrieved), {"n_chunks_total": len(chunks), "retrieved_idx": top_idx,
                                       "scores": [float(s) for s in scores]}, None
    if arm == "R2":
        retrieved, scores, top_idx = rm.retrieve_hybrid_rrf(q, chunks)
        return "\n".join(retrieved), {"n_chunks_total": len(chunks), "retrieved_idx": top_idx,
                                       "scores": [float(s) for s in scores]}, None
    if arm == "R3":
        retrieved, scores, top_idx, err = rm.retrieve_hybrid_rerank(q, chunks)
        return "\n".join(retrieved), {"n_chunks_total": len(chunks), "retrieved_idx": top_idx,
                                       "scores": [float(s) for s in scores]}, err
    if arm == "R4":
        winning_docs, scores, top_idx, err = rm.retrieve_parent_expanded(q, chunks, doc_map)
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
            meta["note"] = "identical construction to O1 -- see documented methodological caveat"
        return ctx, meta, None
    raise ValueError(f"unknown arm {arm}")


def load_done_ids(ckpt_path):
    done = set()
    if not os.path.exists(ckpt_path):
        return done
    with open(ckpt_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                done.add(row["query_id"])
            except Exception:
                continue
    return done


def load_latency_baseline_by_type(ckpt_path):
    """Seeds a per-query-type latency baseline from this arm's own checkpoint
    history. Query types have genuinely different expected latency (e.g. T3
    'extrapolation' legitimately takes 3-5x longer than T1 factual lookups --
    confirmed in the smoke test), so a single global early-rows baseline
    produces false positives whenever the dataset's fixed T1->T2->T3 tier
    order crosses into a tier with longer, but legitimate, generations. This
    also means baselines survive a resume instead of re-warming-up cold."""
    by_type = {}
    if not os.path.exists(ckpt_path):
        return by_type
    with open(ckpt_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except Exception:
                continue
            if row.get("ok"):
                by_type.setdefault(row["type"], []).append(row["generation_latency_ms"])
    return {t: sum(v) / len(v) for t, v in by_type.items()}


def write_manifest(items):
    dataset_repr = json.dumps(
        [{"query_id": it["query_id"], "type": it["type"], "tier": it["tier"],
          "question": it["question"], "ground_truth": it["ground_truth"]} for it in items],
        sort_keys=True,
    )
    dataset_sha256 = hashlib.sha256(dataset_repr.encode()).hexdigest()

    harness_files = ["rag_common.py", "rag_modern.py", "gold_context.py", "set1_benchmark.py",
                      "tier1_cross_field.py", "tier2_cross_document.py", "tier3_adversarial.py",
                      "tier1_rag.py", "tier2_rag.py", "tier3_rag.py"]
    harness_hashes = {fn: sha256_file(os.path.join(HERE, fn)) for fn in harness_files
                       if os.path.exists(os.path.join(HERE, fn))}

    disk_free_gb = shutil.disk_usage(HERE).free / 1e9
    ram_info = {}
    try:
        import psutil
        vm = psutil.virtual_memory()
        ram_info = {"total_gb": round(vm.total / 1e9, 1), "available_gb": round(vm.available / 1e9, 1),
                    "percent_used": vm.percent}
    except ImportError:
        ram_info = {"note": "psutil not available"}

    manifest = {
        "run_id": RUN_ID,
        "dataset": {"n_t1": N_T1, "n_t2": N_T2, "n_t3": N_T3, "total_queries": len(items),
                    "sha256": dataset_sha256, "seeds": {"t1": T1_SEED, "t2": T2_SEED, "t3": T3_SEED},
                    "note": "identical generator calls/seeds/pid-prefixes to the original tier*.py scripts -- not a fresh sample"},
        "arms": ARMS,
        "chunking": {"target_chars": rc.CHUNK_TARGET_CHARS, "top_k": rc.TOP_K, "note": "default policy only -- sweep is a follow-on pass"},
        "harness_file_sha256": harness_hashes,
        "auditor_url": rc.AUDITOR_URL,
        "model": rc.MODEL,
        "host": {"platform": platform.platform(), "python": platform.python_version(),
                  "disk_free_gb_at_start": round(disk_free_gb, 1), "ram_at_start": ram_info},
        "stop_condition_floors": {"min_disk_gb": MIN_DISK_GB, "min_ram_gb": MIN_RAM_GB,
                                   "latency_spike_factor": LATENCY_SPIKE_FACTOR,
                                   "latency_spike_window_s": LATENCY_SPIKE_WINDOW_S,
                                   "error_rate_window": ERROR_RATE_WINDOW, "error_rate_threshold": ERROR_RATE_THRESHOLD},
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    return manifest


def run_arm(arm, items):
    ckpt_path = os.path.join(RESULTS_DIR, f"checkpoint_{arm}.jsonl")
    done_ids = load_done_ids(ckpt_path)
    remaining = [it for it in items if it["query_id"] not in done_ids]
    log(f"arm {arm}: {len(done_ids)} already done, {len(remaining)} remaining")
    if not remaining:
        return {"arm": arm, "status": "already_complete", "n": len(done_ids)}

    consecutive_failures = 0
    recent_ok = []  # rolling window of 1/0 for error-rate check
    recent_latencies_ts = []  # list of (timestamp, latency_ms, type) for latency-spike window
    baseline_by_type = load_latency_baseline_by_type(ckpt_path)
    type_obs_count = {t: 999 for t in baseline_by_type}  # already-seeded types don't need re-warming
    n_done_this_run = 0

    for idx, item in enumerate(remaining):
        ok_now, reason = check_resources()
        if not ok_now:
            log(f"[STOP-CONDITION] arm {arm}: {reason} -- halting run to protect the host.")
            return {"arm": arm, "status": "stopped", "reason": reason, "n_this_run": n_done_this_run}

        t_r0 = time.time()
        try:
            context, retrieval_meta, retrieval_err = context_for_arm(arm, item)
        except Exception as e:
            retrieval_err = f"{type(e).__name__}: {e}"
            context, retrieval_meta = "", {}
        retrieval_latency_ms = (time.time() - t_r0) * 1000

        t_g0 = time.time()
        try:
            r = rc.call_auditor(item["system"], context, item["question"], item["max_tokens"])
        except Exception as e:
            r = {"ok": False, "error": f"{type(e).__name__}: {e}"}
        gen_latency_ms = (time.time() - t_g0) * 1000
        total_latency_ms = retrieval_latency_ms + gen_latency_ms

        if not r.get("ok"):
            consecutive_failures += 1
            recent_ok.append(0)
            status = r.get("status")
            if status in (401, 403):
                log(f"[STOP-CONDITION] arm {arm}: auth failure (status={status}) -- halting immediately, this is a production-auth issue.")
                return {"arm": arm, "status": "stopped", "reason": f"auth_failure_status_{status}", "n_this_run": n_done_this_run}
            row = {"arm": arm, "query_id": item["query_id"], "tier": item["tier"], "type": item["type"],
                   "ok": False, "error": r.get("error"), "status": status, "timestamp": time.time()}
            try:
                with open(ckpt_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps(row) + "\n")
            except Exception as e:
                log(f"[STOP-CONDITION] arm {arm}: checkpoint write failed ({e}) -- halting, cannot safely continue without checkpointing.")
                return {"arm": arm, "status": "stopped", "reason": "checkpoint_write_failure", "n_this_run": n_done_this_run}
            if consecutive_failures >= rc.ABORT_AFTER_CONSECUTIVE_FAILURES:
                log(f"[STOP-CONDITION] arm {arm}: {consecutive_failures} consecutive failures -- halting to protect production.")
                return {"arm": arm, "status": "stopped", "reason": "consecutive_failures", "n_this_run": n_done_this_run}
            time.sleep(rc.COOLDOWN_S)
            continue

        consecutive_failures = 0
        recent_ok.append(1)
        recent_ok[:] = recent_ok[-ERROR_RATE_WINDOW:]
        if len(recent_ok) >= ERROR_RATE_WINDOW:
            err_rate = 1 - (sum(recent_ok) / len(recent_ok))
            if err_rate > ERROR_RATE_THRESHOLD:
                log(f"[STOP-CONDITION] arm {arm}: rolling error rate {err_rate:.0%} over last {ERROR_RATE_WINDOW} > {ERROR_RATE_THRESHOLD:.0%} -- halting.")
                return {"arm": arm, "status": "stopped", "reason": "error_rate_spike", "n_this_run": n_done_this_run}

        qtype = item["type"]
        now = time.time()
        recent_latencies_ts.append((now, gen_latency_ms, qtype))
        recent_latencies_ts[:] = [(t, l, ty) for t, l, ty in recent_latencies_ts if now - t <= LATENCY_SPIKE_WINDOW_S]

        obs = type_obs_count.get(qtype, 0)
        if obs < 10:
            # still warming up this type's own baseline -- accumulate, don't judge yet
            prior = baseline_by_type.get(qtype)
            baseline_by_type[qtype] = gen_latency_ms if prior is None else (prior * obs + gen_latency_ms) / (obs + 1)
            type_obs_count[qtype] = obs + 1
        else:
            same_type_recent = [l for _, l, ty in recent_latencies_ts if ty == qtype]
            if len(same_type_recent) >= 3:
                window_avg = sum(same_type_recent) / len(same_type_recent)
                baseline = baseline_by_type[qtype]
                if window_avg > baseline * LATENCY_SPIKE_FACTOR:
                    log(f"[STOP-CONDITION] arm {arm}: type={qtype} latency {window_avg:.0f}ms > "
                        f"{LATENCY_SPIKE_FACTOR}x its own baseline {baseline:.0f}ms sustained over {LATENCY_SPIKE_WINDOW_S}s -- halting.")
                    return {"arm": arm, "status": "stopped", "reason": "latency_spike", "n_this_run": n_done_this_run}

        parsed, schema_valid = rc.extract_answer_json(r["content"])
        correct = rc.score_field(parsed, schema_valid, item["ground_truth"], item["score_field"])
        row = {
            "arm": arm, "query_id": item["query_id"], "tier": item["tier"], "type": item["type"],
            "question": item["question"], "ground_truth": item["ground_truth"],
            "retrieval_meta": retrieval_meta, "context_chars": len(context),
            "context_tokens_est": len(context) // 4,
            "raw_response": r["content"], "parsed_answer": parsed, "schema_valid": schema_valid,
            "correct": correct, "retrieval_latency_ms": round(retrieval_latency_ms, 1),
            "generation_latency_ms": round(gen_latency_ms, 1), "total_latency_ms": round(total_latency_ms, 1),
            "finish_reason": r.get("finish_reason"),
            "completion_tokens": (r.get("usage") or {}).get("completion_tokens"),
            "ok": True, "timestamp": time.time(),
        }
        try:
            with open(ckpt_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")
        except Exception as e:
            log(f"[STOP-CONDITION] arm {arm}: checkpoint write failed ({e}) -- halting, cannot safely continue without checkpointing.")
            return {"arm": arm, "status": "stopped", "reason": "checkpoint_write_failure", "n_this_run": n_done_this_run}

        n_done_this_run += 1
        if n_done_this_run % 25 == 0 or (idx + 1) == len(remaining):
            log(f"  arm {arm}: {len(done_ids) + n_done_this_run}/{len(items)} total done ({n_done_this_run} this run)")
        time.sleep(rc.COOLDOWN_S)

    return {"arm": arm, "status": "complete", "n_this_run": n_done_this_run, "n_total": len(done_ids) + n_done_this_run}


def summarize():
    by_arm = {}
    for arm in ARMS:
        ckpt_path = os.path.join(RESULTS_DIR, f"checkpoint_{arm}.jsonl")
        if not os.path.exists(ckpt_path):
            by_arm[arm] = {"n": 0}
            continue
        rows = []
        with open(ckpt_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        rows.append(json.loads(line))
                    except Exception:
                        pass
        ok_rows = [r for r in rows if r.get("ok")]
        if not ok_rows:
            by_arm[arm] = {"n": 0, "n_error_rows": len(rows)}
            continue
        by_arm[arm] = {
            "n": len(ok_rows), "n_error_rows": len(rows) - len(ok_rows),
            "accuracy": round(sum(1 for r in ok_rows if r["correct"]) / len(ok_rows), 4),
            "schema_valid_pct": round(100 * sum(1 for r in ok_rows if r["schema_valid"]) / len(ok_rows), 1),
            "avg_total_latency_ms": round(sum(r["total_latency_ms"] for r in ok_rows) / len(ok_rows), 1),
        }
    return by_arm


def main():
    log("=== Set 1 Benchmark: Modern RAG vs xLMP (real 601-query dataset) ===")
    log(f"Auth: benchmark-dedicated credential only; route /v1/chat/completions; production model untouched.")

    ok, reason = check_resources()
    if not ok:
        log(f"[PRE-FLIGHT STOP] {reason} -- refusing to start Set 1 (operator stop-condition floor).")
        with open(os.path.join(RESULTS_DIR, "preflight_stop.json"), "w", encoding="utf-8") as f:
            json.dump({"stopped": True, "reason": reason, "timestamp": time.time()}, f, indent=2)
        print(json.dumps({"preflight_stopped": True, "reason": reason}))
        return 1

    items = build_dataset()
    log(f"Dataset built: {len(items)} queries (T1={N_T1*4}, T2={N_T2*3}, T3={N_T3*4}), arms={ARMS}")
    manifest = write_manifest(items)
    log(f"Manifest written -> {MANIFEST_PATH} (dataset sha256={manifest['dataset']['sha256'][:16]}...)")

    arm_results = {}
    for arm in ARMS:
        log(f"=== starting arm {arm} ===")
        t0 = time.time()
        result = run_arm(arm, items)
        arm_results[arm] = result
        log(f"=== arm {arm}: {result['status']} in {time.time()-t0:.1f}s ({result}) ===")
        if result["status"] == "stopped":
            log(f"[HALTED] Set 1 run stopped during arm {arm}: {result.get('reason')}. Resume by rerunning -- checkpoints are preserved.")
            break

    summary = {"run_id": RUN_ID, "arm_results": arm_results, "by_arm": summarize(),
               "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    with open(os.path.join(RESULTS_DIR, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    log("=== SET 1 SUMMARY ===")
    log(json.dumps(summary["by_arm"], indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
