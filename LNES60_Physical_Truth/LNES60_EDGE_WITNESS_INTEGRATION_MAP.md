# LNES-60 Edge Witness Integration Map

**Status: R&D / DESIGNED.** Maps LNES-60's four-plane truth model onto the
existing Edge Witness architecture (`EXERGYNET_EDGE_WITNESS_ARCHITECTURE.md`)
and xLMP object model, without modifying either. This is an integration
design, not new Edge Witness code.

---

## 1. What Edge Witness already provides (unchanged by LNES-60)

Per the existing architecture doc and white paper §29/§30: signed
observation records, a chain from physical/observed event to a
content-addressed, integrity-verified xLMP object. LNES-60 does not
replace or duplicate this — it defines what *kind* of content goes into
that chain for physical-truth reconciliation specifically, and what
happens *after* a witness object is committed.

## 2. Mapping the four planes onto xLMP object types

| Truth plane | xLMP object shape | Provenance source | Notes |
|---|---|---|---|
| Documentary state | Standard xLMP memory objects (existing lifecycle/temporal-validity mechanism, white paper Part III) | Maintenance/inspection systems, ingested like any other document | No new object type needed — this plane already fits the existing model |
| Command/digital state | Standard xLMP memory objects, namespace-scoped to a specific aircraft/mission | Ground control / mission planning system | No new object type needed |
| Physical witness state | **New**: `PhysicalWitnessObject` — an xLMP object whose payload is a structured reading (per the schema's `physical_witness_state` fields) plus a required, non-optional link to a `WitnessTrustRecord` (below) | Edge Witness signed observation pipeline | The required linkage is the new part — a `PhysicalWitnessObject` committed without an associated trust record should be rejected at ingest, not merely flagged later |
| Witness trust state | **New**: `WitnessTrustRecord` — sensor identity, calibration reference, current freshness/health status at time of the linked reading | Sensor registry + calibration management system (not yet specified in detail — flagged as an open integration dependency, §5) | Time-indexed: a sensor's trust record can change between readings, so each `PhysicalWitnessObject` binds to the trust state *as of that reading*, not a live-updating pointer |

## 3. Commit-time vs. resolution-time responsibilities

Consistent with xLMP's existing discovery/recall and ingest/resolve
separation (white paper §12): **Edge Witness's job ends at commit** — it
produces a correctly signed, correctly typed `PhysicalWitnessObject` +
`WitnessTrustRecord` pair and commits it. **LNES-60's deterministic
resolution logic runs later**, at query/evaluation time, reading whatever
committed objects exist across all four planes for the relevant
aircraft/component/predicate and applying the architecture document §3
governing principle. This mirrors exactly the LNES-58/59 discipline of
query-independent construction at ingest time, deterministic traversal at
query time (white paper §5, patent spec Part K) — LNES-60 does not
introduce a new ingest-vs-query philosophy, it reuses the existing one
across a fourth plane.

## 4. Anti-replay and freshness at the integration layer

`WitnessTrustRecord`'s anti-replay field (schema §2.6) is implemented as
an xLMP-object-level nonce/sequence check at commit time — Edge Witness
already has an integrity-verification step (white paper's memory
integrity discipline, `MemoryIntegrityViolation` per the production
recon); LNES-60 extends that check to also reject a `PhysicalWitnessObject`
whose underlying signed reading has already been committed under a
different configuration context (KTX test class 14). This is a
**commit-time** rejection where possible (cheapest, catches obvious
replay), backstopped by a **resolution-time** staleness check (§5 of the
witness trust model) for cases where the replay is only detectable in
light of a later configuration change that hadn't happened yet at commit
time.

## 5. Open integration dependencies (explicitly not resolved by this map)

- Sensor registry / calibration management system: this map assumes one
  exists or will exist; it does not design it. `WitnessTrustRecord`
  ingestion depends on it.
- Exact signing/attestation mechanism for `PhysicalWitnessObject` at the
  hardware layer (which key, which device attestation) — deferred to
  Edge Witness's own existing key-management design, not re-specified
  here.
- Real-time vs. batch commit for high-frequency telemetry (e.g.
  vibration) — the synthetic harness (`LNES60_EXPERIMENT_PROTOCOL.md`)
  uses discrete synthetic readings; a real deployment's telemetry rate
  and object-commit granularity is a distinct engineering question not
  addressed here.

---

*Companion: `LNES60_TRUTH_STATE_SCHEMA.json`, `LNES60_WITNESS_TRUST_MODEL.md`,
`EXERGYNET_EDGE_WITNESS_ARCHITECTURE.md` (pre-existing, unmodified).*
