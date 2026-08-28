# ExergyNet Public Narrative Canon

**Directive:** VP Sales Directive 004 — Full Commercial Website Rebuild + Canonical Machine Narrative
**Date:** 2026-08-27
**Status:** Canonical. Every human-facing page and every first-party machine-readable surface (meta tags, JSON-LD, OpenGraph, Twitter cards, `.well-known` manifests, OpenAPI descriptions, package manifests) must derive from this document. Where a page or surface diverges from this canon without a recorded reason, that is a defect.

**Verification discipline:** every clause below was checked against the site's own architecture pages (`docs.html`, `protocol.html`), the frozen whitepaper V2 (`EXERGYNET_WHITEPAPER_PUBLIC_V2.md`), the internal claim ledgers, and the Directive 001–003 findings before being frozen here. A clause is retained only if the current implementation does not contradict it; where an exception exists (Vanguard's current API path), it is stated explicitly rather than smoothed over.

---

## 8–12 Word Identity

> **Infrastructure for useful machine work and persistent state.**

Retained as proposed. Alternatives considered and rejected: "Model-independent infrastructure for autonomous machine intelligence" (too architectural, no economic hook in the identity line itself); "The persistent memory and authority layer for AI agents" (leads with Layer 2, not Layer 1, contradicting the frozen hierarchy).

## One-Sentence Description

> **ExergyNet provides model-independent infrastructure for measured AI efficiency, persistent authoritative state, interoperable systems, and bounded consequential action.**

