# LNES-60 Phase 1.5 — Pilot Report (real-model M0/M1/M2)

**Status: PILOT, NOT the full-scale Phase 1.5 experiment.** 18 of the 50
sealed holdout cases x 3 arms = 54 evaluations, using real Agent-tool
subagent dispatch (`REAL_MODEL: claude-sonnet-5 subagent dispatch`) in
place of Phase 1's `MODEL_SIMULATOR: RULE_BASED_REFERENCE`. This pilot
exists to sanity-check the operator's core Phase 1.5 hypothesis — does a
real model reproduce the P0→P1 regression the rule-based simulator showed
— before committing to the full 50-case x 3-arm (150-evaluation) run at
Phase 1 scale. It is not a substitute for that full run and should not be
cited as Phase 1.5's final result.

## 1. What was reused unchanged from Phase 1

- **Architecture P1-0.1.0**, frozen at commit `784c55f`. All 7 files
  (`lnes60/state_types.py` through `lnes60/release_policy.py`) were
  hash-verified byte-identical against `LNES60_PRE_HOLDOUT_CODE_MANIFEST.json`
  before this pilot ran — no changes.
- **The sealed 50-case holdout** (`LNES60_RUNNER_HOLDOUT.json` /
  `LNES60_EVALUATOR_HOLDOUT.json`). This pilot draws its 18 cases from that
  set and reads no other evidence. `lnes60/tests/test_leakage.py` was
  re-run before dispatch (4/4 passed).
- **`lnes60/evaluator.py`** (`score_arm`, `candidate_vs_authorized_delta`) —
  used unmodified to score the pilot.
- **M2's authorized decision** is computed by re-running the FROZEN
  `convergence_engine.py` + `release_policy.py` on each case's evidence —
  never taken from the model. The model only supplies M2's pre-gate
  *candidate* interpretation of the already-converged state, exactly
  matching Phase 1's P2 candidate/authorized separation.

## 2. Pilot case selection (not a random sample)

18 of 50 cases, chosen to give full (both-instance) coverage of every KTX
class Phase 1's report identified as either the P0→P1 regression itself
(`known_damage_limited_scope_good`, `record_bad_witnesses_good`) or a class
P1 failed and P2's governance fixed (`config_epoch_stale_witness`,
`detached_sensor`, `mission_envelope_violation`, `record_good_trust_unknown`,
`replay_attack`, `stale_after_event` — 1 of 3 instances), plus three
baseline controls (`fully_consistent`, `tether_condition_healthy`,
`sensor_conflict`) where P1 already performed correctly. See
`phase1_5/pilot_cases.py` for the exact list and rationale.

**Because this set is deliberately stratified toward the hardest classes,
its aggregate accuracy/false-release percentages are NOT directly
comparable to Phase 1's full-50-case headline numbers (18%/64-66%/100%).**
The case-level findings below are the pilot's real output; the percentages
are pilot-internal only.

## 3. Results

| Arm | n | Release accuracy | False-release rate | False-release count | False-hold count |
|---|---:|---:|---:|---:|---:|
| M0 — documents only | 18 | 38.9% | 5.6% | 1 | 1 |
| M1 — documents + raw telemetry, ungoverned | 18 | 77.8% | 16.7% | 3 | 0 |
| M2 — governed (frozen convergence + gate) | 18 | 100% | 0% | 0 | 0 |

Full per-KTX-class breakdown and every raw response: `phase1_5/raw_results/`,
`phase1_5/generation_responses/`, `phase1_5/LNES60_PHASE1.5_PILOT_evaluator_output.json`.

## 4. The central question: does a real model reproduce the P0→P1 regression?

**On this pilot, no — not for the two classes that defined the regression.**

`known_damage_limited_scope_good` (HOLD-014, HOLD-034) and
`record_bad_witnesses_good` (HOLD-016, HOLD-036) were exactly the four
cases where Phase 1's rule-based P1 simulator let a scope-limited or
documentary-contradicted "GOOD" reading override a known defect (0/4
correct). The real model, given the identical raw evidence — including the
same `measurement_scope` field the rule-based simulator never checked —
correctly held on **4/4**. In each case its own stated reasoning explicitly
named the scope mismatch or the document/witness contradiction as the
reason to hold. This is the pilot's most important finding: the specific
"ungoverned reader is fooled by a plausible GOOD reading" failure mode does
not trivially reproduce in a real model reasoning over the same fields —
at least not on this evidence shape, at this sample size (n=4 per class,
2 classes).

