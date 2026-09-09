<!--COVER-->
# Memory Grows. Context Does Not Have To.

### How ExergyNet's xLMP Architecture Decouples Persistent State from Active Inference Across More Than a 300× Corpus Expansion

Seven Ezumba
Author
Chief Architect, ExergyNet

Veena Bontu
Co-author

September 2026

<!--PAGEBREAK-->

## Abstract

The practical challenge in scaling autonomous machine intelligence is not model capability — it is infrastructure. As agents accumulate persistent histories, prior approaches have treated the growth of stored context and the growth of active model-facing inference context as the same problem. They are not.

This paper measures the distinction. Across a nine-scale development campaign from 32K to 4M estimated tokens, followed by a sealed genuine holdout at 10M tokens, xLMP's externalized persistent evidence architecture held active model-facing context (K) bounded between approximately 760 and 910 tokens while the underlying corpus grew by more than 300×. A nine-point ordinary least-squares regression produced a slope of 7.834 × 10⁻⁷ tokens per corpus token (R² = 0.0004; 95% CI includes zero). Corpus growth explains less than 0.1% of the variance in K.

At 10M tokens — an adversarial corpus containing 10,116,589 estimated tokens — a sealed genuine holdout of 190 queries repeated five times (950 total executions) returned mean K = 895.96, median K = 908, and P95 K = 985. All 950 executions returned status = ok. The state-to-active-context ratio — accumulated corpus size divided by mean active inference context — was 10,116,589 / 895.96, approximately 11,291:1. This ratio is derived from the sealed holdout measurements; it is not a compression ratio, a storage ratio, or an assertion that every query accessed every corpus token. Overall retrieval accuracy was 39.5%, triggering a pre-registered quality threshold (Q_BEND). The primary driver was the Q3 temporal-authority class — queries designed against superseded specifications — which scored 12.0% at the adversarial 10M corpus density. Q_BEND identifies the next scaling frontier; it is not system failure.

A parallel resolution-scaling campaign (LNES-84) establishes that retrieval resolution is a separate dimension from context size. Indexed candidate discovery scaled with an exponent α ≈ −0.2183 (CI upper ≈ +0.0206) — consistent with flat or bounded. Morphological query escape to a legacy full-corpus scan drove effective-resolution scaling to α ≈ +0.7712 (strong positive sublinear; the queries were escaping to O(corpus) fallback, not the index). LNES-84.2 V4 closed the morphological escape for the tested query population: morph routing recovered from 6% to 100%, morph fallback from 100% to 0%, with zero regressions on any other query class. The resolution mechanism is O(V) prefix scan; in the tested benchmark, V remained nearly constant because filler vocabulary was suppression-filtered. Vocabulary-diversity scaling — what happens when V grows with corpus diversity — is the next open research frontier.

The infrastructure implication is architectural. At 4M corpus scale, retrieval accounted for approximately 97.8% of per-query wall time. A GPU running inference on the model-facing evidence window was idle for the majority of each query cycle. Externalizing persistent state is not a storage optimization; it is a prerequisite for sustained accelerator utilization as agent corpora grow.

---

## Executive Summary

**The problem.** As machine intelligence becomes persistent, heterogeneous, and numerous, the infrastructure connecting independent intelligences to shared state, evidence, authority, and consequential action becomes the binding constraint — not the quality of any individual model. Better reasoning does not establish authoritative state, does not separate intelligence from authority, and does not account for the resources consumed in doing so.

**The central result.** Across the tested 32K→10M development envelope, active model-facing context did not exhibit a statistically significant positive scaling relationship with corpus size. The 32K→4M nine-point development fit produced b = 7.834 × 10⁻⁷ and R² = 0.0004; extending the development sweep to 10M produced b = 2.79 × 10⁻⁶ and R² = 0.0384. Both 95% confidence intervals include zero. The genuine 10M holdout — a separate sealed experiment — independently returned mean K = 895.96. The state-to-active-context ratio at this scale — accumulated corpus tokens divided by mean active inference tokens — was 10,116,589 / 895.96 ≈ 11,291:1.

**Four headline results (updated):**

| Result | Measured outcome | Tested envelope |
|---|---|---|
| N→K decoupling | Mean K bounded 763–908 as corpus grew 32K→10M (approximately 316×); 9-pt dev regression slope = 7.834×10⁻⁷, R²=0.0004; 10-pt dev regression slope = 2.79×10⁻⁶, R²=0.0384; both CI include zero | Adversarial synthetic corpus; GCP A100 4G (32K–10M dev); genuine holdout: WSL2 runner + NVIDIA NIM on GCP A100 4G |
| Deterministic authority | Rejected a live prompt-injection after the reasoning model complied; reproduced twice; 64 assertions | Live listener, unit-tested |
| State governance | False authoritative commitments fell 8% → 0%; model accuracy held flat at 84% | 100 real procurement cases |
| Physical consequence | False-release held at 0/50 across two independent validation runs vs. 20–34% ungoverned | Sealed synthetic 50-case holdout |

**The architecture.** ExergyNet sits between any reasoning engine and the world it can affect, organized into three coordination planes: Knowledge & State, Coordination & Authority, and Resource & Economic Coordination. The organizing principle is separation: reasoning and authority are never the same mechanism; accumulated state and active inference context are not the same resource.

**The larger implication.** Accelerators should perform intelligence computation. They should not be pressed into service as the persistence and retrieval layer for an agent's accumulated history. The measured evidence shows that at 4M-token adversarial corpus scale, retrieval accounted for approximately 97.8% of per-query wall time. Externalizing the state and retrieval substrate is an architectural prerequisite for sustained GPU utilization as corpora grow.

The architectural shift is denominator control. The conventional scaling response is more context, more memory, or more accelerators. ExergyNet instead measures how little active inference is required to operate over persistent state. At the 10M holdout the measured state-to-active-context ratio was approximately 11,291:1; in the separate H200 workload, changing memory delivery produced approximately 11.3× more correct tasks per minute than full-context replay on the same accelerator.

---

## §1. The Scaling Problem

Artificial intelligence infrastructure is entering a transition that its current substrate was not designed to handle. The first generation of large-model deployment treated intelligence as a stateless function: a prompt arrives, the model returns an output, and nothing persists. That assumption is collapsing.

The dominant deployment stack still couples persistent state growth to increasingly expensive context and retrieval paths.

As autonomous agents accumulate operational histories — memory of prior decisions, evidence of prior actions, state from prior sessions, records of prior authority grants — the cost of that accumulation becomes structural. The question is not whether agents will have persistent state. It is whether that state will be managed inside the inference context, at full prefill cost per operation, or externalized from it.

The distinction matters to GPU architects. In its most recent quarter, NVIDIA reported $89.0 billion in Data Center revenue, up 117% year-over-year, with supply and capacity purchase commitments rising from $119 billion to $279 billion quarter-over-quarter — an increase attributed primarily to the procurement of memory. At the same time, independent technical disclosures from Micron at Hot Chips 2026 reported that compute performance is scaling approximately 3× every two years while high-bandwidth memory capacity is scaling less than 2× over the same period. Compute is outrunning the memory it can access. In that environment, what an agent puts into the active inference window per query is not a software preference — it is a hardware resource allocation.

The governing question this paper measures is: **does accumulated persistent state require proportional growth in active model-facing context?**

The measured answer is no — within the tested envelope.

---

## §2. Persistent Memory ≠ Active Context

The conflation that makes this question seem obvious is the assumption that an agent's persistent history and its active inference context are the same resource. They are not.

**N** (accumulated persistent state) is the full body of evidence, history, and committed state that an agent has accumulated. N can continue to accumulate as an agent operates over time.

**K** (active model-facing context) is the evidence delivered to the model for a specific query. It is bounded by the model's context window and, more immediately, by what the architecture chooses to surface.

A stateless architecture with direct injection (full-context) equates N and K: if N is large, K must be large, or information is dropped. The full-context approach does not scale: context windows have hard limits, prefill cost grows super-linearly, and at the limits of current hardware, injection of large N is rejected entirely. In conventional autoregressive transformer serving, KV-cache memory grows with active sequence length. Persistent state held outside the active sequence does not consume KV-cache capacity merely because historical state has accumulated.

xLMP breaks the N = K identity. The architecture retrieves a bounded, content-verified evidence window from the accumulated state and delivers that window to the model. N grows as the agent accumulates history; K remains bounded by what retrieval selects. Whether this bound holds across large N is an empirical question, not an architectural claim.

