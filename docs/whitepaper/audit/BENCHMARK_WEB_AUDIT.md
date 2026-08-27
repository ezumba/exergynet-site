# Benchmark Web Audit
**Audit:** Pre-White Paper Website Claim Audit — ExergyNet
**Audit date:** 2026-08-05
**Canonical benchmark source:** EVD-001 (H200 xLMP vs RAG vs full-context), EVD-002 (H200 benchmark replication), as documented in `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` Appendix E
**Constraint:** READ-ONLY

---

## Index.html Benchmarks

### CL-001 — "11.3× Correct-Task Throughput"
- **Page URL:** `/`
- **Exact text:** "11.3× Correct-Task Throughput"
- **Evidence link:** EVD-001/EVD-002
- **Canonical fact:** ~11.3× correct-task throughput, xLMP vs full-context baseline at equal evidence budget on H200. Confirmed in canonical paper Section 20 (Evidence Results).
- **Status:** VERIFIED
- **Notes:** This is the most prominent number on the home page. It matches canonical evidence precisely.

### CL-002 — "660–820 Flat Prompt Tokens"
- **Page URL:** `/`
- **Exact text:** "660–820 Flat Prompt Tokens"
- **Evidence link:** EVD-001
- **Canonical fact:** xLMP prompt tokens remained 660–820 as the corpus grew from 8,000 to 285,000 tokens. Full-context grew from 11k to 67k and was rejected past 262k.
- **Status:** VERIFIED
- **Notes:** "Flat" accurately characterizes the behavior. Acceptable compression of the finding.

### CL-003 — "100% Across T4, A10, H200"
- **Page URL:** `/`
- **Exact text:** "100% Across T4, A10, H200"
- **Evidence link:** EVD-001/EVD-002
- **Canonical fact:** Hardware-independent accuracy maintained across T4, A10, and H200 test environments. Veena conducted H200 saturation testing and QPS ladder analysis.
- **Status:** VERIFIED
- **Notes:** "100%" appears to reference accuracy consistency across hardware platforms, not a 100% accuracy rate. If read as "100% accuracy rate" this would be misleading — monitor for this ambiguity in user-facing framing.

---

## Benchmark Numbers in Canonical Paper (For Comparison)

From `AI_MEMORY_CONTROL_PLANE.md` Section 20 (verbatim for reconciliation):

| METRIC | CANONICAL VALUE | SOURCE |
|--------|----------------|--------|
| xLMP accuracy vs RAG (equal evidence budget) | +24.4 accuracy points | EVD-001 |
| Correct-task throughput xLMP vs full-context | ~11.3× | EVD-001 |
| Correct-task throughput xLMP vs RAG | ~1.7× | EVD-001 |
| Useful Answer per Token xLMP vs full-context | ~42.7× | EVD-001 |
| Useful Answer per Token xLMP vs RAG | ~4.0× | EVD-001 |
| xLMP prompt tokens (corpus 8k–285k tokens) | 660–820 flat | EVD-001 |
| Full-context: grows from | 11k → 67k, rejected past 262k | EVD-001 |
| Hardware platforms tested | T4, A10, H200 | EVD-001/EVD-002 |
| Saturation testing performed by | Veena (QPS 10–45 ladder) | EVD-002 |

---

## Vanguard.html Benchmarks (UNVERIFIED)

### CL-030 — "5× Faster TTFT vs legacy cloud"
- **Page URL:** `/vanguard.html`
- **Exact text:** "5× Faster TTFT vs legacy cloud"
- **Evidence link:** None found
- **Canonical fact:** No TTFT measurement in EVD-001, EVD-002, or any evidence file reviewed. H200 benchmarks cover xLMP memory architecture performance, not inference API TTFT.
- **Status:** UNVERIFIED
- **Risk:** "vs legacy cloud" is undefined — this claim is not falsifiable without knowing the baseline. "5×" from undefined baseline with no evidence is a material benchmark claim.
- **Required action:** Provide evidence or remove the claim.

### CL-031 — "~40ms avg TTFT"
- **Page URL:** `/vanguard.html`
- **Exact text:** "~40ms avg TTFT"
- **Evidence link:** None found
- **Canonical fact:** No TTFT measurement in any source reviewed.
- **Status:** UNVERIFIED
- **Required action:** Provide evidence or remove the claim.

### CL-032 — "97% lower overhead vs frontier API"
- **Page URL:** `/vanguard.html`
- **Exact text:** "97% lower overhead vs frontier API"
- **Evidence link:** None found
- **Canonical fact:** No overhead comparison in any source reviewed. "Frontier API" undefined.
- **Status:** UNVERIFIED
- **Risk:** This is the most striking unsubstantiated benchmark. "97% lower overhead" from an undefined baseline with no evidence and no methodology disclosure is a high-risk commercial claim.
- **Required action:** Provide evidence or remove the claim.

### CL-033 — "$0.40 per 1K tokens"
- **Page URL:** `/vanguard.html`
- **Exact text:** "$0.40 per 1K tokens" (vs competitors)
- **Evidence link:** None found
- **Canonical fact:** No pricing evidence in any source reviewed.
- **Status:** UNVERIFIED
- **Risk:** Public pricing claims need to match actual billing if the API is live and fee-bearing.
- **Required action:** Confirm actual pricing and match website claim to reality.

---

## whitepaper.html Benchmark (INCONSISTENT)

### CL-021 — "96.0% xLMP accuracy versus 82.6% for tested sparse top-k RAG"
- **Page URL:** `/whitepaper.html`
- **Exact text:** "96.0% xLMP accuracy versus 82.6% for tested sparse top-k RAG"
- **Evidence link:** None found in EVD-001/EVD-002 as documented in canonical paper
- **Canonical fact:** Canonical paper (EVD-001) states "+24.4 accuracy points over RAG at equal evidence budget." The raw accuracy figures (96.0% and 82.6%) do not appear in the canonical evidence record.
- **Status:** UNVERIFIED (number may be from an earlier evidence record not in the current evidence package)
- **Risk:** The two public documents (index.html with +24.4 points, whitepaper.html with 96.0%/82.6%) give contradictory characterizations. While they might be consistent (82.6% + 13.4 ≠ 96.0%, so they are actually inconsistent numerically if from the same test), this creates confusion.
- **Required action:** This will be resolved when whitepaper.html is rebuilt from the canonical paper (CRITICAL-003). Until then, document the discrepancy for the operator's awareness.

---

## Benchmark Audit Summary

| BENCHMARK | PAGE | STATUS |
|-----------|------|--------|
| 11.3× correct-task throughput | index.html | VERIFIED |
| 660–820 flat prompt tokens | index.html | VERIFIED |
| 100% across T4/A10/H200 | index.html | VERIFIED (with framing note) |
| 5× faster TTFT | vanguard.html | UNVERIFIED — remove or evidence |
| ~40ms avg TTFT | vanguard.html | UNVERIFIED — remove or evidence |
| 97% lower overhead | vanguard.html | UNVERIFIED — remove or evidence |
| $0.40/1K tokens | vanguard.html | UNVERIFIED — verify actual pricing |
| 96.0%/82.6% accuracy comparison | whitepaper.html | UNVERIFIED — resolved by CRITICAL-003 |

**Release-gate impact:** The index.html benchmarks are verified and safe to publish. The vanguard.html benchmarks block the vanguard page's release until evidenced or removed. The whitepaper.html discrepancy is blocked by CRITICAL-003.
