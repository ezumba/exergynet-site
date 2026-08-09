"""
Deterministic-engine regression tests, covering KTX test matrix classes
A-R (LNES60_KTX_TEST_MATRIX.md). Run with:
  cd LNES60_Physical_Truth && python -m pytest lnes60/tests/ -v
No model/LLM required -- these test the convergence engine, witness
validator, temporal resolver, and release policy directly.
"""

import pytest

from lnes60.state_types import DocumentaryRecord, CommandState, OperationalState, ReleaseRecommendation
from lnes60.witness_types import PhysicalWitness, WitnessTrustRecord, SensorHealth
from lnes60.convergence_engine import converge, ConvergenceQuery
from lnes60.release_policy import evaluate_release, MissionEnvelopeCheck

AIRCRAFT = "KTX-001"
NOW = "2026-08-08T12:00:00"


def trust(witness_id, sensor_id="S1", component_id="TETHER-1", scope="tether.elongation",
          measurement_time=NOW, calibration_current=True, calibration_expiry="2027-01-01",
          hardware_signature_valid=True, anti_replay_token=None, uncertainty=0.02,
          health=SensorHealth.NOMINAL, epoch="EPOCH_0", aircraft_id=AIRCRAFT):
    return WitnessTrustRecord(
        witness_id=witness_id, sensor_id=sensor_id, aircraft_id=aircraft_id,
        component_id=component_id, calibration_current=calibration_current,
        calibration_expiry=calibration_expiry, measurement_time=measurement_time,
        hardware_signature_valid=hardware_signature_valid,
        anti_replay_token=anti_replay_token or f"nonce-{witness_id}",
        measurement_uncertainty=uncertainty, sensor_health=health,
        measurement_scope=scope, configuration_epoch=epoch,
    )


def witness(reading_id, value, component_id="TETHER-1", **trust_kwargs):
    t = trust(reading_id, component_id=component_id, **trust_kwargs)
    return PhysicalWitness(reading_id=reading_id, aircraft_id=AIRCRAFT, component_id=component_id,
                            measurement_type="condition", value=value, trust=t)


def doc(record_id, claim, event_time=NOW, component_id="TETHER-1", supersedes=None, effective_until=None):
    return DocumentaryRecord(record_id=record_id, aircraft_id=AIRCRAFT, component_id=component_id,
                              record_type="condition", claim=claim, event_time=event_time,
                              supersedes=supersedes, effective_until=effective_until)


def run(documentary, command, witnesses, events, predicate="tether.condition",
        scope="tether.elongation", component_id="TETHER-1", command_field=None, as_of=NOW):
    q = ConvergenceQuery(
        aircraft_id=AIRCRAFT, component_id=component_id, predicate=predicate,
        claim_scope=scope, as_of=as_of,
        documentary_record_ids=[d.record_id for d in documentary],
        command_state_field=command_field,
        witness_ids=[w.reading_id for w in witnesses],
    )
    return converge(q, documentary, command, witnesses, events, set())


# --- A/B: tensile tether condition ---

def test_a_document_physical_conflict_bad_witness_good_doc():
    d = [doc("D1", "SERVICEABLE")]
    w = [witness("W1", "BAD")]
    r = run(d, [], w, [])
    assert r.operational_state == OperationalState.DOCUMENT_PHYSICAL_CONFLICT


def test_b_verified_match_healthy():
    d = [doc("D1", "SERVICEABLE")]
    w = [witness("W1", "GOOD")]
    r = run(d, [], w, [])
    assert r.operational_state == OperationalState.VERIFIED_MATCH


# --- E/F: configuration mismatch ---

def test_e_configuration_mismatch_wrong_motor():
    cmd = [CommandState("C1", AIRCRAFT, "M1", "motor_id", "MOTOR_A", "EPOCH_0", NOW)]
    w = [witness("W1", "MOTOR_B", component_id="MOTOR-1", scope="motor.identity")]
    r = run([], cmd, w, [], predicate="motor.identity", scope="motor.identity",
            component_id="MOTOR-1", command_field="motor_id")
    assert r.operational_state == OperationalState.CONFIGURATION_MISMATCH