This paper reports that measurement.

---

## §3. xLMP Architecture

xLMP is ExergyNet's persistent evidence store: root-addressed, content-verified, and designed for bounded retrieval across large corpora.

**Root addressing.** Each stored evidence chunk is identified by the SHA-256 hash of its content. Retrieval is deterministic over committed state: the same query against the same committed corpus returns the same bounded evidence window. There is no probabilistic similarity-search component in the retrieval path.

**Compound indexing.** A compound inverted index supports direct exact lookup (by term, phrase, or structured identifier), adaptive prefix expansion for morphological query forms, and temporal-authority routing (selecting the most recent authoritative version when multiple versions of a specification exist). These three routing paths are separately instrumented and independently characterized by LNES-84.

**Bounded evidence window.** Retrieval returns at most a configured maximum number of evidence chunks per query, independently of corpus size. The scientific question is whether the model-facing token count (K) remains bounded in practice as N grows, or whether retrieval score distributions shift in ways that cause systematic K growth.

**Determinism.** Because retrieval is content-addressed and routing is deterministic, five repeated executions of the same query over the same committed corpus return identical K values. This property is what enables the holdout repeatability reported in §7.

**Position relative to the model.** xLMP sits between the model and the world it can affect. The reasoning engine is interchangeable — the retrieved evidence window is the same regardless of which model receives it. Replacing the reasoning engine does not require replacing the persistent-state substrate. Cross-model behavioral equivalence on this corpus has not been tested; architectural portability and performance portability are distinct claims.

**Network data movement as a scaling constraint.** Persistent-agent infrastructure also creates a network-level scaling problem. Cisco's 2026 measurement of live AI inference traffic reported that an agentic task can generate up to 450% more total network traffic than an equivalent human-performed task, with approximately 70% of that traffic attributable to AI inference [8]. Cisco has characterized this pattern as a material WAN-capacity concern as agentic systems move from intermittent human-triggered interactions toward continuous machine-speed operation.

The Cisco measurement does not establish that repeated context transmission is the sole cause of the observed traffic multiplier. Agentic workflows can generate additional traffic through iterative reasoning, tool invocation, retrieval, inter-agent communication, and repeated model calls. However, repeated transmission of accumulated context is one architectural source of avoidable data movement in systems that reconstruct state inside the inference request.

xLMP addresses that specific component by separating persistent state from the bounded evidence presented to the reasoning engine. Persistent corpus size is represented as N; the model-facing evidence presented for a query is E(q), with token count K. The LNES-82C campaign measured this separation directly. At the 10,116,589-token genuine holdout, mean model-facing context was 895.96 tokens, with a median of 908 and P95 of 985, while all 950 executions completed successfully.

Across the tested 32K-to-10M envelope, accumulated corpus growth did not produce a detected material positive scaling of mean active model-facing context. The nine-point 32K-to-4M regression slope was 7.834 × 10⁻⁷, statistically indistinguishable from zero, and the 10M holdout remained within approximately 12 tokens of the 32K mean despite a corpus more than 300 times larger.

This result establishes a bounded model-facing evidence property, not a measured network-bandwidth reduction. Its network implication is architectural: a system that resolves persistent state before inference can transmit the evidence required for the current reasoning operation rather than requiring the persistent corpus itself to become the active inference payload. Direct measurement of end-to-end network-byte reduction under xLMP remains a separate validation target.

---

## §4. Experimental Methodology

**Corpus construction.** The LNES-82C campaign used an adversarial synthetic corpus constructed to stress temporal-authority resolution. The corpus contains four distinct quadrant types corresponding to the four query classes:

- Q1 chunks: single-fact records with stable, unambiguous content
- Q2 chunks: multi-fact records requiring synthesis across several sources
- Q3 chunks: temporal-authority records including superseded specifications, rejected revisions, conflicting dates, and withdrawn documents (approximately 1,000,000 tokens at 10M scale)
- Q4 chunks: adversarially ambiguous records designed to confuse attribution

Filler content was added at each scale point to expand corpus size while maintaining the same signal structure.

**Harness.** A single frozen harness version executed all runs from 32K through 10M. The harness SHA is c5b7849d...17a1 (verified at runner startup before every run). Query execution is deterministic: the harness initializes from a fixed random seed (seed = 42), constructs the corpus, and runs the query set.

**Query set.** The holdout query set was sealed before any holdout execution began. Sealed holdout query SHA: 341acf7d...966. The holdout is distinct from the development query population used during the scaling campaign; the two sets were never mixed.

**Determinism verification.** At each holdout scale (4M and 10M), five shuffled-order repetitions of the full 190-query holdout set were executed. Zero per-query K mismatches were observed across runs. The five runs are deterministic repetitions; they are not five independent accuracy samples.

**Model.** All runs used nvidia/nemotron-3-nano-omni-30b-a3b-reasoning. The same model was used from 32K through 10M.

**Hardware.** Development ladder (32K through 4M holdout): GCP a2-highgpu-4g, 4× A100-SXM4-40GB. 10M development sweep (EVIDENCE_SEAL_LNES82C10M.md): GCP a2-highgpu-4g, 4× A100-SXM4-40GB — same hardware as the development ladder. The 10-point regression therefore uses consistent A100 hardware across all 10 corpus scales. 10M genuine holdout (EVIDENCE_SEAL_LNES82C10M_HOLDOUT.md): retrieval and query-runner on WSL2 Ubuntu on Windows; inference endpoint NVIDIA NIM on GCP a2-highgpu-4g, 4× A100-SXM4-40GB, connected via SSH tunnel. Hardware confound: the retrieval environment differs from the 4M A100 runs; retrieval latency ratios between the two holdouts are not evidence-grade. K and model-facing measurements are comparable — same model (nvidia/nemotron-3-nano-omni-30b-a3b-reasoning served via NIM endpoint), same frozen harness.

---

## §5. N→K Scaling: 32K to 10M Tokens

The development campaign measured mean K at nine corpus scales from 32K to 4M estimated tokens. The 10M holdout adds a tenth measurement point, sealed separately.

**Development ladder (32K–4M):**

| N (est. tokens) | Mean K | Accuracy | Source / execution environment |
|---|---|---|---|
| 32,000 | 907.95 | 45.3% | Dev (GCP A100 4G) |
| 64,000 | 876.91 | 40.0% | Dev (GCP A100 4G) |
| 128,000 | 817.27 | 45.8% | Dev (GCP A100 4G) |
| 285,000 | 878.81 | 40.5% | Dev (GCP A100 4G) |
| 384,000 | 897.91 | 41.6% | Dev (GCP A100 4G) |
| 500,000 | 877.66 | 40.0% | Dev (GCP A100 4G) |
| 1,000,000 | 763.86 | 42.6% | Dev (GCP A100 4G) |
| 2,000,000 | 816.47 | 45.3% | Dev (GCP A100 4G) |
| 4,000,000 | 901.65 | 46.3% | Dev (GCP A100 4G) |
| 10,000,000 (est.) | 897 | 41.1% (Q_WARN) | Dev sweep (GCP A100 4G) — used in 10-pt regression |
| **10,116,589** | **895.96** | **39.5% (Q_BEND)** | **Genuine holdout — WSL2 runner; NVIDIA NIM on GCP A100 4G** |

The K trajectory is non-monotonic. The 1M scale produced the global minimum (763.86). Recovery through 2M (+52.61) and 4M (+85.18) restored K near the 32K baseline. At 10M holdout, K = 895.96 — approximately 12 tokens below the 32K value despite a corpus approximately 316× larger. The state-to-active-context ratio at this measurement — accumulated corpus tokens divided by mean active inference tokens — was 10,116,589 / 895.96 ≈ 11,291:1. This is a derived quantity from the sealed holdout measurements; it is not a compression ratio, a storage ratio, or an assertion that every query accessed every corpus token.

![Figure 1: N→K development ladder](figures/fig1_nk_ladder.png)

*Figure 1: N→K scale points. Development sweep (32K–10M, inclusive of 10M dev point), 4M holdout, and 10M genuine holdout shown with distinct markers. Mean K remained approximately 763–908 tokens across the scale points shown. Regression lines fit to development data only; holdout points not included in regression fits. All data points MEASURED from sealed evidence artifacts.*

**Nine-point regression (32K–4M development runs):**

