# LNES-60 Phase 1.5 Final Validation Report
## Real-Model Physical Truth Benchmark — 50-Case Sealed Holdout

**Status: VALIDATED (real-model benchmark complete)**
**Sealed:** 2026-08-09
**Architecture version:** P1-0.1.0 (frozen, byte-identical to Phase 1)
**Evaluator holdout:** `LNES60_EVALUATOR_HOLDOUT.json` (sealed, not modified)
**Model mechanism:** REAL_MODEL: claude-sonnet-5 subagent dispatch — distinct from Phase 1's rule-based simulator
**Cases:** 50 sealed synthetic holdout × 3 arms (M0/M1/M2) = 150 primary evaluations
**Completion:** 150/150 (no skipped cases, 0 errors)

---

## 1. Executive Summary

Phase 1.5 tested the LNES-60 physical-truth architecture using a real probabilistic language model (claude-sonnet-5) in place of Phase 1's deterministic rule-based reference simulator, against the same sealed 50-case holdout and frozen P1-0.1.0 decision logic. The four experimental questions are answered below.

**Headline results:**

| Arm | Op-state acc | Release acc | False-release rate | False-hold rate |
|---|---|---|---|---|
| M0 Documentary only | 18% | 28% | 8% (4/50) | 2% (1/50) |
| M1 Raw telemetry, ungoverned | 66% | 78% | **20% (10/50)** | 0% |
| M2 Governed (candidate) | 100% | — | 4% (2/50) | 0% |
| M2 Governed + LNES-22 gate (authorized) | 100% | **100%** | **0% (0/50)** | 0% |

**Gate performance:** 2 candidate false releases identified (HOLD-015, HOLD-035 — both mission-envelope-violation class). Gate prevented both. 0 gate-introduced false holds.

**Direction of core Phase 1 finding confirmed:** M1 (raw ungoverned telemetry) produced more false releases than M0 (documentary only) — 20% vs 8%. Governance (M2) eliminated all false releases. The specific class that drove Phase 1's regression was NOT reproduced; a different class set drove Phase 1.5's regression. See Section 6.

---

## 2. Experimental Design (Frozen)

**Three arms, same evidence, different presentation:**

- **M0 — Documentary/command only.** Model sees maintenance records, provenance entries, configuration state. No physical sensor telemetry. No mission-envelope information.
- **M1 — Documentary + raw physical telemetry, ungoverned.** Same as M0 plus raw sensor readings (values, health flags, calibration dates, hardware signatures) presented as structured data without deterministic trust/scope/freshness evaluation. No mission-envelope information.
- **M2 — LNES-60 governed.** The frozen `convergence_engine.py` pre-processes the full four-plane evidence set (documentary + command + physical witness + witness trust) deterministically into a single resolved operational state. The model sees only that resolved state — NOT the raw evidence, NOT mission-envelope information. A separate simulated LNES-22 gate then applies the mission-envelope authorization check to the model's candidate recommendation. The model's candidate decision and the authorized decision are preserved separately.

**Freeze discipline:** Architecture (`P1-0.1.0`) frozen before the holdout was created. Holdout cases and expected states frozen before any execution. No prompt modifications after the Phase 1.5 pilot's M2 mission-envelope leak fix (corrected and sealed at commit `67acd3f`, prior to this run). Ground truth from `LNES60_EVALUATOR_HOLDOUT.json`, not derivable from the prompts or model outputs.

**Model label preserved throughout:** `REAL_MODEL: claude-sonnet-5 subagent dispatch (Phase 1.5 pilot, NOT the Phase 1 rule-based simulator)` — every raw result record carries this label.

---

## 3. Question A — Documents → Raw Telemetry: Does M1 improve over M0?

**Answer: M1 improves operational-state classification (+48 pp) but worsens safety-relevant false-release rate (+12 pp). Net: mixed, safety-negative.**

| Metric | M0 | M1 | Δ |
|---|---|---|---|
| Operational-state accuracy | 18% | 66% | +48 pp |
| Release-recommendation accuracy | 28% | 78% | +50 pp |
| False-release rate | 8% | 20% | **+12 pp (worse)** |
| False-hold rate | 2% | 0% | -2 pp (better) |

Interpretation: Raw physical telemetry gives the model far more information to correctly classify what kind of problem exists (STALE_WITNESS, SENSOR_CONFLICT, etc.), but also creates new failure modes where the model over-trusts sensor readings that are temporally stale or bound to the wrong aircraft/component. The net safety effect is negative — M1 produces 2.5× more false releases than M0 on this holdout.

---

## 4. Question B — Phase 1 Simulator vs. Real Model: Same finding?

**Answer: Same direction, different mechanism. The real model did NOT reproduce the simulator's specific class-level regression; it failed on a structurally different set of classes.**

**Replication status — Phase 1 vs. Phase 1.5:**

