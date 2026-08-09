# LNES-60 Failure Taxonomy

**Status: R&D / DESIGNED — pre-registered taxonomy, no runs have occurred
yet.** Written before `LNES60_EXPERIMENT_PROTOCOL.md` is executed, so that
classification of any future harness result is against a fixed standard,
not invented post hoc — the same discipline LNES-59's holdout ground
truth used (hand-traced before execution, never adjusted after seeing
results).

---

## Categories

1. **Trust-property misclassification** — the harness assigns the wrong
   resolution state for a specific failing trust property (e.g., a
   calibration failure gets classified as `STALE_WITNESS` instead of
   `UNVERIFIED`). Maps directly to `LNES60_WITNESS_TRUST_MODEL.md` §2's
   nine sub-properties — each has a dedicated expected-state mapping in
   §3 of that document; a mismatch here is a resolution-logic defect.

2. **Plane conflation** — a defect where evidence from one truth plane
   (e.g., command/digital) is treated as if it were another (e.g.,
   physical witness), producing a wrong resolution state. Distinct from
   category 1 because the error is architectural (wrong plane consulted)
   not property-level (right plane, wrong trust judgment).

3. **Historical erasure** — the harness allows a current-state conflict
   to mutate or delete a documentary record, violating architecture
   document §4. Treated as a severe defect class, not a minor scoring
   miss, given the explicit non-negotiable framing of that principle.

4. **SENSOR_ALWAYS_WINS regression** — the harness resolves a conflict by
   unconditionally favoring the physical witness plane without verifying
   its trust properties first. The single most important thing this
   taxonomy exists to catch, per the architecture document §3's
   governing principle.

5. **Scope leakage** — a witness reading is applied to a broader claim
   than its actual `measurement_scope` covers (KTX test class 8's
   failure mode, if the harness gets it wrong instead of right).

6. **Replay/staleness miss** — a reading that should be `STALE_WITNESS`
   (event-relative, per KTX class 5, or config-change-relative, per class
   14) is instead treated as current.

7. **False conflict preservation failure** — the inverse of category 4:
   the harness *should* preserve an unresolved conflict (e.g., KTX class
   13, multiple fresh witnesses vs. a documentary BAD record) but instead
   silently resolves it one way or the other rather than surfacing
   `DOCUMENT_PHYSICAL_CONFLICT`/`SENSOR_CONFLICT` for human review.

8. **Boundary leakage into LNES-22** — the resolution payload crossing
   the handshake (`LNES60_XLMP_LNES22_HANDSHAKE.md` §2) includes raw
   evidence content or reasoning it should not, or LNES-22 is observed
   (in the synthetic harness) treating a resolution state as
   self-authorizing rather than one input among others.

9. **Witness-type mislabeling** — any case where `SIMULATED_WITNESS` data
   is presented, logged, or reported without that label, or as if it
   were `HARDWARE_WITNESS`. Treated as a hard-rule violation regardless
   of whether it affected any resolution outcome — this is a discipline
   violation, not a correctness defect, and is checked independently of
   whether the underlying resolution was correct.

10. **Engineering-envelope mislabeling** — a numeric threshold used in a
    test case or the harness's own logic is not tagged
    `SYNTHETIC_TEST_VALUE` per the schema's requirement, or is presented
    in a way that could be read as a real qualified engineering limit.

11. **Infrastructure failure** — harness crashes, malformed synthetic
    fixture generation, non-deterministic test execution. Diagnosed and
    repaired per the same infrastructure-vs-semantic-change discipline
    established in LNES-59 (`LNES59_FINAL_VALIDATION_REPORT.md` §21) —
    fixed without altering the frozen state-model semantics once the
    harness itself is frozen for a given run.

## What this taxonomy does NOT do

Does not itself run any test. Does not assign real severity/priority
weights (that depends on which categories actually occur, once the
harness runs). Does not claim exhaustiveness — a first harness run may
surface a failure mode not listed above, in which case it is added, dated,
and the taxonomy versioned, the same discipline LNES-58/59 used for their
own defect taxonomies.

---

*Companion: `LNES60_EXPERIMENT_PROTOCOL.md` (where this taxonomy gets
used), `LNES60_KTX_TEST_MATRIX.md` (the cases being classified against),
`LNES60_WITNESS_TRUST_MODEL.md` (category 1's property mapping).*
