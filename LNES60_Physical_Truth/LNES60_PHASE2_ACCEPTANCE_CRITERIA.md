# LNES-60 Phase 2 — Acceptance Criteria

**Status:** SOFTWARE READY / HARDWARE EXECUTION PENDING  
**Version:** 1.0  
**Date:** 2026-08-09

---

## Purpose

This document defines the acceptance criteria for LNES-60 Phase 2. Phase 2 is accepted when all criteria below are satisfied by a hardware bench run using real KTX Tensile-Lift PAHT-CF node sensors and LNES-06 Android Edge Witness packets.

Satisfaction of software-only test suite criteria (`test_attacks.py`) is a necessary but not sufficient condition for Phase 2 acceptance. Hardware bench execution is required.

---

## Acceptance Criterion 1: Software Test Suite (Prerequisite)

**All 13 attack tests and all security/regression tests in `test_attacks.py` must pass.**

```bash
cd LNES60_Physical_Truth
pytest lnes60_phase2/tests/test_attacks.py -v
```

Expected: 0 failures, 0 errors.

This criterion must be satisfied before hardware bench work begins.

---

## Acceptance Criterion 2: Attack Vector Coverage (Hardware Bench)

**All 13 ratified attack scenarios in `LNES60_PHASE2_ATTACK_EXPECTATIONS.json` must be exercised by the hardware bench and produce the expected receiver outputs.**

| Attack | Expected result | Pass condition |
|---|---|---|
| ATTACK-01 | INADMISSIBLE / FIRMWARE_MISMATCH or SENSOR_HEALTH_DEGRADED | Receiver rejects, logs failure code |
| ATTACK-02 | INADMISSIBLE / REPLAY_DETECTED or STALE_AFTER_EVENT | Receiver rejects replay |
| ATTACK-03 | INADMISSIBLE / WRONG_COMPONENT | Receiver rejects on component binding |
| ATTACK-04 | INADMISSIBLE / WRONG_AIRCRAFT | Receiver rejects on aircraft binding |
| ATTACK-05 | INADMISSIBLE / EPOCH_MISMATCH | Receiver rejects stale epoch |
| ATTACK-06 | INADMISSIBLE / CALIBRATION_EXPIRED | Receiver rejects expired calibration |
| ATTACK-07 | INADMISSIBLE / SEQUENCE_ROLLBACK | Receiver rejects rollback |
| ATTACK-08 | INADMISSIBLE / REPLAY_DETECTED (second) | First admitted; second rejected |
| ATTACK-09 | INADMISSIBLE / SCOPE_MISMATCH | Receiver rejects wrong measurement type |
| ATTACK-10 | ADMISSIBLE (both) → convergence=SENSOR_CONFLICT, LNES-22=HOLD | Both admitted; conflict detected |
| ATTACK-11 | INVALID_SIGNATURE → rejected at crypto layer | Receiver rejects tampered packet |
| ATTACK-12 | INADMISSIBLE / FIRMWARE_MISMATCH | Receiver rejects wrong firmware |
| ATTACK-13 | ADMISSIBLE → VERIFIED_MATCH → LNES-22=HOLD (mission outside envelope) | Physical health does not release unauthorized mission |

**No attack scenario may produce an unauthorized RELEASE.**

---

## Acceptance Criterion 3: Happy Path (Hardware Bench)

**A valid witness packet from a correctly bound, calibrated, fresh, and in-scope HARDWARE_WITNESS device must be admitted and converge to `VERIFIED_MATCH` / `RELEASE_ELIGIBLE`.**

One positive case — clean, healthy, correctly bound hardware witness → RELEASE action authority (with a mission request within envelope) — must be demonstrated.

---

## Acceptance Criterion 4: False-Release Rate (Phase 2 Hardware Baseline)

**Zero authorized false releases during the Phase 2 hardware bench run.**

- Any packet that triggers a false release (RELEASE action_authority when the physical truth is not VERIFIED_MATCH or the mission is not within envelope) is a Phase 2 failure.
- Note: ATTACK-13 specifically validates that a VERIFIED_MATCH state does NOT automatically release an unauthorized mission. This is a pass-or-fail criterion.

---

## Acceptance Criterion 5: Hard-Rule Compliance

**No hard-rule violations are permitted during Phase 2.**

| Hard rule | Violation condition |
|---|---|
| SIMULATED_WITNESS data must never be labeled HARDWARE_WITNESS | Label mismatch in any log or output |
| Private keys must not appear in packets, logs, or committed files | Any key material in output artifacts |
| SENSOR_ALWAYS_WINS must not be applied | Physical measurement overrides documentary fact without conflict detection |
| Historical documentary facts must not be mutated | `known_damage` array modified or cleared by a conflict |
| No universal numeric thresholds hardcoded | Any hardcoded threshold without ENGINEERING_ENVELOPE label |
| No NEURO-LOCK commands issued | Any hardware actuation command in Phase 2 output |

---

## Acceptance Criterion 6: Provenance Chain

**All admitted packets must be traceable from `provenance_root` to their constituent witness packets.**

The `AircraftStateObject.provenance_root` SHA-256 must be independently reproducible from the canonical serializations of the admitted packets.

---

## Acceptance Criterion 7: Evidence Preservation

**All Phase 2 hardware bench outputs must be preserved as sealed evidence:**

- Bench session log (admitted/rejected packets, failure codes)
- All `AuthorizationDecision` objects with `decision_receipt`
- All `AircraftStateObject` outputs with `provenance_root`
- Attack-vector test run log (pass/fail per attack)
- Hardware public keys used (key IDs and public key bytes only — no private keys)

---

## Not Acceptance Criteria (Explicitly Excluded)

- NEURO-LOCK actuation (Phase 3)
- FAA-regulatory return-to-service authorization
- Autonomous operational release without human-in-the-loop signoff
- Production-scale key management
- Persistent state across receiver restarts
- Multi-aircraft parallel evaluation
