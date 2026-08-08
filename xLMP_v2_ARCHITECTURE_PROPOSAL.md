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

Deployment note: file write was verified on Portal in an earlier session
(hash-matched), but the Next.js rebuild needed to activate it was deferred
at the time. **That rebuild has since happened** — the 2026-08-08
`npm run build && pm2 restart` that activated LNES-58.10 (§5) recompiled
this same `xlmp_ds_core.ts` file in full, so this function is active as a
mechanical consequence of that same build, not a separately-verified
deployment step of its own. No functional smoke test specific to this
feature (as opposed to LNES-58.10) has been run.

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

## 4. Deterministic Entity Graph Series (LNES-58.5–58.9) — BENCHMARK ONLY

This section covers work that happened after Section 1's 8-arm run,
targeting a different question: given a query the deterministic layer can't
resolve from `facts` alone, can a query-independent evidence-graph reliably
say "no match" instead of the model silently fabricating a citation?

**Every finding below is a benchmark result. None of this is deployed to
Portal production.** Section 7 states what that gap actually is.

**X3 (oracle-leakage discovery and invalidation).** An early foreign-key
resolver (`deterministic_fk_resolver.py`) measured 97.0% raw accuracy, but
was found — by inspecting its own code, not by an external review — to
hardcode a query-type-conditioned dependency (`DOC_B_ROOT` assigned per
query type rather than derived from the record itself). This is oracle
leakage: the resolver knew the answer's shape before resolving anything.
Relabeled `INVALID_FOR_ARCHITECTURAL_CLAIM` and preserved only as
diagnostic evidence, not as a validated architecture. The 97.0% number
cannot be cited as evidence the architecture works.

**X4 (query-independent Deterministic Entity Graph).** Rebuilt to fix X3's
defect: the graph (`entity_graph_builder.py`) is constructed by parsing
document text alone (`build_reference_graph`), frozen via
`freeze_entity_graph.py` *before* any query or answer text is read, with
SHA-256 hashes of the frozen graph recorded as provenance. Traversal
(`entity_graph_traversal.py`) is entity-set intersection over the frozen
graph, not query-text-driven lookup.

**X5 (verified negative state).** Raw traversal returning empty results was
found to be ambiguous to the model — it couldn't distinguish "confirmed no
relationship exists in scope" from "the graph just didn't have enough to
decide." Fixed by making traversal (`entity_graph_traversal_v2.py`) return
an explicit `MATCH` / `NO_MATCH` / `INCOMPLETE` state plus a
content-addressed `NegativeResolutionReceipt` or `IncompleteResolutionReceipt`
(SHA-256 canonical JSON) that the model-facing null assertion is generated
from, not free-formed. Measured on the 67-query interaction-check subset:
94.03% (63/67), with 4 residual failures where the model still contradicted
a verified `NO_MATCH` state and fabricated a citation anyway (isolated in
`LNES58_8` residual autopsy).

**X6A (closed-world model instruction).** Adding an explicit closed-world
instruction to the prompt eliminated citation fabrication completely on
this subset (0/67, NO_MATCH accuracy 84%→100%), but introduced 3 new,
unrelated failures (truncation / empty completion — a token-budget/
reliability issue, not a fabrication issue). Did not reach 67/67 overall.

**X6B (deterministic state-authority gate).** A pure, non-generative
function (`state_contradiction_gate.py` — no LLM call, no ground-truth
inspection, compares only `resolver_state` against the model's own
structured output) applied *post-hoc* to X5's original, unmodified output
(no re-inference). Caught all 4 known contradictions, 0 false positives on
the other 63 already-consistent rows, mean gate latency 0.3μs. Result:
100.00% (67/67) authorized-state accuracy. This is the stronger of the two
remediations — it doesn't depend on prompt wording holding up across future
model changes; it enforces the boundary structurally, after generation.

Full detail: `LNES58_7_FINAL_REPORT.md` (negative-state spec),
`LNES58_9_FINAL_REPORT.md` (X6A/X6B), `X5_Residual_Autopsy_Report.md`.

## 5. LNES-58.10 — Retrieval-Time Root Verification (DEPLOYED 2026-08-08)

Unlike Section 4, this closes a real gap in **existing production code**:
`xlmp_get_content` (the real, persistent, `XLMP_DATA_DIR`-backed content
store used by `xlmp_zk_query`) previously trusted the object selected by
filename/root and returned it without recomputing its commitment.

The production root construction (unchanged by this patch — existing
stored roots remain valid) is an **ordered aggregate hash over shard
digests**: `d_i = SHA256(shard_i)`, `root = SHA256(hex(d_1) || ... ||
hex(d_n))`. This is not a Merkle tree (no pairwise combination, no
odd-leaf case) and not usefully described as a hash chain either — it's a
single aggregate hash over an ordered list of digests, with no partial-
inclusion proof; full recomputation is required to verify.