```
b (slope)   = 7.834 × 10⁻⁷ tokens / corpus token
SE(b)       = 1.423 × 10⁻⁵
t statistic = 0.055
t_crit(α=0.05, df=7) = ±2.365
R²          = 0.0004
95% CI      = [−3.287 × 10⁻⁵, +3.444 × 10⁻⁵]  — includes zero
RMSE        = 52.61 tokens
Intercept   = 859.10 tokens
```

Corpus growth from 32K to 4M explains 0.04% of the variance in K. The slope is not statistically distinguishable from zero.

**Ten-point development regression (32K–10M dev sweep):**

```
b (slope)   = 2.79 × 10⁻⁶ tokens / corpus token
R²          = 0.0384
95% CI      = [−8.59 × 10⁻⁶, +1.42 × 10⁻⁵]  — includes zero
Source      : EVIDENCE_SEAL_LNES82C10M.md (dev sweep; 7/7 raw artifacts GCS-verified 2026-09-03; seal document pending operator upload)
10M dev data point: N=10,000,000 est., mean K=897, acc=41.1% (Q_WARN), GCP A100 hardware
```

Extending to the 10M development sweep raises the slope to 2.79 × 10⁻⁶ tokens per corpus token (R² = 0.0384), but the 95% confidence interval continues to include zero. Corpus growth explains 3.84% of K variance across the full 32K–10M development range. The slope is not statistically distinguishable from zero. The 10M development sweep accuracy (41.1%) is Q_WARN — above the 40% Q_BEND boundary. Q_BEND was triggered only by the separate genuine holdout experiment (39.5%).

**The 10M development sweep is a separate artifact from the 10M genuine holdout.** EVIDENCE_SEAL_LNES82C10M.md (dev) uses a different query population from EVIDENCE_SEAL_LNES82C10M_HOLDOUT.md (genuine holdout). Never conflate development and holdout figures.

**Non-monotonic trajectory and the 1M trough.** The K trajectory is non-monotonic. The 1M scale produced the global minimum (763.86), followed by statistically detectable recovery at 2M (+52.61 tokens) and 4M (+85.18 tokens). The trajectory is a real empirical signal, not a system artifact. The mechanism that produces the trough has not been isolated in the evidence.

---

## §6. The 4M Holdout: Decoupling Confirmed

The 4M holdout was executed as five shuffled repetitions of the sealed 190-query set (950 total executions) against the 4M corpus (SHA: 3e761a6d..., 12,545,402 chars, 4,046,904 estimated tokens) on GCP A100 hardware.

**Results:**

| Metric | Value |
|---|---|
| Mean K | 902.81 |
| Median K | 925 |
| P95 K | 972 |
| Overall accuracy | 45.3% |
| Executions (status = ok) | 950 / 950 |
| Per-query K mismatches (5 runs) | 0 |

**Gate outcomes:** GATE 1 (K ≤ 950): PASS. GATE 2 (accuracy ≥ 40%): PASS — no Q_BEND at 4M. GATE 3 (retrieval P50 ≤ 50s): PASS.

At 4M, all quality gates cleared. The 4M holdout establishes the upper end of the confirmed decoupling envelope before Q_BEND is triggered.

**GPU workload economics at 4M.** GPU telemetry from the 4M sealed run (EVIDENCE_SEAL_LNES82C4M.md; 10,680 telemetry samples; GCS 3-way PASS) directly established the workload composition: retrieval P50 ≈ 19.8 seconds; model E2E P50 ≈ 0.44 seconds; retrieval share of per-query wall time ≈ 97.8%. Across 10,680 GPU utilization samples: mean 2.0%, median 0.0%, peak 100.0%. The GPU could fully saturate during inference bursts — measured peak was 100%. Median utilization was zero because the accelerator was idle for the majority of each query cycle while the CPU completed the retrieval scan. At 4M corpus scale, the workload had inverted: retrieval-dominated, not inference-dominated.

![Figure 2: 4M vs 10M holdout comparison](figures/fig2_holdout_comparison.png)

*Figure 2: 4M vs 10M genuine holdout — K and accuracy [MEASURED]. Retrieval environments differ (4M: GCP A100 4G; 10M: WSL2 runner + NVIDIA NIM on GCP A100 4G); retrieval wall-time ratios are not evidence-grade cross-environment.*

---

## §7. The 10M Genuine Holdout

The 10M genuine holdout is a separate sealed artifact from the 10M development sweep. These must not be conflated.

**10M development sweep:** Separate query population; separate evidence seal (EVIDENCE_SEAL_LNES82C10M.md); not reported as the canonical accuracy result.

**10M genuine holdout** (canonical; EVIDENCE_SEAL_LNES82C10M_HOLDOUT.md, sealed 2026-09-04):

| Metric | Value |
|---|---|
| Corpus (estimated tokens) | 10,116,589 |
| Corpus (characters) | 31,361,425 |
| Corpus SHA-256 | 1d3d0ab7ce6b42e2f2dc9aa6c57c50a6292ae7da93dc6d275bf0cf1277fcee03 |
| Holdout queries SHA-256 | 341acf7d5a82018ea1c1080cce4d8d9c060d70a361fe019299bfa63eea1ec966 |
| Harness SHA-256 | c5b7849d2906b200554a345ae3fa11adfd2ccd63b2b2e49120d6982f0e4d17a1 |
| Runs | 5 (shuffled-order repetitions) |
| Total executions | 950 (5 × 190 queries) |
| Executions returning status = ok | 950 / 950 |
| Per-query K mismatches (5 runs) | 0 |
| Mean K | 895.96 |
| Median K | 908 |
| P95 K | 985 |
| Overall accuracy | 39.5% (75 / 190 unique correct) |

**Derived quantity:** State-to-active-context ratio (N / mean K) = 10,116,589 / 895.96 ≈ **11,291:1.** Derived from the sealed holdout measurements above; not a compression ratio, storage ratio, or assertion that every query accessed every corpus token.

**Gate outcomes:**

| Gate | Threshold | Value | Outcome |
|---|---|---|---|
| GATE 1 (K ≤ 950) | ≤ 950 | 895.96 | PASS — K_FLAT_OR_STABLE |
| GATE 2 (accuracy) | ≥ 43% PASS / ≥ 40% WARN / < 40% BEND | 39.5% | **Q_BEND FORMALLY TRIGGERED** (0.5 pp below floor) |
| GATE 3 (retrieval P50 ≤ 50s) | ≤ 50 s | 18.7 s | PASS — but **RETRIEVAL ENVIRONMENT CONFOUNDED** (10M: WSL2 runner; 4M: GCP A100 4G; latency ratio not evidence-grade) |

**Q-class decomposition at 10M:**

| Class | n | Accuracy | Notes |
|---|---|---|---|
| Q1 — single-fact lookup | 500 | 43.0% | Stable; at PASS threshold |
| Q2 — multi-evidence synthesis | 200 | 62.5% | Strong; synthesis performs well at 10M |
| Q3 — temporal authority | 125 | 12.0% | Primary Q_BEND driver |
| Q4 — adversarial ambiguity | 125 | 16.0% | Consistent with adversarial design |

![Figure 3: 10M Q-class decomposition](figures/fig3_qclass_breakdown.png)

*Figure 3: 10M holdout Q-class decomposition [MEASURED]. All 950 executions returned status=ok. Q_BEND triggered at 39.5% overall; Q3 temporal-authority class (12.0%) is the primary driver.*

**GCS verification:** Sealed evidence uploaded to gs://xlmp-evidence-lnes82c5k/lnes82c10m_holdout/; 3-way SHA chain (VM = local = GCS) verified.

---

## §8. The xLMP Scaling Law

The evidence from §5–§7 supports a formal statement:

**Within the tested LNES-82C envelope (32K to 10,116,589 estimated tokens, adversarial synthetic corpus, frozen harness, nvidia/nemotron-3-nano-omni-30b-a3b-reasoning), accumulated corpus size (N) and active model-facing context per query (K) are materially decoupled.**

More precisely:

- N grew from 32,000 to 10,116,589 estimated tokens — a factor of approximately 316×.
- K remained bounded between 763.86 (1M minimum) and 907.95 (32K maximum) — a 145-token range.
- The nine-point OLS regression slope (32K–4M development) is 7.834 × 10⁻⁷ tokens per corpus token (t = 0.055, p >> 0.05, R² = 0.0004, 95% CI includes zero).
- The ten-point OLS regression slope (32K–10M development) is 2.79 × 10⁻⁶ tokens per corpus token (R² = 0.0384, 95% CI [−8.59 × 10⁻⁶, +1.42 × 10⁻⁵] includes zero). Both slopes are statistically indistinguishable from zero within the tested development envelope.
- At 10M tokens, the genuine holdout mean K (895.96) is within 12 tokens of the 32K value (907.95).

