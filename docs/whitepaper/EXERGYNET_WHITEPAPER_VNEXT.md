# ExergyNet: Shared Infrastructure for Abundant Autonomous Machine Intelligence

**A Systems / Technical-Architecture White Paper**

Seven Ezumba — Chief Architect and Corresponding Author, ExergyNet
2026 · Version VNext-Final (Phase-3 Publication Pass) · Classification: PUBLICATION READY

> **Status.** This manuscript finalizes VNext-D2 (`docs/whitepaper_vnext_recon/EXERGYNET_VNEXT_DRAFT_v2.md`) for
> publication: it adds the August 2026 industry-context material authorized in
> `WHITEPAPER_REBASE_DECISION_LOG.md` D-66–D-69, promotes the Tensile-Lift benchmark to a named claim
> (WP-C024), and adds the "when software becomes structural" framing and closing analogy requested by the
> publication-closure directive. It makes **no other new empirical claims, no evidence promotion, and no
> silent status changes** against the frozen Phase-1 ontology. Every quantitative or capability claim
> carries an evidence tier (**T1 Demonstrated** · **T2 Engineered/Emerging** · **T3 Research Frontier**)
> and a claim-ledger ID (`WP-C###`) traceable to `WHITEPAPER_CLAIM_LEDGER.md`. Numbers marked *[declared]*
> rest on an artifact whose independent re-hash is a pending verification item, stated as such.

---

## Abstract

As machine intelligence becomes abundant, heterogeneous, autonomous, and distributed across
organizations, computers, and physical systems, a structural gap appears that better models do not
close: independently built intelligences that share state, resources, actions, or consequences need
external mechanisms for identity, authoritative state, authority, interoperability, provenance,
transactions, resource accounting, and governance. A model answers *"what should I infer or do?"* It
does not, by itself, establish *who is acting, what state is authoritative, what is permitted, where
information originated, what it consumed, whether a transaction completed, or what physically happened.*
This gap is now visible at industry scale, not only in architecture diagrams: infrastructure investment
tied to AI has become a dominant line item in the technology economy, and the resources that sustain
machine intelligence — memory chief among them — have become contended and strategically managed.

**ExergyNet defines the shared machine infrastructure required when intelligence
becomes abundant, heterogeneous, autonomous, and distributed** — a governed substrate around
interchangeable reasoning engines that separates cognition from persistent state, identity, authority,
provenance, transactions, resource accounting, and physical-world verification. The organizing
invariant: **intelligence should not be required to provide its own infrastructure of trust.**

This paper derives the requirement before presenting the architecture, situates it against current
industry evidence, then reports measured evidence within stated envelopes and, separately, current
deployment state. Headline results — each bounded and placed in Part V, not used to define the thesis:
persistent memory that held prompt cost roughly flat (~660–820 tokens) as a corpus grew 8k→285k while
full-context grew to 67k and was rejected past 262k, with +24.4 accuracy points over a tested RAG
baseline at equal evidence budget (T1); a state-governance result where false authoritative-state
commitments fell 8%→0% with model accuracy flat at 84% (T1); a deterministic authority layer that
rejected a live prompt-injection after the reviewing model itself complied (T1); a synthetic-holdout
aviation pre-flight gate that held false-release at 0/50 across two independent runs against an
ungoverned 20–34% false-release baseline (T2, simulated witness only); a full economic strike settled on
a test network (T1 testnet); and a same-process execution-state restore that reproduced continuation
exactly while its cross-process counterpart did not — establishing execution state as a first-class
object and its general portability as an open frontier (T1/T3). Each result is stated with its exact
validated envelope and its next frontier: the authority-separation model is validated in test envelopes,
with production enforcement across live routes as the next stage; economic units are ExergyNet's
measured resource-cost accounting semantics, specified independently of any market-pricing mechanism;
and execution-state continuity is validated same-process and for short cross-process contexts, with
medium- and long-context cross-process continuation as the active frontier.

---

# Part I — When Intelligence Becomes Infrastructure

AI is moving from scarce, vertically integrated systems toward many independently built intelligences
interacting through shared digital and physical environments. Each still begins every invocation from
nothing durable: state is reconstructed at full cost, evidence is re-fetched without stable identity,
authority is implicit in whatever credentials the actor holds, and after an action there is no
independent, persistent account of why. This is a property of the architecture, not of any model, and
a more capable model does not change it.

**The conditional thesis.** *If* independent machine intelligences share state, resources, actions, or
consequences, *then* external coordination primitives become necessary — a necessity model quality
alone cannot supply. We do **not** claim that every abundant model population needs every such
primitive unconditionally; the necessity is conditional on shared state/resources/actions/consequences
and is derived (Part II), not assumed. Formally, consider a world with **N** independent intelligences,
architectural heterogeneity **H**, interaction density **D**, autonomy **A**, consequence magnitude
**C**, and administrative/policy domains **J**, and ask: *what system properties are required when
these grow large?* That question survives changes in model vendors, architectures, hardware, and
benchmarks — which is exactly why it, and not any benchmark, anchors this paper.

## 1.1 The industry signal: from model scaling to infrastructure scaling

This is no longer only an architectural argument; it is now visible in the disclosures of the companies
building frontier compute. On August 26, 2026, NVIDIA reported second-quarter fiscal-2027 revenue of
**$96.221 billion**, with Data Center revenue of **$89.023 billion (+117% YoY)**, split into AI Clouds,
Industrial & Enterprise at **$40.313 billion (+138% YoY)** and Edge Computing at **$7.198 billion
(+27% YoY)** [NVIDIA-Q2FY27]. CEO Jensen Huang characterized the shift plainly on the earnings call:
*"AI has reached its inflection point. It's doing useful work. Its tokens are productive and profitable.
Now, compute is revenue"* [NVIDIA-Q2FY27-CALL] — describing multiple frontier labs scaling in parallel, a
thriving open-model ecosystem, and physical AI coming online.

