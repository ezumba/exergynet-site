# LNES-60 Witness Trust Model

**Status: R&D / DESIGNED.** Defines what makes a physical-witness reading
into admissible evidence, as distinct from a raw sensor number. See
`LNES60_PHYSICAL_TRUTH_ARCHITECTURE.md` §2.4/§3 for the architectural
framing this document expands.

---

## 1. Why trust is a separate state from measurement

A physical witness reading (`LNES60_TRUTH_STATE_SCHEMA.json`'s
`physical_witness_state`) is a value: a number, a signature, a geometry.
By itself it says nothing about whether it should be believed. Two
readings with identical values can have completely different evidentiary
weight depending on their trust properties. Modeling trust as its own
state — not a scalar "confidence" field bolted onto the reading — is
deliberate: each trust property fails independently and for a different
reason, and a governance system needs to know *which* property failed to
choose the correct resolution state (`SENSOR_CONFLICT` vs.
`STALE_WITNESS` vs. `WITNESS_SCOPE_ERROR`, etc.), not just that trust is
"low."

## 2. The six trust properties

### 2.1 Sensor identity
Which specific sensor produced this reading — a durable identifier, not
just "a strain gauge." Required for calibration lookup (§2.2) and
anti-replay (§2.6).

### 2.2 Aircraft/component binding
Which specific airframe or component this sensor is physically attached
to. A perfectly valid, perfectly calibrated, perfectly fresh reading is
still inadmissible for a claim about a *different* aircraft or component
(KTX test class 7: "valid signed witness bound to wrong
aircraft/component").

### 2.3 Calibration
Whether the sensor's calibration record is current. A calibration record
itself has a validity window; a reading taken after that window expires
is not disqualified from *existing* but is disqualified from being
treated as trustworthy evidence (KTX test class 12: "physical witness
says BAD but calibration has expired" — the reading is not simply
discarded or simply trusted; it becomes `UNVERIFIED`, prompting explicit
resolution rather than a silent default in either direction).

### 2.4 Freshness
Whether the reading is recent enough to still describe current physical
reality, given what has happened since it was taken. Freshness is not
purely a clock comparison — a reading can be recent in wall-clock terms
and still stale if an intervening event (a hard landing, a configuration
change) could plausibly have altered the physical property being
measured (KTX test classes 5 and 14).

### 2.5 Hardware signature / integrity
Cryptographic proof the reading came from the claimed sensor and was not
altered. **This property alone does not establish trust** — see
architecture doc §7's explicit statement that a signature proves origin/
integrity, not correspondence to physical reality. A reading can pass
hardware-signature verification and still fail every other trust
property (KTX test class 15: "sensor physically detached but still
cryptographically valid" — the key material and signing capability
survived detachment; the measurement did not become meaningless because
of that).

### 2.6 Anti-replay
Whether this specific reading has been presented before in a context
that should invalidate its reuse (KTX test class 14: "replay of
previously valid GOOD witness after configuration change" — the reading
was genuinely GOOD at the time it was taken, and remains cryptographically
valid; anti-replay state is what correctly identifies it as inapplicable
to the *current* configuration).

### 2.7 Measurement uncertainty
The sensor's own stated (or derived) error bounds. Distinct from
calibration (whether the sensor is correctly calibrated) — uncertainty is
about precision even under correct calibration.

### 2.8 Sensor health
The sensor's own self-reported or externally-monitored operational
status, independent of calibration/freshness — a sensor can be
in-calibration, fresh, and correctly bound, and still be reporting from a
degraded operating state (`SENSOR_DEGRADED`).

### 2.9 Measurement scope
What the reading actually measures and covers — both physically (which
component, which specific parameter) and epistemically (a reading that
is GOOD for "no visible corrosion in the inspected region" does not
scope-cover "no corrosion anywhere on the component" — KTX test class 8:
"known damage contradicted by a limited-scope GOOD sensor reading").

*(§2 lists nine sub-properties; the architecture document's summary of
"six" groups several of these under broader headings — e.g. hardware
signature + anti-replay under "integrity," uncertainty + health under
"quality" — this document keeps them separated because each is a
distinct failure mode in the KTX test matrix and collapsing them loses
the ability to name which one failed.)*

## 3. Resolution logic (informal — formal version in the schema/harness)

```
admissible = identity_known
         AND aircraft_component_binding_correct
         AND calibration_current
         AND freshness_valid
         AND hardware_signature_valid
         AND NOT replayed
         AND scope_covers(claim)

if not admissible:
    -> UNVERIFIED | STALE_WITNESS | WITNESS_SCOPE_ERROR | SENSOR_CONFLICT
       (the SPECIFIC failing property determines which resolution state,
        never a generic "not trusted" catch-all -- see
        LNES60_FAILURE_TAXONOMY.md for the full mapping)

if admissible:
    weight = f(measurement_uncertainty, sensor_health)
    -> feeds into VERIFIED_MATCH / DOCUMENT_PHYSICAL_CONFLICT / etc.
       per the architecture document's governing principle -- an
       admissible reading still does not automatically override
       documentary/command state; it becomes eligible evidence that a
       separate reconciliation step weighs against the other planes.
```

**The word "admissible" is deliberate** — it separates "may this reading
be considered at all" (this document) from "given that it may be
considered, what does the overall reconciliation conclude" (the
architecture document's §3 governing principle, applied across all four
planes). A single admissible SENSOR_DEGRADED reading does not, by itself,
flip a HOLD to RELEASE_ELIGIBLE.

## 4. Explicit non-claims

This model does not claim to detect all forms of sensor compromise (a
sufficiently sophisticated spoofed sensor with valid-looking calibration
and signature records could still pass §3's admissibility check — this
is a known, disclosed limitation, not solved by this document). It does
not claim measurement_uncertainty values are themselves independently
verified beyond what the sensor/calibration record states. It does not
define specific numeric thresholds for any of §2's properties — those are
`ENGINEERING_ENVELOPE` parameters per the schema, supplied per test case
or, eventually, per real qualified engineering data, never hardcoded here.

---

*Companion: `LNES60_TRUTH_STATE_SCHEMA.json` (formal fields),
`LNES60_KTX_TEST_MATRIX.md` (test cases exercising each trust-property
failure mode), `LNES60_FAILURE_TAXONOMY.md`.*
