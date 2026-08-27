<!--COVER-->
# EXERGYNET

### Shared Infrastructure for Autonomous Machine Intelligence

Model-independent infrastructure for persistent, governed, economically accountable machine intelligence.

Seven Ezumba, Chief Architect

August 2026

<!--PAGEBREAK-->

## Abstract

Artificial intelligence is moving from isolated model inference toward persistent, heterogeneous, and increasingly autonomous machine systems operating across organizations, machines, and physical environments. That transition exposes a gap that better models do not close: independently built intelligences that share state, resources, actions, or consequences need infrastructure for identity, persistent state, evidence, authority, resource accounting, and interaction with the physical world. A model can decide what to infer or do; it cannot, by itself, establish who is acting, what state is authoritative, what is permitted, or what actually happened.

ExergyNet defines a model-independent substrate for these functions. It separates reasoning from authority, memory from authorization, and economic allocation from consequence control, while providing mechanisms for persistent state, evidence-bound computation, deterministic authorization, and machine resource accounting. This paper presents the architecture, reports measured results within their tested envelopes, and identifies the research frontier that remains. Four results anchor the case: persistent memory that holds prompt cost flat as a corpus grows from 8,000 to 285,000 tokens while full-context injection grows to 67,000 tokens and is rejected past 262,000; a deterministic authority layer that rejected a live prompt-injection attack after the reasoning model itself complied; a state-governance mechanism that reduced false authoritative commitments from 8% to 0% without loss of accuracy; and a physical-consequence authorization gate that held false-release at zero across two independent validation runs. As machine intelligence becomes economically productive at industry scale, the infrastructure connecting independent intelligences becomes as consequential as the models themselves.


## Executive Summary

**The problem.** Machine intelligence is becoming abundant, heterogeneous, and autonomous faster than the infrastructure that connects independent intelligences to shared state, evidence, and consequential action. A more capable model does not solve this: identity, authoritative state, authorization, and accountability are not products of reasoning quality.

**The architecture.** ExergyNet sits between any reasoning engine and the digital or physical systems it can affect **(Figure 1)**, organized into three coordination planes **(Figure 2)**: Knowledge & State, Coordination & Authority, and Resource & Economic Coordination. The organizing principle is separation: reasoning and authority are never the same mechanism.

**Four headline results:**

| Result | Measured outcome | Tested envelope |
|---|---|---|
| Persistent memory | Prompt cost held ~660-820 tokens flat as corpus grew 8k-285k; full-context grew to 67k and was rejected past 262k | H200, synthetic corpus |
| Deterministic authority | Rejected a live prompt-injection after the reasoning model complied; reproduced twice | Live listener, unit-tested |
| State governance | False authoritative commitments fell 8% to 0%; model accuracy held at 84% | 100 real procurement cases |
| Physical consequence | False-release held at 0/50 in two independent runs vs. 20-34% ungoverned | Sealed synthetic holdout |

**The larger implication.** As machine output becomes economically productive at industry scale, the resources and coordination mechanisms that sustain it become strategic infrastructure in their own right, not implementation detail.


## 1. Why Machine Intelligence Needs Infrastructure

Every independent reasoning system begins each session from nothing durable: state is reconstructed at full cost, evidence is re-fetched without stable identity, authority is implicit in whatever credentials the caller holds, and no independent record survives to explain why an action occurred. This is a property of the surrounding architecture, not of any particular model, and improving the model does not change it.

**The governing principle.** *If* independent machine intelligences share state, resources, actions, or consequences, external coordination infrastructure becomes necessary — a necessity that model quality alone cannot supply. As the number of independent, heterogeneous intelligences (N) grows, unconstrained pairwise integration carries a potential quadratic cost; a shared substrate instead lets each participant implement one common interface **(Figure 3)**.

This argument is no longer only architectural — it is now visible in the infrastructure economics of the companies building frontier compute. In its most recent quarter, NVIDIA reported $89.0 billion in Data Center revenue, up 117% year-over-year, and supply and capacity purchase commitments that rose from $119 billion to $279 billion quarter-over-quarter — an increase its finance leadership attributed primarily to the procurement of memory. At the same time, independent technical disclosures from memory manufacturer Micron reported that compute performance is scaling roughly 3x every two years while high-bandwidth memory (HBM) capacity is scaling less than 2x over the same period **(Figure 9)**.