We read this evidence narrowly. It is **external, dated, industry-level evidence**, cited and attributed,
not ExergyNet evidence and not validation of this architecture. It matters to this paper for one reason:
it is direct confirmation, at the scale of the industry's largest infrastructure supplier, of the premise
this paper derives independently in Part II — that as machine intelligence becomes economically
productive and operates continuously at scale, the physical resources it consumes, and the infrastructure
coordinating their use, become as consequential as the models themselves. §2.5 returns to this evidence
in more technical detail, bounded to what it actually shows.

---

# Part II — Why Intelligence Cannot Supply Its Own Trust Infrastructure

## 2.1 Six axioms
- **A1 — Independent actors ⇒ external identity.** A model output does not intrinsically establish who
  produced it, what instance or device it represents, or what authority it holds. Identity is not
  solved by better reasoning. *(Axiom.)*
- **A2 — Local cognition ≠ authoritative shared state.** `Context_i ≠ SharedWorldState`; two models may
  simultaneously hold inconsistent representations. Persistent multi-party operation therefore requires
  external persistent state. *(Axiom — the causal origin of xLMP, not the reverse.)*
- **A3 — Reasoning does not create permission.** `Conclusion="execute"` does not imply
  `Authorized=true`. **Cognition ≠ Authority.** *(Axiom — the origin of LNES-22.)*
- **A4 — Heterogeneity ⇒ common semantics.** Unconstrained pairwise integration has **potential**
  quadratic complexity `N(N−1)/2 = O(N²)` — a bound on *potential* pairwise integration, **not** a claim
  that real networks generate N² traffic. A common protocol shifts the structure toward *N protocol
  implementations* rather than *O(N²) bespoke adapters*. *(Axiom / definition. This is the formal core of
  what we elsewhere call the infrastructure-pressure hypothesis — see §2.4 and Part IX.)*
- **A5 — Cross-actor dependency ⇒ provenance pressure.** If B acts on information from A, attribution
  and evidence matter whenever correctness, liability, reconstruction, authorization, or trust matter:
  `Observation → Transformation → Actor → Result`. Independent of whether actors are LLMs, neural
  operators, robots, humans, or conventional software. *(Axiom.)*
- **A6 — Autonomous shared action ⇒ transaction semantics.** Natural language does not establish
  atomicity, current state, ordering, commitment, rollback, authorization, receipt, or settlement.
  *(Axiom.)*

## 2.2 Derived requirements (conditional, from the axioms)
From the axioms follow, *as derived requirements* (not yet implementations): **identity, authoritative
state, authority, interoperability, routing, provenance, transactions, resource accounting, physical
evidence, and governance.** `Requirement Derived ⇏ Implementation Exists`; Parts IV–VI report which of
these ExergyNet actually implements and to what degree.

## 2.3 The deepest invariant, and a technical definition of trust
> **Intelligence should not be required to provide its own infrastructure of trust.**

A model should not simultaneously be database, identity provider, certificate authority, permission
system, transaction coordinator, provenance ledger, resource accountant, safety kernel, and physical
witness — those are separate system functions. Here **"infrastructure of trust" is a technical term**
for mechanisms that establish or enforce specific, checkable properties — identity, integrity,
provenance, authority, state continuity, execution evidence, and policy constraints — **not** a claim to
certify truth or trustworthiness. Cryptographic verification, where used, establishes **integrity and
attribution** properties; it does **not** establish physical truth.

## 2.4 What is derivable vs what is hypothesis (epistemic discipline)
We do **not** assert that raising N, A, H, or C monotonically raises every requirement; better models
can reduce operational burden (protocol translation, state compression, fewer routing errors, policy
automation). The defensible claim is narrower: *the need for external coordination primitives does not
disappear merely because individual intelligence improves.* Specific pressure relations (identity
pressure roughly with N; authority pressure with autonomy and consequence; etc.) are **empirical
hypotheses to be measured**, not laws — together, the **infrastructure pressure hypothesis**: shared
state/resource/action/consequence conditions, not model count alone, are what predict where external
coordination primitives become necessary (Part IX returns to this). And we separate the **technical
necessity** of these primitives (which anchors the architecture) from the **market hypothesis** that
they consolidate into a few dominant substrates (plausible, unproven — a strategy question, out of scope
here): **Technical Infrastructure Requirement ≠ Market Consolidation Outcome.**

## 2.5 The resource economy of abundant intelligence
A second consequence follows from the same premise. When intelligence was scarce and episodic, the
physical resources that sustain it read as invisible implementation cost. When independent
intelligences operate *continuously* and at scale, those resources become scarce, measurable, and
economically relevant. Intelligence in that regime is not compute alone:

> **Intelligence = Compute + Memory + Storage + Transport + State Movement + Energy + Time.**

Each term is a resource that continuously operating autonomous systems must **preserve, route,
allocate, and account for** — which is precisely why *resource accounting* appears among the derived
requirements (§2.2), not as an afterthought. The clearest illustration is the reconstruction cost of
statelessness: if every agent rebuilds its world each time it changes model, machine, provider, or
session, the system is making every vehicle **rebuild the road behind itself every time it moves** — an
architecture that grows more irrational exactly as memory and compute grow more constrained. Persistent
state changes that equation; portable execution state changes it again; resource accounting completes
the economic side. The infrastructure progression is therefore:

> **Persistent Memory → Persistent State → Portable State → Resource Measurement → Resource Authority → Machine Economy**

which maps directly onto ExergyNet's layers (Parts IV–V): xLMP reduces repeated reconstruction of known
state; execution-state continuity preserves active machine state instead of recomputing from scratch;
and RHO/Omega/MMS give autonomous systems a structure to measure, authorize, and settle the resources
their actions actually consume.

**External evidence for the shift (industry-level; not ExergyNet evidence).** In the same August 26,
2026 disclosure introduced in §1.1, NVIDIA reported that supply and capacity purchase commitments rose
from **$119 billion to $279 billion** quarter-over-quarter — an increase its CFO, Colette Kress,
attributed primarily to the procurement of memory [NVIDIA-Q2FY27-CFO]. NVIDIA further characterized
land, power, and data-center shell capacity — resources external to the chip itself — as the next
critical resource for AI factories [NVIDIA-LPS]. Three days earlier, at Hot Chips 2026 (Stanford,
August 23, 2026), Micron HBM Design Architecture Fellow Raghu Sreeramaneni presented "Evolving Memory
Architectures for AI," reporting that compute performance has scaled roughly **3× every two years**
while HBM bandwidth has scaled **less than 2×** over the same period; that HBM already occupies
approximately **90% of the semiconductor area** in a typical multi-stack GPU package for equivalent
capacity versus conventional DRAM; and that HBM's stacked geometry increasingly constrains thermal
design, with the high-speed base region generating substantial heat beneath the upper layers and cooling
structures [MICRON-HC2026].

We do not interpret these figures as validation of ExergyNet — none of them are ExergyNet evidence, and
they are cited exactly as reported, dated and attributed. We interpret them narrowly, as direct economic
and technical confirmation that memory, capacity, land, power, network, and physical infrastructure have
become strategic, contended inputs to machine computing — the premise this section derives
independently, above. Hardware vendors are responding by increasing bandwidth, capacity, packaging
density, cooling capacity, and system integration; that is necessary progress and a separate line of
work from this paper's contribution. xLMP (Part IV, Part V) attacks a different variable, available
regardless of hardware generation: the amount of persistent information that must be repeatedly moved,
reconstructed, and processed inside a model's active context. The principle is not *move data faster*
but *avoid moving and reprocessing information that does not need to move* — a software-architecture
lever that composes with hardware improvement rather than competing against it, and that does not
extrapolate measured throughput gains (Part V) into unmeasured claims about hardware temperature,
energy, or universal GPU utilization.

If, as NVIDIA's CEO frames it, machine output is now economically productive ("compute is revenue"),
then the resources consumed to produce that output — compute, memory, storage, network, energy, time,
and state reconstruction — become economically significant in their own right, and autonomous machine
infrastructure eventually requires resource measurement, bounded economic authority, allocation,
accounting, settlement, and auditable policy for consuming them (§2.2). This is precisely the role of
RHO, Omega, and MMS (Part IV, Plane III; Part V §5.5–5.6). We make no claim that NVIDIA's commentary
validates this architecture: NVIDIA describes the economics at the AI-factory level; ExergyNet addresses
resource authority and accounting at the level of the individual machine identity, within and across
such infrastructure.

---

# Part III — The ExergyNet Architecture

Only now does ExergyNet appear — as one *proposed architectural response* to the derived requirements.
The abstraction boundary is **Model | ExergyNet | Digital/Physical World**: models generate cognition;
ExergyNet governs shared state and interaction; the world supplies consequences. The reasoning engine
is interchangeable — GPT, Claude, Nemotron, an open-weight model, a neural operator, an MPC controller,
a symbolic planner, a human operator, or something not yet invented.

## 3.1 Three planes (organizational abstraction — `Plane Membership ≠ Deployment State`)
- **Plane I — Knowledge & State** (*what exists, what happened, what is currently authoritative?*):
  xLMP / Exergy Vault, deterministic indexing/routing, Temporal Authority (transition evidence),
  provenance, Edge Witness, and the physical-state representation requirement (addressed by the
  **PROPOSED** LNES-120 PSO, Part VII).
- **Plane II — Coordination & Authority** (*who may interact with what, under what constraints?*):
  machine identity, xISA capability taxonomy, Vanguard routing, LNES-22 Consequence Boundary, policy,
  transaction state, AERIS.
- **Plane III — Resource & Economic Coordination** (*what was consumed, committed, authorized,
  settled?*): RHO resource accounting, Omega, MMS.

Plane membership is a presentation abstraction; it does not assert that each plane is an independently
deployed subsystem, nor that any listed component is implemented (see Part VI).

## 3.2 The organizing separations, and their honest strength
ExergyNet keeps distinct predicates apart by construction: memory evidence ≠ execution authority;
model identity ≠ agent identity; agent identity ≠ economic authority; economic authority ≠ consequence
authority; transition evidence ≠ authorization; state portability ≠ authority transfer; resource
accounting ≠ market value (WP-C020). **These separations are defined and validated within test
envelopes; production enforcement across all live routes is the next validation stage**
(`LNES22_ENFORCEMENT_CHANGED=NO`; the controlled-production activation gate is the current boundary; the
precise per-component status is in the Part VI matrix). Throughout,
"the architecture does X" means the protocol defines/validates X; live enforcement is stated separately
(Part VI). **Protocol Capability ≠ Deployment State.**

