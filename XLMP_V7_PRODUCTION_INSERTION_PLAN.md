# xLMP V7 Production Insertion Plan

**Prepared:** 2026-08-08 · Priority 3 of the continuity directive
**Status: DESIGN ONLY. Does not deploy V7. No production code changed by
this document.** Migration design for inserting the frozen V7
deterministic state-governance mechanism (validated on the LNES-59
holdout, `LNES59_Procurement_Bench/`) into the live production route
surface documented in `EXERGYNET_XLMP_INTEGRATION_REGISTRY.md`.

---

## 1. Current live request path (confirmed by Phase 3 code recon)

```
client
  -> Authorization: Bearer <key> / session (resolveUser)
  -> POST /api/xlmp/query  (or /api/xlmp/zk-query)
  -> xlmp_zk_query()  [xlmp_ds_core.ts]
       -> splitIntoChunks -> scoreChunk -> extractEvidenceWindow
  -> raw evidence text returned to caller
  -> (caller-side, outside this route: passed to a model, e.g. via
     explorer-api.exergynet.org/v1/chat/completions)
  -> model output returned directly as the response
```

**Key fact this plan is built on:** the current route has no concept of a
CandidateClaim, no state envelope, and no gate. It returns bounded
evidence text; whatever consumes that text (a model call the caller makes
separately) is entirely outside xLMP's control today. This matches the
Phase 3 finding that the V7 gate is absent from production.

## 2. Target production sequence

```
client
  -> Authorization
  -> POST /api/xlmp/query  (same route, same auth -- see §4 compatibility)
  -> xLMP: candidate document retrieval (existing extractEvidenceWindow,
     UNCHANGED)
  -> STATE RESOLUTION (new): deterministic_extraction.py-equivalent logic
     ported to the route's runtime, applied to the retrieved evidence
  -> STATE ENVELOPE (new): resolution x claim-type x authority-status,
     per the three-axis model (LNES-59 disclosure note Item 2)
  -> model call (existing, but now receives the envelope, not raw text)
  -> CandidateClaim (new): normalized model output per the existing
     candidate_claim.py schema
  -> DETERMINISTIC GOVERNANCE (new): state_consistency_gate_v2.py-
     equivalent, ported and adapted to whatever domain a given xLMP
     namespace represents
  -> AUTHORIZED STATE (new): the gated, committed output
  -> LNES-22 (existing, separate service) IF the output is consequential
  -> response to client
```

## 3. Exact insertion boundary

The insertion point is **between `xlmp_zk_query()`'s evidence return and
the caller's model call** — today those are adjacent with nothing between
them; V7 inserts three new stages (state resolution, envelope
construction, gate) at that seam. Concretely: a new module,
tentatively `xlmp_state_governance.ts`, sitting in `portal/src/lib/`
alongside `xlmp_ds_core.ts`, called from a **new** route
(`/api/xlmp/query/governed` — see §5's feature-flag approach for why this
is a new route, not a modification of the existing one) rather than
inline in the existing `xlmp_ds_core.ts` file, to keep the ungoverned path
byte-for-byte unchanged during migration.

| Current module | Target module | New interface required |
|---|---|---|
| `xlmp_ds_core.ts` (`xlmp_zk_query`) | Unchanged — retrieval stays exactly as-is | None; V7 consumes its existing output |
| (none) | `xlmp_state_resolution.ts` (new, ported from `deterministic_extraction.py`) | `resolveState(evidence, predicate) -> StateEnvelope` |
| (none) | `candidate_claim.ts` (new, ported from `candidate_claim.py`) | `parseCandidateClaim(modelOutputText) -> CandidateClaim`, `toModelOutput(claim) -> ModelOutput` |
| (none) | `state_consistency_gate.ts` (new, ported from `state_consistency_gate_v2.py`) | `evaluate(committedState, modelOutput) -> GateOutcome` |
| `/api/xlmp/query/route.ts` | `/api/xlmp/query/governed/route.ts` (new, additive) | Calls the above three in sequence, returns `{ candidate_claim, gate_outcome, authorized_state }` instead of raw evidence text |

**A Python-to-TypeScript port is required.** The frozen V7 files are
Python (`state_consistency_gate_v2.py`, `deterministic_extraction.py`),
matching the benchmark harness; the production route surface is
TypeScript/Next.js. This is a real, non-trivial engineering task, not a
copy-paste — flagged explicitly as a NO-GO precondition in §8, not
glossed over.

## 4. Backward compatibility

