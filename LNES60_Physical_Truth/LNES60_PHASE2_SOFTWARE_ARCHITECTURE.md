# LNES-60 Phase 2 — Software Architecture

**Status:** SOFTWARE READY / HARDWARE EXECUTION PENDING  
**Version:** 2.0.0  
**Date:** 2026-08-09  
**Scope:** Local bench validation. No production credentials. No live aircraft. No NEURO-LOCK.

---

## 1. Purpose

This document describes the Phase 2 software architecture for the LNES-60 Physical Truth system. Phase 2 adds structured hardware witness packet ingestion, cryptographic admissibility evaluation, and a minimal LNES-22 action-authority layer, connecting to the frozen Phase 1 / Phase 1.5 convergence engine (P1-0.1.0, commit 784c55f).

Phase 2 does not change the governing principle or the four-plane truth model established in Phase 1. It provides the software infrastructure for the KTX Tensile-Lift hardware bench to submit signed physical witness packets and receive physical-truth and action-authority responses.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     KTX Hardware Bench                               │
│  PAHT-CF Nodes / LNES-06 Android Edge Witness v2.29.0              │
│  → Ed25519-signed WitnessPackets (22-field schema v1.0)            │
└──────────────────────────┬──────────────────────────────────────────┘
                            │  POST /lnes60/v1/witness
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  bench_receiver.py — BenchSession                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              witness_admissibility.py (7 checks)              │  │
│  │  1. Schema / sanity  (NaN, Inf, algorithm)                    │  │
│  │  2. crypto_verifier  (Ed25519 over canonical bytes)           │  │
│  │  3. key_registry     (device known, firmware hash)            │  │
│  │  4. replay_guard     (nonce, sequence, chain hash)            │  │
│  │  5. calibration_validator  (hash match, expiry)               │  │
│  │  6. epoch_validator  (configuration epoch)                    │  │
│  │  7. scope_validator  (aircraft, component, predicate)         │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                          │ admitted / rejected                       │
│  ┌──────────────────────▼───────────────────────────────────────┐  │
│  │            physical_state_adapter.py                          │  │
│  │   Adapts admitted WitnessPackets → P1-0.1.0 PhysicalWitness  │  │
│  │   Calls frozen convergence_engine.converge()                  │  │
│  │   Calls release_policy.evaluate_release()                     │  │
│  │   Produces AircraftStateObject (Phase 2 schema)               │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                          │  AircraftStateObject                      │
│  ┌──────────────────────▼───────────────────────────────────────┐  │
│  │            lnes22_adapter.py                                  │  │
│  │   Builds PhysicalTruthHandshakePayload (info-minimizing)      │  │
│  │   Checks MissionRequest vs envelope                           │  │
│  │   Produces AuthorizationDecision + decision_receipt (SHA-256) │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          │  AuthorizationDecision                    │
│                          │  POST /lnes60/v1/evaluate                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Package Structure

```
LNES60_Physical_Truth/
├── lnes60/                          ← FROZEN P1-0.1.0 (commit 784c55f)
│   ├── convergence_engine.py        ← Four-plane convergence, never modify
│   ├── release_policy.py            ← LNES-22 simulation (P1 version)
│   ├── state_types.py
│   ├── witness_types.py
│   └── ...
└── lnes60_phase2/                   ← Phase 2 package (this document)
    ├── __init__.py
    ├── packet_types.py              ← WitnessPacket, AircraftStateObject, MissionRequest,
    │                                   AuthorizationDecision, PhysicalTruthHandshakePayload
    ├── canonicalize.py              ← Canonical JSON bytes (sorted keys, no whitespace)
    ├── key_registry.py              ← In-memory Ed25519 public key + firmware registry
    ├── replay_guard.py              ← Nonce, sequence, chain-hash state
    ├── calibration_validator.py     ← Calibration hash + expiry
    ├── epoch_validator.py           ← Configuration epoch
    ├── scope_validator.py           ← Aircraft/component/predicate binding
    ├── crypto_verifier.py           ← Ed25519 verification (cryptography library)
    ├── witness_admissibility.py     ← Orchestrates 7 admissibility checks
    ├── physical_state_adapter.py    ← Bridges to P1-0.1.0 convergence engine
    ├── lnes22_adapter.py            ← LNES-22 action authority
    ├── bench_receiver.py            ← Local callable + HTTP server
    ├── test_vectors/
    │   ├── __init__.py
    │   ├── generate_vectors.py      ← Generates ATTACK-01.json … ATTACK-13.json
    │   └── ATTACK-01.json … ATTACK-13.json (generated)
    └── tests/
        ├── __init__.py
        ├── conftest.py              ← Shared fixtures (TEST KEY / SIMULATED SIGNER)
        └── test_attacks.py          ← 13 attack tests + security edge cases + regression
```

