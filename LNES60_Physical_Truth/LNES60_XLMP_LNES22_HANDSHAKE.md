# LNES-60: xLMP -> LNES-22 Handshake

**Status: R&D / DESIGNED.** Defines exactly what LNES-60's resolution
output hands to LNES-22, and where the boundary between "what is true"
and "what is permitted" sits. Extends white paper §40/§41's existing
xLMP/LNES-22 separation for the physical-truth domain specifically; does
not modify LNES-22 itself.

---

## 1. The boundary, restated precisely

```
xLMP + LNES-60:  WHAT IS TRUE / KNOWN?
                 -> produces exactly one of: VERIFIED_MATCH,
                    DOCUMENT_PHYSICAL_CONFLICT, CONFIGURATION_MISMATCH,
                    SENSOR_CONFLICT, SENSOR_DEGRADED, STALE_WITNESS,
                    WITNESS_SCOPE_ERROR, UNVERIFIED, INCOMPLETE,
                    RELEASE_ELIGIBLE, or HOLD

LNES-22:         WHAT IS PERMITTED?
                 -> consumes the above as ONE input to its own policy
                    evaluation (delegation receipts, typed capability,
                    resource scope, human approval where required --
                    white paper §41, patent spec Part F)
                 -> produces its own authorization decision, independent
                    of and not simply a passthrough of LNES-60's state
```

**The handshake is a one-way data flow with no shortcut.** LNES-60 never
calls into LNES-22's policy engine directly, and LNES-22's policy engine
never re-derives physical truth itself — it receives LNES-60's resolved
state as evidence, the same architectural pattern as white paper §39's
"evidence tells the agent what the world contains; authority tells the
agent what it is permitted to cause," applied here to physical
observation instead of retrieved documents.

## 2. What crosses the boundary (the handshake payload)

```
{
  "resolution_state": one of the eleven states,
  "resolved_predicate": what claim this resolution is about
                        (e.g. "component-X.release_eligibility"),
  "contributing_planes": which of the four planes had admissible
                        evidence for this resolution (not raw plane
                        content -- LNES-22 does not need to see the
                        underlying sensor readings to make a policy
                        decision, only the resolution and its
                        provenance summary),
  "conflict_detail": present only for DOCUMENT_PHYSICAL_CONFLICT /
                     CONFIGURATION_MISMATCH / SENSOR_CONFLICT -- a
                     structured description of what disagreed, for
                     human review, never auto-resolved by LNES-22
                     silently picking a side,
  "resolution_timestamp": when LNES-60 produced this state,
  "state_envelope_root": xLMP content-addressed root of the full
                        underlying evidence, for audit -- LNES-22
                        references this, does not re-fetch/re-derive it
                        as part of its own decision
}
```

**Explicitly NOT in the payload:** raw sensor values, raw documentary
text, model reasoning/interpretation of any kind. LNES-60's job is
already done by the time this payload is constructed — it is a resolved
fact, not evidence for LNES-22 to re-interpret with a model. This is
deliberate: it prevents LNES-22's policy evaluation from being
influenced by anything resembling natural-language persuasion (white
paper §41's "zero authority" principle), since there is no natural
language in this payload at all.

## 3. What LNES-22 must not do with this payload

- Must not treat `RELEASE_ELIGIBLE` as self-authorizing — it is one input
  to policy evaluation, not a bypass of delegation receipts, typed
  capability checks, or required human approval.
- Must not "upgrade" a `HOLD` or `INCOMPLETE` to permit an action by
  applying its own separate physical-state judgment — if LNES-60 hasn't
  resolved a conflict, LNES-22 does not get to resolve it either; the
  conflict is preserved (architecture doc §4) until a human or an
  out-of-band process resolves it and a new LNES-60 resolution is
  produced.
- Must not conflate this handshake with a regulatory/legal signoff —
  per the architecture document's explicit non-claim, `RELEASE_ELIGIBLE`
  is an engineering authorization output; any legally required
  inspection/signoff remains a separate, human process this handshake
  does not substitute for.

## 4. Failure behavior at the boundary

If LNES-60 cannot produce a resolution at all (e.g., an internal error,
not one of the eleven defined states), the handshake **must not**
silently pass a default state to LNES-22. This mirrors the production
insertion plan's fail-closed rule (`XLMP_V7_PRODUCTION_INSERTION_PLAN.md`
§6) — an absent or malformed resolution is treated by LNES-22 as
equivalent to `HOLD`/`INCOMPLETE`, never as an implicit `RELEASE_ELIGIBLE`.

---

*Companion: `LNES60_PHYSICAL_TRUTH_ARCHITECTURE.md` §6 (layer separation
this document details), `LNES60_TRUTH_STATE_SCHEMA.json` (the eleven
states), white paper §40/§41 and patent spec Part F (LNES-22's existing,
unmodified authority-separation mechanism).*
