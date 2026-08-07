#!/usr/bin/env python3
"""
xLMP Multi-Hop Reasoning Benchmark -- Tier 3: adversarial reasoning
(temporal ordering, absence detection, extrapolation, negation over a
temporal window).

Same production-safety posture as Tiers 1/2: Auditor A10 is LIVE PRODUCTION
infra. Concurrency 1, cooldown, circuit breaker, generous max_tokens.

Same scoping honesty as Tier 2: presents complete, correctly-labeled context
(all 3 documents) -- tests the MODEL's reasoning over that context, not
xLMP's live multi-shard retrieval selection.

Document B (drug interaction table, reused unchanged from Tier 2) is
deliberately present but IRRELEVANT to every Tier 3 query -- this tests
whether the model can ignore a distractor shard rather than getting
confused by its presence, a real sub-question for hollow-object composition
that Tier 1/2 didn't probe (those tiers' extra documents were always
relevant).

Ground truth is deterministic for all four query types -- computed directly
from generated dates/values, no human or LLM judgment call.
"""
import json, time, random, re, os, sys, urllib.request, urllib.error
from datetime import date, timedelta

SEED = 8181
N_PATIENTS = int(os.environ.get("N_PATIENTS", "50"))  # 4 query-types/patient = 200 queries

AUDITOR_URL = "http://40.124.170.30:3000"
VANGUARD_KEY = os.environ.get("VANGUARD_KEY", "sk-vanguard-apex-internal-v1")
MODEL = "vanguard-auditor"
MAX_TOKENS = 3072  # v1 pilot found extrapolation queries hitting finish_reason=length at 1536:
                    # the model computed the right answer in its hidden reasoning field, then
                    # started re-deriving a full verbose explanation in the VISIBLE content
                    # channel and got cut off before ever reaching the required ANSWER: line.
TIMEOUT_S = 45.0
COOLDOWN_S = 1.5
ABORT_AFTER_CONSECUTIVE_FAILURES = 3

# Reused, deliberately-irrelevant distractor document (unchanged from Tier 2).
INTERACTIONS = {
    frozenset(["warfarin", "aspirin"]): "increased bleeding risk",
    frozenset(["warfarin", "ibuprofen"]): "increased bleeding risk",
    frozenset(["lisinopril", "spironolactone"]): "hyperkalemia risk",
    frozenset(["metformin", "contrast-dye"]): "lactic acidosis risk",
    frozenset(["simvastatin", "clarithromycin"]): "myopathy risk",
}
DOC_B_TEXT = "[DOCUMENT B -- Drug Interaction Database Subset (unrelated to this question)]\n" + "\n".join(
    f"- {sorted(pair)[0]} + {sorted(pair)[1]}: {effect}" for pair, effect in INTERACTIONS.items()
)

MED_POOL = ["lisinopril", "metoprolol", "atorvastatin", "clopidogrel", "furosemide",
    "spironolactone", "amlodipine", "warfarin"]
DIAGNOSIS_LAB_MAP = {
    "Type 2 Diabetes Mellitus": ["HbA1c", "fasting glucose", "lipid panel", "urine microalbumin"],
    # v2 fix: "eGFR" deliberately excluded here -- every patient (regardless of
    # diagnosis) separately shows two eGFR READINGS for the extrapolation query.
    # A pilot run found the model reasonably-but-incorrectly inferred "eGFR is
    # present" in the lab panel just because eGFR VALUES appear elsewhere in
    # the same document -- a genuine confound in the test data, not a clean
    # measurement of absence-reasoning. Using non-overlapping lab names avoids it.
    "Chronic Kidney Disease": ["urinalysis", "serum creatinine", "urine protein", "serum potassium"],
    "Congestive Heart Failure": ["BNP", "serum sodium", "serum potassium", "chest X-ray"],
}

CKD_STAGE4_THRESHOLD = 30  # eGFR < 30 = Stage 4

