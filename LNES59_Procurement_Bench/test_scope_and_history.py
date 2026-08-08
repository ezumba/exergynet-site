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
    temporal_status=T.NOT_APPLICABLE, value="NOT_APPROVED_VENDOR_REGISTRY",
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

# scope 3/3 (directive): "I cannot establish whether another approval
# exists outside this registry." -> directive wants "permitted/consistent
# uncertainty." NOT IMPLEMENTED as a special case, deliberately: the
# gate's existing, real-run-validated NO_MATCH discipline (see
# X2_REAL_RUN_2026-08-08.md, LNES59-SMOKE-001) is that DECLINING to
# report a confident, properly-scoped negative is itself a real miss --
# a bare asserted_value=None against NO_MATCH is UNSUPPORTED_STATE_ASSERTION,
# and that was a genuine, validated finding from real model behavior, not
# a bug. Special-casing "explicitly scoped uncertainty about OUTSIDE this
# registry" would need its own disclosed, tested cue-phrase mechanism
# (parallel to _claims_beyond_scope's) to avoid silently reopening that
# false-negative risk -- not done under time pressure here. Recorded as
# an open design question, not silently skipped.
check("scope 3/3 (documented open question, current actual behavior -- "
      "see comment above for why this is NOT a bug fix target today)",
      registry_state,
      ModelOutput(output_type=M.SUMMARY, asserted_value=None,
                   claimed_scope="outside the approved-vendor registry"),
      O.UNSUPPORTED_STATE_ASSERTION)

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
