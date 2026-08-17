# xLMP and the AI Memory Control Plane

**Persistent State, Bounded Evidence, and Portable Memory
Beyond the Model Context Window — Digital and Physical**

A Technical White Paper

---

**Seven Ezumba**
Chief Architect and Corresponding Author
ExergyNet

**Bontu Veena**
H200 Saturation Testing and Benchmark Validation; QPS Ladder Analysis
ExergyNet
[CO-AUTHOR ACCEPTANCE: PENDING FINAL REVIEW]

**Kyaw Phone**
Systems Engineering and Application Architecture
ExergyNet
[CO-AUTHOR ACCEPTANCE: PENDING FINAL REVIEW]

---

August 2026
**Version 1.9 — Internal Co-Author Review Draft**
Public Classification: OPEN (pending co-author confirmation and legal-entity resolution)
Document Hash: [pending]

Canonical source: `exergynet/docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md`
Claim Ledger: `exergynet/docs/whitepaper/CLAIM_LEDGER.md`
Evidence records: `exergynet/docs/whitepaper/evidence/README.md`
Maintenance policy: `exergynet/LWP_MAINTENANCE_POLICY.md`

---

## Publication Notice

This paper describes the architectural principles, category definition, and
design philosophy of xLMP, the ExergyNet Ledger Memory Protocol, and the
AI Memory Control Plane category. Security-sensitive implementation details,
private key material, deployment credentials, internal infrastructure topology,
and proprietary resolver mechanics are excluded from this publication. Benchmark
data is drawn from signed, internally-verified deliverables identified in the
evidence directory. Performance claims identify their test conditions and
evidence identifiers. Individual claims are categorized in `CLAIM_LEDGER.md`.
This document does not constitute a financial prospectus or investment
solicitation.

The companion paper to this publication is:
*LNES-22 and the Agent Authority Control Plane:
Cryptographic Delegation and Deterministic Authorization for Autonomous Systems*

The relationship between the two papers:

> xLMP governs the evidence available to an agent.
> LNES-22 governs consequential actions requested by that agent.

**Co-Author Note (internal — remove before final publication):**
Bontu Veena and Kyaw Phone are listed as proposed co-authors pending their
independent confirmation of: (1) acceptance of authorship; (2) accuracy of all
sections attributed to them; (3) approval of the final publication; and (4)
responsibility for their documented contributions. The [CO-AUTHOR ACCEPTANCE:
PENDING FINAL REVIEW] markers will be removed only after each author confirms
all four conditions. No claims are attributed to either author that are not
supported by the project record.

---

## Author Contributions

**Seven Ezumba:** Conceptualization; xLMP architecture; AI Memory Control Plane
category definition; ExergyNet systems architecture; physical-AI architecture;
NEURO-LOCK architecture; Atlas geospatial layer design; methodology; original
drafting; supervision; corresponding author.

**Bontu Veena:** H200 saturation testing and QPS ladder analysis; concurrency
and throughput testing; Useful-Answer-per-Token metric validation; benchmark
presentation preparation for NVIDIA; technical review and editing.
[PENDING AUTHOR CONFIRMATION — see handoff: `HANDOFF_TO_VEENA_NVIDIA_MEETING.md`]

**Kyaw Phone:** Systems engineering; application architecture; model and tool
routing; persistent-memory integration; voice-agent runtime architecture;
technical review and editing.
[PENDING AUTHOR CONFIRMATION]

---

## Abstract

Autonomous AI systems have execution capability but lack the infrastructure
layer beneath it: persistent, portable, verifiable memory that survives models,
sessions, devices, and hardware generations. The model context window is working
memory. Applications that require durable state must reconstruct it at every
invocation, paying the full prefill cost each time, approaching context limits
as state accumulates, and losing continuity when models change. This is not a
limitation of any particular model. It is the architecture. There is no
persistent memory control plane beneath the model.

xLMP, the ExergyNet Ledger Memory Protocol, defines the missing layer. It
establishes the AI Memory Control Plane: the persistent systems layer that
governs which identified, bounded, provenance-bearing evidence enters an agent's
computation; where that state survives across models, devices, and accelerators;
and how evidence integrity, provenance, and authority are maintained as
independent properties.

The core architectural inversion xLMP introduces is:

> Computation attaches to persistent state.
> The model is temporary; the memory is primary.

Measured on H200 infrastructure, xLMP kept prompt tokens at approximately
660–820 tokens as the corpus grew from 8k to 285k tokens, while full-context
injection grew from 11k to 67k tokens and was rejected outright past 262k.
xLMP delivered a mean accuracy improvement of 24.4 points over the tested RAG
implementation at equal evidence budget, and approximately 42.7× the
Useful-Answer-per-Token efficiency of full-context injection.

This architecture extends to physical systems. A conversational system can often
recover from a wrong response; an embodied system can convert stale memory,
poisoned evidence, or an unauthorized model output into kinetic damage. Physical
AI therefore requires persistent edge-local state, authenticated observations,
and a cryptographic boundary between model reasoning and physical actuation.
xLMP provides the persistent state substrate; NEURO-LOCK provides the actuation
boundary.

This paper establishes the AI Memory Control Plane as a new infrastructure
category, defines xLMP's technical architecture, presents the formal
computational model, describes both software and physical-AI applications, and
discloses the federally reviewed operating context in which the physical
actuation architecture has been exercised.

---

## Executive Summary

AI has a powerful execution layer. It lacks a persistent memory layer.

Current AI systems execute against temporary context. Sessions terminate.
Models are replaced. Every context window is working memory, not institutional
memory. Context injection, retrieval-augmented generation, and application-
specific memory databases are workarounds to an architectural absence: no
persistent memory control plane beneath the model governs what evidence enters
computation, verifies its integrity and provenance, and ensures continuity
across the lifetime of systems.

Larger context windows do not solve this problem. A larger working surface does
not create durable memory architecture.

xLMP addresses this at the infrastructure level:

- **Persistent memory objects:** content-addressed, cryptographically rooted,
  owned, and versioned knowledge units that survive model replacement, session
  termination, and hardware changes.
- **Bounded evidence staging:** complete, integrity-verified evidence drawn from
  identified objects, staged for model consumption without processing the entire
  corpus.
- **Model independence:** memory objects addressed by content roots, not by any
  model's embedding representation. Changing models does not invalidate existing
  memory.
- **Accelerator independence:** the memory control plane places no requirements
  on compute hardware. The interface is staged evidence, not the execution
  substrate.
- **Defined properties:** integrity, provenance, and authority as independent,
  separately verifiable properties.
- **Physical-AI actuation boundary:** through NEURO-LOCK, model outputs are
  recommendations; verified authorization objects are the authority.

xLMP does not replace GPUs, HBM, object storage, databases, or vector search.
GPUs and HBM provide active execution and working memory. xLMP provides
persistent state and control over what enters active computation. These are
distinct infrastructure roles. xLMP makes scarce execution infrastructure
productive for persistent application classes that temporary-context systems
cannot reliably support.

---

## Part I: The Memory Wall

### 1. Temporary Context and Stateless Execution

Every major AI inference system operating today executes against a temporary
context. The model receives tokens, produces tokens, and commits nothing
durable. Whatever knowledge the system appeared to possess during a session is
not retained when the session ends. The next session begins from the same
baseline state.

This is not a limitation of any particular model. It is the design. The
transformer model is a function: given a context, produce a continuation. It is
not a database, not a filing system, not an institution's persistent memory.

The practical pattern:

> At each invocation, inject the relevant prior state into the context.
> The model reasons over the injected state plus the new query.
> The response is returned. State is updated in an application-specific store.
> At the next invocation, the process repeats from the beginning.

This is polling. Each invocation polls the external state store, reconstructs
context, and begins fresh. Polling scales poorly: cost grows with state size,
latency grows with context size.

### 2. Why Larger Context Windows Are Not Persistent Memory

A context window is working memory. Persistent memory is institutional memory.
These are different things.

At large context sizes:

- A context of one million tokens populated with organizational history
  represents a full prefill cost at every invocation. As the organization
  accumulates more history, cost per invocation grows proportionally.
- Even with unlimited context capacity in principle, a real organization cannot
  place all of its knowledge into every context. Evidence selection is still
  required.
- Context windows are session-scoped. The state in a context window at session
  end does not automatically persist. It must be externalized, stored, and
  re-injected at the next session.

The key distinction: a context window determines how much information the model
can hold in working memory during a single task. A memory control plane
determines what information exists durably, who owns it, how it is retrieved
and staged, and how it survives the end of any given session.

### 3. Repeated Context Ingestion and the Data-Movement Problem

Let C be the total persistent corpus. In a fully stateless system:

- At each invocation, some fraction f(C) of the corpus is selected and injected.
- Prefill cost is proportional to the injected context: P(q) ∝ f(C).
- As C grows, f(C) may grow. Prefill cost grows correspondingly.

xLMP is designed to keep the model-facing evidence window bounded as the
persistent corpus grows. Storage, discovery, and governance costs may scale
with C. The model does not need to reprocess the complete corpus for every task.

### 4. Limits of RAG, Vector Search, and Application-Specific Memory

**RAG:** top-k retrieval selects the k most similar chunks to the query vector.
Similarity is not the same as relevance. Information distributed across a
document, requiring sequential context to interpret correctly, or relevant in
ways the similarity metric does not capture will be missing. The model reasons
over an incomplete evidence base without knowing it is incomplete.

**Vector databases:** useful discovery tools. They identify candidate documents
relevant to a query. They are not a memory control plane — they do not provide
completeness guarantees, integrity verification, provenance records, or
model-independent content addressing.

**Application-specific memory databases:** effective for specific applications.
Not portable, not model-independent. Knowledge accumulated with one model
provider is not portable to a different provider without export and reimport.

---

## Part II: Category Definition

### 5. The AI Memory Control Plane

The AI Memory Control Plane is the persistent systems layer that governs:

- which identified, bounded, provenance-bearing evidence enters an agent's computation;
- where that state survives across sessions, models, devices, and accelerators;
- who owns memory objects and under what conditions they may be shared;
- what the integrity status, provenance, and authority of stored knowledge is;
- when evidence is complete within its declared boundary versus partial;
- how memory attaches to and detaches from model execution.

The memory control plane is not a retrieval improvement, a RAG alternative, a
vector-search enhancement, a storage optimization, or a context-compression
technique. It is the persistent infrastructure layer beneath the model.

In the ExergyNet system architecture, this layer has distinct components:

| Component | Role |
|-----------|------|
| xLMP | Persistent memory protocol and control plane |
| VMN | Local developer memory node; open-source xLMP implementation |
| Omega Carrier | Cross-agent MCP toolset (Tools 1–5 deployed); cross-device memory transport architecture (designed) |
| Vanguard | Multi-model inference, bounded planning, review, and coordination over persistent state |
| LNES-22 | Deterministic authority gate for software consequential actions |
| NEURO-LOCK | Physical-actuation control boundary for autonomous machines |

GPUs and HBM serve active execution and working memory. xLMP governs what
enters that execution from persistent state. These are distinct infrastructure
roles.

```text
Persistent State (Total Corpus: C)
        │
        │  xLMP / AI Memory Control Plane
        ▼
Bounded Active Evidence E(q)
        │
        │  Tokenization / Model Runtime
        ▼
KV Cache / HBM
        │
        │  FlashAttention / Inference Kernels
        ▼
SRAM / Tensor Cores
        │
        ▼
Model Computation
```

xLMP governs movement from persistent state into active evidence.
FlashAttention and GPU inference kernels optimize movement and computation
after evidence has entered the model runtime. These layers operate on
different segments of the same pipeline and are complementary, not
competing: xLMP determines what reaches the runtime boundary; kernel-level
techniques determine how efficiently what has already crossed that boundary
is processed.

The central developer inversion:

> Applications own their persistent state. Models attach to that state temporarily.

### 6. Category Boundaries

xLMP is not RAG. xLMP is not a vector database. xLMP is not context
compression. xLMP is not a blockchain storage product. xLMP is not an MCP
plugin — VMN exposes its capabilities through MCP as an interface; the memory
control plane is the system behind it. xLMP is not an LLM.

### 7. What "Authoritative" Means: Three Properties

**Integrity:** the evidence matches its cryptographic commitment.
```
Content root → retrieved bytes = committed bytes.
```
Integrity alone does not establish that committed bytes represent true or
reliable information. It establishes content identity.

**Provenance:** the source, issuer, and transformation history of the evidence
are known and recorded.
```
Signed provenance record → source and transformation history.
```
Provenance alone does not establish authority. It establishes traceable origin.

**Authority:** a governing policy recognizes a specific source or object as
authoritative for a specified purpose, within a defined scope.
```
Policy + provenance → recognized decision status for a specified purpose.
```

The three properties form a complete chain:
```
Content root        →  integrity
Signed provenance   →  origin
Authority policy    →  recognized decision status
```

xLMP governs the first two directly. Authority policies are managed by the
application and, for consequential actions, by the companion LNES-22 authority
gate.

The correct description of what xLMP provides:

> xLMP governs which identified, bounded, provenance-bearing evidence enters
> an agent's computation, and verifies that the evidence matches its committed
> state.

### 8. First Principles of xLMP

1. Memory exists independently of the model. The model is a temporary execution engine that attaches to memory for the duration of a task.
2. Computation attaches to persistent state. Dormant state incurs no compute cost.
3. Stored state should not become active context without cause.
4. Evidence authority matters more than superficial similarity. Authoritative recall is bounded by the declared evidence unit and complete within it.
5. Discovery and authoritative recall are separate operations.
6. Integrity, provenance, and authority are separately verifiable properties. None implies the others.
7. Generated proof is not verified proof. A proof artifact produced by a prover is a candidate. Verification by an independent verifier confirms it.
8. State must survive model and hardware replacement. Memory objects are content-addressed, not embedding-addressed.
9. Agent knowledge and agent authority are separate control problems.
10. Memory efficiency should expand the number of viable applications.

### 9. Integrity, Provenance, and Authority in Practice

Integrity is established at ingest: content is normalized, segmented
deterministically, manifested, and rooted. Any change to the content produces a
different root. An application can independently verify that a retrieved object
matches its root without trusting the storage system.

Provenance is established at ingest and updated at each transformation: origin
identifier, ingest timestamp, ingesting identity, chunker version, and
normalization version are recorded.

Authority is policy-dependent and context-dependent. The memory control plane
does not make authority determinations. It provides the integrity and provenance
records that authority policies can evaluate.

### 9.1 Temporal Validity and Decision Lineage

