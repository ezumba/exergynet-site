# LNES-60 Phase 2 — Tensile Team Hardware Handoff

**Date:** 2026-08-09  
**Status:** SOFTWARE READY / HARDWARE EXECUTION PENDING  
**Prepared by:** ExergyNet / Ezumba Dynasty Trust  
**For:** KTX Tensile-Lift hardware integration team

---

## 1. What You're Receiving

This document and the accompanying software package (`lnes60_phase2/`) are the ExergyNet software deliverable for Phase 2 of LNES-60 Physical Truth. ExergyNet has:

1. Completed a 50-case real-model validation (Phase 1.5) — results sealed at `LNES60_PHASE1.5_FINAL_VALIDATION_REPORT.md`.
2. Built a local bench receiver that accepts signed physical witness packets from the KTX hardware bench.
3. Defined the interface (ICD), attack test vectors, and acceptance criteria for the hardware bench run.

**What ExergyNet has NOT done:** connected to real hardware, issued any NEURO-LOCK commands, or run the software against real KTX sensors. That is what you are about to do.

---

## 2. What the KTX Bench Must Provide

### 2.1 PAHT-CF Node sensors
Each sensor node must be able to:
- Generate a 22-field `WitnessPacket` per `LNES60_PHASE2_WITNESS_PACKET_SCHEMA.json`
- Sign packets with a device-resident Ed25519 private key
- Increment `sequence_number` monotonically per device
- Set a unique `nonce` per packet
- Include the `previous_witness_hash` of the prior packet (SHA-256 of canonical packet bytes)
- Include `firmware_hash` (SHA-256 of current firmware), `calibration_record_hash`, and `calibration_valid_until`

### 2.2 LNES-06 Android Edge Witness (v2.29.0)
The LNES-06 app provides:
- Hardware-backed Ed25519 signing via the secure element
- BLE/GPS sensor integration
- `witness_device_id` derived from hardware serial or secure element ID
- Protocol version 1.0 packets

### 2.3 Public Key Provisioning
Before the bench run, provide ExergyNet with:
- For each bench device: `witness_device_id`, `public_key_bytes` (32 raw Ed25519 bytes), `registered_firmware_hash`
- For each sensor: `sensor_id`, `calibration_record_hash`, `calibration_valid_until`
- For each aircraft/component pair: `aircraft_id`, `component_id`, `configuration_epoch` (current)

These are registered in `KeyRegistry`, `CalibrationRegistry`, `EpochRegistry`, and `PredicateMeasurementRegistry` before the bench run.

---

## 3. Attack Scenario Requirements

The bench must exercise all 13 ratified attack scenarios defined in `LNES60_PHASE2_ATTACK_EXPECTATIONS.json`. For hardware execution, the bench must be able to:

| Attack | Hardware requirement |
|---|---|
| ATTACK-01 | Physically detach a sensor while it continues signing packets |
| ATTACK-02 | Replay a previously captured valid packet (same nonce) |
| ATTACK-03 | Submit a valid packet from sensor bound to TETHER-2 for a TETHER-1 claim |
| ATTACK-04 | Submit a valid packet from aircraft KTX-9001 for a KTX-9002 claim |
| ATTACK-05 | Submit a valid packet from a prior configuration epoch |
| ATTACK-06 | Submit a packet where calibration_valid_until is in the past |
| ATTACK-07 | Submit a packet with a sequence_number lower than the prior packet |
| ATTACK-08 | Submit the same packet twice |
| ATTACK-09 | Submit a temperature reading for an elongation predicate |
| ATTACK-10 | Have two independently mounted, calibrated sensors report contradictory values for the same predicate simultaneously |
| ATTACK-11 | Modify a packet field after signing and submit the tampered packet |
| ATTACK-12 | Submit a packet where firmware_hash does not match the registered firmware |
| ATTACK-13 | Submit a valid, healthy hardware reading while the MissionRequest exceeds the payload envelope |

---

## 4. Pre-Run Setup

### 4.1 Software environment

```bash
# From LNES60_Physical_Truth/
pip install cryptography pytest
pytest lnes60_phase2/tests/test_attacks.py -v
```

All 13 attack tests + security/regression tests must pass before hardware work begins.

