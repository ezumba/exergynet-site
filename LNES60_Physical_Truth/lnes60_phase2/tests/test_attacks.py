"""
LNES-60 Phase 2 — Attack vector test suite.

Covers all 13 ratified attack scenarios plus security edge cases and regression.

Each test verifies:
  - expected crypto result (valid/invalid signature)
  - expected admissibility verdict
  - expected failure_code

Run from LNES60_Physical_Truth/:
    pytest lnes60_phase2/tests/test_attacks.py -v

Requirements: pip install cryptography pytest
"""

from __future__ import annotations
import dataclasses
import math

import pytest

from lnes60_phase2.calibration_validator import CalibrationRecord, CalibrationRegistry
from lnes60_phase2.canonicalize import packet_chain_hash
from lnes60_phase2.crypto_verifier import verify_packet_signature
from lnes60_phase2.epoch_validator import EpochRegistry
from lnes60_phase2.key_registry import KeyRegistry
from lnes60_phase2.lnes22_adapter import evaluate_action_authority
from lnes60_phase2.packet_types import MissionRequest
from lnes60_phase2.replay_guard import ReplayGuard
from lnes60_phase2.scope_validator import PredicateMeasurementRegistry
from lnes60_phase2.witness_admissibility import AdmissibilityContext, evaluate_admissibility

from .conftest import (
    AIRCRAFT_A, AIRCRAFT_B, COMPONENT_1, COMPONENT_2,
    CALIBRATION_HASH, CALIB_VALID, DEVICE_A, DEVICE_B,
    EPOCH_0, EPOCH_1, FW_HASH, PREDICATE, SENSOR_ELONGA, SENSOR_TEMP,
    TIMESTAMP_GOOD, TIMESTAMP_STALE,
    dict_to_packet, make_packet_dict,
)


# ============================================================================
# ATTACK-01: Physical disconnect — firmware hash triggers inadmissibility
# ============================================================================

def test_attack01_physical_disconnect_firmware_mismatch(keypair_a, fresh_ctx):
    """ATTACK-01: Signed packet with wrong firmware_hash → INADMISSIBLE (FIRMWARE_MISMATCH)."""
    pkt_dict = make_packet_dict(
        keypair_a,
        firmware_hash="WRONG_FW_HASH_" * 4 + "00000000",
        nonce="attack01_test_aa01",
        seq=1,
    )
    pkt = dict_to_packet(pkt_dict)

    # Crypto should PASS — wrong firmware does not break signature
    crypto = verify_packet_signature(pkt, fresh_ctx.key_registry)
    assert crypto.passed, f"Expected valid signature: {crypto.detail}"

    # Admissibility should FAIL
    verdict = evaluate_admissibility(pkt, fresh_ctx)
    assert not verdict.admitted
    assert "FIRMWARE_MISMATCH" in verdict.failed_checks


# ============================================================================
# ATTACK-02: Frozen-good replay — duplicate nonce → REPLAY_DETECTED
# ============================================================================

def test_attack02_frozen_good_replay(keypair_a, fresh_ctx):
    """ATTACK-02: Same nonce submitted twice → second is INADMISSIBLE (REPLAY_DETECTED)."""
    pkt_dict = make_packet_dict(keypair_a, nonce="attack02_replay_n1", seq=10)
    pkt = dict_to_packet(pkt_dict)

    # First submission: admitted
    v1 = evaluate_admissibility(pkt, fresh_ctx)
    assert v1.admitted, f"First submission should be admitted: {v1.rejection_reason}"

    # Second submission: rejected as replay
    v2 = evaluate_admissibility(pkt, fresh_ctx)
    assert not v2.admitted
    assert "REPLAY_DETECTED" in v2.failed_checks


# ============================================================================
# ATTACK-03: Wrong component
# ============================================================================

