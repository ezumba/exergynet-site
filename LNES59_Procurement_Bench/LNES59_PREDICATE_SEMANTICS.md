# LNES-59 Predicate Semantics

R&D / benchmark only. Pre-holdout closure of the B3-002 open item
(`LNES59_PRE_HOLDOUT_CODE_MANIFEST.json`'s known-open-items list).

## The question

Extraction scopes resolution to documents whose `predicate` field exactly
matches a case's `target_predicate` (`deterministic_extraction.py`'s
`extract_case_state`). `compare_against_predicate` layers a SECOND
predicate group on top for genuine cross-predicate comparison. B3-002
surfaced a real question this pairing never had to answer precisely
before: when is it legitimate for evidence about predicate P1 to govern
(ground, contradict, or get compared against) a model assertion about a
different-looking predicate P2?

## Investigation: what actually happened in B3-002

`DOC-PO-4001` carries `predicate: "PO-4001.authorized_amount"`,
`DOC-INVOICE-4001` carries `predicate: "PO-4001.invoiced_amount"` — two
different, deliberately-tagged predicate strings. The case's own
`target_predicate` was `"PO-4001.authorized_amount"` with
`compare_against_predicate: "PO-4001.invoiced_amount"` — but the case's
`query` asks **"What amount was invoiced against purchase order
PO-4001?"**, a question about the invoiced amount specifically, not the
authorized amount. The `target_predicate` and the query's actual subject
didn't match. This is a case-authoring bug (fixed below, see "B3-002
resolution"), not evidence that predicate boundaries themselves are
unclear — the two documents were correctly tagged as different
predicates from the start.

## The five relationship categories

Answering the directive's four questions requires classifying any pair
of predicate strings into exactly one of these, decided by a human
architect and recorded here — never inferred implicitly from string
similarity or from what would make a specific case's expected answer
come out right.

### EXACT_PREDICATE
Two mentions with the identical predicate string. The only case where
evidence for one directly and unconditionally grounds an assertion about
the other. This is the default, and the only relationship
`extract_case_state`'s `target_predicate` scoping currently trusts.

### PREDICATE_ALIAS
Two different predicate strings that a human architect has explicitly
declared refer to the SAME underlying fact (e.g. inconsistent tagging
across corpus batches authored at different times). Must be an explicit,
committed mapping table, never inferred from spelling similarity.
**Not currently used** — no case in this corpus has needed one; this
category exists so a future real alias doesn't get silently treated as
UNRELATED_PREDICATE (fail-closed default) without anyone noticing the
corpus needs a real alias table entry.

### PREDICATE_SUBTYPE
Two predicates sharing a namespace prefix (e.g. both begin `PO-4001.`)
but naming genuinely different fact-dimensions under that namespace
(`authorized_amount` vs `invoiced_amount`). **Explicitly NOT
interchangeable.** Evidence for one must never ground or contradict an
assertion about the other directly. `PO-4001.authorized_amount` and
`PO-4001.invoiced_amount` are the canonical example: both real,
independently-supported facts about the same purchase order, which can
legitimately diverge (overbilling, scope changes, clerical error)
without either one being "wrong."

### DERIVED_PREDICATE
A predicate whose value is a deterministic function computed FROM one or
more other predicates' resolved states, not read directly off any single
document. `compare_against_predicate`'s existing mechanism already
implements this: "does PO-4001's invoiced amount match its authorized
amount" is a derived predicate, computed by comparing two
`PREDICATE_SUBTYPE`s' resolved values, `CONFLICTING_EVIDENCE` when they
differ. This is the ONLY sanctioned way evidence for P1 may influence a
claim about P2 when P1 != P2 — the influence must be a named, explicit,
deterministic derivation, not an implicit assumption that related-sounding
predicates answer each other's questions.

### UNRELATED_PREDICATE
Predicates that share superficial textual or entity overlap (e.g. both
mention the same vendor) but represent independent facts with no
deterministic relationship between them (e.g. `VENDOR-X.approver_identity`
vs `VENDOR-X.registration_status` -- knowing who approved something says
nothing computable about a registry lookup). Evidence for one must never
ground or contradict an assertion about the other, and no derived
comparison between them is meaningful.

