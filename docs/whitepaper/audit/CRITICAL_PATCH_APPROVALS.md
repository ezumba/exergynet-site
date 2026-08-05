# Critical Patch Approvals
**Document type:** Approval-ready per-finding remediation record
**Audit date:** 2026-08-05
**Stage 1 operator approval:** 2026-08-05
**Stage 1 execution status:** APPLIED — branch `fix/stage1-security-false-claims`; awaiting commit

CP-001 through CP-007 are APPROVED with operator-supplied wording corrections. CP-008 (CP-010 in prior numbering, ZK across 12 pages) is Stage 2. CP-009 (whitepaper.html) is Stage 7.

Operator signs off by marking each entry APPROVED / REJECTED / NEEDS_REVISION.

---

## CP-001 — ai-plugin.json false Groth16 claim (CRITICAL-001)

| FIELD | VALUE |
|-------|-------|
| Finding ID | CRITICAL-001 |
| Public URL | `https://exergynet.org/.well-known/ai-plugin.json` |
| Source file | `.well-known/ai-plugin.json` |
| Severity | CRITICAL |
| Stage | Stage 1 |

**Exact current text:**
```json
"description_for_human": "Trustless, Zero-Knowledge verified off-chain compute for AI agents.",
"description_for_model": "Returns a Groth16 cryptographic proof of execution."
```

**Canonical fact:** The `vault_zk_query` operation returns a SHA-256 content hash labeled as a receipt. It is not a Groth16 proof and is not zero-knowledge verified. Source: EVD-009. Corroborated by `api-integration.html` line 936 disclosure.

**Evidence reference:** EVD-009 (xLMP-DS ZK query implementation review)

**Risk:** This is a machine-readable manifest consumed by ChatGPT, Claude, and other AI orchestrators as authoritative fact. Every AI agent calling this tool is being told it received a Groth16 ZK proof when it received a SHA-256 hash. This is a false technical claim at the agent-to-agent trust layer. It is also independently verifiable and therefore a credibility exposure when discovered by security researchers.

**Removal safer than replacement?** No — the file is required for the MCP plugin to function. Replacement with accurate language is required.

**Exact proposed replacement:**
```json
"description_for_human": "Content-addressed AI memory protocol with cryptographic provenance. Vault queries return SHA-256-anchored receipts. On-chain ZK proof verification is planned.",
"description_for_model": "Returns a SHA-256 content-addressed receipt confirming the memory query was executed. This is not a Groth16 or ZK-STARK proof — it is a content hash. A full on-chain verifiable proof circuit is in development and not yet deployed."
```

**Required approver:** Operator (Seven Ezumba)
**Approval status:** [x] APPROVED (with revised wording — do not state SHA-256 hash proves execution; use tamper-evident receipt language) — 2026-08-05
**Applied:** `.well-known/ai-plugin.json` updated

---

## CP-002 — proof.html contract address (CRITICAL-002 / SEX-002)

| FIELD | VALUE |
|-------|-------|
| Finding ID | CRITICAL-002, SEX-002 |
| Public URL | `https://exergynet.org/proof.html` |
| Source file | `proof.html` |
| Severity | CRITICAL |
| Stage | Stage 1 |

**Exact current text (paraphrased — full page not read; address confirmed via VAULT_LEDGER research):**
The page lists the LNES-04 on-chain verifier contract as `0x5CFE075149776f4b3cca07a27D4fd85A60BA5e3f` and claims "immutable, independently verifiable proofs" and "full sovereign settlement loop."

**Canonical fact:** `0x5CFE075149776f4b3cca07a27D4fd85A60BA5e3f` is the pre-existing mainnet membrane deployed in May 2026 by the **compromised wallet**. Access control on this contract is of unknown state. It is marked ORPHANED in VAULT_LEDGER. The current LNES-04 v5 contracts are:
- Base Mainnet: `0xbb14956a88BaD822Ef38e96fF337a088b41c72be` (MOCK status — DO NOT ROUTE REAL CAPITAL)
- Base Sepolia: `0x831606e0312B518737D2c497469243297cFdAe2B` (testnet, operational)