def test_f_correct_motor_wrong_firmware():
    cmd = [CommandState("C1", AIRCRAFT, "M1", "firmware_version", "FW_2.1", "EPOCH_0", NOW)]
    w = [witness("W1", "FW_1.9", component_id="MOTOR-1", scope="motor.firmware")]
    r = run([], cmd, w, [], predicate="motor.firmware", scope="motor.firmware",
            component_id="MOTOR-1", command_field="firmware_version")
    assert r.operational_state == OperationalState.CONFIGURATION_MISMATCH


# --- G: stale after event ---

def test_g_stale_witness_after_hard_landing():
    from lnes60.witness_types import InvalidatingEvent
    w = [witness("W1", "GOOD", measurement_time="2026-08-08T10:00:00")]
    events = [InvalidatingEvent("EV1", AIRCRAFT, "TETHER-1", "hard_landing", "2026-08-08T11:00:00")]
    r = run([], [], w, events, as_of="2026-08-08T11:30:00")
    assert r.operational_state == OperationalState.STALE_WITNESS


# --- H: sensor conflict ---

def test_h_two_valid_sensors_disagree():
    w = [
        witness("W1", "GOOD", sensor_id="S1", anti_replay_token="n1"),
        witness("W2", "BAD", sensor_id="S2", anti_replay_token="n2"),
    ]
    r = run([], [], w, [])
    assert r.operational_state == OperationalState.SENSOR_CONFLICT


# --- I: out-of-calibration bad sensor ---

def test_i_out_of_calibration_not_auto_trusted():
    w = [witness("W1", "BAD", calibration_current=False)]
    r = run([], [], w, [])
    assert r.operational_state == OperationalState.UNVERIFIED


# --- J/K: wrong aircraft / wrong component ---

def test_j_wrong_aircraft_scope_error():
    w = [witness("W1", "GOOD", aircraft_id="KTX-999")]
    r = run([], [], w, [])
    assert r.operational_state == OperationalState.WITNESS_SCOPE_ERROR


def test_k_wrong_component_scope_error():
    w = [witness("W1", "GOOD", component_id="TETHER-2")]
    r = run([], [], w, [], component_id="TETHER-1")
    assert r.operational_state == OperationalState.WITNESS_SCOPE_ERROR


# --- L: replay ---

def test_l_replay_rejected():
    from lnes60.witness_types import InvalidatingEvent
    w1 = witness("W1", "GOOD", anti_replay_token="dup-token")
    r1 = run([], [], [w1], [])
    assert r1.operational_state == OperationalState.VERIFIED_MATCH  # first use is fine

    w2 = witness("W2", "GOOD", anti_replay_token="dup-token")  # same token, replayed
    q = ConvergenceQuery(AIRCRAFT, "TETHER-1", "tether.condition", "tether.elongation", NOW,
                          [], None, ["W2"])
    r2 = converge(q, [], [], [w2], [], {"dup-token"})
    assert r2.operational_state == OperationalState.STALE_WITNESS


# --- M: detached sensor (independently detectable sub-case: FAILED health) ---

def test_m_detached_sensor_independently_detectable():
    w = [witness("W1", "GOOD", health=SensorHealth.FAILED)]
    r = run([], [], w, [])
    assert r.operational_state == OperationalState.UNVERIFIED


# --- N: known damage + limited-scope good sensor cannot erase it ---

def test_n_limited_scope_cannot_erase_known_damage():
    d = [doc("D1", "DEFECT_CONFIRMED")]
    w = [witness("W1", "GOOD", scope="tether.temperature")]  # narrow scope, doesn't cover elongation claim
    r = run(d, [], w, [], scope="tether.elongation")
    assert r.operational_state == OperationalState.WITNESS_SCOPE_ERROR


# --- P: record says BAD, witnesses say GOOD -- conflict preserved ---

def test_p_conflict_preserved_not_erased():
    d = [doc("D1", "DEFECT_CONFIRMED")]
    w = [witness("W1", "GOOD")]
    r = run(d, [], w, [])
    assert r.operational_state == OperationalState.DOCUMENT_PHYSICAL_CONFLICT
    # historical record itself must be untouched
    assert d[0].claim == "DEFECT_CONFIRMED"


# --- Q: service record GOOD, witness trust unknown -> INCOMPLETE ---

def test_q_no_witness_no_conclusion():
    d = [doc("D1", "SERVICEABLE")]
    r = run(d, [], [], [])
    assert r.operational_state == OperationalState.INCOMPLETE


