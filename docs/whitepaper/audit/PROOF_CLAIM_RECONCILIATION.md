# Proof Claim Reconciliation
**Document type:** Per-page ZK/proof claim register with exact replacement text
**Audit date:** 2026-08-05
**Constraint:** NO DEPLOYMENT — reconciliation record only

Covers all pages containing references to: Groth16, FFLONK, FRI, STARK, SNARK, ZK verification, proof verification, blockchain verification.

Canonical ZK status (as of 2026-08-05):

| COMPONENT | CANONICAL STATUS |
|-----------|-----------------|
| Vault ZK Query (xLMP-DS) | SHA-256 content-addressed receipt. NOT a ZK proof. (EVD-009) |
| AERIS WITNESS (LNES-04 v5) | Groth16-sealed on Base Sepolia TESTNET. Real Groth16. Mainnet = MOCK. |
| LNES-17 Journal Weld | Deployed on Base Sepolia. Real integrity seal. Not a general-purpose ZK prover. |
| LNES-90 FRI verifier circuit | 1-query circuit validated end-to-end. 100-query monolithic BLOCKED (BLK-003). No on-chain deployment. |
| FFLONK | BLOCKED (BLK-004, needs ≥64GB RAM build machine). Not deployed. |
| LNES-13 AERIS Guest Circuit | DESIGNED / partial implementation. Not deployed to production. |

---

## Standard Replacement Blocks

Three classes of ZK claim, each with an approved standard replacement:

**CLASS-A: Vault memory query ZK claims**
> Use when the claim is about the `vault_zk_query` operation or general Vault memory receipts.
```
[APPROVED REPLACEMENT — CLASS-A]
Vault memory queries are content-addressed using SHA-256 cryptographic hashing,
producing a tamper-evident receipt that can be independently verified.
On-chain zero-knowledge proof verification for Vault operations is in development.
```

**CLASS-B: AERIS WITNESS / settlement Groth16 claims**
> Use when the claim is about AERIS WITNESS weather-event settlement proofs specifically.
```
[APPROVED REPLACEMENT — CLASS-B]
AERIS WITNESS settlement proofs are sealed with Groth16 zero-knowledge proofs
on Base Sepolia testnet. Mainnet settlement is in final validation.
```

**CLASS-C: Roadmap / future ZK claims**
> Use when the claim describes a planned ZK capability, not a current one.
```
[APPROVED REPLACEMENT — CLASS-C]
Zero-knowledge proof verification is planned via LNES-90 (FRI circuit),
currently in development. No on-chain ZK verifier is deployed for this function.
```

---

## Per-Page Reconciliation

### PCR-001 — .well-known/ai-plugin.json

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/.well-known/ai-plugin.json` |
| Proof terms found | "Groth16 cryptographic proof of execution," "Zero-Knowledge verified" |
| Claim class | CLASS-A |
| Current text (exact) | `"description_for_model": "Returns a Groth16 cryptographic proof of execution."` and `"description_for_human": "Trustless, Zero-Knowledge verified off-chain compute for AI agents."` |
| Canonical status | FALSE — SHA-256 receipt, not Groth16 (EVD-009) |
| Replacement text | See CP-001 in CRITICAL_PATCH_APPROVALS.md |
| Requires full read? | No — complete file reviewed |
| Operator approval required? | YES |

---

### PCR-002 — omega-carrier.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/omega-carrier.html` |
| Proof terms found | "ZK provenance metadata" |
| Claim class | CLASS-A |
| Current text (exact) | `vault_recall_state: Returns sealed content with ZK provenance metadata` |
| Canonical status | OVERSTATED — SHA-256 receipt, not ZK (EVD-009) |
| Replacement text | `vault_recall_state: Returns sealed content with SHA-256 content-addressed provenance metadata` |
| Requires full read? | No — reviewed in audit |
| Operator approval required? | YES |

---

### PCR-003 — proof.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/proof.html` |
| Proof terms found | "immutable, independently verifiable proofs," "full sovereign settlement loop" |
| Claim class | CLASS-B (AERIS WITNESS) but with wrong contract address |
| Current text | "immutable, independently verifiable proofs" + `0x5CFE...` address |
| Canonical status | FALSE (wrong contract) + OVERSTATED (mainnet mock) |
| Replacement text | See CP-002 in CRITICAL_PATCH_APPROVALS.md. Use CLASS-B for AERIS WITNESS. Add mock disclaimer for mainnet. |
| Requires full read? | No — key elements reviewed |
| Operator approval required? | YES |