**Evidence reference:** VAULT_LEDGER.md (current-state Quick Reference table, verified 2026-07-29)

**Risk:** Users attempting to verify proofs against the listed contract are being routed to a contract deployed by a compromised wallet with unknown access-control state. The "full sovereign settlement loop" claim implies this contract is trusted infrastructure.

**Removal safer than replacement?** No — the proof page serves an important verification function. Replace the address and add disclaimer.

**Exact proposed replacement (address block):**
```
LNES-04 Membrane V5
Base Mainnet:   0xbb14956a88BaD822Ef38e96fF337a088b41c72be
Base Sepolia:   0x831606e0312B518737D2c497469243297cFdAe2B

⚠ Status Notice: Base Mainnet contract is currently in mock-only mode.
Do not route real capital. Testnet verification is fully operational.
The pre-existing contract at 0x5CFE... is retired and not part of the
current verification infrastructure.
```

**Required approver:** Operator (Seven Ezumba)
**Approval status:** [x] APPROVED (with revised status notice — do not claim "fully operational"; Mainnet MOCK-ONLY; Sepolia for test/demo; retire 0x5CFE notice included) — 2026-08-05
**Applied:** `proof.html` LNES-04 section replaced with V5 addresses + status notice

---

## CP-003 — footer.html LNES-03 "Live" (HIGH-002)

| FIELD | VALUE |
|-------|-------|
| Finding ID | HIGH-002 |
| Public URL | All pages (footer injected site-wide) |
| Source file | `footer.html` |
| Severity | HIGH |
| Stage | Stage 1 |

**Exact current text:**
```
LNES-03 · Solana Mainnet · Live
```

**Canonical fact:** Solana program `7BCPpUMBxQMPomsgTaJsQdLEfycNwPWqkQD1Cea4CcCL` had 10 consecutive failed transactions as of 2026-07-28 (VAULT_LEDGER.md). "Live" is not accurate.

**Evidence reference:** VAULT_LEDGER.md

**Risk:** Appears on every page. Every visitor sees a false "Live" status for a non-functional program.

**Removal safer than replacement?** Replacement is safer — removing LNES-03 entirely removes a real product line from public visibility. Changing the status label is the correct action.

**Exact proposed replacement:**
```
LNES-03 · Solana Mainnet · Investigating
```
(Or "Testnet" if Solana integration is testnet-only. Operator must confirm current operational state — see OPERATOR_DECISIONS_REQUIRED.md OD-006.)

**Required approver:** Operator (confirm current Solana status first)
**Approval status:** [x] APPROVED — "Investigating" (OD-006: 10 failed txs do not support "Live") — 2026-08-05
**Applied:** `footer.html` LNES-03 status updated

---

## CP-004 — footer.html LNES-05 "Live" (HIGH-003)

| FIELD | VALUE |
|-------|-------|
| Finding ID | HIGH-003 |
| Public URL | All pages (footer injected site-wide) |
| Source file | `footer.html` |
| Severity | HIGH |
| Stage | Stage 1 |

**Exact current text:**
```
LNES-05 · Ghost-Witness · Live
```

**Canonical fact:** LNES-05 (Ghost-Witness) does not appear in the canonical claim ledger, the white paper LNES summary table, or any evidence file. No deployment evidence was found in this audit. Status is UNVERIFIED.

**Evidence reference:** Absence from canonical claim ledger and AI_MEMORY_CONTROL_PLANE.md LNES table.

**Risk:** Same as HIGH-002 — site-wide false Live claim.

**Removal safer than replacement?** If no deployment evidence can be provided: remove. If deployment can be verified and added to the canonical claim ledger: change to "Staged" or "Deployed."

**Exact proposed replacement (if not verifiable):**
```
[Remove from footer until deployment is verified and added to canonical claim ledger]
```
**Exact proposed replacement (if verifiable):**
```
LNES-05 · Ghost-Witness · Staged
```

**Required approver:** Operator (confirm deployment status — see OD-005)
**Approval status:** [x] APPROVED — Remove entirely; do not replace with Staged (OD-005: no implementation evidence or claim-ledger entry) — 2026-08-05
**Applied:** `footer.html` LNES-05 status row and chain badge removed

