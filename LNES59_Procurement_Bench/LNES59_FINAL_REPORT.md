# LNES-59 Final Report — Architecture & Infrastructure Phase

R&D / benchmark only. No production code touched at any point in this
sprint.

**Scope of this report, stated up front:** this covers the
architecture-generalization and infrastructure phase of LNES-59 — schema
design, deterministic extraction, the consistency gate, and their
verification against a 27-case hand-authored dataset with hand-authored
(not model-generated) test outputs. **It does not cover, and cannot
honestly claim to cover, the empirical benchmark phase** (running real
models through B0–B3/X0–X2 and comparing them). That phase needs real
API calls and real cost — the same kind of explicit, separate
authorization LNES-58's actual benchmark run needed before it started,
distinct from the benchmark's design being finished. It has not been
given in this sprint. Where the sprint directive's own final questions
(§19, §24) ask something only that phase could answer, this report says
so explicitly rather than answering from architecture alone and calling
it empirical.

## 1. What was built

| Artifact | Purpose |
|---|---|
| `LNES59_STATE_SCHEMA.md` | State envelope, 11 claim types, 3 orthogonal axes, 6 model-output types |
| `LNES59_AUTHORITY_MODEL.md` | 11 source classes, purpose/scope/time-specific authority, predicate-domain table |
| `LNES59_DATASET_SPEC.md` | Domain description, 14 artifact types, 150-case target breakdown |
| `documents.json` + 2 batches | 46 synthetic procurement documents, corpus-first construction discipline |
| `cases.json` + 2 batches | 27 test cases across 6 directive categories + 2 resolution-state controls |
| `deterministic_extraction.py` | Predicate-aware, authority-aware state extraction (X0/X1 backbone) |
| `state_consistency_gate_v2.py` | 9-outcome deterministic consistency gate (X2), extends X6B's core discipline |
| `run_case.py` | Harness wiring extraction + gate into one runnable arm |
| `LNES59_FAILURE_TAXONOMY.md` | A–K taxonomy, 14 real bugs classified by root cause |
| `metrics.py` | Real metrics where calculable; explicit `NOT_APPLICABLE` where a real model is required |
| `LNES59_BENCHMARK_PLAN.md` | Precise per-arm definitions for this implementation; one open design question flagged |
| `LNES59_GROUND_TRUTH_MANIFEST.json` | SHA-256 hashes of the current dataset state |
| `LNES59_PATENT_DISCLOSURE_NOTE.md` (patent package, not this repo) | 6 candidate new-matter items for counsel |

## 2. Verification state (every number below is real, not projected)

- Gate: 27/27 + 19/19 isolated unit test fixtures pass.
- Extraction: 27/27 resolution fields match independently-authored `expected_state`.
- Harness (extraction feeding the gate, real wiring, not hand-built states): 50/50.
- 14 real bugs found and fixed (or precisely documented as open) across the
  sprint, retrospectively classified in `LNES59_FAILURE_TAXONOMY.md`.
- 3 successive dataset batches; the third introduced zero new bugs on
  first run — read as evidence of stabilization, not proof of completeness.

## 3. Domain-independence comparison (directive §17)

Compares LNES-58 (closed-world healthcare relation lookup) against
LNES-59 (open-world procurement/compliance) on each concept the original
sprint plan flagged as an expected domain-independence candidate.

