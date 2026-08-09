# LNES-60 Phase 1 — Development Defect Log

Development phase: 100 synthetic dev cases (20 KTX classes x 5 each),
run against the deterministic engine only (no model required for
architecture defect-finding, per `LNES60_EXPERIMENT_PROTOCOL.md`).
Two findings; both resolved before freeze.

---

## Defect #1 — SENSOR_DEGRADED misclassification from continuous uncertainty (structural, fixed)

**Symptom:** `test_b_verified_match_healthy`, `test_l_replay_rejected`,
`test_r_full_release_eligible` all failed — a NOMINAL-health, in-scope,
correctly-bound, fresh, calibrated, non-replayed witness with a
realistic 2% measurement uncertainty was classified `SENSOR_DEGRADED`
instead of `VERIFIED_MATCH`.

**Root cause:** `witness_validator.py`'s admissibility check computed a
single continuous `weight` value (`1.0 * (1 - uncertainty)`, further
reduced if `sensor_health == DEGRADED`) and `convergence_engine.py` used
`weight < 1.0` as the sole trigger for the `SENSOR_DEGRADED` outcome.
Since almost any realistic sensor has *some* nonzero measurement
uncertainty, this made `VERIFIED_MATCH` nearly unreachable for any
non-perfect sensor — a structural defect, not a single bad fixture.

**Fix (structural, not example-specific):** Separated the two concepts.
`AdmissibilityResult` now carries `weight` (continuous, used only to
pick among multiple admissible witnesses) and `health_degraded` (a
discrete boolean, set only from `sensor_health == DEGRADED`).
`convergence_engine.py`'s `SENSOR_DEGRADED` branch now checks
`best_health_degraded`, never `weight`. This satisfies the general
invariant ("a NOMINAL-health sensor's ordinary measurement uncertainty
does not by itself demote it to degraded") rather than patching the
three failing fixtures individually.

**Regression test:** all three original failing tests now pass
unmodified; no new special-casing was added for them.

**Failure taxonomy category:** Convergence logic (closest to category L,
`CONVERGENCE_ERROR`, in `LNES60_FAILURE_TAXONOMY.md`'s pre-registered
list — the taxonomy's category 1, trust-property misclassification, is
the adjacent but distinct case of misclassifying *which* property failed
for an *inadmissible* witness; this defect was in how an *admissible*
witness's continuous confidence score leaked into a discrete
classification it wasn't meant to drive).

## Defect #2 — Ground-truth specification error in a newly-added test (not an engine defect)

**Symptom:** `test_config_epoch_stale_witness_not_naive_value_match`
failed: expected `CONFIGURATION_MISMATCH`, engine produced
`STALE_WITNESS`, for a witness whose value still matched the old
expectation but was taken before a powertrain-replacement event that
changed the configuration epoch.

**Root cause investigation:** Cross-checked against this project's own
already-frozen `LNES60_KTX_TEST_MATRIX.md`, class 14 ("Replay of
previously valid GOOD witness after configuration change"), which
already specifies `STALE_WITNESS` for this exact scenario shape
("config-change-relative, same mechanism as case 5's event-relative
staleness"). **The engine's actual output was correct and consistent
with already-established project documentation; the newly-written
test's expectation was the error**, introduced while writing the test
itself, not while building the engine.

**Fix:** Corrected the test's expected value and its accompanying
comment to `STALE_WITNESS`, with an explanation of why this is not
`CONFIGURATION_MISMATCH` (that state is reserved for an *admissible,
current-epoch* witness whose *value* disagrees with command state — not
for a witness invalidated by an epoch-changing event, which is event-
based staleness, the same mechanism as any other invalidating event).
Corrected the matching dev-case generator entry (`config_epoch_stale_
witness`, 5 instances) to the same expected value.

**Failure taxonomy category:** P (`GROUND_TRUTH_AMBIGUITY`) — specifically
a case where a *newly authored* expectation conflicted with
*already-established* project ground truth, caught by cross-referencing
rather than trusting the new test in isolation. Recorded per the
discipline that a ground-truth error is itself worth logging, not
silently corrected without a trace.

---

## Post-fix state

- 19/19 unit tests passing (`lnes60/tests/test_convergence.py`), covering
  KTX classes A, B, E, F, G, H, I, J, K, L, M, N, O, P, Q, R plus the two
  new dev-phase additions (config-epoch staleness, cross-predicate
  release-policy priority order).
- 100/100 synthetic dev cases passing against the live engine, 0
  mismatches, stratified 5 cases x 20 KTX classes
  (`dev_cases/dev_autopsy_results.json`).
- No further defects found in this development pass.

Architecture is frozen after this log — see `LNES60_PRE_HOLDOUT_CODE_MANIFEST.json`.
