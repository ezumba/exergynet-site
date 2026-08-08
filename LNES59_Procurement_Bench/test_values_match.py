"""
Direct unit tests for state_consistency_gate_v2.values_match() -- the
fix for taxonomy #16 (LNES59_FAILURE_TAXONOMY.md), found via the first
real X2 run (X2_REAL_RUN_2026-08-08.md). Positive cases are the exact 6
real-model responses that were false-positived by exact equality;
negative cases confirm genuine contradictions still fail to match.

Run: python3 test_values_match.py
"""

from state_consistency_gate_v2 import values_match

results = []


def check(label, asserted, committed, expected):
    got = values_match(asserted, committed)
    ok = got == expected
    results.append((label, ok, got, expected))
    marker = "PASS" if ok else "FAIL"
    print(f"[{marker}] {label}: values_match({asserted!r}, {committed!r}) = {got} (expected {expected})")


# ── The 6 real cases taxonomy #16 was false-positiving ──────────────────
check("B2-003 real (SLA prose)",
      "7 business days delivery SLA, 1% of shipment value per day late penalty",
      "7_DAY_1PCT", True)
check("B3-001 real (Net 60)", "Net 60", "NET_60", True)
check("SMOKE-002 real (Net 60 embedded, second Net-15 mention present too)",
      "Net 60 from invoice date; INV-88213's requested Net 15 terms are invalid",
      "NET_60", True)
check("SMOKE-010 real (PAID prose)", "PAID, $9,410.00", "PAID_9410_ACH", True)
check("B2-007 real (registry negative, prose)",
      "Not present in vendor master registry", "NOT_IN_REGISTRY", True)
check("SMOKE-007 real (registry negative, longer prose)",
      "Vendor E Consulting is not present in the vendor master registry (not a registered vendor)",
      "NOT_IN_REGISTRY", True)

# ── Negative controls: genuine contradictions must still fail to match ──
check("wrong NET term", "Net 30", "NET_60", False)
check("wrong day/pct (right days, wrong pct)",
      "7 business days delivery SLA, 3% of shipment value per day late penalty",
      "7_DAY_1PCT", False)
check("wrong day/pct (wrong days, right pct)",
      "5 business days delivery SLA, 1% of shipment value per day late penalty",
      "7_DAY_1PCT", False)
check("wrong amount", "$61,500.00", "58000", False)
check("PAID vs actually unpaid claim", "The invoice remains unpaid, $9,410.00 outstanding",
      "PAID_9410_ACH", False)
check("PAID right status wrong amount", "PAID, $8,000.00", "PAID_9410_ACH", False)
check("registry: opposite claim (IS registered)",
      "Vendor E Consulting is an active, registered vendor in good standing",
      "NOT_IN_REGISTRY", False)
check("unrelated status token", "The vendor is currently SUSPENDED", "ACTIVE", False)
check("bare number, no amount present", "the amount was not disclosed", "58000", False)
check("None asserted vs a real value", None, "58000", False)
check("exact match still short-circuits", "ACTIVE", "ACTIVE", True)

print()
failed = [r for r in results if not r[1]]
print(f"{len(results) - len(failed)}/{len(results)} values_match checks passed.")
if failed:
    raise SystemExit(1)
