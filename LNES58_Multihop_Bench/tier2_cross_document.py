#!/usr/bin/env python3
"""
xLMP Multi-Hop Reasoning Benchmark -- Tier 2: cross-document synthesis.

Same production-safety posture as Tier 1: Auditor A10 (40.124.170.30) is LIVE
PRODUCTION infra, not an isolated test box. Concurrency 1, cooldown, circuit
breaker, generous max_tokens for a reasoning model.

Scoping note (be honest about what this does and doesn't test): this
presents all three "hollow objects" (A/B/C) as complete, correctly-labeled
context -- it does NOT exercise xLMP's actual multi-shard retrieval
mechanics (that would require live ingestion into the vault). This measures
the MODEL's cross-document synthesis ability given a perfect read layer, per
the original spec's own framing ("does accuracy hold when the model must
read across multiple hollow objects"). It is not yet a test of whether xLMP's
retrieval correctly SELECTS the right 3 objects out of many -- that's a
different, not-yet-built test.

Ground truth is deterministic for all three query types (interaction lookup,
percentile rank, set-intersection exclusion match) -- no human or LLM
annotation, no judgment call to disagree with.
"""
import json, time, random, re, os, sys, urllib.request, urllib.error

SEED = 4242
N_TRIOS = int(os.environ.get("N_TRIOS", "67"))  # ~200 queries at 3 query-types/trio

AUDITOR_URL = "http://40.124.170.30:3000"
VANGUARD_KEY = os.environ.get("VANGUARD_KEY", "sk-vanguard-apex-internal-v1")
MODEL = "vanguard-auditor"
MAX_TOKENS = 1024
TIMEOUT_S = 45.0
COOLDOWN_S = 1.5
ABORT_AFTER_CONSECUTIVE_FAILURES = 3

# ── Fixed drug interaction table (doc B -- shared across all trios, a real
# "drug interaction database subset") ─────────────────────────────────────────
INTERACTIONS = {
    frozenset(["warfarin", "aspirin"]): "increased bleeding risk",
    frozenset(["warfarin", "ibuprofen"]): "increased bleeding risk",
    frozenset(["lisinopril", "spironolactone"]): "hyperkalemia risk",
    frozenset(["metformin", "contrast-dye"]): "lactic acidosis risk",
    frozenset(["simvastatin", "clarithromycin"]): "myopathy risk",
}
TRIAL_DRUGS = ["warfarin", "lisinopril", "metformin", "simvastatin", "aspirin"]
PATIENT_MED_POOL = ["ibuprofen", "spironolactone", "contrast-dye", "clarithromycin",
    "levothyroxine", "atorvastatin", "amlodipine", "omeprazole"]
CONDITION_POOL = ["chronic kidney disease stage 3", "uncontrolled hypertension",
    "active liver disease", "recent myocardial infarction", "pregnancy",
    "type 2 diabetes", "osteoarthritis", "seasonal allergies", "hypothyroidism"]

DOC_B_TEXT = "[DOCUMENT B -- Drug Interaction Database Subset]\n" + "\n".join(
    f"- {sorted(pair)[0]} + {sorted(pair)[1]}: {effect}" for pair, effect in INTERACTIONS.items()
)

