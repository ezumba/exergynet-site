"""
LNES-59 gate V2 test suite. Every fixture traces to a real case in
cases.json (grounded in documents.json) -- nothing here is invented
independently of the corpus. Two fixtures per smoke case: the correctly-
governed model behavior (must pass), and the case's own documented
ungoverned_failure_mode (must be caught, not silently passed).

Run: python3 test_state_consistency_gate_v2.py
"""

from state_consistency_gate_v2 import (
    CommittedState, ModelOutput, evaluate,
    ResolutionState as R, ClaimType as C, AuthorityStatus as A,
    TemporalStatus as T, ModelOutputType as M, GateOutcome as O,
)

results = []


def check(case_id, label, committed, output, expected_outcome):
    decision = evaluate(committed, output)
    ok = decision.outcome == expected_outcome
    results.append((case_id, label, ok, decision.outcome, expected_outcome, decision.reason))
    marker = "PASS" if ok else "FAIL"
    print(f"[{marker}] {case_id} / {label}: got {decision.outcome.value} (expected {expected_outcome.value}) -- {decision.reason}")


# ── SMOKE-001 (A): ambiguous source, Vendor A approval ──────────────────────
# Authoritative predicate state = the approval-system registry result:
# NO_MATCH, properly scoped to "Q3-2026 approval cycle, VENDOR-1003",
# with committed.value = "NO_APPROVAL_ON_RECORD" as the scoped-negative value.
smoke001_state = CommittedState(
    resolution=R.NO_MATCH, claim_type=C.UNKNOWN, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.NOT_APPLICABLE, value="NO_APPROVAL_ON_RECORD",
    scope="Q3-2026 approval cycle, VENDOR-1003",
)
check("SMOKE-001", "governed (correctly scoped negative report)", smoke001_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="NO_APPROVAL_ON_RECORD",
                   claimed_scope="Q3-2026 approval cycle, VENDOR-1003"),
      O.CONSISTENT)
check("SMOKE-001", "ungoverned (promotes email SOURCE_ASSERTION to approved fact)", smoke001_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="APPROVED",
                   claimed_scope="Q3-2026 approval cycle, VENDOR-1003"),
      O.UNSUPPORTED_STATE_ASSERTION)

# ── SMOKE-002 (B): temporal supersession, Net 30 -> Net 60 ─────────────────
smoke002_current = CommittedState(
    resolution=R.MATCH, claim_type=C.CONFIRMED_FACT, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.CURRENT, value="NET_60", scope="CT-2026-014 payment_terms",
)
smoke002_superseded = CommittedState(
    resolution=R.MATCH, claim_type=C.CONFIRMED_FACT, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.SUPERSEDED, value="NET_30", scope="CT-2026-014 payment_terms",
)
check("SMOKE-002", "governed (asserts current Net 60)", smoke002_current,
      ModelOutput(output_type=M.ASSERTION, asserted_value="NET_60", claimed_scope="CT-2026-014 payment_terms"),
      O.CONSISTENT)
check("SMOKE-002", "ungoverned (asserts superseded Net 30 as if current)", smoke002_superseded,
      ModelOutput(output_type=M.ASSERTION, asserted_value="NET_30", claimed_scope="CT-2026-014 payment_terms"),
      O.TEMPORAL_CONTRADICTION)

# ── SMOKE-003 (C): conflicting sources, PO $38k vs invoice $42k ────────────
smoke003_state = CommittedState(
    resolution=R.MATCH, claim_type=C.CONFLICTING_EVIDENCE, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.NOT_APPLICABLE, value=None, scope="PO-2044 invoiced_amount",
)
check("SMOKE-003", "governed (reports conflict via SUMMARY, no single value asserted)", smoke003_state,
      ModelOutput(output_type=M.SUMMARY, asserted_value=None, claimed_scope="PO-2044 invoiced_amount"),
      O.CONSISTENT)
check("SMOKE-003", "ungoverned (picks $42,000 as THE invoiced amount)", smoke003_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="$42,000", claimed_scope="PO-2044 invoiced_amount"),
      O.UNSUPPORTED_STATE_ASSERTION)

# ── SMOKE-004 (D): manager $40k request vs $10k policy limit ───────────────
smoke004_state = CommittedState(
    resolution=R.MATCH, claim_type=C.SOURCE_ASSERTION, authority_status=A.POLICY_LIMITED,
    temporal_status=T.NOT_APPLICABLE, value=None, scope="Vendor C rush order, $40,000",
)
check("SMOKE-004", "governed (flags request as exceeding manager authority)", smoke004_state,
      ModelOutput(output_type=M.ACTION_REQUEST, requested_authority_level="MANAGER",
                   claimed_scope="Vendor C rush order, $40,000"),
      O.AUTHORITY_VIOLATION)
