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

A second, distinct limitation -- CONFIRMED to be systemic, not a single
anecdote, via run_case.py's end-to-end harness (2 of 34 governed/
ungoverned fixture pairs, both in the "governed" direction, both with the
identical root cause): this pipeline treats any authoritative
(non-SOURCE_ASSERTION) document present in a case's grounding set as
answering the question, without checking whether that document is
actually authoritative for the SPECIFIC predicate being asked about (per
LNES59_AUTHORITY_MODEL.md's predicate-domain table).

- B2-001 (Bright Path pre-approval): grounds in the base contract
  (authoritative for the $25,000 approval CAP) alongside a chat message
  claiming an above-cap exception was granted. The pipeline returns the
  contract's own CONFIRMED_FACT/CURRENT classification as if it answered
  "was the exception granted," when the contract only establishes the
  cap, not whether any specific exception exists.
- SMOKE-002 and B2-004 (both temporal-supersession/conflicting-source
  cases involving an INVOICE alongside a contract-amendment or PO-
  amendment pair): an INVOICE document has no effective_from/until, so
  _resolve_temporal_status defaults it to CURRENT -- which then collides
  with the amendment that's genuinely CURRENT for the payment_terms/
  authorized_amount predicate, producing a spurious CONFLICTING_EVIDENCE
  result. The invoice is authoritative for "what was invoiced," not for
  the predicate the amendment governs; they were never actually
  competing claims about the same thing.

Real predicate-aware authority matching (does THIS document actually
speak to THIS predicate) is not implemented -- documented here as a
known, now-quantified gap rather than patched with per-case special
rules, which would fix these three test cases without fixing the
underlying limitation that will keep recurring as the dataset scales.

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
_UNAVAILABLE_MARKERS = ("outage", "maintenance", "unavailable", "errors, not authoritative")

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


def load_corpus():
    """Merge all committed document batches into one id-keyed dict."""
    corpus = {}
    for fname in ("documents.json", "documents_batch2.json"):
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


def _resolve_temporal_status(doc, corpus, as_of=BENCHMARK_AS_OF):
    """CURRENT unless a later amendment supersedes this doc, or its own
    effective_until has passed as of the benchmark reference date."""
    eff_from = doc.get("effective_from")
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
            other_from = other.get("effective_from")
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
        }

    if _is_unavailable(doc):
        return {
            "claim_type": ClaimType.UNKNOWN,
            "authority_status": AuthorityStatus.NOT_APPLICABLE,
            "temporal_status": TemporalStatus.NOT_APPLICABLE,
            "resolution": ResolutionState.INCOMPLETE,
            "value": None,
        }

    if _is_no_record(doc):
        return {
            "claim_type": ClaimType.UNKNOWN,
            "authority_status": AuthorityStatus.NOT_APPLICABLE,
            "temporal_status": TemporalStatus.NOT_APPLICABLE,
            "resolution": ResolutionState.NO_MATCH,
            "value": doc.get("value"),  # the scoped-negative sentinel, e.g. "NOT_IN_REGISTRY"
        }

    return {
        "claim_type": base_type,
        "authority_status": AuthorityStatus.NOT_APPLICABLE,
        "temporal_status": _resolve_temporal_status(doc, corpus, as_of),
        "resolution": ResolutionState.MATCH,
        "value": doc.get("value"),
    }