---

## 4. Data Flow

### 4.1 Witness Packet Submission

1. Hardware bench signs a 22-field `WitnessPacket` with an Ed25519 private key (test key for Phase 2).
2. Packet is submitted to `bench_receiver.BenchSession.receive_packet()` or `POST /lnes60/v1/witness`.
3. `witness_admissibility.evaluate_admissibility()` runs all 7 checks in order.
4. Admitted packets are accumulated in `BenchSession.admitted_packets`.
5. Rejected packets are logged with failure code and detail.

### 4.2 Physical Truth Evaluation

6. `physical_state_adapter.build_state_object()` converts admitted packets to P1-0.1.0 `PhysicalWitness` objects.
7. `convergence_engine.converge()` runs the four-plane reconciliation.
8. `release_policy.evaluate_release()` maps convergence state to RELEASE_ELIGIBLE / HOLD / INCOMPLETE.
9. Result is packaged as an `AircraftStateObject`.

### 4.3 Action Authority

10. `lnes22_adapter.evaluate_action_authority()` consumes the `AircraftStateObject` and `MissionRequest`.
11. Physical truth is consumed — not re-evaluated. LNES-22 does not see raw sensor values.
12. Mission envelope is checked independently of physical state.
13. `AuthorizationDecision` is produced with a SHA-256 `decision_receipt` for audit.

---

## 5. Key Design Decisions

### 5.1 Physical Truth ≠ Action Authority

Confirmed empirically in Phase 1.5 (HOLD-015, HOLD-035). The `lnes22_adapter` always checks both physical truth and mission authorization independently. A `VERIFIED_MATCH` state with a mission outside the envelope produces `action_authority = HOLD`.

### 5.2 Admissibility ≠ Forgery

A valid signature on a stale or wrong-aircraft packet is not a forgery — it is an inadmissibility. The attack semantics distinction (ATTACK-01 through ATTACK-09 vs ATTACK-11) is documented in the attack expectations JSON and enforced in the test suite.

### 5.3 Information-Minimizing Handshake

The `PhysicalTruthHandshakePayload` excludes raw sensor values, raw documentary text, model reasoning chains, and calibration data. LNES-22 receives only resolved state. This is the boundary documented in Phase 1.5 patent disclosure item 15.

### 5.4 Canonical Serialization

All signature verification and hash computation uses `canonicalize.canonical_bytes()`: sorted keys, no whitespace, UTF-8. This is the only valid serialization for these operations.

### 5.5 P1-0.1.0 Freeze Compliance

The `physical_state_adapter.py` bridges Phase 2 WitnessPacket objects to the frozen P1-0.1.0 convergence engine without modifying it. The adapter creates `SIMULATED_WITNESS` trust records (the P1-0.1.0 `WitnessTrustRecord` enforces this label); HARDWARE_WITNESS support is a Phase 3 convergence engine update, out of scope for bench validation.

---

## 6. Security Constraints

- **No production credentials**: All bench keys are ephemeral TEST KEY / SIMULATED SIGNER.
- **No live aircraft**: Phase 2 is bench validation only.
- **No NEURO-LOCK**: `AuthorizationDecision` contains `action_authority` (RELEASE/HOLD/INCOMPLETE) but issues no hardware commands.
- **No hardcoded thresholds**: All numeric limits are ENGINEERING_ENVELOPE parameters configured per component type.
- **Private key discipline**: Private keys must not appear in packets, logs, test fixtures, or committed files.
- **Local only**: HTTP receiver binds to 127.0.0.1 only. Do not expose to external networks.

---

## 7. Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `cryptography` | ≥39.0 | Ed25519 signature verification |
| `pytest` | ≥7.0 | Test suite |
| Python standard library | 3.10+ | All other functionality |

Install: `pip install cryptography pytest`

---

## 8. Running the Test Suite

```bash
cd LNES60_Physical_Truth
pip install cryptography pytest
pytest lnes60_phase2/tests/test_attacks.py -v
```

Generate test vectors:
```bash
python -m lnes60_phase2.test_vectors.generate_vectors
```
