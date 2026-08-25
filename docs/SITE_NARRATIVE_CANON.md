# ExergyNet — Site Narrative Canon

**Status:** Canonical source of truth for all public website copy.
**Created:** 2026-08-24 (per *EXERGYNET SITEWIDE RECON + NARRATIVE MIGRATION DIRECTIVE*).
**Governs:** every `.html` page, `llms.txt`, `.well-known/*`, `sitemap.xml`, shared `header.html`/`footer.html`.
**Evidence base (read directly this pass, not from memory):**
`docs/security/PUBLIC_SECURITY_CLAIM_MATRIX.md` (2026-08-23),
`docs/whitepaper/CLAIM_LEDGER.md` (2026-08-18),
`docs/whitepaper/audit/SUBSYSTEM_STATUS_MATRIX.md` (2026-08-05),
`../VAULT_LEDGER.md` (current-state table, 2026-08-23), `PROJECT_BLOCKERS.md`.

**Rule:** Every future public page derives from this file. Do not introduce a public claim
that is not traceable to an entry here or to a cited evidence record. When implementation
reality changes, update this file *first*, then the pages.

---

## 1. One-sentence identity

> **ExergyNet is a persistent state, evidence, and authority substrate for autonomous intelligence.**

## 2. One-paragraph system description

Models reason. ExergyNet is the infrastructure *around* the model that preserves state,
binds evidence to the decisions that used it, governs what a machine identity is permitted
to cause, verifies consequential operations, and maintains continuity across models,
machines, and time. An AI model is a reasoning engine operating inside this governed
environment — it is not the system itself. ExergyNet's durable primitives (state, evidence,
intelligence, authority, consequence, verification, continuity) remain relevant regardless
of which model does the reasoning.

**The conceptual test the whole site must pass:** *If every current frontier model were
replaced tomorrow, the site would still explain why ExergyNet exists.* The narrative lives
at the infrastructure layer, not the model layer.

## 3. Architectural planes

| Plane | Question it answers | Primary implementation surface |
|---|---|---|
| **State** | What does the system know across sessions, machines, agents, models? | Exergy Vault / xLMP; VMN (local) |
| **Evidence** | What information caused a decision, where did it originate, can its integrity/provenance be checked? | xLMP roots + signed provenance; AERIS (external data); Edge Witness (physical) |
| **Intelligence** | Which engine is appropriate for this operation? | Vanguard (orchestration / model selection / execution coordination) |
| **Authority** | What is this machine/model/agent actually permitted to cause? | LNES-22 Consequence Boundary; xISA capability taxonomy |
| **Consequence** | What protected state transition is being requested? | The gated execution path (APIs, code, infra, settlement) |
| **Verification** | What independent evidence exists that computation/observation/authorization/settlement occurred as represented? | RISC Zero receipts; on-chain anchoring; signed decision logs |
| **Continuity** | Can the system survive model swap, restart, machine migration, context loss? | Omega Carrier (transport); persistent Vault state |

## 4. Core system properties (Level 2)

**Persistent** · **Bounded** · **Verifiable** · **Governed** · **Portable**

These five words are the approved property vocabulary. Use them; do not coin synonyms
page-to-page.

## 5. Component taxonomy (Level 4 — implementations, not the identity)

| Component | One-line responsibility | Verified status (see §8) |
|---|---|---|
| **Exergy Vault / xLMP** | Persistent, content-addressed state + bounded evidence delivery | Memory/benchmarks DEMONSTRATED; ZK settlement NOT on hot path |
| **VMN (Vanguard Memory Node)** | Local/private deployment of xLMP over MCP | LIVE (npm `@lnes/vanguard-memory-node@2.0.0`, 2026-08-17) |
| **Vanguard** | Reasoning / orchestration / model selection / execution coordination over bounded evidence | Multi-model routing DEPLOYED; "direct GPU kernel" NOT supported |
| **LNES-22** | Authority Control Plane / Consequence Boundary | Deterministic validator + signed rejection logging LIVE; policy gate SHADOW MODE |
| **xISA** | Capability/authority vocabulary for consequence classes | RESEARCH-VALIDATED in isolation; not production-active |
| **Omega Carrier** | Transport of persistent state/evidence/identity between boundaries | Tools 1–5 DEPLOYED (MCP, port 8765); cross-device transport DESIGNED |
| **AERIS** | Authenticated external-data acquisition + provenance | Membrane DEPLOYED on Base Sepolia; production settlement path BLOCKED (Gen4 pending) |
| **Edge Witness (LNES-06)** | Physical-world observation / hardware-signed capture | DEPLOYED (Android v2.22.8, versionCode 247) |
| **ZK / Proof systems** | Computation-verification within their proven envelope | RISC Zero zkVM real; async Groth16 verified once (CPU, 1 minimal object); on-chain verifiers MOCK |
| **Solana / Base** | Settlement, receipt, coordination, anchoring rails | Base contracts deployed; mainnet FFLONK verifier MOCK; Solana LNES-03 settlement FAILING |