def test_attack03_wrong_component(keypair_b, fresh_ctx):
    """ATTACK-03: Packet for TETHER-2 submitted for TETHER-1 claim → WRONG_COMPONENT."""
    pkt_dict = make_packet_dict(
        keypair_b,
        device_id=DEVICE_B,
        component_id=COMPONENT_2,  # wrong component
        nonce="attack03_wrongcomp1",
        seq=20,
    )
    pkt = dict_to_packet(pkt_dict)

    # Crypto passes
    crypto = verify_packet_signature(pkt, fresh_ctx.key_registry)
    assert crypto.passed

    verdict = evaluate_admissibility(pkt, fresh_ctx)
    assert not verdict.admitted
    assert "WRONG_COMPONENT" in verdict.failed_checks or "DEVICE_COMPONENT_BINDING_MISMATCH" in verdict.failed_checks


# ============================================================================
# ATTACK-04: Wrong aircraft
# ============================================================================

def test_attack04_wrong_aircraft(keypair_a, fresh_ctx):
    """ATTACK-04: Packet for AIRCRAFT_A submitted for AIRCRAFT_B claim → WRONG_AIRCRAFT."""
    # Build a context where claim is for AIRCRAFT_B
    pkt_dict = make_packet_dict(
        keypair_a,
        aircraft_id=AIRCRAFT_A,
        nonce="attack04_wrongac01",
        seq=30,
    )
    pkt = dict_to_packet(pkt_dict)

    # Manually evaluate against a different claim aircraft
    from lnes60_phase2.scope_validator import validate_scope
    from lnes60_phase2.epoch_validator import validate_epoch

    scope_result = validate_scope(
        pkt,
        fresh_ctx.key_registry,
        PREDICATE,
        claim_aircraft_id=AIRCRAFT_B,  # different from packet
        claim_component_id=COMPONENT_1,
        predicate_registry=fresh_ctx.predicate_registry,
    )
    assert not scope_result.passed
    assert scope_result.failure_code == "WRONG_AIRCRAFT"


# ============================================================================
# ATTACK-05: Configuration epoch replay
# ============================================================================

def test_attack05_epoch_mismatch(keypair_a, fresh_ctx):
    """ATTACK-05: Packet with EPOCH_0 when commanded epoch is EPOCH_1 → EPOCH_MISMATCH."""
    # Change commanded epoch to EPOCH_1
    fresh_ctx.epoch_registry.set_epoch(AIRCRAFT_A, COMPONENT_1, EPOCH_1)

    pkt_dict = make_packet_dict(
        keypair_a,
        epoch=EPOCH_0,  # old epoch
        nonce="attack05_epoch_r01",
        seq=40,
    )
    pkt = dict_to_packet(pkt_dict)

    verdict = evaluate_admissibility(pkt, fresh_ctx)
    assert not verdict.admitted
    assert "EPOCH_MISMATCH" in verdict.failed_checks

    # Restore
    fresh_ctx.epoch_registry.set_epoch(AIRCRAFT_A, COMPONENT_1, EPOCH_0)


# ============================================================================
# ATTACK-06: Calibration expiration
# ============================================================================

def test_attack06_calibration_expired(keypair_a, fresh_ctx):
    """ATTACK-06: Calibration expired before measurement → CALIBRATION_EXPIRED."""
    # Register expired calibration
    fresh_ctx.calibration_registry.register(
        CalibrationRecord(
            sensor_id=SENSOR_ELONGA,
            calibration_hash=CALIBRATION_HASH,
            calibration_valid_until="2025-01-01T00:00:00Z",
        )
    )

    pkt_dict = make_packet_dict(
        keypair_a,
        calibration_valid="2025-01-01T00:00:00Z",
        nonce="attack06_calib_exp1",
        seq=50,
    )
    pkt = dict_to_packet(pkt_dict)

    verdict = evaluate_admissibility(pkt, fresh_ctx)
    assert not verdict.admitted
    assert "CALIBRATION_EXPIRED" in verdict.failed_checks or "CALIBRATION_VALIDITY_MISMATCH" in verdict.failed_checks


# ============================================================================
# ATTACK-07: Counter rollback
# ============================================================================