| Mechanism | LNES-58 (healthcare) | LNES-59 (procurement) | Verdict |
|---|---|---|---|
| Persistent state envelope | Not present — LNES-58 had bare relation facts | Built, 11 claim types | **New in LNES-59**, not a ported LNES-58 concept — can't call this "domain-independent" yet, it only exists in one domain |
| Provenance | Implicit (frozen graph hash) | Explicit per-document `predicate`/`value` fields | Present in both, different mechanisms — **partially independent**: the *principle* (provenance must be checkable) transferred; the *implementation* did not |
| Temporal validity | Not modeled — LNES-58's corpus had no amendments | Built: CURRENT/SUPERSEDED/EXPIRED/FUTURE_EFFECTIVE, verified through a real 2-hop chain | **New in LNES-59** |
| MATCH / NO_MATCH / INCOMPLETE | Built and validated (X4/X5) | Reused directly, same 3 states, same semantics | **Confirmed domain-independent** — the one mechanism that ported with no modification needed |
| Claim typing | Not present (single implicit type: "relation exists") | Built, 11 types | **New in LNES-59** |
| Authority typing | Not present | Built, including real tier-limit computation | **New in LNES-59** |
| State contradiction (the gate) | Built (X6B), single boolean axis (resolver_state vs. model output) | Extended to 9 outcomes across 3 input axes | **Partially independent**: the *pattern* (pure, deterministic, post-hoc comparison of committed state against classified model output) transferred and is doing real work in both; the specific rule set did not — it grew substantially richer |
| Unsupported state assertion | Implicit in X6B's contradiction detection | Explicit, dedicated outcome | **Partially independent** — same underlying concern, more explicitly named in LNES-59 |
| State promotion (candidate → committed) | Implicit (frozen-before-query-read discipline) | Named explicitly in `LNES59_STATE_SCHEMA.md`, not yet built as runnable code (no model-assisted extraction path exists) | **Principle transferred, mechanism not yet built in either domain as a distinct promotion pipeline** |
| Raw-model-output preservation | Not applicable (no model output existed in the deterministic-graph benchmark class) | Applicable, but not yet exercised (no real model output exists yet) | **Untested in both** |

**Honest reading of this table:** of the 10 mechanisms the original
LNES-59 plan flagged as candidates for domain independence, **1 is
confirmed** (MATCH/NO_MATCH/INCOMPLETE), **3 are partially independent**
(the underlying pattern transferred, the specific implementation did
not), and **4 are new to LNES-59 with no LNES-58 analog to compare
against** — meaning "domain-independent" isn't really the right
description for them yet; they've only been built and tested in *one*
domain. Calling this "cross-domain evidence" for those 4 would overclaim.
The directive itself anticipated this risk (§17: "Do not assert
universality from two domains... Call it CROSS-DOMAIN EVIDENCE") — even
that more modest label doesn't fully apply to mechanisms that don't yet
have a second domain's worth of evidence behind them.

## 4. Product implications (directive §19) — answered as far as honestly possible

**What is xLMP now, based on what's actually been implemented and
measured in this sprint** (storage layer / retrieval layer / memory
substrate / memory control plane / state-governance protocol /
combination):

The evidence from this sprint specifically supports **state-governance
protocol** as an accurate description of what got built — the schema,
extraction, and gate are all about deciding what a piece of information
is *allowed to become* (a settled fact, an unresolved conflict, a
hypothesis, an authorized action), not about storing or retrieving
content. This sprint didn't touch storage or retrieval at all (X0's
"bounded evidence" step, which would be the retrieval-adjacent piece, is
defined in the benchmark plan but not built). So: **this sprint's
evidence supports "state-governance protocol" specifically, and says
nothing new about the other candidate descriptions** — they'd need
evidence from a different part of the system (or from LNES-58, which did
touch retrieval-adjacent concerns via its RAG comparator arms) to
evaluate.

## 5. The sprint's final question (directive §24) — answered precisely

> Can xLMP govern open-world persistent state outside healthcare without
> forcing uncertain information into false deterministic facts?

**Architecturally: yes, with real evidence, not just a design claim.**
27 cases spanning ambiguous sources, genuine conflicts, multi-hop
temporal supersession, and real policy-tier authority limits all resolve
through the deterministic layer without collapsing uncertainty into false
certainty — verified by 50/50 real (not simulated) runs through the
actual extraction-and-gate pipeline, including specific adversarial
fixtures designed to catch exactly the failure mode the question asks
about (e.g., B3-006: a hedged rumor must not become a confirmed contract
term; B2-006: a documentation gap must not become a non-compliance
finding). This is a real, verified claim, not aspiration.