---

### PCR-004 — api-integration.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/api-integration.html` |
| Proof terms found | ZK/Groth16 terms + accurate disclosure at line 936 |
| Claim class | MIXED |
| Current disclosure (line 936, exact) | *"Vault ZK Query currently returns a SHA-256 receipt in place of a full RISC Zero proof while that circuit is finished."* |
| Canonical status | PARTIALLY ACCURATE — disclosure exists but other ZK claims on the page may not have equivalent disclosure |
| Replacement text | Verify the line 936 disclosure is prominently positioned relative to any ZK claims on the same page. Add CLASS-A block near all other Vault ZK references. Keep existing disclosure as it is accurate. |
| Requires full read? | YES — must confirm disclosure prominence and scope of other ZK claims on page |
| Operator approval required? | YES (after full read) |

---

### PCR-005 — enterprise.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/enterprise.html` |
| Proof terms found | "ZK-STARK" (via grep) |
| Claim class | REQUIRES_FULL_READ — likely CLASS-A or CLASS-C |
| Current text | Contains "ZK-STARK" (exact phrase and surrounding context: REQUIRES_FULL_READ) |
| Canonical status | OVERSTATED pending full read |
| Replacement text | If "ZK-STARK" describes Vault operations: use CLASS-A. If roadmap: use CLASS-C. If AERIS WITNESS: use CLASS-B. |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) |

---

### PCR-006 — explorer.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/explorer.html` |
| Proof terms found | "ZK-STARK VERIFIED" (via grep — likely in demo/explorer UI labels) |
| Claim class | REQUIRES_FULL_READ — may be demo UI labels for simulated jobs |
| Current text | Contains "ZK-STARK VERIFIED" (exact context: REQUIRES_FULL_READ) |
| Canonical status | If demo labels: add "Simulated" qualifier. If presented as live: FALSE. |
| Replacement text | If demo UI: `ZK-STARK VERIFIED [SIMULATED DEMO]` or `SHA-256 RECEIPT [LIVE]`. If live explorer data: use CLASS-A. |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) |

---

### PCR-007 — faq.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/faq.html` |
| Proof terms found | ZK/Groth16 terms (via grep) |
| Claim class | REQUIRES_FULL_READ — FAQ context likely matters for classification |
| Current text | Contains ZK/Groth16 terms (exact phrase: REQUIRES_FULL_READ) |
| Canonical status | OVERSTATED pending full read |
| Replacement text | For each FAQ item: apply CLASS-A (Vault), CLASS-B (AERIS WITNESS), or CLASS-C (roadmap) as appropriate to the question context. |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) |

---

### PCR-008 — docs.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/docs.html` |
| Proof terms found | ZK/Groth16 terms (via grep) |
| Claim class | REQUIRES_FULL_READ — developer docs may have technical context that distinguishes which component is being described |
| Replacement text | Apply appropriate class per component. Developer docs should be the most precise — no ambiguity permitted. |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) |

---

### PCR-009 — nodes.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/nodes.html` |
| Proof terms found | ZK/Groth16 terms (via grep) |
| Claim class | REQUIRES_FULL_READ — node documentation may reference proof submission by nodes |
| Replacement text | If describing nodes submitting AERIS WITNESS proofs: CLASS-B. If describing node verification of Vault receipts: CLASS-A. |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) |

---

### PCR-010 — protocol.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/protocol.html` |
| Proof terms found | ZK/Groth16 terms (via grep) |
| Claim class | REQUIRES_FULL_READ — protocol specification context |
| Replacement text | Protocol specs should be most precise. Apply CLASS-A for Vault receipt protocol; CLASS-B for AERIS WITNESS protocol; CLASS-C for planned ZK protocol. |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) |

---

