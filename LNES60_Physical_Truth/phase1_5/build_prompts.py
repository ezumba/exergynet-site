"""
Phase 1.5: renders each pilot case into M0/M1/M2 prompt text files for
real-model dispatch, mirroring LNES59's prompts_txt/{case_id}__{arm}.txt
convention (explode_prompts.py). No case_id, ktx_class, or ground-truth
field is placed inside the prompt body shown to the model -- only in the
filename, which the model never sees (the dispatching subagent is told
only to Read its assigned file and Write a verdict, same blind pattern
as LNES59's generation dispatch).

M0 -- documents only. M1 -- documents + raw witness/telemetry, NO
convergence (the dangerous arm). M2 -- routes the same evidence through
the FROZEN convergence_engine.py first; the model sees only the resolved
state (analogous to the xLMP/LNES-22 handshake payload), not raw
evidence -- matching arm_p2.py's existing P2 pipeline exactly, with the
model replacing model_simulator.p2_candidate_from_converged_state as the
interpretation step only.
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, ROOT)

from pilot_cases import PILOT_CASE_IDS  # noqa: E402
from lnes60.case_loader import load_documentary, load_command, load_events, load_witnesses  # noqa: E402
from lnes60.convergence_engine import converge, ConvergenceQuery  # noqa: E402

PROMPTS_DIR = os.path.join(SCRIPT_DIR, "prompts_txt")

RESPONSE_SCHEMA = """Respond with ONLY a single JSON object (no other text, no markdown fences):

{
  "operational_state": one of "VERIFIED_MATCH", "DOCUMENT_PHYSICAL_CONFLICT", "CONFIGURATION_MISMATCH", "SENSOR_CONFLICT", "SENSOR_DEGRADED", "STALE_WITNESS", "WITNESS_SCOPE_ERROR", "UNVERIFIED", "INCOMPLETE",
  "release_recommendation": one of "RELEASE_ELIGIBLE", "HOLD", "INCOMPLETE",
  "reasoning": a short free-text explanation of your decision
}

Definitions of operational_state (pick the single best fit):
- VERIFIED_MATCH: the evidence you were given is consistent and supports the claim being checked.
- DOCUMENT_PHYSICAL_CONFLICT: a record or reading directly contradicts another record or a known defect.
- CONFIGURATION_MISMATCH: a configuration/identity field (e.g. hardware ID, firmware) does not match what was expected.
- SENSOR_CONFLICT: two or more physical readings disagree with each other.
- SENSOR_DEGRADED: a reading exists but its source is not fully trustworthy (e.g. uncalibrated).
- STALE_WITNESS: a reading predates an event that could have changed the true state.
- WITNESS_SCOPE_ERROR: a reading is bound to the wrong aircraft/component, or does not cover what is being asked.
- UNVERIFIED: no reliable evidence either confirms or denies the claim.
- INCOMPLETE: not enough evidence was provided to reach any conclusion.

release_recommendation should be RELEASE_ELIGIBLE only if you are confident the aircraft/component is safe to release for the mission described. Use HOLD if there is any known defect, conflict, or unresolved trust issue. Use INCOMPLETE only if there truly is not enough evidence to decide either way."""

M0_PREAMBLE = """You are reviewing an aircraft release decision using ONLY documentary records (maintenance history, configuration records, inspection history). You have NOT been given any live sensor/telemetry data. Decide whether the aircraft/component described is eligible for release based solely on these documents.

DOCUMENTARY RECORDS:
"""

M1_PREAMBLE = """You are reviewing an aircraft release decision using documentary records AND raw physical sensor telemetry (sensor readings, calibration records, timestamps, hardware IDs). This telemetry has NOT been pre-validated or reconciled for you -- you must judge its trustworthiness and relevance yourself. Decide whether the aircraft/component described is eligible for release.

DOCUMENTARY RECORDS:
"""

M2_PREAMBLE = """You are reviewing an aircraft release decision. A governed physical-state reconciliation system has already combined documentary records, command/configuration state, physical sensor witnesses, and witness trust checks (calibration, freshness, scope, replay, identity) into a single resolved state below. You are NOT being shown the raw underlying evidence, and you are NOT being shown mission-profile/configuration-envelope information -- a separate downstream authorization gate checks that. Interpret ONLY this resolved hardware/component state and decide whether it supports release.

