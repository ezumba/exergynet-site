# LNES-60 KTX Test Matrix

**Status: R&D / DESIGNED, synthetic/software-testable only.** No aircraft
actuation, no live propulsion commands, no destructive hardware
interaction. Every case below uses `SIMULATED_WITNESS` data
(`LNES60_TRUTH_STATE_SCHEMA.json`'s witness-envelope type discipline) —
never presented as `HARDWARE_WITNESS`/real aircraft telemetry.

**Engineering discipline (repeated from the schema, binding for every
case below):** no numeric threshold in this matrix is a real qualified
engineering limit. Every number is an `ENGINEERING_ENVELOPE` parameter
explicitly labeled `SYNTHETIC_TEST_VALUE`. The specific figures in the
directive that seeded this matrix (0.1% tether elongation, 0.5mm pawl
tolerance, 10°C print deviation) are used below only as illustrative
synthetic values for test construction, not asserted as real limits.

---

| # | Test class | Truth planes exercised | Expected resolution state | Trust property under test |
|---|---|---|---|---|
| 1 | Tensile tether creep / elongation | Physical witness vs. documentary service-life | `DOCUMENT_PHYSICAL_CONFLICT` if elongation exceeds the synthetic envelope while documentary record still shows in-service; `VERIFIED_MATCH` if within envelope | Measurement precision, freshness |
| 2 | Additive-manufacturing genesis anomaly | Physical witness (manufacturing_process_telemetry) vs. command/digital (expected material/process parameters) | `CONFIGURATION_MISMATCH` | Sensor scope (process-telemetry coverage of the actual build) |
| 3 | "Iron Web" pawl/geometry mismatch | Physical witness (geometry) vs. command/digital (expected geometry) | `CONFIGURATION_MISMATCH` | Measurement uncertainty vs. synthetic tolerance envelope |
| 4 | Propulsion hardware identity mismatch | Physical witness (hardware_identity) vs. command/digital (expected_hardware_ids) | `CONFIGURATION_MISMATCH` | Sensor identity, aircraft/component binding |
| 5 | Valid sensor reading made stale by a later hard-landing/event | Physical witness vs. its own witness_trust_state.freshness | `STALE_WITNESS` | Freshness (event-relative, not just clock-relative) |
| 6 | Conflicting redundant sensors | Two physical witnesses, same scope, disagreeing | `SENSOR_CONFLICT` (preserved, not auto-resolved — see failure taxonomy item 13's principle applied here too) | Cross-witness reconciliation |
| 7 | Valid signed witness bound to wrong aircraft/component | Physical witness vs. witness_trust_state.aircraft_component_binding | `WITNESS_SCOPE_ERROR` | Aircraft/component binding |
| 8 | Known damage contradicted by a limited-scope GOOD sensor reading | Documentary (known damage) vs. physical witness (GOOD, but narrow scope) | `WITNESS_SCOPE_ERROR` on the physical witness for the broader claim; documentary damage record stands, unresolved conflict at the broader scope is `HOLD` if the broader claim is what's being evaluated | Measurement scope |
| 9 | Correct hardware / incorrect firmware | Physical witness (hardware_identity correct) vs. command/digital (firmware mismatch) | `CONFIGURATION_MISMATCH` (scoped to firmware, not hardware) | n/a (command-plane vs. physical-plane split, not a trust-property test) |
| 10 | Mission envelope exceeds validated aircraft configuration | Command/digital (mission_profile) vs. documentary (approved_configuration) | `CONFIGURATION_MISMATCH` | n/a (documentary-vs-command, no physical witness needed to detect this class) |
| 11 | Documentary service-life remaining but condition-based state outside engineering envelope | Documentary (service_life) vs. physical witness (condition telemetry) | `DOCUMENT_PHYSICAL_CONFLICT` | Measurement precision vs. synthetic envelope |
| 12 | Physical witness says BAD but calibration has expired | Physical witness vs. witness_trust_state.calibration | `UNVERIFIED` (not auto-trusted BAD, not auto-discarded) | Calibration |
| 13 | Documentary record says BAD while multiple fresh calibrated witnesses say GOOD | Documentary vs. multiple physical witnesses | `DOCUMENT_PHYSICAL_CONFLICT`, explicitly preserved as unresolved rather than the system erasing or overriding the documentary BAD record (architecture doc §4) | Cross-plane reconciliation without historical erasure |
| 14 | Replay of previously valid GOOD witness after configuration change | Physical witness (was valid) vs. witness_trust_state.anti_replay + command/digital (post-change state) | `STALE_WITNESS` (config-change-relative, same mechanism as case 5's event-relative staleness) | Anti-replay, freshness |
| 15 | Sensor physically detached but still cryptographically valid | Physical witness (hardware_signature valid) vs. witness_trust_state.sensor_health/aircraft_component_binding | `WITNESS_SCOPE_ERROR` or `UNVERIFIED` depending on whether detachment is independently detectable in the synthetic model (a deliberately hard case — see notes) | Hardware signature vs. actual binding (the case that most directly demonstrates signature != trust) |

## Notes on case 15 (the hardest case, flagged explicitly)

Case 15 is the sharpest illustration of the architecture document §7
principle: a cryptographic signature proves the reading came from the
claimed sensor and wasn't tampered with in transit — it does not prove
the sensor is still attached to anything meaningful. Whether this is
detectable at all depends entirely on what independent signal exists
(e.g., a companion continuity/attachment sensor, or a physically
implausible reading pattern) — **the synthetic harness should include
both a sub-case where detachment IS independently detectable
(`WITNESS_SCOPE_ERROR`, since the binding is no longer physically valid)
and a sub-case where it is NOT** (correctly resolves to whatever the
signature+scope checks alone would produce, demonstrating the disclosed
limitation from `LNES60_WITNESS_TRUST_MODEL.md` §4 rather than pretending
the architecture solves an underdetermined problem).

## Stratification requirement

Per the established LNES-58/59 discipline (each stratification bucket hit
≥2 times), the synthetic case generator (`LNES60_EXPERIMENT_PROTOCOL.md`)
should produce ≥2 concrete synthetic instances per test class above, not
just one canonical example per row — 15 classes × ≥2 instances ≥ 30
minimum synthetic cases for the initial harness run, scaled up as the
harness matures.

---

*Companion: `LNES60_WITNESS_TRUST_MODEL.md` (trust-property definitions
these cases exercise), `LNES60_FAILURE_TAXONOMY.md` (how failures are
classified when a case does NOT resolve to its expected state),
`LNES60_EXPERIMENT_PROTOCOL.md` (how these cases are actually generated
and run).*
