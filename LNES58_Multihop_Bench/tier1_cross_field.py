#!/usr/bin/env python3
"""
xLMP Multi-Hop Reasoning Benchmark — Tier 1: cross-field inference.

Runs against the Auditor A10 (40.124.170.30) — LIVE PRODUCTION infra serving
real vanguard-race voice traffic, not an isolated test box. Scoped down from
the original spec's 200-queries/QPS-ladder-to-15 design (which was sized for
an H200's ~20-34 req/s ceiling) to match what this specific A10 has
previously been measured to actually handle: ~0.5-1 req/s, saturated at just
3 concurrent requests. Concurrency 1, generous per-request timeout (Nemotron
is a reasoning model -- see the LNES-56A v3 lesson on reasoning-budget
starvation), 1.5s inter-request cooldown, hard circuit breaker.

Ground truth is DETERMINISTIC, not human- or LLM-annotated: every Tier 1
question (BMI classification, elapsed days, dosage-appropriateness,
contraindication) is mechanically computable from the generated facts. This
is more rigorous than either alternative -- there is no judgment call to get
wrong or disagree with.
"""
import json, time, random, re, os, sys, hashlib, urllib.request, urllib.error
from datetime import date, timedelta

SEED = 42
N_PATIENTS = int(os.environ.get("N_PATIENTS", "50"))  # scoped pilot, not the spec's 200 -- see README

AUDITOR_URL = "http://40.124.170.30:3000"
VANGUARD_KEY = os.environ.get("VANGUARD_KEY", "sk-vanguard-apex-internal-v1")
MODEL = "vanguard-auditor"
MAX_TOKENS = 1024   # LNES-56A v3 lesson: a reasoning model under-budgeted on
                    # max_tokens burns it all on hidden reasoning and never emits content
TIMEOUT_S = 45.0
COOLDOWN_S = 1.5
ABORT_AFTER_CONSECUTIVE_FAILURES = 3

# ── Synthetic fact generation (deterministic, seeded) ─────────────────────────
FIRST_NAMES = ["Elena","Marcus","Priya","Jamal","Ingrid","Rafael","Yuki","Noor",
    "Declan","Amara","Sven","Layla","Tomas","Zara","Kwame"]
LAST_NAMES = ["Voss","Achebe","Lindgren","Okafor","Renard","Kowalczyk","Hasegawa",
    "Delgado","Osei","Ferrante","Nakashima","Duval","Adeyemi","Brennan","Solheim"]

# Fixed drug -> allergy-class contraindication table (synthetic, not real
# clinical data -- this is a controlled test fixture with a KNOWN correct
# lookup, not medical advice).
DRUG_ALLERGY_MAP = {
    "amoxicillin": "penicillin", "ampicillin": "penicillin", "penicillin-v": "penicillin",
    "sulfamethoxazole": "sulfa", "trimethoprim-sulfa": "sulfa",
    "cefazolin": "cephalosporin", "cephalexin": "cephalosporin",
}
ALL_DRUGS = list(DRUG_ALLERGY_MAP.keys()) + ["metformin", "lisinopril", "atorvastatin", "levothyroxine"]
ALL_ALLERGIES = ["penicillin", "sulfa", "cephalosporin", "latex", "none"]

# Fixed dosage-appropriateness rule for a synthetic drug "Cefaxolin-X" (not a
# real drug -- a controlled fixture with a known-correct range per class).
def weight_class(kg):
    if kg < 60: return "light"
    if kg <= 90: return "medium"
    return "heavy"

DOSAGE_RANGE_MG = {"light": (50, 100), "medium": (100, 200), "heavy": (200, 300)}