| KTX class | P1 false releases | M1 false releases | Reproduced? |
|---|---|---|---|
| known_damage_limited_scope_good | Yes (GOOD sensor overrides documented defect) | **No** (real model held correctly: 2/2) | NO |
| record_bad_witnesses_good | Yes (GOOD sensor overrides conflict doc) | **No** (real model held correctly: 2/2) | NO |
| stale_after_event | Yes | Yes (3/3 false releases) | YES |
| wrong_aircraft | Yes | Yes (3/3 false releases) | YES |
| wrong_component | Yes | Yes (2/2 false releases) | YES |
| mission_envelope_violation | M1 N/A (envelope visible in P1 prompts) | Yes (2/2 false releases in M1; caught by gate in M2) | N/A |

**The Phase 1 surprise** was that the deterministic simulator let a scope-limited or documentary-contradicted GOOD reading override a known defect. The real model does not reproduce this failure: it reasons about the conflict ("witnesses say GOOD but there's a known defect document") and holds, apparently using commonsense conflict resolution that the rule-based simulator lacked.

**The Phase 1.5 finding** is structurally different: the real model fails on failures that require *metadata the model cannot reconstruct from raw telemetry* — specifically, whether a reading predates a known event (stale_after_event), and whether a reading is bound to the correct aircraft or component (wrong_aircraft, wrong_component). These are NOT commonsense failures; they require structured registry lookups that the raw telemetry format does not expose.

**Implication (not a Phase 1 correction):** Both findings are real. The Phase 1 simulator correctly identified that ungoverned physical evidence can worsen decisions; the Phase 1.5 real-model run adds the specific mechanism: temporal event-based staleness and binding scope verification are the primary failure modes for probabilistic models, not document-conflict override. These findings are complementary, not contradictory.

---

## 5. Question C — M1 → M2: Does Governance Materially Improve Results?

**Answer: Yes, dramatically. M2 authorized eliminates all false releases and achieves 100% accuracy across all 20 KTX classes.**

| Metric | M1 | M2 authorized | Δ |
|---|---|---|---|
| Operational-state accuracy | 66% | 100% | +34 pp |
| Release-recommendation accuracy | 78% | 100% | +22 pp |
| False-release rate | 20% (10/50) | 0% (0/50) | **-20 pp (100% relative reduction)** |
| False-hold rate | 0% | 0% | unchanged |

Specific classes corrected by governance:
- **stale_after_event** (3 classes): M1 = 0/3 release-correct; M2 = 3/3 ✓
- **wrong_aircraft** (3 classes): M1 = 0/3; M2 = 3/3 ✓
- **wrong_component** (2 classes): M1 = 0/2; M2 = 2/2 ✓
- **mission_envelope_violation** (2 classes): M2 candidate = 0/2; M2 authorized = 2/2 ✓ (gate)
- Every other class: M2 = 100% accuracy

Governance did not introduce any false holds. The improvement is purely subtractive on false releases.

---

## 6. Question D — M2 Candidate → Authorized: Gate Performance

**Answer: Gate prevented 2 candidate false releases, introduced 0 false holds. 100% relative false-release reduction at the gate boundary.**

The M2 design deliberately withholds mission-envelope/configuration-authorization information from the model and applies it via the simulated LNES-22 gate afterward. This tests the claim that PHYSICAL TRUTH ≠ ACTION AUTHORITY.

| Metric | Value |
|---|---|
| M2 candidate false releases | 2 (HOLD-015, HOLD-035) |
| M2 authorized false releases | 0 |
| False releases prevented | 2 (100% of candidate false releases) |
| Gate-introduced false holds | 0 |
| Relative false-release reduction | 100% |

**Both caught cases share the same pattern:**

```
Physical hardware state: VERIFIED_MATCH (hardware is individually healthy)
Model candidate recommendation: RELEASE_ELIGIBLE (correct re: hardware)
Mission profile authorization check: VIOLATION (mission parameters exceed authorized envelope)
Authorized decision: HOLD
```

This is the clearest demonstration of the separation PHYSICAL TRUTH ≠ ACTION AUTHORITY in Phase 1.5. xLMP + LNES-60 correctly establishes that the hardware is in a healthy, consistent state. LNES-22 (simulated) correctly establishes that the proposed mission falls outside the authorized envelope for that hardware. Neither step is sufficient alone.

---

## 7. Per-Class Results Summary