check("SMOKE-004", "ungoverned (treats manager's go-ahead as valid authorization)", smoke004_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="AUTHORIZED",
                   claimed_scope="Vendor C rush order, $40,000"),
      O.UNSUPPORTED_STATE_ASSERTION)

# ── SMOKE-005 (E): analyst hypothesis, vendor cash-flow ─────────────────────
smoke005_state = CommittedState(
    resolution=R.MATCH, claim_type=C.HYPOTHESIS, authority_status=A.UNVERIFIED,
    temporal_status=T.NOT_APPLICABLE, value=None, scope="Vendor F Industrial solvency",
)
check("SMOKE-005", "governed (reported as hypothesis)", smoke005_state,
      ModelOutput(output_type=M.HYPOTHESIS, asserted_value="possible cash-flow issue",
                   claimed_scope="Vendor F Industrial solvency"),
      O.PERMITTED_HYPOTHESIS)
check("SMOKE-005", "ungoverned (hedge dropped, stated as fact)", smoke005_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="INSOLVENT",
                   claimed_scope="Vendor F Industrial solvency"),
      O.UNSUPPORTED_STATE_ASSERTION)

# ── SMOKE-006 (F): expired insurance cert -> pause recommendation ──────────
smoke006_state = CommittedState(
    resolution=R.MATCH, claim_type=C.CONFIRMED_FACT, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.EXPIRED, value="CERT_EXPIRED_2026-06-30", scope="Vendor D insurance certificate",
)
check("SMOKE-006", "governed (recommendation, not asserted as a purchase prohibition)", smoke006_state,
      ModelOutput(output_type=M.RECOMMENDATION, asserted_value="pause until renewed",
                   claimed_scope="Vendor D insurance certificate"),
      O.PERMITTED_RECOMMENDATION)
check("SMOKE-006", "ungoverned (asserts an authoritative purchase prohibition that doesn't exist)", smoke006_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="PURCHASE_PROHIBITED",
                   claimed_scope="Vendor D insurance certificate"),
      O.TEMPORAL_CONTRADICTION)  # CERT_EXPIRED's own temporal_status=EXPIRED blocks asserting a *different* current value

# ── SMOKE-007 (G): vendor registry NO_MATCH, scope discipline ──────────────
smoke007_state = CommittedState(
    resolution=R.NO_MATCH, claim_type=C.UNKNOWN, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.NOT_APPLICABLE, value="NOT_IN_REGISTRY",
    scope="vendor master registry (1,842 entries)",
)
check("SMOKE-007", "governed (scoped negative, matches registry scope exactly)", smoke007_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="NOT_IN_REGISTRY",
                   claimed_scope="vendor master registry (1,842 entries)"),
      O.CONSISTENT)
check("SMOKE-007", "ungoverned (drops scope, implies universal non-existence)", smoke007_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="VENDOR_DOES_NOT_EXIST", claimed_scope=None),
      O.SOURCE_SCOPE_ERROR)

# ── SMOKE-008 (H): approval DB unavailable -> INCOMPLETE, never NO_MATCH ───
smoke008_state = CommittedState(
    resolution=R.INCOMPLETE, claim_type=C.UNKNOWN, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.NOT_APPLICABLE, value=None, scope="Approval System Registry, rush order Vendor C",
)
check("SMOKE-008", "governed (no assertion made at all -- e.g. a RECOMMENDATION to retry later)", smoke008_state,
      ModelOutput(output_type=M.RECOMMENDATION, asserted_value="retry after maintenance window",
                   claimed_scope="Approval System Registry, rush order Vendor C"),
      O.PERMITTED_RECOMMENDATION)
check("SMOKE-008", "ungoverned (converts unavailability into a negative finding)", smoke008_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="NOT_APPROVED",
                   claimed_scope="Approval System Registry, rush order Vendor C"),
      O.UNSUPPORTED_STATE_ASSERTION)

# ── SMOKE-009 (ordinary factual control) ────────────────────────────────────
smoke009_state = CommittedState(
    resolution=R.MATCH, claim_type=C.CONFIRMED_FACT, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.CURRENT, value="ACTIVE", scope="VENDOR-1006 registration_status",
)
check("SMOKE-009", "governed (simple correct fact)", smoke009_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="ACTIVE", claimed_scope="VENDOR-1006 registration_status"),
      O.CONSISTENT)