def extract_case_state(grounding_document_ids, corpus, as_of=BENCHMARK_AS_OF):
    """Cross-document extraction for one case: resolves conflicts between
    multiple grounding documents, applies the never-authoritative rule
    for source/chat/meeting docs, and picks the single CommittedState the
    gate should be evaluated against.

    Returns a CommittedState with `.value` populated from the chosen
    document's own structured `value` field (added to the corpus
    specifically to make this possible -- see the module-level note on
    why this isn't NLP-derived). Does not set `.scope` -- scope strings
    used in this benchmark's cases are predicate/subject descriptions
    (e.g. "CT-2026-014 payment_terms") this pass does not attempt to
    auto-derive from a query; left to the caller for now."""
    classifications = [
        (doc_id, classify_document(doc_id, corpus, as_of))
        for doc_id in grounding_document_ids
    ]

    # Only non-authoritative (SOURCE_ASSERTION) among all grounding docs?
    #
    # Found via cross-validation against LNES59-SMOKE-005 (analyst
    # cash-flow hypothesis, grounded only in a CHAT_MESSAGE): this branch
    # originally returned INCOMPLETE unconditionally here, which is wrong.
    # A hedge/hypothesis that WAS found (someone said it, in a chat
    # message that exists) is a real MATCH on a SOURCE_ASSERTION/
    # HYPOTHESIS-shaped state, just weakly authoritative -- not the same
    # situation as an authoritative source existing but being unavailable
    # (the actual INCOMPLETE case, e.g. SMOKE-008's approval-DB outage,
    # which is detected separately via _is_unavailable and doesn't reach
    # this branch at all, since that document IS in `authoritative`).
    # INCOMPLETE here would incorrectly imply "nothing could be checked,"
    # when in fact something (the hedge itself) was found and simply
    # isn't strong enough to ground a fact -- exactly what the gate's
    # own UNSUPPORTED_STATE_ASSERTION handling for SOURCE_ASSERTION/
    # HYPOTHESIS claim types already exists to enforce downstream.
    authoritative = [c for _, c in classifications if c["claim_type"] != ClaimType.SOURCE_ASSERTION]
    if not authoritative:
        hedges = [c for _, c in classifications]
        return CommittedState(
            resolution=ResolutionState.MATCH, claim_type=ClaimType.SOURCE_ASSERTION,
            authority_status=AuthorityStatus.UNVERIFIED, temporal_status=TemporalStatus.NOT_APPLICABLE,
            value=hedges[0].get("value") if hedges else None,
        )

    # Any INCOMPLETE among the authoritative docs takes precedence --
    # an unavailable authoritative source can't be overridden by a
    # different authoritative source claiming otherwise; report the gap
    # honestly rather than picking a side.
    incompletes = [c for c in authoritative if c["resolution"] == ResolutionState.INCOMPLETE]
    if incompletes:
        return CommittedState(
            resolution=ResolutionState.INCOMPLETE, claim_type=ClaimType.UNKNOWN,
            authority_status=AuthorityStatus.NOT_APPLICABLE, temporal_status=TemporalStatus.NOT_APPLICABLE,
        )

    no_matches = [c for c in authoritative if c["resolution"] == ResolutionState.NO_MATCH]
    matches = [c for c in authoritative if c["resolution"] == ResolutionState.MATCH]

    if matches and no_matches:
        # A registry NO_MATCH alongside a genuine MATCH on the same
        # grounding set is itself a real conflict worth surfacing, not
        # silently resolved either direction.
        return CommittedState(
            resolution=ResolutionState.MATCH, claim_type=ClaimType.CONFLICTING_EVIDENCE,
            authority_status=AuthorityStatus.NOT_APPLICABLE, temporal_status=TemporalStatus.NOT_APPLICABLE,
        )
    if no_matches and not matches:
        return CommittedState(
            resolution=ResolutionState.NO_MATCH, claim_type=ClaimType.UNKNOWN,
            authority_status=AuthorityStatus.NOT_APPLICABLE, temporal_status=TemporalStatus.NOT_APPLICABLE,
            value=no_matches[0].get("value"),
        )

    # All authoritative docs MATCH. If more than one, and their temporal
    # statuses disagree about which is CURRENT in a way that isn't a
    # clean supersession (i.e. more than one claims CURRENT), that's
    # CONFLICTING_EVIDENCE; a clean supersession chain naturally leaves
    # exactly one CURRENT.
    current_ones = [c for c in matches if c["temporal_status"] == TemporalStatus.CURRENT]
    if len(current_ones) > 1:
        return CommittedState(
            resolution=ResolutionState.MATCH, claim_type=ClaimType.CONFLICTING_EVIDENCE,
            authority_status=AuthorityStatus.NOT_APPLICABLE, temporal_status=TemporalStatus.NOT_APPLICABLE,
        )
    chosen = current_ones[0] if current_ones else matches[0]
    return CommittedState(
        resolution=chosen["resolution"], claim_type=chosen["claim_type"],
        authority_status=chosen["authority_status"], temporal_status=chosen["temporal_status"],
        value=chosen.get("value"),
    )
