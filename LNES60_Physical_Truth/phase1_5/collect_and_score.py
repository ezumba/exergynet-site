"""
Phase 1.5 pilot: collects generation_responses/{case_id}__{arm}.json (real
subagent output, one Read+Write per file, no case_id/ground-truth shown to
the model -- see build_prompts.py / dispatch), builds raw result records in
the same schema arm_p0/p1/p2.py already use, and scores with the UNCHANGED
lnes60/evaluator.py against the sealed LNES60_EVALUATOR_HOLDOUT.json ground
truth, restricted to the 18 pilot case_ids.

M2's authorized decision is NOT taken from the model -- exactly like P2 in
Phase 1, it is computed by re-running the FROZEN convergence_engine.py +
release_policy.py on the case evidence. The model's M2 output is the
CANDIDATE decision only (pre-gate interpretation of the converged state),
preserved separately, per the same candidate-vs-authorized discipline
Phase 1 used for P2. Model-label is set explicitly to a real-model marker,
never the Phase 1 simulator label.
"""

import glob
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, ROOT)

from pilot_cases import PILOT_CASE_IDS  # noqa: E402
from lnes60.case_loader import load_documentary, load_command, load_events, load_witnesses  # noqa: E402
from lnes60.convergence_engine import converge, ConvergenceQuery  # noqa: E402
from lnes60.release_policy import evaluate_release, MissionEnvelopeCheck  # noqa: E402
from lnes60.evaluator import score_arm, candidate_vs_authorized_delta  # noqa: E402

RESPONSES_DIR = os.path.join(SCRIPT_DIR, "generation_responses")
RAW_DIR = os.path.join(SCRIPT_DIR, "raw_results")

REAL_MODEL_LABEL = "REAL_MODEL: claude-sonnet-5 subagent dispatch (Phase 1.5 pilot, NOT the Phase 1 rule-based simulator)"

VALID_OP_STATES = {
    "VERIFIED_MATCH", "DOCUMENT_PHYSICAL_CONFLICT", "CONFIGURATION_MISMATCH",
    "SENSOR_CONFLICT", "SENSOR_DEGRADED", "STALE_WITNESS", "WITNESS_SCOPE_ERROR",
    "UNVERIFIED", "INCOMPLETE",
}
VALID_RELEASE = {"RELEASE_ELIGIBLE", "HOLD", "INCOMPLETE"}