## 3.3 Security posture
ExergyNet's posture is **assume the model is compromised**: consequential authorization is placed
outside the model so protected actions can be evaluated deterministically even when the originating
intelligence is untrusted. Prompt injection, jailbreaks, and misbehavior are handled the same way — the
deterministic gate does not ask the model whether its own output should be trusted (evidence in Part V).

## 3.4 When software becomes structural

As machine intelligence moves from producing information to controlling consequential systems —
financial transfers, infrastructure changes, physical actuation — the software governing that transition
stops being an implementation detail and becomes part of the system's load-bearing structure, in the
sense that a bridge's structural members, not its paint, keep it standing. A bridge is not safe because
its structure is correct on average; when a consequence-active transition is underway, the governing
invariants must hold for *that* transition, not merely for the distribution of transitions overall.

Stated formally, for any transition *t* in the set of actively consequential state transitions:

> ∀ t ∈ ActiveConsequenceState: Authorized(t) ∧ ValidState(t) ∧ EvidenceBound(t)

This is a structural requirement, not a performance target: a system that is correctly authorized 99% of
the time has not satisfied it. The architectural consequence is direct: **reasoning and authority cannot
be the same thing.** Models reason; a separate authority layer determines whether a consequential
transition may actually occur (A3, §2.1). This is the derived requirement that Temporal Authority
(transition evidence), xISA, LNES-22, and AERIS each address from a different angle — chronology,
capability vocabulary, the authorization gate itself, and external-evidence provenance, respectively —
without any of them performing the others' role or standing in for the whole (Part IV). Their current
validation and deployment states, including the boundary that policy enforcement is presently
shadow-mode and not yet the sole authority over production execution, are reported without euphemism in
Part V and Part VI.

---

# Part IV — Protocol Components

Each component begins with the **derived requirement it addresses**, then its bounded description and
current status. This is a decomposition, not a catalog.

## Plane I — Knowledge & State
- **Persistent shared state ⇒ xLMP / Exergy Vault.** Root-addressed persistent evidence with bounded
  delivery, separating three properties that are dangerous to merge: a SHA-256 **content root**
  (integrity) is not **provenance** (a signed creation record), and neither is **authority** (decided
  elsewhere). "Authoritative state" is a *governance status* — the representation a governance domain
  recognizes as controlling for an operation under its provenance/freshness/authority/evidence rules —
  **not** objective truth. **VMN** is the local/private xLMP node over MCP (published, WP-C019). xLMP is
  foundational but is one plane; **ExergyNet ≠ xLMP**. *(Evidence: Part V.)*
- **Deterministic evidence access ⇒ Compact Index (LNES-84) + Adaptive Routing (LNES-86).** Same query
  over same committed state returns the same bounded evidence; performance is **workload-dependent**
  (Part V), with **no universal O(1) or universal speedup claim**.
- **State chronology / supersession ⇒ Temporal Authority (transition evidence).** Durable records that
  a transition occurred, in order, unaltered, and fresh. **Transition evidence ≠ authorization.**
  Engineered and tested but **not production-activated** (Part VI). *(We use "transition evidence /
  Temporal Authority"; a distinct "TransitionWitness" subsystem name is **held** pending a defining
  source artifact.)*
- **Physical observation ⇒ Edge Witness (LNES-06).** Hardware-signed device observations. A hardware
  signature attests an authorized device signed an observation; it is **not a physical-truth guarantee.**
- **Physical-state representation ⇒ LNES-120 PSO — PROPOSED** (Part VII only; no implementation).

## Plane II — Coordination & Authority
- **Independent actors ⇒ machine identity (Ed25519).** Distinct from model identity and economic
  identity. **Identity ≠ Authority.**
- **Capability representation ⇒ xISA.** A machine-readable capability/authority vocabulary for
  consequence classes (financial, infrastructure, credential, physical, destructive). **xISA is not
  authority itself**; research-validated in isolation, not production-active (Part V/VI).
- **Intelligence routing ⇒ Vanguard.** Model selection, orchestration, and execution coordination over
  bounded evidence. **Vanguard proposes; it does not self-authorize.** Model-neutral by design; an
  OpenAI-compatible surface is one implemented adapter.
- **Reasoning ≠ permission ⇒ LNES-22 Consequence Boundary.** A deterministic gate external to the model:
  a proposed action must clear **identity → capability → freshness → integrity** before it is treated as
  authorized; failing any is a denial. *This describes the protocol; current deployment (validator live,
  policy gate shadow) is in Part VI.*
- **Cross-actor dependency ⇒ AERIS.** Authenticated external-data acquisition binding provenance; it
  attests data was obtained as represented, **not** that the external source was truthful.

## Plane III — Resource & Economic Coordination
- **Autonomous shared action ⇒ resource accounting (RHO).** A **resource-cost accounting reference
  unit**, defined by a fixed normalization constant and specified **independently of market price,
  redemption, or energy interpretation** (Part V). Shadow-only.
- **Spending/resource authority ⇒ Omega.** Scoped economic operations for a machine identity; **economic
  authority ≠ consequence authority**; current `AUTHORITY_MODE=NONE`.
- **Settlement ⇒ MMS.** Signed-receipt settlement of economic operations, demonstrated on a **test
  network only** (Part V). **testnet ≠ production financial settlement.**

---

# Part V — Experimental Evidence

*Which parts of the proposed architecture have actually been exercised, and under what envelope?* Every
number is bounded and carries a claim-ledger ID; none are blended. This section is deliberately explicit
about failures and boundaries.

