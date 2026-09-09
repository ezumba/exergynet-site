# LNES-82N — Network Data-Movement Scaling Protocol

**Status:** SEALED (protocol only — no execution yet). This document records the
experimental design for measuring **actual network bytes moved per task** as
persistent agent state grows. It does **not** authorize compute spend or a
network-instrumented run; each phase gate below still requires an explicit
go/no-go before GPU-hours or engineering time are consumed. Until LNES-82N
executes and seals evidence, **no measured network-byte claim may enter any
public-facing document.** The current whitepaper language — that end-to-end
network-byte reduction under xLMP "remains a separate validation target"
(V4 §3) — is correct and stays as written until this protocol produces sealed
evidence.

**Relationship to prior artifacts:**
- [[LNES82CX_FIND_THE_BEND_PROTOCOL_2026-08-30]] governs the raw-`N` context
  ladder and its architecture-freeze discipline. LNES-82N reuses that ladder
  and freeze; it adds one new instrumented axis and changes nothing else.
- LNES-82C measured `N → K` (persistent corpus size → active model-facing
  context per query). LNES-84 measured `N → R` (corpus size → retrieval /
  resolution cost). LNES-82N measures the third, independent axis: `N → B`
  (corpus size → network bytes moved per completed task).
- External motivation: Cisco, *AI Impact on Wide Area Networks 2026* — "Up to
  450% more total traffic is generated per task when performed by an agent,"
  "approximately 70% of that traffic is AI inference." That is an external WAN
  measurement of the *problem*. LNES-82N is the ExergyNet measurement of
  whether xLMP's bounded-evidence execution *reduces* that data movement. The
  two must never be blended (see whitepaper claim ledger WP-C046).

---

## Mission

