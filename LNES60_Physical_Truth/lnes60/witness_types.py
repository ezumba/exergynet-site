"""
Physical witness and witness-trust types. Mirrors
LNES60_TRUTH_STATE_SCHEMA.json's physical_witness_state and
witness_trust_state fields, plus the nine-property model in
LNES60_WITNESS_TRUST_MODEL.md.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class WitnessEnvelopeType(str, Enum):
    """Hard-rule discipline (schema witness_envelope_type_discipline):
    every witness object carries this tag. SIMULATED_WITNESS data must
    never be presented as HARDWARE_WITNESS anywhere in this harness."""
    SIMULATED_WITNESS = "SIMULATED_WITNESS"
    HARDWARE_WITNESS = "HARDWARE_WITNESS"  # never produced by this Phase 1 harness


class SensorHealth(str, Enum):
    NOMINAL = "NOMINAL"
    DEGRADED = "DEGRADED"
    FAILED = "FAILED"


@dataclass
class WitnessTrustRecord:
    """The nine trust properties, per LNES60_WITNESS_TRUST_MODEL.md Section 2.
    Time-indexed: bound to a specific reading, not a live-updating pointer
    (Edge Witness integration map Section 2)."""
    witness_id: str
    sensor_id: str                      # 2.1 sensor identity
    aircraft_id: str                    # 2.2 aircraft/component binding
    component_id: str                   # 2.2 aircraft/component binding
    calibration_current: bool           # 2.3 calibration
    calibration_expiry: Optional[str]   # 2.3
    measurement_time: str               # 2.4 freshness (clock component)
    hardware_signature_valid: bool      # 2.5 hardware signature / integrity
    anti_replay_token: str              # 2.6 anti-replay
    measurement_uncertainty: float      # 2.7
    sensor_health: SensorHealth         # 2.8
    measurement_scope: str              # 2.9 -- e.g. "tether.elongation", "inspected_region.corrosion"
    configuration_epoch: str            # which config epoch this reading was taken under
    envelope_type: WitnessEnvelopeType = WitnessEnvelopeType.SIMULATED_WITNESS

    def __post_init__(self):
        if self.envelope_type != WitnessEnvelopeType.SIMULATED_WITNESS:
            raise ValueError(
                "LNES-60 Phase 1 harness only ever produces SIMULATED_WITNESS "
                "records -- HARDWARE_WITNESS is reserved for a future physical "
                "integration phase, explicitly out of scope here (failure "
                "taxonomy category 9: witness-type mislabeling)."
            )


@dataclass
class PhysicalWitness:
    """One physical measurement, linked to its trust record."""
    reading_id: str
    aircraft_id: str
    component_id: str
    measurement_type: str   # e.g. "elongation_pct", "geometry_mm", "hardware_id", "process_temp_c"
    value: object            # numeric or string depending on measurement_type
    trust: WitnessTrustRecord
    replayed_from: Optional[str] = None  # set by the synthetic generator for replay-attack cases


@dataclass
class InvalidatingEvent:
    """An event that can render a previously-GOOD witness stale
    regardless of its clock-freshness (architecture doc Section 6 /
    witness trust model Section 2.4)."""
    event_id: str
    aircraft_id: str
    component_id: Optional[str]
    event_type: str  # "hard_landing" | "component_removal" | "maintenance_action" |
                      # "firmware_update" | "mission_reconfiguration" | "structural_repair" |
                      # "sensor_replacement" | "powertrain_replacement" | "configuration_change"
    event_time: str
    new_configuration_epoch: Optional[str] = None
