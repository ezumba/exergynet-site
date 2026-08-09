"""P0 -- documentary only. See model_simulator.p0_candidate for the
reasoning logic and its disclosed blind spots."""

from .model_simulator import p0_candidate, SIMULATOR_LABEL


def run(case_dict: dict) -> dict:
    result = p0_candidate(case_dict)
    return {
        "arm": "P0",
        "model_label": SIMULATOR_LABEL,
        "case_id": case_dict["case_id"],
        "aircraft_id": case_dict["aircraft_id"],
        "configuration_epoch": None,
        "operational_state": result["operational_state"],
        "release_recommendation": result["release_recommendation"],
        "reason_codes": result["reason_codes"],
        "evidence_refs": [d["record_id"] for d in case_dict.get("documentary", [])],
        "uncertainty": None,
    }
