# Category Copy Package
**Document type:** Proposed replacement copy for category positioning and terminology
**Audit date:** 2026-08-05
**Constraint:** NO DEPLOYMENT — proposed copy only; operator approval required before applying

All proposed copy is grounded in the canonical white paper `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` v1.2. Benchmark numbers used are EVD-001/EVD-002 verified only. No unsubstantiated claims are introduced.

---

## A. Homepage Hero (index.html)

### Current hero (inferred from audit):
"ExergyNet | Sovereign Memory and Verifiable Compute"
Supporting: "11.3× Correct-Task Throughput · 660–820 Flat Prompt Tokens · 100% Across T4, A10, H200"

### Proposed hero headline:
```
xLMP — The AI Memory Control Plane
```

### Proposed hero subhead:
```
The first independently verifiable AI memory layer.
Content-addressed. Authority-controlled. Hardware-independent.
```

### Proposed hero body (2–3 sentences):
```
xLMP sits between your model and your data — not a database, not RAG, not a
context window. Every memory object carries a cryptographic content root,
a signed provenance record, and a policy-governed authority state, each
verifiable without trusting ExergyNet's infrastructure.

At H200 scale: 11.3× correct-task throughput vs full-context. 660–820 prompt
tokens — flat as your corpus grows from 8,000 to 285,000 tokens.
```

### Proposed hero CTAs:
```
[Read the White Paper]   [Developer Quickstart]   [Try the API]
```

---

## B. Page Title Tags (Proposed Updates)

| PAGE | CURRENT TITLE | PROPOSED TITLE |
|------|--------------|----------------|
| index.html | "ExergyNet \| Sovereign Memory and Verifiable Compute" | "xLMP — The AI Memory Control Plane \| ExergyNet" |
| whitepaper.html | "Sovereign Memory & Verifiable Compute \| ExergyNet" | "xLMP: The AI Memory Control Plane \| ExergyNet White Paper" |
| vanguard.html | "Vanguard Engine \| ExergyNet — Enterprise AI Inference" | "Vanguard Inference \| ExergyNet — Production AI Inference API" |
| omega-carrier.html | "Omega Carrier — MCP Bridge for Stateful AI Agents" | "Omega Carrier \| ExergyNet — MCP Bridge for Stateful AI Agents" (unchanged — accurate) |
| proof.html | "On-Chain Proof \| ExergyNet" | "On-Chain Verification \| ExergyNet — LNES-04 AERIS WITNESS" |

---

## C. Meta Descriptions (Proposed)

| PAGE | PROPOSED META DESCRIPTION (≤160 chars) |
|------|----------------------------------------|
| index.html | "xLMP: the AI Memory Control Plane. Content-addressed, authority-governed memory for AI agents. 11.3× throughput vs full-context at H200 scale." |
| whitepaper.html | "Read the xLMP white paper — ExergyNet's AI Memory Control Plane. Integrity, provenance, and authority for verifiable AI memory." |
| vanguard.html | "Vanguard: production AI inference API from ExergyNet. Built for stateful AI agents with xLMP memory integration." |
| omega-carrier.html | "Omega Carrier: MCP bridge connecting AI agents to xLMP memory. 5 tools deployed. Stateful AI sessions, cryptographic receipts." |
| proof.html | "Verify ExergyNet on-chain proofs. LNES-04 AERIS WITNESS: Groth16-sealed weather settlements on Base Sepolia testnet." |

---

## D. Open Graph Title and Description (Proposed)

For social sharing (Twitter/X card, LinkedIn preview, Slack unfurl):

```html
<!-- index.html -->
<meta property="og:title" content="xLMP — The AI Memory Control Plane | ExergyNet" />
<meta property="og:description" content="The first independently verifiable AI memory layer. Content-addressed. Authority-controlled. 11.3× throughput vs full-context at H200 scale." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://exergynet.org/" />

<!-- whitepaper.html (post-rebuild) -->
<meta property="og:title" content="xLMP: The AI Memory Control Plane — ExergyNet White Paper" />
<meta property="og:description" content="The white paper introducing xLMP — a verifiable AI memory category above RAG and below model architecture. H200 benchmark evidence included." />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://exergynet.org/whitepaper.html" />
```

