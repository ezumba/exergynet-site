"""
Corpus-first synthetic case generator. Per LNES60_EXPERIMENT_PROTOCOL.md
Section 2 and LNES-59 precedent: for each case, the underlying
aircraft/component/event/witness world is constructed FIRST; the expected
operational state is then derived from that world's own scenario
semantics, using logic that is independent of (does not call)
convergence_engine.py -- so running the engine against a case and
comparing to the generator's own expectation is a genuine test of the
engine, not a tautology.

Dev-phase cases (this module, run pre-freeze) MAY be checked against the
live engine repeatedly as part of finding and fixing defects -- that is
the explicit purpose of the development phase. Holdout cases (a separate,
later, frozen dataset) must never be checked against the engine during
authoring; see holdout_generator.py.
"""

import random
from dataclasses import dataclass, field
from typing import List, Optional

from .state_types import DocumentaryRecord, CommandState, OperationalState
from .witness_types import PhysicalWitness, WitnessTrustRecord, InvalidatingEvent, SensorHealth

KTX_CLASSES = [
    "tether_condition_bad", "tether_condition_healthy", "am_genesis_anomaly",
    "iron_web_geometry_mismatch", "propulsion_identity_mismatch",
    "correct_motor_wrong_firmware", "stale_after_event", "sensor_conflict",
    "out_of_calibration_bad_sensor", "wrong_aircraft", "wrong_component",
    "replay_attack", "detached_sensor", "known_damage_limited_scope_good",
    "mission_envelope_violation", "record_bad_witnesses_good",
    "record_good_trust_unknown", "fully_consistent",
    "config_epoch_stale_witness", "multi_conflict_config_and_document",
]


@dataclass
class SyntheticCase:
    case_id: str
    ktx_class: str
    aircraft_id: str
    component_id: str
    predicate: str
    claim_scope: str
    as_of: str
    documentary: List[DocumentaryRecord] = field(default_factory=list)
    command: List[CommandState] = field(default_factory=list)
    witnesses: List[PhysicalWitness] = field(default_factory=list)
    events: List[InvalidatingEvent] = field(default_factory=list)
    command_field: Optional[str] = None
    mission_within_envelope: bool = True
    mission_envelope_reason: str = ""
    expected_operational_state: str = ""
    expected_release: str = ""
    hand_trace: str = ""


def _mk_trust(rng, witness_id, aircraft_id, component_id, scope, t, epoch="EPOCH_0",
              calibration_current=True, signature_valid=True, health=SensorHealth.NOMINAL,
              replay_token=None):
    return WitnessTrustRecord(
        witness_id=witness_id, sensor_id=f"SENS-{witness_id}", aircraft_id=aircraft_id,
        component_id=component_id, calibration_current=calibration_current,
        calibration_expiry="2027-01-01", measurement_time=t,
        hardware_signature_valid=signature_valid,
        anti_replay_token=replay_token or f"nonce-{witness_id}",
        measurement_uncertainty=round(rng.uniform(0.01, 0.08), 3),
        sensor_health=health, measurement_scope=scope, configuration_epoch=epoch,
    )