The bottleneck in persistent AI is not storage capacity. It is state
governance. Autonomous systems require more than retained text or semantic
retrieval. They require reliable mechanisms for determining what information
remains authoritative, where it originated, when it was valid, who may
access it, when it must be superseded or forgotten, and which decisions it
influenced. The AI Memory Control Plane exists to govern this continuously
changing operational state independently of the model temporarily attached
to it.

This extends the three properties of Section 7 with two further dimensions
that matter once evidence is used to justify a decision or action:

**Temporal validity:** a fact recorded as authoritative at ingest is not
necessarily authoritative indefinitely. The control plane must be able to
represent when a fact became valid, whether it has been superseded, and
when it expires or must be forgotten — not only what the fact is.

**Decision lineage:** which evidence supported which interpretation, under
which policy state, producing which proposed action, receiving which
authorization, producing which observed outcome, and updating state to
what. A record that only says "this information was retrieved" is
insufficient for a system whose outputs have consequences; a system of
record for autonomous decisions needs the retrieval-to-outcome chain,
not only the retrieval step. Section 32.1 formalizes this chain as a
closed-loop validation sequence for physical action; the same lineage
requirement applies to any consequential software decision.

Retrieval answers what information is relevant. A memory control plane
determines what state is authoritative. RAG retrieves information for a
model. xLMP governs state for a system.

---

## Part III: Technical Architecture

### 10. Persistent Memory Objects

A memory object consists of:

- **Content:** the stored knowledge.
- **Root:** the cryptographic commitment to the canonical form of the content. Same canonical content, same root. Changed content, different root.
- **Metadata:** mutable owner-controlled attributes — title, tags, lifecycle state, access controls, timestamps. Separately rooted from content.
- **Manifest:** ordered record of segments, their hashes, payload hash, chunker version, normalization version.
- **Ownership:** the identity of the principal that controls the object.
- **Provenance record:** source identifier, ingest timestamp, ingesting identity, transformation history, lineage references.
- **Lifecycle state:** defined states (see Section 16).
- **Proof record:** current status of any cryptographic proof against this object's root.

Objects are immutable in their content. Updates produce new object versions with new roots.

### 11. Canonicalization, Roots, and Manifests

Before a root is computed, content is transformed to a canonical form. The
normalization version is recorded in the manifest. An independent verifier that
applies the same normalization version to the same raw content will derive the
same root without trusting the xLMP system.

The manifest records:
- Chunker version
- Segment records: (segment_index, byte_offset, byte_length, segment_hash)
- Payload hash: SHA-256 of the complete normalized content
- Root derivation algorithm

### 12. Discovery Versus Recall

**Discovery:** identifying candidate memory objects relevant to a query.
Uses lexical indexing (BM25 with morphological normalization), optional
semantic candidate selection, metadata filters, and catalog search. Output is
a ranked list of candidate roots. Approximate by design.
> Discovery answers: where should I look?

**Recall:** retrieving the complete, bounded evidence from a specific memory object.
Operates against a known root. Retrieves evidence segments with integrity
verification. Output is evidence, not a ranked list. Complete by design within
its declared boundary.
> Recall answers: what does this specific object say?

The completeness guarantee applies only to recall against a known root, not
to discovery output.

### 13. Evidence Units and Completeness Boundaries

Three recall modes, each with its own completeness guarantee:

**Object-complete recall:** returns the entire committed content of a memory
object. Every byte of committed content is present and integrity-verifiable.

**Record-complete recall:** returns an entire structured record or independently
meaningful unit within an object. Every field of the declared record type is
present.

**Range-bounded recall:** returns an exact committed byte range with segment
boundaries, offsets, and adjacent segment metadata. Every byte within the
declared range is present and integrity-verifiable.

Formal definition:

> Evidence completeness means that every byte, field, or record belonging to
> the declared evidence unit is present and integrity-verifiable. It does not
> mean that the selected unit contains every fact relevant to the broader question.

### 14. Bounded Evidence Staging

1. Discovery produces a ranked set of candidate roots.
2. The application selects roots from the discovery result based on priority and context-budget policies.
3. For each selected root, recall retrieves complete evidence within the chosen recall mode and declared boundary.
4. Recall output is assembled into the prompt context, with provenance labels identifying the source root and recall mode for each evidence block.
5. Dormant state — all memory not in the staged evidence — remains in storage, incurring no compute cost.

The evidence budget B is the maximum evidence volume that will be staged for a single model invocation. Every evidence block in the context is associated with a root the application can independently verify.

### 15. Model Attachment and Detachment

Attachment is temporary and task-scoped. A model session may discover, recall
bounded evidence, commit new objects, and update metadata. When the task
completes, the model session detaches. The memory objects persist independently
of the session. The next model to attach — different model, different hardware,
different application — attaches to the same objects via the same roots.

### 16. State Mutation and Versioning

```
INGESTED          Content committed, root computed, manifest recorded
ACTIVE            Object referenced and in regular use
AT_RISK           Shard availability below replication threshold
COLD              Not accessed within retention policy window
ARCHIVED          In long-term storage, retrieval latency increased
PROOF_REQUESTED   Cryptographic proof job submitted
PROOF_GENERATED   Proof artifact produced; awaiting independent verification
VERIFIED          Proof independently verified
REJECTED          Object failed integrity check or verification
```

### 17. Access Control and Memory Namespaces

Namespaces: Personal, Organizational, Application, Public. Access control
operates at the object level: read, write, share, and delete permissions are
independently configurable.

### 18. Memory Transport and Synchronization

Memory objects are transportable. A memory object moved from one storage system
to another carries its root, manifest, provenance record, and lifecycle state.
The receiving system can independently verify the object's integrity against
its root without trusting the transport path.

---

## Part IV: Developer Infrastructure

### 19. The Application Lifecycle with xLMP

General developers can create applications whose state persists independently
of the model executing the current task. In software systems, this enables
long-running personal, enterprise, clinical, and research agents. In physical
systems, it enables machines whose mission state survives power cycles,
connectivity loss, model replacement, and infrastructure migration.

The central developer inversion: **applications own their persistent state.
Models attach to that state temporarily.**

Application lifecycle:

```
Create persistent memory namespace
        ↓
Commit memory objects
        ↓
Attach authorized model session
        ↓
Discover candidate state
        ↓
Recall bounded evidence
        ↓
Perform computation
        ↓
Commit resulting state
        ↓
Detach model
        ↓
Attach another model or system later
```

Developer interface:

```
memory.namespace("organization")
memory.commit(content, metadata)
memory.discover(query)
memory.recall(root, mode)
memory.share(root, identity)
memory.verify(root)
```

Physical AI is one application class of this larger developer primitive. The
same API, protocol, and memory objects that serve a software agent accumulate
mission memory for a physical machine.

### 20. VMN: Local Persistent Memory

The Vanguard Memory Node is the open-source local implementation of the xLMP
memory architecture. VMN provides:

- Local ingest: storing content as xLMP memory objects with SHA-256 content roots, deterministic segmentation, and local manifest generation.
- Persistent storage: shard-based storage surviving session termination, application restart, and system reboots.
- BM25 discovery: lexical indexing with morphological normalization.
- Root-bound recall: complete bounded evidence with segment-level integrity verification.
- MCP integration: compatibility with Claude Code and MCP-aware applications.

VMN explicitly does not provide: distributed storage, on-chain proof
verification, or production resolver capabilities.

**VMN Engineering Findings:**
- Chunk-boundary fragmentation corrected in v1.1 by record-aware boundary detection.
- Literal-only BM25 matching corrected by morphological normalization at ingest and query time.
- Index serialization bottleneck at large object counts; addressed in v1.2 sharded incremental index architecture (in development).
- VMN-style BM25 indexing was evaluated locally as a candidate retrieval replacement for xLMP's current linear-scan retrieval path and did not outperform it at the tested LNES-59 procurement-corpus scale (20–164 documents; ~18×–98× slower; evidence recall not consistently better). At small-to-medium procurement corpus scale, the current linear scan is faster because VMN's indexed approach pays fixed filesystem/index overhead that dominates any theoretical lookup advantage. This remains an open large-scale/crossover research question, not a validated advancement — untested at corpus scales where an indexed lookup's theoretical advantage might begin to outweigh that fixed overhead.
- **Current status (v2.0):** VMN is published as `@lnes/vanguard-memory-node@2.0.0` (npm, public), source-synchronized to its GitHub repository. It now provides adaptive deterministic retrieval — a workload-aware retrieval path that can change strategy when the active path's assumptions stop holding for a given query — validated with 34/34 regression tests passing (30 original plus 4 exercising the adaptive path) and zero observed regressions against the prior release. This supersedes the "v1.2 sharded incremental index architecture (in development)" line above, which is retained here as historical record of the earlier engineering finding, not as current status. The internal decision mechanics of the adaptive path are a trade-secret-controlled implementation detail and are not disclosed in this paper; see Section 20.1 below for the retrieval-benchmark family this connects to.

#### 20.1 LNES-84: Compact/Deterministic Index Retrieval Benchmark

A separate, sealed benchmark line (LNES-84) evaluated a compact,
deterministic candidate-index structure as a replacement for VMN's
linear-scan evidence retrieval, independent of the LNES-86 adaptive-routing
work described in Section 20.2. **The verdict is workload-dependent, not
uniformly positive, and is stated as such deliberately** — the correctness
and robustness side of this system is validated without qualification;
the performance side is not.

**Correctness and robustness:** validated in the sealed LNES-84 test suite with zero observed
failures across concurrent-reader tests (concurrency 1 through 16),
mutation-generation consistency, index-corruption detection, crash/restart
recovery, and authority-boundary negative tests.

**Performance:** the effect is real but depends heavily on workload shape.
On a narrow, single-scale 1GB / 100-query population where the linear-scan
baseline pays a large, constant per-query cost, the indexed approach showed
a large observed advantage — median paired speedup 52,753.8x (bootstrap 95%
CI [42,014x, 56,537x]), faster on 100 of 100 queries, alongside a measured
accuracy improvement from 87% to 94% under a corrected symmetric scoring
rule (+7 percentage points, p = 0.039). On a later, more realistic 10MB
vault built with a **mixed** document-size composition (231 real paired
queries — 84% small/entity documents, 16% large/filler documents), the
aggregate **median** speedup was 0.72x: the indexed approach was slower
than the linear-scan baseline on the median query, because its fixed
per-call construction overhead is not amortized when most queries touch
small documents. Only the large-document slice of that realistic mix
(16% of queries) showed the indexed approach faster (2.28x median).
Vault-level behavior at 1GB scale has not been empirically re-measured
under this more realistic, mixed-composition methodology.

No claim of universal O(1) retrieval, or of universal speedup, is made.
The honest summary is: correctness and robustness are validated; whether
the indexed approach helps depends on the shape of the workload it is
applied to, and the shape matters more than the accelerator or the raw
corpus size.

#### 20.2 LNES-86: Adaptive Workload-Aware Retrieval Routing

ExergyNet's local retrieval stack (VMN v2.0, Section 20) uses workload-aware
retrieval that can adapt when the active retrieval path loses its
efficiency advantage for a given query, rather than committing to a single
fixed strategy or predicting the right strategy in advance. Within the
tested workload (the frozen LNES-86 benchmark population), this measured
approximately 1.92x throughput versus a legacy always-full-scan baseline
and approximately 1.13x versus a static compact-index-only baseline, with
decision behavior validated against a sealed 6-way holdout comparison,
concurrency testing (1 through 16), mutation/restart handling, and failure
injection. These figures describe behavior within the tested workload only
and are not presented as a general-purpose multiplier. The specific
mechanism by which the system detects when to adapt is a trade-secret
implementation detail and is not disclosed in this paper.

### 21. Omega Carrier: Cross-Agent Toolset and Cross-Device Continuity

Omega Carrier has two distinct aspects with different implementation states:

**Deployed: Cross-Agent MCP Toolset (Tools 1–5, SSE port 8765)**
Omega Carrier Tools 1–5 are a real deployed MCP toolset for visiting AI agents,
operational on port 8765. They provide AI agents with access to Exergy Vault
capabilities including evidence recall, vault commit, and Rho economic
operations. Tool 6 (`strike_rho_recursion`) has a HITL gate now deployed;
the siphon swap signal remains not fully wired. (EVD-008)

**Designed: Cross-Device xLMP Memory Transport**
The broader Omega Carrier memory transport architecture — moving xLMP objects
between devices (laptop VMN → workstation VMN → field node) with root and
provenance preservation — is designed and documented. It is distinct from the
deployed MCP toolset and is not yet operationally deployed.

**Note on naming:** "Omega Carrier" in this paper refers to both the deployed
MCP toolset and the designed cross-device transport layer. These are different
systems sharing a name. The status table in Section 32 distinguishes them.

### 22. Cross-Model Applications

Example: an autonomous software development system.

```
Claude plans       →  commits planning output to xLMP
Coding model       →  retrieves planning output; commits implementation
Local model        →  analyzes committed implementation using private context
                      without sharing with external model providers
```

All three models attach to the same persistent memory namespace. None of them
owns the memory. The application owns the memory. Any model can be replaced
without losing the project's state.

### 23. Cross-Device Applications

A personal AI system accumulating genuine knowledge across years:

```
Laptop:   morning planning session, using personal VMN namespace
Phone:    midday query answered by local model, adding a memory object
Tablet:   evening research, drawing on accumulated context
          ↓
      Omega Carrier cross-device transport synchronizes
```

### 24. Enterprise Institutional Memory

Organizations commit documents, decisions, and processes to an xLMP namespace.
Authorized model sessions retrieve bounded evidence. When employees leave,
their contributions remain. When the organization changes model providers, the
memory objects remain and the new model attaches to the same roots.

### 25. Long-Running Autonomous Systems

A long-running agent with xLMP accumulates knowledge continuously, builds on
accumulated knowledge without full context reconstruction at each invocation,
survives model replacement without losing accumulated knowledge, and maintains
a complete integrity-verified record of what it has done and decided.

An autonomous machine in intermittent-connectivity conditions holds xLMP objects
locally, uses them for real-time decisions, and synchronizes when connectivity
allows. Mission context survives power cycles and connectivity gaps.

---

## Part V: Beyond Silicon — Persistent State and Cryptographic Actuation for Physical AI

Physical AI systems represent the highest-stakes application class for
persistent memory. A conversational AI system can often recover from a wrong
response. An embodied system — a machine with motors, actuators, rotors,
sensors, and kinetic consequence — can convert stale memory, poisoned evidence,
an incorrect coordinate, or an unauthorized model output into physical damage.