**The architectural interpretation.** This decoupling is not a scaling law derived by extrapolation. It is a measured property of the tested architecture: because retrieval is content-addressed and the evidence window is bounded by construction, the model received a bounded evidence set across the tested corpus sizes. Whether N grew 10× or 300×, K was determined by retrieval relevance within the bounded window, not by corpus cardinality.

**Boundary.** This result holds within the tested envelope. Behavior at corpus scales beyond 10M, with different corpus distributions, different query populations, or different hardware environments, is untested and requires further measurement.

The architectural shift is denominator control. The conventional scaling response is more context, more memory, or more accelerators. ExergyNet instead measures how little active inference is required to operate over persistent state. At the 10M holdout the measured state-to-active-context ratio was approximately 11,291:1; in the separate H200 workload, changing memory delivery produced approximately 11.3× more correct tasks per minute than full-context replay on the same accelerator.

---

## §9. Q_BEND and the Quality Frontier

**Q_BEND formally triggered at 39.5% accuracy while 950/950 executions completed successfully.**

Q_BEND is a pre-registered quality threshold. When overall holdout accuracy falls below 40.0%, Q_BEND is triggered. At 10M, accuracy was 39.5% — 0.5 percentage points below the floor.

**What Q_BEND is not:**

- Q_BEND is not infrastructure failure. The system returned status = ok for 950 of 950 queries.
- Q_BEND is not a crash or timeout. Every query completed.
- Q_BEND is not evidence that K must grow. K = 895.96 at 10M — well within the flat envelope.
- Q_BEND is not evidence that the model failed in general. Q2 (synthesis) scored 62.5% at 10M.

**What Q_BEND is:** A characterized retrieval-quality degradation under adversarial temporal-authority density. At 10M tokens, the Q3 quadrant contains approximately 1,000,000 tokens of superseded specifications, rejected revisions, and conflicting date records — adversarially constructed to stress temporal-authority selection. The retrieval system must distinguish the authoritative version of a specification from its superseded predecessors. At 10M-token adversarial density, that distinction breaks down for the Q3 class.

**The Q_BEND signal points to the next frontier:** temporal-authority resolution, not context-window capacity or infrastructure reliability. The correct response to Q_BEND is not a larger context window — the context window (K ≈ 896 tokens) is not the binding constraint. The correct response is improved temporal-authority indexing and resolution logic.

**Comparison across scales:**

| Scale | Accuracy | Q_BEND status |
|---|---|---|
| 4M dev | 46.3% | NO Q_BEND |
| 4M holdout | 45.3% | NO Q_BEND |
| 10M holdout | 39.5% | **Q_BEND TRIGGERED** |

The 4M holdout cleared all quality gates. Q_BEND first appears at 10M.

---

## §10. Resolution as a Separate Scaling Problem

The LNES-82C campaign measured N → K. A parallel resolution campaign (LNES-84) measured N → R, where R is the cost of retrieval and resolution.

These are distinct scaling dimensions. The N → K decoupling says that K does not have to grow with N. It does not say that retrieval cost does not grow with N. Retrieval cost is a separate question, with a separate answer.

**Measured N → R relationship (4M holdout, A100 hardware):** Retrieval cost scaled approximately linearly with N across the development ladder. The ratio from 2M to 4M was approximately 1.752× (APPROX_LINEAR classification). This linear scaling is an architectural concern: as N grows, the CPU-bound linear scan becomes the dominant cost, regardless of K.

**The three-path retrieval architecture (LNES-84):**

1. **Indexed candidate discovery:** Direct inverted-index lookup. Indexed-discovery α ≈ −0.2183 (95% CI upper ≈ +0.0206); no detected positive scaling within the tested envelope. This is the fast path.
2. **Adaptive prefix expansion (morph path):** Vocabulary-based prefix scan for morphological query forms. Costs O(V) where V is the indexed vocabulary. In V4, V remained nearly constant (~430 terms) because filler vocabulary was DF-suppressed. This path was closed for the tested query class by LNES-84.2 V4.
3. **Legacy fallback:** Full-corpus scan when neither indexed nor morph path resolves. O(corpus). This is what produced the α ≈ +0.7712 effective-resolution exponent in V3 (LNES-84.1 diagnostic).

The goal of the LNES-84 campaign is to route all queries through Path 1 or Path 2, eliminating Path 3 for the characterized query classes.

---

## §11. LNES-84.1: The Escape Boundary

**Corpus:** 32 MB to 512 MB, 18,642 to 298,262 indexed chunks, across eight scale points.

LNES-84.1 measured two distinct scaling exponents for the same query population:

**Indexed-discovery α (Path 1):**

```
α_indexed_discovery ≈ −0.2183
CI upper            ≈ +0.0206
Gate threshold      : α < 0.15
Gate outcome        : ALPHA_GATE PASS
```

The indexed path showed no detected positive scaling within the tested envelope. The 95% CI upper bound (≈ +0.0206) is consistent with flat or bounded behavior. This is the intended scaling property.

**Effective-resolution P95 α (Path 1 + Path 2 + Path 3 weighted):**

```
α_selective_effective_P95 ≈ +0.7712
CI upper                  ≈ +1.117
```

The effective-resolution exponent is 0.7712 — strong positive **sublinear** power-law scaling (α ∈ (0, 1) is sublinear; α > 1 would be super-linear). When corpus doubles, effective-resolution latency grows approximately 2^0.7712 ≈ 1.71×. That is expensive but not super-linear.

**The diagnostic finding:** 50 of 50 morphological queries in the V3 benchmark escaped to Path 3 (legacy full-corpus scan). The morph fallback rate was 1.00. This single failure mode drove the effective-resolution exponent from near-zero (indexed) to +0.7712 (blended). The indexed path was working correctly; the morphological queries were not reaching it.

This diagnostic result motivated LNES-84.2.

**Note on ERRATA_002:** An earlier errata document incorrectly described α = 0.771 as "super-linearly." Corrected description: "strong positive sublinear power-law scaling." α < 1 is always sublinear. The numerical values are unchanged.

![Figure 4: LNES-84.1 escape boundary](figures/fig4_lnes84_1_escape.png)

*Figure 4: LNES-84.1 resolution escape boundary (log-log) [MEASURED]. Indexed discovery: α ≈ −0.2183, 95% CI upper ≈ +0.0206 — no detected positive scaling within the tested envelope. Effective-resolution P95: α ≈ +0.7712, strong positive sublinear power-law scaling (not super-linear — ERRATA_002 correction applied). 100% morph fallback in V3 drove the blended exponent from near-zero to +0.77.*

---

## §12. LNES-84.2: Closing the Morphological Escape

LNES-84.2 V4 introduced prefix-based morphological expansion into the retrieval path, allowing morphological query forms to resolve through Path 2 (indexed prefix expansion) rather than escaping to Path 3 (full-corpus fallback).

**Evidence:** Sealed 2026-09-06. Engine SHA: ECB9DC3B... Evidence seal SHA: ABD1AE9C...

**Results across 5 corpus scales (18,642→298,262 chunks):**

| Metric | V3 | V4 | Corpus range |
|---|---|---|---|
| Morph routing accuracy | 6% (3/50) | **100% (50/50)** | 32 MB → 512 MB |
| Morph fallback rate | 1.00 | **0.00** | All 5 scales |
| Selective fallback rate | 0.25 | **0.00** | Selective queries |
| All-query fallback rate | 0.375 | 0.1667 (common + missing only) | All 240 queries |
| Exact-routing regressions | — | **0** | All 5 scales |
| Protected-literal regressions | — | **0** | All 5 scales |
| Integrity tests (I1–I5) | PASS | PASS | All 5 scales |
| Integrity false accepts | 0 | **0** | All 5 scales |
| Cap saturation events | — | **0** | All 5 scales |
| Candidates before cap | — | **1.0 (all scales)** | All 5 scales |
| Vocab entries examined | — | ~428 → ~430 | All 5 scales |

![Figure 5: LNES-84.2 before/after](figures/fig5_lnes84_2_before_after.png)

*Figure 5: LNES-84.2 morphological escape closure [MEASURED]. Morph routing 6%→100%, morph fallback 100%→0%. Engine diff classified INSTRUMENTATION-ONLY; zero regressions on any other query class.*

