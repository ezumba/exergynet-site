# LNES-60 Phase 1 — Physical Truth Validation Report

**Status: COMPLETE.** Synthetic software experiment. R&D only. No
aircraft actuation, no live propulsion commands, no destructive hardware
interaction, no production deployment anywhere in this work.
**MODEL_SIMULATOR: RULE_BASED_REFERENCE, NOT AN LLM** was used for the
P0/P1/P2-candidate reasoning steps — see Section 24 (Model Consistency)
for why, and treat every accuracy figure below as a
**DETERMINISTIC HARNESS RESULT**, not a claim about real-model
performance.

---

## 1. Executive finding

On a 50-case sealed, post-freeze synthetic holdout for the KTX
Tensile-Lift architecture, an ungoverned reasoner relying on documentary
records alone (P0) reached the correct release recommendation in **18%**
of cases with a **30% false-release rate**. Adding raw physical telemetry
without governance (P1) raised overall accuracy to **64-66%** but the
false-release rate **did not improve — it rose slightly to 34%**, and on
two specific KTX classes P1 was *worse* than P0 (it let a
scope-limited or documentary-contradicted "GOOD" reading override a
known defect). The full governed pipeline (P2: deterministic witness
validation → convergence → simulated LNES-22 gate) reached **100%**
release-recommendation accuracy with **0% false releases**, and its
internal candidate→authorized delta shows the gate specifically
prevented 2 of 2 false-release candidate decisions the model-simulator
step produced on its own (100% relative reduction on this holdout).

## 2. Exact hypothesis

> Physical telemetry does not become authoritative operational state
> merely because it exists. A trustworthy autonomous system must govern
> the identity, freshness, calibration, scope, temporal applicability,
> and configuration binding of physical evidence before using that
> evidence to authorize action.

Tested, not assumed — see Section 32 for the outcome against this
specific proposition.

## 3. Tensile-Lift motivation

KTX's heavy-lift Tensile-Lift architecture (Bolt, FAA Exemption No.
26214, per the Living White Paper Section 30.1) depends on
condition-based components (tether, Iron Web/pawl geometry) whose
service life and safety margin are not fully captured by documentary
maintenance records alone. This experiment tests, in software only,
whether a deterministic convergence architecture can correctly withhold
release when documentary, commanded, and physical-witness state
disagree — before any bench hardware campaign is designed.

## 4-6. Physical Truth architecture, four truth planes, witness trust model

See `LNES60_PHYSICAL_TRUTH_ARCHITECTURE.md` and
`LNES60_WITNESS_TRUST_MODEL.md` (unchanged by this validation pass,
implemented as designed — see Section 9 for the two development-phase
findings against that design).

## 7. Development chronology

100 synthetic development cases across 20 KTX classes (5 each),
corpus-first (world constructed before expected outcome), run against
the live deterministic engine to find real defects before freeze. See
`LNES60_PHASE1_DEV_DEFECT_LOG.md` for full detail.

## 8. Defects discovered and repaired

Two findings during development, both resolved before freeze:

1. **Structural defect (fixed):** `SENSOR_DEGRADED` was triggered by any
   nonzero measurement uncertainty (via a shared continuous `weight`
   value), making `VERIFIED_MATCH` nearly unreachable for any
   realistically-imperfect sensor. Fixed by separating the continuous
   confidence weight (used only to rank multiple admissible witnesses)
   from the discrete `health_degraded` signal (set only from actual
   sensor health) — a general invariant repair, not a per-fixture patch.
2. **Ground-truth specification error (not an engine defect):** a
   newly-authored test expected `CONFIGURATION_MISMATCH` for a
   config-epoch-invalidated witness; cross-checking against the
   already-frozen `LNES60_KTX_TEST_MATRIX.md` class 14 showed the
   engine's actual output (`STALE_WITNESS`) was correct and the new
   test's expectation was the error. Corrected the test, not the engine.

Zero further defects found in the 100-case development set after these
two fixes (0/100 mismatches at freeze).