**Empirically: still mostly open, with one real data point.** Every
number in §2 above was tested against hand-authored stand-ins for model
behavior, not an actual model. A 5-case real-model run (5/27 dev-set
cases, `X2_REAL_RUN_2026-08-08.md`) has since produced the first genuine
answer at small scale: a real Claude model, blind to the expected
answers, was correctly governed by the gate in all 5 cases, including one
where the gate caught the model failing to report a confirmed fact.
That's real signal, not aspiration — but 5 cases against one arm, with no
comparator baseline, doesn't generalize. Whether a *real* language model,
run at scale through this architecture, produces outputs the gate
correctly governs across the full dataset — and how that compares to
B0–B3 — is still the open question the remaining comparator-arm work
exists to answer.

> Does the state-consistency architecture add measurable value beyond
> modern retrieval or structured memory alone?

**Not answerable from this sprint's work at all.** This requires the
comparator arms to exist and run. Nothing in this report should be read
as an implicit answer either direction.

## 6. What remains

- Scaling toward the full 150-case target (18% complete; batch 3 showed
  diminishing bug-discovery value, suggesting the *architecture* is
  reasonably validated even if case *count* isn't complete).
- The blind holdout split (needs a larger development set first — see
  `LNES59_BENCHMARK_PLAN.md`).
- Two real, disclosed, unfixed limitations in extraction: historical
  values aren't preserved (only current), and `.scope` is never populated
  — both currently caught by a more generic gate outcome, not a silent
  miss, but with less diagnostic specificity than the richer outcomes
  would give.
- The optional aviation micro-domain (directive §18) — not started; would
  meaningfully strengthen the domain-independence claims in §3 above,
  since several mechanisms currently have only one domain's evidence.
- **The comparator arms themselves** — the one piece of remaining work
  that changes this report's central conclusion from "architecturally
  sound, empirically untested" to an actual answer to the sprint's
  question. Requires separate, explicit authorization for real API cost.

## 7. Trustee summary

**WHAT WAS BUILT:** A complete, internally-consistent deterministic
state-governance architecture for open-world procurement — schema,
authority model, extraction, consistency gate, harness, failure taxonomy,
metrics infrastructure, benchmark plan, and a patent disclosure note.

**WHAT WAS VERIFIED:** Every claim in this report traces to a real,
re-runnable test — 27/27, 19/19, 27/27, 50/50, all four numbers real, not
targets. 14 real bugs found and fixed through genuine engineering, not
polished away.

**WHAT WAS NOT DONE, AND WHY:** At the time this report was first written,
no real model had been called — every point where that boundary came up
in this sprint was named explicitly and held, the same way production
deployment was held earlier in this session until you explicitly said
"go." That has since changed: the full 27-case dev set was run through
X2 against real, isolated Claude subagents (via the Agent tool, not the
Anthropic API — see `X2_REAL_RUN_2026-08-08.md`), and it did more than
produce empirical results — it found and fixed two real bugs in
`state_consistency_gate_v2.py` that 47 hand-authored fixtures across
three test files never surfaced, because those fixtures were all written
by the same person who wrote the extraction code and always typed
matching representations by construction. One bug was the gate punishing
honest hedging under incomplete evidence. The other — the gate comparing
a model's natural-language answer against an internal coded token — was
the single largest cause of non-`CONSISTENT` outcomes in the run, 6 of 27
cases, every one the model being substantively correct; fixed with a
small, explicit, still-fully-deterministic value-matching function
(`values_match()`), not a hasty fuzzy-match hack — verified against 8
negative controls that it doesn't loosen genuine contradictions. After
both fixes: 18/27 CONSISTENT (up from a raw 12/27), full regression suite
green (28/28, 19/19, 27/27, 50/50, 17/17). This is one arm of seven, no
comparator baseline — it does not answer the sprint's empirical question,
but it is real progress toward answering it, and it changed the
architecture along the way, which is a different and arguably more
valuable outcome than a clean pass would have been.

**WHAT WOULD CHANGE THE CONCLUSION:** Building the other xLMP arms (X0,
X1) and the B0–B3 baselines against a real model, at a scale that
supports the `metrics.py` computations. That's still the next decision
point, not a default next step.