**Twitter/X Card:**
```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="xLMP — The AI Memory Control Plane | ExergyNet" />
<meta name="twitter:description" content="Content-addressed AI memory. Cryptographic provenance. Authority control. 11.3× throughput vs full-context baseline." />
```

---

## E. JSON-LD Organization Structured Data (Proposed)

To be added to `index.html` `<head>`:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "ExergyNet",
  "url": "https://exergynet.org",
  "description": "ExergyNet develops xLMP — the AI Memory Control Plane. Content-addressed, authority-governed AI memory with cryptographic provenance, independently verifiable without trusting ExergyNet infrastructure.",
  "sameAs": [],
  "product": {
    "@type": "SoftwareApplication",
    "name": "xLMP",
    "applicationCategory": "AI Memory Control Plane",
    "description": "Content-addressed AI memory layer. Three independently verifiable properties: Integrity (SHA-256 content root), Provenance (signed record), Authority (policy-governed decision status).",
    "operatingSystem": "Cloud, Edge, Android (LNES-06)"
  }
}
```

**Note:** `sameAs` array should be populated with verified social/GitHub URLs before publication. Do not add placeholder URLs.

---

## F. xLMP Architecture Summary (Proposed — for whitepaper intro section and index.html)

```
xLMP: THREE INDEPENDENTLY VERIFIABLE PROPERTIES

Every xLMP memory object carries three properties that a reader can verify
without trusting ExergyNet:

INTEGRITY — a SHA-256 content root. The memory object cannot be altered
without invalidating the root. Detectable by any reader with the hash.

PROVENANCE — a signed provenance record. The creation event, source, and
signing key are preserved. Verifiable against the signer's public key.

AUTHORITY — a policy-governed authority state. A recognized decision
status (approved / rejected / pending) derived from the combination of
policy and provenance. Auditable via the LNES-22 authority log.

These three properties together constitute a memory control plane:
a layer that governs what an AI can recall, not just what it stores.
```

---

## G. Developer Call to Action (Proposed — for docs, api-integration, and mcp pages)

```
BUILD WITH xLMP

The Vanguard Memory Node (VMN) is the open-source xLMP reference
implementation — SHA-256-shard storage, BM25 morphological search,
MCP integration ready.

Omega Carrier connects any MCP-capable AI agent to your xLMP memory
in one configuration step. Five tools deployed.

→ Developer Quickstart
→ OpenAPI Reference
→ Omega Carrier MCP Configuration
→ VMN Open Source (GitHub)
```

---

## H. Whitepaper.html Interim Placeholder (Stage 3 — until rebuild)

If Stage 7 (rebuild) is not immediately following Stage 3, add this notice to whitepaper.html:

```html
<div class="whitepaper-update-notice" style="background:#fff3cd; border:1px solid #ffc107; padding:16px; margin:24px 0;">
  <strong>White Paper Update in Progress</strong><br>
  A new edition of this paper is in final co-author review and will be published shortly.
  The content below reflects our prior architecture overview.
  The updated paper introduces the xLMP category and includes the H200 benchmark evidence package.
</div>
```

This notice does not modify the existing content — it adds honest context without removing the existing (valid but incomplete) paper.

---

## I. Category Claim Boundary

The following phrases are APPROVED for use in copy when referring to xLMP:

- "AI Memory Control Plane" — primary category claim
- "content-addressed AI memory" — accurate technical description
- "cryptographic provenance" — accurate (SHA-256 + signing)
- "independently verifiable" — accurate (the three properties are each verifiable without trusting ExergyNet)
- "above RAG, below model architecture" — canonical positioning from white paper

The following phrases are NOT APPROVED until the relevant ZK circuit is deployed and verified:

- "zero-knowledge verified" — for Vault operations (use CLASS-A replacement)
- "ZK-STARK" — for any live product claim (LNES-90 is blocked)
- "Groth16 proof" — for Vault operations (AERIS WITNESS only, testnet, CLASS-B)
- "trustless compute" — implies ZK trustlessness; replace with "content-addressed"