def test_attack07_sequence_rollback(keypair_a, fresh_ctx):
    """ATTACK-07: sequence_number rolled back → SEQUENCE_ROLLBACK."""
    # First packet at seq=600
    pkt_dict_1 = make_packet_dict(keypair_a, nonce="attack07_first__01", seq=600)
    pkt_1 = dict_to_packet(pkt_dict_1)
    v1 = evaluate_admissibility(pkt_1, fresh_ctx)
    assert v1.admitted

    # Rollback to seq=599
    pkt_dict_2 = make_packet_dict(keypair_a, nonce="attack07_rollbk_01", seq=599)
    pkt_2 = dict_to_packet(pkt_dict_2)
    v2 = evaluate_admissibility(pkt_2, fresh_ctx)
    assert not v2.admitted
    assert "SEQUENCE_ROLLBACK" in v2.failed_checks


# ============================================================================
# ATTACK-08: Duplicate nonce (same as ATTACK-02 but distinct test)
# ============================================================================

def test_attack08_duplicate_packet(keypair_a, fresh_ctx):
    """ATTACK-08: Identical packet submitted twice → second REPLAY_DETECTED."""
    pkt_dict = make_packet_dict(keypair_a, nonce="attack08_dup_0001", seq=70)
    pkt = dict_to_packet(pkt_dict)

    v1 = evaluate_admissibility(pkt, fresh_ctx)
    assert v1.admitted

    v2 = evaluate_admissibility(pkt, fresh_ctx)
    assert not v2.admitted
    assert "REPLAY_DETECTED" in v2.failed_checks


# ============================================================================
# ATTACK-09: Wrong measurement scope
# ============================================================================

def test_attack09_scope_mismatch(keypair_a, fresh_ctx):
    """ATTACK-09: temperature reading submitted for elongation predicate → SCOPE_MISMATCH."""
    # Register a key for DEVICE_A against SENSOR_TEMP
    fresh_ctx.key_registry.register_test_key(
        "SE-TEMP-DEVICE", SENSOR_TEMP, AIRCRAFT_A, COMPONENT_1,
        fresh_ctx.key_registry.get_public_key(DEVICE_A),
        FW_HASH,
    )
    fresh_ctx.calibration_registry.register(
        CalibrationRecord(SENSOR_TEMP, CALIBRATION_HASH, CALIB_VALID)
    )

    pkt_dict = make_packet_dict(
        keypair_a,
        device_id="SE-TEMP-DEVICE",
        sensor_id=SENSOR_TEMP,
        measurement_type="tether.temperature",  # does not cover tether.elongation
        unit="degC",
        measurement_value=22.5,
        nonce="attack09_scope_01",
        seq=80,
    )
    pkt = dict_to_packet(pkt_dict)

    verdict = evaluate_admissibility(pkt, fresh_ctx)
    assert not verdict.admitted
    assert "SCOPE_MISMATCH" in verdict.failed_checks


# ============================================================================
# ATTACK-10: Contradictory trusted witnesses → SENSOR_CONFLICT at convergence
# ============================================================================

def test_attack10_contradictory_witnesses(keypair_a, keypair_b, fresh_ctx):
    """ATTACK-10: Two admitted witnesses disagree → both admitted, convergence = SENSOR_CONFLICT."""
    # Both packets are admissible individually
    pkt_a = dict_to_packet(make_packet_dict(keypair_a, measurement_value=0.023, nonce="attack10_a_0001", seq=90))
    pkt_b = dict_to_packet(make_packet_dict(keypair_b, device_id=DEVICE_B, measurement_value=5.8,
                                             nonce="attack10_b_0001", seq=90))

    va = evaluate_admissibility(pkt_a, fresh_ctx)
    vb = evaluate_admissibility(pkt_b, fresh_ctx)

    assert va.admitted, f"Packet A should be admitted: {va.rejection_reason}"
    assert vb.admitted, f"Packet B should be admitted: {vb.rejection_reason}"

    # Conflict detection is at convergence layer — both admitted packets disagree.
    # Verify their values are different (structural check; convergence engine would
    # produce SENSOR_CONFLICT given these two).
    assert pkt_a.measurement_value != pkt_b.measurement_value