**Required scope statement:** The morph escape boundary was closed for the tested query population. The resolution mechanism is O(V) prefix scan. In the V4 benchmark, V remained nearly constant (214 → 215 terms via filler suppression, then 428 → 430 terms in the instrumented run) because the filler content contributed only DF-suppressed tokens. The O(V) cost of prefix expansion was therefore constant within V4.

**What this does not establish:**

- It does not establish O(1) retrieval for arbitrary vocabulary.
- It does not characterize V → R scaling when vocabulary grows with corpus diversity.
- It does not apply to query populations with different morphological structure.
- V4's vocabulary was scale-invariant within the tested benchmark; vocabulary-diversity scaling is a separate, open research question.

**LNES-84.3** (pre-design prepared; not executed) will measure what happens when V grows proportionally with N — the worst-case scenario for the prefix scan. It is future work and not evidence for the claims in this paper.

**Engine diff classification.** The V4 benchmark engine (ECB9DC3B) differs from the local-validation snapshot (8B90D3A5) by exactly five added lines: two new dataclass fields (vocab_size, vocab_entries_examined) and three assignment statements in the query method. No routing logic, scoring, or gating was changed. Classification: INSTRUMENTATION-ONLY. Parity status: CONFIRMED.

---

## §13. Accelerator Economics and the H200 Efficiency Baseline

ExergyNet's accelerator-economics argument has two components: a direct efficiency measurement (H200 workload) and a structural workload-composition observation (LNES-82C 4M telemetry).

### 13.1 H200 Memory Efficiency Baseline

On a single NVIDIA H200 with a Nemotron-class model over a synthetic corpus (Evidence Artifact EVD-001, SHA 7005fa07..., independently recomputed), xLMP held prompt tokens approximately flat across the full corpus expansion:

| Metric | Value | Source |
|---|---|---|
| Active prompt-token range | ~660–820 tokens | EVD-001, MEASURED |
| Corpus range | 8,000 → 285,000 tokens | EVD-001, MEASURED |
| Full-context token range | 11,000 → 67,000 tokens | EVD-001, MEASURED |
| Full-context rejection boundary | Past 262,000 tokens | EVD-001, MEASURED |
| xLMP accuracy vs tested RAG baseline | 92.4% vs 68.0% (+24.4 pp) | EVD-001, MEASURED |
| Correct-task throughput vs full-context | ~11.3× | EVD-001, MEASURED |

The H200 result establishes the efficiency baseline for the tested memory workload. The N→K campaign extends the envelope: xLMP maintained a comparable K range (895.96 mean at 10M) across a corpus 35× larger than the maximum tested in the H200 experiment.

The H200 result and the N→K scaling result tell the same story from opposite directions. H200: as corpus grows to 285K, K stays flat and full-context is rejected past 262K tokens. N→K: as corpus grows to 10M, xLMP continues to operate with bounded model-facing context.

### 13.2 GPU Workload Composition at Scale

The LNES-82C 4M campaign produced GPU utilization telemetry (EVIDENCE_SEAL_LNES82C4M.md; 10,680 telemetry samples; GCS 3-way PASS) that directly characterizes the workload:

| Metric | Measured value |
|---|---|
| Retrieval P50 | ≈ 19.8 seconds |
| Model E2E P50 | ≈ 0.44 seconds |
| Retrieval share of per-query wall time | ≈ 97.8% |
| GPU utilization — mean | 2.0% |
| GPU utilization — median | 0.0% |
| GPU utilization — peak | 100.0% |
| Telemetry sample count | 10,680 |

**The GPU was capable of full saturation.** Peak utilization reached 100% during inference bursts. Median utilization was zero. At 4M corpus scale, median retrieval time was approximately 45× longer than median model execution time. The GPU was not the bottleneck; the retrieval substrate was.

**The architectural statement this supports:** The 4M workload was retrieval-dominated, not inference-dominated. Between inference calls — each processing approximately 900 tokens in under 500 milliseconds — the accelerator was idle while the CPU performed the retrieval scan. The GPU had the compute capacity. The workload structure prevented it from being used.

This is not a criticism of the retrieval implementation — linear scan cost is known and is exactly what LNES-84 addresses. It is a workload observation: as persistent-state corpora grow into the millions of tokens, retrieval becomes the binding constraint on accelerator utilization.

**The architectural implication for accelerator design:** Accelerators should perform intelligence computation. A retrieval substrate that shows no detected positive scaling within the tested envelope (LNES-84.1 indexed path, α ≈ −0.2183; CI upper ≈ +0.0206) leaves the accelerator free to do what it does efficiently. A retrieval substrate that scales linearly inverts the workload composition at scale — not because the GPU is slow, but because it cannot consume evidence faster than retrieval can supply it.

The ExergyNet architecture externalizes the retrieval substrate from the inference path. The N→K result shows that this externalization holds K flat across more than 300× corpus growth. The 4M telemetry shows why that matters: once context is bounded, accelerator utilization becomes the next optimization target.

![Figure 6: 4M workload composition](figures/fig6_workload_composition.png)

*Figure 6: 4M corpus workload composition (GCP A100 4G) [MEASURED]. Source: EVIDENCE_SEAL_LNES82C4M.md, GPU telemetry section; 10,680 samples. Left: per-query wall time split (~97.8% retrieval / ~2.2% inference). Right: GPU utilization distribution (mean 2.0%, median 0.0%, peak 100.0%).*

### 13.3 Cross-Accelerator Throughput Portability

A separate controlled experiment (internal designation LNES-82C.R6) tested whether xLMP's throughput advantage over full-context serving reproduces on a second accelerator family, using the same pinned workload and treatment across both platforms: `Qwen2.5-7B-Instruct` (BF16), a ~20,000-token synthetic corpus, and a 100-question population, run on an NVIDIA A100 (`a2-highgpu-1g`) and a Google TPU v6e (`v2-alpha-tpuv6e`) at concurrency levels C=1, 2, and 4. All twelve scored cells completed with zero errors and zero timeouts.

Define `CTT = tasks_per_min × accuracy` (correct completed tasks per elapsed minute), `S_platform = CTT_xLMP / CTT_FULL` (xLMP's within-accelerator throughput ratio over full-context replay), and `R = S_TPU / S_A100`. **R is a ratio-of-ratios: it measures how much of xLMP's own advantage over full-context on A100 is retained on TPU. R is not a raw TPU-vs-A100 throughput comparison.**

| C | S_A100 | S_TPU | R = S_TPU / S_A100 |
|---|---|---|---|
| 1 | 1.6897 | 1.6039 | 0.9492 |
| 2 | 1.8827 | 1.6917 | 0.8985 |
| 4 | 2.2597 | 1.9337 | 0.8557 |

Errors and timeouts were zero across all twelve cells. Full-context accuracy was 100% on both A100 and TPU at every concurrency; xLMP accuracy held in a 96.77%–97.10% band on both platforms, with no accelerator-correlated trend.

This experiment tests hypothesis H82 (`TPU_v5e_DEPLOYMENT_BLUEPRINT.md`), whose preregistered directional criterion is `S_TPU > 1` at any magnitude — falsified only by `S_TPU ≤ 1`, and not requiring any specific cross-accelerator magnitude match. R6 measured `S_TPU = 1.6039, 1.6917, 1.9337` at C=1, 2, 4 — all above 1. **R6 satisfies H82's preregistered directional criterion for the substituted workload.** The reference accelerator (H200→A100) and the model (originally planned as Llama-3-8B or Gemma, standing in for the H200 benchmark's own Nemotron-omni model → Qwen2.5-7B-Instruct as actually run) both changed from the original preregistration, driven by a disclosed TPU-runtime-support blocker on the original model.

**Non-merge statement.** R6's A100-vs-TPU-v6e throughput-portability ratios (Qwen2.5-7B-Instruct workload) and this paper's own H200 throughput result (WP-C003a, §13.1: ~11.3× correct-task throughput vs. full-context) must never be averaged, blended, multiplied, or presented as one continuous benchmark. Different model, different workload, different NVIDIA hardware tier.

Provenance, precisely scoped: same pinned workload and treatment across R6 platforms; execution schedule independently hash-verified; raw results independently recomputed. AMD/ROCm portability remains untested. 10M-scale N→K portability to TPU remains untested — this experiment tested throughput portability only, not the corpus-scaling curve.

