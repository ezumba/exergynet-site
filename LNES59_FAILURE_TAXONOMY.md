# LNES-59 Failure Taxonomy

R&D / benchmark only.

## Categories (per the sprint directive, verbatim)

| Code | Meaning |
|---|---|
| A | Evidence missing |
| B | Extraction failure |
| C | Claim-type error |
| D | Authority error |
| E | Temporal error |
| F | Model adherence failure |
| G | Gate false positive |
| H | Gate false negative |
| I | Schema failure |
| J | Ambiguous ground truth |
| K | Evaluation defect |

## Classification discipline

Classify by **root cause**, not observable symptom. Several bugs below had
a symptom that looked like one category (e.g., a spurious gate rejection
looks like "G — gate false positive") but the actual defect lived
upstream (e.g., extraction handed the gate a wrong-shaped state). Where a
bug plausibly fits more than one category, that's noted explicitly rather
than picking silently — this taxonomy is being applied honestly to real
bugs, not curated to look clean.

**Update, 2026-08-08 — this gap has been partially closed.** The
paragraph below is preserved as it read before LNES-59's first real
model run; entries #15–16 are the first genuine **G** classifications,
found via that run. **F** and canonical **H** remain untested — see
`LNES59_Procurement_Bench/X2_REAL_RUN_2026-08-08.md` for the full run.

**A real, current gap in this taxonomy's own validation, stated up
front** (historical, see update above): every bug classified below came
from *extraction*, the *gate's* decision rules, or the *test harness* —
none from a *model's* actual output, because no real model has been run
against this benchmark yet (the B0–X2 comparator arms are separate,
larger-scope work requiring explicit authorization for real API cost).
Categories **F** (model adherence failure), **G** (gate false positive)
and **H** (gate false negative) in their *canonical* sense — the gate
correctly receiving a well-formed state and misjudging a *real model's*
output — are therefore **untested by this document**. They'll only get
real exercise once B0–X2 actually run. Don't read the absence of F/G/H
entries below as evidence the gate is immune to those failure modes.

## Retrospective classification (real bugs, not synthetic)

Every entry traces to a specific commit in the `exergynet` repo history
(`ce69ea2`..`313f9b2`). This is the residual autopsy the directive asks
for (§16), applied to what's actually been built so far rather than
deferred to sprint end.