def make_trio(pid, seed):
    r = random.Random(seed)
    trial_drug = r.choice(TRIAL_DRUGS)
    n_meds = r.randint(2, 4)
    current_meds = r.sample(PATIENT_MED_POOL, n_meds)
    # Plant a real interaction ~45% of the time by swapping in a known partner drug.
    interacting_partner = None
    for pair in INTERACTIONS:
        if trial_drug in pair:
            interacting_partner = next(iter(pair - {trial_drug}))
            break
    if interacting_partner and interacting_partner not in current_meds and r.random() < 0.45:
        current_meds[0] = interacting_partner
    has_interaction = any(frozenset([trial_drug, m]) in INTERACTIONS for m in current_meds)
    conflicting_meds = [m for m in current_meds if frozenset([trial_drug, m]) in INTERACTIONS]

    lab_value = r.randint(30, 120)  # synthetic eGFR-like lab value
    population_ref = sorted(r.sample(range(30, 121), 19))  # trial's reference population
    rank = sum(1 for v in population_ref if v <= lab_value)
    percentile = round(100 * rank / len(population_ref))

    n_conditions = r.randint(1, 3)
    conditions = r.sample(CONDITION_POOL, n_conditions)
    n_exclusions = r.randint(2, 4)
    exclusion_criteria = r.sample(CONDITION_POOL, n_exclusions)
    matched_exclusions = sorted(set(conditions) & set(exclusion_criteria))

    facts = {
        "pid": pid, "trial_drug": trial_drug, "current_meds": current_meds,
        "has_interaction": has_interaction, "conflicting_meds": conflicting_meds,
        "lab_value": lab_value, "percentile": percentile,
        "conditions": conditions, "exclusion_criteria": exclusion_criteria,
        "matched_exclusions": matched_exclusions,
    }

    doc_a = (f"[DOCUMENT A -- Patient Record {pid}]\n"
             f"Current medications: {', '.join(current_meds)}\n"
             f"Documented conditions: {', '.join(conditions)}\n"
             f"Most recent lab value (eGFR-equivalent): {lab_value} mL/min/1.73m^2\n")
    doc_c = (f"[DOCUMENT C -- Clinical Trial Protocol, trial drug: {trial_drug}]\n"
             f"Trial drug under evaluation: {trial_drug}\n"
             f"Exclusion criteria: {', '.join(exclusion_criteria)}\n"
             f"Trial population reference lab values (eGFR-equivalent, n=19): {population_ref}\n")
    return facts, doc_a, doc_c

def build_queries(facts):
    pid = facts["pid"]
    return [
        {
            "query_id": f"{pid}-interaction", "type": "interaction_check",
            "question": ("Given the patient's current medications (Document A) and the trial drug "
                        "(Document C), do any known interactions (Document B) apply? Respond as JSON: "
                        "{\"interacts\": true|false, \"conflicting_drug\": string|null, "
                        "\"sources_used\": [\"A\",\"B\",\"C\"]}"),
            "ground_truth": {"interacts": facts["has_interaction"]},
            "score_field": "interacts",
            "expected_sources": {"A", "B", "C"},
        },
        {
            "query_id": f"{pid}-percentile", "type": "risk_percentile",
            "question": ("What is the patient's approximate percentile rank (0-100) for their lab value "
                        "(Document A) relative to the trial population reference values (Document C)? "
                        "Respond as JSON: {\"percentile\": integer, \"sources_used\": [\"A\",\"C\"]}"),
            "ground_truth": {"percentile": facts["percentile"]},
            "score_field": "percentile",
            "expected_sources": {"A", "C"},
            "tolerance": 5,  # percentile is a rank estimate -- allow +/-5 points
        },
        {
            "query_id": f"{pid}-exclusion", "type": "exclusion_match",
            "question": ("Which of the patient's documented conditions (Document A), if any, appear in "
                        "the trial's exclusion criteria (Document C)? Respond as JSON: "
                        "{\"matched_conditions\": [string, ...], \"sources_used\": [\"A\",\"C\"]}"),
            "ground_truth": {"matched_conditions": facts["matched_exclusions"]},
            "score_field": "matched_conditions",
            "expected_sources": {"A", "C"},
        },
    ]

SYSTEM = ("You are a precise clinical trial-matching reasoning engine. Answer strictly from the THREE "
          "PROVIDED DOCUMENTS (A, B, C). Show your reasoning, citing which document(s) you used, then "
          "output a final line starting with 'ANSWER:' followed by ONLY the requested JSON object.")