---

## §14. State → Resolution → Intelligence → Authority → Execution

The N→K scaling result is the empirical foundation. The ExergyNet architecture is the structural argument that builds on it.

**The five-layer stack:**

```
STATE           xLMP / Exergy Vault / VMN
                Temporal Authority / Edge Witness

RESOLUTION      Compound Index / Adaptive Routing (LNES-84)
                Morph Expansion / Fallback Elimination

INTELLIGENCE    Vanguard / Model Adapters / AgentPool
                Reasoning Engine (interchangeable)

AUTHORITY       LNES-22 Consequence Boundary
                xISA Capability Taxonomy (106/106 validated)
                Policy Gate (shadow mode; evaluates every decision)

EXECUTION       Omega / MMS / Authorized Digital or Physical Consequence
```

**The canonical law:** STATE persists. INTELLIGENCE computes. AUTHORITY decides. EXECUTION obeys.

**Three coordination planes:**

- **Plane I — Knowledge & State.** What exists, what happened, and what is currently authoritative. xLMP provides the evidence substrate. Temporal Authority provides version-aware authority routing. Edge Witness provides device-attested physical observation.

- **Plane II — Coordination & Authority.** Who may interact with what, under what constraints. Machine identity, the xISA capability vocabulary, Vanguard model routing, the LNES-22 Consequence Boundary, and AERIS external-evidence acquisition.

- **Plane III — Resource & Economic Coordination.** What was consumed, authorized, and settled. RHO resource accounting (measured cost basis, not market price), Omega execution authorization, and MMS settlement (500 RHO settled on Base Sepolia testnet; all replay attempts reverted).

**Seven predicates that must remain permanently separate:**

1. Memory evidence is not execution authority.
2. Model identity is not agent identity.
3. Agent identity is not economic authority.
4. Economic authority is not consequence authority.
5. Resource accounting is not market value.
6. Capability definition is not capability enforcement.
7. Reasoning compliance is not authorization.

Predicate 7 is the one the measured evidence directly supports: §§4–9 show that a model processing a bounded evidence window does not, by that fact, have authority over what it retrieves or acts upon. The authority layer is separate and deterministic.

**Authority validation result.** ExergyNet sent a live prompt-injection payload to a running authority-review listener. The reasoning model partially complied — returning an approval without flagging the injection despite its own instructions. The deterministic validation layer rejected the request outright before any signed review could be produced. No credential was exposed at any point; key material is structurally excluded from what reaches the model. The attack was reproduced after a logging fix, with rejection producing a durable signed record. **A reasoning model can fail adversarially without the authority system failing with it.**

**State governance.** Over 100 real procurement decision cases, the state-governance mechanism reduced false authoritative-state commitments from 8% to 0% while model judgment accuracy held flat at 84%. The substrate prevented unresolved evidence from being promoted into an authoritative record.

---

## §15. Consequence-Active Intelligence and Physical AI

The distinction between intelligence and authority is a software concern for digital agents. It becomes a physical-law concern when the agent controls machines with real consequences.

**The three-tier consequence ladder:**

```
Digital AI:
  wrong answer → bad information

Agentic AI:
  wrong action → bad transaction

Physical AI:
  wrong action → physical consequence
```

At the physical boundary, the separation between intelligence and authority cannot be treated as an implementation preference. Authority decisions must be evaluated deterministically, independent of whether the reasoning model that proposed them can be trusted.

### 15.1 The ExergyNet Aviation Pre-Flight Gate

A heavy-lift uncrewed aircraft program provides the tested consequence-active environment. The authorization gate produces exactly three terminal states — release-eligible, hold, or incomplete — as an additional safety layer, deferring final authority to its own separate policy evaluation.

Across two independent validation runs — a deterministic rule-based simulator and, separately, a real reasoning model — the governed gate held false-release at 0 of 50 cases on a sealed synthetic test set. The same cases evaluated against ungoverned raw telemetry produced false-release rates of 20–34%.

**Validation scope:** Synthetic sealed holdout; no real aircraft or sensor hardware was involved. This result demonstrates the architectural principle — authority-separated evaluation — not a flight-system certification.

### 15.2 The KTX Regulatory Record: A Physical AI Precedent

ExergyNet's authority architecture is not an abstraction developed solely for software agents. Its design lineage extends into consequence-active physical systems.

In December 2025, Kunfirm Innovative Services LLC (KTX) posted a petition to the Federal Aviation Administration describing the operating and safety architecture for its VSG-HL-01 heavy-lift autonomous aircraft. The petition and accompanying operating documents described the aircraft's distributed flight-control architecture — including Neuro-Lock distributed edge stabilization, bounded operating envelopes, automated contingency behavior, independent termination authority, geofence constraints, automated lost-link behavior, and hard physical failsafes.

On July 15, 2026, the FAA granted KTX Exemption No. 26214 (Regulatory Docket FAA-2025-5731), authorizing KTX to conduct VSG HL 01 "Bolt" UAS lift operations, evaluate, test, and demonstrate the system to others. The VSG HL 01 "Bolt" is a vertical takeoff and landing (VTOL) unmanned aircraft with a maximum takeoff weight not to exceed 275 pounds.

**The FAA's substantive findings, stated precisely:**

*On airworthiness:* "In accordance with the statutory criteria provided in § 44807, and in consideration of the size, weight, speed, and operational capability, proximity to airports and populated areas, and specific operations, a determination has been made that the aircraft does not create a hazard to users of the National Airspace System (NAS) or the public." (Exemption No. 26214, p. 2)

*On the operating model:* The FAA characterized KTX's daytime operations as "highly automated daytime operations" and found that these operations "do not necessitate a third class medical." (p. 1)

*On automated control:* Condition 11 of the exemption specifies that the PIC may operate without a medical certificate "only during the day and when the UA is operated in a highly automated manner such that control of the UA rests primarily within the UA's automated systems, and the PIC's manual control input is limited to launch, recovery, or abnormal/emergency situations." (p. 5–6)

*On the maintenance architecture:* The FAA reviewed KTX's maintenance procedures and manuals in several specific areas (§§91.403(b), 91.405(a), 91.407(a)(1), 91.409(a)(1), 91.409(a)(2), 91.417) and determined in each area that the petitioner's alternative procedures "meets an equivalent level of safety." (pp. 2–3)

*On public interest:* The FAA found "a grant of exemption is in the public interest" because it "supports furtherance of innovation in a safe manner and promotes the safe progression of UAS integration into the NAS." (p. 3)

*On NAS authorization:* The accompanying Blanket COA (Certificate of Waiver or Authorization) authorizes KTX to "operate UAS in the NAS within the areas defined in the Operations Authorized section" — Class G airspace at or below 400 feet AGL.

The exemption terminates July 31, 2028.

**The architectural connection.** The December 2025 petition described an operational architecture in which machine intelligence — distributed flight control, edge stabilization, automated contingency response — operates within bounded envelopes under authority structures that include independent human override, hard physical failsafes, and termination authority that does not depend on the reasoning system's own judgment.

That is the same structural problem ExergyNet formalizes for software agents: intelligence and authority are different functions; authority must survive intelligence failure; physical consequence requires a harder boundary than digital consequence.

We did not arrive at this architecture because Physical AI became fashionable. We arrived at the same control problem from the opposite direction — by building machines whose actions already had physical consequences and had to be presented to a federal regulator for safety review.

The chronology:

```
December 2025
  KTX submits petition to FAA describing
  distributed flight-control and authority architecture

July 2026
  FAA grants Exemption 26214
  VSG-HL-01 authorized for lift, evaluation, testing, demonstration
  Airworthiness determination: no hazard to NAS users or public
  FAA characterizes operation as "highly automated"
  Blanket COA: NAS authorization, Class G, ≤400 ft AGL

2026
  Industry broadly begins describing robotics,
  autonomous agents, and consequence-active machines
  under the label "Physical AI"
```

Before "Physical AI" became an industry slogan, KTX had already taken a 275-pound highly automated consequence-active machine through federal aviation safety review and emerged with operating authority.

---

## §16. State Mobility and Portable Intelligence

An agent's execution state — not only its stored memory — is itself a resource. ExergyNet treats execution state as a first-class object with its own validation envelope and portability specification.

**V3-corrected findings (WP-C025–WP-C032, sourced from LNES119B_EVIDENCE_LEDGER.md):**

