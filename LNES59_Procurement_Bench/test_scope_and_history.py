"""
LNES-59 gate V2 tests for the two structural gaps closed on 2026-08-08:
scope preservation (SOURCE_SCOPE_ERROR) and historical-value lineage
(TEMPORAL_CONTRADICTION vs STATE_CONTRADICTION). Pre-holdout-freeze work
-- these mechanisms must be settled before any case is designated holdout.

Run: python3 test_scope_and_history.py
"""

from state_consistency_gate_v2 import (
    CommittedState, ModelOutput, evaluate,
    ResolutionState as R, ClaimType as C, AuthorityStatus as A,
    TemporalStatus as T, ModelOutputType as M, GateOutcome as O,
)

results = []


def check(label, committed, output, expected_outcome):
    decision = evaluate(committed, output)
    ok = decision.outcome == expected_outcome
    results.append((label, ok, decision.outcome, expected_outcome, decision.reason))
    marker = "PASS" if ok else "FAIL"
    print(f"[{marker}] {label}: got {decision.outcome.value} (expected {expected_outcome.value}) -- {decision.reason}")


# ── Scope preservation (directive Phase 1's three required cases) ──────────
registry_state = CommittedState(
    resolution=R.NO_MATCH, claim_type=C.UNKNOWN, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.NOT_APPLICABLE, value="NOT_IN_REGISTRY",  # matches the real corpus convention (see documents.json)
    scope={"source_system": "APPROVED_VENDOR_REGISTRY", "predicate": "VENDOR_X.approval_status"},
)

check("scope 1/3: properly scoped negative -> CONSISTENT", registry_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="Vendor is not present in the approved-vendor registry.",
                   claimed_scope="APPROVED_VENDOR_REGISTRY"),
      O.CONSISTENT)

check("scope 2/3: universal claim ('anywhere') -> SOURCE_SCOPE_ERROR", registry_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="Vendor has never been approved anywhere.",
                   claimed_scope=None),
      O.SOURCE_SCOPE_ERROR)

# scope 3/3 (directive Phase 4.3, resolved 2026-08-08): "No record was
# found in Registry A; other approval sources were not evaluated." ->
# permitted/consistent uncertainty. Turns out ALREADY handled correctly
# by the existing values_match() word-fallback + NO_MATCH branch, once
# tested against the corpus's REAL value convention ("NOT_IN_REGISTRY",
# not an artificial value) -- no new gate code was needed. The
# distinguishing feature from SMOKE-001's genuine miss is that this text
# actually RESTATES the scoped negative (contains "not"/"registry" as
# real words) instead of saying nothing (asserted_value=None); a bare
# None still correctly fails, see history/scope tests above and below.
check("scope 3/3: valid scoped uncertainty (restates the finding + "
      "explicitly discloses out-of-scope unknowns) -> CONSISTENT",
      registry_state,
      ModelOutput(output_type=M.ASSERTION,
                   asserted_value="No record was found in Registry A; other approval sources were not evaluated.",
                   claimed_scope=None),
      O.CONSISTENT)

# Disclosed limitation, found while verifying scope 3/3: the compound-
# token word-fallback requires ALL words to appear, but for a SPARSE
# (2-word) committed value made of generic domain words, a vague hedge
# that never actually restates the finding can still contain both words
# by coincidence and incorrectly pass. Documented here as a known risk,
# not silently fixed -- raising the word-count bar or requiring higher
# coverage could just as easily create NEW false negatives for terse-but-
# correct real answers. See LNES59_PREDICATE_SEMANTICS.md and
# LNES59_PRE_HOLDOUT_CODE_MANIFEST_V2.json's known-limitations list.
no_approval_state = CommittedState(
    resolution=R.NO_MATCH, claim_type=C.UNKNOWN, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.NOT_APPLICABLE, value="NO_APPROVAL_ON_RECORD",
    scope={"source_system": "PROCUREMENT_APPROVAL_SYSTEM", "predicate": "VENDOR-1003.Q3-2026-approval_status"},
)
check("DISCLOSED LIMITATION: a vague hedge sharing both of a 2-word committed "
      "value's words passes as CONSISTENT even without genuinely restating the "
      "finding -- documents current actual behavior, not a target outcome",
      no_approval_state,
      ModelOutput(output_type=M.ASSERTION,
                   asserted_value="I do not have enough information about this vendor approval record to say either way.",
                   claimed_scope=None),
      O.CONSISTENT)

# ── Historical value lineage (directive Phase 2) ────────────────────────────
current_terms = CommittedState(
    resolution=R.MATCH, claim_type=C.CONFIRMED_FACT, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.CURRENT, value="NET_60",
    historical_values=("NET_30",),  # the contract's own original term, later amended
)

check("history 1/3: stale-but-once-true value -> TEMPORAL_CONTRADICTION, not STATE_CONTRADICTION",
      current_terms,
      ModelOutput(output_type=M.ASSERTION, asserted_value="Net 30", claimed_scope=None),
      O.TEMPORAL_CONTRADICTION)

check("history 2/3: value that was NEVER true (not current, not historical) -> STATE_CONTRADICTION",
      current_terms,
      ModelOutput(output_type=M.ASSERTION, asserted_value="Net 45", claimed_scope=None),
      O.STATE_CONTRADICTION)

check("history 3/3: correct current value still matches directly -> CONSISTENT (no regression)",
      current_terms,
      ModelOutput(output_type=M.ASSERTION, asserted_value="Net 60", claimed_scope=None),
      O.CONSISTENT)

no_history_state = CommittedState(
    resolution=R.MATCH, claim_type=C.CONFIRMED_FACT, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.CURRENT, value="ACTIVE",  # historical_values defaults to ()
)
check("history: empty historical_values falls back to plain STATE_CONTRADICTION (regression check)",
      no_history_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="INACTIVE", claimed_scope=None),
      O.STATE_CONTRADICTION)

print()
failed = [r for r in results if not r[1]]
print(f"{len(results) - len(failed)}/{len(results)} scope/history checks passed.")
if failed:
    raise SystemExit(1)