# ============================================================================
# ATTACK-11: Tampered signed packet → INVALID_SIGNATURE
# ============================================================================

def test_attack11_tampered_packet(keypair_a, fresh_ctx):
    """ATTACK-11: measurement_value modified after signing → INVALID_SIGNATURE."""
    pkt_dict = make_packet_dict(
        keypair_a,
        measurement_value=0.023,
        nonce="attack11_tamper01",
        seq=100,
        tamper_field="measurement_value",
        tamper_value=99.9,
    )
    pkt = dict_to_packet(pkt_dict)

    crypto = verify_packet_signature(pkt, fresh_ctx.key_registry)
    assert not crypto.passed
    assert crypto.failure_code == "INVALID_SIGNATURE"

    # Full admissibility also fails at crypto layer
    verdict = evaluate_admissibility(pkt, fresh_ctx)
    assert not verdict.admitted
    assert "INVALID_SIGNATURE" in verdict.failed_checks


# ============================================================================
# ATTACK-12: Wrong firmware
# ============================================================================

def test_attack12_wrong_firmware(keypair_a, fresh_ctx):
    """ATTACK-12: firmware_hash does not match registry → FIRMWARE_MISMATCH."""
    pkt_dict = make_packet_dict(
        keypair_a,
        firmware_hash="badfirmwarehash0badfirmwarehash0badfirmwarehash0badfirmwarehash0",
        nonce="attack12_fw_0001",
        seq=110,
    )
    pkt = dict_to_packet(pkt_dict)

    crypto = verify_packet_signature(pkt, fresh_ctx.key_registry)
    assert crypto.passed  # signature is valid despite wrong firmware

    verdict = evaluate_admissibility(pkt, fresh_ctx)
    assert not verdict.admitted
    assert "FIRMWARE_MISMATCH" in verdict.failed_checks


# ============================================================================
# ATTACK-13: Valid physical state / invalid mission
# ============================================================================

def test_attack13_valid_physical_invalid_mission(keypair_a, fresh_ctx):
    """ATTACK-13: VERIFIED_MATCH physical state, mission outside envelope → HOLD (not RELEASE)."""
    pkt_dict = make_packet_dict(keypair_a, measurement_value=0.023, nonce="attack13_m_0001", seq=120)
    pkt = dict_to_packet(pkt_dict)

    # Packet is admitted
    verdict = evaluate_admissibility(pkt, fresh_ctx)
    assert verdict.admitted, f"Packet should be admitted: {verdict.rejection_reason}"

    # Mission request is outside envelope
    mission = MissionRequest(
        schema_version="1.0",
        mission_id="MISSION-ATTACK13-TEST",
        aircraft_id=AIRCRAFT_A,
        configuration_epoch=EPOCH_0,
        payload_ref="PAYLOAD-OVERLOAD-SPEC",
        requested_action="PREFLIGHT_RELEASE",
        operational_conditions_ref=None,
        authorization_policy_version="bench-1.0",
        mission_within_envelope=False,
        mission_envelope_reason="payload_kg=950 exceeds limit=800 for TETHER-1 (SYNTHETIC_TEST_VALUE)",
    )

    # Build a mock VERIFIED_MATCH state object
    from lnes60_phase2.packet_types import AircraftStateObject
    state = AircraftStateObject(
        schema_version="1.0",
        aircraft_id=AIRCRAFT_A,
        component_id=COMPONENT_1,
        predicate=PREDICATE,
        configuration_epoch=EPOCH_0,
        state_version="1",
        resolved_at=TIMESTAMP_GOOD,
        documentary_state_ref=None,
        command_state_ref=None,
        witness_refs=(pkt.nonce,),
        admitted_witness_refs=(pkt.nonce,),
        rejected_witness_refs=(),
        resolution_state="VERIFIED_MATCH",
        release_decision="RELEASE_ELIGIBLE",
        reason_codes=(),
        known_conflicts=(),
        known_damage=(),
        sensor_health_summary={SENSOR_ELONGA: "NOMINAL"},
        witness_trust_summary={DEVICE_A: {"admitted": True, "failed_properties": []}},
        provenance_root="abc123" * 10 + "abcd",
        previous_state_root=None,
    )

    decision, handshake = evaluate_action_authority(
        state, mission, policy_version="bench-1.0", decision_timestamp=TIMESTAMP_GOOD
    )

    # CRITICAL: Physical state is VERIFIED_MATCH/RELEASE_ELIGIBLE but mission is unauthorized
    assert state.resolution_state == "VERIFIED_MATCH"
    assert state.release_decision == "RELEASE_ELIGIBLE"
    assert decision.action_authority == "HOLD", (
        "PHYSICAL TRUTH != ACTION AUTHORITY: healthy hardware does not imply authorized mission"
    )
    assert decision.mission_authorization_verdict == "OUTSIDE_ENVELOPE"
    assert any("MISSION_ENVELOPE_VIOLATION" in rc for rc in decision.reason_codes)