The existing `/api/xlmp/query` and `/api/xlmp/zk-query` routes are
**unmodified**. All current callers (Omega Carrier, any others found in
Phase 3 recon) continue to receive raw evidence text exactly as today,
indefinitely, unless and until the operator makes an explicit decision to
deprecate the ungoverned path — not a decision this plan makes or
recommends a timeline for. Callers that want the governed behavior opt in
by calling the new route.

## 5. Feature flag strategy

Additive-route approach (§3) is itself the primary flag — no runtime
feature-flag service is required for the initial rollout, since the
governed and ungoverned paths are simply different URLs. If finer-grained
control becomes necessary (e.g., enabling governance per-namespace or
per-caller rather than per-route), a namespace-scoped config field (e.g.,
`namespace.governance_enabled: boolean`, stored alongside the existing
namespace/access-control metadata referenced in the white paper's Section
17) is the natural extension — not built in this pass.

## 6. Failure behavior

- State resolution failure (malformed/unparseable evidence): return
  `resolution: INCOMPLETE`, never fabricate a MATCH — matches the frozen
  V7 semantics exactly, not a new design decision.
- Gate evaluation failure (unexpected exception in the ported TS code):
  **fail closed** — do not authorize the state; return an explicit error
  distinct from a normal `HOLD`/`INCONSISTENT` gate outcome, so callers
  can distinguish "the gate said no" from "the gate itself broke."
- Model call failure or timeout: unchanged from current behavior upstream
  of this insertion point; not this plan's concern.

## 7. Observability

Minimum additions before any production rollout: per-request logging of
`{ resolution, claim_type, authority_status, gate_outcome }` (never raw
evidence content or model output content in logs, consistent with
existing privacy conventions elsewhere in this codebase); a
false-block/false-allow-style dashboard counter analogous to what
`comparator_metrics.py` computes offline, computed online instead; an
explicit alert on any gate evaluation failure (§6), since a fail-closed
gate that is silently failing looks identical to "everything is being
correctly blocked" without one.

## 8. Rollback

Because the governed path is a new, additive route (§3-4), rollback is
trivial by construction: stop routing traffic to
`/api/xlmp/query/governed` (or simply don't advertise it) and every
existing caller is unaffected, since they were never touched. No
data migration, no schema change to existing xLMP objects — the state
envelope and gate outcome are computed per-request, not persisted as a
new required field on stored memory objects, unless a future design
explicitly decides to also persist authorized state as new memory
objects (a distinct, later decision, not part of this insertion plan).

## 9. Tests required before any rollout

1. Port `test_comparator_metrics.py`'s logic (or an equivalent) against
   the TypeScript port, to confirm the ported gate produces identical
   outcomes to the Python original on the same fixture inputs — a direct
   parity test, not a fresh test suite designed independently of the
   already-validated one.
2. Re-run a subset (or all) of the LNES-59 holdout's 50 cases against the
   new route, confirming the same 84%/84%/0% headline figures reproduce
   through the ported TypeScript path — this is the actual
   reduction-to-practice evidence a production rollout would need, not
   assumed from the Python benchmark alone.
3. Load/latency testing of the new stages, since state resolution + gate
   evaluation add real per-request compute on top of the existing
   retrieval path.
4. A dedicated fail-closed test: deliberately break gate evaluation
   (e.g., malformed envelope) and confirm the route returns the
   distinguishable error from §6, not a silent authorize.

## 10. NO-GO conditions

Do not deploy V7 to production if any of the following hold at rollout
time:
- The TypeScript port has not passed the parity test (§9.1) against the
  Python original.
- The ported gate has not reproduced the LNES-59 headline numbers (§9.2)
  on the same holdout, within a tolerance the operator accepts in
  advance (not defined by this plan — an operator decision).
- Fail-closed behavior (§6) has not been verified under an induced
  failure.
- Observability (§7) is not wired up — deploying ungated in the dark is
  worse than staying benchmark-only.
- Any existing caller would be broken by the change — per §4, this
  should be structurally impossible with the additive-route approach, but
  is listed explicitly as a NO-GO trigger if that invariant is ever
  violated during implementation.
- The domain the production namespace actually serves has not had its
  own predicate/authority/temporal semantics defined and reviewed — V7's
  procurement-domain semantics (from LNES-59) do not automatically apply
  to whatever xLMP is storing in production today; this plan does not
  assume production data matches the procurement domain's structure.

---

*This plan does not authorize deployment. It is the engineering design
counsel/engineering would need to review before any deployment decision
is made.*
