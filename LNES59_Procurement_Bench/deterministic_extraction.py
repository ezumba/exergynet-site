"""
LNES-59 deterministic extraction (directive Section 8, path A of Section 9).
R&D / benchmark only.

Turns the raw document corpus into CommittedState objects
(state_consistency_gate_v2.CommittedState) WITHOUT any model call --
this is the "deterministic structured extraction" path, not the
model-assisted path (Section 9's path B, not built yet).

Scope and an explicit limitation, stated up front rather than glossed
over: this extractor works because the corpus documents were authored
with consistent, known structure and known sentinel phrasing (e.g.
"NO RECORD FOUND", "NO MATCH" for negative registry results; explicit
`amends` links for supersession) -- it is NOT a general-purpose document
understanding system, and would not reliably classify arbitrary real-
world procurement documents without much more robust parsing. That
gap is real and is exactly what Section 9's model-assisted path (not
yet built) would need to close for anything beyond this synthetic
benchmark. Flagging this now so it isn't quietly assumed away later.

A second limitation, FIXED (see extract_case_state's `target_predicate`
parameter): the pipeline originally treated any authoritative
(non-SOURCE_ASSERTION) document in a case's grounding set as answering
the question, without checking whether it actually speaks to the
SPECIFIC predicate asked about -- confirmed systemic via run_case.py's
harness (3 real cases hit this: B2-001, SMOKE-002, B2-004), not a single
anecdote. Fixed by tagging every document and case with a `predicate`
string (corpus/case metadata, generic, not conditioned on any expected
answer -- same discipline as the `value`/`amends` additions) and scoping
resolution to documents whose predicate matches. A related, smaller bug
surfaced while fixing this: purchase-order documents use `issued`, not
`effective_from`, so the supersession check couldn't fire for PO
amendments at all -- `_effective_date()` now falls back to `issued`.

Three further limitations, confirmed precisely (not just suspected) by
comparing this pipeline's real output against the isolated gate tests'
hand-built CommittedState objects in run_case.py -- ALL THREE NOW FIXED,
most recently #1 and #2 on 2026-08-08 (pre-holdout-freeze; see
LNES59_FAILURE_TAXONOMY.md and LNES59_BENCHMARK_PLAN.md):

1. **[FIXED] `.value` only ever reflected the CURRENT resolution, never
   history.** `_resolve_predicate_group` always returned the single
   current value when one existed; a superseded-but-real value was
   indistinguishable from an arbitrary wrong one once it reached the
   gate -- both surfaced as STATE_CONTRADICTION rather than the more
   specific TEMPORAL_CONTRADICTION, still correctly caught, just less
   diagnostically specific. Fixed by having `_resolve_predicate_group`
   also collect the OTHER matches for the same predicate that are
   superseded/expired/revoked into `historical_values`, threaded through
   `extract_case_state` into `CommittedState.historical_values`; the
   gate now checks that tuple before falling back to plain
   STATE_CONTRADICTION. Generalizes because it reuses the SAME
   predicate-scoped matches list already being resolved -- no new
   lookup, no new document field, every predicate with a real
   supersession chain gets this for free.
2. **[FIXED] `.scope` was never set at all.** The gate's
   SOURCE_SCOPE_ERROR check requires `committed.scope` to be non-None;
   since this pipeline never set it, that check could never fire from
   real extraction, and a dropped-scope claim was instead caught one
   branch later as the more generic UNSUPPORTED_STATE_ASSERTION.
   Fixed with `_derive_scope()`: a fixed `source_class` -> namespace
   table (e.g. `VENDOR_MASTER` -> `VENDOR_MASTER_REGISTRY`), populated
   from document metadata already present on every document, never
   conditioned on a case's question -- same discipline as the
   `predicate`/`value` additions. The gate's OWN scope-comparison logic
   was redesigned in the same pass (not just fed a populated field
   unchanged): the original exact-equality check between
   `committed.scope` and the model's free-text `claimed_scope` would
   have reproduced taxonomy #16's exact false-positive pattern the
   moment a real model paraphrased scope in its own words, so it was
   replaced with an explicit scope-broadening cue-phrase check (see
   `state_consistency_gate_v2.py`'s `_claims_beyond_scope()`) before
   `.scope` was ever populated for real, not after.
3. **[FIXED, commit `e4bc6ac`] `authority_status` was never actually
   computed from POLICY documents and a requested amount.** It was
   hardcoded NOT_APPLICABLE in every classify_document branch; the
   POLICY_LIMITED status used for SMOKE-004/B2-005 existed only in the
   isolated gate tests' hand-built fixtures, and an over-limit
   ACTION_REQUEST was passing only via a coincidental UNVERIFIED-authority
   fallback, not a real requested-amount-vs-limit comparison. Fixed with
   a real `policy_tiers` mechanism: `classify_document` reads a
   PROCUREMENT_POLICY document's `tiers` field, `extract_case_state`
   attaches it to the returned `CommittedState` via
   `compare_against_predicate`, and the gate's ACTION_REQUEST branch does
   the actual numeric comparison. Verified against both directions
   (over-limit and within-limit fixtures), a boundary case, and an
   unlimited (VP) tier.

Pipeline (per document): normalize -> classify claim_type ->
resolve supersession chain -> bind provenance -> done. Authority
evaluation and cross-document conflict detection happen at the
CASE level (extract_case_state), since those require comparing
multiple documents against LNES59_AUTHORITY_MODEL.md's predicate
table, not a single-document property.
"""