**The blockchain is not the product identity.** Settlement rails are infrastructure beneath
the architecture, not the top-level story.

## 6. Model independence (state as architectural property, not adapter promise)

Approved framing (§8 of directive):
**Model ≠ Memory · Model ≠ Identity · Model ≠ Authority · Model ≠ Provenance · Model ≠ Execution permission · Model ≠ System state.**

A model may *reason over* these primitives; it does not *own* them. State this as an
architectural property. State implemented model adapters *separately* and only where real
(e.g. OpenAI-compatible API surface on Vanguard; MCP bridge accepts agents built on any
model). Do not claim compatibility that isn't implemented.

## 7. Canonical terminology & legacy mappings

| Use this | Not this (legacy / retired) |
|---|---|
| Persistent state, evidence & authority substrate | "AI Memory Control Plane" *as the top-level identity* (demote to xLMP subsystem label) |
| xLMP = persistent state + bounded evidence substrate | "sovereign mathematical physics engine", "physical truth" as identity |
| Vanguard = reasoning/orchestration/execution coordination | "Vanguard Neural Engine", "direct GPU kernel invocation" (unsupported — GPU falls back to CPU, BLK-012) |
| LNES-22 = Consequence Boundary / authority control plane | — (keep LNES-22 as technical id; lead with capability) |
| Settlement rails (Solana / Base) | "decentralized protocol" / "physical compute mesh" *as identity* |
| Receipts / verification | "ZK-STARK VERIFIED" as a blanket production claim (see §9) |

LNES identifiers may remain as technical identifiers in body copy, but public information
architecture is **capability-first** — a visitor should not have to decode LNES numbers to
understand the system.

## 8. Status vocabulary (single sitewide set — use exactly these)

| Label | Meaning |
|---|---|
| **LIVE** | Actively deployed and operating; independently verified. |
| **PRODUCTION-TESTED** | Operating implementation with documented tests. |
| **SHADOW MODE** | Evaluates real operations but does not exclusively control execution. |
| **RESEARCH-VALIDATED** | Implemented/tested in an isolated or experimental environment. |
| **TESTNET** | Operating on non-production settlement/infrastructure. |
| **PLANNED** | Designed but not yet implemented/deployed. |
| **LEGACY** | Available for compatibility, no longer preferred. |
| **DEPRECATED** | Should not be used for new integrations. |

Do not use the word "production" with different meanings on different pages. If it is shadow
mode, say shadow mode everywhere.

## 9. Verified public measurements (safe to state, bounded)

