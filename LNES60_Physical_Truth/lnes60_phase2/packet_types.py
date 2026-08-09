"""
LNES-60 Phase 2 — Canonical data types.

All dataclasses are frozen (immutable after construction) to prevent accidental
mutation downstream. Use dataclasses.replace() to produce modified copies.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Witness Packet
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class WitnessPacket:
    """
    Hardware witness packet from the KTX bench or a SIMULATED_WITNESS source.
    All 22 fields are required; None values are not accepted at construction.

    Private keys MUST NOT appear in any field. signature contains only the
    base64url-encoded signature over the canonical serialization of all other fields.
    """
    schema_version: str
    aircraft_id: str
    component_id: str
    sensor_id: str
    witness_device_id: str
    measurement_type: str
    measurement_value: float
    unit: str
    measurement_uncertainty: float
    measurement_timestamp: str          # ISO 8601 UTC
    sequence_number: int
    nonce: str
    configuration_epoch: str
    calibration_record_hash: str        # SHA-256 hex
    calibration_valid_until: str        # ISO 8601 UTC
    firmware_hash: str                  # SHA-256 hex
    witness_version: str
    previous_witness_hash: Optional[str]  # SHA-256 hex or None (first packet)
    signature_algorithm: str            # must be "Ed25519"
    signature_key_id: str
    signature: str                      # base64url Ed25519 over canonical serialization

    # Source label — HARDWARE_WITNESS or SIMULATED_WITNESS. Not part of the signed
    # payload; set by the receiver at ingestion time based on the submission path.
    source_label: str = "SIMULATED_WITNESS"


# ---------------------------------------------------------------------------
# Admissibility verdict (per witness)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AdmissibilityVerdict:
    """Result of the four-plane admissibility evaluation for a single witness."""
    witness_device_id: str
    packet_nonce: str
    admitted: bool
    failed_checks: Tuple[str, ...]   # empty if admitted
    rejection_reason: Optional[str]  # None if admitted


# ---------------------------------------------------------------------------
# Aircraft State Object
# ---------------------------------------------------------------------------

_RESOLUTION_STATES = frozenset({
    "VERIFIED_MATCH",
    "DOCUMENT_PHYSICAL_CONFLICT",
    "CONFIGURATION_MISMATCH",
    "SENSOR_CONFLICT",
    "SENSOR_DEGRADED",
    "STALE_WITNESS",
    "WITNESS_SCOPE_ERROR",
    "UNVERIFIED",
    "INCOMPLETE",
})

_RELEASE_DECISIONS = frozenset({"RELEASE_ELIGIBLE", "HOLD", "INCOMPLETE"})


@dataclass(frozen=True)
class AircraftStateObject:
    """
    Output of the physical-truth convergence layer.

    resolution_state is one of the nine canonical states — RELEASE_ELIGIBLE
    never appears here. release_decision is the derived engineering clearance.
    known_damage is append-only and must never be mutated by a conflict.
    """
    schema_version: str
    aircraft_id: str
    component_id: str
    predicate: str
    configuration_epoch: str
    state_version: str
    resolved_at: str                         # ISO 8601 UTC
    documentary_state_ref: Optional[str]
    command_state_ref: Optional[str]
    witness_refs: Tuple[str, ...]
    admitted_witness_refs: Tuple[str, ...]
    rejected_witness_refs: Tuple[str, ...]
    resolution_state: str                    # one of _RESOLUTION_STATES
    release_decision: str                    # one of _RELEASE_DECISIONS
    reason_codes: Tuple[str, ...]
    known_conflicts: Tuple[str, ...]
    known_damage: Tuple[str, ...]            # append-only, never mutated
    sensor_health_summary: Dict[str, str]   # sensor_id → NOMINAL|DEGRADED|FAILED|UNKNOWN
    witness_trust_summary: Dict[str, Any]   # device_id → {admitted, failed_properties}
    provenance_root: str                     # SHA-256 of canonical admitted evidence
    previous_state_root: Optional[str]       # provenance_root of prior state version

    def __post_init__(self) -> None:
        if self.resolution_state not in _RESOLUTION_STATES:
            raise ValueError(f"Invalid resolution_state: {self.resolution_state!r}")
        if self.release_decision not in _RELEASE_DECISIONS:
            raise ValueError(f"Invalid release_decision: {self.release_decision!r}")


# ---------------------------------------------------------------------------
# Mission Request
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class MissionRequest:
    """Input to the LNES-22 action-authority evaluation."""
    schema_version: str
    mission_id: str
    aircraft_id: str
    configuration_epoch: str
    payload_ref: Optional[str]
    requested_action: str
    operational_conditions_ref: Optional[str]
    authorization_policy_version: str
    mission_within_envelope: bool
    mission_envelope_reason: str             # empty string if within_envelope=True


# ---------------------------------------------------------------------------
# Physical Truth Handshake Payload (physical-truth → LNES-22)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class PhysicalTruthHandshakePayload:
    """
    Minimal payload from the convergence layer to LNES-22.
    Contains only resolved state — no raw sensor values, raw documentary text,
    or model reasoning chains.
    """
    schema_version: str
    resolution_state: str
    release_decision: str
    resolved_predicate: str
    contributing_planes: Tuple[str, ...]
    conflict_detail: Optional[Dict[str, Any]]  # type + reason_codes only, not raw values
    resolution_timestamp: str
    state_envelope_root: str                    # provenance_root from AircraftStateObject


# ---------------------------------------------------------------------------
# Authorization Decision (LNES-22 output)
# ---------------------------------------------------------------------------

_ACTION_AUTHORITY_VALUES = frozenset({"RELEASE", "HOLD", "INCOMPLETE"})


@dataclass(frozen=True)
class AuthorizationDecision:
    """
    Final release-or-hold decision from LNES-22.
    NEURO-LOCK commands are NOT issued in Phase 2 — this is local simulation only.
    """
    schema_version: str
    decision_id: str
    mission_id: str
    aircraft_id: str
    action_authority: str                   # RELEASE | HOLD | INCOMPLETE
    reason_codes: Tuple[str, ...]
    physical_truth_verdict: str             # resolution_state + release_decision string
    mission_authorization_verdict: str      # WITHIN_ENVELOPE | OUTSIDE_ENVELOPE | UNKNOWN
    policy_version: str
    state_root: str
    mission_root: Optional[str]
    decision_timestamp: str
    decision_receipt: str                   # SHA-256 of canonical serialization

    def __post_init__(self) -> None:
        if self.action_authority not in _ACTION_AUTHORITY_VALUES:
            raise ValueError(f"Invalid action_authority: {self.action_authority!r}")