import json
import os

from state_consistency_gate_v2 import (
    CommittedState, ResolutionState, ClaimType, AuthorityStatus, TemporalStatus,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Fixed benchmark reference date -- NOT wall-clock "now". A benchmark's
# temporal-state answers must be reproducible on any future re-run, not
# drift as real time passes past the corpus's own dates.
BENCHMARK_AS_OF = "2026-08-08"

# Negative-result sentinels this corpus consistently uses (documented
# limitation above: this is pattern-matching against phrasing this
# specific, self-authored corpus controls, not general NLP).
_NO_RECORD_MARKERS = ("NO RECORD FOUND", "NO MATCH")
# Bare "maintenance" was a real, confirmed false-positive collision (found
# via Phase 5 red-teaming, LNES59-B4-002: DOC-PO-4002's "annual equipment
# maintenance contract" -- ordinary business vocabulary -- was misclassified
# INCOMPLETE by this marker alone). Narrowed to the specific multi-word
# phrasing this corpus's real system-unavailable documents actually use
# (DOC-APPROVAL-DB-UNAVAILABLE-NOTE: "undergoing scheduled maintenance"),
# which does not collide with "equipment maintenance", "maintenance
# contract", or other ordinary service-description usage. Same disclosed-
# limitation discipline as the rest of this file's sentinel-phrase
# matching: covers phrasing actually used in this corpus, not general NLP.
# "offline" and "could not be accessed" added via Phase 5's SHOULD/MUST-
# NOT red-team matrix (test_unavailability_detection.py): both are
# plausible, realistic system-status phrasings that the marker list
# missed entirely (2/5 SHOULD-detect cases failed before this fix), and
# neither collides with any of the 5 MUST-NOT business-vocabulary cases
# or any existing document in the corpus (verified by direct scan before
# adding). Same discipline as the "maintenance" narrowing above: general
# repair for a real, demonstrated gap, not speculative hardening.
_UNAVAILABLE_MARKERS = (
    "outage", "scheduled maintenance", "maintenance window", "unavailable",
    "errors, not authoritative", "offline", "could not be accessed",
)

# Which source_class values ground a bare CONFIRMED_FACT-type claim by
# default (subject to the NO_MATCH/unavailable overrides below), versus
# which are structurally incapable of ever being more than a
# SOURCE_ASSERTION regardless of content.
_SOURCE_CLASS_BASE_CLAIM_TYPE = {
    "SIGNED_CONTRACT": ClaimType.CONFIRMED_FACT,
    "SIGNED_AMENDMENT": ClaimType.CONFIRMED_FACT,
    "PAYMENT_LEDGER": ClaimType.CONFIRMED_FACT,
    "VENDOR_MASTER": ClaimType.CONFIRMED_FACT,
    "PROCUREMENT_POLICY": ClaimType.POLICY,
    "INVOICE": ClaimType.CONFIRMED_FACT,
    "purchase_order": ClaimType.CONFIRMED_FACT,
    "APPROVAL_SYSTEM_RECORD": ClaimType.CONFIRMED_FACT,
    "audit_record": ClaimType.CONFIRMED_FACT,
    "EMAIL": ClaimType.SOURCE_ASSERTION,
    "CHAT_MESSAGE": ClaimType.SOURCE_ASSERTION,
    "MEETING_NOTE": ClaimType.SOURCE_ASSERTION,
}

NEVER_AUTHORITATIVE_SOURCE_CLASSES = frozenset({"EMAIL", "CHAT_MESSAGE", "MEETING_NOTE"})

# Deterministic scope namespace per source_class -- corpus/document
# metadata, never conditioned on a case's question (same discipline as
# the `predicate`/`value` fields). Lets the gate distinguish a properly
# source-scoped negative ("not in the vendor master registry") from an
# unscoped universal one ("does not exist") once a real model answers in
# free text -- see state_consistency_gate_v2.py's SOURCE_SCOPE_ERROR
# check and _claims_beyond_scope().
_SOURCE_CLASS_SCOPE_NAMESPACE = {
    "VENDOR_MASTER": "VENDOR_MASTER_REGISTRY",
    "APPROVAL_SYSTEM_RECORD": "PROCUREMENT_APPROVAL_SYSTEM",
    "SIGNED_CONTRACT": "CONTRACT_REPOSITORY",
    "SIGNED_AMENDMENT": "CONTRACT_REPOSITORY",
    "PAYMENT_LEDGER": "PAYMENT_LEDGER",
    "PROCUREMENT_POLICY": "PROCUREMENT_POLICY_REPOSITORY",
    "INVOICE": "INVOICE_SYSTEM",
    "purchase_order": "PURCHASE_ORDER_SYSTEM",
    "audit_record": "COMPLIANCE_AUDIT_SYSTEM",
    "EMAIL": "EMAIL_CORPUS",
    "CHAT_MESSAGE": "CHAT_CORPUS",
    "MEETING_NOTE": "MEETING_NOTES_CORPUS",
}


def _derive_scope(doc):
    """Structured scope object per LNES59_BENCHMARK_PLAN.md's pre-holdout
    scope-preservation requirement -- at minimum a source_system, other
    fields only when the corpus actually carries them (not fabricated).
    Returns None for a source_class this table doesn't recognize, same
    fail-visible discipline as classify_document's own UNKNOWN handling
    elsewhere -- an unrecognized source_class should surface as "no scope
    claim can be checked," not silently default to some namespace that
    isn't actually backed by the document."""
    namespace = _SOURCE_CLASS_SCOPE_NAMESPACE.get(doc["source_class"])
    if namespace is None:
        return None
    return {"source_system": namespace, "predicate": doc.get("predicate")}


def load_corpus():
    """Merge all committed document batches into one id-keyed dict.
    File list comes from dataset_registry.py's manifest-driven,
    hash-verified registry -- not a hardcoded tuple, see that module's
    docstring for why."""
    from dataset_registry import document_set_files
    corpus = {}
    for fname in document_set_files():
        path = os.path.join(SCRIPT_DIR, fname)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for doc in data["documents"]:
            assert doc["id"] not in corpus, f"duplicate document id across batches: {doc['id']}"
            corpus[doc["id"]] = doc
    return corpus


def _is_no_record(doc):
    return any(m in doc["content"] for m in _NO_RECORD_MARKERS)


def _is_unavailable(doc):
    return any(m in doc["content"] for m in _UNAVAILABLE_MARKERS)


def _effective_date(doc):
    """Contracts/amendments use effective_from; purchase orders (which
    have no formal 'effective' concept, just an issue date) use `issued`
    instead. Found via a real bug: DOC-PO-AMENDMENT-3305 has an `amends`
    link but no `effective_from`, so the supersession check below could
    never fire for it -- both the original PO and its amendment defaulted
    to CURRENT, producing a spurious CONFLICTING_EVIDENCE. Falling back to
    `issued` fixes this without assuming every document type shares the
    same field name for "when did this become the operative record"."""
    return doc.get("effective_from") or doc.get("issued")


def _resolve_temporal_status(doc, corpus, as_of=BENCHMARK_AS_OF):
    """CURRENT unless a later amendment supersedes this doc, or its own
    effective_until has passed as of the benchmark reference date."""
    eff_from = _effective_date(doc)
    eff_until = doc.get("effective_until")
    if eff_from and eff_from > as_of:
        return TemporalStatus.FUTURE_EFFECTIVE
    if eff_until and eff_until < as_of:
        return TemporalStatus.EXPIRED
    # Superseded if some OTHER document in the corpus declares
    # amends == this doc's id, and that amendment is itself effective
    # as of the reference date.
    for other in corpus.values():
        if other.get("amends") == doc["id"]:
            other_from = _effective_date(other)
            if other_from and other_from <= as_of:
                return TemporalStatus.SUPERSEDED
    return TemporalStatus.CURRENT


def classify_document(doc_id, corpus, as_of=BENCHMARK_AS_OF):
    """Single-document classification -- no cross-document authority
    comparison yet (that's extract_case_state's job)."""
    doc = corpus[doc_id]
    source_class = doc["source_class"]
    base_type = _SOURCE_CLASS_BASE_CLAIM_TYPE.get(source_class, ClaimType.UNKNOWN)

    if source_class in NEVER_AUTHORITATIVE_SOURCE_CLASSES:
        return {
            "claim_type": ClaimType.SOURCE_ASSERTION,
            "authority_status": AuthorityStatus.UNVERIFIED,
            "temporal_status": TemporalStatus.NOT_APPLICABLE,
            "resolution": ResolutionState.MATCH,  # the statement itself was found; its content is just non-authoritative
            "value": doc.get("value"),
            "scope": _derive_scope(doc),
        }

    if _is_unavailable(doc):
        return {
            "claim_type": ClaimType.UNKNOWN,
            "authority_status": AuthorityStatus.NOT_APPLICABLE,
            "temporal_status": TemporalStatus.NOT_APPLICABLE,
            "resolution": ResolutionState.INCOMPLETE,
            "value": None,
            "scope": _derive_scope(doc),
        }

    if _is_no_record(doc):
        return {
            "claim_type": ClaimType.UNKNOWN,
            "authority_status": AuthorityStatus.NOT_APPLICABLE,
            "temporal_status": TemporalStatus.NOT_APPLICABLE,
            "resolution": ResolutionState.NO_MATCH,
            "value": doc.get("value"),  # the scoped-negative sentinel, e.g. "NOT_IN_REGISTRY"
            "scope": _derive_scope(doc),
        }

    return {
        "claim_type": base_type,
        "authority_status": AuthorityStatus.NOT_APPLICABLE,
        "temporal_status": _resolve_temporal_status(doc, corpus, as_of),
        "resolution": ResolutionState.MATCH,
        "value": doc.get("value"),
        "policy_tiers": doc.get("tiers"),  # only PROCUREMENT_POLICY docs carry this; None otherwise
        "scope": _derive_scope(doc),
    }


def _resolve_predicate_group(classifications_for_predicate):
    """Core single-predicate resolution logic: given ONLY the
    classifications of documents that actually speak to one specific
    predicate, resolve MATCH/NO_MATCH/INCOMPLETE and any genuine same-
    predicate collision (e.g. two documents both claiming to be the
    CURRENT value for the same fact, with no clean supersession chain
    between them). Returns a dict shaped like classify_document's output
    (not yet a CommittedState -- extract_case_state wraps it, so it can
    also layer the cross-predicate comparison on top)."""
    if not classifications_for_predicate:
        return None

    authoritative = [c for c in classifications_for_predicate if c["claim_type"] != ClaimType.SOURCE_ASSERTION]
    if not authoritative:
        # Only non-authoritative (SOURCE_ASSERTION) docs speak to this
        # predicate. Found via cross-validation against LNES59-SMOKE-005
        # (analyst cash-flow hypothesis, grounded only in a CHAT_MESSAGE):
        # this originally returned INCOMPLETE unconditionally, which is
        # wrong. A hedge that WAS found (someone said it, in a message
        # that exists) is a real MATCH on a SOURCE_ASSERTION/HYPOTHESIS-
        # shaped state, just weakly authoritative -- not the same
        # situation as an authoritative source existing but being
        # unavailable (the actual INCOMPLETE case below).
        return {
            "resolution": ResolutionState.MATCH, "claim_type": ClaimType.SOURCE_ASSERTION,
            "authority_status": AuthorityStatus.UNVERIFIED, "temporal_status": TemporalStatus.NOT_APPLICABLE,
            "value": classifications_for_predicate[0].get("value"),
            "scope": classifications_for_predicate[0].get("scope"),
        }

    incompletes = [c for c in authoritative if c["resolution"] == ResolutionState.INCOMPLETE]
    if incompletes:
        return {
            "resolution": ResolutionState.INCOMPLETE, "claim_type": ClaimType.UNKNOWN,
            "authority_status": AuthorityStatus.NOT_APPLICABLE, "temporal_status": TemporalStatus.NOT_APPLICABLE,
            "value": None, "scope": incompletes[0].get("scope"),
        }

    no_matches = [c for c in authoritative if c["resolution"] == ResolutionState.NO_MATCH]
    matches = [c for c in authoritative if c["resolution"] == ResolutionState.MATCH]

    if matches and no_matches:
        return {
            "resolution": ResolutionState.MATCH, "claim_type": ClaimType.CONFLICTING_EVIDENCE,
            "authority_status": AuthorityStatus.NOT_APPLICABLE, "temporal_status": TemporalStatus.NOT_APPLICABLE,
            "value": None,
        }
    if no_matches and not matches:
        return {
            "resolution": ResolutionState.NO_MATCH, "claim_type": ClaimType.UNKNOWN,
            "authority_status": AuthorityStatus.NOT_APPLICABLE, "temporal_status": TemporalStatus.NOT_APPLICABLE,
            "value": no_matches[0].get("value"), "scope": no_matches[0].get("scope"),
        }

    # All authoritative docs for THIS predicate MATCH. More than one
    # claiming CURRENT with no clean supersession chain resolving it is a
    # genuine same-predicate collision.
    current_ones = [c for c in matches if c["temporal_status"] == TemporalStatus.CURRENT]
    if len(current_ones) > 1:
        return {
            "resolution": ResolutionState.MATCH, "claim_type": ClaimType.CONFLICTING_EVIDENCE,
            "authority_status": AuthorityStatus.NOT_APPLICABLE, "temporal_status": TemporalStatus.NOT_APPLICABLE,
            "value": None,
        }
    chosen = current_ones[0] if current_ones else matches[0]
    # Historical lineage: other MATCH docs for this SAME predicate that
    # are superseded/expired/revoked and carry a real value -- lets the
    # gate distinguish "once true, now stale" (TEMPORAL_CONTRADICTION)
    # from "never true" (STATE_CONTRADICTION) when a model's asserted
    # value doesn't match the current one. Deliberately only populated
    # here, in the single-clean-current-value path -- CONFLICTING_EVIDENCE
    # and NO_MATCH don't have a single lineage to preserve.
    historical_values = tuple(
        c["value"] for c in matches
        if c is not chosen
        and c["temporal_status"] in (TemporalStatus.SUPERSEDED, TemporalStatus.EXPIRED, TemporalStatus.REVOKED)
        and c.get("value") is not None
    )
    return {
        "resolution": chosen["resolution"], "claim_type": chosen["claim_type"],
        "authority_status": chosen["authority_status"], "temporal_status": chosen["temporal_status"],
        "value": chosen.get("value"),
        "policy_tiers": chosen.get("policy_tiers"),
        "scope": chosen.get("scope"),
        "historical_values": historical_values,
    }


def extract_case_state(grounding_document_ids, target_predicate, corpus, as_of=BENCHMARK_AS_OF,
                        compare_against_predicate=None):
    """Cross-document extraction for one case.

    `target_predicate` scopes resolution to documents that actually speak
    to the specific fact being asked about (per each document's own
    `predicate` field -- corpus metadata, not case-conditioned; see the
    module-level note on why this is a legitimate addition and not the
    X3 anti-pattern). This fixes a real, confirmed-systemic bug in the
    prior version: without predicate scoping, an INVOICE document (no
    effective_from/until, so it defaults to CURRENT) would spuriously
    collide with a genuinely-current contract/PO amendment governing a
    DIFFERENT predicate, producing false CONFLICTING_EVIDENCE.

    `compare_against_predicate`, when given, resolves a SECOND predicate
    group and -- if both groups resolve to concrete, differing values --
    surfaces the disagreement as CONFLICTING_EVIDENCE. This is how a case
    that deliberately wants two related-but-distinct facts cross-checked
    (e.g. "does the invoiced amount match the current authorized amount?")
    stays expressible without collapsing back into "any two authoritative
    docs in the grounding set collide," which is what caused the bug this
    predicate-scoping fix addresses in the first place.

    Returns a CommittedState with `.value`, `.scope`, and
    `.historical_values` populated (see module note -- `.scope` and
    historical-value preservation were the two remaining disclosed gaps,
    both closed 2026-08-08 pre-holdout-freeze)."""
    classifications = [
        classify_document(doc_id, corpus, as_of) | {"predicate": corpus[doc_id].get("predicate")}
        for doc_id in grounding_document_ids
    ]

    primary_group = [c for c in classifications if c["predicate"] == target_predicate]
    primary = _resolve_predicate_group(primary_group)
    if primary is None:
        # No grounding document actually speaks to the declared target
        # predicate -- a real gap (case/corpus mismatch), surfaced as
        # INCOMPLETE rather than silently returning an empty/default state.
        return CommittedState(
            resolution=ResolutionState.INCOMPLETE, claim_type=ClaimType.UNKNOWN,
            authority_status=AuthorityStatus.NOT_APPLICABLE, temporal_status=TemporalStatus.NOT_APPLICABLE,
        )

    policy_tiers = None
    if compare_against_predicate:
        other_group = [c for c in classifications if c["predicate"] == compare_against_predicate]
        other = _resolve_predicate_group(other_group)
        if other is not None and other.get("policy_tiers") is not None:
            # The compared predicate is a real POLICY tier table (e.g.
            # APPROVAL_MATRIX.limits) -- attach it to the returned state so
            # evaluate()'s ACTION_REQUEST branch can do the real
            # requested-amount-vs-limit comparison, instead of the two
            # predicates being treated as competing value claims.
            policy_tiers = other["policy_tiers"]
        elif (
            other is not None
            and primary["resolution"] == ResolutionState.MATCH
            and other["resolution"] == ResolutionState.MATCH
            and primary["value"] is not None
            and other["value"] is not None
            and primary["value"] != other["value"]
        ):
            return CommittedState(
                resolution=ResolutionState.MATCH, claim_type=ClaimType.CONFLICTING_EVIDENCE,
                authority_status=AuthorityStatus.NOT_APPLICABLE, temporal_status=TemporalStatus.NOT_APPLICABLE,
                value=None,
            )

    return CommittedState(
        resolution=primary["resolution"], claim_type=primary["claim_type"],
        authority_status=primary["authority_status"], temporal_status=primary["temporal_status"],
        value=primary.get("value"), policy_tiers=policy_tiers,
        scope=primary.get("scope"), historical_values=primary.get("historical_values") or (),
    )