The demands of physical AI are therefore more stringent than those of software
agents. The machine needs persistent edge-local state that survives connectivity
loss and model replacement. It needs authenticated, integrity-bound
observations. It needs a cryptographic boundary between model reasoning and
physical actuation that no amount of persuasive model output can cross.

xLMP provides the persistent state substrate. NEURO-LOCK provides the actuation
boundary.

This section documents architecture and disclosed design. Where implementation
status differs from architecture, current status is stated explicitly. The
Physical AI Status Table in Section 32 states the complete per-subsystem status
across multiple dimensions.

### 26. The Kinetic Consequence of the Memory Wall

The temporary context limitation is an inconvenience in conversational systems.
In physical systems, it is a safety concern.

A physical AI system — an autonomous aircraft, a ground vehicle, a heavy-lift
machine — requires across the duration of an extended mission:

- **Mission history:** what routes have been operated, what tasks completed, what obstacles recorded.
- **Maintenance state:** airframe hours, component-level wear, inspection records, pending maintenance actions.
- **Geospatial constraints:** restricted airspace, terrain data, obstacle maps, corridor authorizations.
- **Prior sensor observations:** what sensors observed on prior passes of a location, how those observations have changed.
- **Operator directives:** standing rules of engagement, mission-specific instructions, changes issued during earlier mission phases.
- **Aircraft configuration:** current payload, energy state, sensor suite status.
- **Safety state:** fault history, current warning conditions, actions taken in response to prior anomalies.
- **Persistent operating policies:** regulations, operator-issued constraints, airspace authority requirements, emergency procedures.

A model executing against a freshly reconstructed context from these categories
is managing a reconstruction problem at every invocation. A mission that spans
hours or days, with intermittent connectivity to cloud infrastructure, cannot
reliably perform this reconstruction. The machine's durable memory must survive
model replacement, connectivity loss, device restart, and cloud-provider changes.

The physical AI memory problem is a mission continuity and safety architecture
requirement.

### 26.1 Trust Infrastructure for Physical Autonomy

Physical autonomy cannot scale solely through improvements in perception,
navigation, or model intelligence. It also requires a persistent trust layer
capable of preserving authoritative mission state, constraining actions under
explicit policy, recording physical execution, and reconciling verified
outcomes.

ExergyNet is designed as infrastructure independent of any single airframe,
model, sensor package, or flight controller. xLMP governs persistent state
and bounded evidence. LNES-22 governs software authority. NEURO-LOCK governs
controlled physical actuation. Edge Witnesses provide signed evidence of
environmental and operational outcomes.

This separation allows an autonomous aircraft, ground vehicle, maritime
system, industrial robot, or future physical agent to attach to the same
trust architecture without requiring the intelligence and governance layers
to be rebuilt for each machine.

The long-term opportunity is therefore not limited to operating one
autonomous platform. It is to provide the persistent state, authorization,
execution, and verification infrastructure through which many physical
systems can be trusted, audited, insured, and governed.

### 27. xLMP as Persistent Mission Memory

xLMP maintains model-independent mission state while ensuring that only bounded
evidence enters active computation.

> The flight session is temporary. The aircraft's mission memory is not.

A model that attaches to the aircraft's xLMP namespace for a planning or
perception task retrieves bounded evidence from mission objects — the relevant
portions of the mission history, the applicable geospatial constraints, the
current safety state. It does not reconstruct the entire mission context from
scratch. When the model session ends, the mission objects persist. The next
model to attach, on whatever hardware is available, attaches to the same roots.

xLMP does not imply that a model controls the vehicle directly. The persistent
memory layer governs evidence. The actuation control architecture governs
physical action. These are distinct.

### 28. Atlas: Deterministic Geospatial Routing and Sovereign Spatial State

Physical AI systems that navigate cannot depend exclusively on external map
APIs, unverified coordinates, or spoofable positioning inputs.

Atlas is ExergyNet's deterministic geospatial routing and spatial-graph layer
architecture. It is designed to provide:

- **Deterministic routing:** path computation over governed spatial graphs producing consistent, auditable results from the same inputs.
- **Sovereign spatial graphs:** geospatial data committed to xLMP objects with content roots, provenance records, and versioned manifests. A connectivity gap does not remove spatial context.
- **Versioned map state:** updates produce new object versions with new roots; the vehicle knows which version of the spatial graph it operates against.
- **Geofence and corridor enforcement:** routes outside the authorized corridor are rejected at the Atlas layer.

**Current status:** Atlas is DESIGNED. No deployed routing engine was found in
the project record during the review of this paper. The Edge Witness app
contains a geospatial map view (Leaflet, `s-streets` screen) for observation
drops; this is a frontend display layer, not the Atlas routing engine.

**Taxonomy note:** Atlas provides routing over governed spatial graphs. It does
not provide positioning independent of GPS. Positioning independent of GPS
infrastructure is a separate architecture problem. A LNES number for that
system has not yet been assigned in the project record. (See Section 28.1.)

#### 28.1 GPS-Independent Positioning [LNES Number TBD]

A physical AI system that relies exclusively on GPS satellite infrastructure for
its position estimate is dependent on a single, spoofable, jammable signal
source. A GPS-independent positioning and ranging layer — operating through
mesh-network ranging, acoustic ranging, inertial fusion, or other means — is a
design requirement for certain physical AI operating environments.

No ExergyNet LNES number has been confirmed in the project record for this
system. **LNES-11 is occupied:** in the deployed `biological_proxy` system
on AskMo, LNES-11 designates the bilateral consensus protocol (`vanguard-ultra`)
that provides independent second-opinion review of high-stakes model decisions.
(Evidence: EVD-006 — `deployed-snapshots/README.md`.) Using LNES-11 for
GPS-independent positioning in this paper would create a numbering collision
with a live deployed system. A LNES number for the positioning layer must be
assigned separately before it appears in any publication.

**Current status:** DESIGNED (no project-record evidence of implementation).
LNES number: TO BE ASSIGNED by operator. GPS-independent positioning is
referenced in this paper as a design requirement, not as a deployed or
implemented capability.

### 29. LNES-06 and LNES-12: Physical Observation and Communications

#### 29.1 LNES-06 Edge Witness: Hardware-Attested Physical Observation Platform

LNES-06 Edge Witness is a deployed Android application (v2.22.8, versionCode
247, package `com.exergynet.myapplication`) providing a field observation and
sensing platform. (Evidence: EVD-005)

The app is a native Android shell with a WebView-first UI. The native Kotlin
layer provides:
- Multi-modal sensor access: GPS, NFC, BLE, optical (camera), acoustic (ASSA),
  cellular (AREM)
- Cryptographic primitives
- Network transports (LAN, BLE, P2P, LiveKit SFU)
- A JavaScript bridge (`window.ExergyKinesis`, 96+ methods)

In the context of physical AI, LNES-06 provides the field observation layer:
sensor data authenticated to a known device identity and timestamped at
capture. Observations can be committed to xLMP objects as authenticated,
integrity-bound records.

**Current status (EVD-005):**

| Layer | Status |
|-------|--------|
| Android platform delivery | DEPLOYED (APK distributed via Carrier EC2) |
| Sensor access (GPS, NFC, BLE, optical, acoustic, cellular) | DEPLOYED |
| LiveKit SFU calling (cross-network video) | DEPLOYED |
| xLMP integration (observations committed to Exergy Vault) | STAGED |

#### 29.2 LNES-12: Acoustic Signaling and WebRTC Calling Layer

LNES-12 is the deployed real-time communications infrastructure:
LiveKit SFU and coturn on Carrier EC2 (`3.234.120.103`). Cross-network video
calling is confirmed. The TURN relay path has been hardened through a series
of documented fixes (LNES-12.1 through LNES-12.8, in `LNES12_CHANGE_LOG.md`).
(Evidence: EVD-007)

In the context of physical AI, LNES-12 provides the real-time communications
layer over which observations, operator commands, and mission data move between
field devices and infrastructure when WebRTC connectivity is available.

**Note on public description:** This paper previously described LNES-12 as a
"designed Global Media Mesh." That description was incorrect. LNES-12 is a
deployed LiveKit/coturn WebRTC communications infrastructure. The public paper
describes it as the communications layer for physical AI coordination; detailed
operational configuration is internal only.

**Current status (EVD-007):**

| Layer | Status |
|-------|--------|
| LiveKit SFU (Carrier EC2) | DEPLOYED — 18+ days uptime confirmed |
| coturn TURN relay | DEPLOYED — ports 3478/5349/relay range |
| Cross-network WebRTC calls | DEPLOYED — confirmed |
| Durable mesh relay (non-WebRTC fallback) | DESIGNED |

### 30. NEURO-LOCK: Cryptographic Actuation Boundary

The separation between model reasoning and physical actuation is the most
critical control boundary in a physical AI system.

NEURO-LOCK is the sovereign operating system and actuation-control architecture
of Bolt, ExergyNet's heavy-lift uncrewed aerial vehicle. NEURO-LOCK enforces
the boundary between model reasoning and physical action.

**The model may:**
- Analyze sensor data and mission state
- Recommend a course of action
- Plan a route or task sequence
- Request a specific physical action through the authorized request channel

**The model may not directly:**
- Actuate a motor or control surface
- Change flight-critical configuration
- Release a payload
- Alter a protected route
- Override a safety state
- Execute an unrestricted command

The actuation rule:

> A model output is a recommendation. A verified authorization object is the authority.

The intended authorization chain for a physical action:

```
xLMP evidence root
    ↓
authorized identity (operator or trustee with signing capability)
    ↓
typed capability (specific, declared action class)
    ↓
exact resource and argument commitment (target, parameters)
    ↓
policy evaluation (does the request fit the authorized scope?)
    ↓
required human or trustee approval (where policy demands it)
    ↓
NEURO-LOCK actuation decision
    ↓
signed execution record (what was done, when, by which authorization)
```

This chain ensures that natural language in retrieved memory — however
authoritatively it appears — has zero authority to authorize a physical action.

#### 30.1 FAA Operating Context

NEURO-LOCK was disclosed to the Federal Aviation Administration as the
operating-system and control architecture of KTX's VSG HL 01 "Bolt" during the
agency's review of the aircraft, petition, and associated operating
documentation. Bolt subsequently received FAA Exemption No. 26214, Regulatory
Docket No. FAA-2025-5731, authorizing defined UAS lift operations, evaluation,
testing, and demonstration at a maximum takeoff weight of 275 pounds, subject
to the exemption, the applicable Certificate of Waiver or Authorization, and
the FAA-reviewed operating procedures. This places NEURO-LOCK within a
federally reviewed heavy-lift UAS operating context rather than presenting it
solely as a conceptual physical-AI architecture.

xLMP extends this control architecture by providing persistent, integrity-rooted
mission memory that can survive changes in model, device, network, and
accelerator.

**FAA Claim Boundary Note:** This paper states that: the FAA was aware of
NEURO-LOCK; it appeared in the reviewed operating documentation; it was
presented as Bolt's operating-system or control architecture; Bolt received
Exemption No. 26214; the authorized maximum takeoff weight is 275 pounds;
and the exemption creates a federally governed heavy-lift operating environment.
This paper does not claim: "FAA-certified NEURO-LOCK," "FAA-certified xLMP,"
FAA endorsement of ExergyNet, or FAA formal validation of every NEURO-LOCK
security property. If the precise FAA submission language for NEURO-LOCK is
obtained from the public docket record (FAA-2025-5731), that language will be
quoted or paraphrased accurately in a source note at that time.

#### 30.2 NEURO-LOCK Current Status

The full authorization chain (Section 30) represents the target architecture.

| Status Dimension | Current State |
|-----------------|---------------|
| IMPLEMENTATION_STATUS | DESIGNED (full authorization chain); policy evaluation module STAGED |
| FAA_DISCLOSURE_STATUS | DISCLOSED_IN_OPERATING_DOCUMENTATION (Docket FAA-2025-5731) |
| REGULATORY_PLATFORM_STATUS | BOLT_EXEMPTION_GRANTED (Exemption No. 26214, MTOW 275 lbs) |
| FAA_TECHNICAL_ENDORSEMENT | NOT_CLAIMED |
| PRODUCTION_ACTUATION_STATUS | NOT_CLAIMED (full chain not operationally deployed) |

### 31. Physical AI and the Developer Primitive

Physical AI extends the same xLMP developer primitive that software agents use.
The same protocol and memory objects serve both.

| Component | Physical AI Role |
|-----------|-----------------|
| VMN | Local state node on the aircraft, ground station, or field device |
| Omega Carrier (cross-device) | Synchronizes mission state between edge nodes and central infrastructure when connectivity allows |
| xLMP | Persistent memory protocol: mission history, observations, constraints, directives as content-rooted integrity-verified objects |
| LNES-22 | Authority gate for software consequential actions that support the mission |
| NEURO-LOCK | Physical actuation boundary |

The developer who builds an enterprise knowledge agent and the engineer who
builds mission memory for an autonomous aircraft use the same protocol. The
difference is the consequence class of the actions downstream of that memory.

### 32. Physical AI Status Table

The following table states the verified status of each physical AI subsystem
across multiple independent dimensions. "FAA-reviewed" is a disclosure
dimension; it does not substitute for implementation or production-actuation
status.

---

**SUBSYSTEM: xLMP**
ROLE: Persistent memory protocol and control plane
IMPLEMENTATION_STATUS: DEPLOYED (VMN local, Exergy Vault); STAGED (production resolver)
VALIDATION_STATUS: H200 benchmark — prompt tokens 660–820 flat, +24.4 accuracy vs RAG, 42.7× token efficiency vs full-context (EVD-001, EVD-002)
DEPLOYMENT_STATUS: DEPLOYED (VMN local); STAGED (enterprise resolver)
PUBLIC_CLAIM_STATUS: Full architecture claimed; benchmark companion in preparation
EVIDENCE_REFERENCE: EVD-001, EVD-002

---

**SUBSYSTEM: VMN (Vanguard Memory Node)**
ROLE: Local developer memory node; open-source xLMP implementation
IMPLEMENTATION_STATUS: DEPLOYED (v2.0.0, npm-published as `@lnes/vanguard-memory-node`)
VALIDATION_STATUS: Ingest, retrieval, root-bound recall, MCP integration tested; 34/34 regression tests passing on v2.0.0 (Section 20)
DEPLOYMENT_STATUS: DEPLOYED (production local instances; source synchronized to GitHub)
PUBLIC_CLAIM_STATUS: Full capabilities as described in Section 20; adaptive deterministic retrieval enabled (mechanism not disclosed — trade secret)
EVIDENCE_REFERENCE: Direct system operation; npm registry + GitHub release provenance

