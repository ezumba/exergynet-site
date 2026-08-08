"""
LNES-59 Phase 5 Section 9: focused development test matrix for
_is_unavailable(), the subsystem taxonomy #19 exposed. Directly
red-teams the SHOULD/MUST-NOT phrase list the Trustee directive
specified, against real document-shaped inputs.

DEVELOPMENT RESULTS -- NON-BLIND.

First run of this matrix (2026-08-08) found 2 real misses ("database
offline", "records could not be accessed" were not detected at all) --
fixed as taxonomy #20 (see LNES59_FAILURE_TAXONOMY.md), _UNAVAILABLE_MARKERS
extended. This file reflects the CURRENT, fixed, correct behavior; the
before/after is recorded in the taxonomy, not duplicated here.

Run: python3 test_unavailability_detection.py
"""

from deterministic_extraction import _is_unavailable, _is_no_record

results = []


def check(label, text, checker, expected):
    got = checker({"content": text})
    ok = got == expected
    results.append((label, ok))
    marker = "PASS" if ok else "FAIL"
    print(f"[{marker}] {label}: {text!r} -> {got} (expected {expected})")


# ── SHOULD indicate unavailability ──────────────────────────────────────
SHOULD_DETECT = [
    "system undergoing scheduled maintenance",
    "registry temporarily unavailable",
    "database offline",
    "service unavailable",
    "records could not be accessed",
]
for text in SHOULD_DETECT:
    check(f"SHOULD-detect", text, _is_unavailable, True)

# ── MUST NOT trigger unavailability (ordinary business vocabulary) ─────
MUST_NOT = [
    "equipment maintenance contract",
    "maintenance services invoice",
    "vendor provides maintenance",
    "annual maintenance fee",
    "maintenance department approved purchase",
]
for text in MUST_NOT:
    check(f"MUST-NOT-trigger", text, _is_unavailable, False)

# ── Prefer phrase/context patterns over isolated generic nouns: same
# discipline applies to _is_no_record()'s "NO MATCH"/"NO RECORD FOUND"
# markers -- spot-check these don't collide with ordinary "no match"
# usage in an unrelated sense (e.g. a sports/scheduling context this
# corpus doesn't have, but worth confirming the markers are still
# multi-word/specific enough that they wouldn't accidentally fire) ──
check("NO_RECORD marker specificity: does not fire on unrelated 'no' usage",
      "There is no reason to delay this purchase order.", _is_no_record, False)
check("NO_RECORD marker specificity: does not fire on unrelated 'match' usage",
      "The vendor's proposal is a good match for our requirements.", _is_no_record, False)
check("NO_RECORD marker still fires on its real corpus phrasing",
      "Result: NO MATCH. Vendor is not present in the registry.", _is_no_record, True)

print()
passed = sum(1 for _, ok in results if ok)
print(f"{passed}/{len(results)} unavailability/no-record detection checks passed.")
if passed != len(results):
    raise SystemExit(1)
