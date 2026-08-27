# Benchmark Reconciliation
**Document type:** Website vs white-paper vs evidence-package number comparison
**Audit date:** 2026-08-05
**Canonical evidence:** EVD-001 (H200 xLMP vs RAG vs full-context), EVD-002 (H200 replication/saturation testing by Veena)
**Constraint:** NO DEPLOYMENT — reconciliation record only

Status vocabulary:
- VERIFIED — number matches EVD-001 or EVD-002 precisely
- CONSISTENT — number is a valid re-expression of the evidence (different framing, same measurement)
- INCONSISTENT — number conflicts with the evidence package
- REMOVE_PENDING_EVIDENCE — no preserved evidence; must be removed or evidenced before publication
- PENDING_FULL_READ — page not fully read; classification pending

---

## Table 1: xLMP Architecture Benchmarks (Primary Evidence)

| METRIC | WEBSITE NUMBER (INDEX.HTML) | WHITE-PAPER NUMBER (AI_MEMORY_CONTROL_PLANE.MD) | EVIDENCE NUMBER (EVD-001/002) | TEST ENVIRONMENT | STATUS | FINAL APPROVED PUBLIC WORDING |
|--------|---------------------------|------------------------------------------------|-------------------------------|-----------------|--------|-------------------------------|
| Correct-task throughput, xLMP vs full-context | "11.3×" | "~11.3× correct-task throughput vs full-context" | ~11.3× | H200 (EVD-002), T4/A10 (EVD-001) | VERIFIED | "11.3× correct-task throughput vs full-context baseline (H200, equal evidence budget)" |
| xLMP prompt token range | "660–820 Flat Prompt Tokens" | "660–820 tokens flat as corpus grew 8k→285k" | 660–820 | H200, T4, A10 | VERIFIED | "660–820 prompt tokens — stable as memory corpus grows from 8k to 285k tokens" |
| Hardware independence | "100% Across T4, A10, H200" | "Hardware-independent: T4, A10, H200" | T4, A10, H200 tested | T4, A10, H200 | VERIFIED (framing note) | "Consistent performance across T4, A10, and H200 GPU platforms" — avoid bare "100%" which reads as accuracy rate rather than hardware coverage |
| Accuracy improvement, xLMP vs RAG | Not prominently stated on index.html | "+24.4 accuracy points at equal evidence budget" | +24.4 points (EVD-001) | H200 | VERIFIED | "+24.4 accuracy points over RAG at equal evidence budget" |
| Correct-task throughput, xLMP vs RAG | Not prominently on index.html | "~1.7× vs RAG" | ~1.7× (EVD-001) | H200 | VERIFIED | "1.7× correct-task throughput vs RAG at equal evidence budget" |
| Useful Answer per Token, xLMP vs full-context | Not prominently on index.html | "~42.7× Useful Answer per Token vs full-context" | ~42.7× (EVD-001) | H200 | VERIFIED | "42.7× improvement in useful answers per token vs full-context baseline" |
| Useful Answer per Token, xLMP vs RAG | Not prominently on index.html | "~4.0× vs RAG" | ~4.0× (EVD-001) | H200 | VERIFIED | "4.0× improvement in useful answers per token vs RAG" |
| Full-context token growth | Not prominently on index.html | "11k→67k, rejected past 262k" | 11k→67k, rejected >262k (EVD-001) | H200 | VERIFIED | "Full-context baseline grew from 11k to 67k tokens and was rejected past 262k; xLMP remained at 660–820" |
| Saturation testing QPS range | Not on index.html | "QPS 10–45 ladder analysis (Veena)" | EVD-002 (partial — UER-019 pending) | H200 | VERIFIED (partial — intermediate data pending) | "Saturation tested at QPS 10–45; full QPS curve pending" |

---

## Table 2: whitepaper.html Benchmark (Inconsistent — CRITICAL-003)