## 5.1 Persistent state & memory (xLMP)
On a single NVIDIA H200 with a Nemotron-class model over a synthetic corpus (evidence package EVD-001,
whose SHA-256 was **independently recomputed and matched**): prompt tokens stayed roughly flat at
**~660–820** as the corpus grew 8k→285k, while full-context injection grew **11k→67k** and was rejected
past **262k** (WP-C001); retrieval accuracy at equal 3,000-char evidence budget was **92.4% (xLMP) vs
68.0% (RAG) = +24.4 points** (WP-C002); at each method's best SLA-compliant load, xLMP delivered
**~11.3× the correct-task throughput of full-context** (WP-C003a). A separate useful-answer-per-token
efficiency of **~42.7× vs full-context / ~4.0× vs RAG** is reported in the EVD-002 addendum, whose
artifact re-hash is a pending verification item; the figure is carried as *[declared]* (WP-C003b).

**Architectural significance (efficiency as capacity).** Within this tested envelope, xLMP reduces the
context that must be staged into and processed through the accelerator's active working memory per
operation, so the same physical infrastructure sustains more useful machine work per unit of memory and
time. That reframes the result: it is not only a cost reduction but a **capacity property** — under
constrained memory and compute, delivering more intelligence from fixed physical resources is
architecturally distinct from delivering the same intelligence more cheaply. This significance is stated
for the tested workload; broader-scale validation is part of the continuing scaling program.

## 5.2 State governance
In a procurement-state validation over 100 real cases (LNES-59), model judgment accuracy stayed flat at
**84%** while **false authoritative-state commitments fell from 8% to 0%** (WP-C004). *In the tested
cases* the substrate prevented unresolved evidence from being promoted into authoritative system state;
this is an observed result within that envelope, not a proven universal property.

## 5.3 Deterministic access
Compact Index (LNES-84): **52,753.8×** median paired speedup in a narrow 1GB/100-query population (95%
CI [42,014×, 56,537×]) but **0.72×** aggregate median in a realistic 10MB mixed vault (WP-C005) — stated
together; workload-dependent. Adaptive routing (LNES-86): **~1.92×** vs always-full-scan and **~1.13×**
vs static compact-index within a frozen holdout, evidence parity 231/231 (WP-C006).

## 5.4 Authority (the strongest result)
A live prompt-injection payload was sent to a running LNES-22 review listener; the **reasoning model
partially complied** (returned an approval, did not flag the injection). The **deterministic validation
layer rejected it in the tested run** before any signed review could be produced; no credential was
exposed in that path, key material being — by construction of the tested path — not included in what
reaches the model. Reproduced after a durable-logging fix. The finding, bounded to this validated run:
**the model can fail adversarially without the authority system failing with it** — a demonstration
within its envelope, not a universal guarantee (WP-C007). Verified counts: **64** assertions across
three LNES-22 unit scripts (23+20+21); **38/39** Omega Carrier adversarial tests; **100/100** concurrent
double-allocations serialized. xISA: **106/106** functional tests over a 10,000-decision corpus with a
100,000-decision performance benchmark, **in an isolated research environment** (WP-C010).

## 5.5 Economic authority & settlement
A full three-operation economic strike (recall/write/query) settled end-to-end on **Base Sepolia
testnet**: per-model allowances granted, spent to zero, every replay reverted; **500 RHO** total settled
(recomputed two ways: routing 70+70+70+220+70 and per-key 100+250+150), 30/30 contract-specific tests
(WP-C011). The chain establishes settlement execution, allowance state, treasury routing, and
signed-receipt acceptance on a test network — the first end-to-end economic-settlement cycle for the
protocol. Production-scale and multi-principal settlement, and any market valuation of settled units,
define the next stages.

## 5.6 Resource metrology (RHO)
A metrology harness (revised through a validation gate fixing 21 first-version deficiencies) measured
per-operation cost on an Azure A10-class Auditor node and an AWS c6a.large Portal node, fixing a genesis
(G0) base-cost basis: **one RHO is a reference capacity-cost unit** whose µRHO value = non-overlapping
infrastructure cost in USD ÷ a fixed constant **$0.0001000000** (1,000,000 µRHO/RHO). Base equivalents:
RECALL 494–660, WRITE 759–1,028, QUERY 25,110,000–106,800,000 µRHO (WP-C012). The RECALL and WRITE bases
are measured host-side; the QUERY base is dominated by GPU inference cost, **modeled from pricing data**
(`AUDITOR_GPU_NOT_MEASURED=YES`), with direct GPU-side and energy instrumentation as the next metrology
stage, and token counts recorded via a word-count proxy (`TOKEN_COUNTS_AUTHORITATIVE=NO`) —
Measured ≠ Modeled is preserved throughout. By specification, **RHO functions as ExergyNet's
resource-cost accounting unit**, its normalization and settlement semantics defined **independently of
any market or token price, redemption mechanism, or physical-energy interpretation**.

## 5.7 Execution-state continuity (a first-class object, and a characterized negative)
On a Nemotron-class hybrid KV/SSM runtime, **same-process** erase-and-restore reproduced continuation
token-exactly across all tested contexts (**10/10 in each of SHORT/MEDIUM/LONG — 30/30 aggregate**,
WP-C013); on the checked subset, capsule bytes were bit-perfect (**9/9**). **True fresh-process** restore
reproduced continuation token-exactly for short contexts (**SHORT 10/10**); for medium and long contexts
fresh-process continuation diverged (**MEDIUM 0/10, LONG 0/10**, WP-C014) — a characterized result that
yielded the paper's central state discovery: **serialized-state equality is not live-execution-state
equality.** The capsule bytes were bit-perfect, and the medium/long divergence was **localized to
runtime cache reconstruction semantics** (mechanism under continuing investigation) (WP-C015).
Medium- and long-context cross-process continuation is the next validation boundary.