def load_model_verdict(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    verdict = json.loads(text)
    op = verdict.get("operational_state")
    rel = verdict.get("release_recommendation")
    if op not in VALID_OP_STATES:
        raise ValueError(f"invalid operational_state {op!r} in {path}")
    if rel not in VALID_RELEASE:
        raise ValueError(f"invalid release_recommendation {rel!r} in {path}")
    return verdict


def compute_converged_and_authorized(case):
    documentary = load_documentary(case)
    command = load_command(case)
    events = load_events(case)
    witnesses = load_witnesses(case)
    q = ConvergenceQuery(
        aircraft_id=case["aircraft_id"], component_id=case["component_id"],
        predicate=case["predicate"], claim_scope=case["claim_scope"], as_of=case["as_of"],
        documentary_record_ids=[d.record_id for d in documentary],
        command_state_field=case.get("command_field"),
        witness_ids=[w.reading_id for w in witnesses],
    )
    converged = converge(q, documentary, command, witnesses, events, set())
    mission_check = MissionEnvelopeCheck(
        case.get("mission_within_envelope", True),
        case.get("mission_envelope_reason", ""),
    )
    authorized = evaluate_release([converged], mission_check)
    return converged, authorized


def main():
    with open(os.path.join(ROOT, "LNES60_RUNNER_HOLDOUT.json"), encoding="utf-8") as f:
        all_cases = {c["case_id"]: c for c in json.load(f)["cases"]}

    os.makedirs(RAW_DIR, exist_ok=True)
    errors = []
    written = 0

    for case_id in PILOT_CASE_IDS:
        case = all_cases[case_id]

        for arm in ("M0", "M1", "M2"):
            resp_path = os.path.join(RESPONSES_DIR, f"{case_id}__{arm}.json")
            try:
                verdict = load_model_verdict(resp_path)
            except Exception as e:
                errors.append({"case_id": case_id, "arm": arm, "error": f"{type(e).__name__}: {e}"})
                continue

            if arm in ("M0", "M1"):
                evidence_refs = [d["record_id"] for d in case.get("documentary", [])]
                if arm == "M1":
                    evidence_refs += [w["reading_id"] for w in case.get("witnesses", [])]
                result = {
                    "arm": arm,
                    "model_label": REAL_MODEL_LABEL,
                    "case_id": case_id,
                    "aircraft_id": case["aircraft_id"],
                    "operational_state": verdict["operational_state"],
                    "release_recommendation": verdict["release_recommendation"],
                    "reason_codes": [verdict.get("reasoning", "")],
                    "evidence_refs": evidence_refs,
                }
            else:  # M2
                converged, authorized = compute_converged_and_authorized(case)
                result = {
                    "arm": "M2",
                    "model_label": REAL_MODEL_LABEL,
                    "case_id": case_id,
                    "aircraft_id": case["aircraft_id"],
                    "operational_state": converged.operational_state.value,
                    "release_recommendation": authorized.release_recommendation.value,
                    "reason_codes": converged.reason_codes + authorized.reason_codes,
                    "evidence_refs": converged.evidence_refs,
                    "converged_state": converged.operational_state.value,
                    "candidate_decision": verdict["release_recommendation"],
                    "candidate_operational_state": verdict["operational_state"],
                    "authority_decision": authorized.release_recommendation.value,
                    "gate_reason": authorized.gate_reason,
                }

            path = os.path.join(RAW_DIR, f"{case_id}__{arm}.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
            written += 1

    print(f"collected={written} errors={len(errors)}")
    for e in errors:
        print(json.dumps(e))
    if errors:
        return 1

    with open(os.path.join(ROOT, "LNES60_EVALUATOR_HOLDOUT.json"), encoding="utf-8") as f:
        eval_cases = json.load(f)["cases"]
    ground_truth = {
        c["case_id"]: {
            "expected_operational_state": c["expected_operational_state"],
            "mission_within_envelope": c.get("mission_within_envelope", True),
            "ktx_class": c["ktx_class"],
        }
        for c in eval_cases if c["case_id"] in PILOT_CASE_IDS
    }
    assert len(ground_truth) == len(PILOT_CASE_IDS), (
        f"expected ground truth for all {len(PILOT_CASE_IDS)} pilot cases, got {len(ground_truth)}"
    )

    results_by_arm = {"M0": [], "M1": [], "M2": []}
    for path in sorted(glob.glob(os.path.join(RAW_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            r = json.load(f)
        results_by_arm[r["arm"]].append(r)

    scores = {arm: score_arm(results, ground_truth) for arm, results in results_by_arm.items()}
    m2_delta = candidate_vs_authorized_delta(results_by_arm["M2"], ground_truth)

    output = {
        "n_pilot_cases": len(PILOT_CASE_IDS),
        "n_total_evaluations": sum(len(v) for v in results_by_arm.values()),
        "pilot_case_ids": PILOT_CASE_IDS,
        "per_arm": scores,
        "m2_candidate_vs_authorized_delta": m2_delta,
        "m0_to_m1_delta": {
            "release_accuracy_change": scores["M1"]["release_recommendation_accuracy"] - scores["M0"]["release_recommendation_accuracy"],
            "false_release_rate_change": scores["M1"]["false_release_rate"] - scores["M0"]["false_release_rate"],
        },
        "m1_to_m2_authorized_delta": {
            "release_accuracy_change": scores["M2"]["release_recommendation_accuracy"] - scores["M1"]["release_recommendation_accuracy"],
            "false_release_rate_change": scores["M2"]["false_release_rate"] - scores["M1"]["false_release_rate"],
        },
    }

    with open(os.path.join(SCRIPT_DIR, "LNES60_PHASE1.5_PILOT_evaluator_output.json"), "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(json.dumps({
        "n_pilot_cases": output["n_pilot_cases"],
        "n_total_evaluations": output["n_total_evaluations"],
        "M0": {k: v for k, v in scores["M0"].items() if k != "per_ktx_class"},
        "M1": {k: v for k, v in scores["M1"].items() if k != "per_ktx_class"},
        "M2": {k: v for k, v in scores["M2"].items() if k != "per_ktx_class"},
        "m2_delta": m2_delta,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