### 4.2 Generate test vectors

```bash
python -m lnes60_phase2.test_vectors.generate_vectors
```

Produces ATTACK-01.json through ATTACK-13.json in `test_vectors/`. These are reference artifacts showing the expected packet structure for each attack — the hardware bench does not need to use these exact packets, but the scenarios must match.

### 4.3 Register your hardware devices

```python
from lnes60_phase2.key_registry import KeyRegistry
from lnes60_phase2.calibration_validator import CalibrationRegistry, CalibrationRecord
from lnes60_phase2.epoch_validator import EpochRegistry
from lnes60_phase2.scope_validator import PredicateMeasurementRegistry

key_reg = KeyRegistry()
key_reg.register_test_key(
    witness_device_id="<your device ID>",
    sensor_id="<your sensor ID>",
    aircraft_id="<KTX aircraft ID>",
    component_id="<TETHER-X or MOTOR-Y>",
    public_key_bytes=<32 raw bytes>,
    firmware_hash="<SHA-256 hex>",
)
# ... calibration, epoch, predicate registries
```

### 4.4 Start the bench session

```python
from lnes60_phase2.bench_receiver import BenchSession
from lnes60_phase2.witness_admissibility import AdmissibilityContext
from lnes60_phase2.replay_guard import ReplayGuard

ctx = AdmissibilityContext(
    key_registry=key_reg,
    replay_guard=ReplayGuard(),
    calibration_registry=cal_reg,
    epoch_registry=epoch_reg,
    predicate_registry=pred_reg,
    claim_aircraft_id="<target aircraft>",
    claim_component_id="<target component>",
    predicate="tether.elongation",  # or your predicate
)
session = BenchSession(ctx=ctx)
```

---

## 5. What Counts as a Valid Hardware Run

Per `LNES60_PHASE2_ACCEPTANCE_CRITERIA.md`:

1. `pytest lnes60_phase2/tests/test_attacks.py -v` passes (0 failures)
2. All 13 attack scenarios exercised with hardware packets → expected receiver outcomes
3. At least one clean positive case (valid hardware witness → VERIFIED_MATCH → RELEASE within envelope)
4. Zero authorized false releases
5. Zero hard-rule violations
6. All session outputs preserved as sealed evidence

---

## 6. What Is NOT In Scope for Phase 2

- **NEURO-LOCK commands**: `AuthorizationDecision.action_authority = RELEASE` means the software evaluation is clear. No hardware actuation command is issued by the software. Human-in-the-loop signoff is required before any physical operation.
- **FAA regulatory return-to-service**: LNES-60 does not claim autonomous regulatory RTS and does not bypass any legally required inspection or signoff.
- **Production key management**: All Phase 2 bench keys are TEST KEY / SIMULATED SIGNER. Production key management is a Phase 3 requirement.

---

## 7. Canonical Reference Files

| File | Purpose |
|---|---|
| `LNES60_PHASE2_WITNESS_PACKET_SCHEMA.json` | 22-field packet schema |
| `LNES60_PHASE2_STATE_OBJECT_SCHEMA.json` | AircraftStateObject schema |
| `LNES60_PHASE2_ACTION_AUTHORITY_SCHEMA.json` | MissionRequest, handshake, decision schemas |
| `LNES60_PHASE2_ATTACK_EXPECTATIONS.json` | 13 ratified attacks with expected outcomes |
| `LNES60_PHASE2_SOFTWARE_ARCHITECTURE.md` | Package structure and data flow |
| `LNES60_PHASE2_INTERFACE_CONTROL_DOCUMENT.md` | Protocol reference, result codes, sequencing |
| `LNES60_PHASE2_ACCEPTANCE_CRITERIA.md` | What constitutes a passing Phase 2 |
| `lnes60_phase2/` | Python package (all source) |
| `LNES60_PHASE1.5_FINAL_VALIDATION_REPORT.md` | Phase 1.5 real-model baseline results |

---

## 8. Contact and Questions

Questions about the software receiver, expected failure codes, or attack scenario setup: ExergyNet / Ezumba Dynasty Trust.

Questions about PAHT-CF node firmware, secure element configuration, or LNES-06 integration: per the existing hardware development relationship.
