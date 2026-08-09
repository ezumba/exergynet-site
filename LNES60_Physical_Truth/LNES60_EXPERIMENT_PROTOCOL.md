# LNES-60 Experiment Protocol

**Status: R&D / DESIGNED, protocol only — no run has occurred.** Defines
how the synthetic LNES-60 harness will be built and exercised, following
the same discipline as `LNES59_EXPERIMENT_MANIFEST.json` (freeze before
execution, no ground-truth leakage, retry policy defined in advance).

---

## 1. Purpose and scope

Test the state model (`LNES60_TRUTH_STATE_SCHEMA.json`) and resolution
logic (architecture document §3) against the KTX test matrix's 15 classes,
entirely in software, before any physical hardware campaign. **No
aircraft actuation, no live propulsion commands, no destructive hardware
interaction** — repeated here because it governs every design choice
below, not just a disclaimer.

## 2. Synthetic data generation

For each of the 15 KTX test classes, generate ≥2 concrete synthetic
instances (per the test matrix's stratification requirement), each
comprising:

- Synthetic `documentary_state` records (maintenance/inspection/
  provenance entries, timestamped)
- Synthetic `command_digital_state` records (mission/firmware/hardware-ID
  configuration)
- Synthetic `physical_witness_state` readings, each explicitly tagged
  `SIMULATED_WITNESS`
- Synthetic `witness_trust_state` records (calibration, freshness,
  binding, etc.) constructed to deliberately exercise the specific trust
  property each test class targets (per `LNES60_WITNESS_TRUST_MODEL.md`)
- A hand-derived expected resolution state (one of the eleven in the
  schema), traced against the architecture document's governing
  principle and the failure taxonomy's category definitions — **not**
  produced by running the resolution logic itself, mirroring LNES-59's
  ground-truth discipline exactly (hand-trace before execution)

All synthetic fixtures use `ENGINEERING_ENVELOPE` parameters explicitly
labeled `SYNTHETIC_TEST_VALUE` per the schema's requirement.

## 3. Freeze discipline

Before any harness execution:
1. Freeze the resolution logic implementation (the software that
   evaluates the four planes against the schema's rules).
2. Freeze the synthetic case set and its hand-derived expected states.
3. Record a manifest (`LNES60_EXPERIMENT_MANIFEST.json`, to be created at
   freeze time — not created by this protocol document itself, since the
   protocol precedes the freeze) hashing both.
4. No case's expected state may be adjusted after freeze except as a
   documented erratum, same discipline as
   `LNES59_EXECUTION_CHRONOLOGY_ERRATUM.md`.

## 4. Execution

For each frozen synthetic case: feed the four-plane fixture into the
frozen resolution logic; record the produced resolution state; compare
against the hand-derived expected state; classify any mismatch using
`LNES60_FAILURE_TAXONOMY.md`'s categories, never inventing a new
explanation not traceable to one of those categories without first
extending the taxonomy (dated, versioned).

## 5. Metrics

- Per-class resolution accuracy (produced state == expected state)
- Per-trust-property failure-detection accuracy (does the harness
  correctly identify *which* trust property failed, not just that
  *something* failed — category 1 of the failure taxonomy)
- Historical-erasure violations (target: zero, tolerance: zero — category
  3 is treated as severe, not averaged into an accuracy percentage)
- SENSOR_ALWAYS_WINS regressions (target: zero — category 4, same
  severity treatment)
- False-conflict-preservation-failure rate (category 7 — conflicts that
  should have been preserved but were silently resolved)
- Witness-type mislabeling incidents (category 9 — target: zero)
- Handshake payload compliance (category 8 — does the LNES-22-bound
  payload ever leak raw evidence or treat a state as self-authorizing,
  checked in the synthetic harness by inspecting payload construction,
  not by actually exercising a real LNES-22 instance)

## 6. Retry policy

Infrastructure failures (category 11 of the failure taxonomy) may be
retried with the identical fixture, following the LNES-59 precedent:
same-fixture requirement, max 2 retries, and a semantically-wrong
resolution is never retryable — only genuine execution/infrastructure
failures are.

## 7. What this protocol explicitly does not cover

Real sensor hardware integration (deferred to a future, physically-gated
phase, explicitly not authorized by this document). Real calibration
management system integration (flagged as an open dependency in
`LNES60_EDGE_WITNESS_INTEGRATION_MAP.md` §5). Statistical power analysis
for how many synthetic instances per class would be needed for a
publication-grade result — this protocol targets architecture validation
(does the state model behave correctly on constructed cases), not a
benchmark claim of the LNES-58/59 kind; if a benchmark-style report is
later desired, it should adopt the LNES-59 discipline explicitly
(sealed holdout, frozen evaluator, disclosed limitations) as a distinct,
later effort.

---

*Companion: `LNES60_KTX_TEST_MATRIX.md` (the 15 classes this protocol
generates instances for), `LNES60_FAILURE_TAXONOMY.md` (classification
standard), `LNES60_TRUTH_STATE_SCHEMA.json` (the schema fixtures conform
to).*