def make_patient(pid, seed):
    r = random.Random(seed)
    name = f"{r.choice(FIRST_NAMES)} {r.choice(LAST_NAMES)}"
    height_cm = r.randint(150, 195)
    weight_kg = r.randint(45, 130)
    bmi = round(weight_kg / ((height_cm / 100) ** 2), 1)
    is_obese = bmi >= 30.0

    admission = date(2026, 1, 1) + timedelta(days=r.randint(0, 300))
    lab_offset = r.randint(1, 14)
    last_lab = admission + timedelta(days=lab_offset)

    wclass = weight_class(weight_kg)
    lo, hi = DOSAGE_RANGE_MG[wclass]
    # 60% of the time the prescribed dose is correctly in-range; 40% it's a
    # planted error, so "appropriate" isn't always the same answer.
    if r.random() < 0.6:
        prescribed_mg = r.randint(lo, hi)
    else:
        prescribed_mg = r.choice([r.randint(1, lo - 1) if lo > 1 else lo - 5,
                                   r.randint(hi + 1, hi + 150)])
    dosage_appropriate = lo <= prescribed_mg <= hi

    allergy = r.choice(ALL_ALLERGIES)
    n_meds = r.randint(2, 4)
    meds = r.sample(ALL_DRUGS, n_meds)
    contraindicated_meds = [m for m in meds if DRUG_ALLERGY_MAP.get(m) == allergy]
    has_contraindication = len(contraindicated_meds) > 0

    facts = {
        "pid": pid, "name": name, "height_cm": height_cm, "weight_kg": weight_kg,
        "bmi": bmi, "is_obese": is_obese,
        "admission_date": admission.isoformat(), "last_lab_date": last_lab.isoformat(),
        "days_admission_to_lab": lab_offset,
        "weight_class": wclass, "prescribed_dosage_mg": prescribed_mg,
        "dosage_appropriate": dosage_appropriate,
        "allergy": allergy, "current_medications": meds,
        "has_contraindication": has_contraindication,
        "contraindicated_meds": contraindicated_meds,
    }
    record_text = (
        f"[PATIENT RECORD {pid}]\n"
        f"Name: {name}\n"
        f"Height: {height_cm} cm\n"
        f"Weight: {weight_kg} kg\n"
        f"Admission date: {admission.isoformat()}\n"
        f"Last lab result date: {last_lab.isoformat()}\n"
        f"Prescribed medication: Cefaxolin-X, dosage {prescribed_mg} mg\n"
        f"Documented allergy: {allergy if allergy != 'none' else 'none documented'}\n"
        f"Current medications: {', '.join(meds)}\n"
    )
    return facts, record_text

# ── Query templates (one per example in the spec) ─────────────────────────────
def build_queries(facts):
    pid = facts["pid"]
    return [
        {
            "query_id": f"{pid}-bmi", "type": "bmi_obesity",
            "question": "Is this patient's BMI in the obese range (BMI >= 30)? "
                        "Respond as JSON: {\"obese\": true|false, \"bmi_estimate\": number}",
            "ground_truth": {"obese": facts["is_obese"]},
            "score_field": "obese",
        },
        {
            "query_id": f"{pid}-days", "type": "days_elapsed",
            "question": "How many days elapsed between the admission date and the last lab result date? "
                        "Respond as JSON: {\"days\": integer}",
            "ground_truth": {"days": facts["days_admission_to_lab"]},
            "score_field": "days",
        },
        {
            "query_id": f"{pid}-dosage", "type": "dosage_appropriateness",
            "question": "Is the prescribed Cefaxolin-X dosage appropriate for this patient's weight class? "
                        "(light <60kg: 50-100mg, medium 60-90kg: 100-200mg, heavy >90kg: 200-300mg) "
                        "Respond as JSON: {\"appropriate\": true|false, \"weight_class\": string}",
            "ground_truth": {"appropriate": facts["dosage_appropriate"]},
            "score_field": "appropriate",
        },
        {
            "query_id": f"{pid}-contraindication", "type": "contraindication",
            "question": "Are any of the patient's current medications contraindicated given their "
                        "documented allergy? (penicillin-class: amoxicillin/ampicillin/penicillin-v; "
                        "sulfa-class: sulfamethoxazole/trimethoprim-sulfa; cephalosporin-class: "
                        "cefazolin/cephalexin) Respond as JSON: {\"contraindicated\": true|false, \"conflicting_drug\": string|null}",
            "ground_truth": {"contraindicated": facts["has_contraindication"]},
            "score_field": "contraindicated",
        },
    ]