---

## CP-005 — broken link edge-witness.html (LOW-001)

| FIELD | VALUE |
|-------|-------|
| Finding ID | LOW-001 |
| Public URL | index.html |
| Source file | `index.html` |
| Severity | LOW |
| Stage | Stage 1 |

**Note:** Footer already had correct `lnes06.html` link. Broken link was in `index.html` line 184.
**Exact current text:** `href="edge-witness.html"` on index.html
**Canonical fact:** File is `lnes06.html`
**Exact proposed replacement:** `href="lnes06.html"`
**Required approver:** Operator
**Approval status:** [x] APPROVED — 2026-08-05
**Applied:** `index.html` broken link corrected

---

## CP-006 — ghost-witness.html entity copyright (MEDIUM-001 / SEX-003)

| FIELD | VALUE |
|-------|-------|
| Finding ID | MEDIUM-001, SEX-003 |
| Public URL | `https://exergynet.org/ghost-witness.html` |
| Source file | `ghost-witness.html` |
| Severity | MEDIUM |
| Stage | Stage 1 |

**Exact current text (found via grep):**
```
© 2026 Ezumba Dynasty Trust · LNES-05 · Base L2
```

**Canonical fact:** The public-facing entity is "ExergyNet." The trust structure (Ezumba Dynasty Trust → EDT INC → ExergyNet) is the operator's internal structure; the trust and holding company are intended to be shielded from direct public exposure.

**Evidence reference:** Operator instruction from prior session. Governance: entity in public copyright should be "ExergyNet."

**Risk:** Trust entity is indexed by search engines. Exposes trust structure to public discovery.

**Removal safer than replacement?** No — a copyright notice is required. Replace with correct entity.

**Exact proposed replacement:**
```
© 2026 ExergyNet Corp · LNES-05 · Base L2
```

**Required approver:** Operator
**Approval status:** [x] APPROVED — "ExergyNet Corp" per OD-007 ruling; review legal.html context separately — 2026-08-05
**Applied:** `ghost-witness.html` copyright updated. Also note: ghost-witness.html page indexing decision flagged as new finding (NF-001).

---

## CP-007 — omega-carrier.html ZK provenance language (MEDIUM-003)

| FIELD | VALUE |
|-------|-------|
| Finding ID | MEDIUM-003 |
| Public URL | `https://exergynet.org/omega-carrier.html` |
| Source file | `omega-carrier.html` |
| Severity | MEDIUM |
| Stage | Stage 1 |

**Exact current text:**
```
vault_recall_state: Returns sealed content with ZK provenance metadata
```

**Canonical fact:** Content is addressed and sealed by SHA-256. It is not zero-knowledge proven (EVD-009).

**Exact proposed replacement:**
```
vault_recall_state: Returns sealed content with SHA-256 content-addressed provenance metadata
```

**Required approver:** Operator
**Approval status:** [x] APPROVED — "Use 'signed provenance' only when signature + public-key verification path are present" — 2026-08-05
**Applied:** `omega-carrier.html` vault_recall_state description updated

---

## CP-008 — vanguard.html performance claims (HIGH-001 / BLOCKED_BY_EVIDENCE)

| FIELD | VALUE |
|-------|-------|
| Finding ID | HIGH-001 |
| Public URL | `https://exergynet.org/vanguard.html` |
| Source file | `vanguard.html` |
| Severity | HIGH |
| Stage | Stage 2 (requires operator decision first) |

**Exact current text:**
```
5× Faster TTFT vs legacy cloud
~40ms avg TTFT
97% lower overhead vs frontier API
$0.40 per 1K tokens
Built on Proprietary Silicon Geometry
Zero-Retention Hardware Enclave
```

**Canonical fact:** None of these figures appear in EVD-001, EVD-002, or any evidence file reviewed. The H200 benchmarks in the evidence package measure xLMP vs RAG vs full-context memory architecture — not inference TTFT or API overhead.

**Evidence reference:** None — no evidence found. REMOVE_PENDING_EVIDENCE status for all five claims.