These figures are external, dated evidence about the industry, not ExergyNet results, and they do not validate this architecture. What they confirm is the premise this paper derives independently: memory, compute, energy, and physical infrastructure have become contended, strategically managed resources — exactly the resource layer that autonomous machine infrastructure must eventually measure, allocate, and account for (Section 6).


## 2. The ExergyNet Architecture

ExergyNet occupies the boundary between a reasoning engine and the world it can affect: **Model | ExergyNet | Digital and Physical World**. The reasoning engine is interchangeable — GPT, Claude, Nemotron, an open-weight model, a robotics controller, or a human operator.

The architecture organizes into three coordination planes **(Figure 2)**:

- **Plane I — Knowledge & State.** What exists, what happened, and what is currently authoritative: xLMP / Exergy Vault, deterministic indexing and routing, Temporal Authority, and physical observation (Edge Witness).
- **Plane II — Coordination & Authority.** Who may interact with what, under what constraints: machine identity, the xISA capability vocabulary, Vanguard model routing, the LNES-22 Consequence Boundary, and AERIS external-evidence acquisition.
- **Plane III — Resource & Economic Coordination.** What was consumed, authorized, and settled: RHO resource accounting, Omega, and MMS settlement.

The architecture keeps a small set of predicates permanently separate: memory evidence is not execution authority; model identity is not agent identity; agent identity is not economic authority; economic authority is not consequence authority; and resource accounting is not market value. These separations are what let intelligence be swapped, fail, or be distrusted without the surrounding system losing what it knows, what it may do, or what it must account for.

**Security posture.** ExergyNet assumes the model may be compromised. Consequential authorization is placed outside the reasoning model so that protected actions can be evaluated deterministically, independent of whether the model that proposed them can be trusted (Section 4).


## 3. Persistent State and xLMP

The clearest cost of statelessness is reconstruction: an agent that rebuilds its world every time it changes model, machine, or session is, in effect, rebuilding the road behind itself every time it moves. xLMP is ExergyNet's answer — a root-addressed, content-verified persistent evidence store with bounded retrieval.

On a single NVIDIA H200 with a Nemotron-class model over a synthetic corpus, xLMP held staged prompt cost roughly flat at ~660-820 tokens as the underlying corpus grew from 8,000 to 285,000 tokens, while full-context injection grew to 67,000 tokens and was rejected outright past 262,000 **(Figure 4)**. At equal evidence budget, xLMP retrieval reached 92.4% accuracy against a 68.0% tested RAG baseline — a 24.4-point advantage — and delivered roughly 11.3x the correct-task throughput of full-context at each method's best compliant load **(Figure 5)**.

**Why this is a capacity result, not only a cost result.** Reducing the context staged into active working memory per operation means the same physical hardware sustains more useful machine work per unit of memory and time. Under constrained memory and compute, that is a capacity property, not merely a savings.

**Validation scope.** These results hold within the tested H200 / synthetic-corpus envelope; broader-scale validation is part of the ongoing measurement program. A separate efficiency figure (~42.7x vs. full-context, ~4.0x vs. RAG) is reported pending independent re-verification of its source artifact.


## 4. Reasoning, Evidence, and Authority

Reasoning and authorization are architecturally separate. A proposed action must independently clear four gates — identity, capability, freshness, and integrity — before it is treated as authorized; failing any one gate is a denial **(Figure 7)**.

**The strongest result.** ExergyNet sent a live prompt-injection payload to a running authority-review listener. The reasoning model partially complied: it returned an approval and did not flag the injection despite its own instructions to do so. The deterministic validation layer rejected the request outright before any signed review could be produced — no credential was exposed at any point, because key material is structurally excluded from what reaches the model. The attack was reproduced after a logging fix, with the same rejection now producing a durable, signed record. The finding, bounded to this validated run: **a reasoning model can fail adversarially without the authority system failing with it.**

Supporting validation: 64 assertions across three independent unit-test scripts; 38 of 39 adversarial tests passed against the agent-authorization API (the one failure was a test-environment artifact); and 100 of 100 concurrent double-allocation attempts against a shared balance were correctly serialized.

**Evidence integrity is separately governed.** State-governance testing over 100 real procurement-decision cases reduced false authoritative-state commitments from 8% to 0% while model judgment accuracy held flat at 84% **(Figure 6)** — the substrate prevented unresolved evidence from being promoted into an authoritative record, within the tested case set.