## 9. Architecture freeze

Frozen at commit `784c55f` (`LNES60_PRE_HOLDOUT_CODE_MANIFEST.json`),
scoped to the 7 decision-logic files (`state_types.py` through
`release_policy.py`). `synthetic_generator.py` was explicitly excluded
from the freeze (holdout-authoring tooling, not decision logic — same
distinction LNES-59 drew for its execution harness) and was
parameterized (additively, dev-case output unchanged) to author the
holdout with a guaranteed-disjoint fresh ID space.

## 10. Holdout methodology

50 cases, 20 KTX classes, every class hit ≥2 times, fresh ID space
(`HOLD-` / `KTX-9xxx`, disjoint by construction from the dev corpus's
`DEV-` / `KTX-1xx`). Ground truth hand-authored inside the generator
(never derived by calling the frozen engine). Runner/evaluator air-gap
split verified by 4 automated leakage tests (`lnes60/tests/test_leakage.py`,
all passing): no ground-truth field names or values present anywhere in
`LNES60_RUNNER_HOLDOUT.json`, disjoint ID spaces confirmed
programmatically, and evaluator-file completeness confirmed.

## 11-14. P0 / P1 / P2 candidate / P2 authorized results

| Arm | Operational-state accuracy | Release-recommendation accuracy | False-release rate | False-hold rate |
|---|---|---|---|---|
| P0 (documentary only) | 18% | 18% | 30% (15/50) | 0% |
| P1 (raw telemetry, ungoverned) | 64% | 66% | 34% (17/50) | 0% |
| P2 candidate (pre-gate) | — | — | 4% (2/50) | 0% |
| P2 authorized (post-gate) | 100% | 100% | **0% (0/50)** | 0% |

(P2 candidate accuracy is reported only via the false-release count
above, per Section 11's instruction to preserve both pre- and post-gate
output without scoring the candidate step as "model intelligence.")

## 15. P0→P1 delta: what does raw telemetry add?

Overall accuracy rose sharply (18%→64-66%) — most KTX classes with a
single, textually-salient bad value or ID mismatch (firmware,
propulsion identity, sensor conflict, wrong-aircraft/component, AM
provenance, Iron Web geometry) went from 0/n correct under P0 to n/n
correct under P1, because the raw value is now visible at all. **But
the false-release rate did not improve, and two classes actively
regressed**: `known_damage_limited_scope_good` and
`record_bad_witnesses_good` both scored 2/2 correct under P0 (which,
seeing no physical evidence at all, correctly deferred to the
documentary defect record) and **0/2 under P1** — P1's naive
value-at-face-value reading let a scope-limited or documentary-
contradicted "GOOD" reading override a known defect, exactly the
failure mode the witness-scope and conflict-preservation mechanisms are
designed to prevent. **Raw telemetry is not a strict improvement over
documents alone on this holdout; it traded one class of error for
another, more dangerous one on 2 classes while fixing 10.**

## 16. P1→P2 delta: what does governing that telemetry add?

Release-recommendation accuracy: 66%→100%. False-release rate: 34%→0%.
Every class where P1 failed (`config_epoch_stale_witness`,
`detached_sensor`, `known_damage_limited_scope_good`,
`mission_envelope_violation`, `record_bad_witnesses_good`,
`record_good_trust_unknown`, `replay_attack`, `stale_after_event`) was
fully corrected by governance — these are precisely the classes that
depend on calibration, freshness, scope, replay, or configuration-epoch
reasoning that P1's naive reader does not systematically perform.

## 17. P2 candidate→authorized delta: what does the gate add on top of a resolved state?

2 of 50 cases (`HOLD-015`, `HOLD-035`, both `mission_envelope_violation`)
show the internal delta directly: the convergence engine correctly
resolved hardware state to `VERIFIED_MATCH` (every component
individually healthy), the model-candidate step naively mapped that to
`RELEASE_ELIGIBLE` (it only sees the converged hardware state, not the
mission profile), and the simulated LNES-22 gate correctly overrode to
`HOLD` because the mission profile itself exceeds the authorized
configuration. **100% of the candidate step's false-release outputs
were prevented by the gate on this holdout (2/2), with zero
gate-introduced false holds.** This is the clearest, most literal
demonstration in this experiment of the "hardware individually healthy
≠ release eligible" principle stated in Section 32.