Patch (commit `305586f`, local only): extracted the algorithm into a shared
`computeXlmpRoot()` used by both ingest and retrieval; `xlmp_get_content`
now rejects malformed root syntax before touching disk, preserves existing
not-found behavior, and throws a typed `MemoryIntegrityViolation` (fatal to
the current request only, never the process) when retrieved bytes don't
hash to the requested root. Verification happens once per object per
process (cache entries are written only after verification), documented
explicitly as a trust boundary with a real, disclosed limitation: an
already-cached root's on-disk tampering isn't re-detected until the cache
entry is evicted (currently only via process restart — no eviction exists
yet). Also patches the one other direct caller of `xlmp_get_content`
(`/api/v1/vault/content`), which had no handling at all for the new thrown
type. 13/13 new integrity tests pass (backward-compatibility + 10
adversarial cases); the existing 12-test resolver suite is unaffected.

**Status: DEPLOYED to production 2026-08-08.** Both files
(`xlmp_ds_core.ts`, `api/v1/vault/content/route.ts`) written via OTET
(`otet-d3504acda2a22fa92a512e83d8b4e951932b9b1717fce727`,
`otet-7b43e95f114f76abded5b226f8960aab39a7c732699f04ec`, both hash-verified
against local `post_hash` and recorded to Vanguard Scribe), then
`npm run build && pm2 restart exergynet-portal` run directly against the
Portal host. Verified from the actual build/restart output, not from any
narrative claim about it: `next build` reported "✓ Compiled successfully
in 53s", the route table includes `/api/v1/vault/content` and
`/api/xlmp/query` (the two routes this patch touches), and `pm2` confirmed
`exergynet-portal` (id 5) restarted with a fresh PID at 0s uptime. Four
build warnings appeared, none related to this patch (a deprecated
Next.js route `config` export on two unrelated routes, and a missing
`ethers` module on `/api/billing/rho-sump` — pre-existing, not
investigated here). Production smoke-test confirmation (Phase E) is a
separate, still-pending step — see the final report.

## 6. LNES-58.11 — Production Root-Compatibility Evidence

Before considering deployment of Section 5's patch, a read-only,
zero-write diagnostic (`verify_production_roots.js`) was run directly
against the real Portal content store to check whether historical
production objects are compatible with the (unchanged) root algorithm.

Result: of 72 eligible objects (`<64-hex-root>.xlmp` under the active
`XLMP_DATA_DIR`, which is unset in the running process and therefore uses
the code default `/home/ubuntu/xlmp_data`), a sample of 50 recomputed to
their expected roots — 50/50 PASS, 0 FAIL, including 2 multi-shard objects
(one ~262MB / 501 shards). No object content was read into any log or
report; the diagnostic emitted only root hex, byte counts, shard counts,
and PASS/FAIL.

**Authorized interpretation:** all 50 sampled production objects
recomputed to their expected roots under the current algorithm — direct
production evidence for the sampled objects, not a claim that the full
72-object population, or any future object, has been verified.

**Known limitation, found and fixed:** the original sampler used
`stride = floor(N / 50)`, which degenerates to "first 50 sorted objects
only" for any N between 51 and 99 — confirmed as the actual behavior of
this specific run (N=72). Replaced with an evenly-spaced index method
(`index_i = round(i·(N-1)/(K-1))`) that always includes the first and last
sorted object and is duplicate-free by construction; regression-tested
across N=1,10,49,50,51,72,99,100,137. The original 50/50 PASS result is
historical and was not re-run or reinterpreted after this fix — the fix
only affects future runs.

## 7. Production Entity Graph — Explicitly NOT Deployed

To be unambiguous, since Sections 4–6 describe substantial work: **none of
the Deterministic Entity Graph / MATCH-NO_MATCH-INCOMPLETE / Negative
Resolution Receipt / X6B state-authority-gate architecture from Section 4
is deployed in Portal production.** Direct reconnaissance of the real
production call chain (`xlmp_zk_query` → `xlmp_get_content` →
`resolveIntent` → `synthesizeFromDocument` → `vanguardRace`) confirmed a
real, persistent content store exists, but **no production entity/relation
data model exists to attach the benchmark architecture to.** This is not a
resourcing gap closed by more engineering time on the existing benchmark
code — it's an unmade architecture decision (what counts as an entity, how
relations get authoritative status, schema ownership, versioning). A
separate design document (`PRODUCTION_ENTITY_GRAPH_RFC.md`) scopes that
decision space without prematurely choosing an answer.

BENCHMARK IMPLEMENTATION is not PRODUCTION IMPLEMENTATION. Section 5's
retrieval-time root verification is the only item from this document
deployed to production (2026-08-08, see §5) — the Deterministic Entity
Graph / state-machine / receipt / gate architecture in §4 remains
benchmark-only, undeployed, with no production data model to attach to.

---

*This document is tracked in the `exergynet` git repository — committed as
part of `1a69c6c` (`lnes58-frozen-evidence-v1`) for Sections 1–3, with
Sections 4–7 added in a later commit. Adding sections in a new commit does
not modify or rewrite the frozen commit itself; Section 1's measured
numbers are unchanged from that frozen evidence.*