### PCR-011 — roadmap.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/roadmap.html` |
| Proof terms found | ZK/Groth16 terms (via grep) |
| Claim class | LIKELY CLASS-C (roadmap items by definition are planned) |
| Replacement text | Verify all ZK items are framed as "planned" or "in development." Roadmap items LNES-90, FFLONK must reference blocked status or be framed as "planned" without deployment timeline. Do NOT add LNES-90 as a "coming soon" milestone with implied timeline given current block status. |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) |

---

### PCR-012 — security.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/security.html` |
| Proof terms found | ZK/Groth16 terms (via grep) |
| Claim class | REQUIRES_FULL_READ — security page ZK claims have high credibility impact |
| Replacement text | Any security claim tied to ZK must use CLASS-A or CLASS-B precisely. No CLASS-C (roadmap) items on security page unless clearly labeled "planned." |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) — HIGH priority given security context |

---

### PCR-013 — token.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/token.html` |
| Proof terms found | ZK/Groth16 terms (via grep) |
| Claim class | REQUIRES_FULL_READ — token pages may reference proof for staking, governance, or settlement |
| Replacement text | Apply class per context. If referencing AERIS WITNESS settlement: CLASS-B. If referencing Vault operations: CLASS-A. |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) |

---

### PCR-014 — mcp.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/mcp.html` |
| Proof terms found | ZK/Groth16 terms (via grep) |
| Claim class | REQUIRES_FULL_READ — MCP documentation may describe tool descriptions similar to ai-plugin.json |
| Replacement text | If MCP tool descriptions repeat the "Groth16 proof of execution" language from ai-plugin.json: apply same fix as CP-001. |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) |

---

### PCR-015 — orderbook.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/orderbook.html` |
| Proof terms found | ZK/Groth16 terms (via grep) |
| Claim class | REQUIRES_FULL_READ — orderbook may reference AERIS WITNESS proof for settlement |
| Replacement text | If describing AERIS WITNESS settlement: CLASS-B. |
| Requires full read? | YES |
| Operator approval required? | YES (after full read) |

---

### PCR-016 — lnes06.html

| FIELD | VALUE |
|-------|-------|
| URL | `https://exergynet.org/lnes06.html` |
| Proof terms found | ZK/Groth16 terms (via grep) |
| Claim class | REQUIRES_FULL_READ — LNES-06 (Edge Witness Android) page may reference observation proof |
| Replacement text | LNES-06 is the Android sensor platform (DEPLOYED). Its ZK proof status depends on whether it integrates with AERIS WITNESS (CLASS-B) or the Vault (CLASS-A). |
| Requires full read? | YES (475KB file) |
| Operator approval required? | YES (after full read) |

---

## Reconciliation Summary

| PAGE | ZK TERMS FOUND | REQUIRES FULL READ | CLASS | APPROVED REPLACEMENT READY |
|------|---------------|-------------------|-------|---------------------------|
| .well-known/ai-plugin.json | Groth16, ZK verified | No | CLASS-A | YES — see CP-001 |
| omega-carrier.html | ZK provenance | No | CLASS-A | YES — see CP-007 |
| proof.html | Verifiable proofs | No | CLASS-B | YES — see CP-002 |
| api-integration.html | ZK terms + disclosure | YES | MIXED | Partial — after full read |
| enterprise.html | ZK-STARK | YES | TBD | No — after full read |
| explorer.html | ZK-STARK VERIFIED | YES | TBD | No — after full read |
| faq.html | ZK/Groth16 | YES | TBD | No — after full read |
| docs.html | ZK/Groth16 | YES | TBD | No — after full read |
| nodes.html | ZK/Groth16 | YES | TBD | No — after full read |
| protocol.html | ZK/Groth16 | YES | TBD | No — after full read |
| roadmap.html | ZK/Groth16 | YES | Likely CLASS-C | No — after full read |
| security.html | ZK/Groth16 | YES | TBD | No — after full read |
| token.html | ZK/Groth16 | YES | TBD | No — after full read |
| mcp.html | ZK/Groth16 | YES | TBD | No — after full read |
| orderbook.html | ZK/Groth16 | YES | TBD | No — after full read |
| lnes06.html | ZK/Groth16 | YES (475KB) | TBD | No — after full read |

**Replacements ready without full reads: 3 pages (ai-plugin.json, omega-carrier.html, proof.html)**
**Replacements pending full reads: 13 pages**
