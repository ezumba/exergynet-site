"""
LNES-60 Phase 2 — Test vector generator.

Generates deterministic signed test vectors for all 13 ratified attacks.
Run from LNES60_Physical_Truth/:
    python -m lnes60_phase2.test_vectors.generate_vectors

Outputs: ATTACK-01.json through ATTACK-13.json in the test_vectors/ directory.

LABEL: TEST KEY / SIMULATED SIGNER
All keys generated here are ephemeral and test-only. No production keys.
Private keys exist only in memory during generation and are discarded.
"""

from __future__ import annotations
import base64
import dataclasses
import hashlib
import json
import os
import sys

# Ensure LNES60_Physical_Truth is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from lnes60_phase2.canonicalize import canonical_bytes, packet_chain_hash
from lnes60_phase2.crypto_verifier import generate_test_keypair, sign_packet_dict

OUT_DIR = os.path.dirname(__file__)

# ---------------------------------------------------------------------------
# Shared bench configuration — ENGINEERING_ENVELOPE / SYNTHETIC_TEST_VALUE
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
SCHEMA_V = "1.0"
CALIBRATION_HASH = "a1b2c3d4" * 8   # 64-char placeholder
CALIB_VALID = "2027-01-01T00:00:00Z"
FW_HASH = "d4e5f6a1" * 8
TIMESTAMP_GOOD = "2026-08-09T14:30:00Z"
TIMESTAMP_STALE = "2024-01-01T00:00:00Z"  # pre-event


