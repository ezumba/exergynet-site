# LNES-59 Candidate Claim Architecture

R&D / benchmark only. Pre-holdout structured-claim-interface review
(directive Phase 4.4). Documentation/design-boundary note — does not
change any running code, and does not require the benchmark to force
models into a new output structure immediately.

## The pipeline this documents

```
MODEL NATURAL LANGUAGE
        |
TYPED CANDIDATE CLAIM
        |
CANONICAL VALUE
        |
DETERMINISTIC STATE COMPARISON
```

Today's `arm_x2.py` + `state_consistency_gate_v2.py` pipeline actually
implements this as:

```
MODEL NATURAL LANGUAGE  ---(schema-constrained JSON prompt)-->  ModelOutput
        (asserted_value is free text, NOT a canonical token)
                |
                v
        values_match(asserted_value, committed.value)
        (regex-based canonicalization AND comparison, fused into one step)
```

The middle two pipeline stages — "typed candidate claim" and "canonical
value" — are collapsed into a single function, `values_match()`, that
does post-hoc regex extraction directly against free text rather than
comparing two already-canonical values. This works (see taxonomy #16,
#17, #18 — 8+6+4 real cases verified) but it is a disclosed adapter, not
the target architecture.

## The `CandidateClaim` shape

```
CandidateClaim {
    subject            # e.g. "PO-4001" -- the real-world entity the claim is about
    predicate          # e.g. "PO-4001.invoiced_amount" -- see LNES59_PREDICATE_SEMANTICS.md
    canonical_value     # e.g. "26500" or "NET_60" -- same token space as CommittedState.value
    displayed_value     # e.g. "$26,500.00" -- what the model actually said, preserved verbatim
    scope               # e.g. {"source_system": "INVOICE_SYSTEM", ...} -- see CommittedState.scope
    effective_time       # when the model believes this value holds (not currently modeled at all)
    claim_type          # ASSERTION / HYPOTHESIS / etc. -- already exists as ModelOutput.output_type
    source_reference     # which document(s) the model is citing -- not currently modeled at all
}
```

**Mapping against what exists today:**

| CandidateClaim field | Current equivalent | Status |
|---|---|---|
| `subject` | Not modeled | Would need adding to `ModelOutput` |
| `predicate` | Implicit (the case's `target_predicate`, never attached to the model's own output) | Would need adding |
| `canonical_value` | Does not exist -- `values_match()` derives this on the fly from `displayed_value` via regex | **The actual gap this document is about** |
| `displayed_value` | `ModelOutput.asserted_value` (today's only value field, free text) | Exists, doing double duty |
| `scope` | `ModelOutput.claimed_scope` | Exists |
| `effective_time` | Not modeled | Would need adding -- no case currently asks a model to reason about temporal effectiveness explicitly |
| `claim_type` | `ModelOutput.output_type` | Exists |
| `source_reference` | Not modeled -- the model isn't asked to cite which document(s) it's drawing from | Would need adding |

## Why this isn't built now

The benchmark's current design deliberately asks the model for ONE free-
text value (`asserted_value`) rather than a full `CandidateClaim`,
because forcing `canonical_value` into a fixed token space (`NET_60`,
`7_DAY_1PCT`, ...) the model was never shown would either (a) require
disclosing the internal vocabulary in the prompt — leaking structure
toward the expected answer, a soft version of the oracle-leakage risk
this project has tracked since X3 — or (b) require the model to invent
its own canonical tokens, which then need the SAME comparison problem
`values_match()` already solves, just shifted one layer over. Building
the full interface is real, larger-scope work (a schema change to
`ModelOutput`/`arm_x2.py`'s prompt, likely requiring its own held-out
validation that models can reliably populate it) — appropriately
deferred, not silently skipped: recorded here as the target shape so
Phase 5+ dataset/arm work can build toward it deliberately rather than
accumulate more ad hoc string heuristics.

## `values_match()` rule classification

Every current branch, classified as the directive asks — **benchmark
adapter** (specific to this corpus's exact value vocabulary, would not
generalize to a different domain's tokens unchanged) vs **architectural
primitive** (a genuinely domain-independent capability):

| Branch | Classification | Why |
|---|---|---|
| `NET_<n>` extractor | Benchmark adapter | Specific to this corpus's payment-term token convention |
| `<n>_DAY_<n>PCT` extractor | Benchmark adapter | Specific to this corpus's SLA token convention |
| `PAID\|PENDING_<n>[_METHOD]` extractor | Benchmark adapter | Specific to this corpus's payment-ledger token convention |
| Bare dollar-amount extractor (`_extract_amounts`) | Closest to a primitive, but still an adapter | Extracting a numeric amount from prose is a genuinely general capability; the specific regex (assumes `$`, comma-grouped USD formatting) is still scoped to this corpus's documents |
| Compound/status-token word-set fallback | Benchmark adapter, and the least reliable one | Relies on this corpus's specific SNAKE_CASE vocabulary; taxonomy #17's disclosed limitation (sparse 2-word tokens can false-match a vague hedge) lives entirely in this branch, and so does taxonomy #22 (a value that is a proper word-subset of another value's word-set false-matches -- e.g. `AUTHORIZED_STANDING` vs `AUTHORIZED_STANDING_R2`) |

## BENCHMARK_ADAPTER_LIMIT_REACHED (taxonomy #22, 2026-08-08)

Taxonomy #22 is the second confirmed instance of the identical root
cause as taxonomy #17 (a short-but-semantically-load-bearing token
silently dropped by the compound-word fallback's length filter --
negation markers for #17, version/generation suffixes for #22). Per
this document's own governing principle above, this is the trigger
condition: a benchmark adapter accumulating domain-specific patches for
individually-discovered edge cases, rather than solving the underlying
problem once. **Not patched further.** A targeted fix for #22
specifically (e.g. never dropping alphanumeric suffixes matching
`/^[a-z]?\d+$/`) was considered and rejected: it would fix this one
case while remaining exactly the kind of un-generalizable, reactive
heuristic accumulation this section exists to stop. The deeper issue —
distinguishing "extra descriptive prose the fallback should ignore"
from "an extra modifier that names a genuinely different value the
fallback must not ignore" — cannot be solved by any word-length
threshold, because the alternative (full symmetric word-set equality)
would break the exact prose-matching cases the fallback exists to
handle (verified: real cases like `LNES59-SMOKE-007`'s full sentence
contain many words beyond committed's required set, by design, and
must still match). This is precisely the gap only a real `CandidateClaim`
boundary — a model populating `canonical_value` directly, in the same
token space as `CommittedState.value`, compared by exact/typed equality
rather than parsed post-hoc out of free text — closes. Recorded here as
the second concrete piece of motivating evidence (after taxonomy #16)
for eventually building that interface, not as a decision to build it
now.

**Verdict: none of `values_match()`'s current branches are architectural
primitives.** All five are disclosed, bounded adapters for this specific
benchmark's value vocabulary — exactly as `values_match()`'s own
docstring already states ("covers the value shapes actually present in
this benchmark's dataset today ... not a general solution"). The actual
architectural primitive is the `CandidateClaim` contract itself (a fixed
interface between "what a model produces" and "what the gate compares")
plus a comparison step that would become trivial equality once both
sides are genuinely canonical — not a growing library of regex
extractors. This document exists so that boundary stays explicit as the
dataset scales: new value shapes in Phase 5's 123 additional cases
should get new, equally-scoped `values_match()` adapter branches (same
discipline as every other disclosed limitation in this project), not be
read as evidence the function is drifting toward general-purpose NLP.
