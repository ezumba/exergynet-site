# LNES-60 Phase 1 vs. Phase 1.5 — Direct Comparison

**Phase 1:** Deterministic rule-based reference simulator (`MODEL_SIMULATOR: RULE_BASED_REFERENCE`)
**Phase 1.5:** Real probabilistic language model (claude-sonnet-5 subagent dispatch)
**Holdout:** Same sealed 50-case synthetic holdout, same frozen P1-0.1.0 architecture
**Purpose:** Determine what changes when the "model" is real, not rule-based

---

## 1. Top-Level Metrics

|  | Phase 1 Simulator | Phase 1.5 Real Model |
|---|---|---|
| **Generation mechanism** | Rule-based deterministic harness | claude-sonnet-5 subagent dispatch |
| **Cases / arms** | 50 × 3 = 150 | 50 × 3 = 150 |
| **P0 / M0 op-state accuracy** | 18% | 18% |
| **P0 / M0 release accuracy** | 18% | 28% |
| **P0 / M0 false-release rate** | **30%** | **8%** |
| **P1 / M1 op-state accuracy** | 64% | 66% |
| **P1 / M1 release accuracy** | 66% | 78% |
| **P1 / M1 false-release rate** | **34%** | **20%** |
| **P2 / M2 authorized op-state accuracy** | 100% | 100% |
| **P2 / M2 authorized release accuracy** | 100% | 100% |
| **P2 / M2 authorized false-release rate** | 0% | 0% |
| **Candidate false releases (gate input)** | 2 | 2 |
| **Authorized false releases (gate output)** | 0 | 0 |
| **Gate false releases prevented** | 2 (100%) | 2 (100%) |
| **Gate-introduced false holds** | 0 | 0 |

---

## 2. Key Agreements

**Both experiments agree on all of the following:**

1. **M2/P2 governance achieves 100% accuracy** with zero false releases and zero false holds. The deterministic convergence engine's output is correct on every case, and the real model correctly interprets that resolved state.

2. **Raw telemetry without governance (M1/P1) is worse than documentary-only (M0/P0) on false-release rate.** Phase 1: 34% vs 30%. Phase 1.5: 20% vs 8%. The direction is the same; the magnitude differs (see Section 3).

3. **Two candidate false releases (HOLD-015, HOLD-035), both mission-envelope-violation class, both caught by the gate.** The same two cases produce candidate false releases in both experiments, and the simulated LNES-22 gate prevents both in both experiments.

4. **Gate introduces zero false holds** in both experiments.

5. **Operational-state classification accuracy** is similar (M1 66% real vs P1 64% simulator) — the model and simulator have comparable ability to infer what kind of problem exists from raw telemetry.

---

## 3. Key Discrepancies

### 3.1 M0/P0 False-Release Rate (8% vs. 30%)

The deterministic simulator produced 15 false releases in the documentary-only condition (P0, 30%). The real model produced only 4 (M0, 8%).

**Explanation:** The simulator had a specific rule for documentary-only cases: when no physical evidence was present, it defaulted toward RELEASE if any documentary record said SERVICEABLE. The real model reasons more conservatively — it frequently returns INCOMPLETE when records are minimal, rather than releasing. This behavioral difference is not a flaw in either; it reflects a design choice about how to handle uncertainty. The simulator's behavior was disclosed as deterministic reference, not optimal policy.

### 3.2 P1/M1 False-Release Rate (34% vs. 20%)

The simulator produced 34% false releases with raw telemetry (P1); the real model produced 20% (M1).

**Explanation:** The real model is more conservative with raw sensor data than the simulator was. It applies commonsense reasoning (e.g., "this sensor report looks suspicious given the documentary context") that the rule-based simulator could not. However, both are substantially worse than governance — the real model's 20% false-release rate with raw telemetry is still 20× the 0% rate achieved by governance.

### 3.3 Class-Level Failure Pattern

