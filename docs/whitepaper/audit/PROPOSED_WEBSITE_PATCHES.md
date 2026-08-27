# Proposed Website Patches
**Audit:** Pre-White Paper Website Claim Audit — ExergyNet
**Audit date:** 2026-08-05
**Constraint:** READ-ONLY — these are proposed patches only, not applied changes
**Authorization required:** Operator review and explicit approval before any patch is applied

Each patch is keyed to a finding in CRITICAL_FINDINGS.md or WEBSITE_CLAIM_AUDIT.md.

---

## PATCH-001 — .well-known/ai-plugin.json (CRITICAL-001)

**File:** `.well-known/ai-plugin.json`
**Finding:** False Groth16 claim in machine-readable manifest
**Priority:** CRITICAL — fix independently of whitepaper rebuild

### Current (exact):
```json
"description_for_human": "Trustless, Zero-Knowledge verified off-chain compute for AI agents.",
"description_for_model": "Returns a Groth16 cryptographic proof of execution."
```

### Proposed replacement:
```json
"description_for_human": "Content-addressed AI memory protocol with cryptographic provenance. Vault queries return SHA-256-anchored receipts. On-chain Groth16 proof of execution is in development.",
"description_for_model": "Returns a SHA-256 content-addressed receipt of the executed memory query. This is not a Groth16 or ZK-STARK proof. A full on-chain verifiable proof circuit (LNES-90) is under development."
```

**Rationale:** Accurately describes the current SHA-256 implementation while preserving the roadmap signal for the real ZK circuit. Does not imply ZK properties that do not exist.

---

## PATCH-002 — proof.html — LNES-04 contract address (CRITICAL-002)

**File:** `proof.html`
**Finding:** Lists compromised-wallet-deployed contract as current canonical LNES-04
**Priority:** CRITICAL

### Current: `0x5CFE075149776f4b3cca07a27D4fd85A60BA5e3f`

### Proposed replacement:
```
LNES-04 Membrane v5 (Base Mainnet): 0xbb14956a88BaD822Ef38e96fF337a088b41c72be
LNES-04 Membrane v5 (Base Sepolia): 0x831606e0312B518737D2c497469243297cFdAe2B

⚠ Note: The Base Mainnet contract is currently in mock-only mode.
Do not route real capital until mainnet settlement is verified live.
```

**Additional required change:** Remove or qualify the claim "full sovereign settlement loop" until mainnet v5 is verified operational beyond mock status.

---

## PATCH-003 — footer.html — LNES-03 Live claim (HIGH-002)

**File:** `footer.html`
**Finding:** "LNES-03 · Solana Mainnet · Live" — Solana has 10 consecutive failed transactions

### Current: `LNES-03 · Solana Mainnet · Live`

### Proposed replacement:
```
LNES-03 · Solana Mainnet · Testnet
```
(Or remove entirely until Solana integration is verified operational)

---

## PATCH-004 — footer.html — LNES-05 Live claim (HIGH-003)

**File:** `footer.html`
**Finding:** "LNES-05 · Ghost-Witness · Live" — no deployment evidence in canonical ledger

### Current: `LNES-05 · Ghost-Witness · Live`

### Proposed replacement:
```
LNES-05 · Ghost-Witness · Staged
```
(Or remove until deployment is verified and added to canonical claim ledger)

---

## PATCH-005 — footer.html — broken link (LOW-001)

**File:** `footer.html`
**Finding:** Link to `edge-witness.html` broken; file is `lnes06.html`

### Current: `href="edge-witness.html"`
### Proposed: `href="lnes06.html"`

---

## PATCH-006 — ghost-witness.html — entity exposure (MEDIUM-001)

**File:** `ghost-witness.html`
**Finding:** Footer reads "© 2026 Ezumba Dynasty Trust · LNES-05 · Base L2"

### Current: `© 2026 Ezumba Dynasty Trust · LNES-05 · Base L2`
### Proposed: `© 2026 ExergyNet · LNES-05 · Base L2`

---

## PATCH-007 — omega-carrier.html — ZK provenance language (MEDIUM-003)

**File:** `omega-carrier.html`
**Finding:** "vault_recall_state: Returns sealed content with ZK provenance metadata" — overclaims ZK

### Current: `vault_recall_state: Returns sealed content with ZK provenance metadata`
### Proposed: `vault_recall_state: Returns sealed content with SHA-256 content-addressed provenance metadata`

---

## PATCH-008 — index.html — broken links (LOW-001)

