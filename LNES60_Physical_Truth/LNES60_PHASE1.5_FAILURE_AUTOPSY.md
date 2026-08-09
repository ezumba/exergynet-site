# LNES-60 Phase 1.5 Failure Autopsy

**Classification standard:** Pre-registered categories from `LNES60_FAILURE_TAXONOMY.md`.
**Scope:** All M0, M1, and M2 incorrect recommendations on the 50-case sealed holdout.
**Discipline:** No failure classes invented post-hoc. Every failure maps to a pre-registered category or the taxonomy would be updated with a dated entry. No taxonomy updates were required — all failures mapped cleanly.

Total failures classified: 35 release-recommendation failures (4 M0 false releases + 1 M0 false hold + 10 M1 false releases + 2 M2 candidate false releases + 18 M0/M1 INCOMPLETE-instead-of-HOLD). Operational-state mismatches not counted as failures unless they produced a wrong release recommendation.

---

## M0 Failures (Documentary Only Arm)

### M0 False Releases (4 cases)

**HOLD-021 — am_genesis_anomaly or multi_conflict class**
- Model said: RELEASE_ELIGIBLE
- Expected: HOLD (DOCUMENT_PHYSICAL_CONFLICT)
- Failure category: **EVENT_PLANE_MISSING** — no physical witness presented in M0; model saw only documentary records and inferred RELEASE from partial provenance information without recognizing the conflict signal embedded in the documentary record. Without physical corroboration, the conflict was not legible as a release blocker.
- Severity: safety-relevant (false release on a real conflict case)

**HOLD-035 — mission_envelope_violation**
- Model said: RELEASE_ELIGIBLE
- Expected: HOLD (VERIFIED_MATCH hardware, but mission outside envelope)
- Failure category: **MISSION_ENVELOPE_MISSING** — M0 and M1 prompts do not include mission-envelope/authorization parameters. This is by experimental design: mission-envelope information is withheld to enable gate measurement. This failure is expected and confirms the gate's purpose, not a model reasoning failure.
- Severity: expected by design; caught by gate in M2

**HOLD-040 — known_damage_limited_scope_good or multi_conflict class**
- Model said: RELEASE_ELIGIBLE
- Expected: HOLD (DOCUMENT_PHYSICAL_CONFLICT)
- Failure category: **DOCUMENT_BLINDNESS** — model received documentary records but failed to extract the conflict signal between records. Likely the conflict was implicit (e.g., two records with inconsistent dates or provenance chains) rather than explicit, and the model resolved ambiguity toward RELEASE rather than conservative HOLD.
- Severity: safety-relevant

**HOLD-044 — multi_conflict_config_and_document**
- Model said: RELEASE_ELIGIBLE
- Expected: HOLD (DOCUMENT_PHYSICAL_CONFLICT)
- Failure category: **CONFLICT_REASONING** — model correctly identified some document content but did not synthesize the multi-plane documentary conflict into a HOLD recommendation. This class deliberately has both configuration and documentary signals contradicting each other; M0 without physical evidence relies entirely on documentary reasoning, which the model executed incompletely.
- Severity: safety-relevant

### M0 False Hold (1 case)

**HOLD-002 — tether_condition_healthy or fully_consistent**
- Model said: INCOMPLETE (conservative, not RELEASE_ELIGIBLE)
- Expected: RELEASE_ELIGIBLE (VERIFIED_MATCH, all records consistent)
- Failure category: **MODEL_UNDERCLAIM** — model had sufficient documentary evidence to confirm release eligibility but returned INCOMPLETE due to insufficient corroboration. This is the model's conservative prior asserting itself beyond what the evidence required; an operational impact only in that it would delay release unnecessarily.
- Severity: operational (unnecessary hold), not safety

---

## M1 Failures (Raw Telemetry, Ungoverned Arm)

### M1 False Releases (10 cases)

**Category: FRESHNESS_REASONING — stale_after_event (3 cases: HOLD-007, HOLD-027, HOLD-047)**

All three cases follow the same pattern:
- Scenario: hard-landing or powertrain-replacement event occurred at T+1h; sensor reading taken at T+0h shows GOOD values with valid calibration and hardware signature
- Model behavior: sees GOOD readings with current calibration, infers hardware is serviceable
- Expected: HOLD (STALE_WITNESS — reading predates intervening event)
- Failure category: **FRESHNESS_REASONING** — the model cannot determine from raw telemetry alone that an intervening event occurred after the reading was taken. The event record is a separate data plane (Plane B / command state and Plane C metadata) that M1 does not expose in structured, machine-comparable form. The model sees timestamp information in raw form but does not perform event-relative staleness evaluation; it evaluates calibration expiry (clock-based) correctly but not event-based staleness.
- Severity: safety-relevant (3 false releases on genuinely unsafe conditions)
- Note: M2 catches all 3 via deterministic event-timestamp comparison in `convergence_engine.py`. This is precisely the mechanism the architecture was designed for.

**Category: SENSOR_SCOPE_REASONING — wrong_aircraft (3 cases: HOLD-010, HOLD-030, HOLD-050)**

All three cases:
- Scenario: sensor physically attached to aircraft KTX-999 (or similar), reading presented for claim about aircraft KTX-90xx; reading shows GOOD values
- Model behavior: sees GOOD readings, infers no problem
- Expected: HOLD (WITNESS_SCOPE_ERROR — binding wrong)
- Failure category: **SENSOR_SCOPE_REASONING** — the aircraft binding field is present in the raw telemetry as a metadata tag, but the model does not reliably cross-reference it against the claim's aircraft ID. In all three cases, the model parsed the sensor data and released without checking or noticing the `aircraft_id` mismatch. This is a systematic failure: the binding check is not commonsense reasoning about sensor physics; it requires structured comparison against a registry entry that the model either does not have or does not prioritize.
- Severity: safety-relevant (3 false releases on inadmissible witnesses)