def log_trigger(reason, extra=None):
    print(json.dumps({"PRODUCTION_SENSITIVITY_TRIGGERED": True,
        "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "reason": reason, **(extra or {})}), flush=True)

def call_auditor(context, question):
    user = f"{context}\nQUESTION: {question}"
    body = json.dumps({
        "model": MODEL, "stream": True, "temperature": 0, "max_tokens": MAX_TOKENS,
        "stream_options": {"include_usage": True},
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request(f"{AUDITOR_URL}/v1/chat/completions", data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {VANGUARD_KEY}"})
    t0 = time.time(); ttft = None; content = ""; reasoning = ""; finish_reason = None; usage = None
    try:
        resp = urllib.request.urlopen(req, timeout=TIMEOUT_S)
        status = resp.status
        for raw in resp:
            line = raw.decode("utf-8", "ignore").strip()
            if not line.startswith("data:"): continue
            data = line[5:].strip()
            if data == "[DONE]": break
            try: obj = json.loads(data)
            except Exception: continue
            if obj.get("usage"): usage = obj["usage"]
            for ch in obj.get("choices", []):
                if ch.get("finish_reason"): finish_reason = ch["finish_reason"]
                delta = ch.get("delta", {})
                rtext = delta.get("reasoning") or delta.get("reasoning_content")
                if rtext:
                    if ttft is None: ttft = time.time() - t0
                    reasoning += rtext
                if delta.get("content"):
                    if ttft is None: ttft = time.time() - t0
                    content += delta["content"]
        e2e = time.time() - t0
        return {"ok": True, "status": status, "content": content.strip(), "reasoning": reasoning.strip(),
                "finish_reason": finish_reason, "usage": usage, "e2e_ms": e2e * 1000,
                "ttft_ms": (ttft * 1000) if ttft is not None else None}
    except urllib.error.HTTPError as e:
        return {"ok": False, "status": e.code, "error": e.read().decode("utf-8", "replace")[:300],
                "e2e_ms": (time.time() - t0) * 1000}
    except Exception as e:
        return {"ok": False, "status": 0, "error": str(e), "e2e_ms": (time.time() - t0) * 1000}

def extract_answer_json(content):
    m = re.search(r"ANSWER:\s*(\{.*\})", content, re.DOTALL)
    candidate = m.group(1) if m else None
    if not candidate:
        blocks = re.findall(r"\{[^{}]*\}", content, re.DOTALL)
        candidate = blocks[-1] if blocks else None
    if not candidate:
        return None, False
    try:
        return json.loads(candidate), True
    except Exception:
        return None, False

def score(parsed, schema_valid, gt, score_field, tolerance=None):
    if not schema_valid or parsed is None or score_field not in parsed:
        return False
    val = parsed[score_field]
    exp = gt[score_field]
    if isinstance(exp, list):
        try:
            return set(str(x).lower() for x in val) == set(str(x).lower() for x in exp)
        except TypeError:
            return False
    if tolerance is not None and isinstance(val, (int, float)):
        return abs(val - exp) <= tolerance
    return val == exp

def sources_cited(parsed, expected_sources):
    if not parsed or "sources_used" not in parsed:
        return False
    try:
        cited = set(str(s).upper() for s in parsed["sources_used"])
    except TypeError:
        return False
    return expected_sources.issubset(cited)

def check_fabricated_interaction(parsed, facts):
    """Hallucination proxy for the interaction_check query type: did the
    model claim a specific conflicting drug that ISN'T actually in the
    interaction table for this trial drug? A concrete, checkable signal,
    not a general hallucination detector."""
    if not parsed or not parsed.get("interacts"):
        return False
    claimed = parsed.get("conflicting_drug")
    if not claimed:
        return False
    claimed = str(claimed).lower().strip()
    real_conflicts = [m.lower() for m in facts["conflicting_meds"]]
    return claimed not in real_conflicts and claimed != "null" and claimed != "none"

def run():
    print(f"=== xLMP Multi-Hop Bench -- Tier 2 (cross-document synthesis) ===")
    print(f"Target: Auditor A10 ({AUDITOR_URL}) -- LIVE PRODUCTION infra, scoped pilot")
    print(f"N_TRIOS={N_TRIOS}  max_tokens={MAX_TOKENS}  concurrency=1  cooldown={COOLDOWN_S}s")
    print("NOTE: presents all 3 documents as complete context -- tests model synthesis, "
          "not xLMP's live multi-shard retrieval selection (see docstring).")

    rows = []
    consecutive_failures = 0
    query_i = 0
    fabricated_interaction_count = 0
    aborted = False

    for p in range(N_TRIOS):
        facts, doc_a, doc_c = make_trio(f"TR{100+p}", SEED + p)
        context = f"{doc_a}\n{DOC_B_TEXT}\n\n{doc_c}"
        queries = build_queries(facts)
        for q in queries:
            query_i += 1
            r = call_auditor(context, q["question"])
            if not r["ok"]:
                consecutive_failures += 1
                log_trigger("request_failure_or_5xx", {"status": r.get("status"), "error": r.get("error")})
                print(f"  [{query_i}] FAIL status={r.get('status')} err={r.get('error')}")
                if consecutive_failures >= ABORT_AFTER_CONSECUTIVE_FAILURES:
                    print(f"[ABORT] {ABORT_AFTER_CONSECUTIVE_FAILURES} consecutive failures -- "
                          f"stopping to protect production.", file=sys.stderr)
                    aborted = True
                    break
                time.sleep(COOLDOWN_S)
                continue
            consecutive_failures = 0
            parsed, schema_valid = extract_answer_json(r["content"])
            correct = score(parsed, schema_valid, q["ground_truth"], q["score_field"], q.get("tolerance"))
            cited = sources_cited(parsed, q["expected_sources"])
            fabricated = False
            if q["type"] == "interaction_check":
                fabricated = check_fabricated_interaction(parsed, facts)
                if fabricated: fabricated_interaction_count += 1
            row = {
                "query_id": q["query_id"], "type": q["type"], "trio_id": facts["pid"],
                "question": q["question"], "ground_truth": q["ground_truth"],
                "raw_response": r["content"], "reasoning": r["reasoning"],
                "parsed_answer": parsed, "schema_valid": schema_valid, "correct": correct,
                "sources_cited_correctly": cited, "fabricated_interaction": fabricated,
                "finish_reason": r["finish_reason"], "ttft_ms": r["ttft_ms"], "e2e_ms": round(r["e2e_ms"], 1),
                "completion_tokens": (r["usage"] or {}).get("completion_tokens"),
            }
            rows.append(row)
            print(f"  [{query_i}/{N_TRIOS*3}] {q['type']:20} correct={correct} cited={cited} "
                  f"schema_valid={schema_valid} e2e_ms={row['e2e_ms']:.0f}")
            time.sleep(COOLDOWN_S)
        if aborted:
            break

    n = len(rows)
    by_type = {}
    for t in ("interaction_check", "risk_percentile", "exclusion_match"):
        trows = [r for r in rows if r["type"] == t]
        by_type[t] = {
            "n": len(trows),
            "accuracy": round(sum(1 for r in trows if r["correct"]) / len(trows), 4) if trows else None,
            "schema_valid_pct": round(100 * sum(1 for r in trows if r["schema_valid"]) / len(trows), 1) if trows else None,
            "source_citation_pct": round(100 * sum(1 for r in trows if r["sources_cited_correctly"]) / len(trows), 1) if trows else None,
        }
    overall_accuracy = round(sum(1 for r in rows if r["correct"]) / n, 4) if n else None
    overall_schema_valid_pct = round(100 * sum(1 for r in rows if r["schema_valid"]) / n, 1) if n else None
    overall_citation_pct = round(100 * sum(1 for r in rows if r["sources_cited_correctly"]) / n, 1) if n else None
    n_interaction_rows = sum(1 for r in rows if r["type"] == "interaction_check")
    hallucination_rate_pct = round(100 * fabricated_interaction_count / n_interaction_rows, 2) if n_interaction_rows else None

    summary = {
        "tier": 2, "n_queries": n, "aborted": aborted,
        "overall_accuracy": overall_accuracy, "overall_schema_valid_pct": overall_schema_valid_pct,
        "overall_source_citation_pct": overall_citation_pct,
        "fabricated_interaction_rate_pct": hallucination_rate_pct,
        "by_type": by_type,
        "pass_criteria": {"extraction_accuracy_pct": 90, "schema_valid_pct": 100,
                          "must_cite_source_objects": True, "max_hallucination_rate_pct": 2},
        "pass": bool(overall_accuracy is not None and overall_accuracy >= 0.90
                     and overall_schema_valid_pct == 100.0
                     and (hallucination_rate_pct is None or hallucination_rate_pct <= 2.0)
                     and not aborted),
    }
    print("\n=== TIER 2 SUMMARY ===")
    print(json.dumps(summary, indent=2))

    with open("/tmp/lnes58_tier2_result.json", "w") as f:
        json.dump({"summary": summary, "rows": rows}, f, indent=2)
    print("\nwritten -> /tmp/lnes58_tier2_result.json")
    return summary

if __name__ == "__main__":
    run()