def _make_base_packet(
    device_id=DEVICE_A,
    aircraft_id=AIRCRAFT_A,
    component_id=COMPONENT_1,
    sensor_id=SENSOR_ELONGA,
    measurement_type="tether.elongation",
    measurement_value=0.023,
    unit="mm/m",
    seq=100,
    nonce="aabbccdd11223344",
    epoch=EPOCH_0,
    timestamp=TIMESTAMP_GOOD,
    previous_hash=None,
    calibration_valid=CALIB_VALID,
    firmware_hash=FW_HASH,
    cal_hash=CALIBRATION_HASH,
) -> dict:
    return {
        "schema_version": SCHEMA_V,
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


def _sign(packet_dict: dict, private_key) -> dict:
    sig = sign_packet_dict(packet_dict, private_key)
    packet_dict = dict(packet_dict)
    packet_dict["signature"] = sig
    return packet_dict


def _write(attack_id: str, vector: dict) -> None:
    path = os.path.join(OUT_DIR, f"{attack_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(vector, f, indent=2)
    print(f"  {attack_id}.json written")


def generate_all() -> None:
    print("Generating LNES-60 Phase 2 attack test vectors (TEST KEY / SIMULATED SIGNER)")

    # Generate device key pairs
    priv_a, pub_a = generate_test_keypair()
    priv_b, pub_b = generate_test_keypair()

    # Helper to get chain hash
    def chain(pkt_dict):
        return packet_chain_hash(pkt_dict)

    # -----------------------------------------------------------------------
    # ATTACK-01: Physical disconnect — sensor signs despite being detached
    # Valid signature, sensor_health flag triggers inadmissibility
    # -----------------------------------------------------------------------
    pkt_01 = _make_base_packet(nonce="attack01aaaaaa01")
    pkt_01 = _sign(pkt_01, priv_a)
    _write("ATTACK-01", {
        "_attack_id": "ATTACK-01",
        "_name": "Physical disconnect (detached sensor)",
        "_expected_crypto": "VALID_SIGNATURE",
        "_expected_admissibility": "INADMISSIBLE",
        "_expected_failure_code": "FIRMWARE_MISMATCH or SENSOR_HEALTH_DEGRADED",
        "_note": "Sub-case A: firmware_hash modified to trigger FIRMWARE_MISMATCH (detectable path). "
                 "Sub-case B (undetectable from packet alone) requires health-field or heartbeat logic.",
        "packet": pkt_01,
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": "CORRECT_FIRMWARE_HASH_" + "00" * 28,
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-02: Frozen-good replay — valid old packet replayed after event
    # -----------------------------------------------------------------------
    pkt_02_original = _make_base_packet(
        nonce="attack02original1",
        seq=50,
        timestamp=TIMESTAMP_STALE,
    )
    pkt_02_original = _sign(pkt_02_original, priv_a)

    pkt_02_replay = dict(pkt_02_original)   # identical = duplicate nonce
    _write("ATTACK-02", {
        "_attack_id": "ATTACK-02",
        "_name": "Frozen-good replay",
        "_expected_crypto": "VALID_SIGNATURE",
        "_expected_admissibility": "INADMISSIBLE",
        "_expected_failure_code": "REPLAY_DETECTED (nonce) or STALE_AFTER_EVENT (timestamp predates event)",
        "original_packet": pkt_02_original,
        "replay_submission": pkt_02_replay,
        "invalidating_event": {
            "event_id": "EVT-HARD-LANDING-001",
            "aircraft_id": AIRCRAFT_A,
            "component_id": COMPONENT_1,
            "event_type": "hard_landing",
            "event_time": "2026-01-15T10:00:00Z",
        },
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": FW_HASH,
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-03: Wrong component — TETHER-2 packet submitted for TETHER-1 claim
    # -----------------------------------------------------------------------
    pkt_03 = _make_base_packet(
        device_id=DEVICE_B,
        aircraft_id=AIRCRAFT_A,
        component_id=COMPONENT_2,  # signed for TETHER-2
        nonce="attack03wrongcomp1",
        seq=200,
    )
    pkt_03 = _sign(pkt_03, priv_b)
    _write("ATTACK-03", {
        "_attack_id": "ATTACK-03",
        "_name": "Pod A → Pod B substitution (wrong component)",
        "_expected_crypto": "VALID_SIGNATURE",
        "_expected_admissibility": "INADMISSIBLE",
        "_expected_failure_code": "WRONG_COMPONENT",
        "_claim_component": COMPONENT_1,
        "packet": pkt_03,
        "registered_key_id": f"BENCH-KEY-{DEVICE_B}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_b).decode(),
        "registered_firmware_hash": FW_HASH,
        "device_b_binding": {"aircraft_id": AIRCRAFT_A, "component_id": COMPONENT_2},
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-04: Wrong aircraft — KTX-9001 packet submitted for KTX-9002 claim
    # -----------------------------------------------------------------------
    pkt_04 = _make_base_packet(
        device_id=DEVICE_A,
        aircraft_id=AIRCRAFT_A,   # packet is for A
        nonce="attack04wrongac01",
        seq=300,
    )
    pkt_04 = _sign(pkt_04, priv_a)
    _write("ATTACK-04", {
        "_attack_id": "ATTACK-04",
        "_name": "Aircraft A → Aircraft B substitution (wrong aircraft)",
        "_expected_crypto": "VALID_SIGNATURE",
        "_expected_admissibility": "INADMISSIBLE",
        "_expected_failure_code": "WRONG_AIRCRAFT",
        "_claim_aircraft": AIRCRAFT_B,
        "packet": pkt_04,
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": FW_HASH,
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-05: Configuration epoch replay — EPOCH_0 packet after EPOCH_1 change
    # -----------------------------------------------------------------------
    pkt_05 = _make_base_packet(
        epoch=EPOCH_0,  # old epoch
        nonce="attack05epochrep1",
        seq=400,
    )
    pkt_05 = _sign(pkt_05, priv_a)
    _write("ATTACK-05", {
        "_attack_id": "ATTACK-05",
        "_name": "Configuration-epoch replay",
        "_expected_crypto": "VALID_SIGNATURE",
        "_expected_admissibility": "INADMISSIBLE",
        "_expected_failure_code": "EPOCH_MISMATCH",
        "_commanded_epoch": EPOCH_1,
        "packet": pkt_05,
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": FW_HASH,
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-06: Calibration expiration — calibration_valid_until in the past
    # -----------------------------------------------------------------------
    pkt_06 = _make_base_packet(
        calibration_valid="2025-01-01T00:00:00Z",  # expired
        nonce="attack06calib000x1",
        seq=500,
    )
    pkt_06 = _sign(pkt_06, priv_a)
    _write("ATTACK-06", {
        "_attack_id": "ATTACK-06",
        "_name": "Calibration expiration",
        "_expected_crypto": "VALID_SIGNATURE",
        "_expected_admissibility": "INADMISSIBLE",
        "_expected_failure_code": "CALIBRATION_EXPIRED",
        "packet": pkt_06,
        "registered_calibration": {
            "sensor_id": SENSOR_ELONGA,
            "calibration_hash": CALIBRATION_HASH,
            "calibration_valid_until": "2025-01-01T00:00:00Z",
        },
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": FW_HASH,
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-07: Counter rollback — sequence_number <= last seen
    # -----------------------------------------------------------------------
    pkt_07_first = _make_base_packet(
        nonce="attack07seq_first1",
        seq=600,
    )
    pkt_07_first = _sign(pkt_07_first, priv_a)
    chain_07 = chain(pkt_07_first)

    pkt_07_rollback = _make_base_packet(
        nonce="attack07seq_rllbk",
        seq=599,  # rollback
        previous_hash=chain_07,
    )
    pkt_07_rollback = _sign(pkt_07_rollback, priv_a)
    _write("ATTACK-07", {
        "_attack_id": "ATTACK-07",
        "_name": "Counter rollback",
        "_expected_crypto": "VALID_SIGNATURE",
        "_expected_admissibility": "INADMISSIBLE",
        "_expected_failure_code": "SEQUENCE_ROLLBACK",
        "setup_packet": pkt_07_first,
        "attack_packet": pkt_07_rollback,
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": FW_HASH,
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-08: Duplicate signed packet — same nonce submitted twice
    # -----------------------------------------------------------------------
    pkt_08 = _make_base_packet(
        nonce="attack08duplicate1",
        seq=700,
    )
    pkt_08 = _sign(pkt_08, priv_a)
    _write("ATTACK-08", {
        "_attack_id": "ATTACK-08",
        "_name": "Duplicate signed packet",
        "_expected_crypto": "VALID_SIGNATURE (both)",
        "_expected_admissibility": "INADMISSIBLE (second submission)",
        "_expected_failure_code": "REPLAY_DETECTED",
        "packet": pkt_08,
        "_note": "Submit this packet twice. First submission is admitted; second is rejected.",
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": FW_HASH,
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-09: Wrong measurement scope — temperature submitted for elongation
    # -----------------------------------------------------------------------
    pkt_09 = _make_base_packet(
        device_id=DEVICE_A,
        sensor_id=SENSOR_TEMP,
        measurement_type="tether.temperature",  # wrong type for elongation claim
        unit="degC",
        measurement_value=22.5,
        nonce="attack09scope0001",
        seq=800,
    )
    pkt_09 = _sign(pkt_09, priv_a)
    _write("ATTACK-09", {
        "_attack_id": "ATTACK-09",
        "_name": "Wrong measurement scope",
        "_expected_crypto": "VALID_SIGNATURE",
        "_expected_admissibility": "INADMISSIBLE",
        "_expected_failure_code": "SCOPE_MISMATCH",
        "_predicate_under_evaluation": "tether.elongation",
        "packet": pkt_09,
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": FW_HASH,
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-10: Contradictory trusted witnesses — both admitted, both disagree
    # -----------------------------------------------------------------------
    pkt_10_a = _make_base_packet(
        device_id=DEVICE_A,
        measurement_value=0.023,  # good
        nonce="attack10_device_a1",
        seq=900,
    )
    pkt_10_a = _sign(pkt_10_a, priv_a)

    pkt_10_b = _make_base_packet(
        device_id=DEVICE_B,
        aircraft_id=AIRCRAFT_A,
        component_id=COMPONENT_1,
        sensor_id="ELONGATION-SENSOR-B",
        measurement_value=5.800,  # bad
        nonce="attack10_device_b1",
        seq=900,
    )
    pkt_10_b = _sign(pkt_10_b, priv_b)
    _write("ATTACK-10", {
        "_attack_id": "ATTACK-10",
        "_name": "Contradictory trusted witnesses",
        "_expected_crypto": "VALID_SIGNATURE (both)",
        "_expected_admissibility": "ADMISSIBLE (both)",
        "_expected_convergence_state": "SENSOR_CONFLICT",
        "_expected_lnes22": "HOLD",
        "_note": "Both witnesses are admitted. Conflict is at convergence layer.",
        "packet_a": pkt_10_a,
        "packet_b": pkt_10_b,
        "registered_key_a": {
            "key_id": f"BENCH-KEY-{DEVICE_A}",
            "public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
            "device_id": DEVICE_A,
            "aircraft_id": AIRCRAFT_A,
            "component_id": COMPONENT_1,
            "firmware_hash": FW_HASH,
        },
        "registered_key_b": {
            "key_id": f"BENCH-KEY-{DEVICE_B}",
            "public_key_b64": base64.urlsafe_b64encode(pub_b).decode(),
            "device_id": DEVICE_B,
            "aircraft_id": AIRCRAFT_A,
            "component_id": COMPONENT_1,
            "firmware_hash": FW_HASH,
        },
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-11: Tampered signed packet — field modified after signing
    # -----------------------------------------------------------------------
    pkt_11_original = _make_base_packet(
        measurement_value=0.023,
        nonce="attack11tamper001",
        seq=1000,
    )
    pkt_11_original = _sign(pkt_11_original, priv_a)

    pkt_11_tampered = dict(pkt_11_original)
    pkt_11_tampered["measurement_value"] = 99.9  # tampered — sig no longer valid

    _write("ATTACK-11", {
        "_attack_id": "ATTACK-11",
        "_name": "Tampered signed packet",
        "_expected_crypto": "INVALID_SIGNATURE",
        "_expected_admissibility": "REJECTED AT CRYPTO LAYER",
        "_note": "measurement_value modified from 0.023 to 99.9 after signing. "
                 "Signature covers the original value only.",
        "original_packet": pkt_11_original,
        "tampered_packet": pkt_11_tampered,
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": FW_HASH,
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-12: Wrong firmware — firmware_hash does not match registry
    # -----------------------------------------------------------------------
    pkt_12 = _make_base_packet(
        firmware_hash="badfirmwarehash0" * 4,  # 64 chars, wrong hash
        nonce="attack12firmware1",
        seq=1100,
    )
    pkt_12 = _sign(pkt_12, priv_a)
    _write("ATTACK-12", {
        "_attack_id": "ATTACK-12",
        "_name": "Wrong firmware",
        "_expected_crypto": "VALID_SIGNATURE",
        "_expected_admissibility": "INADMISSIBLE",
        "_expected_failure_code": "FIRMWARE_MISMATCH",
        "packet": pkt_12,
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": FW_HASH,  # does NOT match packet
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    # -----------------------------------------------------------------------
    # ATTACK-13: Valid physical state / invalid mission
    # Hardware is healthy; mission exceeds envelope
    # -----------------------------------------------------------------------
    pkt_13 = _make_base_packet(
        measurement_value=0.023,  # healthy reading
        nonce="attack13mission01",
        seq=1200,
    )
    pkt_13 = _sign(pkt_13, priv_a)
    _write("ATTACK-13", {
        "_attack_id": "ATTACK-13",
        "_name": "Valid physical state / invalid mission",
        "_expected_crypto": "VALID_SIGNATURE",
        "_expected_admissibility": "ADMISSIBLE",
        "_expected_convergence_state": "VERIFIED_MATCH",
        "_expected_lnes22": "HOLD (mission outside envelope)",
        "_critical_note": (
            "PHYSICAL TRUTH != ACTION AUTHORITY. Aircraft is healthy. "
            "The mission is unauthorized because payload_kg exceeds the "
            "certified limit for TETHER-1 in EPOCH_0. "
            "A system that collapses physical evaluation and mission authorization "
            "into a single check will produce a false RELEASE here."
        ),
        "packet": pkt_13,
        "mission_request": {
            "schema_version": "1.0",
            "mission_id": "MISSION-ATTACK13-001",
            "aircraft_id": AIRCRAFT_A,
            "configuration_epoch": EPOCH_0,
            "payload_ref": "PAYLOAD-OVERLOAD-SPEC",
            "requested_action": "PREFLIGHT_RELEASE",
            "operational_conditions_ref": None,
            "authorization_policy_version": "bench-1.0",
            "mission_within_envelope": False,
            "mission_envelope_reason": (
                "Requested payload_kg=950 exceeds certified limit=800 "
                "for TETHER-1 in EPOCH_0. ENGINEERING_ENVELOPE / SYNTHETIC_TEST_VALUE"
            ),
        },
        "registered_key_id": f"BENCH-KEY-{DEVICE_A}",
        "registered_public_key_b64": base64.urlsafe_b64encode(pub_a).decode(),
        "registered_firmware_hash": FW_HASH,
        "_label": "TEST KEY / SIMULATED SIGNER",
    })

    print(f"\nAll 13 attack test vectors written to {OUT_DIR}/")
    print("LABEL: TEST KEY / SIMULATED SIGNER — all private keys discarded after generation")


if __name__ == "__main__":
    generate_all()
