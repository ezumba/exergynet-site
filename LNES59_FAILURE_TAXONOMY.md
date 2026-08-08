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

**A real, current gap in this taxonomy's own validation, stated up
front**: every bug classified below came from *extraction*, the *gate's*
decision rules, or the *test harness* — none from a *model's* actual
output, because no real model has been run against this benchmark yet
(the B0–X2 comparator arms are separate, larger-scope work requiring
explicit authorization for real API cost). Categories **F** (model
adherence failure), **G** (gate false positive) and **H** (gate false
negative) in their *canonical* sense — the gate correctly receiving a
well-formed state and misjudging a *real model's* output — are therefore
**untested by this document**. They'll only get real exercise once B0–X2
actually run. Don't read the absence of F/G/H entries below as evidence
the gate is immune to those failure modes.

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

## Category tally (of the 14 real bugs above)

| Category | Count | Bugs |
|---|---|---|
| B (extraction failure) | 6 | #2, #3, #8, #11, #12 |
| E (temporal error) | 3 | #4, #5, #13 |
| J (ambiguous ground truth) | 3 | #1, #9, #10 |
| I (schema failure) | 1 | #7 |
| K (evaluation defect) | 1 | #6 |
| D (authority error) | 1 | #14 |
| A, C, F, G, H | 0 | — |

**Reading this honestly**: extraction-layer bugs dominate (6 of 14),
which tracks with where the actual new engineering happened this sprint
— the gate itself (built and isolated-tested first, against hand-built
`CommittedState` objects) has needed comparatively few direct fixes once
extraction started feeding it correctly-shaped data. The three "ambiguous
ground truth" entries are a real, disclosed cost of building the dataset
and the architecture in parallel rather than sequentially — cheaper to
catch now, while there are 27 cases to check by hand, than at 150.