All bounded to tested envelope; sources = `CLAIM_LEDGER.md` (EVD-###) unless noted.

- xLMP prompt tokens ~660–820 flat as corpus grew 8k→285k tokens (H200). *EVD-001*
- xLMP **+24.4 accuracy points** over tested RAG at equal evidence budget. *EVD-001*
- xLMP **~11.3×** correct-task throughput vs full-context (best sustainable point). *EVD-001*
- xLMP **~1.7×** correct-task throughput vs RAG; **~4.0×** token efficiency vs RAG; **~42.7×** token efficiency vs full-context. *EVD-001/002*
- LNES-84 Compact Index: **52,753.8×** median in the *narrow* 1GB/100-query pass; **0.72×** aggregate median in the realistic mixed-vault pass. *EVD-013* — never state the 52,753.8× without the workload bound.
- LNES-86 adaptive routing: **~1.92×** vs always-full-scan / **1.886×** on the LNES-86.2 frozen holdout; **~1.13×** vs static compact-index. *EVD-014*
- Security tests: **64** assertions across LNES-22's 3 unit scripts (23+20+21); **38/39** Omega Carrier adversarial tests (1 = test-env artifact); **100/100** concurrent double-allocation serialized; **106/106** xISA functional tests (research-validated). *PUBLIC_SECURITY_CLAIM_MATRIX*
- Async Groth16 proof: real 256-byte seal, **~13.5 min**, CPU-only, **one 98-byte object** — validates the dual-path split only. *EVD-011*

## 10. Prohibited / unsupported claims (do not publish)

- **"141-test validation"** of LNES-22 — number appears nowhere in the record. Use verified counts (§9).
- Any **FAA / NEURO-LOCK / Bolt / Atlas** capability or affiliation. FAA Exemption 26214 holder of record is **Kunfirm Innovative Services LLC**, not ExergyNet; "ExergyNet" appears nowhere in the FAA document; NEURO-LOCK is contradicted by a direct read. **Currently absent from all pages — keep it that way.**
- **"Absolute", "unhackable", "tamper-proof", "100%", "99.9%", "zero retention", "permanent", "infinite", "mathematically final", "world's first", "the first"** — unless the exact claim is established by test evidence. Default: remove or bound.
- **"Every Vault query is ZK-proven" / "ZK-STARK VERIFIED on Base Mainnet"** — the synchronous query path returns a **SHA-256 receipt**, not a real proof; mainnet verifiers are MOCK and route no real capital.
- **Universal O(1) retrieval** or universal Compact Index speedup — workload-dependent (0.72× in the realistic pass).
- **"Direct GPU kernel" / GPU-accelerated inference as a live guarantee** — vanguard-pro silently falls back to CPU (BLK-012).
- **"HIPAA compliant" as a self-certified absolute** — describe the *architecture* (on-prem, local processing, no third-party API egress in the tested pipeline), not a compliance certification.
- Broad **competitor claims** (that a provider trains on your data, retains everything, hidden latency/margins, etc.) unless current, sourced, and materially relevant.

## 11. Current integration endpoints & network coordinates (publishable)

- Portal: `https://portal.exergynet.org` · Vault: `https://storage.exergynet.org` · MCP gateway: `https://exergynet.org/mcp`
- Vanguard API (OpenAI-compatible surface): `https://api.exergynet.org/v1`
- npm: `@lnes/vanguard-memory-node` (VMN) · `@elizaos/plugin-exergynet` (ElizaOS)
- Solana program: `7BCPpUMBxQMPomsgTaJsQdLEfycNwPWqkQD1Cea4CcCL`
- Base: LNES-04 membrane + LNES-14 registry deployed (mainnet + Sepolia). **Do not present mainnet ZK settlement as live** (verifier MOCK).
- Discord / X (`@ExergyNet`) as listed in header/footer.

**Never publish:** EC2/host IPs (e.g. `18.209.174.113`, `52.44.165.199`, `3.234.120.103`),
internal RPC hosts, private keys, DB coordinates, or any credential. (Directive §23.)

## 12. Patent references that may be publicly stated

> **Patent Pending — U.S. Provisional Patent Application No. 64/134,973, filed August 2026 (USPTO confirmation no. 7997). This architecture is described in that filing; formal claims remain subject to prosecution.**

Do **not** claim: a formal filing receipt has issued; the architecture is "novel" / "first of
its kind"; or specific gate field-layouts / thresholds. Organizing principle **"identity is
not authority"** is safe as high-level framing.

## 13. Legal-entity note (unresolved — human action required)

Legal entity name ("ExergyNet" vs "ExergyNet Corp" vs other) is an **open item**
(`CLAIM_LEDGER.md`). Homepage JSON-LD currently says "ExergyNet Corp" while `legal.html`
says "ExergyNet is not a corporation … a sovereign mathematical physics engine" — a direct
contradiction. **Do not resolve this in copy without operator/legal confirmation.** Flag any
legal-substance change for human review before deploy (directive §11, §24).

## 14. Page responsibilities (IA roles)

| Page | Owns this in the narrative |
|---|---|
| Home | The whole system: durable state + checkable evidence + reasoning-vs-authority separation, then introduces the planes/components. |
| Security | Consequence Boundary / machine authority thesis (current authority reference — do not weaken). |
| xLMP / Vault | Persistent state + bounded evidence (no longer "memory alone = ExergyNet"). |
| VMN | Local/private persistent state; accessible deployment surface. |
| Vanguard | Reasoning/orchestration/model-selection/execution coordination (not legacy GPU marketing). |
| Omega Carrier | Transport of state/evidence/identity — transport ≠ authority. |
| AERIS | Authenticated external evidence acquisition + exact guarantees. |
| Edge Witness | Physical observation as a distinct evidence boundary — state what is and isn't witnessed. |
| Protocol | Interfaces/rules connecting the planes; settlement networks as rails beneath. |
| SDK / Docs / MCP | Capability-first developer path: state → evidence → orchestration → authority → tools → verification → receipts → settlement. |
| Benchmarks | Bounded measurements, each tied to the architectural proposition it supports. |
| Proof / Settlement | Receipts + verification as system properties; settlement ≠ semantic truth. |
| Ghost-Witness / CLC | Scoped application/reference surface — must not redefine the parent architecture. |
| Legal | Match legal language to what ExergyNet currently is + who provides services (human-review gate). |

## 15. New-vs-old system model (validated against implementation)

```
HUMAN / ORGANIZATION / MACHINE
        │
        ▼  PERSISTENT STATE      Exergy Vault / xLMP / VMN          [state]
        ▼  EVIDENCE PLANE        provenance · integrity · AERIS · Edge Witness   [evidence]
        ▼  INTELLIGENCE PLANE    models · Vanguard · routing        [intelligence]
        ▼  CONSEQUENCE BOUNDARY  identity · capability · freshness · integrity · policy (LNES-22)  [authority]
        ▼  EXECUTION PLANE       APIs · code · infra · settlement   [consequence]
        ▼  RECEIPTS + STATE UPDATE  → written back to persistent state  [verification → continuity]
```
Validated caveat vs the directive's draft diagram: the Consequence Boundary is **shadow mode**
today (evaluates + logs, not yet sole gate); the Execution → settlement leg is **testnet /
mock-verifier** for on-chain ZK. The diagram is architecturally accurate; the *enforcement*
status is bounded per §8.
