"""P1 -- documentary + command + RAW physical witnesses, ungoverned. See
model_simulator.p1_candidate for the reasoning logic and its disclosed
blind spots (calibration, scope, replay, freshness, epoch currency are
NOT systematically checked by this arm -- that is the point of the
comparison)."""

from .model_simulator import p1_candidate, SIMULATOR_LABEL


def run(case_dict: dict) -> dict:
    result = p1_candidate(case_dict)
    evidence_refs = [d["record_id"] for d in case_dict.get("documentary", [])]
    evidence_refs += [w["reading_id"] for w in case_dict.get("witnesses", [])]
    return {
        "arm": "P1",
        "model_label": SIMULATOR_LABEL,
        "case_id": case_dict["case_id"],
        "aircraft_id": case_dict["aircraft_id"],
        "configuration_epoch": None,
        "operational_state": result["operational_state"],
        "release_recommendation": result["release_recommendation"],
        "reason_codes": result["reason_codes"],
        "evidence_refs": evidence_refs,
        "uncertainty": None,
    }