Determine how total network data movement per completed task scales with
persistent state `N`, under full-context replay, conventional retrieval (RAG),
and xLMP bounded-evidence execution — measured as **actual transmitted bytes on
the wire**, decomposed per network plane, and normalized to **bytes per correct
task**. Replace the current architectural inference ("xLMP has a network
implication") with a measured statement ("xLMP moved X× fewer bytes per correct
task than full-context replay across the tested envelope"), or falsify it.

---

## Primary quantities

Per completed task:

```
B_total = B_model_in + B_model_out + B_retrieval + B_tools + B_coordination
```

- `B_model_in`   — bytes sent into the inference endpoint (request bodies).
- `B_model_out`  — bytes returned by the model (response/stream bodies).
- `B_retrieval`  — bytes transferred to obtain evidence from the state substrate.
- `B_tools`      — bytes for external tool/API calls made by the agent.
- `B_coordination` — agent-to-agent bytes, where applicable.

Measured as **actual transmitted bytes**, not token estimates and not
theoretical payload size. Secondary infrastructure metrics: peak Mbps,
sustained Mbps, per-reasoning-turn bytes, model-call count.

Report the analogue of the `N → K` fit for each architecture:

```
B = a + bN
```

Predeclared hypotheses:

```
H1: Full-context-replay B_model_in increases materially with N
    (within the regime where full-context is technically valid — see Gate 0).
H2: xLMP B_model_in remains bounded by retrieved evidence size |E(q)|,
    not by persistent corpus size N, within the tested envelope.
H3: xLMP reduces total bytes per correct task relative to full-context replay.
H4: Any reduction survives inclusion of retrieval/storage traffic
    (B_retrieval), not only inference-endpoint traffic.
```

Derived headline metrics (report only from measured `B`, never estimated):

```
Network Amplification Factor  = B_total,baseline / B_total,xLMP
Inference Ingress Reduction   = 1 − (B_model_in,xLMP / B_model_in,baseline)
Bytes per Correct Task        = B_total / correct_completed_tasks
Network Efficiency            = correct completed tasks per GB moved
State Movement Ratio          = B_total / N_bytes
```

`State Movement Ratio` (`B_total / N_bytes`) is frozen into the protocol as a
required readout. It is a normalized measure of how much network movement a
system generates relative to persistent-state size. Lower is not automatically
"better" — a system can move few bytes by doing less useful work — so it is
always reported alongside the task-equivalence gates and `Bytes per Correct
Task`, never in isolation.

`Bytes per Correct Task` is the primary commercial metric — the network
analogue of the H200 correct-task-throughput framing. It is the number that
connects directly to Cisco's WAN concern.

---

## Gate 0 — The full-context validity ceiling (READ FIRST; hard constraint)

The frozen harness (`xlmp_500k_scaling_bench.py`) sets `MAX_CTX = 262144` and
marks a full-context request `exceeds_context` once corpus tokens exceed
`MAX_CTX * 0.98` (~257K tokens), after which the `full` method does not produce
a valid completion. **Consequently the full-context baseline is technically
valid only below ~257K tokens.** At every rung of the LNES-82C ladder from 500K
upward, full-context replay cannot run at all.

Implications, to be stated in the readout, not engineered around:
- The **head-to-head measured byte multiplier** (Network Amplification Factor
  vs. full-context) is computable only in the sub-ceiling regime — realistically
  the 32K and 128K rungs, plus any intermediate point below ~257K.
- Above the ceiling, full-context has **no valid `B`** because the task fails,
  not because it moved fewer bytes. "Full-context is infeasible past ~257K
  tokens on this model" is itself a finding; it is **not** a byte ratio and must
  never be reported as `B_full = ∞` or folded into a multiplier.
- Above the ceiling, the honest comparison is **xLMP vs. RAG**, both of which
  send bounded evidence. The full-context curve is reported where valid and
  explicitly truncated at the ceiling.

Per LNES-82C.X Phase 2: "do not attempt full-context stuffing merely to
preserve a baseline comparison that is technically impossible — report baselines
only where they remain technically valid." LNES-82N inherits that rule verbatim.

---

## Gate 1 — Instrumentation-boundary honesty (the contamination trap)

**Critical experimental-control issue.** In the current frozen harness the only
traffic that crosses a real network is the model plane: `run_query()` issues a
`urllib` HTTP POST to `NIM_URL + "/v1/chat/completions"` (default
`http://localhost:8000`; in the 10M holdout, tunneled to NVIDIA NIM on a GCP
A100). **Retrieval, the corpus, and the RAG index are all in-process/local**
(`build_adversarial_corpus()` in RAM; `rag_retrieve()` over a local
SentenceTransformer index). Therefore, as the harness stands today,
`B_retrieval ≈ 0` for xLMP **by construction**, and a naive `B_total`
comparison would be exactly the contaminated setup we must avoid — xLMP storage
local, model remote — producing a flattering total that merely reflects where
the storage happens to sit.

LNES-82N must resolve this before it can claim `B_total`, by one of:

1. **Equivalent placement.** Keep storage/network placement identical across
   all three architectures (e.g., corpus + index behind the same remote
   boundary for every method), so every plane is measured on the same footing.
2. **Per-plane instrumentation with separate reporting** (preferred). Instrument
   and report every boundary independently:

   ```
   MODEL PLANE          B_model_in, B_model_out
   STORAGE PLANE        B_retrieval  (state substrate ↔ query host)
   TOOL PLANE           B_tools
   COORDINATION PLANE   B_coordination
   TOTAL SYSTEM PLANE   B_total
   ```

   Then no reviewer can argue that traffic merely moved from one link to
   another: each plane's scaling is shown, and `B_total` is an explicit sum of
   separately-measured planes, not an artifact of topology.

The preferred design is (2). If option (1) is chosen instead, the placement
must be identical for `full`, `rag`, and `xlmp`, and that identity must be
recorded in the seal. **A `B_total` figure produced without one of these two
controls is not evidence-grade and must not be sealed or published.**

---

## Gate 2 — Non-perturbation (pre-registered)

Adding byte instrumentation around the frozen harness must not materially
change, relative to the corresponding frozen LNES-82C execution at the same
scale:

```
- K (mean/median/p95/max)
- correctness / accuracy
- model-call count
- routing decision
- evidence selection
```

A control pass with instrumentation ON vs. OFF must reproduce the sealed
LNES-82C K and accuracy figures within noise before any `B` result is sealed.
If instrumentation perturbs any of the above beyond noise, the instrumentation
itself is a confound and no `B` figure may be sealed or published until the
perturbation is eliminated. This gate is a hard precondition on Phase N0.

---

## Duplicate-byte decomposition (the actual thesis)

The architectural waste xLMP targets is *retransmission* of already-known state,
not all agent traffic. Measure it directly. For each task, hash fixed-size
segments of model-ingress bytes across the task's reasoning turns and compute:

```
TOTAL MODEL INPUT BYTES
UNIQUE INPUT BYTES
REPEATED INPUT BYTES
DUPLICATION RATIO   D = repeated_context_bytes / total_model_ingress_bytes
```

This directly tests the thesis that stateless / full-context agents repeatedly
move already-known state, and it is far stronger than assuming *all* agent
traffic is caused by full-context replay. Report `D` per architecture and per
scale point. A single-turn task set will show low `D` by construction; use a
multi-turn task variant (below) to exercise the retransmission path the Cisco
"continuous machine-speed operation" framing is actually about.

---

## Task-equivalence gates (do not let xLMP "win" by doing less)

Every architecture at every scale point must report task quality alongside
bytes:

```
accuracy
task completion / correct-task rate
latency (per turn and per task)
model_call_count
```

A byte reduction is only reported jointly with the quality figures that make it
comparable. `Bytes per Correct Task` (above) is the metric that fuses the two;
a method that sends fewer bytes but completes fewer correct tasks does not win
on `Bytes per Correct Task`. Accuracy/quality parity (or the exact quality delta)
must be stated next to every byte claim.

---

## Scale ladder and per-point readout

Reuse the LNES-82C ladder and its architecture freeze:

```
32K   128K   500K   1M   2M   4M   10M
```

At every scale point, for each of `{full (where valid), rag, xlmp}`, record:

```
N
K                         (mean/median/p95/max — carried from LNES-82C method)
B_model_in
B_model_out
B_retrieval
B_tools
B_coordination
B_total
D (duplication ratio)
task_accuracy
correct_task_rate
task_latency
model_call_count
Bytes per Correct Task
State Movement Ratio      (B_total / N_bytes)
```

The `full` row is populated only below the Gate 0 ceiling. Above it, the `full`
row carries `FULL_CONTEXT_STATUS = INFEASIBLE_CONTEXT_LIMIT` (not a byte value,
not infinity, not an extrapolation), and only `rag` vs `xlmp` are compared.

---

## Architecture freeze (inherited from LNES-82C.X Phase 5)

Do not change, across any scale point or architecture: chunk parameters,
`EVIDENCE_WINDOW`, `MAX_EVIDENCE_CHARS`, evidence count, scoring, query
extraction, retrieval thresholds, query generator, model
(`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`), tokenizer, system prompt, or
corpus construction method. LNES-82N adds byte instrumentation *around* the
frozen harness (packet/socket counters, HTTP request/response body sizing, or a
measured proxy at each plane boundary) and does not modify
`xlmp_500k_scaling_bench.py`. Byte instrumentation must be verified not to
perturb K or accuracy: a control pass with instrumentation on vs. off must
reproduce the LNES-82C K and accuracy figures within noise before any `B`
result is sealed.

---

## Phase plan

| Phase | Gate | Description |
|---|---|---|
| N0 | Gate 2 | Instrumentation build: per-plane byte counters around the frozen harness; must pass the Gate 2 non-perturbation control (K/accuracy/model-call-count/routing/evidence-selection reproduce LNES-82C within noise). No scale run yet. |
| N1 | Gate 0 + Gate 1 resolved | Sub-ceiling head-to-head: `full` vs `rag` vs `xlmp` at 32K and 128K. Produces the only valid full-context byte multipliers. |
| N2 | N1 sealed | Above-ceiling ladder: `rag` vs `xlmp` at 500K→10M, with `full` marked infeasible. Fit `B = a + bN` per architecture per plane. |
| N3 | N2 sealed | Multi-turn task variant to exercise the retransmission path; report `D` (duplication ratio) across architectures. |
| N4 | N3 sealed | Report: Network Amplification Factor (where valid), Inference Ingress Reduction, Bytes per Correct Task, Network Efficiency — each with its validity envelope and quality-parity statement. |

Each phase gate requires explicit go/no-go before compute is spent. No phase's
numbers may be quoted publicly until that phase's evidence is sealed and hash-
verified (GCS 3-way chain, per LNES-82C convention).

---

## No-overclaim discipline (inherited + specific)

Until sealed evidence exists, the following are prohibited in any document:

- Any specific measured byte figure, ratio, or multiplier (e.g. "23.3× fewer
  bytes"). The `42.0 MB / 1.8 MB` figures in the originating design note are
  **illustrative placeholders**, explicitly not measurements, and must never be
  cited as results.
- "xLMP measured a network-bandwidth reduction" (until N4 seals it).
- "Cisco proved full-context replay caused the 450%" (Cisco measured aggregate
  agent WAN traffic, not full-context replay specifically — see WP-C046).
- `B_full = ∞` or any multiplier that treats full-context infeasibility as a
  finite byte ratio.
- Any `B_total` produced without the Gate 1 control (equivalent placement or
  per-plane separate reporting).

The maximum defensible claim before execution is exactly the current whitepaper
wording: the network implication is **architectural**, and end-to-end
network-byte reduction is a **separate validation target** — which LNES-82N is
designed to hit.

---

## Whitepaper integration (only after sealing)

If LNES-82N executes and seals, the paper's third-axis framing becomes:

```
N → K   Context scaling            (LNES-82C — sealed)
N → R   Resolution scaling         (LNES-84   — sealed)
N → B   Network data-movement      (LNES-82N  — this protocol)
```

At that point, and only then, §3's "remains a separate validation target"
sentence may be upgraded to the measured statement, a new sealed-evidence claim
(WP-C0xx) added to the V4 claim ledger, and the `N → B` axis added to §10/§17 as
a characterized (or frontier) result — under the same verification bar as every
other sealed claim. Code or protocol existence alone does not update the paper;
a sealed, verified `B` measurement does.

---

## Execution status log

| Phase | Status | Note |
|---|---|---|
| N0 (instrumentation build) | NOT STARTED | Requires per-plane byte counters + Gate 2 non-perturbation control (K/accuracy/model-call-count/routing/evidence-selection) vs. sealed LNES-82C |
| N1 (sub-ceiling head-to-head) | NOT STARTED | Gated on N0; only regime where full-context byte multiplier is valid (< ~257K tokens) |
| N2 (above-ceiling ladder) | NOT STARTED | Gated on N1; `rag` vs `xlmp` 500K→10M; full-context infeasible |
| N3 (multi-turn duplication) | NOT STARTED | Gated on N2 |
| N4 (report + headline metrics) | NOT STARTED | Gated on N3; no public byte claim before this seals |
