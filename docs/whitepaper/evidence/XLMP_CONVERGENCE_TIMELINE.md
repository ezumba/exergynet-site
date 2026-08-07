# xLMP Prior-Art and External-Convergence Timeline

This document records dated implementation evidence, disclosures, and
external technical developments relevant to the ExergyNet AI Memory Control
Plane thesis. Its purpose is to preserve provenance and establish what
ExergyNet had implemented or documented at specific dates.

Chronological proximity or conceptual overlap with third-party publications
does not establish causation, access, copying, or derivation. External
developments are recorded as independent market convergence unless direct
evidence establishes otherwise.

This is not an accusation of copying or IP misuse. It distinguishes
documented precedence from causation.

---

## Evidence Standard

Every ExergyNet milestone below is recorded with, where available: date,
artifact, repository/source, commit hash, file SHA-256, implementation
status, validation status, claim supported, and limitations. Where
supporting evidence could not be located in the time available, the entry
is marked `EVIDENCE_PENDING` rather than inferred from memory or backfilled
from recollection.

`DESIGNED`, `IMPLEMENTED`, `VALIDATED`, and `DEPLOYED` are treated as
distinct states, not synonyms, per `LWP_MAINTENANCE_POLICY.md`.

For external publications: publication date, publisher, title, public URL,
relevant concept, relationship to xLMP, and pre- or post-disclosure
position relative to July 15, 2026 are recorded.

---

## External Baseline Before July 15, 2026

Materially relevant work predating the July 15, 2026 ExergyNet disclosure.
This section exists to establish an intellectually honest baseline — it is
not a literature review, and inclusion here does not imply xLMP was first
to any general idea in this space.

| Publication date | Publisher | Title | Relevant concept | Relationship to xLMP |
|---|---|---|---|---|
| 2022-05 | Stanford / arXiv:2205.14135 (Dao et al.) | "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness" | IO-aware exact attention; reduces cost of attending to context already in the runtime | Operates entirely inside the model-runtime boundary (kernel/attention layer). xLMP operates before that boundary, governing what reaches it. Distinct, complementary layer — not overlapping prior art on xLMP's core claim. |
| 2020 | Meta AI (Lewis et al.) | "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" | Retrieving external text to condition generation | Established prior art for retrieval-conditioned generation generally. xLMP's category-boundary claim (Section 6 of the main paper) is explicitly "xLMP is not RAG" — this is acknowledged prior art in the same problem space, not a claim of originality over it. |
| 2021 | DeepMind (Borgeaud et al.) | "Improving Language Models by Retrieving from Trillions of Tokens" | Retrieval at corpus scale independent of context window | Same relationship as above — established retrieval-at-scale prior art; xLMP's distinction is evidence *authority and lineage*, not retrieval-at-scale itself. |
| 2023-10 (arXiv:2310.08560) | UC Berkeley (Packer et al.) | "MemGPT: Towards LLMs as Operating Systems" | Persistent, tiered agent memory managed independently of a single context window | Closest identified pre-July-15 prior art for "persistent agent memory outside the model's active context." Materially relevant to the AI Memory Control Plane's core framing; predates ExergyNet's July 15 disclosure and the June 27 Landauer/xLMP implementation commits by many months. |

**Honest framing:** the general problem — context windows are finite, retrieval and persistent memory exist as partial answers — is not new and is not claimed as new anywhere in the main paper. xLMP's specific claims (Section 7 of the main paper: integrity/provenance/authority as separately verifiable properties; Section 9.1: temporal validity and decision lineage; bounded evidence with completeness guarantees within a declared boundary) are narrower than "persistent memory" as a general category, and this baseline is recorded so the timeline below does not read as implying otherwise.

---

## ExergyNet Internal Milestones

All dates below are either git commit timestamps (`exergynet` repository,
verified via `git show -s --format="%H %ad %s" --date=iso-strict`) or
filesystem SHA-256 + mtime for artifacts not tracked in git. Both evidence
classes are marked explicitly. No date below is backfilled from memory.