| METRIC | WHITEPAPER.HTML NUMBER | WHITE-PAPER NUMBER (AI_MEMORY_CONTROL_PLANE.MD) | EVIDENCE NUMBER (EVD-001/002) | STATUS | ACTION |
|--------|----------------------|-------------------------------------------------|-------------------------------|--------|--------|
| xLMP accuracy | "96.0% xLMP accuracy" | Not in canonical paper as a percentage figure | Not in EVD-001/002 as a raw percentage | INCONSISTENT | REMOVE — resolved when whitepaper.html is rebuilt from canonical source (Stage 7) |
| RAG accuracy | "82.6% for tested sparse top-k RAG" | Not in canonical paper as a percentage figure | Not in EVD-001/002 as a raw percentage | INCONSISTENT | REMOVE — same |
| Implied delta | 96.0 - 82.6 = +13.4 points | "+24.4 accuracy points" (EVD-001) | +24.4 points | INCONSISTENT — 13.4 ≠ 24.4 | These numbers are not consistent. Either they measure different things (different RAG configuration, different test corpus) or one is incorrect. Operator + Veena must resolve before re-publishing any percentage-based accuracy claim. |

**Note on whitepaper.html inconsistency:** The 96.0%/82.6% figures and the +24.4 point delta cannot be reconciled mathematically. Either the old whitepaper.html tested a different RAG configuration that happened to score 82.6%, or one of the two sets of numbers is incorrect. This discrepancy must be resolved before the canonical paper is published. See UER-019 (Veena) and UNRESOLVED_EVIDENCE_REQUESTS.md.

---

## Table 3: Vanguard Inference Benchmarks (REMOVE_PENDING_EVIDENCE)

| METRIC | WEBSITE NUMBER (VANGUARD.HTML) | WHITE-PAPER NUMBER | EVIDENCE NUMBER | TEST ENVIRONMENT | STATUS | FINAL APPROVED PUBLIC WORDING |
|--------|-------------------------------|-------------------|-----------------|-----------------|--------|-------------------------------|
| TTFT vs legacy cloud | "5× Faster TTFT" | Not claimed | None found | Unknown | REMOVE_PENDING_EVIDENCE | Remove until evidence exists. Replace with general capability description. |
| Average TTFT | "~40ms avg TTFT" | Not claimed | None found | Unknown | REMOVE_PENDING_EVIDENCE | Remove until evidence exists with methodology, baseline, sample size. |
| Overhead vs frontier API | "97% lower overhead" | Not claimed | None found | Unknown | REMOVE_PENDING_EVIDENCE | Remove until evidence exists. "Frontier API" baseline must be defined. |
| Per-token pricing | "$0.40 per 1K tokens" | Not claimed | None found | N/A (pricing not a benchmark) | REMOVE_PENDING_EVIDENCE | Remove or verify against actual billing. |
| Silicon architecture | "Proprietary Silicon Geometry" | Not claimed | None found | N/A | REMOVE_PENDING_EVIDENCE | Remove unless custom silicon is real and documented. |
| Data retention | "Zero-Retention Hardware Enclave" | Not claimed | None found | N/A | REMOVE_PENDING_EVIDENCE | Remove unless TEE is deployed and documented. Replace with actual retention policy. |

---

## Table 4: Approved Benchmark Claims (Safe to Publish Today)

The following benchmark claims are verified against the evidence package and may be published as-is (with the approved wording from Table 1):

| CLAIM | PAGE | EVIDENCE | APPROVED? |
|-------|------|---------|----------|
| 11.3× correct-task throughput vs full-context | index.html | EVD-001/002 | YES — approved wording in Table 1 |
| 660–820 flat prompt tokens | index.html | EVD-001 | YES — approved wording in Table 1 |
| Hardware independence T4/A10/H200 | index.html | EVD-001/002 | YES — with framing note (avoid bare "100%") |
| +24.4 accuracy points vs RAG | canonical paper only (not yet on main site) | EVD-001 | YES for canonical paper; add to index.html when category positioning copy is updated |

---

## Table 5: Numbers That Require Evidence Before Publication

| METRIC | FOUND ON | STATUS |
|--------|---------|--------|
| 5× TTFT | vanguard.html | REMOVE_PENDING_EVIDENCE |
| ~40ms TTFT | vanguard.html | REMOVE_PENDING_EVIDENCE |
| 97% lower overhead | vanguard.html | REMOVE_PENDING_EVIDENCE |
| $0.40/1K pricing | vanguard.html | REMOVE_PENDING_EVIDENCE |
| 96.0% accuracy | whitepaper.html | REMOVE_PENDING_EVIDENCE (resolved by Stage 7 rebuild) |
| 82.6% RAG accuracy | whitepaper.html | REMOVE_PENDING_EVIDENCE (resolved by Stage 7 rebuild) |
| QPS intermediate saturation data | canonical paper (partial) | PENDING — awaiting Veena data (UER-019) |