# --- R: everything consistent -> release eligible via policy ---

def test_r_full_release_eligible():
    d = [doc("D1", "SERVICEABLE")]
    w = [witness("W1", "GOOD")]
    r = run(d, [], w, [])
    assert r.operational_state == OperationalState.VERIFIED_MATCH
    policy = evaluate_release([r], MissionEnvelopeCheck(True))
    assert policy.release_recommendation == ReleaseRecommendation.RELEASE_ELIGIBLE


def test_o_mission_envelope_violation_holds_even_if_hardware_healthy():
    d = [doc("D1", "SERVICEABLE")]
    w = [witness("W1", "GOOD")]
    r = run(d, [], w, [])
    policy = evaluate_release([r], MissionEnvelopeCheck(False, "payload exceeds authorized configuration"))
    assert policy.release_recommendation == ReleaseRecommendation.HOLD


def test_config_epoch_stale_witness_not_naive_value_match():
    """Architecture doc Section 7 / KTX test matrix class 14: a witness
    whose VALUE still matches the old expectation, taken under a
    since-superseded configuration epoch, must not be naively accepted
    as current-epoch VERIFIED_MATCH just because the value happens to
    match. Per the already-established KTX class 14 treatment (a
    same-mechanism case: post-change reading validity), this resolves to
    STALE_WITNESS -- the powertrain-replacement event invalidates the
    reading exactly like any other invalidating event (temporal_resolver
    treats a configuration-epoch-changing event as one more instance of
    event-based invalidation, not a separate mechanism), NOT
    CONFIGURATION_MISMATCH (which is reserved for a witness that is
    itself current/admissible but whose VALUE disagrees with command
    state)."""
    from lnes60.witness_types import InvalidatingEvent
    cmd = [CommandState("C1", AIRCRAFT, "M1", "motor_id", "MOTOR_A", "EPOCH_1", "2026-08-08T07:00:00")]
    w = [witness("W1", "MOTOR_A", component_id="MOTOR-1", scope="motor.identity",
                  measurement_time="2026-08-08T05:00:00", epoch="EPOCH_0")]
    events = [InvalidatingEvent("E1", AIRCRAFT, "MOTOR-1", "powertrain_replacement",
                                 "2026-08-08T06:00:00", new_configuration_epoch="EPOCH_1")]
    r = run([], cmd, w, events, predicate="motor.identity", scope="motor.identity",
            component_id="MOTOR-1", command_field="motor_id", as_of="2026-08-08T07:00:00")
    assert r.operational_state == OperationalState.STALE_WITNESS


def test_release_policy_priority_order_across_predicates():
    """Release policy must surface CONFIGURATION_MISMATCH ahead of
    DOCUMENT_PHYSICAL_CONFLICT when both occur across different
    predicates for the same aircraft (documented priority order, not
    arbitrary first-seen)."""
    d = [doc("D1", "SERVICEABLE")]
    w_tether = [witness("W1", "BAD")]
    tether_result = run(d, [], w_tether, [])
    assert tether_result.operational_state == OperationalState.DOCUMENT_PHYSICAL_CONFLICT

    cmd = [CommandState("C1", AIRCRAFT, "M1", "motor_id", "MOTOR_A", "EPOCH_0", NOW)]
    w_motor = [witness("W2", "MOTOR_B", component_id="MOTOR-1", scope="motor.identity")]
    motor_result = run([], cmd, w_motor, [], predicate="motor.identity", scope="motor.identity",
                        component_id="MOTOR-1", command_field="motor_id")
    assert motor_result.operational_state == OperationalState.CONFIGURATION_MISMATCH

    policy = evaluate_release([tether_result, motor_result], MissionEnvelopeCheck(True))
    assert policy.release_recommendation == ReleaseRecommendation.HOLD
    assert any("CONFIGURATION_MISMATCH" in c for c in policy.reason_codes)


def test_historical_truth_never_mutated_by_conflict():
    """Regression guard for architecture doc Section 4 / failure taxonomy
    category 3 (historical erasure)."""
    d = doc("D1", "DEFECT_CONFIRMED")
    original_claim = d.claim
    w = [witness("W1", "GOOD")]
    run([d], [], w, [])
    assert d.claim == original_claim  # convergence must never mutate the record
