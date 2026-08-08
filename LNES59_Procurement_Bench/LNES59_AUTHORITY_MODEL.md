# LNES-59 Source Authority Model

R&D / benchmark only.

## Why not a single ranking

A single global authority ranking (e.g., "signed contracts always outrank
emails") fails on the domain's own examples: a signed contract is
authoritative for payment *terms*, but the payment *ledger* is
authoritative for whether an invoice was actually *paid* — a signed
contract has no visibility into payment execution at all, so ranking it
"above" the ledger for that question is meaningless, not just wrong.
Authority is evaluated per (source_class, predicate_domain, time), not as
one scalar.

## Source classes

| Class | What it can be authoritative for |
|---|---|
| `SIGNED_CONTRACT` | Payment terms, deliverables, parties, contract-level obligations, as of its own effective date |
| `SIGNED_AMENDMENT` | Same predicate domains as the contract it amends, superseding it from its own effective date forward |
| `APPROVAL_SYSTEM_RECORD` | Whether an approval was granted, by whom, at what authorization level, within the approval system's own registry scope |
| `PAYMENT_LEDGER` | Payment status, payment date, payment amount actually transferred |
| `PROCUREMENT_POLICY` | Standing authorization limits, required approval chains, applicable thresholds |
| `VENDOR_MASTER` | Vendor identity, registration status, tax/compliance record status |
| `INVOICE` | The requesting party's claimed amount/terms — authoritative for "what was invoiced," never for "what was approved" or "what was paid" |
| `EMAIL` | That a person made a statement, at a given time — never authoritative for the truth of the statement's content |
| `CHAT_MESSAGE` | Same authority ceiling as EMAIL |
| `MEETING_NOTE` | That a statement was made/recorded in a meeting — same ceiling as EMAIL/CHAT_MESSAGE, plus whatever explicit follow-up authority the note itself documents (e.g., "action item: Finance to send formal approval") |
| `MODEL_INFERENCE` | Never authoritative for anything — always `authority_status = UNVERIFIED`, regardless of how confidently stated |

## Authority is purpose-, scope-, and time-specific

A source class's authority is only ever evaluated against a specific
predicate domain, a specific scope (e.g., which vendor, which PO, which
registry), and a specific time window (the source's own effective
window). The same source can be authoritative for one predicate and
silent (not even relevant, let alone authoritative) for another —
`APPROVAL_SYSTEM_RECORD` says nothing about payment terms; `PAYMENT_LEDGER`
says nothing about who approved a purchase.

## Predicate-domain authority table (initial, extend as cases require)

| Predicate domain | Authoritative source class(es) | Notes |
|---|---|---|
| `payment_terms` | `SIGNED_CONTRACT`, `SIGNED_AMENDMENT` (most recent effective) | `INVOICE` may *claim* terms but is never authoritative for them |
| `payment_status` | `PAYMENT_LEDGER` | Nothing else is authoritative here, including a signed contract |
| `approval_granted` | `APPROVAL_SYSTEM_RECORD` | `EMAIL`/`CHAT_MESSAGE`/`MEETING_NOTE` can only ever produce a `SOURCE_ASSERTION` about approval, never an `AUTHORIZATION` |
| `approval_limit` | `PROCUREMENT_POLICY` | Governs whether an `APPROVAL_SYSTEM_RECORD` or asserted approval is itself within scope |
| `vendor_registration_status` | `VENDOR_MASTER` | |
| `invoiced_amount` | `INVOICE` | Authoritative for the claim itself, not for whether it's correct |
| `purchase_order_amount` | the purchase order record | Distinct source from `INVOICE` — a mismatch between the two is `CONFLICTING_EVIDENCE`, not automatically resolved by either |

## Resolving conflicts within one predicate domain

If two sources both fall in the authoritative class for a predicate
domain and disagree (e.g., two signed amendments both claiming to be the
current one), the state is `CONFLICTING_EVIDENCE` — the authority model
does not silently pick a winner by e.g. most-recent-source-date unless
the domain's own temporal rules (§ effective_from/supersedes) resolve it
structurally. A `PROCUREMENT_POLICY` document could define an explicit
tie-break rule (e.g., "most recent counter-signed amendment governs") —
if a test case relies on that, the policy document establishing the rule
must exist as its own source, not be assumed by the grader.

## What this model deliberately does not do

It does not attempt to resolve every possible predicate domain in
advance — new domains get added as dataset construction surfaces them,
each with its own authoritative-source-class row, not by extending a
single ranking. It does not let `MODEL_INFERENCE` become authoritative
under any circumstance — this is the one hard-coded exception to the
"nothing is universally ranked" principle, carried forward directly from
LNES-58's Critical Principle that a probabilistic process may propose but
never silently become authoritative state.