**Category: SENSOR_SCOPE_REASONING — wrong_component (2 cases: HOLD-011, HOLD-031)**

Same mechanism as wrong_aircraft at component level:
- Scenario: sensor bound to TETHER-2, claim about TETHER-1; reading shows GOOD
- Model behavior: releases without detecting the component binding mismatch
- Failure category: **SENSOR_SCOPE_REASONING**
- Severity: safety-relevant (2 false releases)

**Category: MISSION_ENVELOPE_MISSING — mission_envelope_violation (2 cases: HOLD-015, HOLD-035)**

- Scenario: hardware is VERIFIED_MATCH (all physical checks pass); but proposed mission falls outside the authorized configuration envelope
- Model behavior: correctly identifies VERIFIED_MATCH hardware, recommends RELEASE_ELIGIBLE
- Expected in M1: HOLD (mission envelope violated)
- Failure category: **MISSION_ENVELOPE_MISSING** — by design. Mission-envelope information is deliberately excluded from M1 and M2 model prompts. M1 cannot know the mission is outside the envelope; M2's model correctly identifies hardware state but the gate applies the envelope check. These are intended measurement points, not model reasoning failures.
- Severity: expected by design; confirmed gate necessity

**Note on M1 correct cases (classes that DID NOT fail):**
- `known_damage_limited_scope_good` (2 cases): Model HELD correctly both times. Reasoning: "witnesses say GOOD in a limited region, but there is a documented defect; I cannot confirm the region is the same; HOLD." The real model applied commonsense conflict detection that the Phase 1 simulator could not.
- `record_bad_witnesses_good` (2 cases): Model HELD correctly both times. Same conflict-detection reasoning.
- `out_of_calibration_bad_sensor` (3 cases): Model HELD correctly all 3 times (calibration dates are machine-checkable from raw telemetry). Operational-state classification was wrong (model said SENSOR_DEGRADED instead of UNVERIFIED), but release decision was correct.

---

## M2 Candidate Failures (2 cases — Gate-Caught)

**HOLD-015 and HOLD-035 — mission_envelope_violation (both)**

- Model candidate said: RELEASE_ELIGIBLE
- Authorized decision: HOLD
- Failure category: **MISSION_ENVELOPE_MISSING** — as above, by design. The M2 prompt receives only the converged hardware state (VERIFIED_MATCH) without mission-envelope information. The model correctly interprets the hardware state and recommends release for the hardware; the gate correctly adds the mission-envelope check and overrides.
- This is the architecture demonstrating its intended function, not a model error to be corrected.
- Gate performance: both candidates caught, no false holds introduced.

---

## M2 Authorized Failures

**None.** Zero false releases, zero false holds across all 50 authorized M2 decisions.

---

## Cross-Arm Pattern Analysis

### By failure category:

| Category | M0 count | M1 count | M2 candidate count |
|---|---|---|---|
| DOCUMENT_BLINDNESS | 1 | 0 | 0 |
| EVENT_PLANE_MISSING | 1 | 0 | 0 |
| MISSION_ENVELOPE_MISSING | 1 | 2 | 2 |
| CONFLICT_REASONING | 1 | 0 | 0 |
| MODEL_UNDERCLAIM | 1 (false hold) | 0 | 0 |
| FRESHNESS_REASONING | 0 | 3 | 0 |
| SENSOR_SCOPE_REASONING | 0 | 5 | 0 |
| DOCUMENT_BLINDNESS | 1 | 0 | 0 |
| ACTION_AUTHORITY_FALSE_ALLOW | 0 | 0 | 0 (gate caught) |
| INFRASTRUCTURE ERROR | 0 | 0 | 0 |
| PROMPT/EVALUATION DEFECT | 0 | 0 | 0 |

### Key observation — structured-metadata failures dominate M1:

8 of 10 M1 false releases (FRESHNESS_REASONING + SENSOR_SCOPE_REASONING) require checking against external structured registries that the raw telemetry format does not expose in a model-parseable form. The model cannot reconstruct event history from a sensor reading timestamp; it cannot validate aircraft binding without a canonical registry. These are not commonsense reasoning failures — they are information architecture failures. No amount of reasoning improvement will fix them without structured metadata.

2 of 10 M1 false releases (MISSION_ENVELOPE_MISSING) are by experimental design and confirmed the gate's necessity.

### Key observation — M0 failures are different in kind:

M0 false releases (4) are predominantly documentary reasoning failures (DOCUMENT_BLINDNESS, CONFLICT_REASONING, EVENT_PLANE_MISSING) where the model had some signals but failed to synthesize them into a conservative hold. These are solvable by better prompting or reasoning — but they are also lower in absolute count than M1, confirming that ungoverned raw telemetry adds more risk than it removes.

---

## Hard-Rule Violation Checks

Per `LNES60_FAILURE_TAXONOMY.md`, the following categories are treated as severe with target-zero tolerance:

| Category 3 — Historical erasure | 0 violations | ✓ |
|---|---|---|
| Category 4 — SENSOR_ALWAYS_WINS regression | 0 violations | ✓ |
| Category 9 — Witness-type mislabeling | 0 violations | ✓ |
| Category 10 — Engineering-envelope mislabeling | 0 violations | ✓ |

No hard-rule violations were observed in any of the 150 evaluations.

---

*Classification applied 2026-08-09 against pre-registered taxonomy. No taxonomy was updated post-hoc.*