## 5.8 Verification / receipts
The default Vault query returns a **SHA-256 content receipt** establishing integrity and attribution,
distinct from a zero-knowledge proof; a separate asynchronous path produced a **genuine Groth16 proof**
for a minimal object on CPU (~13.5 min), establishing the real-proof path end-to-end (WP-C018).
Production-scale ZK verification integrated into the query path is the next stage. A ledger anchor
establishes ordering and durability; semantic correctness of off-chain claims is a separate property.

## 5.9 Physical-consequence authorization (aviation pre-flight gate, synthetic holdout)
As a bounded test of the authority layer in a physical-consequence domain (introduced as a case study in
Part VIII), two independent validation runs were executed against a sealed 50-case synthetic holdout
covering 20 adversarial test classes (≥2 instances each): a deterministic rule-based reference simulator
(Phase 1) and a real probabilistic model, claude-sonnet-5 (Phase 1.5). **All witness data was
`SIMULATED_WITNESS`; no real sensor hardware or aircraft was involved at any stage.** Governed by the
LNES-22 gate, false-release rate was **0/50 in both phases**, with 100% release accuracy and zero false
holds; ungoverned raw telemetry alone produced a **34% (Phase 1) / 20% (Phase 1.5)** false-release rate
over the identical holdout (WP-C024). This is evidence within a synthetic, sealed-holdout envelope —
not a flight-tested, hardware-in-the-loop, or production result.

## 5.10 Consolidated results (envelopes travel with numbers)
| Domain | Result | Envelope | Tier | ID |
|---|---|---|---|---|
| Memory efficiency | ~660–820 flat; full-ctx→67k rej >262k | H200/Nemotron/synthetic (EVD-001 hash-verified) | T1 | WP-C001 |
| Memory quality | +24.4 pts (92.4/68.0); ~11.3× throughput | tested H200 workload (EVD-001) | T1 | WP-C002/C003a |
| Memory quality (UAT) | ~42.7× / ~4.0× | EVD-002 addendum — re-hash pending | T1 *[declared]* | WP-C003b |
| State governance | 8%→0% false commits; acc 84% | 100 procurement cases | T1 | WP-C004 |
| Indexing | 52,753.8× narrow / 0.72× realistic | 1GB/100-q vs 10MB mixed | T1 | WP-C005 |
| Routing | ~1.92× / ~1.13× | frozen holdout (231/231 parity) | T1 | WP-C006 |
| Authority | live injection rejected; 64; 38/39; 100/100 | live listener; unit/isolation | T1 | WP-C007 |
| Capability | 106/106 | isolated research env | T2 | WP-C010 |
| Settlement | 500-RHO strike; replays reverted | Base Sepolia testnet | T1 (testnet) | WP-C011 |
| RHO metrology | G0 µRHO basis | A10/c6a; GPU/energy unobserved; token proxy | T2 | WP-C012 |
| Execution state | same-proc 30/30 agg; fresh SHORT 10/10, MED/LONG 0/10 | Nemotron-class hybrid KV/SSM | T1/T3 | WP-C013/C014 |
| Physical-consequence gate | 0/50 false release (both phases) vs 20–34% ungoverned | sealed synthetic 50-case holdout, simulated witness only | T2 | WP-C024 |

---

# Part VI — Current Deployment State

Deployment interpretation is quarantined here. **Defined** = specified/architected; **Implemented** =
exists in source/deployed; **Validated** = reproducibly exercised in a test envelope; **Deployed** =
operating in production.

| Component / capability | Defined | Implemented | Validated | Deployed | Current boundary |
|---|:--:|:--:|:--:|:--:|---|
| xLMP / Exergy Vault | ✓ | ✓ | ✓ | ✓ (VMN published) | integrity ≠ correctness; not all of ExergyNet |
| Compact Index / Routing | ✓ | ✓ | ✓ | partial | workload-dependent; no universal speedup |
| Vanguard | ✓ | ✓ | ✓ | ✓ (multi-model) | proposes; does not self-authorize |
| LNES-22 (deterministic validator) | ✓ | ✓ | ✓ | ✓ | live-validated in tested run |
| LNES-22 (policy/capability gate) | ✓ | ✓ | ✓ | **shadow-mode** | **no live consequence gated** |
| xISA | ✓ | ✓ | ✓ (isolated) | ✗ | not production-active |
| Temporal Authority | ✓ | ✓ | ✓ | **not activated** | migrations not applied; failure-domain independence not achieved |
| RHO metrology | ✓ | ✓ | ✓ | **shadow-only** | not money; not activated; GPU term modeled |
| Omega | ✓ | ✓ | ✓ | tools deployed | `AUTHORITY_MODE=NONE` |
| MMS | ✓ | ✓ | ✓ (testnet) | **testnet only** | no mainnet/production settlement |
| AERIS | ✓ | ✓ | ✓ (testnet) | dev proving mode | Gen4 required for live settlement |
| Edge Witness (LNES-06) | ✓ | ✓ | ✓ | ✓ (Android) | not a physical-truth guarantee |
| LNES-119 execution state | ✓ | ✓ | same-process only | ✗ | cross-process **not** achieved (frontier) |
| LNES-120 PSO | ✓ (proposed) | ✗ | ✗ | ✗ | **PROPOSED — no implementation** |
| TransitionWitness | — | ✗ | ✗ | ✗ | **HELD — no defining artifact** |
| Aviation pre-flight gate (Tensile-Lift target domain) | ✓ | ✓ | ✓ (synthetic holdout only) | ✗ | no real aircraft/sensor validation yet |

---

