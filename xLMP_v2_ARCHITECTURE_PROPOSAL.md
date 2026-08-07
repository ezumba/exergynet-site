# xLMP v2.0 Architecture Proposal

**Status: DRAFT — pending R4 completion.** Section 1 (Efficiency Frontier)
is a placeholder until the LNES-58 Modern-RAG-vs-xLMP benchmark's final arm
(R4, hybrid+reranker+parent-document-expansion) finishes. This document will
be updated with final numbers once that run completes, not before.

This document only makes claims that trace to something measured or read
directly in this session. Where a claim isn't yet backed by evidence, it's
marked as an open question, not asserted as fact.

---

## 1. Efficiency Frontier — Measured Trade-offs (FINAL, all 8 arms complete)

Full run: 601 real queries, `run1_20260806_134906`. Source: `Modern_RAG_vs_xLMP_Comprehensive_Audit.json` (SHA-256 `215b572ad72401281fa876f8cf79d20f4dc25103daac38aa0b34c8e1b2106b0d`).

| Arm | Accuracy | Total Latency (mean) | Accuracy/Latency (%/s) |
|---|---|---|---|
| S0 (TF-IDF) | 87.1% | 7886ms | 11.05 |
| R1 (Dense) | 93.3% | 13453ms | 6.94 |
| R2 (Hybrid RRF) | 92.5% | 12182ms | 7.59 |
| R3 (Hybrid+Reranker) | 93.3% | 19548ms | 4.78 |
| R4 (Hybrid+Reranker+Parent-Doc) | 93.2% | 15024ms | 6.20 |
| X1 (xLMP Complete-Object) | 91.4% | 8494ms | 10.77 |
| X2 (xLMP Bounded-Evidence-Resolver) | 90.6% | 7575ms | 11.97 |
| O1 (Gold-Evidence Oracle) | 90.7% | 7756ms | 11.69 |

**Two findings that both need to be stated plainly, not selectively:**

1. **xLMP dominates the efficiency frontier.** X2, O1, S0, and X1 occupy the top four accuracy/latency-ratio positions; R3 (highest accuracy) is *last* on this ranking (4.78, vs. X2's 11.97 — X2 is ~2.5x more accuracy per second of compute). This confirms the efficiency-frontier hypothesis as measured.
2. **xLMP does not have the highest raw accuracy on this benchmark.** R1 and R3 both measured 93.3%, R4 measured 93.2% — all three modern-RAG arms beat every xLMP arm (X1: 91.4%, X2: 90.6%) and beat the gold-evidence oracle itself (O1: 90.7%) on raw accuracy. This is the direct, honest counterpart to finding #1 and should not be omitted from any summary of this benchmark: the trade-off is real in both directions, not just the direction favorable to xLMP.

**X1 vs. gold oracle (O1):** X1 measured 91.4% vs. O1's 90.7% (delta +0.76 points) — within the noise of a single 601-query run, not a formal proof of any theoretical maximum.

**R4 (parent-document) vs. X2 (bounded-evidence-resolver):** R4 measured 93.2% vs. X2's 90.6% (delta -2.5 points, i.e. R4 outperformed X2 on this run). No per-row failure-mode analysis (e.g. checking whether parent-document expansion actually severed a medication/adverse-effect relationship in any specific case) has been done — that would require reading individual incorrect rows against source documents, not performed in this pass.

**Known caveat affecting X2/O1 specifically:** `gold_context.py`'s `interaction_check` construction was found mid-run to omit a reference table (the drug-interaction list in "Document B") that RAG arms could retrieve but the gold-evidence oracle could not construct from `facts` alone — confirmed via direct row inspection (O1: 74.6% accuracy on this query type alone vs. R3: 100%). This is a real, disclosed limitation of X2/O1's evidence construction for one query type (~11% of the dataset), not fixed in this run.

## 2. Deployed: `applyDeterministicSchemaMask`

Deployed to Portal (`xlmp_ds_core.ts`, `synthesizeFromDocument`) — a
deterministic parse-and-prune pass that strips `null` values, empty arrays,
and two non-substantive keys (`metadata_status`, `system_flags`) from
JSON-shaped source content before it enters the chunk/window pipeline. Falls
back to the original string unchanged when the content isn't valid JSON.

**Explicitly scoped:** this is a downstream formatting optimization, not a
retrieval or evidence-selection mechanism. It operates on content *after*
that content has already been chosen for chunking — it does not decide
which content is relevant to a given query, and it does not replace RAG's
retrieval step or xLMP's bounded-evidence resolution. Framing it as an
alternative to either would misrepresent what it does. Its only claim is:
less non-substantive JSON boilerplate occupies the fixed evidence-window
character budget than before.

Deployment note: file write verified on Portal (hash-matched), but the
Next.js rebuild needed to activate it is deferred — SSH to Portal timed out
this session (HTTPS/the live site itself is unaffected and still serving
the previous build). Per operator instruction, no further SSH reconnect
attempts today; rebuild to happen at a later maintenance window.

## 3. Open Engineering Question: The Evidence-Selection Layer

Identifying the optimal deterministic evidence-selection layer for xLMP v2
remains the primary open engineering question — not solved by anything
built or deployed this session. Specific open sub-problems, traced to real
findings from this work:

- **The 64k chunk-boundary fragmentation issue** referenced in the main
  whitepaper (§35, "confirmed root cause... corrected in the current VMN
  implementation") — the correction is claimed as done for VMN; whether
  the same class of fragmentation applies to xLMP-DS's evidence assembly
  in `xlmp_ds_core.ts` (which does its own independent chunking via
  `splitIntoChunks`/`extractEvidenceWindow`, not VMN's chunker) has not
  been checked in this session and is an open question, not a resolved one.
- **The `interaction_check` gold-context gap** found during this benchmark
  run: `gold_context.py`'s minimal-evidence construction for one query
  type omitted a reference table (Document B's drug-interaction list) that
  RAG arms could see via retrieval but the gold-evidence oracle could not
  construct from `facts` alone. This is a concrete, reproduced example of
  a deterministic evidence-selection layer failing to include something a
  retrieval-based approach found — worth weighing directly against R3's
  measured accuracy advantage in Section 1 once final, since both point at
  the same underlying question: what does a bounded/deterministic evidence
  layer need in order to not silently omit information that matters.
- Whether a hybrid approach (deterministic structural extraction *plus* a
  narrow, targeted retrieval step for reference-table-style content) closes
  this gap without reintroducing R3's full retrieval-latency cost is not
  tested by anything run this session — proposed as a candidate direction,
  not validated.

No architectural decision is recommended in this document. The purpose of
this section is to state the open question precisely enough that the next
benchmark or implementation pass can be scoped against it.

---

*This document lives outside the `exergynet` git repository (created at
operator's directed path) and is not currently tracked in version control.*