| KTX class | Phase 1 P1 reg? | Phase 1.5 M1 false releases | Same class? |
|---|---|---|---|
| known_damage_limited_scope_good | **Yes** (good sensor overrides defect doc) | No (2/2 correct in M1) | **NO** |
| record_bad_witnesses_good | **Yes** (good sensor overrides conflict doc) | No (2/2 correct in M1) | **NO** |
| stale_after_event | Yes | **Yes (3/3 false releases)** | YES |
| wrong_aircraft | Yes | **Yes (3/3 false releases)** | YES |
| wrong_component | Yes | **Yes (2/2 false releases)** | YES |
| mission_envelope_violation | (mixed in P1 due to envelope visible) | **Yes (2/2 false releases in M1)** | N/A |

**The Phase 1 "GOOD sensor overrides documented defect" failure is NOT reproduced.** The real model correctly holds on `known_damage_limited_scope_good` and `record_bad_witnesses_good` cases — it has commonsense reasoning about document-sensor conflicts that the deterministic simulator lacked.

**The Phase 1.5 M1 failure mechanism is different:** stale-after-event and binding-scope errors. These require knowledge the model cannot infer from raw telemetry: whether a reading predates a specific real-world event, and whether a sensor is bound to the claimed component/aircraft. These are not commonsense failures; they are structured-metadata failures.

---

## 4. Failure Classes: Reproduced, NOT Reproduced, New

### Failure classes reproduced in M1 (both simulator and real model fail):

1. **stale_after_event** — a sensor reading taken before a hard-landing event reads GOOD, model releases. Both simulator and real model fail. The deterministic governance system catches this by checking event timestamps.

2. **wrong_aircraft** — sensor bound to aircraft KTX-999 presented for aircraft KTX-90xx, real model reads GOOD values and releases. Both fail. Governance catches via binding check.

3. **wrong_component** — same mechanism as wrong_aircraft at component level. Both fail.

### Failure classes in Phase 1 NOT reproduced in Phase 1.5 (simulator-only):

4. **known_damage_limited_scope_good** — simulator let a scope-limited GOOD reading override a documented defect. Real model HOLDS (2/2 correct in M1) — it recognizes the conflict between "sensor says GOOD" and "document says DEFECT."

5. **record_bad_witnesses_good** — simulator let a GOOD reading override a contradicting document. Real model HOLDS (2/2 correct in M1).

### New model-specific observations not anticipated by Phase 1:

6. **Commonsense conflict detection present in real model** — the real model applies reasoning about document-sensor conflicts that the rule-based simulator could not. This provides partial mitigation of some failure modes at the raw-telemetry level, but creates an illusion of safety: the model's reasoning about conflicts is reliable on the simple cases it has seen in training, but fails completely on temporal and binding failures that require structured metadata.

7. **Mission-envelope design separation confirmed** — M2's deliberate withholding of mission-envelope data, then gate application, is necessary in the real-model setting: the model correctly interprets VERIFIED_MATCH hardware state and recommends release (correct re: hardware), but the gate catches the mission-envelope violation. This separation is not an artifact of the simulator.

### Governance failures:

None in either experiment. Zero P2/M2 authorized false releases. Zero P2/M2 false holds.

---

## 5. Summary Interpretation

**What Phase 1 established:** The deterministic convergence engine produces correct outputs 100% of the time on these 50 cases. Whether a real model would correctly interpret those outputs was an open question.

**What Phase 1.5 adds:** A real model correctly interprets the convergence engine's outputs 100% of the time (M2 authorized: 100% accuracy). A real model with raw telemetry (M1) fails systematically on temporal event-based staleness and binding scope verification — not because of document-conflict confusion (which it handles well), but because those failure modes require structured registry lookups the raw format doesn't provide.

**Strategic upshot:** The LNES-60 architecture provides a qualitatively different capability for the specific failure modes that matter most for KTX Tensile-Lift safety (stale-after-event, binding scope). A real model with raw telemetry has sufficient commonsense reasoning to handle document-conflict cases but is blind to the failure modes that require deterministic, time-indexed, identity-anchored metadata evaluation. Governance is not merely better — it addresses a structurally different problem that commonsense reasoning cannot solve.

---

*Phase 1 sealed: 2026-08-08. Phase 1.5 sealed: 2026-08-09. Architecture version P1-0.1.0 frozen in both.*