## 18. False release analysis

P0: 15/50 (30%) — concentrated across nearly every class except the two
where the document itself flagged a defect and no contradicting
evidence was shown. P1: 17/50 (34%) — see Section 15's regression
analysis; the increase over P0 traces specifically to the two
"telemetry overrides known defect" cases. P2: 0/50 — see Section 17.

## 19. False hold analysis

0% for all three arms on this holdout. Not a designed omission — the
20 KTX classes include several "everything agrees" and "expected GOOD"
controls, and none of the arms' failure modes happened to produce a
false hold in this specific case set. This is a genuine limitation of
what this holdout can say about false-hold behavior — see Section 29.

## 20. Witness-trust failures

`config_epoch_stale_witness`, `replay_attack`, `detached_sensor`, and
`stale_after_event` were the four KTX classes most directly testing
individual trust properties (calibration/epoch, anti-replay, sensor
health, event-based freshness respectively). P1 scored 0/n on all four;
P2 scored n/n on all four. This is the single clearest piece of evidence
that the witness-trust plane (not just "having a sensor reading at all")
is where the architecture's value concentrates.

## 21. Temporal/replay failures

`stale_after_event` (event-based staleness) and `replay_attack`
(anti-replay) were both 0/n under P1 and n/n under P2 — P1's logic
reads a witness's `value` field without checking `measurement_time`
against subsequent events or `anti_replay_token`/`replayed_from` at all.

## 22. Configuration mismatch analysis

`propulsion_identity_mismatch`, `correct_motor_wrong_firmware`, and
`multi_conflict_config_and_document` were all caught correctly by P1
(these have a directly visible value mismatch, not requiring
epoch-currency reasoning) as well as P2. `config_epoch_stale_witness`
— where the *value* matches the old expectation but the *epoch* has
changed — was the one configuration-adjacent class P1 missed entirely
(0/2), confirming naive value-comparison is insufficient once
configuration epochs are in play (Section 7's designed test).

## 23-26. Tensile tether / Iron Web / propulsion / manufacturing-provenance cases

- **Tensile tether** (`tether_condition_bad`/`healthy`): P0 correctly
  handles the "healthy, no contradiction" control (3/3) but cannot
  detect a bad condition without physical evidence (0/3); P1/P2 both
  correct once a witness is available (3/3 each).
- **Iron Web geometry** (`iron_web_geometry_mismatch`): same pattern —
  P0 0/3, P1 3/3, P2 3/3. The geometry value itself is textually salient
  enough that even naive P1 reading catches it.
- **Propulsion** (`propulsion_identity_mismatch`,
  `correct_motor_wrong_firmware`): both fully caught by P1 and P2 (the
  ID/version mismatch is directly visible); the one propulsion-adjacent
  failure for P1 was the epoch-currency case (Section 22), not a raw
  identity mismatch.
- **Manufacturing provenance** (`am_genesis_anomaly`): P0 0/3 (no
  physical process telemetry available to it by design), P1/P2 3/3.

## 27. Efficiency/latency

Not meaningfully measurable for this pass — the deterministic engine and
rule-based model-simulator both execute in well under a millisecond per
case (no real inference, no network calls). Reported honestly as N/A
rather than a fabricated latency figure; a real-model-in-the-loop run
would be the appropriate place to measure generation/gate latency
end-to-end, and did not occur in this pass (Section 24).

## 28. Failure autopsy

Every P1 failure traces to one of: naive value-at-face-value reading
without calibration/scope/replay/freshness/epoch checks (the design
intent of the model-simulator's disclosed blind spots, Section 24), or
letting a physical reading override a documentary conflict without
verifying the reading's scope actually covers the claim
(`known_damage_limited_scope_good`, `record_bad_witnesses_good`). No
P2 failures occurred on this holdout (0/50 across all metrics) — the
frozen engine's behavior matched the independently-hand-authored ground
truth exactly, which is itself a meaningful (not tautological) result
since holdout ground truth was never derived by running the engine.

## 29. Limitations

- **MODEL_SIMULATOR: RULE_BASED_REFERENCE, NOT AN LLM** was used
  throughout — see Section 24. This experiment validates the
  *architecture's* behavior (does governance help against a consistent,
  disclosed-blind-spot naive reasoner), not a real language model's
  behavior. A real-model-in-the-loop run is a natural, explicitly
  flagged next step, not performed in this pass.
- n=50 holdout cases; each case is 2 percentage points of every rate
  above.
- P2's 100%/0% result reflects that the frozen engine's logic and the
  holdout's independently-hand-authored ground truth agree exactly on
  this specific 50-case set — it does not prove the engine is correct
  on every conceivable physical-truth scenario, only these 20 classes
  and their instances.
- Zero false holds occurred in any arm on this holdout (Section 19) —
  this experiment says little about false-hold behavior specifically;
  a holdout deliberately stress-testing over-cautious governance would
  be a distinct, useful follow-up.
- Numeric near-duplicate sensor disagreement (e.g. 4.9% vs 5.0%
  elongation) is not distinguished from exact agreement by the frozen
  engine (known limitation, `LNES60_PRE_HOLDOUT_CODE_MANIFEST.json`).
- All witness data is `SIMULATED_WITNESS`; no real sensor, calibration
  system, or aircraft was involved anywhere in this pass.

## 30. Phase 2 hardware requirements

See `LNES60_PHASE2_HARDWARE_REQUIREMENTS.md` — required capability vs.
candidate hardware kept explicitly separate, prioritized by this
report's finding that trust-plane data (calibration, freshness, binding,
anti-replay), not just raw measurement sensors, is where the
architecture's demonstrated value concentrates.

