# LNES-59 Dataset Spec

R&D / benchmark only. No healthcare entities or medical logic reused —
this is an independent domain built from scratch.

## Domain

Synthetic enterprise procurement / financial operations / compliance
environment. A small set of vendors, purchase orders, contracts, and the
organizational communication around them, deliberately including the
kinds of ambiguity, conflict, and authority gaps real procurement data
has and LNES-58's healthcare corpus (by design) didn't need to.

## Artifact types in the corpus

`purchase_order`, `vendor_record`, `contract`, `contract_amendment`,
`invoice`, `approval_matrix` (a `PROCUREMENT_POLICY` artifact), `expense_policy`
(`PROCUREMENT_POLICY`), `email`, `chat_message`, `meeting_note`,
`vendor_quote`, `payment_record` (`PAYMENT_LEDGER`), `compliance_report`,
`audit_record`.

Each artifact maps to exactly one `source_class` from
`LNES59_AUTHORITY_MODEL.md` — no artifact type is ambiguous about which
class it belongs to (that ambiguity, where it needs to exist for a test
case, lives in the *content* of a document — e.g., a meeting note that
records an informal approval — not in which bucket the artifact type
itself falls into).

## Case categories (target: 150 cases, expand if needed for balance)

| Category | Target count | What it tests |
|---|---|---|
| Ambiguous-source | 25 | A non-authoritative source (email/chat/meeting note) makes a claim about something only an authoritative source can confirm |
| Conflicting-source | 25 | Two sources, both plausibly authoritative for the same predicate, disagree |
| Temporal-supersession | 25 | A newer state (amendment, revised policy, later record) changes what's current without erasing history |
| Policy/authority | 25 | A claimed authorization exceeds, matches, or falls short of the actual policy-defined authority |
| Recommendation-vs-fact | 25 | A model or human output is a recommendation/hypothesis/proposal, not an assertion, and must not be graded as a false state contradiction |
| Ordinary-factual | 25 | A straightforward CONFIRMED_FACT lookup with no ambiguity — the control group, confirming the architecture doesn't manufacture complexity where none exists |

## Construction discipline (the X3 lesson, restated for this domain)

Source documents are authored first, complete, without knowledge of which
specific queries will be asked against them. Query/case authoring happens
in a *separate* pass over the already-fixed corpus. No source document's
content, no state envelope's `authority_status`, and no artifact's
`source_class` may be written with a specific expected query answer in
mind — if a case category needs a specific kind of conflict or gap, that
gap is built into the *corpus* generically (e.g., "this vendor has two
amendments with overlapping effective windows" as a standing corpus
property), not retrofitted into one query's evidence path. Any case found
to violate this after the fact gets the same treatment X3 got:
`INVALID_FOR_ARCHITECTURAL_CLAIM`, kept as diagnostic evidence, not
deleted, not silently excluded from the count.

## Blind holdout (per directive §13)

Once the corpus and the first ~100-120 development cases exist, a
separate holdout set of at least 50 cases gets frozen and hashed before
any state-consistency-gate tuning happens against them. This hasn't
happened yet — the corpus itself needs to exist first. Tracked as a
pending step, not claimed complete here.

## Status of this spec vs. the actual corpus

This document defines the *shape* of the dataset. The smoke-scale slice
being built alongside it (see `documents/` and `cases/` in this directory)
is a first, small, representative pass across all 6 categories — enough
to validate the schema and authority model actually work end-to-end
against concrete cases before scaling to the full 150. Scaling to the
full count, building the blind holdout split, and freezing/hashing it are
explicitly not done in this pass.
