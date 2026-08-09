"""
P2 -- governed physical truth. The full pipeline:
  documentary + command + witnesses + witness trust
    -> deterministic witness validation
    -> deterministic state convergence (convergence_engine, FROZEN)
    -> physical-state envelope (the resolved operational_state)
    -> model (model_simulator.p2_candidate_from_converged_state)
    -> CandidateClaim
    -> simulated LNES-22 release-policy gate (release_policy, FROZEN)
    -> AUTHORIZED RELEASE STATE

Preserves BOTH the pre-gate candidate decision and the post-gate
authorized decision, per the directive's explicit instruction --
this is the internal controlled delta analogous to LNES-59's X1->X2.
"""

from .case_loader import load_documentary, load_command, load_events, load_witnesses
from .convergence_engine import converge, ConvergenceQuery
from .release_policy import evaluate_release, MissionEnvelopeCheck
from .model_simulator import p2_candidate_from_converged_state, SIMULATOR_LABEL


def run(case_dict: dict) -> dict:
    documentary = load_documentary(case_dict)
    command = load_command(case_dict)
    events = load_events(case_dict)
    witnesses = load_witnesses(case_dict)

    q = ConvergenceQuery(
        aircraft_id=case_dict["aircraft_id"], component_id=case_dict["component_id"],
        predicate=case_dict["predicate"], claim_scope=case_dict["claim_scope"], as_of=case_dict["as_of"],
        documentary_record_ids=[d.record_id for d in documentary],
        command_state_field=case_dict.get("command_field"),
        witness_ids=[w.reading_id for w in witnesses],
    )
    converged = converge(q, documentary, command, witnesses, events, set())

    candidate = p2_candidate_from_converged_state(converged.operational_state.value, converged.conflict_detail)

    mission_check = MissionEnvelopeCheck(
        case_dict.get("mission_within_envelope", True),
        case_dict.get("mission_envelope_reason", ""),
    )
    authorized = evaluate_release([converged], mission_check)

    return {
        "arm": "P2",
        "model_label": SIMULATOR_LABEL,
        "case_id": case_dict["case_id"],
        "aircraft_id": case_dict["aircraft_id"],
        "configuration_epoch": None,
        "operational_state": converged.operational_state.value,
        "release_recommendation": authorized.release_recommendation.value,
        "reason_codes": converged.reason_codes + authorized.reason_codes,
        "evidence_refs": converged.evidence_refs,
        "uncertainty": None,
        "witness_validation": converged.reason_codes,
        "converged_state": converged.operational_state.value,
        "candidate_decision": candidate["release_recommendation"],
        "authority_decision": authorized.release_recommendation.value,
        "gate_reason": authorized.gate_reason,
    }