**Risk:** Specific benchmark numbers without evidence on a live fee-bearing API page. Potential consumer-facing precision claim issue.

**Removal safer than replacement?** YES for the specific numbers (5×, 40ms, 97%, $0.40) until evidence exists. "Zero-Retention Hardware Enclave" should be replaced with the actual retention policy unless a TEE is documented.

**Option A (remove — safe immediate action):**
```
Remove: 5× / ~40ms / 97% / $0.40 per 1K tokens
Replace: [Describe actual capabilities without specific unsubstantiated numbers]
Replace "Proprietary Silicon Geometry" with: [Remove or describe actual hardware stack]
Replace "Zero-Retention Hardware Enclave" with: "Stateless inference sessions — no input retention by default"
```

**Option B (provide evidence — better outcome, more work):**
Requires: TTFT methodology, baseline definition, sample size, hardware, date. Provided by operator/engineering. Evidence must be added to the evidence package and referenced on the page.

**Operator must choose Option A or Option B — see OD-001.**

**Required approver:** Operator (decision required) + Engineering (if Option B)
**Approval status:** [ ] APPROVED  [ ] REJECTED  [ ] NEEDS_REVISION

---

## CP-009 — whitepaper.html document identity (CRITICAL-003)

| FIELD | VALUE |
|-------|-------|
| Finding ID | CRITICAL-003 |
| Public URL | `https://exergynet.org/whitepaper.html` |
| Source file | `whitepaper.html` (build artifact) |
| Severity | CRITICAL |
| Stage | Stage 7 (blocked on 5 publication conditions) |

**Exact current text:** Page title "Sovereign Memory & Verifiable Compute | ExergyNet" — entirely different document from canonical paper.

**Canonical fact:** The canonical paper is `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` v1.2, titled "xLMP: The AI Memory Control Plane."

**Risk:** Every inbound link to "the ExergyNet whitepaper" delivers the wrong document with the wrong benchmarks.

**Proposed interim action (Stage 3):** Add a notice to whitepaper.html: "A new edition of this paper is in final review and will be published shortly." Do not remove the existing page, which still conveys real information — just note it is being updated.

**Final action (Stage 7):** Rebuild from canonical source after all 5 publication conditions are met. Requires operator authorization.

**Removal safer than replacement?** No — removing whitepaper.html breaks all inbound links. Rebuild is required.

**Required approver:** Operator + both co-authors
**Approval status:** [ ] APPROVED  [ ] REJECTED  [ ] NEEDS_REVISION

---

## CP-010 — Pervasive ZK-STARK / Groth16 claims across 12+ pages (CRITICAL-004)

| FIELD | VALUE |
|-------|-------|
| Finding ID | CRITICAL-004 |
| Public URL | See PROOF_CLAIM_RECONCILIATION.md for per-page URLs |
| Source files | enterprise.html, explorer.html, faq.html, docs.html, api-integration.html, nodes.html, protocol.html, roadmap.html, security.html, token.html, mcp.html, orderbook.html, lnes06.html |
| Severity | CRITICAL (aggregate) |
| Stage | Stage 2 |

**Canonical fact:** Vault ZK operations return SHA-256 receipts, not ZK proofs. AERIS WITNESS Groth16 is real but testnet-only. LNES-90 FRI verifier is development-phase, blocked on compute architecture. FFLONK is blocked on build machine resources.

**Evidence reference:** EVD-009; PROJECT_BLOCKERS.md BLK-003, BLK-004; LNES-90 FRI circuit validation records.

**Proposed standard replacement block (for Vault ZK claims):**
```html
<p class="proof-status">
  <strong>Proof status:</strong> Vault memory queries return SHA-256 content-addressed receipts.
  On-chain zero-knowledge verification is in development.
  AERIS WITNESS settlements are Groth16-sealed on Base Sepolia testnet.
</p>
```

**Per-page decisions required:** See PROOF_CLAIM_RECONCILIATION.md. Each page requires operator approval of the specific replacement text.

**Required approver:** Operator + Engineering (per page)
**Approval status:** Pending per-page decisions in PROOF_CLAIM_RECONCILIATION.md
