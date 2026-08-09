"""
Core state types for LNES-60. Mirrors LNES60_TRUTH_STATE_SCHEMA.json --
this module is the executable form of that schema, not a divergent
reimplementation. Keep the two in sync by hand; the schema is the
human/patent-facing spec, this is the runtime.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class OperationalState(str, Enum):
    """Output of the convergence engine. NOT the release decision --
    see release_policy.py for RELEASE_ELIGIBLE / HOLD / INCOMPLETE,
    which are a separate, downstream mapping."""
    VERIFIED_MATCH = "VERIFIED_MATCH"
    DOCUMENT_PHYSICAL_CONFLICT = "DOCUMENT_PHYSICAL_CONFLICT"
    CONFIGURATION_MISMATCH = "CONFIGURATION_MISMATCH"
    SENSOR_CONFLICT = "SENSOR_CONFLICT"
    SENSOR_DEGRADED = "SENSOR_DEGRADED"
    STALE_WITNESS = "STALE_WITNESS"
    WITNESS_SCOPE_ERROR = "WITNESS_SCOPE_ERROR"
    UNVERIFIED = "UNVERIFIED"
    INCOMPLETE = "INCOMPLETE"


class ReleaseRecommendation(str, Enum):
    """Output of release_policy.py -- the simulated LNES-22 gate."""
    RELEASE_ELIGIBLE = "RELEASE_ELIGIBLE"
    HOLD = "HOLD"
    INCOMPLETE = "INCOMPLETE"


class EngineeringEnvelopeLabel(str, Enum):
    SYNTHETIC_TEST_VALUE = "SYNTHETIC_TEST_VALUE"
    QUALIFIED_ENGINEERING_DATA = "QUALIFIED_ENGINEERING_DATA"  # never used by this harness


@dataclass(frozen=True)
class EngineeringEnvelope:
    parameter_name: str
    value: float
    label: EngineeringEnvelopeLabel = EngineeringEnvelopeLabel.SYNTHETIC_TEST_VALUE
    source: str = ""

    def __post_init__(self):
        if self.label != EngineeringEnvelopeLabel.SYNTHETIC_TEST_VALUE:
            raise ValueError(
                "LNES-60 Phase 1 harness only ever uses SYNTHETIC_TEST_VALUE "
                "engineering envelopes -- QUALIFIED_ENGINEERING_DATA is reserved "
                "for a future real-data integration explicitly out of scope here."
            )


@dataclass
class DocumentaryRecord:
    """One entry in the documentary plane. Immutable once created --
    historical truth is never edited (architecture doc Section 4)."""
    record_id: str
    aircraft_id: str
    component_id: Optional[str]
    record_type: str  # e.g. "maintenance_history", "inspection", "service_life", "part_provenance"
    claim: str  # e.g. "SERVICEABLE", "DEFECT_CONFIRMED", "SERVICE_LIFE_REMAINING_HOURS=120"
    event_time: str  # ISO8601 -- when the documented event/observation occurred
    supersedes: Optional[str] = None  # record_id this one supersedes, if any
    effective_until: Optional[str] = None  # for temporary/time-bounded claims


@dataclass
class CommandState:
    """One entry in the command/digital plane."""
    record_id: str
    aircraft_id: str
    mission_id: str
    field: str  # e.g. "expected_motor_id", "firmware_version", "payload_kg"
    value: str
    configuration_epoch: str
    event_time: str


@dataclass
class ConvergenceResult:
    operational_state: OperationalState
    aircraft_id: str
    predicate: str
    contributing_planes: list = field(default_factory=list)
    conflict_detail: Optional[dict] = None
    reason_codes: list = field(default_factory=list)
    evidence_refs: list = field(default_factory=list)


@dataclass
class ReleasePolicyResult:
    release_recommendation: ReleaseRecommendation
    reason_codes: list = field(default_factory=list)
    gate_reason: str = ""
