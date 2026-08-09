"""
LNES-60 Phase 2 — LNES-22 action-authority adapter.

Consumes a resolved AircraftStateObject (physical truth) and a MissionRequest,
then produces an AuthorizationDecision.

Key invariants:
  - LNES-22 does NOT re-evaluate physical evidence. It consumes already-resolved state.
  - Physical health DOES NOT imply mission authorization (ATTACK-13 / empirically
    confirmed in Phase 1.5 via HOLD-015 and HOLD-035).
  - NEURO-LOCK commands are NOT issued in Phase 2 — local simulation only.
  - The handshake payload passed from physical-truth to LNES-22 is information-
    minimizing: it excludes raw sensor values, raw documentary text, and model
    reasoning chains.
"""

from __future__ import annotations
import dataclasses
import hashlib
import json
import uuid
from typing import List, Optional, Tuple

from .canonicalize import canonical_hash
from .packet_types import (
    AircraftStateObject,
    AuthorizationDecision,
    MissionRequest,
    PhysicalTruthHandshakePayload,
)


# States that indicate physical truth is not sufficient for release
_HOLD_STATES = frozenset({
    "DOCUMENT_PHYSICAL_CONFLICT",
    "CONFIGURATION_MISMATCH",
    "SENSOR_CONFLICT",
    "SENSOR_DEGRADED",
    "STALE_WITNESS",
    "WITNESS_SCOPE_ERROR",
    "UNVERIFIED",
})


def build_handshake_payload(state: AircraftStateObject) -> PhysicalTruthHandshakePayload:
    """
    Build the information-minimizing payload from physical-truth to LNES-22.

    Excludes: raw sensor values, raw documentary text, model reasoning chains,
    calibration data, private keys, witness chain hashes.
    """
    return PhysicalTruthHandshakePayload(
        schema_version="1.0",
        resolution_state=state.resolution_state,
        release_decision=state.release_decision,
        resolved_predicate=state.predicate,
        contributing_planes=tuple(
            sorted({
                *state.admitted_witness_refs and ["PHYSICAL_WITNESS", "WITNESS_TRUST"],
                *([state.documentary_state_ref] and ["DOCUMENTARY"] if state.documentary_state_ref else []),
                *([state.command_state_ref] and ["COMMAND"] if state.command_state_ref else []),
            })
        ),
        conflict_detail=(
            {"type": "conflict", "reason_codes": list(state.known_conflicts)}
            if state.known_conflicts else None
        ),
        resolution_timestamp=state.resolved_at,
        state_envelope_root=state.provenance_root,
    )


def evaluate_action_authority(
    state: AircraftStateObject,
    mission: MissionRequest,
    policy_version: str,
    decision_timestamp: str,
) -> Tuple[AuthorizationDecision, PhysicalTruthHandshakePayload]:
    """
    Evaluate whether the requested mission action may be authorized.

    Two independent evaluations:
      1. Physical truth: is the aircraft in a state that permits release?
      2. Mission authorization: is the requested mission within the approved envelope?

    Both must pass for action_authority = RELEASE.
    Physical truth DOES NOT imply mission authorization.

    Returns (AuthorizationDecision, PhysicalTruthHandshakePayload) tuple.
    """
    reason_codes: List[str] = []
    handshake = build_handshake_payload(state)

    # --- Physical truth evaluation ---
    physical_verdict = f"{state.resolution_state} / {state.release_decision}"
    physical_holds = state.resolution_state in _HOLD_STATES or state.release_decision == "HOLD"
    physical_incomplete = state.release_decision == "INCOMPLETE"

    if physical_holds:
        reason_codes.append(f"PHYSICAL_HOLD: resolution_state={state.resolution_state}")
        for rc in state.reason_codes:
            reason_codes.append(f"  {rc}")

    if physical_incomplete:
        reason_codes.append(f"PHYSICAL_INCOMPLETE: resolution_state={state.resolution_state}")

    # --- Mission authorization evaluation ---
    if mission.aircraft_id != state.aircraft_id:
        reason_codes.append(
            f"MISSION_AIRCRAFT_MISMATCH: mission targets {mission.aircraft_id!r} "
            f"but state is for {state.aircraft_id!r}"
        )
        mission_authorization_verdict = "UNKNOWN"
    elif mission.configuration_epoch != state.configuration_epoch:
        reason_codes.append(
            f"MISSION_EPOCH_MISMATCH: mission epoch {mission.configuration_epoch!r} "
            f"!= state epoch {state.configuration_epoch!r}"
        )
        mission_authorization_verdict = "UNKNOWN"
    elif not mission.mission_within_envelope:
        reason_codes.append(
            f"MISSION_ENVELOPE_VIOLATION: {mission.mission_envelope_reason}"
        )
        mission_authorization_verdict = "OUTSIDE_ENVELOPE"
    else:
        mission_authorization_verdict = "WITHIN_ENVELOPE"

    # --- Determine action authority ---
    if physical_incomplete:
        action_authority = "INCOMPLETE"
    elif physical_holds or mission_authorization_verdict in ("OUTSIDE_ENVELOPE", "UNKNOWN"):
        action_authority = "HOLD"
    else:
        action_authority = "RELEASE"

    # --- Build decision ---
    mission_root = canonical_hash(dataclasses.asdict(mission))

    partial_decision = {
        "schema_version": "1.0",
        "mission_id": mission.mission_id,
        "aircraft_id": state.aircraft_id,
        "action_authority": action_authority,
        "reason_codes": reason_codes,
        "physical_truth_verdict": physical_verdict,
        "mission_authorization_verdict": mission_authorization_verdict,
        "policy_version": policy_version,
        "state_root": state.provenance_root,
        "mission_root": mission_root,
        "decision_timestamp": decision_timestamp,
    }
    decision_receipt = hashlib.sha256(
        json.dumps(partial_decision, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()

    decision = AuthorizationDecision(
        schema_version="1.0",
        decision_id=str(uuid.uuid4()),
        mission_id=mission.mission_id,
        aircraft_id=state.aircraft_id,
        action_authority=action_authority,
        reason_codes=tuple(reason_codes),
        physical_truth_verdict=physical_verdict,
        mission_authorization_verdict=mission_authorization_verdict,
        policy_version=policy_version,
        state_root=state.provenance_root,
        mission_root=mission_root,
        decision_timestamp=decision_timestamp,
        decision_receipt=decision_receipt,
    )

    return decision, handshake