Retained as proposed — matches the frozen four-layer order (Useful Work → Authoritative State → Interoperability → Authority) exactly, and every noun phrase is independently defensible: "measured" (not claimed) efficiency, "persistent authoritative state" (Layer 2's actual name, not "memory"), "interoperable" (not "unifying" or "controlling"), "bounded" consequential action (not "authorized" or "governed").

## 25-Word Description

> ExergyNet is model-independent infrastructure that gets more validated useful work from AI systems you already run, preserves state your organization controls, and connects systems without owning them.

## 50-Word Description

> ExergyNet is infrastructure — not a model, not a replacement for your cloud or your AI vendor. It measures and improves useful work per task on infrastructure you already operate, gives your organization a persistent, model-independent record of state and evidence, and lets independent systems interoperate without surrendering internal control to each other or to ExergyNet.

## 100-Word Description

> AI models are becoming cheaper and more interchangeable, but the cost of persistent, multi-step, multi-agent work — reconstructing state, re-fetching evidence, coordinating across models and organizations — is not falling at the same rate. ExergyNet is model-independent infrastructure built for that gap. It starts with a measurable question: does a given workload get more validated useful work done, on infrastructure you already run, without replacing your model or your cloud? It then provides customer-controlled, model-independent authoritative state — because models can change, but institutional state must persist — and lets independent systems interoperate at their boundaries, with consequential authority remaining with the institutions that hold it, not with ExergyNet.

## Buyer Statement

> **Keep your models. Keep your cloud. Keep control of your institutional state.**

All three clauses retained — checked against architecture:
- *"Keep your models"* — true for the memory/state layer (xLMP, Omega Carrier, VMN never require a specific model); **exception:** Vanguard's OpenAI-compatible API is itself an alternative inference endpoint. Where Vanguard is discussed, the buyer statement must be qualified: Vanguard is one optional execution mode, not a requirement to adopt ExergyNet's other layers, and it can run alongside an existing provider (Directive 003's fix already establishes this).
- *"Keep your cloud"* — true; nothing in the architecture requires migrating off a customer's existing cloud provider.
- *"Keep control of your institutional state"* — true for the architecture's design intent (Section 6 of whitepaper V2, "What ExergyNet Does Not Require"); current measured execution-state portability is still bounded (same-process and short fresh-process only), which is a capability-maturity fact, not a control-ownership fact, and does not contradict this clause.

## Core Product Statement

> **Models can change. Institutional state must persist.**

Retained verbatim — this is whitepaper V2's own core line (Section 4), independently arrived at and already frozen there.

## Interoperability Statement

> **Systems can interact without surrendering internal control to one another or to ExergyNet.**

Retained as proposed — matches whitepaper V2 Section 7 (Administrative Boundaries and Interoperability) exactly: "Each organization retains its own internal systems and its own authoritative state, bridged only at the interaction boundary."

## Authority Statement

> **ExergyNet coordinates externally defined authority. It does not originate institutional authority.**

Retained as proposed — matches `security.html`'s existing correct framing ("identity is not authority") and whitepaper V2 Section 8's "reasoning and authority must remain separable, not that ExergyNet should govern every model." This statement governs every future authority-adjacent claim: **authority must be described as originating from the institution using ExergyNet, never from ExergyNet itself.**

## Evidence Statement

> **Measured results are stated only within their tested envelopes.**

Retained verbatim. This is the house style already modeled by `benchmarks.html` and `protocol.html`'s "Measured, Not Claimed" discipline and is now canon for every page, not just those two.

---

## CTA Hierarchy

Four distinct user intents, kept separate on every page that offers a CTA — a page may not collapse two of these into one button:

| Intent | Label | Destination |
|---|---|---|
| **Primary — evaluation** | **Benchmark Your Workload** | `design-partner.html` (new) |
| **Secondary — commercial** | **Request a Design Partnership** | `design-partner.html` (new), or a `mailto:` where a dedicated page isn't yet warranted |
| **Technical — diligence** | **Review the Evidence** | `benchmarks.html` |
| **Developer — integration** | **Build with ExergyNet** | `developers.html` / `docs.html` |

Homepage-specific primary/secondary CTA wording is decided in the homepage section of `WEBSITE_COMMERCIAL_REBUILD_2026-08-27.md` (may read "See the Measured Results" rather than "Benchmark Your Workload" depending on page-flow placement), but must route to the same four underlying intents.

---

## What ExergyNet Does Not Require

Public, standard box — used on the homepage, `enterprise.html`, and `design-partner.html` at minimum:

> ExergyNet does not inherently require an adopting organization to:
> - replace its preferred model;
> - standardize on one model vendor;
> - abandon its existing cloud;
> - transfer institutional policy authority to ExergyNet;
> - allow ExergyNet to decide organizational policy;
> - make ExergyNet the owner of enterprise data;
> - route every internal model operation through one central ExergyNet-controlled service.
>
> **Exception, disclosed:** Vanguard's OpenAI-compatible inference API is itself an alternative model-execution endpoint — using it means at least some calls are served by ExergyNet's own inference rather than an external provider. It is opt-in per call and can run alongside an existing provider; it is not a requirement of adopting ExergyNet's state, evidence, or authority layers. Separately, opt-in settlement through ExergyNet's own test-network infrastructure (Omega/MMS) involves an ExergyNet-operated component by design.

Every item was checked against current implementation before inclusion; none is stated where the current build contradicts it. If a future product changes this, the exception list must be updated in the same commit that ships the change — this list is a standing invariant, not a one-time claim.

---

## The Four-Layer Commercial Hierarchy (frozen, governs all page structure)

$$
\text{Useful Work} \rightarrow \text{Authoritative State} \rightarrow \text{Interoperability} \rightarrow \text{Authority}
$$

### Layer 1 — Useful Work
Entry proposition: **more validated useful work from existing AI infrastructure.** Preferred metrics: correct-task throughput, prompt/state overhead, qualified successful tasks, resource consumption where measured, latency where measured. Raw tokens are a supporting measurement, never the headline value proposition. Do not convert throughput into dollar/GPU-count savings language unless a specific benchmark was designed to measure that. The approved phrasing for the site's strongest result: *"approximately 11.3× correct-task throughput versus the tested full-context baseline, within the measured H200 workload"* — never *"11.3× cheaper AI"* or equivalent financial-arithmetic shorthand.

### Layer 2 — Authoritative State
The durable product layer. Enforce the distinction everywhere it's introduced:

$$
\text{Context} \neq \text{Memory} \neq \text{Authoritative State}
$$

- **Context** — current inference input.
- **Memory** — information retained for future reasoning.
- **Authoritative State** — the externally maintained representation of what the system currently treats as canonical: provenance, evidence, version, authority, permissions, transition history (where applicable).

Never claim general runtime-state portability. The medium/long fresh-process execution-state limitation (0/10 in tested runs, per the claim ledger) must remain stated wherever state portability is discussed in technical depth.

### Layer 3 — Interoperability
Position ExergyNet as infrastructure used *across* boundaries, never as the owner of every participant. Lead with: model substitution, state continuity, agent handoff, administrative boundaries, evidence portability, capability semantics, cross-organization coordination. Preferred concept: *"Interoperability without surrendering internal control."* Never claim every organization requires ExergyNet.

### Layer 4 — Authority
Important, but late — never the opening pitch, never the homepage's primary CTA. Public security principle: *"AI can propose. It should not authorize itself."* Evidence: the existing bounded LNES-22 live prompt-injection result. Prohibited: describing ExergyNet as sovereign; saying ExergyNet decides policy; saying the patent-pending Consequence Boundary (referred to internally as PPA-002) is the only possible solution; saying unauthorized consequences are universally impossible. The correct scope statement: *a consequential action is constrained only where the applicable ExergyNet enforcement boundary is actually present and active* — never a universal claim.

---

## Loaded-Term Discipline (applies everywhere, not just Layer 4)

Before publishing any of the following terms, the five-question test from Directive 004 §30 must be satisfied: (1) is it technically defined on this page or one it links to; (2) is it experimentally verified or clearly marked architectural/proposed; (3) is its scope stated; (4) does another page use the same term differently (if so, reconcile); (5) does it make ExergyNet sound like a central controller when it should not.

Watch list: control plane, operating system/OS, universal, trust, authoritative, verified, proven, guaranteed, immutable, live, production, deployed, mainnet, ZK, Groth16, STARK, physical truth, proof, autonomous, no human, mathematically, hardware independent, model agnostic, model independent.

**Model independence, defined precisely** (per Directive 004 §34): *"The surrounding ExergyNet state/protocol architecture is not defined by one reasoning model's internal weights or vendor identity."* This does **not** imply every component already works with every model, that execution state is portable across every model, or that every provider can be switched with zero integration work. Model independence is architectural decoupling, not universal compatibility — never conflate the two.

**Hardware independence** — do not publish "hardware independent," "validated across GPU and TPU," "works identically everywhere," or "cross-hardware proven" unless new evidence exists beyond what the claim ledger currently supports. The approved architectural-intent phrasing: *"designed to operate independently of a specific model provider or accelerator architecture"* — only when clearly distinguished from a claim of cross-hardware validation.

---

## Sovereignty Vocabulary — Canon Rule

ExergyNet does not describe **itself** as sovereign, anywhere. "Sovereign" may only appear where it accurately describes a **customer or participating institution** retaining control — never ExergyNet's own infrastructure, products, tiers, or runtime behavior. Internal product/tier names that create unnecessary domination framing (e.g., a "Sovereign" pricing tier, a "Sovereign Siphon" component name) should be renamed for their public-facing label even if a stable internal identifier is preserved in code for compatibility. Full occurrence-by-occurrence disposition is tracked in `WEBSITE_COMMERCIAL_REBUILD_2026-08-27.md`'s sovereignty-rebase section, not repeated here.

---

## KTX / Kunfirm — Standing Public Framing

KTX (Kunfirm Innovative Services) and ExergyNet are **separate legal entities** that share common IP and governance lineage. This is a real, verified relationship — KTX is not an unrelated third party, and should not be described as one. However, two boundaries are permanent and must never be blurred in public copy or structured data:

$$
\text{KTX FAA authorization} \neq \text{FAA validation of ExergyNet}
$$

$$
\text{Common control/IP lineage} \neq \text{same legal entity}
$$

Do not expose the internal Ezumba Dynasty Trust / EDT Inc. assignment chain in public copy or structured data unless a specific page requires it and the disclosure has been separately approved. Organization schema (JSON-LD `Organization` blocks) must use only verified, public-appropriate corporate facts and must never state or imply that KTX owns ExergyNet, that ExergyNet owns KTX, or that FAA authorization belongs to ExergyNet.

---

## Held Claims (do not publish, pending Directive 005)

- **"Official Anthropic MCP Registry"** (or equivalent Anthropic-affiliation language) — classification `HOLD_FOR_EXTERNAL_VERIFICATION`. A third-party profile repeating this claim is not sufficient sourcing; only an authoritative Anthropic-controlled source would clear it. Not found stated on any first-party ExergyNet surface during this pass's search, but must not be introduced anywhere without that verification.
- **MCP Vouch score (71/100, Grade C)** — real, independently produced, but evaluated an older ExergyNet MCP version. Do not advertise the score, do not call it current validation, do not hide it if asked. Queued for Directive 005 (remediate → re-scan → then it may become a real third-party proof point).

---

## Change Control

This document is canon as of 2026-08-27. Any future change to identity language, the CTA hierarchy, or the four-layer hierarchy itself must be recorded as a dated revision here, following the same discipline `LWP_MAINTENANCE_POLICY.md` applies to the whitepaper — this is not a place for silent drift.