---

**SUBSYSTEM: Omega Carrier (MCP Toolset, Tools 1–5)**
ROLE: Cross-agent MCP toolset for visiting AI agents; SSE port 8765
IMPLEMENTATION_STATUS: DEPLOYED
VALIDATION_STATUS: Tools 1–5 REAL; Tool 6 HITL gate deployed 2026-08-01; siphon swap signal not wired
DEPLOYMENT_STATUS: DEPLOYED (Tools 1–5); STAGED (Tool 6 full path)
PUBLIC_CLAIM_STATUS: MCP toolset described as deployed; cross-device transport architecture described as designed (Section 21)
EVIDENCE_REFERENCE: EVD-008

---

**SUBSYSTEM: Omega Carrier (Cross-Device Memory Transport)**
ROLE: Cross-device and cross-system xLMP object transport
IMPLEMENTATION_STATUS: DESIGNED
VALIDATION_STATUS: Architecture documented; not yet in system test
DEPLOYMENT_STATUS: PLANNED
PUBLIC_CLAIM_STATUS: Architecture described; no operational claim
EVIDENCE_REFERENCE: EVD-008

---

**SUBSYSTEM: Vanguard**
ROLE: Multi-model inference, bounded planning, review, and coordination over persistent state
IMPLEMENTATION_STATUS: DEPLOYED (biological_proxy, multi-model router on AskMo)
VALIDATION_STATUS: Live-tested — inference restored, tool execution verified, LNES-11 bilateral consensus operational
DEPLOYMENT_STATUS: DEPLOYED
PUBLIC_CLAIM_STATUS: Routing and inference capabilities claimed as deployed
EVIDENCE_REFERENCE: EVD-006; live system test August 2026

---

**SUBSYSTEM: Atlas**
ROLE: Deterministic geospatial routing; sovereign spatial graph layer
IMPLEMENTATION_STATUS: DESIGNED
VALIDATION_STATUS: No deployed routing engine found in project record; Leaflet map view in LNES-06 is a display layer, not Atlas
DEPLOYMENT_STATUS: PLANNED
PUBLIC_CLAIM_STATUS: Architecture described; no operational claim; deployed vs. designed distinction explicit in text
EVIDENCE_REFERENCE: Project record review; absence of deployed engine is the evidence

---

**SUBSYSTEM: GPS-Independent Positioning [LNES Number TBD]**
ROLE: Positioning and ranging independent of GPS satellite infrastructure
IMPLEMENTATION_STATUS: DESIGNED
VALIDATION_STATUS: Not yet in system test
DEPLOYMENT_STATUS: PLANNED
PUBLIC_CLAIM_STATUS: Design requirement stated; no LNES number assigned; LNES-11 is occupied by bilateral consensus (EVD-006)
EVIDENCE_REFERENCE: EVD-006 (confirms LNES-11 occupation)

---

**SUBSYSTEM: LNES-11 (Bilateral Consensus)**
ROLE: Independent bilateral second-opinion review in biological_proxy (vanguard-ultra mode)
IMPLEMENTATION_STATUS: DEPLOYED on AskMo
VALIDATION_STATUS: Operational in biological_proxy TypeScript
DEPLOYMENT_STATUS: DEPLOYED
PUBLIC_CLAIM_STATUS: Not a physical AI subsystem; LNES-11 is a software AI reasoning control component
EVIDENCE_REFERENCE: EVD-006

---

**SUBSYSTEM: LNES-06 Edge Witness**
ROLE: Field observation and sensing Android platform; physical-world data collection
IMPLEMENTATION_STATUS: DEPLOYED (v2.22.8 versionCode 247)
VALIDATION_STATUS: APK deployed; GPS, NFC, BLE, optical, acoustic, cellular, LiveKit SFU tested
DEPLOYMENT_STATUS: DEPLOYED (APK); STAGED (xLMP vault integration)
PUBLIC_CLAIM_STATUS: Field sensing platform described; operational APK claimed; vault integration claimed as staged
EVIDENCE_REFERENCE: EVD-005

---

**SUBSYSTEM: LNES-12 Acoustic Signaling / WebRTC Layer**
ROLE: Real-time communications infrastructure: LiveKit SFU + coturn on Carrier EC2
IMPLEMENTATION_STATUS: DEPLOYED
VALIDATION_STATUS: Cross-network video calls confirmed; TURN relay hardened through LNES-12.1–12.8
DEPLOYMENT_STATUS: DEPLOYED
PUBLIC_CLAIM_STATUS: Communications layer for physical AI coordination described; operational status as deployed infrastructure claimed
EVIDENCE_REFERENCE: EVD-007

---

**SUBSYSTEM: LNES-22**
ROLE: Deterministic authority gate for software consequential actions
IMPLEMENTATION_STATUS: PARTIALLY DEPLOYED — see breakdown below
VALIDATION_STATUS: Live adversarial test, August 2026; rejection logging validated
DEPLOYMENT_STATUS: STAGED (multiple components; see breakdown)
PUBLIC_CLAIM_STATUS: Per-component status explicit in table below
EVIDENCE_REFERENCE: EVD-004

LNES-22 component breakdown:

| Component | Status |
|-----------|--------|
| Ed25519 review signing (VANGUARD-01 / shadow_listener.py) | DEPLOYED — restored 2026-08-05 |
| Sensory-trigger webhook from agent-edit | DEPLOYED — restored 2026-08-05 |
| POST /api/admin/build/vanguard-review receiver | DEPLOYED — restored 2026-08-05 |
| Schema validation and replay/expiry enforcement | DEPLOYED — §IV of architecture doc |
| Reverse tunnel (Portal:3000 → WSL2:8000) | BROKEN — port 3000 remote-forward fails; port 3009 works as fallback |
| Deterministic policy gate (policy_gate.py) | STAGED — implemented, not wired to execution |
| Delegation receipts | DESIGNED — spec complete, implementation pending |
| Durable replay protection (persistent storage) | PLANNED — currently in-memory only |
| Consequential action execution | NOT WIRED — nothing consumes review decision for execution-relevant action |

---

**SUBSYSTEM: NEURO-LOCK**
ROLE: Physical actuation control boundary for autonomous aircraft
IMPLEMENTATION_STATUS: DESIGNED (full authorization chain)
FAA_DISCLOSURE_STATUS: DISCLOSED_IN_OPERATING_DOCUMENTATION (Docket FAA-2025-5731)
REGULATORY_PLATFORM_STATUS: BOLT_EXEMPTION_GRANTED (Exemption No. 26214, MTOW 275 lbs)
FAA_TECHNICAL_ENDORSEMENT: NOT_CLAIMED
PRODUCTION_ACTUATION_STATUS: NOT_CLAIMED — full chain not operationally deployed
PUBLIC_CLAIM_STATUS: FAA disclosure context claimed; full authorization chain described as architecture; production operations not claimed
EVIDENCE_REFERENCE: EVD-003

---

**SUBSYSTEM: VSG HL 01 "Bolt"**
ROLE: Heavy-lift uncrewed aerial vehicle; NEURO-LOCK actuation platform
IMPLEMENTATION_STATUS: PHYSICAL VEHICLE (built)
VALIDATION_STATUS: FAA reviewed aircraft, petition, and operating documentation
DEPLOYMENT_STATUS: Authorized per FAA Exemption No. 26214 for defined UAS lift operations, MTOW 275 lbs, subject to exemption and CoWA
PUBLIC_CLAIM_STATUS: FAA Exemption No. 26214 claimed (EVD-003); regulatory docket FAA-2025-5731
EVIDENCE_REFERENCE: EVD-003

---

### 32.1 Closed-Loop Validation for Persistent Physical Intelligence

The long-term validation target for the ExergyNet architecture is not merely
improved retrieval, longer context, or isolated autonomous actions. It is a
continuously operating intelligence system that can preserve mission state,
select authoritative evidence, propose an action, obtain independent review
and authorization, execute through a controlled physical interface, verify
the result, and continue the mission across models, machines, and
communication environments.

This creates a closed-loop validation sequence:

1. **Persistent mission state.** xLMP restores the authoritative mission,
   operational history, constraints, and unresolved objectives.
2. **Environmental change.** New sensor, network, operator, infrastructure,
   or mission evidence enters the system.
3. **Bounded evidence resolution.** The AI Memory Control Plane identifies
   the evidence required for the present decision and places only that
   bounded evidence into active computation.
4. **Action proposal.** An attached model or coordinated model set produces
   a proposed plan or physical action.
5. **Independent review.** Vanguard or another authorized review process
   checks the proposal against evidence, contradictions, mission state, and
   policy.
6. **Signed authorization.** LNES-22 determines whether the proposed action
   is permitted and produces a signed authorization object when the required
   policy conditions are satisfied.
7. **Controlled execution.** NEURO-LOCK or another deterministic control
   interface converts the authorized decision into a bounded physical
   command.
8. **Verified outcome.** Hardware, sensors, or an Edge Witness produces
   signed evidence of what actually occurred.
9. **State reconciliation.** The observed result is compared against the
   authorized objective, and the persistent mission state is updated.
10. **Continuity and handoff.** Another model, machine, operator, or network
    node can resume the mission from the updated authoritative state without
    reconstructing the mission from an unverified conversation history.

This protocol represents the progression from an AI memory benchmark to a
full physical-intelligence validation. The current xLMP benchmark (Section
34–35) evaluates whether authoritative and complete evidence can be
assembled efficiently for computation. Later validation must test whether
the entire evidence–reasoning–authorization–execution–verification loop
remains correct under environmental change, model substitution,
communications disruption, and mission handoff.

> This sequence is a proposed validation architecture. It should not be
> interpreted as a claim that every stage has already been integrated or
> operationally validated.

---

## Part VI: Formal and Empirical Validation

### 33. Computational Model

Let:

```
C    = total persistent corpus (all memory objects in the system)
q    = a query presented to the system
E(q) = bounded evidence staged for query q
W    = model's context capacity
P(q) = prompt tokens consumed for query q
D(C) = discovery cost over corpus C
B    = declared evidence budget
```

Central design objective:

```
|E(q)| << C                     evidence is a small fraction of corpus
|E(q)| ≤ B                      evidence respects declared budget
P(q)  ∝ |E(q)|                  prompt cost proportional to evidence
|E(q)| ≤ W                      evidence fits model's context
```

Stateless full-context:  P(q) ∝ C
RAG top-k:               P(q) ∝ k · chunk_size (bounded; completeness not guaranteed)
xLMP bounded recall:     P(q) ∝ |E(q)| (bounded; completeness guaranteed within declared boundary)

**Important qualification:** D(C) may grow with C. Discovery, index maintenance,
storage, catalog traversal, synchronization, provenance management, and
access-control evaluation may all scale with corpus size. The xLMP claim is
specifically that the model does not need to reprocess the complete corpus for
every task.

Useful-work metric:

```
UW = correct answers / (total prompt + completion tokens) × 1,000
```

### 34. Benchmark Methodology and Test Environment

**Evidence identifiers:** EVD-001, EVD-002 (signed artifacts with SHA-256
hashes, independently verifiable)

**Test environment:** H200 infrastructure (primary benchmark environment).
Cross-accelerator comparison included A10.

**Software versions and configurations:** per signed artifact contents (EVD-001,
EVD-002). Specific versions are documented in the benchmark deliverables and
available to reviewers who verify the artifact SHA-256 hashes.

**Corpus:**
- 8k to 285k tokens (multiple corpus sizes tested)
- Text documents
- No overlap between training data and evaluation corpus

**Scoring:** correctness scored per response; full-context rejected outright
past 262k tokens (context window exceeded).

**Baselines:** full-context injection; RAG (dense-embedding retrieval —
all-MiniLM-L6-v2 embeddings, cosine similarity, top-k=5, specific
configuration in EVD-001). xLMP: root-bound recall from discovered objects.

**Saturation testing (Veena):** QPS ladder test at multiple load points.
QPS-1 and QPS-50 endpoints documented in EVD-002; intermediate QPS 10–45
data pending receipt from Veena for saturation-knee precision.

### 35. Benchmark Results

All results from H200 environment. Evidence: EVD-001, EVD-002.

**Prompt token consumption:**

| Method | Prompt tokens | Notes |
|--------|--------------|-------|
| Full-context | 11k–67k (growing); rejected past 262k | Grows with corpus |
| RAG (dense-embedding baseline) | [in EVD-001] | MiniLM + cosine top-5 |
| xLMP bounded recall | ~660–820 flat | Stable as corpus grew 8k → 285k |

**Accuracy at equal evidence budget:**

| Method | Relative performance |
|--------|---------------------|
| xLMP vs. RAG | +24.4 points average accuracy improvement |

**Correct-task throughput at each method's best sustainable operating point:**

| Method | Relative performance |
|--------|---------------------|
| xLMP vs. full-context | ~11.3× |
| xLMP vs. RAG | ~1.7× |

**Useful Answer per Token (common-support, apples-to-apples, 8k/32k/64k):**

| Method | Relative performance |
|--------|---------------------|
| xLMP vs. full-context | ~42.7× |
| xLMP vs. RAG | ~4.0× |

**64k accuracy note:** accuracy dip at 64k has a confirmed, documented root
cause — chunk-boundary record fragmentation — not a vague scale-related
decline. Per-row evidence in EVD-002. This defect is corrected in the current
VMN implementation.

#### 35.1 Saturation Behavior

From EVD-002 (Veena saturation test):
- Correctness held on completed responses under load
- Throughput collapsed under overload conditions
- "19 QPS sustained capacity" is not an appropriate characterization — the 19 QPS
  data point represents overloaded conditions (38.6% throughput efficiency,
  82% completion ratio)
- 18% of responses at QPS-50 did not complete (timed out)

The correct characterization: correctness held among completed responses; capacity
under sustained load requires the intermediate QPS ladder data (pending Veena
delivery of QPS 10–45 results).

#### 35.2 Benchmark Limitations

- H200-environment results; other hardware not yet benchmarked
- RAG baseline is one specific configuration; more sophisticated RAG may narrow gaps
- Corpus limited to text documents; multimodal corpus not yet tested
- Saturation test: intermediate QPS data pending

#### 35.3 xLMP Context-Efficiency Benchmark (Proposed)

The results in Section 35 hold corpus size fixed. A separate, not-yet-run
benchmark is proposed to test how model-facing context and inference
resource requirements change as persistent application state grows while
task-relevant evidence remains controlled.

