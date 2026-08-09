"""
LNES-60 Phase 2 test configuration and shared fixtures.

All tests use TEST-KEY-ONLY ephemeral keys and SIMULATED_WITNESS data.
Private keys exist only in memory during test execution.
"""
from __future__ import annotations
import dataclasses
import sys
import os

import pytest

# Ensure LNES60_Physical_Truth is on the path when running pytest from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from lnes60_phase2.calibration_validator import CalibrationRecord, CalibrationRegistry
from lnes60_phase2.canonicalize import packet_chain_hash
from lnes60_phase2.crypto_verifier import generate_test_keypair, sign_packet_dict
from lnes60_phase2.epoch_validator import EpochRegistry
from lnes60_phase2.key_registry import KeyRegistry
from lnes60_phase2.packet_types import WitnessPacket
from lnes60_phase2.replay_guard import ReplayGuard
from lnes60_phase2.scope_validator import PredicateMeasurementRegistry
from lnes60_phase2.witness_admissibility import AdmissibilityContext


# ---------------------------------------------------------------------------
# Shared constants — ENGINEERING_ENVELOPE / SYNTHETIC_TEST_VALUE
# ---------------------------------------------------------------------------

AIRCRAFT_A = "KTX-9001"
AIRCRAFT_B = "KTX-9002"
COMPONENT_1 = "TETHER-1"
COMPONENT_2 = "TETHER-2"
SENSOR_ELONGA = "ELONGATION-SENSOR-A"
SENSOR_TEMP = "TEMPERATURE-SENSOR-A"
DEVICE_A = "SE-DEVICE-001"
DEVICE_B = "SE-DEVICE-002"
EPOCH_0 = "EPOCH_0"
EPOCH_1 = "EPOCH_1"
CALIBRATION_HASH = "a1b2c3d4" * 8
CALIB_VALID = "2027-01-01T00:00:00Z"
FW_HASH = "d4e5f6a1" * 8
TIMESTAMP_GOOD = "2026-08-09T14:30:00Z"
TIMESTAMP_STALE = "2024-01-01T00:00:00Z"
PREDICATE = "tether.elongation"


@pytest.fixture(scope="session")
def keypair_a():
    """TEST KEY / SIMULATED SIGNER — ephemeral Ed25519 keypair for DEVICE_A."""
    return generate_test_keypair()


@pytest.fixture(scope="session")
def keypair_b():
    """TEST KEY / SIMULATED SIGNER — ephemeral Ed25519 keypair for DEVICE_B."""
    return generate_test_keypair()


@pytest.fixture
def fresh_ctx(keypair_a, keypair_b):
    """Fresh admissibility context for each test — no carry-over state."""
    priv_a, pub_a = keypair_a
    priv_b, pub_b = keypair_b

    key_reg = KeyRegistry()
    key_reg.register_test_key(DEVICE_A, SENSOR_ELONGA, AIRCRAFT_A, COMPONENT_1, pub_a, FW_HASH)
    key_reg.register_test_key(DEVICE_B, SENSOR_ELONGA, AIRCRAFT_A, COMPONENT_1, pub_b, FW_HASH)

    cal_reg = CalibrationRegistry()
    cal_reg.register(CalibrationRecord(SENSOR_ELONGA, CALIBRATION_HASH, CALIB_VALID))
    cal_reg.register(CalibrationRecord(SENSOR_TEMP, CALIBRATION_HASH, CALIB_VALID))

    epoch_reg = EpochRegistry()
    epoch_reg.set_epoch(AIRCRAFT_A, COMPONENT_1, EPOCH_0)

    pred_reg = PredicateMeasurementRegistry()
    pred_reg.register(PREDICATE, {"tether.elongation", "tether.strain"})

    return AdmissibilityContext(
        key_registry=key_reg,
        replay_guard=ReplayGuard(),
        calibration_registry=cal_reg,
        epoch_registry=epoch_reg,
        predicate_registry=pred_reg,
        claim_aircraft_id=AIRCRAFT_A,
        claim_component_id=COMPONENT_1,
        predicate=PREDICATE,
    )


def make_packet_dict(
    keypair,
    device_id=DEVICE_A,
    aircraft_id=AIRCRAFT_A,
    component_id=COMPONENT_1,
    sensor_id=SENSOR_ELONGA,
    measurement_type="tether.elongation",
    measurement_value=0.023,
    unit="mm/m",
    seq=100,
    nonce="test_nonce_default1",
    epoch=EPOCH_0,
    timestamp=TIMESTAMP_GOOD,
    previous_hash=None,
    calibration_valid=CALIB_VALID,
    firmware_hash=FW_HASH,
    cal_hash=CALIBRATION_HASH,
    tamper_field=None,
    tamper_value=None,
) -> dict:
    """Build and sign a packet dict for testing."""
    priv, _ = keypair
    base = {
        "schema_version": "1.0",
        "aircraft_id": aircraft_id,
        "component_id": component_id,
        "sensor_id": sensor_id,
        "witness_device_id": device_id,
        "measurement_type": measurement_type,
        "measurement_value": measurement_value,
        "unit": unit,
        "measurement_uncertainty": 0.002,
        "measurement_timestamp": timestamp,
        "sequence_number": seq,
        "nonce": nonce,
        "configuration_epoch": epoch,
        "calibration_record_hash": cal_hash,
        "calibration_valid_until": calibration_valid,
        "firmware_hash": firmware_hash,
        "witness_version": "1.0",
        "previous_witness_hash": previous_hash,
        "signature_algorithm": "Ed25519",
        "signature_key_id": f"BENCH-KEY-{device_id}",
        "source_label": "SIMULATED_WITNESS",
    }
    sig = sign_packet_dict(base, priv)
    base["signature"] = sig
    # Post-sign tampering (for ATTACK-11 style tests)
    if tamper_field is not None:
        base[tamper_field] = tamper_value
    return base


def dict_to_packet(d: dict) -> WitnessPacket:
    fields = {f.name for f in dataclasses.fields(WitnessPacket)}
    return WitnessPacket(**{k: v for k, v in d.items() if k in fields})