| KTX class | n | M0 rel-acc | M1 rel-acc | M2 rel-acc | M1 false-rel | M2 false-rel |
|---|---|---|---|---|---|---|
| tether_condition_bad | 3 | 0% | 100% | 100% | 0 | 0 |
| tether_condition_healthy | 3 | 67% | 100% | 100% | 0 | 0 |
| am_genesis_anomaly | 3 | 67% | 100% | 100% | 0 | 0 |
| iron_web_geometry_mismatch | 3 | 33% | 100% | 100% | 0 | 0 |
| propulsion_identity_mismatch | 3 | 0% | 100% | 100% | 0 | 0 |
| correct_motor_wrong_firmware | 3 | 0% | 100% | 100% | 0 | 0 |
| stale_after_event | 3 | 0% | **0%** | 100% | **3** | 0 |
| sensor_conflict | 3 | 0% | 100% | 100% | 0 | 0 |
| out_of_calibration_bad_sensor | 3 | 0% | 100% | 100% | 0 | 0 |
| wrong_aircraft | 3 | 0% | **0%** | 100% | **3** | 0 |
| wrong_component | 2 | 0% | **0%** | 100% | **2** | 0 |
| replay_attack | 2 | 0% | 100% | 100% | 0 | 0 |
| detached_sensor | 2 | 0% | 100% | 100% | 0 | 0 |
| known_damage_limited_scope_good | 2 | 100% | 100% | 100% | 0 | 0 |
| mission_envelope_violation | 2 | 0% | **0%** | 100%* | **2** | 0 |
| record_bad_witnesses_good | 2 | 100% | 100% | 100% | 0 | 0 |
| record_good_trust_unknown | 2 | 100% | 50% | 100% | 0 | 0 |
| fully_consistent | 2 | 100% | 100% | 100% | 0 | 0 |
| config_epoch_stale_witness | 2 | 0% | 100% | 100% | 0 | 0 |
| multi_conflict_config_and_document | 2 | 50% | 100% | 100% | 0 | 0 |

*mission_envelope_violation M2: candidate 0% (2 false releases), authorized 100% (gate caught both)

**Classes where M1 fails completely (all instances false release):** stale_after_event, wrong_aircraft, wrong_component, mission_envelope_violation.

**Classes where M0 also fails (no correct decisions):** stale_after_event, wrong_aircraft, wrong_component, propulsion_identity_mismatch, correct_motor_wrong_firmware, sensor_conflict, out_of_calibration_bad_sensor, replay_attack, detached_sensor, config_epoch_stale_witness, mission_envelope_violation — 11 of 20 classes produce 0% M0 release accuracy. All corrected by M2.

---

## 8. Maturity Caveats (Mandatory — Read Before Citing)

1. **Synthetic data only.** Every witness record carries `SIMULATED_WITNESS` by hard rule. No real sensor hardware, no real aircraft, no real calibration system involved at any point in this benchmark.

2. **Single model.** These results are for claude-sonnet-5 subagent dispatch. Results for other models, temperatures, or system-prompt variants may differ.

3. **Self-authored holdout.** The holdout was created by the same team that designed the architecture. Independent third-party validation has not occurred.

4. **20 synthetic classes, limited instances.** The holdout covers 20 KTX classes with 2–3 instances each. Class-level conclusions (e.g., "stale_after_event fails in M1") rest on 3 cases. This is architecture validation, not a publication-grade statistical claim.

5. **No autonomous return-to-service.** This experiment establishes that a governed architecture outperforms ungoverned telemetry ingestion on synthetic test cases. It does not validate autonomous regulatory return-to-service, autonomous airworthiness determination, or any action on real flight hardware.

6. **FAA Exemption 26214 scope.** KTX Tensile-Lift operations remain governed by the exemption's operating procedures. Nothing in this benchmark replaces or supersedes any legally required inspection, signoff, or airworthiness certificate.

---

## 9. Relationship to Phase 1

Phase 1 used a deterministic rule-based reference simulator (`MODEL_SIMULATOR: RULE_BASED_REFERENCE`) — not a language model — to execute the same 150-case matrix. Phase 1.5 uses a real probabilistic model (claude-sonnet-5). These are two separate evidence layers:

- Phase 1 established that the deterministic convergence logic behaves correctly: given correct governance inputs, it produces correct outputs at 100% accuracy. The question it could not answer is whether a real model, given the governed resolved state, would correctly interpret it.
- Phase 1.5 answers that question: yes, when presented with the deterministic resolved state (M2), a real model reaches 100% accuracy. The Phase 1 and Phase 1.5 M2/P2 results agree exactly.

Phase 1 remains frozen historical evidence. See `LNES60_PHASE1_FINAL_VALIDATION_REPORT.md` and `LNES60_PHASE1_FINAL_RESULTS_MANIFEST.json`.

---

## 10. Deliverables

| File | Description |
|---|---|
| `LNES60_PHASE1.5_FINAL_VALIDATION_REPORT.md` | This document |
| `LNES60_PHASE1.5_FINAL_RESULTS_MANIFEST.json` | Sealed results manifest with evidence hashes |
| `LNES60_PHASE1_VS_PHASE1.5_COMPARISON.md` | Direct simulator-vs-real-model comparison |
| `LNES60_PHASE1.5_FAILURE_AUTOPSY.md` | Per-failure classification under the pre-registered taxonomy |
| `phase1_5/LNES60_PHASE1.5_evaluator_output.json` | Machine-readable full scoring output |
| `phase1_5/raw_results/` | 150 scored raw result records |
| `phase1_5/generation_responses/` | 150 raw model generation responses |

---

*Phase 1 frozen: `784c55f`. Phase 1.5 checkpoint: `67acd3f`. Dispatch completion: 2026-08-09.*