**Validation scope.** The identity/capability/freshness/integrity validator is live and independently tested. The broader policy-capability gate is implemented and tested but currently runs in a monitored pilot mode: it evaluates and logs every real decision without yet being the sole authority over execution (Section 9).


## 5. State Mobility

An autonomous agent's active execution state — not just its stored memory — is itself a resource worth preserving. ExergyNet treats execution state as a first-class object with its own validation envelope **(Figure 10)**.

On a hybrid KV/SSM execution runtime, same-process erase-and-restore reproduced continuation exactly across every tested context length (30 of 30 aggregate trials), with bit-perfect capsule round-trips (9 of 9 checked). True fresh-process restoration reproduced continuation exactly for short contexts (10 of 10) — the validated frontier today. For medium and longer contexts, fresh-process continuation diverged in the tested runs, isolating a genuine research finding: **serialized-state equality is not the same as live-execution-state equality.** The capsule bytes themselves were bit-perfect; the divergence has been localized to runtime cache-reconstruction semantics, which remains under active investigation.

**Validation scope.** Same-process continuity and short-context fresh-process continuity are validated. Medium/long-context fresh-process continuity and cross-node portability are the active research frontier — no cross-node success is reported until an in-progress validation campaign is complete.


## 6. Machine Resource Economics

If machine output is economically productive, the resources consumed to produce it — compute, memory, storage, network, energy, and time — become economically significant in their own right. ExergyNet's answer is a resource-authority pipeline: humans fund an agent identity, which receives bounded economic authority, spends it under explicit policy, and produces an auditable settlement record **(Figure 11)**.

RHO is ExergyNet's resource-cost accounting unit, defined by measurement, not by market price. A metrology pass fixed a measured cost basis across two hardware classes; the operations with the lowest cost are measured directly at the host, while the highest-cost operation (dominated by GPU inference) is currently modeled from pricing data rather than measured on-device — the next stage of the metrology program. RHO's value is defined independently of any market price, token, or energy interpretation.

**Demonstrated settlement.** A full three-operation economic strike — recall, write, and query — settled end-to-end on a public test network: per-model spending allowances were granted, spent to zero, and every replay attempt was reverted, with 500 RHO settled and independently recomputed from two different accounting paths.

**Validation scope.** Settlement is demonstrated on testnet; production-scale, multi-principal settlement and any market valuation of settled units are the next stage.


## 7. When Software Becomes Structural

As machine intelligence moves from producing information to controlling consequential systems — a financial transfer, an infrastructure change, a physical action — the software governing that transition stops being an implementation detail and becomes part of the system's load-bearing structure, in the way a bridge's structural members, not its paint, keep it standing. A structure that is correct on average is not sufficient when a specific, consequential transition is underway: the governing invariants must hold for *that* transition. This is the architectural reason reasoning and authority cannot be the same mechanism (Section 4).

**The primary consequence-active example: an aviation pre-flight authorization gate.** A heavy-lift uncrewed aircraft program illustrates the requirement with unusual clarity: a physical machine with real authority to release cargo or return to service, continuous telemetry, explicit safety invariants, and consequences that cannot be undone once actuated. ExergyNet's authorization gate for this program produces exactly three terminal states — release-eligible, hold, or incomplete — as an additional safety layer, deferring final authority to its own separate policy evaluation **(Figure 12)**.

Across two independent validation runs — a deterministic rule-based simulator and, separately, a real reasoning model — the governed gate held false-release at 0 of 50 cases on a sealed synthetic test set, against a 20-34% false-release rate for the same cases evaluated on ungoverned raw telemetry **(Figure 8)**.

**Validation scope.** This result is measured against a sealed, synthetic 50-case holdout; no real aircraft or sensor hardware was involved. A regulatory authorization exists for the related aircraft program permitting controlled testing and evaluation — a fact about that program's regulatory status, not a certification of this architecture.


## 8. Applications

The architecture stands independently of any one vertical; removing this section leaves it intact.

**Aviation (Section 7)** is the primary demonstrated consequence-active application. **Clinical decision support** is a second, illustrative case study: a clinical assistant must preserve an authoritative patient-state record across sessions, must not promote unresolved evidence into that record, and must keep model reasoning separate from any consequential action — properties this architecture is built to provide, presented here as an illustrative reference pattern rather than a deployed clinical integration.

