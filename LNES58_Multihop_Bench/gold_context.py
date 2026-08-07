#!/usr/bin/env python3
"""
Real gold-evidence context construction for O1 (gold-evidence oracle) and
X2 (bounded-evidence resolver, same construction per the documented
methodological caveat in smoke_test_modern_rag.py).

NOT to be confused with rag_common's required_snippets()-style helpers in
tier{1,2,3}_rag.py -- those return short substrings/labels used only to
*check whether retrieved text contains the needed information*
(retrieval_hit()), not to *serve as the complete standalone context*. Using
them as O1/X2 context was a bug caught in the smoke test (O1 scored below
S0/R1-R4, which is definitionally wrong for an oracle) -- this module is
the fix: real field values, formatted as complete sentences, sufficient on
their own to answer the question.
"""


def t1_gold_context(facts, qtype):
    if qtype == "bmi_obesity":
        return f"Height: {facts['height_cm']} cm. Weight: {facts['weight_kg']} kg."
    if qtype == "days_elapsed":
        return f"Admission date: {facts['admission_date']}. Last lab result date: {facts['last_lab_date']}."
    if qtype == "dosage_appropriateness":
        return f"Prescribed Cefaxolin-X dosage: {facts['prescribed_dosage_mg']} mg. Patient weight: {facts['weight_kg']} kg."
    if qtype == "contraindication":
        return (f"Current medications: {', '.join(facts['current_medications'])}. "
                f"Documented allergy: {facts['allergy']}.")
    return ""


def t2_gold_context(facts, qtype, full_text=""):
    if qtype == "interaction_check":
        return (f"Patient's current medications: {', '.join(facts['current_meds'])}. "
                f"Trial drug under evaluation: {facts['trial_drug']}.")
    if qtype == "risk_percentile":
        # population_ref (the 19 reference values) is generated locally in
        # make_trio() and never persisted to `facts` -- only the pre-computed
        # answer (`percentile`) is. It's not derivable from other facts
        # fields, so pull the actual line out of the generated document text
        # instead of fabricating or omitting it.
        pop_line = ""
        for line in full_text.split("\n"):
            if line.startswith("Trial population reference lab values"):
                pop_line = line.strip()
                break
        return (f"Patient's lab value (eGFR-equivalent): {facts['lab_value']} mL/min/1.73m^2. "
                f"{pop_line}")
    if qtype == "exclusion_match":
        return (f"Patient's documented conditions: {', '.join(facts['conditions'])}. "
                f"Trial exclusion criteria: {', '.join(facts['exclusion_criteria'])}.")
    return ""


from tier3_adversarial import DIAGNOSIS_LAB_MAP


def t3_gold_context(facts, qtype):
    if qtype == "temporal_ordering":
        med_lines = "; ".join(
            f"{m['drug']}: prescribed {m['prescribed']}"
            + (f", discontinued {m['discontinued']}" if m['discontinued'] else ", still active")
            for m in facts["med_timeline"]
        )
        return f"Cardiac event date: {facts['cardiac_event']}. Medication timeline: {med_lines}."
    if qtype == "absence_detection":
        expected_labs = DIAGNOSIS_LAB_MAP[facts["diagnosis"]]
        return (f"Diagnosis: {facts['diagnosis']}. "
                f"Standard expected lab panel for {facts['diagnosis']}: {', '.join(expected_labs)}. "
                f"Labs present on file for this patient: {', '.join(facts['present_labs'])}.")
    if qtype == "extrapolation":
        return (f"eGFR reading 1: {facts['egfr1']} on {facts['date1']}. "
                f"eGFR reading 2: {facts['egfr2']} on {facts['date2']}.")
    if qtype == "temporal_negation":
        bp_lines = "; ".join(f"Week {b['week']}: {b['systolic']}/{b['diastolic']} mmHg" for b in facts["bp_readings"])
        return f"Blood pressure readings by week: {bp_lines}."
    return ""