**File:** `index.html`
**Finding:** Three broken links

### Changes needed:
1. `href="journal.html"` → `href="journals.html"` (benchmark notes link)
2. `href="edge-witness.html"` → `href="lnes06.html"` (Core Systems — Edge Witness)
3. `href="agents.html"` — remove or update to correct destination (file not found)

---

## PATCH-009 — index.html — Sovereign Verifier version claim (LOW)

**File:** `index.html`
**Finding:** Lists "LNES-04 Membrane V2" when current is V5

### Current: `"Sovereign Verifier · Deployed · LNES-04 Membrane V2"`
### Proposed: `"Sovereign Verifier · Deployed · LNES-04 Membrane V5 (Base Sepolia testnet)"`

---

## PATCH-010 — vanguard.html — Unsubstantiated benchmarks (HIGH-001)

**File:** `vanguard.html`
**Finding:** "5× Faster TTFT," "~40ms avg," "97% lower overhead," "$0.40/1K" — no evidence

**Option A (remove until evidenced):**
Remove all four specific benchmark claims. Replace with: "Low-latency, cost-efficient AI inference — performance specifications published in benchmark documentation."

**Option B (provide evidence):**
Add inline evidence reference to each claim (test methodology, date, baseline definition, reproducibility). This is the preferred option if the numbers are real.

**Additional:**
- "Built on Proprietary Silicon Geometry" → remove unless custom silicon is real and documented
- "Zero-Retention Hardware Enclave" → document the actual TEE hardware or replace with: "Stateless inference — no input retention by default"
- "Now in production." → retain if the API is genuinely fee-bearing and available

---

## PATCH-011 — sitemap.xml — Missing pages and template fragments (MEDIUM-002)

**File:** `sitemap.xml`
**Finding:** Missing 11 real pages; including 2 template fragments

### Remove from sitemap:
- `footer.html`
- `header.html`

### Add to sitemap (pages confirmed in repo):
- `omega-carrier.html`
- `vanguard.html`
- `lnes06.html`
- `apps.html`
- `voice.html`
- `ghost-witness.html`
- `developers.html`
- `api-integration.html`
- `enterprise.html`
- `space.html`
- `journals.html`

---

## PATCH-012 — ZK claims across 12+ pages (CRITICAL-004)

**Files:** enterprise.html, explorer.html, faq.html, docs.html, api-integration.html, nodes.html, protocol.html, roadmap.html, security.html, token.html, mcp.html, orderbook.html, lnes06.html

**Finding:** All contain ZK-STARK / Groth16 language without accurate status context.

**Proposed standard disclosure block (for pages claiming Vault ZK verification):**
```html
<div class="proof-status-note">
  <strong>Proof status:</strong> Vault memory queries return SHA-256 content-addressed receipts.
  Full on-chain zero-knowledge verification is in development (LNES-90).
  On-chain Groth16 proofs are available for AERIS WITNESS settlements on Base Sepolia testnet.
</div>
```

**Per-page action:** Each page requires a full read to determine whether the ZK claim applies to Vault operations (always add disclosure), AERIS WITNESS (add testnet qualifier), or a Roadmap item (acceptable if framed as "planned"). A page-by-page patch list requires those full reads.

---

## Patch Execution Order (Recommended)

Patches that can be applied immediately without requiring full page reads or whitepaper rebuild:

1. **PATCH-001** (ai-plugin.json) — Highest impact per word changed; machine-readable; fix first
2. **PATCH-002** (proof.html contract address) — Security critical; can be applied independently
3. **PATCH-003** (footer LNES-03 Live claim) — One-line change; site-wide impact
4. **PATCH-004** (footer LNES-05 Live claim) — One-line change; site-wide impact
5. **PATCH-005** (footer broken link) — One-line change
6. **PATCH-006** (ghost-witness entity) — One-line change
7. **PATCH-007** (omega-carrier ZK language) — One-sentence change
8. **PATCH-008** (index.html broken links) — Three-line change
9. **PATCH-009** (index.html V2→V5) — One-line change
10. **PATCH-010** (vanguard benchmarks) — Requires operator decision on Option A vs B
11. **PATCH-011** (sitemap) — Low-priority housekeeping
12. **PATCH-012** (12+ pages ZK) — Requires full page reads first; most time-intensive

Patches 1–9 can be implemented in a single focused session and do not depend on the whitepaper rebuild. They should be done before any public announcement regardless of whitepaper status.