SYSTEM = ("You are a precise clinical reasoning engine. Answer strictly from the PROVIDED "
          "PATIENT RECORD. Show your reasoning, then output a final line starting with "
          "'ANSWER:' followed by ONLY the requested JSON object, nothing else after it.")

def log_trigger(reason, extra=None):
    print(json.dumps({"PRODUCTION_SENSITIVITY_TRIGGERED": True,
        "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "reason": reason, **(extra or {})}), flush=True)

def call_auditor(record_text, question):
    user = f"PATIENT RECORD:\n{record_text}\nQUESTION: {question}"
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
        # fallback: last {...} block in the content
        blocks = re.findall(r"\{[^{}]*\}", content)
        candidate = blocks[-1] if blocks else None
    if not candidate:
        return None, False
    try:
        return json.loads(candidate), True
    except Exception:
        return None, False

def score(parsed, schema_valid, gt, score_field):
    if not schema_valid or parsed is None or score_field not in parsed:
        return False
    return parsed[score_field] == gt[score_field]

def run():
    print(f"=== xLMP Multi-Hop Bench -- Tier 1 (cross-field inference) ===")
    print(f"Target: Auditor A10 ({AUDITOR_URL}) -- LIVE PRODUCTION infra, scoped pilot")
    print(f"N_PATIENTS={N_PATIENTS}  max_tokens={MAX_TOKENS}  concurrency=1  cooldown={COOLDOWN_S}s")

    rows = []
    consecutive_failures = 0
    query_i = 0
    aborted = False

    for p in range(N_PATIENTS):
        facts, record_text = make_patient(f"MH{100+p}", SEED + p)
        queries = build_queries(facts)
        for q in queries:
            query_i += 1
            r = call_auditor(record_text, q["question"])
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
            correct = score(parsed, schema_valid, q["ground_truth"], q["score_field"])
            row = {
                "query_id": q["query_id"], "type": q["type"], "patient_id": facts["pid"],
                "question": q["question"], "ground_truth": q["ground_truth"],
                "raw_response": r["content"], "reasoning": r["reasoning"],
                "parsed_answer": parsed, "schema_valid": schema_valid, "correct": correct,
                "finish_reason": r["finish_reason"], "ttft_ms": r["ttft_ms"], "e2e_ms": round(r["e2e_ms"], 1),
                "completion_tokens": (r["usage"] or {}).get("completion_tokens"),
            }
            rows.append(row)
            print(f"  [{query_i}/{N_PATIENTS*4}] {q['type']:24} correct={correct} schema_valid={schema_valid} "
                  f"e2e_ms={row['e2e_ms']:.0f}")
            time.sleep(COOLDOWN_S)
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
        }
    overall_accuracy = round(sum(1 for r in rows if r["correct"]) / n, 4) if n else None
    overall_schema_valid_pct = round(100 * sum(1 for r in rows if r["schema_valid"]) / n, 1) if n else None

    summary = {
        "tier": 1, "n_queries": n, "aborted": aborted,
        "overall_accuracy": overall_accuracy, "overall_schema_valid_pct": overall_schema_valid_pct,
        "by_type": by_type,
        "pass_criteria": {"extraction_accuracy_pct": 95, "schema_valid_pct": 100},
        "pass": bool(overall_accuracy is not None and overall_accuracy >= 0.95
                     and overall_schema_valid_pct == 100.0 and not aborted),
    }
    print("\n=== TIER 1 SUMMARY ===")
    print(json.dumps(summary, indent=2))

    with open("/tmp/lnes58_tier1_result.json", "w") as f:
        json.dump({"summary": summary, "rows": rows}, f, indent=2)
    print("\nwritten -> /tmp/lnes58_tier1_result.json")
    return summary

if __name__ == "__main__":
    run()