The original LNES-119A result (fresh-process restoration: MEDIUM 0/10, LONG 0/10) was caused by cross-workload checkpoint contamination in the test harness, not by a general restoration failure. The corrected harness re-establishes per-workload token-reference baselines: 9/9 realizations, 3/3 stability each for SHORT, MEDIUM, and LONG context lengths. (WP-C025)

A restored checkpoint requires partial re-evaluation of a small, fixed token count — 4 tokens in the tested configuration — before reaching steady state. This is a distinct property from core capsule correctness: the capsule is bit-perfect; the first-use cost is a fixed overhead. (WP-C026)

**Cross-host component transfer.** On the tested MEDIUM workload, transplanting the source host's R_CONV component alone to the destination host's native state independently reproduced the source host's reference trajectory. The same held for the S_SSM component alone. Source host: AMD EPYC 74F3 GPU node. Destination host: Intel Xeon Platinum 8573C CPU-only node. Both are x86-64 platforms. (WP-C027)

"Cross-host" is the correct descriptor for this result. "Cross-architecture" is reserved for a future experiment involving different ISA classes (ARM, a different accelerator class). AMD EPYC and Intel Xeon are both x86-64.

**Minimal sufficient state.** Within the tested adaptive delta-debugging search: S-state block 9 alone was independently sufficient to reproduce the source-host trajectory (WP-C028); S-state block 11 alone was also independently sufficient (WP-C029); neither block 9 nor block 11 is individually required when the full positive S-state background is present (WP-C030). R-state reduces to a 1-minimal sufficient pair: model blocks 4 and 21 (WP-C031).

**Root cause.** No causal mechanism for cross-host recurrent-state divergence has been established. ROOT_CAUSE = UNKNOWN across every entry in the LNES119B evidence ledger. No WP-C claim may be cited as evidence for any specific mechanism.

**Portable Intelligence Packaging (PIP).** The PIP specification defines 6 lifecycle functions (pack, inspect, verify, unpack, compatibility-check, authority-check). A reference implementation tested locally: 33/33 PASS, 8/8 negative cases (wrong model, wrong runtime, modified state, missing provenance, authority laundering, economic-authority injection, consequence-authority injection, runtime mismatch) rejected or blocked as designed. The governing invariant — STATE_REALIZED ≠ AUTHORIZED — is enforced in code. (WP-C032)

**Validation scope.** Same-process restore: validated. Short/medium/long fresh-process restore (corrected harness): validated. Cross-host component transfer (one workload, one host pair): validated. Cross-process and production cross-node portability: active research frontier.

---

## §17. Limitations and Open Scaling Frontiers

These are named as limitations because they are real boundaries, not because the architecture cannot eventually address them.

**N→K tested envelope.** The evidence covers N from 32,000 to approximately 10.1 million estimated tokens on an adversarial synthetic corpus using a single model family. Behavior at larger N, with different corpus distributions, different query populations, or different models, requires further measurement. The 10M result is the current sealed boundary.

**Q3 temporal-authority accuracy at 10M.** Q_BEND was triggered by Q3 scoring 12.0% at the 10M holdout, compared to 20.0% in the 4M development sweep (different query populations; not a matched within-population comparison). Adversarial temporal-authority density at 10M scale is the current retrieval-quality frontier. Temporal-authority resolution logic must improve to maintain accuracy as adversarial-density corpora grow beyond 10M.

**V→R vocabulary-diversity scaling.** LNES-84.2 V4 demonstrated that the O(V) morph-path cost is approximately constant when V is constant. V was constant in V4 because filler vocabulary was DF-suppressed. When vocabulary grows with corpus diversity — as in natural language corpora — V grows with N, and the O(V) prefix scan becomes O(N) in the worst case. This is the open research question addressed by LNES-84.3 (pre-design prepared; not yet executed).

**Retrieval cost scaling.** Indexed candidate discovery: α ≈ −0.2183 (95% CI upper ≈ +0.0206; no detected positive scaling within the tested envelope). Legacy full-corpus fallback scales linearly. At present, morphological queries are routed through the indexed prefix-expansion path (V4 closure). Common queries with no index match still fall to legacy scan (all-query fallback rate = 0.1667 at V4). Eliminating the remaining 16.67% fallback rate is the next routing milestone.

**Production authority enforcement.** The LNES-22 policy gate evaluates and logs every real decision but currently runs in shadow mode: it is not yet the sole authority over execution. Production-wide enforcement remains the active frontier.

**Cross-process and cross-node state portability.** LNES-119B demonstrated cross-host component-level transfer in a bounded single-workload experiment. True cross-process and cross-node portability — where execution state migrates across live process boundaries without a controlled handoff — is not yet demonstrated.

**Hardware comparison across scales.** The 4M holdout ran on GCP A100 hardware. The 10M genuine holdout ran retrieval and the query runner on WSL2 Ubuntu on Windows, with inference served by NVIDIA NIM on GCP a2-highgpu-4g via SSH tunnel. Retrieval latency ratios between these two runs are not evidence-grade. Per-query retrieval times at 10M (P50 = 18.7s, P95 = 30.4s) should not be compared directly to 4M A100 figures.

---

## §18. Conclusion

The measured evidence establishes one architectural fact above all others:

**Memory grows. Context does not have to.**

Across a more than 300× expansion in corpus size — from 32,000 to 10,116,589 estimated tokens (approximately 316×) — active model-facing context per query remained bounded between 763 and 908 tokens. The nine-point regression slope is not statistically distinguishable from zero. Less than 0.1% of K variance is explained by N.

That result has an architectural consequence. If K does not have to grow with N, then the model does not have to carry its full operational history in every inference call. The inference window can remain bounded while the corpus accumulates without limit. The GPU processes a bounded evidence window. The accelerator does what it does efficiently.

At 10M tokens, a separate retrieval-quality frontier emerged. Accuracy fell to 39.5% — formally triggering Q_BEND — driven by temporal-authority resolution under adversarial density. The infrastructure did not fail. Every query completed. What failed was the distinction between a current specification and its superseded predecessors, under the heaviest adversarial-density conditions tested. That is the correct next problem to solve: not larger context windows, not more capable models, but a resolution substrate that can distinguish authoritative state from historical noise at scale.

The xLMP scaling result, the Q_BEND characterization, the LNES-84 resolution campaign, and the authority architecture are not independent components. They form a coherent argument: externalize state, externalize resolution, externalize authority, and the inference engine can remain bounded, deterministic, and auditable regardless of what it has accumulated or what it is asked to do.

ExergyNet is not a model. It is the substrate underneath models.

**The AI industry is building the vehicles. ExergyNet is building the roads required when those vehicles become numerous, heterogeneous, persistent, and autonomous.**

More precisely: the argument for shared machine infrastructure is strongest not when it is convenient but when it is necessary — when intelligence must persist across sessions, establish identity across machines, preserve evidence across time, exercise bounded authority over real consequences, and account for what it consumed in doing so. Every one of those requirements exists independently of which model processes the evidence. Every one of them must be solved by the infrastructure, not by the model itself.

If every current frontier model were replaced tomorrow, the reason ExergyNet exists would be unchanged.

---

## Validation Status and Research Frontier

Every component is reported at its actual current maturity stage.

| Component | Maturity | Boundary |
|---|---|---|
| xLMP / Exergy Vault | Production | Published local node (VMN); integrity distinct from correctness |
| N→K scaling (32K–4M) | Sealed and GCS-verified | 4M holdout; adversarial synthetic corpus; A100 hardware |
| N→K scaling (10M) | Sealed and GCS-verified | 10M holdout; WSL2 runner + NVIDIA NIM on GCP A100 4G; retrieval latency confounded |
| Compound Index (indexed discovery) | Validated | α ≈ −0.2183; 32MB–512MB corpus |
| Morph Escape Closure (LNES-84.2 V4) | Sealed | Tested query population; O(V) mechanism; V was constant in benchmark |
| Vocabulary-Diversity Scaling (LNES-84.3) | Pre-design only | Not executed |
| Vanguard (model routing) | Production | Proposes actions; does not self-authorize |
| Authority validator | Production | Live-validated against real adversarial run |
| Policy gate | Pilot | Evaluates every decision; not yet sole execution authority |
| xISA capability taxonomy | Validated | 106/106; isolated research environment |
| Temporal Authority | Implemented, tested | Not yet production-activated |
| RHO resource metrology | Pilot | Measured G0 basis; GPU cost term modeled, not measured |
| MMS settlement | Validated | Base Sepolia testnet only |
| Aviation pre-flight gate | Validated (synthetic) | Synthetic holdout; no real aircraft |
| LNES-119B cross-host transfer | Validated (bounded) | One workload, one host pair, x86-64 only |
| PIP specification | Implemented + locally tested | Not production deployment |
| Production authority enforcement | Active frontier | Not yet achieved |
| Cross-process/cross-node state portability | Active frontier | Not yet demonstrated |