def make_patient(pid, seed):
    r = random.Random(seed)
    cardiac_event = date(2026, 1, 1) + timedelta(days=r.randint(0, 200))

    # -- Query 1: temporal medication reasoning --
    n_meds = r.randint(3, 5)
    meds = r.sample(MED_POOL, n_meds)
    med_timeline = []
    for m in meds:
        prescribed_offset = r.randint(-120, 120)
        prescribed = cardiac_event + timedelta(days=prescribed_offset)
        # 55% chance the med was later discontinued
        discontinued = None
        if r.random() < 0.55:
            disc_offset = r.randint(1, 150)
            discontinued = prescribed + timedelta(days=disc_offset)
        med_timeline.append({"drug": m, "prescribed": prescribed, "discontinued": discontinued})
    before_and_after = sorted(
        m["drug"] for m in med_timeline
        if m["prescribed"] < cardiac_event and m["discontinued"] and m["discontinued"] > cardiac_event
    )

    # -- Query 2: absence detection --
    diagnosis = r.choice(list(DIAGNOSIS_LAB_MAP.keys()))
    expected_labs = DIAGNOSIS_LAB_MAP[diagnosis]
    n_present = r.randint(1, len(expected_labs) - 1)
    present_labs = r.sample(expected_labs, n_present)
    missing_labs = sorted(set(expected_labs) - set(present_labs))

    # -- Query 3: extrapolation --
    egfr1 = r.randint(45, 65)
    egfr2 = egfr1 - r.randint(5, 15)  # always declining
    days_between = r.randint(30, 120)
    date1 = cardiac_event + timedelta(days=r.randint(-60, -10))
    date2 = date1 + timedelta(days=days_between)
    rate_per_day = (egfr1 - egfr2) / days_between
    days_to_stage4 = round((egfr2 - CKD_STAGE4_THRESHOLD) / rate_per_day)

    # -- Query 4: temporal window + negation (BP stability) --
    n_weeks = 8
    bp_readings = []
    # Randomly place ONE genuine 4-consecutive-week stable stretch ~50% of the time.
    has_stable_window = r.random() < 0.5
    stable_start = r.randint(0, n_weeks - 4) if has_stable_window else None
    for w in range(n_weeks):
        if has_stable_window and stable_start <= w < stable_start + 4:
            sys_bp = r.randint(112, 138); dia_bp = r.randint(72, 88)
        else:
            # unstable: occasionally spike out of range
            sys_bp = r.choice([r.randint(95, 111), r.randint(141, 165), r.randint(112, 138)])
            dia_bp = r.choice([r.randint(55, 69), r.randint(91, 105), r.randint(72, 88)])
        bp_readings.append({"week": w + 1, "systolic": sys_bp, "diastolic": dia_bp})

    def is_stable(reading):
        return 110 <= reading["systolic"] <= 140 and 70 <= reading["diastolic"] <= 90

    stable_flags = [is_stable(b) for b in bp_readings]
    actual_has_4wk_stable = any(all(stable_flags[i:i+4]) for i in range(n_weeks - 3))

    facts = {
        "pid": pid, "cardiac_event": cardiac_event.isoformat(),
        "med_timeline": [{"drug": m["drug"], "prescribed": m["prescribed"].isoformat(),
                          "discontinued": m["discontinued"].isoformat() if m["discontinued"] else None}
                         for m in med_timeline],
        "before_and_after_meds": before_and_after,
        "diagnosis": diagnosis, "present_labs": present_labs, "missing_labs": missing_labs,
        "egfr1": egfr1, "egfr2": egfr2, "date1": date1.isoformat(), "date2": date2.isoformat(),
        "days_to_stage4": days_to_stage4,
        "bp_readings": bp_readings, "has_4wk_stable_window": actual_has_4wk_stable,
    }

    med_lines = "\n".join(
        f"  - {m['drug']}: prescribed {m['prescribed'].isoformat()}"
        + (f", discontinued {m['discontinued'].isoformat()}" if m["discontinued"] else ", still active")
        for m in med_timeline
    )
    bp_lines = "\n".join(f"  - Week {b['week']}: {b['systolic']}/{b['diastolic']} mmHg" for b in bp_readings)

    doc_a = (
        f"[DOCUMENT A -- Patient Record {pid}]\n"
        f"Cardiac event date: {cardiac_event.isoformat()}\n"
        f"Medication timeline:\n{med_lines}\n"
        f"Diagnosis: {diagnosis}\n"
        f"Complete list of lab results on file (no others recorded): {', '.join(present_labs)}\n"
        f"eGFR reading 1: {egfr1} mL/min/1.73m^2 on {date1.isoformat()}\n"
        f"eGFR reading 2: {egfr2} mL/min/1.73m^2 on {date2.isoformat()}\n"
        f"Blood pressure readings (weekly):\n{bp_lines}\n"
    )
    doc_c = (
        f"[DOCUMENT C -- Clinical Trial Protocol]\n"
        f"Eligibility requirement: patient must show STABLE blood pressure "
        f"(systolic 110-140 mmHg AND diastolic 70-90 mmHg) for 4 CONSECUTIVE weeks "
        f"at any point in the recorded history.\n"
        f"Standard expected lab panel for {diagnosis}: {', '.join(expected_labs)}\n"
    )
    return facts, doc_a, doc_c