**M1 still produced 3 false releases, but from a different mechanism than
the Phase 1 headline regression:**

- **HOLD-007** (`stale_after_event`) — the model held only a `GOOD`
  elongation reading with no visibility into the `hard_landing` event that
  occurred after it (M1, like Phase 1's P1, is never shown the events
  plane — that information exists only inside the governed convergence
  engine). This **does** reproduce a genuine P1-class blind spot: temporal/
  event invalidation is structurally invisible to the ungoverned arm,
  model or rule-based.
- **HOLD-015, HOLD-035** (`mission_envelope_violation`) — M0 and M1 are
  never shown mission-envelope status at all (neither is Phase 1's P0/P1
  design), so a false release here reflects the prompt's evidence scope,
  not a reasoning failure. Expected and structural, not a new finding.

## 5. A design difference from Phase 1 that limits one comparison

Phase 1's P2 candidate step saw only the converged hardware state, **not**
mission-envelope status — so its candidate→authorized delta could
demonstrate the gate independently catching a mission-envelope violation
the candidate missed (`LNES60_PHASE1_FINAL_VALIDATION_REPORT.md` §17,
2/2 prevented). This pilot's M2 prompt (`build_m2_prompt` in
`phase1_5/build_prompts.py`) includes the mission-envelope line in the
resolved-state text shown to the model. As a direct consequence, M2's
candidate decision already agreed with the authorized decision on all 18
pilot cases (`m2_candidate_vs_authorized_delta.candidate_false_release_count
== 0`) — **this pilot cannot speak to whether the LNES-22 gate adds value
beyond a real model's own candidate judgment**, only that the full governed
pipeline (M2 authorized) scored 100%/0% false-release. If the full-scale
Phase 1.5 run wants to reproduce Phase 1's internal candidate-vs-authorized
demonstration, the M2 prompt should withhold mission-envelope status from
the model, mirroring Phase 1's exact design.

## 6. What this does and doesn't establish

**Establishes (pilot-scale, n=18 stratified, not a random sample):**
- The full governed M2 pipeline continues to produce zero false releases
  on this evidence with a real model as the interpretation step.
- The specific "GOOD reading erases a known documented defect" failure
  mode that made Phase 1's headline finding does not trivially reproduce
  with a real model on the 4 holdout cases built for it.
- A real model, ungoverned, still produces false releases from a
  structurally different cause: blindness to the temporal/event plane it
  was never shown, which governance (M2) still corrects.

**Does not establish:**
- Whether the P0→P1-style regression is entirely simulator-specific, or
  would appear with different models, prompt phrasing, or a larger sample
  (n=4 per class is too small to rule out the failure mode; it only failed
  to reproduce on this run).
- Whether the LNES-22 gate adds value beyond a real model's candidate
  judgment (see §5 — this pilot's M2 prompt leaked mission info that
  Phase 1's design withheld).
- Full-scale accuracy/false-release rates comparable to Phase 1's 50-case
  headline numbers — this pilot is stratified, not random.

## 7. Recommendation

Do not report the 38.9%/77.8%/100% figures above as Phase 1.5's result —
they are a stratified pilot, disclosed as such throughout this document and
`phase1_5/`. Two options for the operator to choose between: (a) run the
same 18-case pilot on the remaining 32 holdout cases to complete a real
50 x 3 = 150-evaluation Phase 1.5 at full Phase 1 scale, fixing the M2
mission-envelope prompt leak identified in §5 first; or (b) treat this
pilot's finding — that the headline regression did not reproduce — as
sufficient signal to deprioritize further real-model spend on LNES-60 and
move to LNES60_PHASE2_HARDWARE_REQUIREMENTS.md instead. No architecture
changes to the frozen P1-0.1.0 engine are warranted by this pilot either
way.

---
*Pilot generated by a fresh Claude Code session per
`LNES60_PHASE1.5_HANDOFF.md`. All raw subagent verdicts, prompts, and
scoring code are preserved under `phase1_5/` for audit and to extend to
the remaining 32 cases without re-deriving anything.*
