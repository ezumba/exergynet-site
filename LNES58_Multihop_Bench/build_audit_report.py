#!/usr/bin/env python3
"""
Builds Modern_RAG_vs_xLMP_Comprehensive_Audit.json + a markdown summary table
from the Set 1 run's per-arm checkpoints. Reports measured numbers only --
no arm's language implies a conclusion the data doesn't support. Retrieval
and inference latency are already recorded separately per row by
set1_benchmark.py (retrieval_latency_ms, generation_latency_ms), so this is
pure aggregation, no re-measurement.
"""
import json, os, sys, hashlib, statistics as stats

RESULTS_DIR = sys.argv[1] if len(sys.argv) > 1 else \
    r"C:\Users\ezumb\Downloads\exergynet\LNES58_Multihop_Bench\set1_runs\run1_20260806_134906"

ARMS = ["S0", "R1", "R2", "R3", "R4", "X1", "X2", "O1"]
ARM_LABELS = {
    "S0": "TF-IDF sparse baseline", "R1": "Dense (Qwen3-Embedding)",
    "R2": "Hybrid RRF (BM25+dense)", "R3": "Hybrid + Reranker",
    "R4": "Hybrid + Reranker + Parent-Document Expansion",
    "X1": "xLMP Complete-Object", "X2": "xLMP Bounded-Evidence-Resolver",
    "O1": "Gold-Evidence Oracle",
}


def load_rows(arm):
    path = os.path.join(RESULTS_DIR, f"checkpoint_{arm}.jsonl")
    if not os.path.exists(path):
        return []
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except Exception:
                    pass
    return rows