**Variables:**

```
C      persistent corpus size
E*(q)  gold required evidence
E(q)   retrieved/assembled evidence
W(q)   model-facing context
K(q)   active KV state
```

**Corpus scale:** 1×, 10×, 100×, 1,000×

**Primary arms:**

- F0 — Full-context dense attention, while technically feasible
- R4 — Modern hybrid RAG + reranker + parent expansion
- X2 — xLMP bounded-evidence resolver
- O1 — Gold-evidence oracle

The same model, generation parameters, and optimized inference runtime
would be held constant across arms. FlashAttention would not be used as a
competing arm; the optimized kernel would be held constant where possible
so the comparison isolates evidence-boundary effects rather than kernel
effects.

**Metrics:** task accuracy; all-required-evidence recall; evidence
precision/recall; model-facing input tokens; time to first token; prefill
latency; decode latency; KV-cache footprint; peak accelerator memory; HBM
traffic where reliable telemetry exists; retrieval/reranking latency;
end-to-end latency; correct tasks per minute; correct tasks per joule or
watt where reliable power telemetry exists.

**Primary hypothesis:** for tasks whose required evidence remains bounded
as persistent state grows, xLMP will make model-facing context and active
KV state materially less sensitive to corpus growth while preserving task
accuracy.

This is stated as a hypothesis to test, not an established result. No run
of this benchmark has occurred.

#### 35.3.1 Cross-Accelerator Scaling: A100 and TPU v6e (R6, Executed)

Unlike the proposed benchmark immediately above, this benchmark has been
executed and sealed. It measures a different question: whether xLMP's
throughput advantage over full-context injection, established on H200 in
Section 35, appears on other accelerator families, and how the size of that
advantage moves with corpus scale on each.

**Method:** frozen retrieval logic with runtime shim — the retrieval and
scoring code under test was held constant across accelerators; each
accelerator required a disclosed runtime workaround to run at all (A100:
32,768-token context-window ceiling on the test host; TPU v6e: a required
`v2-alpha-tpuv6e` image and a configuration-shape patch to the
`tpu_inference`/Qwen2 loader). These are runtime-environment shims, not
modifications to the retrieval logic itself. Model: Qwen2.5-7B-Instruct.
Corpus scales tested: 8k / 16k / 24k tokens. Concurrency: single-stream.

**A100 results** (GCP `a2-highgpu-1g`): S_NVIDIA = 1.41x / 1.92x / 2.63x at
8k/16k/24k tokens respectively (full-context throughput 1212→902→664
tasks/min; xLMP throughput 1704→1732→1744 tasks/min). This does not reach
the H200 benchmark's 11.3x — a real, architectural ceiling of this run, not
a discrepancy: the A100 host's 32,768-token context window caps how large a
full-context baseline penalty can grow before that baseline itself becomes
unable to run.

**TPU v6e (Trillium) results**: S_TPU = 0.945x / 1.118x / 1.375x at the
same three scales — an advantage that is smaller than A100's and grows more
slowly. R-ratio (S_TPU / S_NVIDIA) shrinks with scale: 0.67 → 0.58 → 0.52.
**A real caveat that matters more than the throughput numbers themselves:**
full-context accuracy on TPU is degraded and does not move in one direction
across scale (74% → 54% → 66%). The full-method TPU throughput figures
above should be read with real skepticism about correctness as a result —
they are observed in this pass, not confirmed as reproducible, and are not
counterbalanced or replicated.

**Cross-silicon statement:** the xLMP throughput advantage was observed on
both NVIDIA A100 and Google Trillium v6e under the tested R6 methodology.
This is not a claim that the two accelerators show identical multipliers —
they do not — and it is not a claim that either result replicates or
extends the separate H200 memory-efficiency benchmark (Section 35), which
used different hardware, a different model, and a different metric. The
three are kept as separate benchmark families: H200 memory-efficiency,
A100/TPU cross-accelerator R6 scaling, and (below, Section 35.4 and
Section 20) the LNES-58→LNES-59 state-governance and local-retrieval
benchmark families.

### 35.4 From Retrieval to Authoritative State: LNES-58 → LNES-59

Section 35's benchmark measures token efficiency and throughput at fixed
evidence correctness — it holds the question "did the model get the right
answer" constant and measures cost. A separate, later benchmark line
(LNES-58, then LNES-59) tests a different question: once evidence is
retrieved, should the model's own probabilistic output be the sole
authority over whether that output becomes committed, authoritative
system state? This section reports that line's results. It is a distinct
benchmark from Section 35's H200 corpus-scaling test — different
hardware, different metric, different question — not a continuation of
it.

**LNES-58 (healthcare domain, closed-world)** established, for a
single-relation lookup benchmark: bounded evidence staging; deterministic
entity relationships; explicit MATCH / NO_MATCH / INCOMPLETE resolution
states (never collapsing "not found" into a wrong answer); verified
scoped-negative state; detection of a model output contradicting
committed state; and a deterministic, post-generation authority check
applied after generation, before commitment.

**LNES-59 (enterprise procurement domain, open-world)** tested whether
those same governance patterns generalize to a domain with materially
different structure: multiple documents can speak to the same entity,
authority is tiered and policy-dependent rather than binary, state has
temporal lineage (supersession, revocation, expiry, future-effectiveness),
and evidence includes non-authoritative sources (rumor, unconfirmed
chat/email) that must not be treated as fact. Moving the architecture
into this domain surfaced genuine defects not present in the closed-world
design — full development chronology and defect taxonomy are internal
engineering records, not reproduced here — which were fixed prior to
freezing the architecture (version V7) ahead of a sealed blind holdout.

**The controlled comparison.** On a 50-case sealed, post-freeze synthetic
procurement holdout (evidence identifiers: LNES59-HOLDOUT, frozen after
the architecture itself was frozen and never executed against the
architecture during authoring — see the limitation note below), eight
pipeline configurations were run against the identical 50 cases:

| Arm | Description | Candidate-state correct | Authorized-state correct | False-authoritative-state rate |
|---|---|---|---|---|
| B0 | Full document context, no bound | 72% | 72% | 22% |
| B1 | Dense-embedding RAG | 66% | 66% | 28% |
| B2 | Hybrid (dense+BM25) RAG | 68% | 68% | 26% |
| B3 | Hybrid RAG + cross-encoder reranker | 64% | 64% | 28% |
| B4 | Structured fact-tuple memory, no governance | 72% | 72% | 22% |
| X0 | xLMP bounded evidence, no state governance | 70% | 70% | 24% |
| X1 | xLMP state envelope, ungoverned generation | 84% | 84% | 8% |
| X2 | xLMP state envelope + deterministic state-governance gate | 84% | 82% | **0%** |

**The central result (X1 vs. X2):** X1 and X2 read the identical
deterministically-resolved state envelope and both achieved 84%
candidate-state correctness — the model's raw judgment was identical.
X1 committed 4 of those 50 judgments as authoritative state that
contradicted the deterministically-resolvable ground truth (an 8%
false-authoritative-state rate). X2 — the same pipeline, with one
addition: a deterministic consistency check applied after generation,
before anything is treated as authoritative — committed none of those
four. Observed reduction on this holdout: **8% → 0%, a 100% relative
reduction**, at a disclosed cost of a 10% raw false-block rate (roughly
4% after manual case-by-case inspection attributed the remainder to a
scoring-metric artifact on correctly-blocked authority violations, not
governance errors) and a 6% false-allow rate (cases where the gate
correctly found no contradiction to a model's *hedge*, but a determinate
correct answer existed and the model should have asserted it — a
disclosed structural blind spot, not fixed as part of this benchmark:
the gate is built to catch overclaiming, not underclaiming).

