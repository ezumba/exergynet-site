"""
LNES-60 Phase 2 — Physical state adapter.

Bridges Phase 2 WitnessPacket objects (after admissibility evaluation) to the
frozen P1-0.1.0 convergence engine and state types.

Architecture boundary:
  Phase 2 Receiver → admissibility engine → [this adapter] → P1-0.1.0 convergence_engine
  → AircraftStateObject (Phase 2 output schema)

The P1-0.1.0 convergence engine is frozen at commit 784c55f. This adapter must NOT
modify it. It translates between the two schemas.

SIMULATED_WITNESS note: The frozen P1-0.1.0 WitnessTrustRecord enforces
SIMULATED_WITNESS for all records (HARDWARE_WITNESS is reserved for a future
production integration). This adapter produces SIMULATED_WITNESS records for all
bench runs. Phase 2 hardware bench packets are marked HARDWARE_WITNESS at ingestion
by the receiver (packet.source_label), but the convergence layer receives a bridged
representation. A production Phase 2 would update the convergence engine to accept
HARDWARE_WITNESS; that change is out of scope for the bench validation package.
"""

from __future__ import annotations
import dataclasses
import hashlib
import json
from typing import List, Optional, Tuple

from lnes60.convergence_engine import ConvergenceQuery, converge
from lnes60.release_policy import MissionEnvelopeCheck, evaluate_release
from lnes60.state_types import (
    CommandState,
    ConvergenceResult,
    DocumentaryRecord,
    OperationalState,
    ReleaseRecommendation,
)
from lnes60.witness_types import (
    InvalidatingEvent,
    PhysicalWitness,
    SensorHealth,
    WitnessEnvelopeType,
    WitnessTrustRecord,
)
from .canonicalize import canonical_hash
from .packet_types import AircraftStateObject, WitnessPacket


def _sensor_health_from_packet(packet: WitnessPacket) -> SensorHealth:
    """Derive a SensorHealth tag from the packet's measurement context.
    The Phase 2 packet schema does not include an explicit sensor_health field;
    we infer NOMINAL for admitted packets (failed health implies inadmissible).
    """
    return SensorHealth.NOMINAL


def _to_physical_witness(packet: WitnessPacket, sequence_index: int) -> PhysicalWitness:
    """Convert an admitted Phase 2 WitnessPacket to a P1-0.1.0 PhysicalWitness."""
    trust = WitnessTrustRecord(
        witness_id=f"{packet.witness_device_id}:{packet.nonce}",
        sensor_id=packet.sensor_id,
        aircraft_id=packet.aircraft_id,
        component_id=packet.component_id,
        calibration_current=True,              # admitted = calibration already validated
        calibration_expiry=packet.calibration_valid_until,
        measurement_time=packet.measurement_timestamp,
        hardware_signature_valid=True,          # admitted = signature already verified
        anti_replay_token=packet.nonce,
        measurement_uncertainty=packet.measurement_uncertainty,
        sensor_health=_sensor_health_from_packet(packet),
        measurement_scope=packet.measurement_type,
        configuration_epoch=packet.configuration_epoch,
        envelope_type=WitnessEnvelopeType.SIMULATED_WITNESS,  # bench constraint — see module note
    )
    return PhysicalWitness(
        reading_id=f"{packet.witness_device_id}:{packet.nonce}",
        aircraft_id=packet.aircraft_id,
        component_id=packet.component_id,
        measurement_type=packet.measurement_type,
        value=packet.measurement_value,
        trust=trust,
    )


def _state_to_str(state: OperationalState) -> str:
    return state.value if hasattr(state, "value") else str(state)


def _release_to_str(rec: ReleaseRecommendation) -> str:
    return rec.value if hasattr(rec, "value") else str(rec)


def build_state_object(
    aircraft_id: str,
    component_id: str,
    predicate: str,
    configuration_epoch: str,
    admitted_packets: List[WitnessPacket],
    rejected_with_reasons: List[Tuple[WitnessPacket, str]],
    documentary_records: Optional[List[DocumentaryRecord]] = None,
    command_states: Optional[List[CommandState]] = None,
    invalidating_events: Optional[List[InvalidatingEvent]] = None,
    state_version: str = "1",
    resolved_at: str = "",
    previous_state_root: Optional[str] = None,
) -> AircraftStateObject:
    """
    Run the P1-0.1.0 convergence engine on admitted witness packets and produce
    an AircraftStateObject conforming to the Phase 2 schema.
    """
    documentary_records = documentary_records or []
    command_states = command_states or []
    invalidating_events = invalidating_events or []

    physical_witnesses = [_to_physical_witness(p, i) for i, p in enumerate(admitted_packets)]
    seen_tokens: set = {p.nonce for p in admitted_packets}

    query = ConvergenceQuery(
        aircraft_id=aircraft_id,
        component_id=component_id,
        predicate=predicate,
        claim_scope=predicate,
        as_of=resolved_at or admitted_packets[0].measurement_timestamp if admitted_packets else "",
        documentary_record_ids=[r.record_id for r in documentary_records],
        command_state_field=None,
        witness_ids=[w.reading_id for w in physical_witnesses],
    )

    result: ConvergenceResult = converge(
        query,
        all_documentary=documentary_records,
        all_command=command_states,
        all_witnesses=physical_witnesses,
        all_events=invalidating_events,
        seen_anti_replay_tokens=seen_tokens,
    )

    release_result = evaluate_release([result], mission_envelope=None)

    admitted_refs = tuple(p.nonce for p in admitted_packets)
    rejected_refs = tuple(p.nonce for p, _ in rejected_with_reasons)
    all_refs = admitted_refs + rejected_refs

    sensor_health_summary = {
        p.sensor_id: "NOMINAL" for p in admitted_packets
    }
    witness_trust_summary = {
        p.witness_device_id: {"admitted": True, "failed_properties": []}
        for p in admitted_packets
    }
    for pkt, reason in rejected_with_reasons:
        witness_trust_summary[pkt.witness_device_id] = {
            "admitted": False,
            "failed_properties": [reason],
        }

    # Provenance root: hash of canonical admitted evidence fingerprints
    admitted_fingerprints = sorted(
        canonical_hash(dataclasses.asdict(p)) for p in admitted_packets
    )
    provenance_root = hashlib.sha256(
        json.dumps(admitted_fingerprints, sort_keys=True).encode("utf-8")
    ).hexdigest()

    resolution_state_str = _state_to_str(result.operational_state)
    release_decision_str = _release_to_str(release_result.release_recommendation)

    return AircraftStateObject(
        schema_version="1.0",
        aircraft_id=aircraft_id,
        component_id=component_id,
        predicate=predicate,
        configuration_epoch=configuration_epoch,
        state_version=state_version,
        resolved_at=resolved_at,
        documentary_state_ref=documentary_records[0].record_id if documentary_records else None,
        command_state_ref=command_states[0].record_id if command_states else None,
        witness_refs=all_refs,
        admitted_witness_refs=admitted_refs,
        rejected_witness_refs=rejected_refs,
        resolution_state=resolution_state_str,
        release_decision=release_decision_str,
        reason_codes=tuple(result.reason_codes + release_result.reason_codes),
        known_conflicts=tuple(
            str(result.conflict_detail) for _ in [result] if result.conflict_detail
        ),
        known_damage=(),
        sensor_health_summary=sensor_health_summary,
        witness_trust_summary=witness_trust_summary,
        provenance_root=provenance_root,
        previous_state_root=previous_state_root,
    )