def build_queries(facts):
    pid = facts["pid"]
    return [
        {
            "query_id": f"{pid}-temporal_meds", "type": "temporal_ordering",
            "question": ("Which medications (Document A) were prescribed BEFORE the cardiac event "
                        "date but discontinued AFTER it? Respond as JSON: "
                        "{\"medications\": [string, ...]}"),
            "ground_truth": {"medications": facts["before_and_after_meds"]},
            "score_field": "medications", "category": "temporal",
        },
        {
            "query_id": f"{pid}-absence", "type": "absence_detection",
            "question": ("Given the patient's diagnosis (Document A) and the standard expected lab "
                        "panel for that diagnosis (Document C), which expected labs are NOT present "
                        "in the patient's record? Respond as JSON: {\"missing_labs\": [string, ...]}"),
            "ground_truth": {"missing_labs": facts["missing_labs"]},
            "score_field": "missing_labs", "category": "negation",
        },
        {
            "query_id": f"{pid}-extrapolation", "type": "extrapolation",
            "question": ("Given the two eGFR readings and their dates (Document A), if the decline "
                        "continues at the same linear rate, how many days after the SECOND reading "
                        "would the patient reach Stage 4 CKD (eGFR < 30)? Respond as JSON: "
                        "{\"days_from_second_reading\": integer}"),
            "ground_truth": {"days_from_second_reading": facts["days_to_stage4"]},
            "score_field": "days_from_second_reading", "category": "extrapolation",
            "tolerance": max(3, round(facts["days_to_stage4"] * 0.1)),  # 10% tolerance, min 3 days
        },
        {
            "query_id": f"{pid}-bp_window", "type": "temporal_negation",
            "question": ("Document C requires stable blood pressure (systolic 110-140, diastolic "
                        "70-90) for 4 CONSECUTIVE weeks. Does the patient's blood pressure history "
                        "(Document A) show any 4-consecutive-week stretch meeting this requirement? "
                        "Respond as JSON: {\"meets_requirement\": true|false}"),
            "ground_truth": {"meets_requirement": facts["has_4wk_stable_window"]},
            "score_field": "meets_requirement", "category": "negation",
        },
    ]

SYSTEM = ("You are a precise clinical trial-eligibility reasoning engine. Answer strictly from the "
          "THREE PROVIDED DOCUMENTS (A, B, C) -- Document B may be irrelevant to this specific "
          "question; ignore it if so. Show your reasoning step by step, then output a final line "
          "starting with 'ANSWER:' followed by ONLY the requested JSON object.")

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

def run():
    print(f"=== xLMP Multi-Hop Bench -- Tier 3 (adversarial reasoning) ===")
    print(f"Target: Auditor A10 ({AUDITOR_URL}) -- LIVE PRODUCTION infra, scoped pilot")
    print(f"N_PATIENTS={N_PATIENTS}  max_tokens={MAX_TOKENS}  concurrency=1  cooldown={COOLDOWN_S}s")
    print("NOTE: Document B is a deliberate, irrelevant distractor for every Tier 3 query.")

    rows = []
    consecutive_failures = 0
    query_i = 0
    aborted = False

    for p in range(N_PATIENTS):
        facts, doc_a, doc_c = make_patient(f"AD{100+p}", SEED + p)
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
            row = {
                "query_id": q["query_id"], "type": q["type"], "category": q["category"],
                "patient_id": facts["pid"], "question": q["question"], "ground_truth": q["ground_truth"],
                "raw_response": r["content"], "reasoning": r["reasoning"],
                "parsed_answer": parsed, "schema_valid": schema_valid, "correct": correct,
                "finish_reason": r["finish_reason"], "ttft_ms": r["ttft_ms"], "e2e_ms": round(r["e2e_ms"], 1),
                "completion_tokens": (r["usage"] or {}).get("completion_tokens"),
            }
            rows.append(row)
            print(f"  [{query_i}/{N_PATIENTS*4}] {q['type']:20} correct={correct} schema_valid={schema_valid} "
                  f"e2e_ms={row['e2e_ms']:.0f}")
            time.sleep(COOLDOWN_S)
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
        }
    temporal_rows = [r for r in rows if r["category"] in ("temporal", "extrapolation")]
    negation_rows = [r for r in rows if r["category"] == "negation"]
    overall_accuracy = round(sum(1 for r in rows if r["correct"]) / n, 4) if n else None
    overall_schema_valid_pct = round(100 * sum(1 for r in rows if r["schema_valid"]) / n, 1) if n else None
    temporal_accuracy_pct = round(100 * sum(1 for r in temporal_rows if r["correct"]) / len(temporal_rows), 1) if temporal_rows else None
    negation_accuracy_pct = round(100 * sum(1 for r in negation_rows if r["correct"]) / len(negation_rows), 1) if negation_rows else None

    summary = {
        "tier": 3, "n_queries": n, "aborted": aborted,
        "overall_accuracy": overall_accuracy, "overall_schema_valid_pct": overall_schema_valid_pct,
        "temporal_reasoning_accuracy_pct": temporal_accuracy_pct,
        "negation_accuracy_pct": negation_accuracy_pct,
        "by_type": by_type,
        "pass_criteria": {"extraction_accuracy_pct": 85, "schema_valid_pct": 100,
                          "temporal_reasoning_accuracy_pct": 80, "negation_accuracy_pct": 80},
        "pass": bool(overall_accuracy is not None and overall_accuracy >= 0.85
                     and overall_schema_valid_pct == 100.0
                     and (temporal_accuracy_pct or 0) >= 80.0
                     and (negation_accuracy_pct or 0) >= 80.0
                     and not aborted),
    }
    print("\n=== TIER 3 SUMMARY ===")
    print(json.dumps(summary, indent=2))

    with open("/tmp/lnes58_tier3_result.json", "w") as f:
        json.dump({"summary": summary, "rows": rows}, f, indent=2)
    print("\nwritten -> /tmp/lnes58_tier3_result.json")
    return summary

if __name__ == "__main__":
    run()