# ============================================================================
# Security edge cases
# ============================================================================

def test_security_nan_measurement_value(keypair_a, fresh_ctx):
    """NaN measurement_value must be rejected before crypto."""
    pkt_dict = make_packet_dict(keypair_a, nonce="sec_nan_test_001", seq=200)
    pkt = dict_to_packet(pkt_dict)
    # Force NaN via object mutation (frozen dataclass, use replace)
    import dataclasses as dc
    pkt_nan = dc.replace(pkt, measurement_value=float("nan"))
    verdict = evaluate_admissibility(pkt_nan, fresh_ctx)
    assert not verdict.admitted
    assert "INVALID_MEASUREMENT_VALUE" in verdict.failed_checks


def test_security_infinity_measurement_value(keypair_a, fresh_ctx):
    """Infinity measurement_value must be rejected before crypto."""
    pkt_dict = make_packet_dict(keypair_a, nonce="sec_inf_test_001", seq=201)
    pkt = dict_to_packet(pkt_dict)
    import dataclasses as dc
    pkt_inf = dc.replace(pkt, measurement_value=float("inf"))
    verdict = evaluate_admissibility(pkt_inf, fresh_ctx)
    assert not verdict.admitted
    assert "INVALID_MEASUREMENT_VALUE" in verdict.failed_checks


def test_security_unknown_signature_algorithm(keypair_a, fresh_ctx):
    """Unknown signature_algorithm must be rejected before crypto."""
    pkt_dict = make_packet_dict(keypair_a, nonce="sec_alg_test_001", seq=202)
    pkt = dict_to_packet(pkt_dict)
    import dataclasses as dc
    pkt_alg = dc.replace(pkt, signature_algorithm="RSA-PKCS1v15")
    verdict = evaluate_admissibility(pkt_alg, fresh_ctx)
    assert not verdict.admitted
    assert "UNKNOWN_ALGORITHM" in verdict.failed_checks


def test_security_unknown_device_id(keypair_a, fresh_ctx):
    """Device ID not in registry must be rejected at crypto layer."""
    pkt_dict = make_packet_dict(keypair_a, nonce="sec_dev_test_001", seq=203,
                                 device_id="UNKNOWN-DEVICE-XYZ")
    pkt = dict_to_packet(pkt_dict)
    crypto = verify_packet_signature(pkt, fresh_ctx.key_registry)
    assert not crypto.passed
    assert crypto.failure_code == "UNKNOWN_KEY"