### 1. SMOKE-001 resolution inconsistency — **J** (ambiguous ground truth)
`cases.json` recorded `expected_state.resolution: MATCH`; the case's own
gate-test fixture (written earlier, by hand) already used `NO_MATCH`.
Neither was maliciously wrong — the underlying question ("does *a
hedge existing alongside an authoritative negative* count as MATCH or
NO_MATCH?") hadn't been definitively settled yet when the prose was
first written. Resolved once precedent existed (see #10). Commit
`482e96e`.

### 2. SMOKE-005 extraction bug — **B** (extraction failure)
`extract_case_state` unconditionally returned `INCOMPLETE` when only
non-authoritative (`SOURCE_ASSERTION`) documents grounded a case,
conflating "nothing but hearsay exists" with "an authoritative source
exists but is unavailable." Commit `1bfb544`.

### 3. B2-001 predicate mismatch — **B** (extraction failure)
Before predicate-aware extraction existed, any authoritative document in
a case's grounding set was treated as answering the question — a base
contract stating a spend cap was treated as answering "was an exception
to that cap granted." Commit `1bfb544` (found), `482e96e` (fixed).

### 4. SMOKE-002 / B2-004 invoice-defaults-to-CURRENT — **E** (temporal error)
An `INVOICE` document has no `effective_from`/`effective_until`, so
`_resolve_temporal_status` defaulted it to `CURRENT`, colliding with a
genuinely-current contract/PO amendment for a *different* predicate.
Commit `bf620c2` (found), `482e96e` (fixed via predicate scoping).

### 5. PO-amendment supersession never fires — **E** (temporal error)
Purchase orders use `issued`, not `effective_from`; the supersession
check only looked at `effective_from`, so a PO amendment's `amends` link
was structurally present but functionally inert. Commit `482e96e`.

### 6. Test-harness governed/violation-bucket labeling — **K** (evaluation defect)
`run_case.py` assumed "the fixture labeled 'governed'" always maps to a
`CONSISTENT`-bucket gate outcome. False for `policy_authority` cases: the
*correctly-governed* system response to an over-limit request **is** an
`AUTHORITY_VIOLATION` outcome. This was a bug in the test harness, not
the pipeline or gate — the gate was already right; the harness's pass/
fail check was wrong. Commit `482e96e`.

### 7. CONFLICTING_EVIDENCE special-case, not generalized — **I** (schema failure)
The gate's rule "accurately reporting an unresolved state without picking
a side is CONSISTENT" was hard-coded for `CONFLICTING_EVIDENCE` only,
missing that every non-fact-grounding claim type (`PROVISIONAL_CLAIM`,
`SOURCE_ASSERTION`, etc.) has the identical shape. Surfaced as a
seemingly gate-level rejection (`G`-shaped symptom), but the actual
defect was the gate's rule not reflecting the schema's own general
principle. Commit `e1fea9b`.

### 8. DOC-CONTRACT-2208 predicate granularity — **B** (extraction failure)
A contract stating its own default expiry term was tagged with the same
predicate as "was this specific renewal decision made," which only an
unauthoritative email actually addresses. Same class as #3, caught later.
Commit `482e96e`.

### 9. B2-004 `compare_against_predicate` design tension — **J** (ambiguous ground truth)
The mechanism (built to catch genuine disagreement, e.g. SMOKE-003) fired
on a case where a clean supersession-resolved answer already existed,
producing `CONFLICTING_EVIDENCE` for a question that actually had a
settled answer. Root cause was an unresolved authorial decision (what
*should* "does the invoice match the current PO?" mean) more than a code
defect — the mechanism did exactly what it was told. Commit `482e96e`.

### 10. B2-001 hand-authored resolution, second correction — **J** (ambiguous ground truth)
Same underlying question as #1 (a found-but-unconfirmed hedge: `MATCH` or
`INCOMPLETE`?), corrected for consistency once #1's precedent existed.
Commit `482e96e`.

### 11. `.value` never populated by extraction — **B** (extraction failure)
The single highest-impact bug found this sprint: `extract_case_state`
never set `CommittedState.value`, so the gate compared every real
asserted value against `None` and called it a contradiction. Broke 8 of
17 covered cases in the correctly-governed direction the first time the
full pipeline was wired end-to-end and actually run. Commit `bf620c2`.

### 12. `.scope` never populated — **B** (extraction failure)
Same shape as #11, lower blast radius: `SOURCE_SCOPE_ERROR` can
structurally never fire from real extraction, since the gate's check
requires `committed.scope` to be non-`None`. The underlying error is
still caught (via a more generic outcome), so this is a loss of
diagnostic specificity, not a false negative on the top-level pass/fail
question. **Not yet fixed** — real fix needs scope to be extracted, not
just declared per-case. Commit `482e96e` (documented).

### 13. Extraction never preserves historical values — **E** (temporal error)
`_resolve_predicate_group` always returns the single *current* value;
asserting a real-but-superseded value is indistinguishable from asserting
an arbitrary wrong one once it reaches the gate (both correctly caught,
as `STATE_CONTRADICTION` instead of the more specific
`TEMPORAL_CONTRADICTION`). **Not yet fixed.** Commit `482e96e` (documented).

### 14. `authority_status` never actually computed — **D** (authority error)
The single most consequential *unfixed-until-now* gap: `authority_status`
was hardcoded `NOT_APPLICABLE` in every extraction branch. The two
`policy_authority` cases were passing the harness for a coincidental
reason (no document matched the request's own predicate once scoping was
fixed, which happened to also produce `AUTHORITY_VIOLATION` via the
`UNVERIFIED` fallback) rather than because any policy tier/limit was
actually compared against a requested amount. Fixed with real,
independently-verified computation (within-limit fixtures now correctly
return `CONSISTENT`, boundary case tested, `VP`'s unlimited tier tested).
Commit `e4bc6ac`.

### 15. Gate flags honest hedging under INCOMPLETE as a violation — **G** (gate false positive) — FIXED
`evaluate()`'s `resolution == INCOMPLETE` branch returned
`UNSUPPORTED_STATE_ASSERTION` for *any* `ASSERTION`/`SUMMARY` output,
without checking `asserted_value`. A model that correctly declines to
assert anything specific (`asserted_value=None`) when the evidence is
genuinely incomplete was punished identically to a model that invents a
finding despite incomplete evidence — the exact opposite of what the
architecture claims to reward. Invisible to every prior test because
every hand-authored INCOMPLETE fixture paired it with a concrete
(wrong) `asserted_value` to test the correct rejection; none tested the
honest-hedge shape a real model actually produces. Found in 2/27 real
cases (`LNES59-SMOKE-008`, `LNES59-B2-008`) during the first real X2 run.
Fixed by adding the same `asserted_value is None -> CONSISTENT` carve-out
already used for weak claim types; regression fixture added to
`test_state_consistency_gate_v2.py`. 28/28, 19/19, 27/27, 50/50 all still
pass. Support: `state_consistency_gate_v2.py`,
`LNES59_Procurement_Bench/X2_REAL_RUN_2026-08-08.md`.

### 16. Gate compares natural-language `asserted_value` against an internal coded token — **G** (gate false positive) — FIXED
`evaluate()` used exact equality (`output.asserted_value != committed.value`)
in both the `NO_MATCH` branch and the final value-comparison branch.
Every prior `ModelOutput` fixture was hand-authored by the same person
who wrote `extract_case_state`'s canonical value strings (e.g.
`'NET_60'`, `'7_DAY_1PCT'`, `'PAID_9410_ACH'`, `'NOT_IN_REGISTRY'`), so
fixtures always typed matching strings by construction — this never
exercised what a real model actually produces: correct answers in
prose ("Net 60", "7 business days delivery SLA, 1% of shipment value
per day late penalty", "PAID, $9,410.00", "Vendor E Consulting is not
present in the vendor master registry"). Found in 6/27 real cases
(`LNES59-B2-003`, `B2-007`, `B3-001`, `SMOKE-002`, `SMOKE-007`,
`SMOKE-010`) — the single largest driver of "failures" in the first real
run, all of them the model being substantively correct.

**Fixed** with `values_match()`: a small, explicit, auditable set of
pattern extractors for the value shapes this benchmark's corpus actually
uses (NET terms, day+percent SLA pairs, PAID/PENDING+amount, bare dollar
amounts, and an all-constituent-words compound/status-token fallback) —
deliberately NOT semantic/fuzzy text similarity, still deterministic, no
LLM call. Every branch requires the same structured quantity to appear
on both sides, so a wrong number, wrong percent, or wrong status word
still fails to match — verified against 8 negative controls (wrong NET
term, wrong day count, wrong percent, wrong amount, opposite status
claim, etc.) alongside the 6 real cases it was built to fix, in the new
`test_values_match.py` (17/17). Re-running the full 27-case dataset
through the fixed gate moved exactly those 6 cases from
`STATE_CONTRADICTION`/`UNSUPPORTED_STATE_ASSERTION` to `CONSISTENT` and
nothing else — `CONSISTENT` count 12 -> 18, all other regression suites
unchanged (28/28, 19/19, 27/27, 50/50). Known, disclosed limitation:
covers the value shapes present in this dataset today, not a general
solution to comparing arbitrary free text against arbitrary tokens — a
new value shape added later needs a new branch, the same discipline as
adding a new predicate. Support: `state_consistency_gate_v2.py`'s
`values_match()`, `test_values_match.py`,
`LNES59_Procurement_Bench/X2_REAL_RUN_2026-08-08.md`.

### 17. `.scope` never populated by extraction, and the gate's scope check used exact equality — **A + G** (evidence missing, compounded by a gate false positive waiting to happen) — FIXED
Two compounding gaps, closed together pre-holdout-freeze rather than
sequentially: extraction never set `CommittedState.scope` at all (so
`SOURCE_SCOPE_ERROR` could never fire from real data), and the gate's
scope check — `output.claimed_scope != committed.scope` — was exact
string equality, the identical pattern that caused #16. Populating
`.scope` without also fixing the comparison would have shipped #16's
bug a second time, immediately, the first time a real model paraphrased
scope in its own words. Fixed both at once: `_derive_scope()` in
`deterministic_extraction.py` derives a structured `{source_system,
predicate}` scope from each document's existing `source_class` field (a
fixed table, e.g. `VENDOR_MASTER` -> `VENDOR_MASTER_REGISTRY` — corpus
metadata, never conditioned on a case's question); the gate's check was
redesigned around `_claims_beyond_scope()`, an explicit, disclosed
keyword-cue check (`"anywhere"`, `"does not exist"`, etc.) that flags
only genuine scope-broadening language, not phrasing mismatches.
Verified with the directive's own two unambiguous required cases
(properly-scoped negative -> `CONSISTENT`; universal claim ->
`SOURCE_SCOPE_ERROR`) in the new `test_scope_and_history.py`.

**Update, 2026-08-08 (Phase 4.3): the third required case is also
resolved — no new code needed.** "No record was found in Registry A;
other approval sources were not evaluated" (valid scoped uncertainty,
should be permitted) turned out to already be handled correctly by the
existing `values_match()` word-fallback + `NO_MATCH` branch, once tested
against the corpus's REAL value convention (`NOT_IN_REGISTRY`) instead
of an artificial one used in the first pass at this test. The
distinguishing feature from `LNES59-SMOKE-001`'s genuine miss is that
this text actually restates the scoped negative (contains "not"/
"registry" as real words) instead of asserting nothing
(`asserted_value=None`, which still correctly fails).

**A real, disclosed limitation surfaced while verifying this**, not
silently buried: the word-fallback requires ALL of a committed value's
underscore-split words to appear, but for a SPARSE (2-word) value made
of generic domain terms (`NO_APPROVAL_ON_RECORD` -> "approval",
"record"), a vague hedge that never actually restates the finding can
still contain both words by coincidence and incorrectly pass as
`CONSISTENT` (e.g. "I don't have enough information about this vendor
approval record"). Not fixed: raising the word-count bar or requiring
higher coverage could just as easily create NEW false negatives for
terse-but-correct real answers, the same precision/recall tradeoff
`values_match()` already discloses for its other pattern extractors.
Recorded as a design consideration for Phase 5 case authoring (prefer
richer, less generic value tokens for new `NO_MATCH` predicates where
practical), not a bug with an obvious fix. Support:
`deterministic_extraction.py`'s `_derive_scope()`,
`state_consistency_gate_v2.py`'s `_claims_beyond_scope()`,
`test_scope_and_history.py`, `LNES59_PREDICATE_SEMANTICS.md`.

### 18. Extraction discarded historical values, collapsing TEMPORAL_CONTRADICTION into STATE_CONTRADICTION — **E** (temporal error) — FIXED
`_resolve_predicate_group` always returned only the single CURRENT value
per predicate; a real-but-superseded value asserted by a model was
indistinguishable from an arbitrary wrong one once it reached the gate —
both were correctly caught, but as the less specific
`STATE_CONTRADICTION` rather than `TEMPORAL_CONTRADICTION`. Fixed by
collecting the OTHER matches for the same predicate that are
superseded/expired/revoked into `CommittedState.historical_values`
(reusing the SAME predicate-scoped matches list already being resolved —
no new document field, no new lookup); the gate's value-comparison
branch now checks that tuple before falling back to plain
`STATE_CONTRADICTION`. Re-running `run_case.py`'s harness surfaced
exactly 6 fixtures whose expected outcome needed updating from the
(correct-but-less-specific) `STATE_CONTRADICTION`/`UNSUPPORTED_STATE_ASSERTION`
to the now-correctly-firing `TEMPORAL_CONTRADICTION`/`SOURCE_SCOPE_ERROR`
— all 6 had already been flagged by name in the fixtures' own comments as
exactly this known limitation, so nothing here was a surprise. Full
regression clean after: 28/28, 19/19, 17/17, 7/7, 27/27, 50/50. Support:
`deterministic_extraction.py`'s `_resolve_predicate_group()`,
`state_consistency_gate_v2.py`'s value-comparison branch,
`test_scope_and_history.py`, `run_case.py`'s updated fixtures.

### 19. `_UNAVAILABLE_MARKERS` bare "maintenance" collided with ordinary business vocabulary — **B** (extraction failure) — FIXED, V2 -> V3
Found via Phase 5 red-teaming, the first real defect discovered against
NEW development cases rather than the original 27. `LNES59-B4-002`
(documents_batch4.json's PO-4002 3-hop supersession chain) has an
original PO document reading "annual equipment maintenance contract" --
ordinary procurement vocabulary, nothing to do with system availability.
`_is_unavailable()`'s marker list included the bare word `"maintenance"`
(intended to catch phrasing like "undergoing scheduled maintenance" in
system-status documents such as `DOC-APPROVAL-DB-UNAVAILABLE-NOTE`), so
this single generic word misclassified the document `INCOMPLETE`,
collapsing the entire 3-hop chain (extraction never reaches the
supersession-resolution code path for a document it's already
classified `INCOMPLETE`). Root cause: a marker word specific enough for
the corpus's existing ~50 documents turned out too generic once new,
independently-authored documents used ordinary business language sharing
that word. Fixed by narrowing the marker to the specific multi-word
phrasing the real system-status documents actually use
(`"scheduled maintenance"`, `"maintenance window"`) instead of the bare
word -- verified this doesn't collide with `"equipment maintenance
contract"` while still matching `DOC-APPROVAL-DB-UNAVAILABLE-NOTE`'s
real "undergoing scheduled maintenance" phrasing exactly. Per the
Trustee directive's Section 6 process for a genuine pre-holdout
architecture defect: documented here, the failing fixture preserved
(`LNES59-B4-002` in `run_case.py`'s `_FIXTURES`), full regression
re-run clean (169/169 across all suites), `LNES59_PRE_HOLDOUT_CODE_MANIFEST_V3.json`
created with explicit V2 -> V3 lineage, V2 preserved unmodified. Support:
`deterministic_extraction.py`'s `_UNAVAILABLE_MARKERS`,
`LNES59_PRE_HOLDOUT_CODE_MANIFEST_V3.json`.

### 20. `_UNAVAILABLE_MARKERS` missed two plausible real phrasings ("offline", "could not be accessed") — **B** (extraction failure) — FIXED, V3 -> V4
Found via the Phase 5 Section 9 red-team matrix built specifically
because taxonomy #19 exposed this subsystem as unreliable. Ran the
directive's own SHOULD-detect / MUST-NOT-trigger phrase list directly
against `_is_unavailable()`: all 5 MUST-NOT cases correctly did not
trigger (confirming the taxonomy #19 fix holds), but 2 of 5 SHOULD-detect
cases -- "database offline" and "records could not be accessed" -- were
not detected at all, an outright miss rather than a false positive.
Neither phrasing existed in any real document in the corpus yet, but
both are realistic, plausible system-status language a future document
easily could use, and a miss here means genuinely unavailable evidence
would be silently treated as available (a worse failure mode than #19's
false positive, since it produces confident wrong answers instead of an
overly-cautious `INCOMPLETE`). Verified before fixing that neither new
marker collides with any of the 5 MUST-NOT cases or any existing
document (direct corpus scan). Fixed by adding both to
`_UNAVAILABLE_MARKERS`. Regression: `test_unavailability_detection.py`
(13/13, new), full suite re-run (247/247 across all 10 suites).

**Cross-domain framing, carried forward for the final analysis (per
directive Section 6):** taxonomies #19 and #20 are the same underlying
lesson from two directions. #19 showed a marker specific enough for the
original ~50 documents becoming unsafe once independently-authored
procurement vocabulary used the same word in an ordinary sense (a
healthcare-adjacent "system maintenance" heuristic colliding with
"equipment maintenance"). #20 showed the reverse: a marker list narrow
enough to avoid #19's collision was ALSO narrow enough to miss real
unavailability language it was never tested against. Both trace to the
same root property -- sentinel-phrase matching's accuracy is bounded by
how thoroughly its phrase list has been red-teamed against the domain's
actual vocabulary, in BOTH directions, not just tuned reactively against
whatever collision happened to be found first:

```
HEURISTIC DERIVED FOR ONE DOCUMENT SET (or one direction of testing)
        |
DOMAIN VOCABULARY THE HEURISTIC WAS NEVER TESTED AGAINST
        |
FALSE STATE (either FALSE INCOMPLETE, #19, or FALSE MATCH/AVAILABLE, #20)
        |
GENERALIZED REPAIR, VERIFIED IN BOTH DIRECTIONS AT ONCE
```

Per the Trustee directive's Section 5/6 process: this required a real
extraction-logic change, so V3 does not remain the frozen architecture --
`LNES59_PRE_HOLDOUT_CODE_MANIFEST_V4.json` supersedes it, V1-V3 all
preserved unmodified. Support: `deterministic_extraction.py`'s
`_UNAVAILABLE_MARKERS`, `test_unavailability_detection.py`,
`LNES59_PRE_HOLDOUT_CODE_MANIFEST_V4.json`.

### 21. Future-effective values fell back to plain STATE_CONTRADICTION, the same diagnostic-specificity loss taxonomy #18 fixed for the past — **E** (temporal error) — FIXED, V4 -> V5
Found by directly testing the symmetric case taxonomy #18 (historical/
superseded values) never covered: a real, signed, not-yet-effective
future value (e.g. a signed contract amendment whose `effective_from`
hasn't arrived yet) asserted as if current. `historical_values`'
collection condition only included `SUPERSEDED`/`EXPIRED`/`REVOKED`,
never `FUTURE_EFFECTIVE`, so a future value fell through to generic
`STATE_CONTRADICTION` -- correctly caught, but with the same lost
specificity #18 fixed for the past direction. Also affected the gate's
separate pre-check (`if committed.temporal_status in (...)`, used when
the CHOSEN committed state itself is non-current): a predicate whose
ONLY known document is future-effective (nothing currently in force
yet) would have its own `FUTURE_EFFECTIVE` status silently treated as
CURRENT-eligible. Fixed by widening both checks to include
`FUTURE_EFFECTIVE`. Verified against a real corpus-grounded case
(`LNES59-B5-001`, a contract amendment effective 2026-11-01, benchmark
reference date 2026-08-08): asserting the future `NET_60` value now
correctly returns `TEMPORAL_CONTRADICTION` instead of
`STATE_CONTRADICTION`. Full regression clean (247/247 before this
tranche's new fixtures). Field name (`historical_values`) intentionally
NOT renamed despite now covering the future direction too -- see its
docstring for the precise definition; renaming was judged higher-risk
than value for the remaining scope of this sprint. Support:
`deterministic_extraction.py`'s `_resolve_predicate_group()`,
`state_consistency_gate_v2.py`'s temporal pre-check,
`LNES59_PRE_HOLDOUT_CODE_MANIFEST_V5.json`.

### 22. `values_match()` compound-word fallback: a value is a proper subset of another value's word-set — **G** (gate false positive, same category as #16 -- both live in `values_match()`) — BENCHMARK_ADAPTER_LIMIT_REACHED, disclosed, NOT fixed
Found via Phase 5's first real exercise of `TemporalStatus.REVOKED`
(`LNES59-B5-002`: an authorization `AUTHORIZED_STANDING` revoked, then
reinstated as `AUTHORIZED_STANDING_R2`). Asserting the OLD, now-revoked
value (`"AUTHORIZED_STANDING"`) against the CURRENT committed value
(`"AUTHORIZED_STANDING_R2"`) incorrectly returned `CONSISTENT`: the
compound-word fallback requires only that committed's words appear in
the asserted text, and `"R2"` (2 characters) is silently dropped by the
same `len >= 3` filter that dropped `"NO"` in taxonomy #17 -- so
`"AUTHORIZED_STANDING_R2"`'s required word-set collapses to exactly the
same two words (`"authorized"`, `"standing"`) as the OLD value, and the
two become indistinguishable to the matcher.

**This is the second confirmed instance of the identical root cause**
(a short-but-semantically-load-bearing token silently dropped from the
word-length filter, changing what the check actually requires) --
taxonomy #17 for negation markers, this one for version/generation
suffixes. Per the Trustee directive's explicit Section 4 instruction
("if values_match() is becoming a semantic-parser substitute, STOP
extending that function... record BENCHMARK_ADAPTER_LIMIT_REACHED"):
**not patched.** A targeted fix for this exact pattern (e.g. never
dropping alphanumeric suffixes matching `/^[a-z]?\d+$/`) would fix this
one case while remaining exactly the kind of incremental,
un-generalizable heuristic accumulation the stop-rule exists to prevent
-- the deeper issue (distinguishing "extra descriptive prose" from "an
extra modifier that names a genuinely different value") cannot be
solved by any word-length threshold, because full symmetric word-set
equality (the naive alternative) would break the exact prose-matching
cases `values_match()` was built to handle (verified: real cases like
`LNES59-SMOKE-007`'s "Vendor E Consulting is not present in the vendor
master registry (not a registered vendor)" contain many words beyond
committed's required set, by design).

**Disposition**: `run_case.py`'s `LNES59-B5-002` "ungoverned" fixture
now documents the ACTUAL, disclosed behavior (`CONSISTENT`, a false
negative) rather than a permanently-red target outcome -- same
discipline as taxonomy #17's disclosed-limitation fixture in
`test_scope_and_history.py`. Real fix requires the `CandidateClaim`
boundary (`LNES59_CANDIDATE_CLAIM_ARCHITECTURE.md`): a model populating
`canonical_value` directly, compared by exact/typed equality, rather
than extraction post-hoc-parsing free text -- recorded there as the
second concrete piece of motivating evidence (after taxonomy #16).
Support: `state_consistency_gate_v2.py`'s `values_match()`,
`run_case.py`'s `LNES59-B5-002` fixture,
`LNES59_CANDIDATE_CLAIM_ARCHITECTURE.md`.

## Category tally (of the 22 real bugs above)

| Category | Count | Bugs |
|---|---|---|
| B (extraction failure) | 7 | #2, #3, #8, #11, #12, #19, #20 |
| A + G (evidence missing + gate false positive) | 1 | #17 |
| G (gate false positive) | 3 | #15, #16, #22 |
| E (temporal error) | 5 | #4, #5, #13, #18, #21 |
| J (ambiguous ground truth) | 3 | #1, #9, #10 |
| I (schema failure) | 1 | #7 |
| K (evaluation defect) | 1 | #6 |
| D (authority error) | 1 | #14 |
| C, F, H | 0 | — |

**Reading this honestly**: extraction-layer bugs still dominate the
pre-real-model set (6 of 14), but the two **G** entries found in the
first real X2 run make up the largest single cause of non-`CONSISTENT`
outcomes in that run specifically (6 of 27 cases were bug #16 alone) —
concrete evidence for the caveat this document carried for the whole
sprint: bugs invisible to hand-authored fixtures were always going to
surface once a real model was in the loop, and they did, on the very
first real run. The three "ambiguous ground truth" entries are a real,
disclosed cost of building the dataset and the architecture in parallel
rather than sequentially — cheaper to catch now, while there are 27
cases to check by hand, than at 150.