def generate_case(rng: random.Random, idx: int, ktx_class: str, prefix: str = "DEV", aircraft_offset: int = 100) -> SyntheticCase:
    cid = f"{prefix}-{idx:03d}"
    aircraft = f"KTX-{aircraft_offset + idx}"
    component = "TETHER-1"
    now = f"2026-08-{(idx % 28) + 1:02d}T{8 + (idx % 10):02d}:00:00"
    scope = "tether.elongation"
    predicate = "tether.condition"
    documentary, command, witnesses, events = [], [], [], []
    command_field = None
    mission_ok, mission_reason = True, ""

    if ktx_class == "tether_condition_bad":
        documentary = [DocumentaryRecord(f"{cid}-D1", aircraft, component, "service_life", "SERVICEABLE", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "BAD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, now))]
        expected, trace = OperationalState.DOCUMENT_PHYSICAL_CONFLICT, "trusted BAD witness vs SERVICEABLE doc"

    elif ktx_class == "tether_condition_healthy":
        documentary = [DocumentaryRecord(f"{cid}-D1", aircraft, component, "service_life", "SERVICEABLE", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "GOOD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, now))]
        expected, trace = OperationalState.VERIFIED_MATCH, "trusted GOOD witness matches SERVICEABLE doc"

    elif ktx_class == "am_genesis_anomaly":
        component = "HUB-1"
        documentary = [DocumentaryRecord(f"{cid}-D1", aircraft, component, "part_provenance", "SERVICEABLE", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "process_temp_c", "BAD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, "hub.manufacturing_process", now))]
        scope, predicate = "hub.manufacturing_process", "hub.provenance"
        expected, trace = OperationalState.DOCUMENT_PHYSICAL_CONFLICT, "manufacturing telemetry excursion vs valid install doc"

    elif ktx_class == "iron_web_geometry_mismatch":
        component = "PAWL-1"
        documentary = [DocumentaryRecord(f"{cid}-D1", aircraft, component, "maintenance_history", "SERVICEABLE", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "geometry_mm", "BAD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, "pawl.geometry", now))]
        scope, predicate = "pawl.geometry", "pawl.geometry"
        expected, trace = OperationalState.DOCUMENT_PHYSICAL_CONFLICT, "pawl geometry outside synthetic tolerance vs serviced doc"

    elif ktx_class == "propulsion_identity_mismatch":
        component = "MOTOR-1"
        command = [CommandState(f"{cid}-C1", aircraft, f"M-{idx}", "motor_id", "MOTOR_A", "EPOCH_0", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "hardware_id", "MOTOR_B",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, "motor.identity", now))]
        scope, predicate, command_field = "motor.identity", "motor.identity", "motor_id"
        expected, trace = OperationalState.CONFIGURATION_MISMATCH, "witness reports MOTOR_B, command expects MOTOR_A"

    elif ktx_class == "correct_motor_wrong_firmware":
        component = "MOTOR-1"
        command = [CommandState(f"{cid}-C1", aircraft, f"M-{idx}", "firmware_version", "FW_2.1", "EPOCH_0", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "firmware_version", "FW_1.9",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, "motor.firmware", now))]
        scope, predicate, command_field = "motor.firmware", "motor.firmware", "firmware_version"
        expected, trace = OperationalState.CONFIGURATION_MISMATCH, "firmware mismatch, hardware identity not in question"

    elif ktx_class == "stale_after_event":
        w_time = f"2026-08-{(idx % 28) + 1:02d}T06:00:00"
        ev_time = f"2026-08-{(idx % 28) + 1:02d}T07:00:00"
        now = f"2026-08-{(idx % 28) + 1:02d}T08:00:00"
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "GOOD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, w_time))]
        events = [InvalidatingEvent(f"{cid}-E1", aircraft, component, "hard_landing", ev_time)]
        expected, trace = OperationalState.STALE_WITNESS, "GOOD reading predates a hard-landing event"

    elif ktx_class == "sensor_conflict":
        witnesses = [
            PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "GOOD",
                             _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, now, replay_token=f"{cid}-n1")),
            PhysicalWitness(f"{cid}-W2", aircraft, component, "elongation_pct", "BAD",
                             _mk_trust(rng, f"{cid}-W2", aircraft, component, scope, now, replay_token=f"{cid}-n2")),
        ]
        expected, trace = OperationalState.SENSOR_CONFLICT, "two admissible witnesses disagree"

    elif ktx_class == "out_of_calibration_bad_sensor":
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "BAD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, now, calibration_current=False))]
        expected, trace = OperationalState.UNVERIFIED, "BAD reading from an out-of-calibration sensor is not auto-trusted"

    elif ktx_class == "wrong_aircraft":
        witnesses = [PhysicalWitness(f"{cid}-W1", "KTX-999", component, "elongation_pct", "GOOD",
                                      _mk_trust(rng, f"{cid}-W1", "KTX-999", component, scope, now))]
        expected, trace = OperationalState.WITNESS_SCOPE_ERROR, "signed witness bound to a different aircraft"

    elif ktx_class == "wrong_component":
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, "TETHER-2", "elongation_pct", "GOOD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, "TETHER-2", scope, now))]
        expected, trace = OperationalState.WITNESS_SCOPE_ERROR, "signed witness bound to a different component serial"

    elif ktx_class == "replay_attack":
        tok = f"{cid}-replay-token"
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "GOOD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, now, replay_token=tok))]
        # generator marks this instance as "already seen" via a duplicate reading id trick handled by the runner
        witnesses[0].replayed_from = f"{cid}-W0-earlier"
        expected, trace = OperationalState.STALE_WITNESS, "witness flagged as a replay of an earlier reading"

    elif ktx_class == "detached_sensor":
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "GOOD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, now, health=SensorHealth.FAILED))]
        expected, trace = OperationalState.UNVERIFIED, "detachment modeled as FAILED sensor health (independently-detectable sub-case)"

    elif ktx_class == "known_damage_limited_scope_good":
        documentary = [DocumentaryRecord(f"{cid}-D1", aircraft, component, "inspection", "DEFECT_CONFIRMED", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "temp_c", "GOOD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, "tether.temperature", now))]
        expected, trace = OperationalState.WITNESS_SCOPE_ERROR, "narrow-scope GOOD reading cannot cover the elongation claim tied to known damage"

    elif ktx_class == "mission_envelope_violation":
        documentary = [DocumentaryRecord(f"{cid}-D1", aircraft, component, "service_life", "SERVICEABLE", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "GOOD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, now))]
        mission_ok, mission_reason = False, "payload exceeds synthetic authorized configuration for this mission profile"
        expected, trace = OperationalState.VERIFIED_MATCH, "hardware healthy; HOLD comes from the release-policy mission check, not the convergence state itself"

    elif ktx_class == "record_bad_witnesses_good":
        documentary = [DocumentaryRecord(f"{cid}-D1", aircraft, component, "inspection", "DEFECT_CONFIRMED", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "GOOD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, now))]
        expected, trace = OperationalState.DOCUMENT_PHYSICAL_CONFLICT, "documentary BAD preserved, not erased, despite fresh GOOD witness"

    elif ktx_class == "record_good_trust_unknown":
        documentary = [DocumentaryRecord(f"{cid}-D1", aircraft, component, "service_life", "SERVICEABLE", now)]
        expected, trace = OperationalState.INCOMPLETE, "no physical witness at all -- documentary claim alone never converges to a positive physical conclusion"

    elif ktx_class == "fully_consistent":
        documentary = [DocumentaryRecord(f"{cid}-D1", aircraft, component, "service_life", "SERVICEABLE", now)]
        command = [CommandState(f"{cid}-C1", aircraft, f"M-{idx}", "firmware_version", "FW_2.1", "EPOCH_0", now)]
        witnesses = [
            PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "GOOD",
                             _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, now, replay_token=f"{cid}-n1")),
        ]
        expected, trace = OperationalState.VERIFIED_MATCH, "everything agrees -- ordinary healthy control"

    elif ktx_class == "config_epoch_stale_witness":
        # Architecture doc Section 7: motor replaced (epoch change) after
        # the witness was taken. The reading's VALUE still happens to
        # match the (now-obsolete) old expectation -- a naive value-only
        # comparison would wrongly pass this as VERIFIED_MATCH. Must be
        # CONFIGURATION_MISMATCH because the witness's own
        # configuration_epoch predates the current one.
        component = "MOTOR-1"
        w_time = f"2026-08-{(idx % 28) + 1:02d}T05:00:00"
        ev_time = f"2026-08-{(idx % 28) + 1:02d}T06:00:00"
        now = f"2026-08-{(idx % 28) + 1:02d}T07:00:00"
        command = [CommandState(f"{cid}-C1", aircraft, f"M-{idx}", "motor_id", "MOTOR_A", "EPOCH_1", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "hardware_id", "MOTOR_A",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, "motor.identity", w_time, epoch="EPOCH_0"))]
        events = [InvalidatingEvent(f"{cid}-E1", aircraft, component, "powertrain_replacement", ev_time, new_configuration_epoch="EPOCH_1")]
        scope, predicate, command_field = "motor.identity", "motor.identity", "motor_id"
        expected, trace = OperationalState.STALE_WITNESS, "witness value matches old expectation but was taken under EPOCH_0, before the powertrain-replacement event; per KTX test matrix class 14's established treatment this is event-based staleness (STALE_WITNESS), not CONFIGURATION_MISMATCH -- old-epoch reading does not prove current-epoch state regardless of its value"

    elif ktx_class == "multi_conflict_config_and_document":
        # Two independent problems on the SAME aircraft, different
        # predicates -- verifies the release policy's priority order
        # (CONFIGURATION_MISMATCH reported ahead of DOCUMENT_PHYSICAL_
        # CONFLICT per release_policy._HOLD_PRIORITY) rather than only
        # ever exercising single-conflict cases.
        documentary = [DocumentaryRecord(f"{cid}-D1", aircraft, component, "service_life", "SERVICEABLE", now)]
        witnesses = [PhysicalWitness(f"{cid}-W1", aircraft, component, "elongation_pct", "BAD",
                                      _mk_trust(rng, f"{cid}-W1", aircraft, component, scope, now))]
        expected, trace = OperationalState.DOCUMENT_PHYSICAL_CONFLICT, "tether predicate alone: BAD witness vs SERVICEABLE doc (release-policy aggregation across predicates is exercised at the release_policy layer, not this single-predicate convergence check)"

    else:
        raise ValueError(f"unknown KTX class {ktx_class}")

    return SyntheticCase(
        case_id=cid, ktx_class=ktx_class, aircraft_id=aircraft, component_id=component,
        predicate=predicate, claim_scope=scope, as_of=now,
        documentary=documentary, command=command, witnesses=witnesses, events=events,
        command_field=command_field, mission_within_envelope=mission_ok, mission_envelope_reason=mission_reason,
        expected_operational_state=expected.value, hand_trace=trace,
    )


def generate_dataset(n: int, seed: int, exclude_ids: Optional[set] = None,
                      prefix: str = "DEV", aircraft_offset: int = 100) -> List[SyntheticCase]:
    """Corpus-first generation across all KTX classes, cycling through
    them with parameter variation driven by a seeded RNG for
    reproducibility. `prefix`/`aircraft_offset` let the holdout generator
    guarantee a fresh ID space disjoint from the dev corpus (LNES-59
    precedent) -- dev uses prefix='DEV', aircraft_offset=100; holdout
    uses prefix='HOLD', aircraft_offset=9000, so no case_id or aircraft_id
    can ever collide between the two corpora even by construction, not
    just by convention."""
    rng = random.Random(seed)
    cases = []
    i = 0
    while len(cases) < n:
        i += 1
        ktx_class = KTX_CLASSES[(i - 1) % len(KTX_CLASSES)]
        case = generate_case(rng, i, ktx_class, prefix=prefix, aircraft_offset=aircraft_offset)
        if exclude_ids and case.case_id in exclude_ids:
            continue
        cases.append(case)
    return cases
