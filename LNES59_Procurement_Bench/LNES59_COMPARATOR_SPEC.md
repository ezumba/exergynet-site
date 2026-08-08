# LNES-59.2B Comparator Specification

**2026-08-08.** R&D / benchmark only. Written per SEI CENTRAL COMMAND
LNES-59.2B (`@workspace.txt`) sections 1-14. This is the frozen spec for
all 8 comparator arms -- once `LNES59_ARM_CONFIGS.json` is hashed into
`LNES59_EXPERIMENT_MANIFEST.json` (section 18), nothing here may change
before or during holdout execution.

## 1. Hardware / software inventory (resource reconnaissance only)

Recorded 2026-08-08, before any model selection:

| Item | Value |
|---|---|
| GPU | Intel Arc(TM) 140V GPU (integrated, shared memory, reports ~16GB) |
| CUDA | Not applicable -- not an NVIDIA GPU |
| GPU acceleration backend installed | None (no IPEX/XPU/DirectML backend; current `torch` build is CPU-only) |
| System RAM | 33.9 GB |
| Disk free | ~36 GB free of ~929 GB total (**97% full** -- a real constraint) |
| Python | 3.13.13 |
| PyTorch | 2.11.0+cpu |
| Transformers | 5.5.4 |
| sentence-transformers | 5.4.1 |
| FAISS | 1.15.0 (CPU build, `faiss`) |
| BM25 | `rank_bm25` (`BM25Okapi`) available |

No holdout queries were run during this reconnaissance step.

## 2. Model family selection: Qwen3-Embedding-0.6B / Qwen3-Reranker-0.6B

Per the directive's preferred order (4B if comfortably supported,
otherwise 0.6B) and its explicit instruction not to choose a larger tier
"merely for prestige if it creates memory pressure, swapping, or unstable
latency": **0.6B is selected**, not 4B. Reasoning:

- No CUDA-class GPU is available and no Intel XPU/DirectML backend is
  currently installed -- inference runs on CPU. Installing an
  Intel-specific PyTorch backend would itself be a new, nontrivial,
  multi-GB dependency on a disk already at 97% capacity, for a benchmark
  whose corpus (dev + holdout combined, ~250 documents) and query count
  (50 holdout queries) do not require GPU-scale throughput.
- Disk headroom (~36 GB free) makes a 4B-class pair (embedding + reranker,
  each several GB) a real risk; the 0.6B pair is on the order of ~1-2 GB
  each.
- Verified directly: `Qwen/Qwen3-Embedding-0.6B` loads via
  `sentence-transformers` in ~19s (first download+load) and encodes a
  2-sentence batch in ~1.1s on CPU; `Qwen/Qwen3-Reranker-0.6B`'s tokenizer
  loads in ~12s. Both are on Hugging Face Hub, publicly downloadable, no
  new credential or paid API required (confirmed reachable via an
  unauthenticated HF Hub request).
- At this scale (small corpus, 50 holdout queries, dev-only calibration),
  0.6B gives materially faster, more stable per-call latency than 4B
  would on CPU, and identical infrastructure shape between B1/B2/B3 --
  exactly what the directive asks for ("a serious reproducible baseline,
  not maximum parameter count").

**Frozen model identities:**

| Role | Model ID | Source |
|---|---|---|
| Embedding (B1/B2/B3) | `Qwen/Qwen3-Embedding-0.6B` | Hugging Face Hub, public |
| Reranker (B3) | `Qwen/Qwen3-Reranker-0.6B` | Hugging Face Hub, public |

Exact revision/hash to be recorded in `LNES59_ARM_CONFIGS.json` as the
Hub commit SHA resolved at first load (frozen at that point, not
re-resolved before execution).

## 3. Optional BGE-M3 cross-check

Not currently locally available. Per the directive's own condition ("if
already locally available and inexpensive to integrate") this is
skipped -- not newly downloaded to manufacture the option. No ninth
primary arm is added; BGE-M3 is not used anywhere in the frozen 8-arm
matrix.

## 4. Chunking pipeline

See `LNES59_ARM_CONFIGS.json` for the frozen numeric parameters (target
chunk size, overlap, top-k, RRF constants, rerank pool depth). Chunking
uses the Qwen3-Embedding tokenizer for token counting (not a raw
character/word heuristic) so "~400-600 tokens" is measured against the
same tokenizer that will encode the chunks. Every chunk preserves its
source `doc_id` and `source_class` for provenance. Any calibration uses
DEVELOPMENT documents only, per section 15 -- never the sealed holdout.

## 5-13. Per-arm design

See `LNES59_ARM_CONFIGS.json` for the machine-readable frozen
configuration of every arm (B0-B4, X0-X2) and the shared
`CandidateClaim` output schema. Narrative design notes:

- **B0 (full context):** all case-permitted grounding documents supplied
  verbatim, no ranking. Truncation rule (if ever needed): keep documents
  in `grounding_document_ids` list order, drop from the end -- a single
  frozen deterministic rule, not a ground-truth-aware selection.
- **B1 (dense RAG):** chunks -> Qwen3-Embedding-0.6B -> FAISS flat index
  (cosine via normalized inner product) -> top-8.
- **B2 (hybrid RAG):** dense top-30 + BM25 top-30 -> Reciprocal Rank
  Fusion (`RRF_k=60`, the standard constant) -> final top-8. Same chunk
  set as B1.
- **B3 (hybrid + reranker):** same hybrid candidate generator as B2
  widened to top-40 -> Qwen3-Reranker-0.6B rescoring -> final top-8. The
  full 40-candidate pool is reranked, not just an already-narrowed top-5.
- **B4 (structured fact memory):** deterministic structured extraction
  (subject/predicate/value/source/time tuples) from the grounding
  documents into a persistent fact store, retrieved by predicate/subject
  match at query time. Explicitly does NOT receive the V7 deterministic
  gate -- it is B4's own structured retrieval that must carry the
  argument, not xLMP governance grafted onto it. Named
  `B4_STRUCTURED_FACT_MEMORY`, not "Mem0" (real Mem0 is not installed or
  used).
- **X0 (bounded evidence):** xLMP's `grounding_document_ids` bound,
  documents handed to the model as-is, no state envelope/governance.
- **X1 (state envelope, ungoverned):** frozen V7 `extract_case_state()`
  builds the state envelope; model produces a `CandidateClaim`; accepted
  without the V7 gate.
- **X2 (state envelope + governance):** identical to X1 through
  generation (same evidence, envelope, prompt, model, settings,
  CandidateClaim interface); then the frozen V7 `evaluate()` gate is
  applied. The X1->X2 delta is the primary experiment.

## 14. Generation model

**All 8 arms use the same generation model**: a Claude subagent invoked
via the Agent tool (same mechanism already established and validated for
the X2 comparator arm earlier in this project -- avoids provisioning any
new paid API/credential, per the user's explicit confirmation). Each arm
differs only in what evidence/context it is given, never in which model
generates from that context. Exact model identity, prompt-construction
code path, and settings (temperature, etc.) are recorded and hashed in
`LNES59_ARM_CONFIGS.json` / `LNES59_PROMPT_MANIFEST.json` before
execution.