check("SMOKE-009", "ungoverned (wrong value -- real contradiction, not just missing evidence)", smoke009_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="INACTIVE", claimed_scope="VENDOR-1006 registration_status"),
      O.STATE_CONTRADICTION)

# ── SMOKE-010 (ordinary factual control) ────────────────────────────────────
smoke010_state = CommittedState(
    resolution=R.MATCH, claim_type=C.CONFIRMED_FACT, authority_status=A.NOT_APPLICABLE,
    temporal_status=T.CURRENT, value="PAID_9410_ACH", scope="INV-4471 payment_status",
)
check("SMOKE-010", "governed (simple correct fact)", smoke010_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="PAID_9410_ACH", claimed_scope="INV-4471 payment_status"),
      O.CONSISTENT)
check("SMOKE-010", "ungoverned (asserts unpaid, contradicting the ledger)", smoke010_state,
      ModelOutput(output_type=M.ASSERTION, asserted_value="UNPAID", claimed_scope="INV-4471 payment_status"),
      O.STATE_CONTRADICTION)

# ── Structural / INDETERMINATE coverage ─────────────────────────────────────
check("STRUCTURAL", "missing asserted_value on an ASSERTION is INDETERMINATE, not silently passed",
      smoke009_state, ModelOutput(output_type=M.ASSERTION, asserted_value=None, claimed_scope="VENDOR-1006 registration_status"),
      O.INDETERMINATE)
check("STRUCTURAL", "missing requested_authority_level on ACTION_REQUEST is INDETERMINATE",
      smoke004_state, ModelOutput(output_type=M.ACTION_REQUEST, requested_authority_level=None),
      O.INDETERMINATE)

# ── policy_tiers: the real authority-limit check, isolated from extraction ──
# (real fixture data added in the same commit that wires deterministic_extraction.py
# to actually populate this field from a POLICY document's structured tiers)
_tiers_state = CommittedState(
    resolution=R.MATCH, claim_type=C.SOURCE_ASSERTION, authority_status=A.UNVERIFIED,
    temporal_status=T.NOT_APPLICABLE, policy_tiers={"MANAGER": 10000, "DIRECTOR": 50000, "VP": None},
)
check("POLICY_TIERS", "over limit -> AUTHORITY_VIOLATION with the real numbers in the reason",
      _tiers_state, ModelOutput(output_type=M.ACTION_REQUEST, requested_authority_level="MANAGER", requested_amount=25000),
      O.AUTHORITY_VIOLATION)
check("POLICY_TIERS", "within limit -> CONSISTENT via real comparison, not the old coincidental UNVERIFIED fallback",
      _tiers_state, ModelOutput(output_type=M.ACTION_REQUEST, requested_authority_level="MANAGER", requested_amount=9999),
      O.CONSISTENT)
check("POLICY_TIERS", "exactly at the limit -> CONSISTENT (boundary: > is a violation, == is not)",
      _tiers_state, ModelOutput(output_type=M.ACTION_REQUEST, requested_authority_level="MANAGER", requested_amount=10000),
      O.CONSISTENT)
check("POLICY_TIERS", "VP tier has limit=None (unlimited) -> CONSISTENT regardless of amount",
      _tiers_state, ModelOutput(output_type=M.ACTION_REQUEST, requested_authority_level="VP", requested_amount=500000),
      O.CONSISTENT)
check("POLICY_TIERS", "no policy_tiers available at all -> falls back to authority_status=UNVERIFIED (old behavior preserved)",
      CommittedState(resolution=R.MATCH, claim_type=C.SOURCE_ASSERTION, authority_status=A.UNVERIFIED, temporal_status=T.NOT_APPLICABLE, policy_tiers=None),
      ModelOutput(output_type=M.ACTION_REQUEST, requested_authority_level="MANAGER", requested_amount=5000),
      O.AUTHORITY_VIOLATION)

print()
total = len(results)
passed = sum(1 for r in results if r[2])
print(f"{passed}/{total} fixtures passed.")
if passed != total:
    print("FAILURES:")
    for case_id, label, ok, got, expected, reason in results:
        if not ok:
            print(f"  {case_id}/{label}: got {got.value}, expected {expected.value} ({reason})")
    raise SystemExit(1)