| Date (verified) | Artifact | Source | Commit hash | Implementation status | Claim supported |
|---|---|---|---|---|---|
| 2026-06-27T07:58:57-04:00 | "Landauer" storage layer (pre-rename name for what became xLMP) | `exergynet` repo, commit message | `ea1853d0edbf4e3dadbd5270f47c2cb9152bb955` | IMPLEMENTED (pre-existing code being synced/renamed, not first-written here) | Establishes the underlying architecture existed under a prior name before the "xLMP" label was adopted. |
| 2026-06-27T08:11:27-04:00 | Rename: Landauer → xLMP storage | `exergynet` repo, commit message | `a53f73800efbde3d2726ab943cadb471c6bd0e96` | IMPLEMENTED | First commit using the name "xLMP" for this subsystem. |
| 2026-06-27T09:58:09-04:00 | Vault xLMP query API (accept JSON without image_id, store content on ingest, real intent resolution) | `exergynet` repo, commit message | `9eba196be470e179afa1361882c11129d5ae40b7` | IMPLEMENTED | Query-API-level evidence resolution logic. |
| 2026-06-27T10:29:51-04:00 | Vault xLMP: restore image_id as required field | `exergynet` repo, commit message | `c61a2a2f718183a96839794a99682d4473f0bbcf` | IMPLEMENTED | Iteration on the same query API within the same day. |
| 2026-06-27T11:01:17-04:00 | Vault xLMP: P0 Relevance Gate + P1 Multi-Intent + P1 UX fixes | `exergynet` repo, commit message | `65cc93a27837ab5c371b280305b463f0aea5fb21` | IMPLEMENTED | Relevance gating — an early form of bounded-evidence selection. |
| 2026-06-27T11:43:45-04:00 | Vault: document intelligence resolver — LLM synthesis over top-scored chunks | `exergynet` repo, commit message | `a7b2990326a3d82ca6222bfdf587264857ebc814` | IMPLEMENTED | |
| 2026-06-27T12:06:39-04:00 | Vault: Staged Compression Path — metadata strip + evidence window reducer | `exergynet` repo, commit message | `8c74c57d0172a1e74d193a8a0914a2ed907d4404` | IMPLEMENTED | "Evidence window reducer" — direct implementation precedent for bounded-evidence staging, same day as the rename. |
| 2026-07-15T00:23:24 to 2026-07-15T10:52:21 (file mtimes) | LNES-58 Multihop Bench harness: `tier1_cross_field.py`, `tier2_cross_document.py`, `tier3_adversarial.py`, and result files `tier{1,2,3}_result.json`, `tier{1,2,3}_rag_result.json` | Local filesystem, `LNES58_Multihop_Bench/` (not git-tracked) | N/A (filesystem evidence) — SHA-256 values in the companion manifest | IMPLEMENTED + VALIDATED (results present) | The 1,202-query xLMP-vs-RAG comparison referenced in the July 15 disclosure package (200+201+200 = 601 queries × 2 methods = 1,202). Independently reproduced: 601 queries per method confirmed by direct count during a later benchmark run in this same session. |
| 2026-07-13 to 2026-07-14 | `ExergyNet_H200_Performance_Benchmarks_v2.zip` (EVD-001) | `C:\Users\ezumb\Downloads\ExergyNet_H200_Performance_Benchmarks_v2.zip` | N/A (filesystem evidence) | VALIDATED | SHA-256 independently recomputed this session: `7005fa0766ee66a40fa6bce3268efeac069a8fb75c21ad9b1bb535db8a1e2204` — matches `evidence/README.md`'s EVD-001 record exactly. |
| 2026-07-14 (file mtime 2026-07-13T16:06:43-04:00) | `xLMP_H200_Benchmark_Addendum_v2_2026-07-14.zip` (EVD-002) | `C:\Users\ezumb\Downloads\` | N/A (filesystem evidence) | VALIDATED | SHA-256 independently recomputed this session: `97559fb4bea7a571614f1cd851a9efa794027e680c297635744fde76e3a1534f` — matches `evidence/README.md`'s EVD-002 record and its own `.sha256` sidecar file exactly. |
| 2026-07-16T11:54:01-04:00 (file mtime) | `ExergyNet_xLMP_Accelerated_Memory_Benchmark_Suite_v1_2026-07-15.zip` — the consolidated package referenced in the disclosure drafts | `exergynet` repo working tree | N/A (filesystem evidence) | VALIDATED | SHA-256 independently recomputed this session: `1bce19ba968411437053f763646b96218d47ddd6ad07e534930640c7ba8d1433` — matches both email drafts' stated hash exactly. Note: the archive's *filename* carries the date 2026-07-15 (the benchmark campaign's stated cutoff date per the cover email), while the file's actual filesystem mtime is 2026-07-16 — recorded here rather than silently reconciled. |
| 2026-07-25T19:06:26-04:00 | VMN marketing page — "vanguard-memory-node v1.0.0" | `exergynet` repo, commit message | `e4d79321290b5416c8c03026b39c683d219bf96a` | DEPLOYED (public page) | This is the date a public-facing page *describing* v1.0.0 was added, not independently confirmed as the underlying software's first-release date — recorded as what the evidence actually supports. |
| 2026-07-27T18:55:24Z | `vmn.html` v1.4.0 — vault bridge, 10 tools, pipeline visualization | `exergynet` repo, commit message | `c2573a562d1da6cad99014b8bbf3aa12a1f39bec` | DEPLOYED (public page) | |
| 2026-07-28T06:44:04Z | VMN update to v1.5.0 — 11 tools, `vmn_ingest_file`, substrate routing | `exergynet` repo, commit message | `82dba7e936b1e5fb4e830ece62f9412ca95ddf75` | DEPLOYED (public page) | Postdates the July 15 disclosure and postdates the July 26–27 external publications below — recorded as such, not obscured. |
| 2026-08-05T18:14:56-04:00 | "AI Memory Control Plane" positioning — hero section, three-property architecture section, JSON-LD | `exergynet` repo, commit message | `c1a3df44065cdfaf24db667b32f6e87f39674c5c` | DEPLOYED (public site copy) | First git-verified use of the exact phrase "AI Memory Control Plane" as public site positioning found in this search. The underlying architecture (query API, relevance gate, evidence window reducer) predates this by five weeks; the *category name* "AI Memory Control Plane" as public-facing copy is dated here. |

**VMN v1.1.0 through v1.3.x:** `EVIDENCE_PENDING`. The commits found establish v1.0.0 (2026-07-25), v1.4.0 (2026-07-27), and v1.5.0 (2026-07-28) by exact repository record. No intermediate version commits were located in the time available for this pass; they are not asserted to exist or not exist.

**Exergy Vault / xLMP-DS formal architecture, root-addressed persistent state, shard architecture as named concepts:** `EVIDENCE_PENDING` for a single canonical origin commit. The implementation precedents above (query API, relevance gate, evidence window reducer, document intelligence resolver) are dated and verified; a specific commit introducing "root-addressed" or "shard architecture" as named design terms was not isolated in this pass.

---

## Formal External Disclosures

### July 15, 2026 — ExergyNet benchmark/report package

**Report artifact (independently verified this session):**

- Archive: `ExergyNet_xLMP_Accelerated_Memory_Benchmark_Suite_v1_2026-07-15.zip`
- Archive SHA-256 (recomputed): `1bce19ba968411437053f763646b96218d47ddd6ad07e534930640c7ba8d1433`
- Dataset Merkle root (as stated in the cover materials; not independently recomputed this session): `1831b85c7ff9bef17db3b67e2b2c5ac105b95e049d4ffb73c3cbbe7d14b58fd6`
- Attestation key fingerprint (as stated in the cover materials): `0e311d6bb71b2321ec36e448e5fbc66821c8f3249244b3e6f2093303db72001a`
- Subject line (finalized draft): "ExergyNet xLMP Benchmark Suite: H200 Productivity and Deterministic AI Memory"
- Content dated: benchmark campaign "completed through July 15, 2026"
- Core claims actually present in the delivered report: H200-vs-A10 inference comparison; xLMP prompt-context held to ~660–820 tokens as stored memory scaled past the model's context limit; +24.4-point accuracy advantage over tested RAG at equal evidence budget; ~11.3× correct-task throughput vs. full-context, ~1.7× vs. RAG; ~42.7×/~4.0× Useful-Answer-per-Token vs. full-context/RAG; 96.0% vs. 82.6% accuracy on a 201-query cross-document-synthesis set; a co-executed H200 fixed-QPS saturation ladder (with Bontu Veena) tracing the serving ceiling to a vLLM scheduler configuration limit, not H200 hardware exhaustion; and a separately disclosed public-gateway throughput finding.

**Recipients:** `DISCLOSURE_EVIDENCE_HELD_PRIVATELY`. A finalized, recipient-addressed cover-email draft exists locally naming specific individuals; those names are not reproduced in this public artifact. Full recipient evidence is retained in the private working files already governed by this project's existing access controls.

**Transmission status:** the local record establishes a *finalized* cover-email draft (not a placeholder — it addresses named recipients by first name and is marked as superseding earlier drafts) and a matching, hash-verified report artifact. It does **not**, by itself, establish that the email was actually sent (no sent-folder record, delivery receipt, or reply was located in the files available to this pass). A related document, `HANDOFF_TO_VEENA_NVIDIA_MEETING.md` (git-tracked, `exergynet` repo, filesystem date 2026-07-13), independently confirms active meeting preparation with an NVIDIA-affiliated co-author (Bontu Veena) around the same benchmark package, which is separate evidence of engagement but is also not itself a transmission record for the July 15 email specifically.

**CAUSATION / TRANSMISSION:** `EVIDENCE_PENDING` for confirmed send. The report artifact's existence, content, and hash are `VALIDATED`. Whether it was actually delivered to NVIDIA personnel on or after July 15 is recorded as unconfirmed by locally available records, not assumed.

Do not treat any concept as "disclosed on July 15" if it was added to ExergyNet's architecture after this document's date — the concepts listed under "core claims actually present" above are the ceiling of what this disclosure can support, regardless of what the architecture contains today.

---

## External Market Convergence After July 15, 2026

All three entries below were independently verified this session (publication date and core content fetched directly from the source URL, not taken from the operator's summary alone).

### 2026-07-26 — NVIDIA Nemotron 3 Ultra / ACE-RTL

- Publisher: NVIDIA (developer.nvidia.com technical blog)
- Title: "NVIDIA Nemotron 3 Ultra Leads Open Models on Accuracy and Efficiency in Agentic RTL Coding"
- URL: https://developer.nvidia.com/blog/nvidia-nemotron-3-ultra-leads-open-models-on-accuracy-and-efficiency-in-agentic-rtl-coding/
- Verified publication date: 2026-07-26
- Relevant concept: iterative generate-test-reflect workflow; a coordinator component maintains "evolving debugging context" across iterations, deciding which history and feedback should inform the next generation attempt.
- Relationship to xLMP: both describe governing what state/history persists and re-enters a model's active context across iterations. NVIDIA's coordinator is scoped to a single agent's debugging loop; xLMP's claim is broader (cross-model, cross-session, cross-device persistent state with integrity/provenance/authority as separable properties). Overlapping *problem space*, not a claim of identical mechanism.

CAUSATION: NOT ESTABLISHED
CLASSIFICATION: INDEPENDENT_EXTERNAL_CONVERGENCE

### 2026-07-27 — NVIDIA NOOA (Six Agent Harness Capabilities)

- Publisher: NVIDIA (developer.nvidia.com technical blog); companion arXiv paper 2607.20709 (Cabral & Furgale, NVIDIA-labs)
- Title: "Six Agent Harness Capabilities for Higher Model Performance"
- URL: https://developer.nvidia.com/blog/six-agent-harness-capabilities-for-higher-model-performance/
- Verified publication date: 2026-07-27
- Relevant concepts: explicit object state (durable, typed state on the agent object rather than in conversation history); pass-by-reference with bounded previews instead of full serialized dumps; a persistent, typed, human-readable memory store with importance/tags/relationships; model-callable APIs for context and event history.
- Relationship to xLMP: strong conceptual overlap on "state should live outside conversation history" and "the model should see a bounded view, not the full object." NOOA's memory is agent-local (SQLite file per agent); xLMP's claim is a shared, content-addressed, cross-model/cross-device persistent layer with separately verifiable integrity/provenance/authority. Related, not identical — NOOA does not claim cross-model portability or cryptographic evidence integrity as core properties.

CAUSATION: NOT ESTABLISHED
CLASSIFICATION: INDEPENDENT_EXTERNAL_CONVERGENCE

### 2026-07-31 — NVIDIA "Co-Designing AI Model Attention for Fast, Interactive Long-Context Inference"

- Publisher: NVIDIA (developer.nvidia.com technical blog)
- Title: "Co-Designing AI Model Attention for Fast, Interactive Long-Context Inference"
- URL: https://developer.nvidia.com/blog/co-designing-ai-model-attention-for-fast-interactive-long-context-inference
- Verified publication date: 2026-07-31
- Relevant concepts: prefill scales quadratically with sequence length (compute-bound); decode is memory-bandwidth-bound, reading the full KV cache per step; Guideline 3 of 4 recommends reducing effective KV state via KV-cache compression, sparse/sliding-window attention, or hybrid architectures.
- Relationship to xLMP: this is model/kernel-level KV-state reduction — it operates on context already inside the model runtime. xLMP's Section 43.3 (main paper) explicitly frames this as a complementary, lower layer: xLMP determines what reaches the runtime boundary; this class of technique determines how efficiently what has already crossed that boundary is processed. Not competing claims — different pipeline stages.

CAUSATION: NOT ESTABLISHED
CLASSIFICATION: INDEPENDENT_EXTERNAL_CONVERGENCE

---

## Architectural Convergence Matrix

| Concept | ExergyNet artifact/date | External publication/date | Overlap | Important architectural difference | Evidence status |
|---|---|---|---|---|---|
| Persistent state outside model context | Vault xLMP query API, 2026-06-27 | MemGPT, 2023-10 (pre-baseline); NOOA, 2026-07-27 | High — same general problem framing | xLMP claims cross-model/cross-device portability + separately verifiable integrity/provenance/authority; neither cited external work makes the portability + cryptographic-verification combination its core claim | VALIDATED (internal); VERIFIED (external dates) |
| Bounded model-facing evidence | "Evidence window reducer," 2026-06-27; formalized as E(q) in main paper §33 | NOOA "bounded previews," 2026-07-27 | High — same mechanism category (show less than the full object) | xLMP ties boundedness to a declared, completeness-checkable evidence unit (§13 of main paper); NOOA's preview bounding is not tied to a formal completeness claim | VALIDATED (internal); VERIFIED (external) |
| Context/state decoupling | Rename + query API, 2026-06-27; formalized §5/§43.3 diagram, 2026-08-06/07 | Co-Designing Attention article, 2026-07-31 | Medium — NVIDIA's piece decouples *kernel* cost from context length, not persistent state from the model itself | Different layers of the same pipeline (see §43.3 of main paper) rather than the same claim | VALIDATED (internal); VERIFIED (external) |
| Persistent agent memory | Query API + relevance gate, 2026-06-27 | MemGPT, 2023-10 (pre-baseline) | High | MemGPT predates xLMP's implementation by ~8 months — recorded honestly in the pre-disclosure baseline above, not claimed as xLMP prior art | VALIDATED (internal); VERIFIED (external) |
| Pass-by-reference / bounded previews | "Evidence window reducer" / relevance gate, 2026-06-27 | NOOA, 2026-07-27 | High | Same mechanism category; xLMP's is tied to content-addressed integrity, NOOA's to live Python object references | VALIDATED (internal); VERIFIED (external) |
| Evolving agent state | N/A — not a named xLMP milestone found | ACE-RTL coordinator, 2026-07-26 | Low-medium | ACE-RTL's evolving state is scoped to one debugging session; not directly mapped to an xLMP milestone in this pass | EVIDENCE_PENDING (internal) |
| KV-state reduction | Not an xLMP claim — explicitly described as a different layer (§43.3) | Co-Designing Attention article, Guideline 3, 2026-07-31 | Low — different layer by design | xLMP does not claim to do KV-cache compression, sparse attention, or GQA/MQA; §43.3 states the mechanisms stack rather than compete | VALIDATED (internal, as a non-claim); VERIFIED (external) |
| Evidence provenance | §7/§9 of main paper (integrity/provenance/authority triad); implementation precedent 2026-06-27 | Not directly addressed in the three post-disclosure publications reviewed | Low | This is the sharpest point of difference identified in this pass — none of the three external publications reviewed make cryptographic provenance/authority a core claim | VALIDATED (internal); N/A (external) |
| Cross-model continuity | Claimed in main paper §5/§25; VMN cross-model integration commits (dates as listed above) | Not a core claim in the three external publications reviewed | Low | Same as above | PARTIALLY VALIDATED (internal — see main paper's own DEPLOYED/STAGED distinctions); N/A (external) |
| Authorization / execution lineage | LNES-22 (separate subsystem, main paper §40-41); Section 9.1 decision-lineage framing | Not addressed in the three external publications reviewed | None found | LNES-22 and decision lineage are not present in any of the three reviewed external publications | VALIDATED (internal, per main paper's own status table); N/A (external) |

"Related" and "identical" are not used interchangeably anywhere above; several rows explicitly record low or no overlap.

---

## The Implementation Moat

Hyperscaler convergence on persistent state, context efficiency, and
long-running agent infrastructure strengthens the market case for the AI
Memory Control Plane problem.

Conceptual convergence alone does not establish implementation equivalence.

ExergyNet's defensible position depends on concrete implementation
artifacts: persistent state externalization, bounded evidence assembly,
integrity and provenance mechanisms, cross-compute continuity, and
verifiable receipts — where those mechanisms are implemented and validated.

Measured behavior, reproducible artifacts, and dated implementation
evidence supersede narrative originality.

This document does not claim: that ExergyNet invented persistent memory;
that NVIDIA or any other party copied xLMP; universal O(1) retrieval;
that every xLMP operation is ZK-proven (the main paper's own §50 and
Appendix D explicitly disclaim this); thermodynamic necessity; that xLMP
is the only architecture capable of this class of problem; or that
publication-date proximity proves causation in either direction.

---

## Evidence-Pending Items (Summary)

- VMN v1.1.0 through v1.3.x: no intermediate version commits located.
- A single canonical origin commit for "Exergy Vault," "xLMP-DS," "root-addressed persistent state," and "shard architecture" as named design terms.
- Confirmed transmission (send/delivery) of the July 15, 2026 disclosure email — the report artifact and a finalized recipient-addressed draft are verified; actual sending is not.
- A direct internal-milestone mapping for "evolving agent state" against the ACE-RTL coordinator concept.
- Dataset Merkle root and attestation key fingerprint for the July 15 package were taken from the cover materials' own stated values, not independently recomputed from the archive's internal verification scripts in this pass.

---

*Compiled 2026-08-07. Evidence gathered via direct git history inspection (`exergynet` repository), local filesystem SHA-256 recomputation, and independent web verification (publication date and content fetched from source) for all three post-disclosure external publications. No milestone date in this document was backfilled from memory or assumed without a located artifact.*