Robotics and critical infrastructure, scientific and research agents, industrial automation, enterprise autonomous agents, financial and transactional agents, and secure machine-to-machine communications share the same underlying requirement — an identity-bound, evidence-backed, capability-scoped decision before a consequential action — and are architecturally applicable under the same protocol, without a bounded internal benchmark reported for each.


## 9. Validation Status and Research Frontier

Every component below is reported at its actual, current maturity stage: **Defined** (specified) -> **Implemented** (built) -> **Validated** (reproducibly exercised in a test envelope) -> **Pilot / Shadow** (running against real decisions, not yet the sole authority) -> **Production** (operating as the system of record).

| Component | Maturity | Boundary |
|---|---|---|
| xLMP / Exergy Vault | Production | Published local node (VMN); integrity is distinct from correctness |
| Compact Index / Adaptive Routing | Validated -> Partial production | Performance is workload-dependent |
| Vanguard (model routing) | Production | Proposes actions; does not self-authorize |
| Authority validator (identity/capability/freshness/integrity) | Production | Live-validated against a real adversarial run |
| Policy / capability gate | Pilot | Evaluates and logs every real decision; not yet the sole execution authority |
| xISA capability taxonomy | Validated | Isolated research environment; not yet production-active |
| Temporal Authority | Implemented, tested | Not yet production-activated |
| RHO resource metrology | Pilot | Not monetary; GPU-cost term currently modeled, not measured |
| Omega | Implemented | No live spending authority currently granted |
| MMS settlement | Validated | Test network only |
| AERIS (external evidence) | Validated | Test network; production settlement requires a further generation |
| Edge Witness (physical observation) | Production | Attests device signature, not physical truth |
| Execution-state continuity | Validated (same-process, short fresh-process) | Medium/long fresh-process and cross-node portability are the active frontier |
| Aviation pre-flight gate | Validated (synthetic holdout) | No real-aircraft validation yet reported |
| Physical-state observation (forward architecture) | Defined (proposed) | No implementation yet |

**Research frontier, stated plainly:** production-wide authority enforcement across every live route; true cross-process and cross-node execution-state portability; a physical-state observation primitive; and production-scale zero-knowledge verification integrated into the evidence-query path. These are named as frontiers because they are not yet true, not because the architecture cannot eventually reach them.


## Conclusion

The AI industry is building the vehicles: increasingly capable, increasingly numerous, increasingly heterogeneous models, built by frontier labs, open-model communities, and specialized vendors alike. That buildout is now measured in tens of billions of dollars of quarterly infrastructure investment and, by its largest supplier's own account, still accelerating. The models do not need to become interchangeable for that buildout to matter here — model plurality is precisely what makes shared infrastructure necessary, not optional.

**The AI industry is building the vehicles. ExergyNet is building the roads required when those vehicles become numerous, heterogeneous, persistent, and autonomous.**

More precisely: ExergyNet's objective is a common machine infrastructure in which intelligence can persist, establish identity, preserve evidence, exercise bounded authority, account for resources, and interact with the physical world — without requiring those functions to reside inside any single model. Its contribution is a substrate that keeps knowledge, evidence, capability, authority, economy, and execution state as separate, independently verifiable properties, so that intelligence can be swapped, can fail, or can be distrusted without the surrounding system losing what it knows, what it may do, or what it must account for. If every current frontier model were replaced tomorrow, the reason ExergyNet exists would be unchanged.


## References

1. NVIDIA Corporation. *NVIDIA Announces Financial Results for Second Quarter Fiscal 2027.* Press release, August 26, 2026.
2. NVIDIA Corporation. *CFO Commentary, Second Quarter Fiscal 2027.* August 26, 2026.
3. NVIDIA Corporation. Second Quarter Fiscal 2027 earnings call remarks (J. Huang), August 26, 2026.
4. Huang, J. Public remarks on land, power, and shell capacity for AI infrastructure, August 2026.
5. Sreeramaneni, R. (Micron). *Evolving Memory Architectures for AI.* Hot Chips 2026, Stanford University, August 23, 2026.
6. U.S. Provisional Patent Application No. 64/134,973, filed 2026 (formal claims subject to prosecution).
7. Federal Aviation Administration. Exemption No. 26214, Docket FAA-2025-5731.

*A full claim ledger, source registry, and revision history are maintained as separate internal diligence documents and are available on request.*
