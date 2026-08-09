# LNES-60 Phase 2 — Bench Hardware Requirements

**Status: identifies capability requirements for Phase 2, does not
authorize purchase, does not select final sensors.** Produced after the
Phase 1 synthetic result (below) to scope what real bench hardware would
be needed to exercise the same architecture against real, not simulated,
witnesses. No hardware has been purchased or selected as final.

---

## Required capability vs. candidate hardware, kept separate

| Required capability | Why (from Phase 1 findings) | Candidate hardware class (not final) |
|---|---|---|
| Component-identity mechanism | Every KTX class J/K/wrong-aircraft/wrong-component case depends on this; P1's naive reading only caught OUTRIGHT ID text mismatches | RFID/NFC tag or laser-marked serial + optical read, bound at manufacture |
| Strain/load sensing (tether) | Tensile tether classes A/B/1/11/13 | Bonded strain gauge or fiber Bragg grating on the tether |
| Geometry/proximity sensing (Iron Web / pawl) | Class D / KTX class 3 | Structured-light or laser-triangulation proximity sensor |
| Temperature sensing (manufacturing + operational) | AM genesis anomaly class (C), tether temperature scoping in class N | Thermocouple/RTD array at print stage; onboard thermistor for operational |
| Secure sensor pod / BLE or wired telemetry | Delivers signed readings into the Edge Witness chain (`LNES60_EDGE_WITNESS_INTEGRATION_MAP.md`) | LNES-06 Edge Witness hardware (existing, deployed per white paper Appendix D) as the transport; sensor-side integration is new work |
| Calibration record system | Every `UNVERIFIED`/`SENSOR_DEGRADED` path depends on a real calibration record, not a synthetic boolean | Not yet designed -- flagged as an open dependency in the Edge Witness integration map, unchanged by this Phase 1 pass |
| Bench Tensile-tether fixture | Needed to produce real strain/elongation readings under controlled, repeatable load | Standard tensile test fixture, instrumented |
| Representative hub / Iron Web fixture, where available | Needed for real geometry witness data | Depends on current KTX hardware availability -- not assessed here |
| Motor/propulsion identity readout | Configuration mismatch classes E/F and the config-epoch class | Existing motor controller telemetry, if it exposes a hardware ID/firmware version field; not yet confirmed |

## What Phase 1 tells us about Phase 2 priorities

The single clearest Phase 1 result (P0 18% / P1 64-66% / P2 100%
operational-state accuracy, false-release rate 30% / 34% / 0%) says the
bench hardware investment should prioritize the sensors that let the
**witness trust plane** be populated with real data (calibration state,
freshness, component binding, anti-replay), not just the raw measurement
sensors themselves — P1's failures were concentrated almost entirely in
trust-property classes (stale-after-event, replay, detached-sensor,
limited-scope), not in cases where a physical measurement was simply
unavailable. A bench rig with excellent strain/geometry/temperature
sensors but no real calibration-tracking or component-binding mechanism
would reproduce P1's failure pattern in hardware, not solve it.

## Explicitly not addressed here

Final sensor part numbers. Cost. Procurement. Integration timeline. Which
KTX components get instrumented first. All of these require operator/
engineering decisions beyond a Phase 1 software validation pass.

---

*Companion: `LNES60_PHASE1_FINAL_VALIDATION_REPORT.md` §30 (Phase 2
hardware requirements, same content, cross-referenced from the report's
required structure).*