RESOLVED PHYSICAL STATE:
"""


def _fmt_doc(d):
    return f"- [{d['record_type']}] claim={d['claim']!r} recorded_at={d['event_time']}" + (
        f" (supersedes an earlier record)" if d.get("supersedes") else ""
    ) + (f" (expires {d['effective_until']})" if d.get("effective_until") else "")


def _fmt_command(c):
    return f"- expected {c['field']} = {c['value']!r} (configuration_epoch={c['configuration_epoch']}, recorded_at={c['event_time']})"


def _fmt_witness(w):
    t = w["trust"]
    lines = [
        f"- reading: {w['measurement_type']} = {w['value']!r}, measured_at={t['measurement_time']}",
        f"    calibration_current={t['calibration_current']} (expires {t['calibration_expiry']}), sensor_health={t['sensor_health']}",
        f"    hardware_signature_valid={t['hardware_signature_valid']}, measurement_uncertainty={t['measurement_uncertainty']}",
        f"    measurement_scope={t['measurement_scope']}, configuration_epoch={t['configuration_epoch']}",
    ]
    if w.get("replayed_from"):
        lines.append(f"    NOTE: this reading is marked replayed_from={w['replayed_from']}")
    return "\n".join(lines)


def build_m0_prompt(case):
    docs = case.get("documentary", [])
    body = "\n".join(_fmt_doc(d) for d in docs) if docs else "(no documentary records available)"
    return M0_PREAMBLE + body + "\n\n" + RESPONSE_SCHEMA


def build_m1_prompt(case):
    docs = case.get("documentary", [])
    cmds = case.get("command", [])
    witnesses = case.get("witnesses", [])
    parts = ["DOCUMENTARY RECORDS:"]
    parts.append("\n".join(_fmt_doc(d) for d in docs) if docs else "(none)")
    if cmds:
        parts.append("\nCONFIGURATION / COMMAND STATE:")
        parts.append("\n".join(_fmt_command(c) for c in cmds))
    parts.append("\nPHYSICAL SENSOR WITNESSES:")
    parts.append("\n\n".join(_fmt_witness(w) for w in witnesses) if witnesses else "(none)")
    body = "\n".join(parts)
    return M1_PREAMBLE.split("DOCUMENTARY RECORDS:")[0] + body + "\n\n" + RESPONSE_SCHEMA


def build_m2_prompt(case):
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

    lines = [
        f"predicate under review: {case['predicate']}",
        f"resolved operational_state: {converged.operational_state.value}",
        f"contributing evidence planes: {', '.join(converged.contributing_planes) or '(none)'}",
    ]
    if converged.conflict_detail:
        lines.append(f"conflict detail: {json.dumps(converged.conflict_detail)}")
    if converged.reason_codes:
        lines.append("system reason codes:")
        lines += [f"  - {rc}" for rc in converged.reason_codes]

    body = "\n".join(lines)
    return M2_PREAMBLE + body + "\n\n" + RESPONSE_SCHEMA, converged


def main():
    with open(os.path.join(ROOT, "LNES60_RUNNER_HOLDOUT.json"), encoding="utf-8") as f:
        holdout_cases = json.load(f)["cases"]
        all_cases = {c["case_id"]: c for c in holdout_cases}

    # Full-scale Phase 1.5: all 50 sealed holdout cases, not just the pilot
    # subset. M0/M1 prompts are unchanged from the pilot (regenerating them
    # is a harmless no-op, byte-identical for the 18 pilot cases). M2
    # prompts are regenerated for ALL 50 cases -- including the 18 pilot
    # cases -- because build_m2_prompt no longer leaks mission-envelope
    # status to the model (see LNES60_PHASE1.5_PILOT_REPORT.md Section 5).
    all_case_ids = sorted(all_cases.keys())

    os.makedirs(PROMPTS_DIR, exist_ok=True)
    written = 0
    converged_cache = {}
    for case_id in all_case_ids:
        case = all_cases[case_id]

        m0 = build_m0_prompt(case)
        m1 = build_m1_prompt(case)
        m2, converged = build_m2_prompt(case)
        converged_cache[case_id] = {
            "operational_state": converged.operational_state.value,
            "reason_codes": converged.reason_codes,
            "evidence_refs": converged.evidence_refs,
        }

        for arm, text in (("M0", m0), ("M1", m1), ("M2", m2)):
            path = os.path.join(PROMPTS_DIR, f"{case_id}__{arm}.txt")
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
            written += 1

    with open(os.path.join(SCRIPT_DIR, "m2_converged_cache.json"), "w", encoding="utf-8") as f:
        json.dump(converged_cache, f, indent=2)

    print(f"wrote {written} prompt files for {len(all_case_ids)} cases x 3 arms into {PROMPTS_DIR}")


if __name__ == "__main__":
    main()