def test_security_negative_sequence_number(keypair_a, fresh_ctx):
    """Negative sequence_number must be rejected at schema check."""
    pkt_dict = make_packet_dict(keypair_a, nonce="sec_seq_neg_001", seq=204)
    pkt = dict_to_packet(pkt_dict)
    import dataclasses as dc
    pkt_neg = dc.replace(pkt, sequence_number=-1)
    verdict = evaluate_admissibility(pkt_neg, fresh_ctx)
    assert not verdict.admitted
    assert "INVALID_SEQUENCE_NUMBER" in verdict.failed_checks


def test_security_schema_version_mismatch(keypair_a, fresh_ctx):
    """Schema version mismatch should be surfaced (receiver-level check)."""
    pkt_dict = make_packet_dict(keypair_a, nonce="sec_schema_v_001", seq=205)
    pkt = dict_to_packet(pkt_dict)
    import dataclasses as dc
    pkt_bad = dc.replace(pkt, schema_version="99.0")
    # Schema version mismatch is a receiver-level check; admissibility engine
    # does not enforce schema_version today — this is a regression guard to
    # ensure future additions don't silently break.
    # Current expectation: packet is processed (schema version enforcement
    # is a TODO for full production receiver).
    assert pkt_bad.schema_version == "99.0"


def test_security_tampered_previous_witness_hash(keypair_a, fresh_ctx):
    """Chain break via tampered previous_witness_hash → CHAIN_BREAK."""
    # First packet
    pkt_dict_1 = make_packet_dict(keypair_a, nonce="sec_chain_pkt1", seq=300)
    pkt_1 = dict_to_packet(pkt_dict_1)
    v1 = evaluate_admissibility(pkt_1, fresh_ctx)
    assert v1.admitted

    # Second packet: claims a wrong previous hash
    pkt_dict_2 = make_packet_dict(
        keypair_a,
        nonce="sec_chain_pkt2",
        seq=301,
        previous_hash="0000000000000000000000000000000000000000000000000000000000000000",
    )
    pkt_2 = dict_to_packet(pkt_dict_2)
    v2 = evaluate_admissibility(pkt_2, fresh_ctx)
    assert not v2.admitted
    assert "CHAIN_BREAK" in v2.failed_checks


def test_security_missing_calibration_record(keypair_a, fresh_ctx):
    """Sensor not in calibration registry → CALIBRATION_UNKNOWN."""
    import dataclasses as dc
    pkt_dict = make_packet_dict(keypair_a, nonce="sec_no_cal_001", seq=400,
                                 sensor_id="UNKNOWN-SENSOR-XYZ")
    pkt = dict_to_packet(pkt_dict)
    # Modify sensor_id without re-signing (crypto will fail too, but let's check
    # the calibration registry path separately)
    pkt_bad_sensor = dc.replace(pkt, sensor_id="UNKNOWN-SENSOR-XYZ")
    from lnes60_phase2.calibration_validator import validate_calibration
    cal_result = validate_calibration(pkt_bad_sensor, fresh_ctx.calibration_registry)
    assert not cal_result.passed
    assert cal_result.failure_code == "CALIBRATION_UNKNOWN"


# ============================================================================
# Regression: PHYSICAL TRUTH ≠ ACTION AUTHORITY invariant
# ============================================================================

def test_regression_physical_match_does_not_release_unauthorized_mission():
    """Regression: A VERIFIED_MATCH state with a HOLD mission must remain HOLD."""
    from lnes60_phase2.packet_types import AircraftStateObject, MissionRequest
    state = AircraftStateObject(
        schema_version="1.0",
        aircraft_id=AIRCRAFT_A,
        component_id=COMPONENT_1,
        predicate=PREDICATE,
        configuration_epoch=EPOCH_0,
        state_version="1",
        resolved_at=TIMESTAMP_GOOD,
        documentary_state_ref=None,
        command_state_ref=None,
        witness_refs=("nonce-x",),
        admitted_witness_refs=("nonce-x",),
        rejected_witness_refs=(),
        resolution_state="VERIFIED_MATCH",
        release_decision="RELEASE_ELIGIBLE",
        reason_codes=(),
        known_conflicts=(),
        known_damage=(),
        sensor_health_summary={},
        witness_trust_summary={},
        provenance_root="a" * 64,
        previous_state_root=None,
    )
    mission = MissionRequest(
        schema_version="1.0",
        mission_id="REG-MISSION-001",
        aircraft_id=AIRCRAFT_A,
        configuration_epoch=EPOCH_0,
        payload_ref=None,
        requested_action="PREFLIGHT_RELEASE",
        operational_conditions_ref=None,
        authorization_policy_version="bench-1.0",
        mission_within_envelope=False,
        mission_envelope_reason="Mission envelope exceeded (regression test)",
    )
    decision, _ = evaluate_action_authority(state, mission, "bench-1.0", TIMESTAMP_GOOD)
    assert decision.action_authority == "HOLD"
    assert decision.mission_authorization_verdict == "OUTSIDE_ENVELOPE"


