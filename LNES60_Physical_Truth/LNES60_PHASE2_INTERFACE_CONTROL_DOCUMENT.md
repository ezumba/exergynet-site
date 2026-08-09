# LNES-60 Phase 2 — Interface Control Document (ICD)

**Status:** SOFTWARE READY / HARDWARE EXECUTION PENDING  
**Version:** 1.0  
**Date:** 2026-08-09  
**Scope:** KTX Tensile-Lift hardware bench ↔ LNES-60 Phase 2 receiver

---

## 1. Purpose

This ICD defines the protocol between the KTX Tensile-Lift hardware bench (PAHT-CF nodes, LNES-06 Android Edge Witness) and the LNES-60 Phase 2 receiver. It is the contract between ExergyNet software and the Tensile hardware team.

**Governing principle:** A hardware integration run is only valid if it exercises the specific conditions described in `LNES60_PHASE2_ATTACK_EXPECTATIONS.json` and the receiver produces the corresponding expected outputs. Deviations require investigation.

---

## 2. Physical Witness Packet — Interface A

### 2.1 Schema Reference
`LNES60_PHASE2_WITNESS_PACKET_SCHEMA.json` — canonical schema. All 22 fields are required.

### 2.2 Transport

**Local callable (primary for Phase 2 bench):**
```python
from lnes60_phase2.bench_receiver import BenchSession
result = session.receive_packet(packet)
```

**HTTP (optional, local only):**
```
POST http://127.0.0.1:8710/lnes60/v1/witness
Content-Type: application/json

{<WitnessPacket JSON>}
```
Response:
```json
{
  "admitted": true | false,
  "failed_checks": [],
  "rejection_reason": null | "string",
  "error": null | "string"
}
```

### 2.3 Encoding

- JSON, UTF-8
- Canonical signature bytes: sorted keys, no whitespace, no BOM
- Excludes the `signature` field itself
- `measurement_value` and `measurement_uncertainty` must be finite (not NaN or Infinity)
- `sequence_number` must be non-negative integer, monotonically increasing per device

### 2.4 Signature

Algorithm: Ed25519 (no other algorithm accepted)

Signing process:
1. Serialize all fields except `signature` as canonical JSON (sorted keys, no whitespace, UTF-8)
2. Sign the resulting bytes with the device's Ed25519 private key
3. Base64url-encode the 64-byte signature without padding
4. Set `signature` field to the encoded value

### 2.5 Key Registration (Pre-bench Setup)

Before a hardware run, each device must be registered in the `KeyRegistry`:
```python
key_registry.register_test_key(
    witness_device_id="SE-DEVICE-001",
    sensor_id="ELONGATION-SENSOR-A",
    aircraft_id="KTX-9001",
    component_id="TETHER-1",
    public_key_bytes=<32 raw Ed25519 bytes>,
    firmware_hash="<SHA-256 hex of authorized firmware>",
)
```

The corresponding `CalibrationRegistry`, `EpochRegistry`, and `PredicateMeasurementRegistry` must also be pre-populated for each sensor and aircraft/component pair.

---

## 3. Mission Evaluation — Interface B

**Local callable:**
```python
from lnes60_phase2.lnes22_adapter import evaluate_action_authority
decision, handshake = evaluate_action_authority(state, mission, policy_version, timestamp)
```

**HTTP (optional):**
```
POST http://127.0.0.1:8710/lnes60/v1/evaluate
Content-Type: application/json

{
  "state": {<AircraftStateObject JSON>},
  "mission": {<MissionRequest JSON>}
}
```
Response:
```json
{
  "action_authority": "RELEASE" | "HOLD" | "INCOMPLETE",
  "reason_codes": [],
  "physical_truth_verdict": "VERIFIED_MATCH / RELEASE_ELIGIBLE",
  "mission_authorization_verdict": "WITHIN_ENVELOPE" | "OUTSIDE_ENVELOPE" | "UNKNOWN",
  "decision_receipt": "<SHA-256 hex>",
  "decision_id": "<UUID>"
}
```

### 3.1 Schema References
- `LNES60_PHASE2_STATE_OBJECT_SCHEMA.json` — AircraftStateObject
- `LNES60_PHASE2_ACTION_AUTHORITY_SCHEMA.json` — MissionRequest, PhysicalTruthHandshakePayload, AuthorizationDecision

---

## 4. Admissibility Result Codes