# Part VII — Forward Architecture (Proposed)

These are **proposed**, not forthcoming fact.
- **LNES-120 PSO (Physical-State Observation / representation) — PROPOSED (WP-C022).** Part II derives a
  *physical-state representation requirement*; LNES-120 PSO is a proposed response. **No implementation,
  validation, or deployment is claimed**, and no source artifact defines it yet.
- **Planned within existing components:** durable (cross-restart) replay protection for the authority
  gate; enterprise memory namespaces; production-scale ZK verification integrated into the query path;
  independent external benchmark replication; live economic activation. Each remains PLANNED, not active.
- **TransitionWitness** naming remains **held** pending a defining artifact; the evidenced term is
  "transition evidence / Temporal Authority."

---

# Part VIII — Vertical Application (Case Studies)

The architecture above stands on its own; removing this section leaves it intact. Verticals are
downstream **consumers**, not definitions. They are presented in order of how directly they exercise a
consequence-active authority decision — physical aviation first, then a clinical decision-support
vertical, followed by domains that are architecturally applicable but not yet the subject of a bounded
internal benchmark.

**Tensile-Lift heavy-lift UAV (KTX; architecture-design-phase target domain) — the primary
consequence-active example.** A heavy-lift uncrewed aircraft is an unusually clear illustration of what a
consequence-active domain demands: a physical machine with real authority to release cargo or return to
service, continuous telemetry, hard resource constraints, explicit safety invariants, and consequences
that cannot be undone once actuated. ExergyNet's initial output for this target domain is an engineering
pre-flight authorization gate producing exactly three terminal states — `RELEASE_ELIGIBLE`, `HOLD`,
`INCOMPLETE` — layered as an additional safety check; it does not claim autonomous FAA return-to-service
authorization and does not substitute for any legally required inspection or human signoff, and LNES-22
performs its own separate policy evaluation before any action authority is granted. The measured result
(§5.9, WP-C024): governed by the LNES-22 gate, false-release rate held at **0/50 across two independent
validation runs** — a deterministic rule-based simulator and, separately, a real probabilistic model —
against a **20–34% false-release rate for ungoverned raw telemetry** on the identical sealed 50-case
holdout. All witness data was simulated; no real sensor hardware or aircraft was involved.

The FAA Exemption No. 26214 (Docket FAA-2025-5731) exists for the related VSG-HL-01 ("Bolt") platform,
authorizing controlled testing, evaluation, and demonstration operations at up to 275 lb MTOW — a
**KTX/VSG regulatory fact** (WP-C021), stated here because it establishes that this target domain is a
real, regulator-acknowledged aviation program, not a hypothetical. It is **not** an FAA validation or
endorsement of ExergyNet or of any cryptographic actuation boundary (NEURO-LOCK, which is designed, not
claimed as deployed), and the exemption does not validate this architecture.

**MyMonitor (clinical vertical — illustrative case study), second.** MyMonitor is presented as an
illustrative clinical case study / candidate reference implementation for how the substrate *would* be
consumed — not a claim of a verified deployed MyMonitor↔ExergyNet integration (no such artifact is cited
here). It is instructive because a clinical assistant must preserve authoritative patient-state across
sessions (governance-recognized controlling record), must not promote unresolved evidence into a record,
and must keep model reasoning separate from any consequential action. ExergyNet is not a MyMonitor
backend and does not depend on it; clinical terminology stays in this section.

**Other domains (architecturally applicable, not yet the subject of an internal benchmark).** Robotics
and critical infrastructure, scientific and research agents, industrial automation, enterprise
autonomous agents, financial and transactional agents, and secure machine-to-machine communications each
share the same structural need — an identity-bound, evidence-backed, capability-scoped authority
decision before a consequential action — and each is *architecturally applicable* under Part III–IV's
protocol. None is claimed as a deployed use case here; none has a WP-C evidence entry beyond the general
architecture claims in Part V.

---

# Part IX — Implications for Model-Independent AI Infrastructure

If state, evidence, authority, accountability, and — eventually — execution state persist independently
of the model, an organization's operational substrate is no longer captive to a single model provider:
memory is not owned by the model vendor, authorization is not implicit in a vendor key, accountability
outlives any inference session. This is an **architectural** property; the specific provider adapters
that implement it are stated separately and are not claimed exhaustive. Whether these requirements
*consolidate* into a few dominant substrates is a **market hypothesis** — the infrastructure pressure
hypothesis of §2.4 speaks to *when coordination primitives become necessary*, not to *how many
substrates the market ultimately supports* — and the latter question is out of scope here.

# Part X — Conclusion

The AI industry is building the vehicles: increasingly capable, increasingly numerous, increasingly
heterogeneous models, built by frontier labs, open-model communities, and specialized vendors alike. As
§1.1 and §2.5 report, that buildout is now measured in tens of billions of dollars of quarterly
infrastructure investment and is, by its largest supplier's own account, still accelerating. The models
do not have to become interchangeable for that buildout to matter to this paper's thesis — model
plurality is precisely what makes shared infrastructure necessary, not optional.

**The AI industry is building the vehicles. ExergyNet is building the roads required when those vehicles
become numerous, heterogeneous, persistent, and autonomous.** More precisely: ExergyNet's objective is a
common machine infrastructure in which intelligence can persist, establish identity, preserve evidence,
exercise bounded authority, account for resources, and interact with the physical world without
requiring those functions to reside inside any single model.