**Stated precisely, because it is easy to overstate:** the model did not
become more accurate. Candidate-state correctness was identical between
X1 and X2 (84% = 84%). The system became more selective about which of
the model's own claims it would accept as authoritative — exactly the
distinction Section 39 makes in the security context ("evidence tells
the agent what the world contains; authority tells the agent what it is
permitted to cause"), now shown to apply to the agent's own memory
commitments, not only to external evidence.

**Four distinct functions, worth naming separately going forward:**

- **Retrieval** answers: what evidence might be relevant?
- **State resolution** answers: what does the committed evidence
  currently establish?
- **Memory authority** answers: what is the system permitted to persist
  as authoritative state?
- **Action authority** (Section 40/41, LNES-22) answers: what is the
  system permitted to cause?

Retrieval and state resolution are evidence functions. Memory authority
and action authority are governance functions. LNES-59's result is
specifically about the boundary between state resolution and memory
authority; it says nothing new about action authority, which remains
LNES-22's domain (see Section 40 for the updated pipeline view).

**Other findings from the same run:**
- **B4** (structured fact memory, no xLMP state governance) tied B0 for
  the best comparator score (72%) but did not close the gap to X1/X2 —
  extracting clean, typed evidence is not the same as resolving it.
- **B1/B2/B3**, reported separately as distinct RAG configurations rather
  than a single "RAG" figure per this paper's Appendix B discipline, had
  uniformly high evidence recall (96–98%) but 64–68% final accuracy — on
  this holdout, the shortfall was concentrated in reasoning over
  temporal/authority/scope conflicts once evidence was already correctly
  retrieved, not in retrieval failure. Adding a reranker (B3) did not
  improve accuracy over the un-reranked hybrid arm (B2) in this
  configuration and cost roughly 100× the retrieval latency (CPU-bound,
  no accelerator in this test environment — a hardware-tier finding, not
  an architectural one).

**Cross-domain framing (deliberately bounded):** LNES-58 and LNES-59
provide **cross-domain evidence** — two independently-designed domains
(healthcare, enterprise procurement) showing directionally consistent
results for the same architectural separation. This is not universal
proof, not a mathematical proof applicable to all AI systems, and not a
physical or thermodynamic law of memory. It is evidence from two domains
that probabilistic interpretation and authoritative state commitment are
separable system functions, worth testing further, not a general law
established by two data points.

**Limitations, disclosed here as in the full report:** n=50 holdout
cases (each case is 2 percentage points of every rate above); a
**sealed, post-freeze synthetic** holdout authored by an agent aware of
the frozen architecture's semantics, not independently authored external
validation; 1 hypothesis and 0 recommendations occurred naturally in
this holdout's question distribution, so hypothesis/recommendation
preservation is directionally informative but thin; the reported
false-block rate is partly a scoring-metric artifact, not purely a
governance-error rate; RAG accuracy here reflects one model and one
prompting approach and could plausibly improve with a stronger model or
different prompting; the B3 reranker latency finding is specific to this
CPU-only test environment. Full methodology, per-case failure autopsy,
and evidence hashes: internal engineering records (`LNES59_Procurement_Bench/`),
not reproduced in full here per this paper's practice of citing evidence
categories rather than internal file paths.

**Procurement boundary condition (LNES-82D.3–D.5, local + cloud, 2026-08-15):** On procurement, ExergyNet found a boundary condition: naive bounded retrieval was fast but inaccurate. Deterministic graph, entity, and policy-state resolvers improved full evidence recall from 46 percent to 60 percent with zero regressions, but remained below the 85 percent cloud gate. Procurement therefore remains an active relational-state research track, not a solved benchmark. A remaining failure class involves content-equivalent policy records with distinct IDs, suggesting that future evaluation should distinguish payload-equivalent evidence from exact document-ID matching — this is a disclosed open question, not a claim that it proves benchmark failure; resolving it would require a purpose-built payload-equivalence evaluator, not yet built.

### 35.5 The Third Domain: LNES-60 Physical Truth (Phase 1 + Phase 1.5 Validated)

LNES-58 tested epistemic truth in a closed-world healthcare domain. LNES-59
tested institutional truth in an open-world enterprise procurement domain.
LNES-60 introduces a third truth model — **physical / configurational truth** —
where the question changes from "which record is authoritative" to "does the
physical object in front of the system conform to the state that any record,
documentary, digital, or witnessed, says it should be in?"

**The research question:** When documentary state, commanded configuration,
and cryptographically witnessed physical state disagree, can ExergyNet
deterministically establish operational state and prevent release until the
conflict is resolved?

**The new evidence plane.** LNES-58/59 operated on documentary evidence
alone. LNES-60 introduces physical witness state — sensor-derived evidence
about the actual physical condition of a component or aircraft — as a fourth
evidence plane, alongside documentary state, command/digital state, and a
witness trust state that must separately validate the sensor's identity,
calibration, freshness, scope, and health before its reading is treated as
admissible evidence. A sensor reading that passes cryptographic integrity
checks is not automatically trusted; trust is a property of the full chain,
not of any single link in it.

**The governing principle (stated precisely to prevent a common
misinterpretation):**

> **Verified physical evidence may invalidate a document-derived operational
> conclusion when the witness's identity, calibration, freshness, integrity,
> scope, and applicability are established.**

This is not "sensor always wins." A sensor reading whose trust properties
are unverified becomes `STALE_WITNESS`, `SENSOR_DEGRADED`, or
`WITNESS_SCOPE_ERROR` rather than an automatic override — the same
non-collapsed resolution discipline as LNES-58/59's epistemic states,
applied to physical evidence. And critically: a historical documentary
fact (e.g., "technician serviced this component") is preserved even when a
trusted physical reading contradicts the current-state conclusion derived from
it — xLMP supersedes the conclusion, not the fact.

**Target domain (architecture design phase):** KTX Tensile-Lift heavy-lift
UAV. The initial output is an engineering pre-flight authorization gate
producing exactly three terminal states: `RELEASE_ELIGIBLE`, `HOLD`, or
`INCOMPLETE`. This operates as an additional safety layer; it does not claim
autonomous FAA return-to-service authorization and does not substitute for
any legally required inspection or human signoff. LNES-22 performs its own
separate policy evaluation before any action authority is granted.

**Benchmark results (Phase 1 + Phase 1.5, synthetic holdout only):** Two
completed validation runs against a sealed 50-case synthetic holdout covering
20 KTX adversarial test classes (≥2 instances each). Phase 1 used a
deterministic rule-based reference simulator; Phase 1.5 used a real probabilistic
model (claude-sonnet-5). All witness data `SIMULATED_WITNESS`; no real sensor
hardware or aircraft involved at any stage.

| Arm | Phase 1 (simulator) | Phase 1.5 (real model) |
|---|---|---|
| P0/M0 Documentary only — false release | 30% (15/50) | 8% (4/50) |
| P0/M0 Documentary only — release accuracy | 18% | 28% |
| P1/M1 Raw telemetry, ungoverned — false release | **34% (17/50)** | **20% (10/50)** |
| P1/M1 Raw telemetry, ungoverned — release accuracy | 66% | 78% |
| P2/M2 Governed + LNES-22 gate — false release | **0% (0/50)** | **0% (0/50)** |
| P2/M2 Governed + LNES-22 gate — release accuracy | 100% | 100% |
| P2/M2 Governed + LNES-22 gate — false hold | 0% | 0% |
| Gate: candidate false releases prevented | 2/2 (100%) | 2/2 (100%) |
| Gate: false holds introduced | 0 | 0 |

**Canonical Phase 1.5 finding:** "Raw telemetry is not authoritative physical
state. Increasing sensor visibility can improve general reasoning while
simultaneously worsening safety-critical release behavior when identity,
freshness, scope, configuration, and authority are not governed."

The real model (Phase 1.5) and the simulator (Phase 1) diverge on which
failure classes drove the M1/P1 regression. The simulator failed on
`known_damage_limited_scope_good` and `record_bad_witnesses_good` (GOOD sensor
overriding a documented defect). The real model handled those classes correctly
via commonsense conflict reasoning, but failed systematically on
`stale_after_event`, `wrong_aircraft`, `wrong_component`, and
`mission_envelope_violation` — failure modes that require persistent temporal,
identity, scope, and authority relationships not contained in an individual
sensor reading. These findings are complementary, not contradictory: both
confirm that deterministic governance (P2/M2) is the necessary mechanism,
regardless of which specific failure mode the model exhibits.

**Architectural statement:** Physical-state correctness and action authority
are separate system properties. An aircraft may be physically healthy while
the requested mission remains unauthorized. xLMP + LNES-60 establishes what
the machine is. LNES-22 establishes what the machine is permitted to do.

**Status:** VALIDATED (Phase 1 + Phase 1.5) on a sealed synthetic holdout.
Phase 2 (real sensor hardware bench): SOFTWARE READY / HARDWARE EXECUTION
PENDING. Phase 3 (aircraft integration): NOT STARTED. No real sensor hardware
campaign conducted; no autonomous return-to-service claim; no regulatory or
legal substitution.

### 36. Context-Boundary Behavior

In an xLMP system, bounded evidence is selected to fit within budget B ≤ W.
The model's context is never exceeded by evidence staging. Retrieval accuracy
degrades gracefully as corpus size grows rather than cliff-failing when the
corpus exceeds the context window. Full-context injection was rejected outright
past 262k tokens; xLMP continued operating at 285k corpus with ~660–820 prompt
tokens.

### 37. Cross-Accelerator Portability

Memory objects retrieved from xLMP are evidence: text, structured data, or
other content compatible with any model accelerator. H200 and A10 environments
both retrieved the same evidence for the same roots. This confirms the
accelerator independence claim: changing compute hardware does not change the
memory objects or the evidence they produce.

---

## Part VII: Security and Authority Boundaries

### 38. Memory Poisoning and Prompt Injection

A persistent memory system increases the attack surface for prompt injection
because injected content can persist across sessions.

xLMP addresses this through:
- Provenance records identifying the source of each object.
- Evidence provenance labels in staged contexts.
- Integrity verification ensuring retrieved evidence matches committed state.

The most important rule:

> Memory output is evidence to reason over. It is not instruction to execute.

### 39. Evidence Is Not Authority

In August 2026, security researchers disclosed exploitation of multi-agent
trust relationships in which an untrusted input caused a privileged workflow
to execute restricted operations through a trusted identity — "privilege
laundering." The persistence of memory makes this vulnerability more severe:
a poisoned memory object retrieved by a trusted agent can cause that agent to
take actions that appear well-founded.

The architectural response:

> Evidence tells the agent what the world contains.
> Authority tells the agent what it is permitted to cause.

An agent's memory retrieval changes what the agent knows. It does not change
what the agent is authorized to do.

In physical AI systems, this extends to the actuation layer: memory recording
a prior decision does not authorize repeating that action. The authorization
chain must be re-established for each consequential physical action.

### 40. LNES-22 as a Companion Control Plane

xLMP controls what evidence enters an agent's computation. LNES-22 controls
what actions that evidence may authorize. Natural language — regardless of how
authoritatively it appears in a retrieved document — has zero authority over
LNES-22 policy decisions.

Detailed treatment is in the companion paper: *LNES-22 and the Agent Authority
Control Plane.*

**The full pipeline, state through action** (Section 35.4's result covers
the boundary through "Authorized State"; everything from LNES-22 downward
is the companion paper's domain and is not what LNES-59 tested):

```
PERSISTENT STATE
      ↓
xLMP — AI MEMORY CONTROL PLANE          (governs what the system knows)
      ↓
PROBABILISTIC MODEL                     (interprets what the system knows)
      ↓
CANDIDATE CLAIM / DECISION
      ↓
DETERMINISTIC STATE GOVERNANCE          (Section 35.4: X1→X2, benchmark-implemented)
      ↓
AUTHORIZED STATE
      ↓
LNES-22 — ACTION AUTHORITY              (governs what the system may cause)
      ↓
EXECUTION
      ↓
EDGE WITNESS / OUTCOME
      ↓
PERSISTENT STATE UPDATE  (feeds back to the top)
```

xLMP governs what the system knows. The model interprets what the system
knows. LNES-22 governs what the system is permitted to accept as
authoritative or to cause. Where physical actuation is involved,
NEURO-LOCK (Section 30) sits below authorized action as the cryptographic
actuation boundary. **LNES-59 validated the deterministic-state-governance
step of this pipeline (state envelope through authorized state) on a
sealed procurement holdout; it did not exercise LNES-22's action-authority
layer, execution, or physical actuation** — those remain governed by the
status distinctions already made in Section 41, Appendix D, and the
companion LNES-22 paper.

### 41. Delegation and Consequential Actions

Any action modifying shared state — code deployment, fund transfer, data
deletion, infrastructure change, credential issuance, physical actuation —
must be treated as consequential and require explicit authority beyond evidence
retrieval.

Minimum requirements for authorizing a consequential action:
- A machine-verifiable delegation receipt signed by the human principal.
- A deterministic policy evaluation confirming the capability is permitted.
- Where production systems or financial flows are involved: explicit human approval recorded in the authority receipt.
- A nonce to prevent replay.
- An expiration that bounds the validity window.

---

## Part VIII: Economics and Industry Impact

### 42. xLMP and Accelerator Demand

xLMP does not reduce demand for accelerators. It makes scarce infrastructure
productive for persistent application classes that temporary-context systems
cannot reliably support.

> xLMP does not eliminate demand for accelerators or semiconductor memory. It
> makes scarce infrastructure productive for persistent application classes
> that temporary-context systems cannot reliably support.

Long-running agents, persistent institutional systems, cross-model workflows,
and physical AI systems with mission memory become viable with persistent
memory. These applications are continuous consumers of compute. Total demand
for accelerators is expanded, not reduced.

### 43. xLMP and the Semiconductor Memory Wall

xLMP reduces the amount of data that needs to be moved from storage into active
HBM on each invocation for supported workloads. It does not increase HBM
capacity; it reduces unnecessary demand on it.

### 43.1 Relationship to AI-Native Storage Processors

AI-native storage processors accelerate encryption, compression, integrity
validation, recovery, and other CPU-side services required to supply data to
agentic systems. The AI Memory Control Plane operates at a different layer.
It determines which persistent state is authoritative, which bounded evidence
should enter computation, and how memory continuity is preserved across
models and systems.

These architectures are complementary. Storage processors increase the
throughput and efficiency of the physical data path. xLMP reduces unnecessary
data movement and governs the semantic and operational memory path above it.
Deployed together, accelerated storage can process Exergy Vault objects more
efficiently while xLMP controls which objects and evidence fragments are
activated for a given task.

This is a market-direction observation, not a benchmark result: no joint
xLMP/AI-native-storage-processor test has been run, and no vendor
relationship or endorsement is claimed.

### 43.2 Model-Specific Silicon and Externalized Intelligence State

Emerging inference architectures can encode model weights directly into
specialized silicon, significantly reducing model-weight movement and
increasing inference efficiency for stable, high-volume workloads. This
development strengthens rather than eliminates the requirement for an
external AI Memory Control Plane.

A model-specific processor may preserve relatively static learned
parameters, but it cannot independently contain the continuously changing
operational state of an application: current evidence, task history,
permissions, tool outcomes, mission state, provenance, and cross-model
continuity.

xLMP separates persistent intelligence state from the processor executing a
particular inference step. Specialized accelerators, general-purpose GPUs,
edge processors, and future model-specific silicon can therefore attach
temporarily to the same governed memory state. Hardware may specialize
around a model while the application's memory, authority, and operational
continuity remain portable.

In this architecture, faster inference silicon accelerates computation. The
AI Memory Control Plane determines what the computation knows, which state
survives, and how another model or processor continues the task.

This section describes an industry direction independently reported
elsewhere (specialized inference silicon acquisitions and licensing
arrangements), not a partnership, integration, or endorsement involving
ExergyNet.

### 43.3 Decoupling Persistent State from Active Attention

Using the notation introduced in Section 33:

```
C     = total persistent application state
E(q)  = evidence activated for task q
W(q)  = model-facing context for task q
```

For dense attention, if the full corpus is inserted into context, attention
cost scales with the size of that context:

```
T_attention ∝ O(C_ctx²)
```

With bounded evidence staging, attention cost instead scales with the size
of the activated evidence:

```
T_attention ∝ O(|E(q)|²)
```

This is not a claim that every storage, retrieval, or control-plane cost is
constant with corpus size — discovery, indexing, and synchronization costs
can still grow with C (Section 33's qualification on D(C) applies here as
well). The claim is narrower and specific to attention: **persistent state
can scale independently of active attention state when the evidence
required for a task remains bounded.**

Decode remains strongly influenced by active KV-cache length and HBM
traffic — bounding W(q) does not remove that cost, it reduces how much of
it a given task incurs. Reducing unnecessary model-facing state therefore
acts before the model-level KV optimizations used by modern inference
runtimes, not instead of them:

> FlashAttention reduces the cost of attending to context. xLMP reduces the
> amount of persistent state that must become context.

**Relationship to model- and kernel-level techniques.** A separate class of
techniques reduces inference cost at the model or runtime level: KV-cache
compression, sparse attention, sliding-window attention, hybrid attention
architectures, and GQA/MQA and related reductions in KV traffic. These
operate on context once it has entered the model runtime. xLMP is a
system-level context and evidence control mechanism that operates before
inference, determining what enters the runtime in the first place. xLMP
does not replace model- or kernel-level techniques. The mechanisms stack:
system-level evidence reduction can reduce the state entering inference,
while model- and kernel-level techniques process that active state more
efficiently.

### 44. Value to Developers

Build applications whose memory survives the model, device, cloud, and session.
Applications built on xLMP can change model providers without losing accumulated
state — reducing provider lock-in at the state layer, which is the most durable
layer of lock-in.

### 45. Value to Accelerator and Cloud Providers

For accelerator providers: more correct output per GPU cycle expands value per
unit of accelerator capacity. For cloud providers: persistent AI memory as a
service is a new billable capability category. xLMP defines the protocol;
cloud providers are natural operators of the infrastructure.

### 46. Applications Enabled by Persistent State

Software classes: lifelong personal agents, institutional knowledge systems,
persistent research systems, continuous compliance agents, multi-model
coordination workflows.

Physical classes: autonomous aircraft with persistent mission memory surviving
power cycles and model replacement; ground and underwater autonomy with
persistent observation and constraint history; multi-vehicle coordination over
shared mission state.

### 47. Toward an Open Memory Interface Standard

Standard concepts: root-addressed memory, portable manifests, discovery versus
recall, evidence completeness, integrity/provenance/authority as separately
verifiable properties, memory transport, and authority receipts.

ExergyNet intends to contribute the xLMP protocol specification to an open
standardization process as the architecture matures.

---

## Part IX: Implementation and Roadmap

### 48. Current Verified Capabilities

- VMN local ingest, BM25 retrieval, root-bound recall
- VMN MCP integration with Claude Code
- SHA-256 content-rooted object identity and integrity verification
- H200 benchmark: prompt tokens 660–820 flat; +24.4 accuracy vs RAG; ~42.7× token efficiency vs full-context (EVD-001, EVD-002)
- Biological Proxy multi-model inference routing (AskMo, TypeScript)
- LNES-11 bilateral consensus (vanguard-ultra mode) in biological_proxy
- Omega Carrier Tools 1–5 (SSE MCP toolset, port 8765)
- LNES-22 Ed25519 signing, sensory trigger, review endpoint, schema validation, replay enforcement
- LNES-06 Edge Witness Android platform (v2.22.8 versionCode 247)
- LNES-12 LiveKit/coturn WebRTC calling layer on Carrier EC2
- On-chain settlement contracts (Base mainnet, August 2026)
- NEURO-LOCK disclosed in FAA operating documentation; Bolt received FAA Exemption No. 26214

### 49. Staged Capabilities

- LNES-22 deterministic policy gate (module implemented; not wired to execution)
- Omega Carrier Tool 6 (`strike_rho_recursion`) HITL gate (deployed); siphon swap signal (not wired)
- Delegation receipt specification (complete; implementation pending)
- LNES-06 xLMP vault integration (staged)

### 50. Current Integrity Commitment Status

Current xLMP deployments use SHA-256 content commitments for local integrity
verification on the synchronous query path. The xLMP-DS ZK query
(`xlmp_zk_query`) returns a SHA-256 hash labeled as a Groth16 receipt on this
hot path — this is documented in the project record (EVD-009) and is not
claimed as genuine ZK proof verification for query-time responses.

A separate, explicit, asynchronous Groth16 proof path (`/api/xlmp/prove`) has
been directly verified: on the currently-deployed CPU infrastructure, this
path completed a real, non-placeholder Groth16 proof for a minimal Vault
object in approximately 13.5 minutes (EVD-011). This validates the optional
proof path while confirming that real Groth16 remains too slow for
synchronous query-time execution on the tested CPU deployment. The result
reflects the currently-deployed CPU configuration only — it does not evaluate
GPU, Bonsai, or other accelerated proving paths, and is not claimed as a
lower bound on achievable Groth16 latency.

The architecture is dual-path: the hot path (synchronous Vault queries) uses
SHA-256 content-addressed receipts for low-latency operation; the cold path
(asynchronous, explicit, opt-in) uses real Groth16 integrity proofs, now
verified to complete successfully on deployed infrastructure for a single
minimal object. Production zero-knowledge computation integrated into the
synchronous query path remains under development and is explicitly NOT
CLAIMED as deployed; the asynchronous proof path is CLAIMED as verified for
one minimal test object, not as validated at production scale, under
concurrent load, or with on-chain settlement.

### 51. Open Research Questions

- Formal evidence completeness for objects with complex internal structure
- Optimal evidence boundary selection for a class of queries
- Cross-object consistency for multi-object evidence retrieval
- Privacy-preserving shared memory in organizational settings
- Memory conflict reconciliation across distributed nodes
- Verifiable model attachment as a component of the authority receipt
- Hardware-attested observation integration with xLMP root scheme
- GPS-independent positioning integration with Atlas spatial graphs [LNES TBD]

### 52. Conclusion and Category Declaration

AI has a powerful execution layer. It does not have a memory layer.

xLMP defines the missing layer. The AI Memory Control Plane is the persistent
systems layer that governs which identified, bounded, provenance-bearing evidence
enters an agent's computation; where that state survives; how integrity,
provenance, and authority are maintained as separately verifiable properties;
and how memory moves portably across models, devices, and accelerators.

The architectural inversion:

> The model is temporary. Persistent memory is primary.
> Computation attaches to state. State does not follow computation.

In the highest-stakes application class — autonomous physical systems — the
same xLMP memory primitive that serves a software agent provides persistent
mission state for machines with kinetic consequence. The authority boundary
that governs what a software agent is permitted to request is extended, through
NEURO-LOCK, to govern what a physical machine is permitted to actuate.

Together, these control planes answer the questions that production autonomous
systems must answer:

```
xLMP:         What evidence is the agent using,
              where did it come from,
              and does it match its committed state?

LNES-22:      What software action is the agent authorized to request,
              by whom, under which policy?

NEURO-LOCK:   What physical action has been verified and authorized,
              and what is the signed record of that decision?
```

ExergyNet introduces the AI Memory Control Plane as the persistent
infrastructure layer beneath autonomous intelligence — digital and physical.

The ultimate consequence of the AI Memory Control Plane is not simply better
model context. It is persistent physical intelligence: systems capable of
preserving authoritative state, reasoning over bounded evidence, requesting
actions under explicit policy, executing through controlled interfaces,
verifying physical outcomes, and continuing a mission across models and
machines. In this architecture, intelligence is not contained within a
single model invocation. It persists as a governed operational state to
which models, tools, networks, and physical systems temporarily attach.

---

## Appendix A: Terminology

**AI Memory Control Plane:** the persistent systems layer that governs what
identified, bounded, provenance-bearing evidence enters an AI agent's
computation; where that state survives; and how integrity, provenance, and
authority are maintained as separately verifiable properties.

**Atlas:** ExergyNet's deterministic geospatial routing and spatial-graph layer
architecture. DESIGNED. Distinct from LNES-11 (which is bilateral consensus).

**Authority:** a property of evidence established when a governing policy
recognizes a specific source or object as authoritative for a specified purpose.

**Bolt (VSG HL 01):** ExergyNet's heavy-lift uncrewed aerial vehicle. Authorized
per FAA Exemption No. 26214 for defined UAS lift operations, MTOW 275 lbs.

**Bounded evidence:** evidence retrieved from a memory object within a declared
boundary, complete within that boundary per the stated recall mode.

**Content addressing:** a scheme in which an object's identity is derived from
its content, not its storage location.

**Discovery:** the operation of identifying candidate memory objects for a query.
Approximate by design. Separate from recall.

**Evidence budget (B):** the maximum evidence volume staged for a single model
invocation.

**Evidence completeness:** every byte, field, or record belonging to the declared
evidence unit is present and integrity-verifiable.

**Evidence root:** the cryptographic commitment derived from the canonical form
of a memory object's content.

**Integrity:** a property established when retrieved bytes match their
cryptographic commitment. Does not imply factual truth, provenance, or authority.

**LNES-06 Edge Witness:** ExergyNet's field observation and sensing Android
platform. DEPLOYED (v2.22.8 versionCode 247).

**LNES-11 (Bilateral Consensus):** the bilateral independent second-opinion
review protocol in biological_proxy (vanguard-ultra mode). DEPLOYED on AskMo.
Not a physical AI subsystem.

**LNES-12:** LiveKit SFU + coturn WebRTC calling layer on Carrier EC2. DEPLOYED.

**LNES-22:** the companion authority control plane governing what software
consequential actions evidence retrieved by an agent is permitted to cause.

**Memory object:** the primary unit of persistent memory in xLMP.

**Model attachment:** the mechanism by which an active model execution session
accesses specific memory objects and stages bounded evidence for a given task.

**NEURO-LOCK:** the sovereign operating system and actuation-control
architecture of Bolt. Disclosed in FAA-reviewed operating documentation for
Exemption No. 26214.

**Omega Carrier:** (1) DEPLOYED: cross-agent MCP toolset, Tools 1–5, SSE port
8765; (2) DESIGNED: cross-device xLMP memory transport architecture.

**OTET:** API-only write gate for infrastructure operations.

**Persistent state:** knowledge stored in a form that survives model replacement,
session termination, device migration, and application restart.

**Provenance:** a property established when the source, issuer, and
transformation history of an evidence object are known and recorded.

**Recall:** the operation of retrieving complete, bounded evidence from a
specific memory object identified by its root.

**VMN (Vanguard Memory Node):** the open-source local implementation of the
xLMP memory architecture.

**xLMP (ExergyNet Ledger Memory Protocol):** the cryptographic memory protocol
defining the AI Memory Control Plane.

---

## Appendix B: Open Versus Proprietary

**Public and independently reproducible:**
VMN local ingest, retrieval, and root-bound recall; SHA-256 content root
derivation; BM25 indexing with morphological normalization; manifest structure;
MCP integration interface; evidence completeness definitions; computational model
notation; FAA Exemption No. 26214 / Docket FAA-2025-5731 (public regulatory
record); NEURO-LOCK authorization chain architecture (as described in Section 30).

**Proprietary (not disclosed in this paper):**
Production xLMP resolver mechanics; Atlas routing graph internals; NEURO-LOCK
OS internals and safety architecture details; LNES-06 hardware key material;
LNES-12 infrastructure credentials; LNES-11 bilateral consensus model configuration;
proof guest circuit internals; policy enforcement engine internals; economic
settlement logic; recovery and reconciliation methods.

---

## Appendix C: Benchmark Companion Status

The primary benchmark deliverables are signed artifacts with verifiable SHA-256
hashes (EVD-001, EVD-002). A publicly reproducible companion publication with:
- Complete corpus description and query set
- Full raw result tables
- Reproducibility package (software versions, configuration, scoring rubric)
- Statistical methodology (confidence intervals, repetition protocol, outlier treatment)
- Saturation test complete data (pending Veena's QPS 10–45 intermediate results)

is in preparation. Tables in this paper marked with specific numbers from EVD-001/002
are drawn from the signed deliverables.

---

## Appendix D: Claim Status Summary

Full claim ledger with evidence identifiers: `exergynet/docs/whitepaper/CLAIM_LEDGER.md`

**DEMONSTRATED (benchmark evidence, EVD-001, EVD-002):**
- xLMP prompt tokens ~660–820 flat (corpus 8k → 285k)
- Full-context tokens 11k–67k growing; rejected past 262k
- +24.4 accuracy points over tested RAG at equal evidence budget
- ~11.3× correct-task throughput vs full-context
- ~1.7× correct-task throughput vs RAG
- ~42.7× Useful Answer per Token vs full-context
- ~4.0× Useful Answer per Token vs RAG
- VMN ingest, retrieval, root-bound recall (same benchmark environment)
- 64k accuracy dip: confirmed root cause (chunk-boundary fragmentation), corrected

**DEMONSTRATED (LNES-58/LNES-59 state-governance benchmarks, Section 35.4 —
sealed synthetic holdouts, not independently third-party authored; see
Section 35.4 limitations):**
- LNES-59: on a 50-case sealed procurement holdout, adding a deterministic
  state-governance gate to an otherwise-identical pipeline reduced observed
  false-authoritative-state commitments from 8% (4/50) to 0% (0/50) with
  identical candidate-state correctness (84% = 84%) between the gated and
  ungated pipelines
- LNES-58/LNES-59 cross-domain evidence (healthcare + enterprise
  procurement) that probabilistic interpretation and authoritative-state
  commitment are separable system functions

**DEMONSTRATED (LNES-82E.1 — dual-path Vault proof architecture, EVD-011):**
- The async Groth16 proof path (`/api/xlmp/prove`) is verified for a minimal
  Vault object: a real, non-placeholder 256-byte Groth16 seal was produced on
  the currently-deployed CPU infrastructure in approximately 13.5 minutes
- The synchronous Vault query path remains SHA-256 receipt based, unchanged
  by this result
- This validates the architecture split between low-latency query receipts
  (hot path) and delayed cryptographic proof generation (cold path) — it does
  not validate production-scale reliability, concurrent-load behavior,
  GPU/Bonsai-accelerated proving, or on-chain settlement from this run

**DEPLOYED:**
See CLAIM_LEDGER.md for full list. Key items:
LNES-06 Edge Witness (v2.22.8); LNES-12 LiveKit/coturn; LNES-11 bilateral
consensus; Omega Carrier Tools 1–5; LNES-22 Ed25519 signing and review
infrastructure; Biological Proxy multi-model routing; Bolt FAA Exemption
No. 26214.

**NOT CLAIMED:**
ZK proof verification integrated into the synchronous Vault query path
(xLMP-DS ZK query still returns a SHA-256-labeled Groth16 receipt on the hot
path, unchanged by EVD-011 — EVD-009); every Vault query being ZK-proven
(only the separate, explicit, opt-in async path produces a real proof);
async Groth16 proving verified at production scale, under concurrent load,
or as a general reliability guarantee (EVD-011 is a single run against one
minimal object); on-chain settlement verified from the EVD-011 proof run;
~13.5 minutes as a universal or hardware-independent lower bound on Groth16
proving time (only the currently-deployed CPU-only path was measured; GPU,
Bonsai, and other accelerated paths were not evaluated); fully operational
NEURO-LOCK cryptographic actuation loop in production; FAA certification of
NEURO-LOCK or xLMP; FAA endorsement of ExergyNet; full LNES-22 authority loop
closure (tunnel broken, policy gate not wired to execution).

---

## Appendix E: References

Borgeaud, S., et al. "Improving Language Models by Retrieving from Trillions
of Tokens." DeepMind, 2021.

Lewis, P., et al. "Retrieval-Augmented Generation for Knowledge-Intensive NLP
Tasks." Meta AI Research, 2020.

Robertson, S., Zaragoza, H. "The Probabilistic Relevance Framework: BM25 and
Beyond." Foundations and Trends in Information Retrieval, 2009.

Mitra, S., et al. "AgenticCyOps: Securing Multi-Agentic AI Integration in
Enterprise Cyber Operations." arXiv:2603.09134, March 2026.

Li, J., Zhang, Y., Polley, N., Ma, Y. "Security Considerations for Artificial
Intelligence Agents." arXiv:2603.12230, March 2026.

Lisichkin, D. (Pillar Security). Google ADK Agent-to-Agent Exploitation
Disclosure. August 2026.

Anthropic. "Claude's Extended Context Window." Technical Report, 2024.

Google DeepMind. "Gemini 1.5: Unlocking Multimodal Understanding Across
Millions of Tokens of Context." arXiv:2403.05530, 2024.

Ben-Sasson, E., et al. "STARK: Succinct and Transparently Verifiable Proofs."
Cryptography ePrint, 2018.

Federal Aviation Administration. Exemption No. 26214, Regulatory Docket No.
FAA-2025-5731. UAS Lift Operations Authorization, KTX VSG HL 01 "Bolt."
275 lbs MTOW. [Public regulatory record.]

NVIDIA. "NVIDIA Vera BlueField-4 STX Brings Agentic AI Storage Processing
With In-Silicon Security." NVIDIA Newsroom, June 2026.

AMD. "AMD Acquires Taalas to Advance Compute Solutions for Rapidly Growing
AI Inference Market." AMD Newsroom, August 2026.

---

## Appendix F: Revision Log

Mandatory per LWP Maintenance Policy §6. Every substantive status change or
structural addition requires a row.

| Version | Date | Claim or section | Previous status | New status | Evidence reference |
|---------|------|-----------------|-----------------|------------|--------------------|
| 1.9 | 2026-08-17 | New Section 35.3.1 (Cross-Accelerator Scaling: A100 and TPU v6e), Section 20 (VMN v2.0 status + new 20.1 LNES-84, new 20.2 LNES-86), VMN physical-AI status-table entry | A100/TPU cross-accelerator results existed only in an unmerged external draft outside the repository; VMN status table did not reflect the v2.0.0 npm publication; canonical had zero LNES-84 or LNES-86 content | Reconciled an external v1.9 working draft (`Documents/Codex/.../AI_MEMORY_CONTROL_PLANE_v1.9_2026-08-15.md`, outside git, not merged wholesale) against sealed benchmark artifacts before any import. Added: A100 R6 scaling (1.41x/1.92x/2.63x) and TPU v6e mirror (0.945x/1.118x/1.375x, with disclosed non-monotonic accuracy caveat), both verified byte-for-byte against sealed summaries; VMN v2.0.0 npm-publication status with adaptive-retrieval capability (mechanism undisclosed, trade secret); LNES-84 workload-dependent retrieval verdict, deliberately presenting both the 1GB/100-query pass's 52,753.8x median speedup and the later, more comprehensive 10MB mixed-vault pass's 0.72x median (indexed approach slower on the realistic query mix) side by side rather than the positive figure alone, per the source artifacts' own final verdict; LNES-86 adaptive-routing headline figures (~1.92x/~1.13x within tested workload) with mechanism withheld per R6. All four kept as separate, explicitly self-distinguishing benchmark families from the existing H200 and LNES-58/59 sections. See `WHITEPAPER_V1_9_CANONICAL_RECONCILIATION_PLAN.md` for the full per-claim verification table | `LNES82C6_ASYMPTOTIC_SCALING_SUMMARY.md`, `LNES82C7B_TPU_MIRROR_SUCCESS_SUMMARY.md`, `LNES84_3_FINAL_VERDICT.md`, `LNES84_3_PHASE4_7_ANALYSIS_REPORT.md`, `LNES86_6_VALIDATION_REPORT.md`, npm registry + GitHub provenance for `@lnes/vanguard-memory-node@2.0.0` |
| 1.9 | 2026-08-17 | Section 35 (Baselines paragraph + prompt-token-consumption table) | RAG baseline described as "BM25-based" / "RAG (BM25 baseline)" | Corrected — the real EVD-001 baseline (`xLMP_Memory_Efficiency_Benchmark_Report.md` §2, sealed package `ExergyNet_H200_Performance_Benchmarks_v2.zip`, SHA-256 `7005fa07...`) is dense-embedding retrieval: all-MiniLM-L6-v2 embeddings, cosine similarity, top-k=5 — not BM25. Triggered by Veena's co-author review of the superseded v1.1 working draft flagging the baseline as possibly TF-IDF; reconciliation against the sealed source found the current canonical text's "BM25" claim was itself the error (not TF-IDF either) | `xLMP_Memory_Efficiency_Benchmark_Report.md` §2 (EVD-001); see `VEENA_WHITEPAPER_REVIEW_RECONCILIATION_2026-08-17.md` for full audit |
| 1.9 | 2026-08-16 | Section 50 (Current Integrity Commitment Status) + Appendix D (DEMONSTRATED, NOT CLAIMED) + Claim Ledger | Production ZK proof verification (Groth16) listed as PLANNED / NOT CLAIMED, no deployed-environment verification on record | Added — the async Groth16 proof path (`/api/xlmp/prove`) directly verified end-to-end on the deployed Portal CPU host: real, non-placeholder 256-byte Groth16 seal produced for a minimal Vault object in ~13.5 minutes. Framed as a dual-path architecture (SHA-256 hot path for synchronous queries, async Groth16 cold path now verified). Explicitly not claimed: production-scale reliability, concurrent-load behavior, GPU/Bonsai-accelerated proving, 13.5 minutes as a lower bound, or on-chain settlement from this run | LNES82E1_VAULT_ASYNC_GROTH16_PROOF_PATH_REPORT.md + _MANIFEST.json + _RAW_RESULTS.json (EVD-011) |
| 1.8 | 2026-08-15 | Section 35.4 (procurement boundary condition, new paragraph) + Claim Ledger (STAGED) | LNES-59 procurement results ended at the X1→X2 controlled comparison, no later cloud/offline follow-up on record | Added the LNES-82D.3–D.5 procurement boundary finding: naive bounded retrieval fast but inaccurate; deterministic graph/entity/policy-state resolvers raised full evidence recall 46%→60% with zero regressions, still below the 85% cloud gate; procurement stays an active research track, not solved; disclosed the content-equivalent-policy-records-under-distinct-IDs open question without overclaiming it as proof of benchmark failure | `LNES82D3_PROCUREMENT_A100_RUN_LOG.md`, `LNES82D4_PROCUREMENT_GRAPH_ENTITY_RETRIEVAL_REPORT.md`, `LNES82D5_POLICY_AUTHORITY_STATE_RESOLVER_REPORT.md` |
| 1.8 | 2026-08-15 | Section 20 (VMN Engineering Findings) + Claim Ledger (NOT CLAIMED) | No local A/B evaluation of BM25-indexed retrieval vs. current xLMP linear scan on record | Added — VMN-style BM25 indexing evaluated locally as a candidate xLMP retrieval replacement; did not outperform the current linear scan at 20–164 document procurement-corpus scale (~18×–98× slower); evidence recall not consistently better; not a validated advancement, remains an open large-scale/crossover research question | LNES-84.2 local A/B benchmark, 40 trial runs (4 corpus scales × 5 counterbalanced trials × 2 methods), zero errors; `LNES84_2_XLMP_VMN_CANDIDATE_REPORT.md` |
| 1.8 | 2026-08-09 | Validation (Section 35.5 benchmark table + architectural statement) | v1.7 prose-only results | Added Phase 1 vs Phase 1.5 side-by-side metrics table; canonical finding statement; architectural statement "physical-state correctness and action authority are separate system properties"; Phase 2 maturity label "SOFTWARE READY / HARDWARE EXECUTION PENDING"; removed orphaned v1.6 status text | LNES60_PHASE1.5_FINAL_VALIDATION_REPORT.md + LNES60_PHASE1_VS_PHASE1.5_COMPARISON.md |
| 1.7 | 2026-08-09 | Validation (Section 35.5 status upgrade) | "Architecture Defined — Not Yet Executed" | Upgraded to "Phase 1 + Phase 1.5 Validated": added Phase 1 (deterministic simulator, 0% P2 false releases on sealed 50-case holdout) and Phase 1.5 (real model claude-sonnet-5, 0% M2 false releases, 100% accuracy, 2/2 gate corrections on mission-envelope cases, 0 false holds) results; added Status block with VALIDATED label, synthetic-only caveat, no-regulatory-substitution claim; section heading updated to reflect current maturity | LNES60_PHASE1.5_FINAL_VALIDATION_REPORT.md + LNES60_PHASE1_FINAL_VALIDATION_REPORT.md; sealed evaluator outputs; independently verified by frozen scorer against sealed holdout |
| 1.6 | 2026-08-08 | Validation (new Section 35.5) | Not present | Added — "LNES-60: The Third Domain: Physical Truth (Architecture Defined — Not Yet Executed)": four-plane truth model, governing principle, KTX domain, RELEASE_ELIGIBLE/HOLD/INCOMPLETE terminal states, explicit DESIGNED status and no-regulatory-claim scope | Operator-authorized architectural addition; no experiment executed, no benchmark result claimed; internal engineering documents LNES60_Physical_Truth/ |
| 1.5 | 2026-08-08 | Appendix D | LNES-58/59 not present in demonstrated claims | Added LNES-58/LNES-59 state-governance demonstrated-claim entry, cross-referencing Section 35.4 | LNES-59 sealed holdout, 400/400 case-arm evaluations, direct measurement |
| 1.5 | 2026-08-08 | LNES-22 pipeline (Section 40) | Text description only, no full state→action diagram | Added full pipeline diagram (persistent state → xLMP → model → candidate claim → state governance → authorized state → LNES-22 → execution → edge witness → persistent-state update) with explicit scope note that LNES-59 validated only through "authorized state," not action authority or physical actuation | Operator-authorized addition; describes existing architecture plus the new Section 35.4 result, no new implementation-status claim |
| 1.5 | 2026-08-08 | Validation (new Section 35.4) | Not present | Added — "From Retrieval to Authoritative State: LNES-58 → LNES-59": full 8-arm comparator table, X1→X2 controlled-comparison result, retrieval/state-resolution/memory-authority/action-authority distinction, cross-domain framing, disclosed limitations | LNES-59 sealed post-freeze synthetic procurement holdout, 50 cases, 400 case-arm evaluations, 0 failures; `LNES59_FINAL_VALIDATION_REPORT.md` and `LNES59_FINAL_RESULTS_MANIFEST.json` (SHA-256 verified unchanged before this update) |
| 1.4 | 2026-08-07 | Category Definition (Section 5) | Text-only description of xLMP vs. execution roles | Added data-boundary diagram (persistent state → xLMP → bounded evidence → KV cache/HBM → FlashAttention/kernels → SRAM/tensor cores → computation) with explanatory paragraph | Operator-authorized addition; describes existing architecture, no new claim |
| 1.4 | 2026-08-07 | Economics (new Section 43.3) | Not present | Added — "Decoupling Persistent State from Active Attention": formal O(C_ctx²) vs O(\|E(q)\|²) attention-scaling distinction, explicit non-constant-cost caveat, relationship to model/kernel-level techniques (KV-cache compression, sparse/sliding-window/hybrid attention, GQA/MQA) | Operator-authorized addition; established ML-architecture techniques, no external claim requiring verification; claim-discipline constraints applied (no O(1)/thermodynamic-necessity language) |
| 1.4 | 2026-08-07 | Validation (new Section 35.3) | Not present | Added — "xLMP Context-Efficiency Benchmark (Proposed)": corpus-scale sweep (1x-1000x) methodology, variables, arms, metrics; explicitly labeled a hypothesis to test, not a run result | Operator-authorized roadmap addition; no benchmark execution performed or implied |
| 1.3 | 2026-08-07 | Category Definition (new Section 9.1) | Not present | Added — "Temporal Validity and Decision Lineage," extending the Section 7 integrity/provenance/authority triad with temporal validity and decision-lineage as governance dimensions; cross-references Section 32.1 rather than duplicating its chain diagram | Operator-authorized addition; synthesizes and sharpens operator's own framing, no external claim requiring verification |
| 1.3 | 2026-08-06 | Economics (new Section 43.2) | Not present | Added — "Model-Specific Silicon and Externalized Intelligence State," positioning xLMP as complementary to model-hardwired inference silicon; explicit no-partnership, no-endorsement caveat included | Operator-authorized addition; AMD/Taalas acquisition and Taalas HC1 (~17,000 tok/s/user, Llama 3.1 8B) independently verified via web search before inclusion (AMD Newsroom, Aug 2026) |
| 1.3 | 2026-08-06 | Economics (new Section 43.1) | Not present | Added — "Relationship to AI-Native Storage Processors," positioning xLMP as complementary to (not competing with) hardware storage acceleration; explicit no-joint-benchmark, no-vendor-relationship caveat included | Operator-authorized addition; NVIDIA Vera BlueField-4 STX announcement independently verified via web search before inclusion (NVIDIA Newsroom, June 2026) |
| 1.3 | 2026-08-06 | Physical AI (new Section 26.1) | Not present | Added — "Trust Infrastructure for Physical Autonomy," framing ExergyNet as airframe-independent trust infrastructure vs. a single-platform program; no regulatory-adoption or market claims included | Operator-authorized architectural addition; commercial/regulatory strategy content kept out per operator's own scope split |
| 1.3 | 2026-08-06 | Physical AI (new Section 32.1) | Not present | Added — "Closed-Loop Validation for Persistent Physical Intelligence," a proposed 10-stage validation sequence; explicitly framed as target architecture, not claimed as integrated | Operator-authorized architectural addition; synthesizes existing xLMP/LNES-22/NEURO-LOCK triad |
| 1.3 | 2026-08-06 | Vanguard role (Section 6 table and Physical AI Status Table) | "Multi-model inference routing and coordination over persistent state" | "Multi-model inference, bounded planning, review, and coordination over persistent state" | Operator-authorized refinement; not claimed as a general-purpose autonomous planner |
| 1.3 | 2026-08-06 | Category Declaration (Section 52) | Ended at "persistent infrastructure layer beneath autonomous intelligence" | Added closing paragraph naming persistent physical intelligence as the architecture's ultimate consequence | Operator-authorized addition; no benchmark, implementation-status, FAA, or LNES-22 deployment claim changed |
| 1.2 | 2026-08-05 | Canonical location | Downloads working draft | `exergynet/docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` | Governance correction |
| 1.2 | 2026-08-05 | Version label | "Public Draft" | "Internal Co-Author Review Draft" | Co-author acceptance and legal entity unresolved |
| 1.2 | 2026-08-05 | Institutional affiliation | "ExergyNet Corp" (unverified) | "ExergyNet" (technology identity pending legal confirmation) | Governance correction |
| 1.2 | 2026-08-05 | LNES-11 (Section 28.1) | "GPS-independent mesh positioning" (incorrect) | LNES-11 = bilateral consensus (biological_proxy, vanguard-ultra); positioning layer TBD | EVD-006 — numbering collision with deployed system |
| 1.2 | 2026-08-05 | LNES-12 (Section 29.2) | "Designed: Global Media Mesh" (incorrect) | DEPLOYED: LiveKit/coturn WebRTC calling layer on Carrier EC2 | EVD-007 — LNES12_CHANGE_LOG.md |
| 1.2 | 2026-08-05 | LNES-06 (Section 29.1) | "Designed: hardware-authenticated observation layer" (understated) | DEPLOYED: Android sensor platform v2.22.8; xLMP integration STAGED | EVD-005 |
| 1.2 | 2026-08-05 | Omega Carrier (Section 21) | "DESIGNED" (incorrect for toolset) | Tools 1–5 DEPLOYED (SSE port 8765); Tool 6 STAGED; cross-device transport DESIGNED | EVD-008 |
| 1.2 | 2026-08-05 | NEURO-LOCK status table | Single "DESIGNED + FAA-REVIEWED" field | 5 separate dimensions: IMPLEMENTATION, FAA_DISCLOSURE, REGULATORY_PLATFORM, FAA_TECHNICAL_ENDORSEMENT, PRODUCTION_ACTUATION | Governance correction |
| 1.2 | 2026-08-05 | LNES-22 (Section 32) | Single-line "STAGED" | Per-component breakdown (9 components, mixed DEPLOYED/BROKEN/STAGED/DESIGNED/NOT_WIRED) | EVD-004 |
| 1.2 | 2026-08-05 | Benchmark numbers | "pending companion publication" (T4 environment) | Real H200 numbers from signed deliverables: 660–820 prompt tokens; +24.4 accuracy; 42.7× token efficiency | EVD-001, EVD-002 |
| 1.2 | 2026-08-05 | Veena contribution | "AI/ML validation; retrieval-versus-reasoning analysis" (generic) | H200 saturation testing; QPS ladder analysis; concurrency testing; benchmark presentation for NVIDIA | EVD-010 |
| 1.2 | 2026-08-05 | Atlas (Section 28) | "DESIGNED with deployed OSRM/MLD substrate" (unverified claim in review) | DESIGNED; no deployed routing engine found in project record | Project record review |
| 1.1 | 2026-08-05 | Physical AI section (Part V) | Not present | Added — DESIGNED / FAA-REVIEWED per subsystem | Architecture documentation; EVD-003 |
| 1.1 | 2026-08-05 | Co-authorship | Single author (Seven Ezumba) | Veena and Phone proposed; PENDING FINAL REVIEW | Co-author acceptance process initiated |
| 1.0 | 2026-08-03 | Full paper v1.0 | v0.9 internal draft | 12-point assessment applied | Initial assessment review |

---

Seven Ezumba
Chief Architect and Corresponding Author
ExergyNet

**Version 1.9 — Internal Co-Author Review Draft**
August 2026

Co-authors Bontu Veena and Kyaw Phone: listed as proposed co-authors pending
independent final review and acceptance confirmation.
[CO-AUTHOR ACCEPTANCE PENDING]

*This document must not be published, committed to a public repository, or
distributed externally until: (1) both co-authors confirm; (2) legal entity
name is confirmed; (3) FAA source note is attached; (4) claim ledger passes
review; and (5) operator explicitly authorizes publication.*
