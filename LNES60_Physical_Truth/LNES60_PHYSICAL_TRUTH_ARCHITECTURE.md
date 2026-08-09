# LNES-60: Physical Truth Architecture

**Status: R&D / DESIGNED. No aircraft actuation, no live propulsion
commands, no destructive hardware interaction anywhere in this document
or its companion artifacts.** Builds on the existing NEURO-LOCK/Bolt/xLMP/
LNES-22 architecture already disclosed in the Living White Paper (Part V,
Section 30) — does not restate that material, extends it.

---

## 1. Core question

> When documentary state, commanded configuration, and cryptographically
> witnessed physical state disagree, can ExergyNet deterministically
> establish operational state and prevent release until the conflict is
> resolved?

This is not a retrieval-accuracy benchmark (contrast LNES-58/LNES-59). It
tests a different notion of truth — **physical / configurational truth** —
where the question is not "did the model find the right document" but
"given three independently-sourced and independently-fallible accounts of
reality (paperwork, commanded configuration, and sensor witness), what is
the system entitled to treat as currently true, and what must it withhold
judgment on?"

## 2. The four truth planes

Modeled **separately**, never collapsed into one "state" field:

### 2.1 Documentary state
Maintenance history, inspection history, part provenance, approved
configuration, service life, maintenance action records. This is
historical/administrative truth — it records what was *done* or
*approved*, not what is *currently physically the case*. See §4 on why
historical truth must remain historical truth even when current physical
state contradicts it.

### 2.2 Command / digital state
Mission profile, payload, firmware, software, motor map, control
parameters, expected hardware IDs. This is what the system was *told* or
*configured* to be — intent and configuration, not observation.

### 2.3 Physical witness state
Strain, elongation, geometry, temperature, vibration, electrical
signature, hardware identity, position, cycle count, manufacturing
process telemetry. This is *observation* — sensor-derived, and only as
good as the sensor and its context (§2.4).

### 2.4 Witness trust state
Sensor identity, aircraft/component binding, calibration, freshness,
hardware signature, anti-replay, measurement uncertainty, sensor health,
measurement scope. **This plane is what makes a raw sensor reading into
evidence.** A physical witness reading without an established trust state
is a number, not evidence — see `LNES60_WITNESS_TRUST_MODEL.md` for the
full treatment.

## 3. The governing principle (verbatim, non-negotiable)

**Never encode `SENSOR_ALWAYS_WINS`.**

The correct principle:

> Verified physical evidence may invalidate a document-derived operational
> conclusion when the witness's identity, calibration, freshness,
> integrity, scope, and applicability are established.

A sensor reading that lacks any one of those five properties does not get
to override documentary or commanded state — it becomes `SENSOR_CONFLICT`,
`SENSOR_DEGRADED`, `STALE_WITNESS`, or `WITNESS_SCOPE_ERROR` (§5) rather
than an automatic override. This is the direct physical-domain analog of
LNES-58/59's "evidence is not authority" principle (white paper §39):
a sensor's *apparent* confidence or freshness does not by itself grant it
the power to overwrite committed state; its *established trust
properties* do.

## 4. Historical truth is never erased

"Technician serviced component" is a documentary fact about a past event.
It remains true forever, regardless of current physical state. "Component
is currently serviceable" is a *separate*, time-indexed claim that can be
independently true, false, or unresolved. LNES-60 must never mutate or
retroactively falsify a documentary record because a later physical
reading conflicts with the *current-state conclusion* that record used to
support. This mirrors xLMP's own temporal-validity discipline (white
paper §9.1, Part E of the patent specification) — supersession and
conflict are properties of *current-state resolution*, not properties of
the historical record itself.

## 5. State model (minimum set, full detail in the schema)

`VERIFIED_MATCH` · `DOCUMENT_PHYSICAL_CONFLICT` · `CONFIGURATION_MISMATCH`
· `SENSOR_CONFLICT` · `SENSOR_DEGRADED` · `STALE_WITNESS` ·
`WITNESS_SCOPE_ERROR` · `UNVERIFIED` · `INCOMPLETE` · `RELEASE_ELIGIBLE` ·
`HOLD`. See `LNES60_TRUTH_STATE_SCHEMA.json` for the machine-readable
definition and `LNES60_FAILURE_TAXONOMY.md` for how each non-terminal
state is reached.

## 6. Layer separation (extends white paper §30/§40, does not replace it)

```
xLMP:            WHAT IS TRUE / KNOWN?
                 (the four truth planes, reconciled per §3, producing one
                  of the states in §5)
LNES-22:         WHAT IS PERMITTED?
                 (consumes the resolved physical state; determines
                  whether the system may proceed to an action state)
NEURO-LOCK /
actuator system: HOW IS THE PERMITTED ACTION PHYSICALLY EXECUTED?
```

LNES-60 is entirely within the "xLMP: what is true" layer, extended with
a fourth evidence plane (physical witness) and a fifth governance
plane (witness trust) beyond what LNES-58/59 needed for
documentary-only domains. It produces exactly three engineering
authorization outputs — `RELEASE_ELIGIBLE`, `HOLD`, `INCOMPLETE` — and
stops there. **LNES-60 does not claim autonomous regulatory
return-to-service and does not bypass any legally required inspection or
signoff.** LNES-22 consumes LNES-60's output as one input among whatever
else its policy evaluation requires (§ white paper 41) before determining
actual action authority; LNES-60 does not itself grant or execute action
authority.

## 7. Edge Witness chain (extends the existing Edge Witness architecture)

```
physical phenomenon
  -> sensor
  -> calibration/health
  -> hardware identity
  -> signed witness
  -> xLMP committed state
  -> deterministic resolution (LNES-60)
  -> LNES-22
  -> action authority
```

**Explicit epistemic limit, stated here because it is easy to conflate:**
a cryptographic signature proves *origin and integrity* of a witness
record — that it came from a claimed sensor and was not altered in
transit/storage. A ZK proof proves a *computation over committed
evidence* was performed correctly. **Neither independently proves that
the underlying measurement corresponds to physical reality.** A perfectly
signed, perfectly proven record of a miscalibrated or spoofed sensor is
still wrong. This is why the witness trust plane (§2.4) is modeled
separately from cryptographic integrity — integrity and trustworthiness
are different properties, and LNES-60 does not let a signature stand in
for calibration/freshness/scope verification.

## 8. Relationship to LNES-58/LNES-59

Same architectural family — persistent state, explicit non-collapsed
resolution states, a deterministic post-generation/post-observation
governance boundary — extended a third time (healthcare closed-world →
enterprise procurement open-world → physical/documentary/command
multi-plane reconciliation). See `LNES60_PATENT_DISCLOSURE_NOTE.md` for
what specifically is new conception versus what is a domain extension of
already-disclosed mechanisms.

---

*Companion documents: `LNES60_TRUTH_STATE_SCHEMA.json`,
`LNES60_WITNESS_TRUST_MODEL.md`, `LNES60_KTX_TEST_MATRIX.md`,
`LNES60_EDGE_WITNESS_INTEGRATION_MAP.md`,
`LNES60_XLMP_LNES22_HANDSHAKE.md`, `LNES60_FAILURE_TAXONOMY.md`,
`LNES60_EXPERIMENT_PROTOCOL.md`, `LNES60_PATENT_DISCLOSURE_NOTE.md`.*