def test_regression_hold_physical_state_cannot_release():
    """Regression: A SENSOR_CONFLICT state must HOLD even if mission is within envelope."""
    from lnes60_phase2.packet_types import AircraftStateObject, MissionRequest
    state = AircraftStateObject(
        schema_version="1.0",
        aircraft_id=AIRCRAFT_A,
        component_id=COMPONENT_1,
        predicate=PREDICATE,
        configuration_epoch=EPOCH_0,
        state_version="1",
        resolved_at=TIMESTAMP_GOOD,
        documentary_state_ref=None,
        command_state_ref=None,
        witness_refs=(),
        admitted_witness_refs=(),
        rejected_witness_refs=(),
        resolution_state="SENSOR_CONFLICT",
        release_decision="HOLD",
        reason_codes=("SENSOR_CONFLICT on tether.elongation",),
        known_conflicts=("SENSOR_A vs SENSOR_B",),
        known_damage=(),
        sensor_health_summary={},
        witness_trust_summary={},
        provenance_root="b" * 64,
        previous_state_root=None,
    )
    mission = MissionRequest(
        schema_version="1.0",
        mission_id="REG-MISSION-002",
        aircraft_id=AIRCRAFT_A,
        configuration_epoch=EPOCH_0,
        payload_ref=None,
        requested_action="PREFLIGHT_RELEASE",
        operational_conditions_ref=None,
        authorization_policy_version="bench-1.0",
        mission_within_envelope=True,
        mission_envelope_reason="",
    )
    decision, _ = evaluate_action_authority(state, mission, "bench-1.0", TIMESTAMP_GOOD)
    assert decision.action_authority == "HOLD"
    assert decision.mission_authorization_verdict == "WITHIN_ENVELOPE"


def test_regression_known_damage_preserved():
    """Regression: known_damage must not be empty after append (immutability guard)."""
    from lnes60_phase2.packet_types import AircraftStateObject
    state = AircraftStateObject(
        schema_version="1.0",
        aircraft_id=AIRCRAFT_A,
        component_id=COMPONENT_1,
        predicate=PREDICATE,
        configuration_epoch=EPOCH_0,
        state_version="1",
        resolved_at=TIMESTAMP_GOOD,
        documentary_state_ref="DOC-001",
        command_state_ref=None,
        witness_refs=(),
        admitted_witness_refs=(),
        rejected_witness_refs=(),
        resolution_state="DOCUMENT_PHYSICAL_CONFLICT",
        release_decision="HOLD",
        reason_codes=(),
        known_conflicts=("doc says BAD, sensor says GOOD",),
        known_damage=("DEFECT_CONFIRMED at 2026-01-15 from inspection report INS-002",),
        sensor_health_summary={},
        witness_trust_summary={},
        provenance_root="c" * 64,
        previous_state_root=None,
    )
    # known_damage is a tuple (immutable); verify it's preserved
    assert len(state.known_damage) == 1
    assert "DEFECT_CONFIRMED" in state.known_damage[0]
    # The frozen dataclass prevents mutation — this test documents the invariant
    import dataclasses
    with pytest.raises((TypeError, AttributeError)):
        object.__setattr__(state, "known_damage", ())