## 31. Patent/new-matter chronology

See `LNES60_PATENT_DISCLOSURE_NOTE.md`, updated with an addendum
documenting this Phase 1 synthetic validation (Section 33 below).

## 32. Strongest defensible conclusion

On a 50-case sealed synthetic holdout, using a disclosed rule-based
reference reasoner (not a real LLM) applied identically across arms:
adding raw physical telemetry to documentary records alone improved
overall decision accuracy but did not improve — and on this holdout
slightly worsened — the false-release rate, with two specific failure
classes actively regressing (telemetry overriding a known documented
defect). Adding deterministic governance (witness trust validation,
state convergence, and a simulated release-authority gate) on top of
that same telemetry eliminated false releases entirely (34%→0%) and
specifically prevented 2 of 2 false-release candidate decisions the
model-simulator step produced before the gate was applied. This
supports, on this synthetic holdout with this reasoner, the proposition
tested in Section 2: physical telemetry does not become authoritative
merely by existing, and governing its identity, freshness, calibration,
scope, temporal applicability, and configuration binding materially
changes the safety-relevant outcome, not just the raw accuracy number.

## 33. What this experiment does NOT prove

Does not prove this holds for a real language model — see Section 29.
Does not constitute FAA certification, an aircraft flight test, a live
propulsion test, a production deployment, or a claim that autonomous
release authority replaces required human maintenance signoff (Section
25/32 of the directive; `RELEASE_ELIGIBLE` in this codebase is an
engineering authorization output only). Does not prove the architecture
generalizes beyond the 20 KTX classes tested here. Does not prove the
false-hold rate is low in general (Section 19/29 — zero false holds
occurred, but this holdout did not stress-test over-caution). Does not
constitute independent third-party validation — this holdout, like
LNES-59's, was authored by the same project, after the architecture was
frozen, with the same disclosure discipline.

---

*Sealed at completion of the 150/150 case-arm matrix. Companion:
`LNES60_PHASE1_FINAL_RESULTS_MANIFEST.json`.*