ExergyNet reframes the unit of AI infrastructure from *the model* to *the governed environment around
the model*, derived from a single conditional premise: independently built intelligences that share
state, resources, actions, or consequences create external requirements that model improvement can make
cheaper but cannot eliminate. Its contribution is a substrate that keeps knowledge, evidence, capability,
authority, economy, and execution state as separate, independently verifiable predicates — so
intelligence can be swapped, can fail, and can be distrusted without the surrounding system losing what
it knows, what it may do, or what it must account for. The measured results establish the foundation
within honest envelopes; the open frontiers — production authority enforcement, true execution-state
portability, a physical-state primitive — are named as frontiers, not disguised as achievements. If
every current frontier model were replaced tomorrow, the reason ExergyNet exists would be unchanged.

---

## Appendix A — Terminology (selected, per `SEI_1D_CANONICAL_ONTOLOGY.md`)
**Infrastructure of trust** — mechanisms enforcing identity/integrity/provenance/authority/state-
continuity/execution-evidence/policy; not truth certification. **Authoritative state** — governance
status recognized as controlling; not objective truth. **RHO** — resource-cost accounting reference
unit; not money/price/energy. **Execution state** — transient runtime state; serialized ≠ live.
**Infrastructure pressure hypothesis** — the empirical (not lawlike) hypothesis that shared
state/resource/action/consequence conditions predict where external coordination primitives become
necessary (§2.4). Frozen distinctions: Identity ≠ Authority · Integrity ≠ Truth · Evidence ≠
Permission · Accounting ≠ Money · Protocol Capability ≠ Deployment State · VALIDATED ⇏ Production ·
Measured ≠ Modeled · Technical Requirement ≠ Market Consolidation.

## Appendix B — Claim Ledger & Preservation
See `WHITEPAPER_CLAIM_LEDGER.md` (WP-C001–C024) and `SEI_2_CLAIM_PRESERVATION_DIFF.md`. No quantitative
claim appears without a ledger entry, envelope, and tier.

## Appendix C — Evidence Records, Hashes, and External Citations
**Internal evidence:** EVD-001 H200 package `7005fa07…2204` — **independently recomputed = matched**.
EVD-002 addendum `97559fb4…1534f` — declared; independent re-hash pending. LNES-119 runtime bundle
`db62a45201…f860c`. RHO: genesis `5325971c…`, cost-equivalents `c397ae67…`. **Unverified:** raw RHO
campaign dataset (`UNVERIFIED_OTET_GATED`). Full detail: `LNES116_EVIDENCE_CLOSURE_2026-08-25.md`,
`SEI_1C_QUANTITATIVE_BENCHMARK_AUDIT.md`.

**External citations (industry context, §1.1/§2.5 — not ExergyNet evidence):**
- **[NVIDIA-Q2FY27]** NVIDIA Corporation, "NVIDIA Announces Financial Results for Second Quarter Fiscal
  2027," press release, August 26, 2026.
- **[NVIDIA-Q2FY27-CFO]** NVIDIA Corporation, CFO Commentary, Second Quarter Fiscal 2027, August 26, 2026
  (Colette Kress).
- **[NVIDIA-Q2FY27-CALL]** NVIDIA Corporation, Q2 FY2027 earnings call, August 26, 2026 (Jensen Huang,
  remarks as reported contemporaneously by multiple financial press outlets).
- **[NVIDIA-LPS]** Jensen Huang, public remarks characterizing land, power, and shell ("LPS") capacity as
  a critical resource for AI factories, August 2026, as reported contemporaneously by multiple technology
  press outlets.
- **[MICRON-HC2026]** Raghu Sreeramaneni (Micron, HBM Design Architecture Fellow), "Evolving Memory
  Architectures for AI," Hot Chips 2026, Stanford University, August 23, 2026, as reported
  contemporaneously by multiple technical press outlets covering the presentation.

See `WHITEPAPER_SOURCE_REGISTRY.md` for the full verification record (URLs, retrieval method, and
verification notes) for each external citation.

## Appendix D — Open / Proprietary Boundary
Interfaces, trust boundaries, methodology, and measured outcomes are published. Segment construction,
retrieval heuristics, routing mechanics, private circuits, capability schemas, replay internals, and
security-sensitive implementation details remain confidential.

## Appendix E — Patent Reference
Described in a pending **U.S. Provisional Patent Application No. 64/134,973, filed 2026** (high-level;
formal claims subject to prosecution). "Identity is not authority" is stated as an organizing principle.

## Appendix F — Revision Log
- **VNext-Final (2026-08-27):** Phase-3 publication pass. Added §1.1 (industry-context introduction),
  extended §2.5 with the bounded NVIDIA/Micron external evidence (superseding the prior "kept in the
  separate strategy record" note per decision D-66), added §3.4 ("When software becomes structural"),
  promoted the Tensile-Lift aviation-gate benchmark to a named claim (WP-C024, new §5.9, restructured
  Part VIII to lead with it), added the closing vehicles/roads framing to Part X. No prior claim
  weakened, no evidence promoted beyond its tested envelope, no frozen invariant relaxed. See
  `WHITEPAPER_CHANGELOG.md` for the itemized diff and `WHITEPAPER_REBASE_DECISION_LOG.md` D-66–D-69 for
  the authorizing decisions.
- **VNext-D2 (2026-08-25):** Phase-2 structural restructure of D1 onto the derivation-first hierarchy
  (Conditions→Axioms→Requirements→Architecture→Components→Evidence→Deployment→Forward), benchmarks moved
  into Part V. No new claims, no evidence promotion, no status changes; claim-preservation diff recorded.
- **VNext-D1 (2026-08-25):** first clean-sheet draft; supersedes v1.9 baseline (`AI_MEMORY_CONTROL_PLANE.md`,
  frozen source repository).