| Code | Layer | Meaning |
|---|---|---|
| `UNKNOWN_ALGORITHM` | Schema | signature_algorithm is not Ed25519 |
| `INVALID_MEASUREMENT_VALUE` | Schema | measurement_value is NaN or Infinity |
| `INVALID_MEASUREMENT_UNCERTAINTY` | Schema | uncertainty is negative, NaN, or Infinity |
| `INVALID_SEQUENCE_NUMBER` | Schema | sequence_number < 0 |
| `INVALID_SIGNATURE` | Crypto | Ed25519 verification failed |
| `UNKNOWN_KEY` | Crypto | witness_device_id not in key registry or revoked |
| `FIRMWARE_MISMATCH` | Crypto/Registry | firmware_hash != registered hash |
| `REPLAY_DETECTED` | Replay | Nonce already seen for this device |
| `SEQUENCE_ROLLBACK` | Replay | sequence_number ≤ last seen |
| `CHAIN_BREAK` | Replay | previous_witness_hash mismatch |
| `CALIBRATION_UNKNOWN` | Calibration | Sensor not in calibration registry |
| `CALIBRATION_HASH_MISMATCH` | Calibration | calibration_record_hash != registered |
| `CALIBRATION_EXPIRED` | Calibration | calibration_valid_until < measurement_timestamp |
| `CALIBRATION_VALIDITY_MISMATCH` | Calibration | calibration_valid_until != registered value |
| `EPOCH_UNKNOWN` | Epoch | No commanded epoch for this aircraft/component |
| `EPOCH_MISMATCH` | Epoch | configuration_epoch != commanded epoch |
| `WRONG_AIRCRAFT` | Scope | aircraft_id != claim target |
| `WRONG_COMPONENT` | Scope | component_id != claim component |
| `DEVICE_AIRCRAFT_BINDING_MISMATCH` | Scope | Device registered to different aircraft |
| `DEVICE_COMPONENT_BINDING_MISMATCH` | Scope | Device registered to different component |
| `UNKNOWN_PREDICATE` | Scope | Predicate not in predicate_measurement_registry |
| `SCOPE_MISMATCH` | Scope | measurement_type does not cover predicate |

---

## 5. Physical Truth Resolution States

Per `LNES60_PHASE2_STATE_OBJECT_SCHEMA.json`. Nine states, never RELEASE_ELIGIBLE (which is a derived release decision, not a resolution state):

| State | Meaning |
|---|---|
| `VERIFIED_MATCH` | All evidence consistent; physical truth established |
| `DOCUMENT_PHYSICAL_CONFLICT` | Documentary and physical evidence disagree |
| `CONFIGURATION_MISMATCH` | Configuration/digital state disagrees with measurement |
| `SENSOR_CONFLICT` | Two or more admitted witnesses disagree |
| `SENSOR_DEGRADED` | Best admissible witness has degraded health |
| `STALE_WITNESS` | Witness is fresh by clock but stale relative to an event |
| `WITNESS_SCOPE_ERROR` | No admissible witness covers the claim predicate |
| `UNVERIFIED` | Witness rejected at trust layer |
| `INCOMPLETE` | Insufficient evidence to resolve |

---

## 6. Action Authority Values

| Value | Condition |
|---|---|
| `RELEASE` | physical_truth = RELEASE_ELIGIBLE AND mission_authorization = WITHIN_ENVELOPE |
| `HOLD` | Either physical_truth is HOLD OR mission is OUTSIDE_ENVELOPE or UNKNOWN |
| `INCOMPLETE` | Physical truth is INCOMPLETE (insufficient evidence) |

**NEURO-LOCK NOT ISSUED IN PHASE 2.** `RELEASE` means the software evaluation is clear; hardware actuation requires separate human-in-the-loop signoff per the Phase 3 protocol.

---

## 7. Sequencing

### 7.1 Minimum valid bench run (single predicate, single witness)

```
1. Pre-bench: register device key, calibration record, epoch, predicate mapping
2. Hardware bench → receiver: submit WitnessPacket
3. Receiver → bench: AdmissibilityVerdict (admitted=True)
4. Caller: build MissionRequest
5. physical_state_adapter: converge admitted packets → AircraftStateObject
6. lnes22_adapter: evaluate → AuthorizationDecision
7. Log: decision_receipt, action_authority, physical_truth_verdict
```

### 7.2 Multi-witness (conflict test)

Same as above but submit two packets from different devices. Both must be admitted. Pass both to `build_state_object()`. Convergence engine detects SENSOR_CONFLICT.

### 7.3 Attack test sequencing

Follow `LNES60_PHASE2_ATTACK_EXPECTATIONS.json` — each attack specifies whether the setup requires a prior admitted packet (e.g. ATTACK-07 needs a first-sequence packet before the rollback attempt).

---

## 8. Pre-Run Checklist

- [ ] All device public keys registered in `KeyRegistry`
- [ ] All calibration records registered in `CalibrationRegistry` with correct hash and validity window
- [ ] All commanded configuration epochs set in `EpochRegistry`
- [ ] All predicate-to-measurement-type mappings set in `PredicateMeasurementRegistry`
- [ ] `ReplayGuard` initialized fresh (no carry-over state from prior sessions)
- [ ] Test vectors generated: `python -m lnes60_phase2.test_vectors.generate_vectors`
- [ ] Test suite passing: `pytest lnes60_phase2/tests/test_attacks.py -v`
- [ ] All 13 attack vectors confirmed with expected failure codes

---

## 9. Out of Scope for Phase 2

- NEURO-LOCK actuation commands
- Real aircraft hardware connections
- Production key management
- Persistent state (replay guard, epoch registry) across restarts
- FAA-regulatory return-to-service
- HARDWARE_WITNESS support in P1-0.1.0 convergence engine (Phase 3)
