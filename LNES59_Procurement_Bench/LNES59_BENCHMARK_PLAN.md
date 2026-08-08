# LNES-59 Benchmark Plan

R&D / benchmark only. This document defines what's built, what running
the actual benchmark will mean concretely in this specific
implementation, and what remains explicitly unauthorized.

## Central question

Does the state-governance architecture developed in LNES-58 (query-
independent evidence, explicit MATCH/NO_MATCH/INCOMPLETE resolution,
deterministic consistency gating) generalize to open-world domains with
ambiguous sources, conflicting evidence, temporal supersession, and
authority limits — or was it specific to closed-world healthcare relation
queries?

## What's built and verified (as of this document)

| Component | File(s) | Status |
|---|---|---|
| State schema (11 claim types, 3 orthogonal axes) | `LNES59_STATE_SCHEMA.md` | Done |
| Authority model (11 source classes, predicate-domain table) | `LNES59_AUTHORITY_MODEL.md` | Done |
| Dataset: 46 documents, 27 cases across 6 categories | `documents*.json`, `cases*.json` | 18% of 150-case target |
| Deterministic extraction (X1 backbone) | `deterministic_extraction.py` | Predicate-aware, authority-aware, 27/27 cross-check |
| State-consistency gate (X2) | `state_consistency_gate_v2.py` | 27/27 + 19/19 isolated unit tests |
| Harness (extraction + gate wired together) | `run_case.py` | 50/50 end-to-end |
| Failure taxonomy + retrospective autopsy | `LNES59_FAILURE_TAXONOMY.md` | 14 real bugs classified |
| Metrics computation | `metrics.py` | Real numbers where calculable, `NOT_APPLICABLE` elsewhere |

**Everything above is R&D infrastructure and pipeline correctness work.
No real model has been called. No comparator arm has been run.**

| X2 arm implementation | `arm_x2.py`, `run_x2_arm.py` | Prompt construction + response parsing + gate wiring: 27/27 verified against a mock model (no cost). Real invocation script exists and is ready. **Not yet run against a real model.** |

## Comparator arms — precise definitions for THIS implementation

The directive names B0–B3, X0–X2 generically. Operationalized here so
building them later doesn't require re-deriving what each one means:

| Arm | What it concretely is in this architecture |
|---|---|
| **B0** | Direct full-context: the entire relevant document set (or the full corpus, for a stricter version) concatenated into one prompt, model answers freeform. No retrieval, no state schema, no gate. |
| **B1** | Modern dense retrieval: embed all documents, embed the query, top-k retrieval, freeform answer. No state schema, no gate. |
| **B2** | Hybrid retrieval: B1's dense retrieval fused with a sparse/keyword method (e.g. BM25 or TF-IDF, matching LNES-58's own S0/R2 precedent), freeform answer. |
| **B3** | Hybrid + reranker: B2 plus a reranking pass over the fused candidate set before the model sees it, freeform answer. |
| **X0** | xLMP bounded evidence: a deterministic, non-semantic evidence-selection step (matching LNES-58's X2 bounded-evidence-resolver pattern — resolve by structural/ID reference, not vector similarity) narrows the corpus to the case's `grounding_document_ids`-equivalent set, model answers freeform from that bounded set. No state schema, no gate — this is the retrieval-quality baseline for the xLMP family, isolated from the governance layer. |
| **X1** | xLMP state envelopes: X0's bounded evidence, PLUS this benchmark's actual deterministic extraction (`extract_case_state`) runs and produces a `CommittedState`. The model sees the state envelope (resolution, claim_type, authority_status, temporal_status, value) alongside the raw evidence, not just raw text. No gate — the model's raw output is scored directly. |
| **X2** | xLMP state envelopes + consistency gate: X1, plus every model output is classified into a `ModelOutputType` (upstream classification step, itself either deterministic-where-possible or a second, smaller model call) and passed through `state_consistency_gate_v2.evaluate()`. The gate's outcome — not the model's raw text — is the graded answer. This is the full architecture under test. |

**Open implementation question — resolved.** X2 requires classifying a
model's freeform output into one of 6 `ModelOutputType` values before the
gate can run. Neither a deterministic parser (fragile, corpus-specific)
nor a second classification model call (its own error surface, doubles
cost) was used. Instead the model is asked, in a single call, to produce
its answer directly as structured JSON matching `ModelOutput`'s shape —
see `arm_x2.py`'s `RESPONSE_SCHEMA_INSTRUCTIONS` and
`parse_model_response()`. Structural correctness (prompt construction +
response parsing + gate wiring) is verified 27/27 against a mock model
call (`mock_model_call`, no API, no cost) — **this verifies the plumbing,
not real model behavior.** No real model has been called yet;
`run_x2_arm.py` is the actual invocation script and requires the
operator's own `ANTHROPIC_API_KEY` and a live, explicit run — same
authorization boundary as stated below, unchanged by this file existing.

## Evaluation protocol

For each case, each arm produces an answer; `run_case.py`'s pattern
(extraction feeding the gate, producing a `CaseRunResult`) is the model
for X1/X2 specifically — B0–B3 and X0 need a different, simpler scoring
path (freeform answer vs. `expected_state`, likely LLM-judged or rubric-
scored, not gate-evaluated, since they have no gate). `metrics.py`
computes what's calculable from either path once real results exist.

## Blind holdout — planned, not yet executed

Per directive Section 13: development = 100–120 cases, holdout ≥ 50,
frozen and hashed before final gate-logic tuning. **Not started.** At 27
total cases, all of which have already been used to find and fix real
bugs (see `LNES59_FAILURE_TAXONOMY.md`), designating any subset as a
genuine holdout now would be premature — a holdout drawn from an
already-small, already-tuned-against set isn't meaningfully blind. This
waits until the dataset is large enough that a real held-back portion
exists that hasn't informed any architecture decision.

## What this plan does NOT authorize

Per the operator's own standing rule this session (production/cost-
bearing actions need explicit, live confirmation, not inference from a
standing document): **this plan does not authorize running any
comparator arm.** B0–B3 and X0–X2 all require real model API calls —
real cost, same category as LNES-58's actual benchmark run, which needed
its own explicit "begin benchmark now" go-ahead separate from the
benchmark's design being finished. Building this plan is not that
go-ahead. Nor is X2's implementation code (`arm_x2.py`, `run_x2_arm.py`)
existing and being structurally verified against a mock — that proves the
plumbing is correct, not that spending has been authorized.
`run_x2_arm.py` requires the operator's own API key and the operator's
own act of running it; nothing in this codebase calls a real model
automatically or on its own initiative.