---

---

## Appendix A — Evidence and Reproducibility

Every quantitative result in this paper is traceable to a sealed evidence artifact. The table below allows engineering readers to locate and verify the major numbers without leaving the paper.

| Experiment | Hardware | Corpus | Primary result | Evidence artifact | SHA / provenance status |
|---|---|---|---|---|---|
| N→K dev ladder (9-pt, 32K–4M) | GCP a2-highgpu-4g, 4× A100-SXM4-40GB | Adversarial synthetic; sealed query SHA 341acf7d... | K bounded 763–908; 9-pt OLS slope 7.834×10⁻⁷, R²=0.0004, CI includes zero | EVIDENCE_SEAL_LNES82C4M.md | GCS 3-way PASS; SHA in seal file |
| N→K dev sweep (10-pt, 10M point) | GCP A100 4G | ~10M est. tokens; dev query SHA 1953a514... | Mean K=897, acc=41.1% (Q_WARN); 10-pt OLS slope=2.79×10⁻⁶, R²=0.0384, CI includes zero | EVIDENCE_SEAL_LNES82C10M.md | 7/7 raw artifacts GCS-verified 2026-09-03; seal document pending operator upload |
| 4M genuine holdout | GCP A100 4G | 4M adversarial synthetic; query SHA 341acf7d...; corpus SHA 3e761a6d... | Mean K=902.81, acc=45.3%, 950/950 ok, no Q_BEND | EVIDENCE_SEAL_LNES82C4M.md | GCS 3-way PASS |
| 4M GPU workload telemetry | GCP A100 4G | 4M corpus; 10,680 telemetry samples | 97.8% retrieval wall time; GPU mean 2.0%, median 0.0%, peak 100.0%; retrieval P50 ≈ 19.8s | EVIDENCE_SEAL_LNES82C4M.md (GPU telemetry section) | GCS-verified; FLAG-WP-C039 CLEARED |
| 10M genuine holdout | WSL2 runner (retrieval); NVIDIA NIM on GCP A100 4G (inference, SSH tunnel) | 10,116,589 est. tokens; query SHA 341acf7d...; corpus SHA 1d3d0ab7... | Mean K=895.96, acc=39.5%, Q_BEND triggered, 950/950 ok; state-to-active-context ratio ≈ 11,291:1 (derived: 10,116,589 / 895.96) | EVIDENCE_SEAL_LNES82C10M_HOLDOUT.md | GCS 3-way PASS; sealed 2026-09-04 |
| LNES-84.1 resolution scaling | PyPy 7.3.23 / Python 3.11.15 | 32MB–512MB, 8 scale points | α_indexed ≈ −0.218 (no detected positive scaling; CI upper ≈ +0.02); α_effective_P95 ≈ +0.771 (strong positive sublinear — ERRATA_002 correction applied) | LNES84_1_V3_PYPY_EVIDENCE_SEAL.md | SHA 55F5F9A8… (complete) |
| LNES-84.2 morph closure | PyPy 7.3.23 / Python 3.11.15 | 32MB–512MB, 5 scale points | Morph routing 6%→100%; fallback 1.00→0.00; 0 regressions | LNES84_2_V4_EVIDENCE_SEAL.md | SHA ABD1AE9C…; GCS-verified |
| H200 efficiency baseline | Single NVIDIA H200 | 8K–285K synthetic tokens | K 660–820 flat; +24.4 pp vs RAG; 11.3× throughput vs full-context | EVD-001 | SHA 7005fa07… (independently recomputed) |
| LNES-119B cross-host transfer | AMD EPYC 74F3 → Intel Xeon Platinum 8573C | Single workload, x86-64 only | R_CONV alone sufficient; S_SSM alone sufficient; ROOT_CAUSE=UNKNOWN | LNES119B_EVIDENCE_LEDGER.md | Entries 004–024; spot-verified |
| FAA Exemption 26214 | — | — | Airworthiness determination; highly automated; Condition 11; equivalent safety; Blanket COA | FAA-2025-5731_Kunfirm-Innovative-Services_Exemption No. 26214.pdf | Primary regulatory document; read directly 2026-09-06 |
| LNES-82C.R6 cross-accelerator portability | NVIDIA A100 (`a2-highgpu-1g`) vs. Google TPU v6e (`v2-alpha-tpuv6e`) | `Qwen2.5-7B-Instruct` (BF16); ~20,000-token synthetic corpus; 100-question population; C=1/2/4 | R = S_TPU/S_A100 declined 0.9492→0.8985→0.8557; zero errors/timeouts across 12 cells; full-context accuracy 100% on both platforms; xLMP accuracy 96.77%–97.10% | LNES82C_R6_CROSS_ACCELERATOR_REPORT.md; raw JSON (RAW_A100, RAW_TPU, RAW_RESULTS) | Execution schedule hash independently verified; harness/treatment hashes independently reverified via archive copies; raw results independently recomputed; historical raw-result digests not found (see note below) |

*LNES-82C artifacts archived at gs://xlmp-evidence-lnes82c5k/ with 3-way SHA chain verification. LNES-84 artifacts are locally archived with independently recorded SHAs. The 10M dev sweep seal was awaiting operator final GCS sign-off at time of this draft — it is labeled as such throughout the paper and is never conflated with the GCS-verified genuine holdout.*

**R6 provenance note.** The model under test was substituted (the H200 baseline's own model, standing in for the originally-planned Llama-3-8B/Gemma, was replaced by `Qwen2.5-7B-Instruct` after a disclosed TPU-runtime-support blocker on the original model), and the reference accelerator was substituted (H200 → A100) from R6's own H82 preregistration. Provenance is precisely scoped, not uniform: execution-schedule hash = independently verified; harness/treatment recorded hashes = independently reverified via archive copies (matching copies found elsewhere in the project archive, not a live re-hash of the exact bytes that ran on the R6 hosts, which were deleted after the run); raw result JSON = internally consistent and independently recomputed; historical raw-result digests = not found (no hash record for `RAW_A100.json`/`RAW_TPU.json`/`RAW_RESULTS.json`/`TELEMETRY.json` exists anywhere in the reviewed archive to check today's files against). `R = S_TPU/S_A100` is a ratio-of-ratios, not a raw cross-accelerator throughput comparison. 10M-scale N→K portability to TPU remains untested by this experiment.

---

## Acknowledgments

The authors acknowledge Kyaw Phone and Charles Mbatha for their contributions to testing and evaluating MyMonitor use cases that informed applied validation scenarios. Their contributions supported use-case evaluation and testing and should not be interpreted as authorship of the ExergyNet architecture, xLMP, or the underlying research results reported in this paper.

---

## References

1. NVIDIA Corporation. *NVIDIA Announces Financial Results for Second Quarter Fiscal 2027.* Press release, August 26, 2026.
2. NVIDIA Corporation. *CFO Commentary, Second Quarter Fiscal 2027.* August 26, 2026.
3. NVIDIA Corporation. Second Quarter Fiscal 2027 earnings call remarks (J. Huang), August 26, 2026.
4. Sreeramaneni, R. (Micron). *Evolving Memory Architectures for AI.* Hot Chips 2026, Stanford University, August 23, 2026.
5. Federal Aviation Administration. *Exemption No. 26214,* Regulatory Docket No. FAA-2025-5731. July 15, 2026. Granted to Kunfirm Innovative Services LLC.
6. Federal Aviation Administration. Blanket Certificate of Waiver or Authorization, 49 U.S.C. § 44807 Grant of Exemption, Class G Airspace at or below 400 AGL. August 2024.
7. U.S. Provisional Patent Application No. 64/134,973, filed 2026 (formal claims subject to prosecution).
8. Cisco Systems. *AI Impact on Wide Area Networks: 2026 Report.* Cisco, 2026. Direct measurement of live AI inference traffic across service-provider networks.

*A full claim ledger, source map, and revision history are maintained as separate internal diligence documents and are available on request. Evidence artifacts are GCS-archived under gs://xlmp-evidence-lnes82c5k/ with 3-way SHA chain verification.*