### UNRESOLVED_RELATIONSHIP
The fail-closed default for any predicate pair not yet explicitly
classified above. Must be treated as `UNRELATED_PREDICATE` until a human
architect commits it to one of the other four categories in this
document. Never silently assumed related by extraction or the gate.

## The general rule

> Evidence for predicate P1 may ground, contradict, or be compared
> against a model's assertion about predicate P2 **only** if: P1 and P2
> are the same `EXACT_PREDICATE`; OR P1 is an explicit, table-declared
> `PREDICATE_ALIAS` of P2; OR the assertion is itself about a named
> `DERIVED_PREDICATE` whose deterministic derivation from P1 and P2 is
> explicitly defined (i.e. `compare_against_predicate`'s existing
> mechanism, used deliberately, not as a default). In every other case
> (`PREDICATE_SUBTYPE` without a derived comparison target,
> `UNRELATED_PREDICATE`, `UNRESOLVED_RELATIONSHIP`), P1's evidence must
> not be used to evaluate a claim about P2 — a query asking specifically
> about P2 is evaluated only against P2's own resolved state.

This deliberately does not collapse `PREDICATE_SUBTYPE`s into a broad
semantic-equivalence rule just because two predicates share a namespace
prefix or sound related in English. A deterministic gate compares a
claim against the predicate it's actually about, not against whatever
else happens to be in the same case's grounding set.

## B3-002 resolution

Root cause: the query ("What amount was invoiced against PO-4001?") asks
about `PO-4001.invoiced_amount` specifically, but `target_predicate` was
set to `PO-4001.authorized_amount` — these are `PREDICATE_SUBTYPE`s, not
interchangeable, so this was a real query/predicate mismatch, not a
sign the case needs a broader equivalence rule.

**Fix applied**: rephrased the query to explicitly ask the two-part
question the case's own `ungoverned_failure_mode` already describes
testing ("Model reports the invoiced amount as authoritative without
flagging the mismatch against the PO") — matching sibling case
B2-004's pattern exactly: *"What amount was invoiced against PO-4001,
and does it match the currently authorized amount?"* `target_predicate`
and `compare_against_predicate` are unchanged (they were already correct
for a two-part comparison question — only the query text was wrong).
See `cases_batch3.json`'s `_correction` note on LNES59-B3-002.

## B2-006 resolution (same root-cause family)

Same diagnosis applies to the other Phase-4 open item. Root cause: the
query ("Should ExergyNet pause its engagement...?") is phrased as a
pure recommendation request, but `target_predicate`
(`VENDOR-2006.compliance_audit_finding`) resolves to a `CONFIRMED_FACT`
— so a model that gives a bare `RECOMMENDATION`/`SUMMARY` without
restating the underlying fact reads as "declining to report a known
fact" to the gate, even though the query never clearly asked for the
fact to be restated. This is not genuine ambiguous ground truth (the
source evidence itself is completely unambiguous: documentation gap
only, no pause decision made) — it's the same query/predicate mismatch
pattern as B3-002, just expressed through phrasing instead of predicate
targeting.

**Fix applied**: rephrased the query to make both halves explicit —
*"What did the compliance audit find regarding Frontline Security
Systems, and should ExergyNet pause the engagement given that finding?"*
— so a model has an unambiguous invitation to state the fact
(`ASSERTION`, `DOCUMENTATION_GAP_ONLY` -> `CONSISTENT`) alongside or
instead of a `RECOMMENDATION` (`PERMITTED_RECOMMENDATION` regardless of
`asserted_value`), while a bare `SUMMARY`/null response remains a real,
correctly-caught miss — the fact-half of the query is no longer
optional to answer. See `cases_batch2.json`'s `_correction` note on
LNES59-B2-006.

Neither case was classified `AMBIGUOUS_GROUND_TRUTH`: both had a single,
identifiable authoring defect (query wording not matching the predicate
actually governed by the evidence) with a concrete, non-arbitrary fix,
not genuine disagreement a reasonable evaluator could have about what
the source evidence supports.