def pctl(values, p):
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * p
    f, c = int(k), min(int(k) + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


def summarize(arm):
    rows = load_rows(arm)
    ok_rows = [r for r in rows if r.get("ok")]
    n_total = len(rows)
    n_ok = len(ok_rows)
    if not ok_rows:
        return {"arm": arm, "label": ARM_LABELS[arm], "n_total": n_total, "n_ok": 0,
                "status": "not_started" if n_total == 0 else "no_successful_rows"}

    ret_lat = [r["retrieval_latency_ms"] for r in ok_rows if "retrieval_latency_ms" in r]
    gen_lat = [r["generation_latency_ms"] for r in ok_rows if "generation_latency_ms" in r]
    tot_lat = [r["total_latency_ms"] for r in ok_rows if "total_latency_ms" in r]
    n_correct = sum(1 for r in ok_rows if r.get("correct"))
    n_schema_valid = sum(1 for r in ok_rows if r.get("schema_valid"))

    def latstats(vals):
        if not vals:
            return None
        return {"mean_ms": round(stats.mean(vals), 1), "median_ms": round(stats.median(vals), 1),
                "p95_ms": round(pctl(vals, 0.95), 1) if len(vals) > 1 else round(vals[0], 1),
                "min_ms": round(min(vals), 1), "max_ms": round(max(vals), 1)}

    accuracy = round(n_correct / n_ok, 4)
    total_mean_s = (stats.mean(tot_lat) / 1000.0) if tot_lat else None
    efficiency_frontier = round((accuracy * 100) / total_mean_s, 3) if total_mean_s else None

    return {
        "arm": arm, "label": ARM_LABELS[arm],
        "n_total": n_total, "n_ok": n_ok, "n_errors": n_total - n_ok,
        "complete": n_total >= 601,
        "accuracy": accuracy,
        "schema_valid_pct": round(100 * n_schema_valid / n_ok, 1),
        "accuracy_to_latency_ratio": efficiency_frontier,
        "accuracy_to_latency_ratio_note": "accuracy% / total end-to-end latency in seconds -- higher is more accuracy per second of wall-clock compute",
        "retrieval_latency": latstats(ret_lat),
        "inference_latency": latstats(gen_lat),
        "total_latency": latstats(tot_lat),
    }


def build_report():
    per_arm = {arm: summarize(arm) for arm in ARMS}

    # Objective 1: reranking tax -- retrieval vs inference latency, R2/R3/R4 vs xLMP arms
    reranking_tax = {}
    for arm in ["R2", "R3", "R4", "X1", "X2", "O1", "S0", "R1"]:
        s = per_arm[arm]
        if s.get("retrieval_latency") and s.get("inference_latency"):
            reranking_tax[arm] = {
                "label": s["label"],
                "retrieval_mean_ms": s["retrieval_latency"]["mean_ms"],
                "inference_mean_ms": s["inference_latency"]["mean_ms"],
                "retrieval_share_of_total_pct": round(
                    100 * s["retrieval_latency"]["mean_ms"] /
                    (s["retrieval_latency"]["mean_ms"] + s["inference_latency"]["mean_ms"]), 1
                ) if (s["retrieval_latency"]["mean_ms"] + s["inference_latency"]["mean_ms"]) > 0 else None,
            }

    # Objective 2: R4 (parent-document) vs X2 (xLMP bounded-evidence-resolver)
    r4, x2 = per_arm.get("R4"), per_arm.get("X2")
    parent_doc_comparison = None
    if r4 and x2 and r4.get("n_ok") and x2.get("n_ok"):
        parent_doc_comparison = {
            "R4_accuracy": r4["accuracy"], "R4_schema_valid_pct": r4["schema_valid_pct"],
            "R4_complete": r4["complete"],
            "X2_accuracy": x2["accuracy"], "X2_schema_valid_pct": x2["schema_valid_pct"],
            "X2_complete": x2["complete"],
            "accuracy_delta_X2_minus_R4": round(x2["accuracy"] - r4["accuracy"], 4),
            "note": "Delta reported as measured; no per-row failure-mode analysis (e.g. medication/adverse-effect "
                    "separation) has been performed -- would require reading individual R4 incorrect rows against "
                    "the source documents, not done in this pass.",
        }

    # Objective 3: X1 (complete-object) vs O1 (gold-evidence oracle)
    x1, o1 = per_arm.get("X1"), per_arm.get("O1")
    gold_oracle_delta = None
    if x1 and o1 and x1.get("n_ok") and o1.get("n_ok"):
        delta = round(x1["accuracy"] - o1["accuracy"], 4)
        gold_oracle_delta = {
            "X1_accuracy": x1["accuracy"], "O1_accuracy": o1["accuracy"], "delta": delta,
            "characterization": (
                "X1 accuracy matches O1 within the noise of a single 601-query run"
                if abs(delta) <= 0.02 else
                "X1 accuracy measurably differs from O1 on this run"
            ),
            "note": "This reports a measured accuracy match/mismatch on one benchmark run, not a formal proof of "
                    "any theoretical bound. A single empirical result does not establish a maximum, regardless of "
                    "how close the numbers land.",
        }

    frontier_ranked = sorted(
        [(a, per_arm[a]["accuracy_to_latency_ratio"]) for a in ARMS
         if per_arm[a].get("accuracy_to_latency_ratio") is not None],
        key=lambda t: -t[1]
    )

    report = {
        "artifact": "Modern_RAG_vs_xLMP_Comprehensive_Audit",
        "run_id": os.path.basename(RESULTS_DIR),
        "dataset": "601 real queries (T1=200, T2=201, T3=200), LNES-58 Multihop Bench",
        "arms_status": {a: {"n_ok": per_arm[a].get("n_ok", 0), "complete": per_arm[a].get("complete", False)}
                         for a in ARMS},
        "all_arms_complete": all(per_arm[a].get("complete") for a in ARMS),
        "per_arm": per_arm,
        "reranking_tax_analysis": reranking_tax,
        "parent_document_vs_bounded_evidence_resolver": parent_doc_comparison,
        "complete_object_vs_gold_oracle": gold_oracle_delta,
        "efficiency_frontier_ranking": [{"arm": a, "label": per_arm[a]["label"], "accuracy_to_latency_ratio": r}
                                         for a, r in frontier_ranked],
    }
    return report


def write_outputs(report, out_dir):
    json_path = os.path.join(out_dir, "Modern_RAG_vs_xLMP_Comprehensive_Audit.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, sort_keys=False)
    sha256 = hashlib.sha256(open(json_path, "rb").read()).hexdigest()

    md_path = os.path.join(out_dir, "Modern_RAG_vs_xLMP_Summary.md")
    lines = ["# Modern RAG vs xLMP -- Summary Table\n",
             f"Run: `{report['run_id']}` | All arms complete: **{report['all_arms_complete']}**\n",
             "| Arm | Label | n (ok/total) | Accuracy | Schema-Valid % | Retrieval (mean ms) | Inference (mean ms) | Total (mean ms) | Acc/Latency (%/s) |",
             "|---|---|---|---|---|---|---|---|---|"]
    for arm in ARMS:
        s = report["per_arm"][arm]
        if s.get("n_ok"):
            lines.append(
                f"| {arm} | {s['label']} | {s['n_ok']}/{s['n_total']} | {s['accuracy']:.1%} | "
                f"{s['schema_valid_pct']:.1f}% | {s['retrieval_latency']['mean_ms']:.0f} | "
                f"{s['inference_latency']['mean_ms']:.0f} | {s['total_latency']['mean_ms']:.0f} | "
                f"{s['accuracy_to_latency_ratio']:.2f} |"
            )
        else:
            lines.append(f"| {arm} | {s['label']} | 0/{s.get('n_total', 0)} | -- not yet run -- | | | | | |")
    lines.append("\n## Efficiency Frontier Ranking (Accuracy% / Total E2E Latency in seconds, highest first)\n")
    for rank, entry in enumerate(report["efficiency_frontier_ranking"], 1):
        lines.append(f"{rank}. **{entry['arm']}** ({entry['label']}) — {entry['accuracy_to_latency_ratio']:.2f}")
    lines.append("\n*Retrieval latency for X1/X2/O1 reflects context assembly (full-text or gold-context lookup), "
                  "not an embedding/rerank pipeline -- not directly comparable to R1-R4's retrieval cost in kind, "
                  "only in wall-clock terms.*")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return json_path, sha256, md_path


if __name__ == "__main__":
    report = build_report()
    json_path, sha256, md_path = write_outputs(report, RESULTS_DIR)
    print(f"JSON  -> {json_path}")
    print(f"SHA256 -> {sha256}")
    print(f"MD    -> {md_path}")
    print(f"all_arms_complete = {report['all_arms_complete']}")
