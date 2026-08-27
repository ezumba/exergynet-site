# Diff Plan
**Audit:** Pre-White Paper Website Claim Audit — ExergyNet
**Audit date:** 2026-08-05
**Constraint:** READ-ONLY — this plan proposes commits only; no changes made

This plan groups the proposed patches from PROPOSED_WEBSITE_PATCHES.md into isolated, reviewable git commits. Each commit group is independent of the others so they can be applied, reviewed, and reverted individually.

All commits require operator approval before execution. Each must be committed to the exergynet repo and should NOT be force-pushed.

---

## Commit Group 1: Critical machine-readable corrections (no rebuild required)

**Branch suggestion:** `fix/critical-manifest-and-contract`

**Files:**
- `.well-known/ai-plugin.json` — PATCH-001: false Groth16 → SHA-256 accurate description
- `openapi.yaml` — (after full read) false ZK descriptions → accurate descriptions

**Commit message:**
```
fix: correct false Groth16 claim in ai-plugin.json and openapi.yaml

The vault_zk_query tool description claimed "Groth16 cryptographic proof of
execution" — this is inaccurate; the implementation returns a SHA-256
content-addressed receipt (EVD-009). Corrected both the model-facing and
human-facing descriptions to accurately reflect current implementation.
On-chain ZK proof circuit (LNES-90) is in development.

Audit ref: CRITICAL-001, PATCH-001
```

**Review gate:** Operator must confirm the replacement language before merge.

---

## Commit Group 2: Contract address correction

**Branch suggestion:** `fix/proof-contract-address`

**Files:**
- `proof.html` — PATCH-002: replace `0x5CFE...` (compromised wallet) with current v5 addresses; add mock disclaimer

**Commit message:**
```
fix: replace outdated compromised-wallet contract address on proof.html

The LNES-04 contract address was pointing to 0x5CFE... (pre-existing mainnet
membrane deployed by compromised wallet; access-control unknown). Updated to
the current v5 addresses:
  Base Mainnet: 0xbb14956a88BaD822Ef38e96fF337a088b41c72be (MOCK only)
  Base Sepolia: 0x831606e0312B518737D2c497469243297cFdAe2B

Added mock disclaimer per VAULT_LEDGER.md: "Do not route real capital."

Audit ref: CRITICAL-002, PATCH-002
```

---

## Commit Group 3: Footer status corrections (site-wide impact)

**Branch suggestion:** `fix/footer-live-status-claims`

**Files:**
- `footer.html` — PATCH-003: LNES-03 "Live" → "Testnet"
- `footer.html` — PATCH-004: LNES-05 "Live" → "Staged" (or remove)
- `footer.html` — PATCH-005: broken `edge-witness.html` → `lnes06.html`

**Commit message:**
```
fix: correct footer status claims and broken link

LNES-03 (Solana): changed "Live" to "Testnet" — Solana program has 10
consecutive failed transactions as of 2026-07-28 (VAULT_LEDGER.md).
LNES-05 (Ghost-Witness): changed "Live" to "Staged" — no deployment evidence
in canonical claim ledger.
Broken link: edge-witness.html → lnes06.html.

Audit ref: HIGH-002, HIGH-003, LOW-001, PATCH-003/004/005
```

---

## Commit Group 4: Entity and minor housekeeping

**Branch suggestion:** `fix/entity-and-links`

**Files:**
- `ghost-witness.html` — PATCH-006: "Ezumba Dynasty Trust" → "ExergyNet" in footer
- `index.html` — PATCH-008: three broken links (journal.html, edge-witness.html, agents.html)
- `index.html` — PATCH-009: "LNES-04 Membrane V2" → "LNES-04 Membrane V5 (Base Sepolia testnet)"

**Commit message:**
```
fix: entity copyright correction and index broken link repairs

ghost-witness.html: copyright updated from "Ezumba Dynasty Trust" to
"ExergyNet" per public entity governance.
index.html: fixed three broken links (journal→journals, edge-witness→lnes06,
removed agents.html which does not exist in repo).
index.html: updated Sovereign Verifier description to reflect V5 status and
testnet scope.

Audit ref: MEDIUM-001, LOW-001, PATCH-006/008/009
```

---

## Commit Group 5: Omega Carrier ZK language

**Branch suggestion:** `fix/omega-carrier-provenance-language`

**Files:**
- `omega-carrier.html` — PATCH-007: "ZK provenance metadata" → "SHA-256 content-addressed provenance metadata"

**Commit message:**
```
fix: correct vault_recall_state description on omega-carrier.html

"ZK provenance metadata" implied cryptographic zero-knowledge properties that
are not present in the current implementation. Changed to "SHA-256
content-addressed provenance metadata" per EVD-009.

Audit ref: MEDIUM-003, PATCH-007
```

---

## Commit Group 6: Vanguard benchmark decisions (operator decision required)

**Branch suggestion:** `fix/vanguard-performance-claims`

**Files:**
- `vanguard.html` — PATCH-010: either remove unsubstantiated benchmarks (Option A) or add evidence (Option B)

**Requires operator decision before this commit can be written.**

**Option A commit message:**
```
fix: remove unsubstantiated Vanguard performance benchmarks

Removed "5× faster TTFT," "~40ms avg TTFT," and "97% lower overhead" claims
pending formal evidence documentation. Replaced with general capability
descriptions. Hardware Enclave language updated to reflect actual retention
properties without implying TEE hardware. Pricing claim updated to reflect
current documented rate.

Audit ref: HIGH-001, PATCH-010 Option A
```

**Option B commit message:**
```
feat: add evidence references to Vanguard performance benchmarks

Added evidence references for TTFT, throughput, and overhead claims.
Test methodology, baseline definition, and reproducibility documented at
[evidence URL]. Hardware Enclave disclosure updated with specific TEE hardware.

Audit ref: HIGH-001, PATCH-010 Option B
```

---

## Commit Group 7: Sitemap corrections

**Branch suggestion:** `fix/sitemap`

**Files:**
- `sitemap.xml` — PATCH-011: remove template fragments; add 11 missing pages

**Commit message:**
```
fix: correct sitemap — remove template fragments, add missing pages

Removed footer.html and header.html (template fragments, not indexable pages).
Added 11 missing public pages: omega-carrier, vanguard, lnes06, apps, voice,
ghost-witness, developers, api-integration, enterprise, space, journals.

Audit ref: MEDIUM-002, PATCH-011
```

---

## Commit Group 8: ZK claims across 12+ pages (largest effort)

**Branch suggestion:** `fix/zk-claim-accuracy`

**Files:** enterprise.html, explorer.html, faq.html, docs.html, api-integration.html, nodes.html, protocol.html, roadmap.html, security.html, token.html, mcp.html, orderbook.html, lnes06.html

**This commit group requires full reads of each page before it can be executed.** Pages must be classified per WEBSITE_CLAIM_AUDIT.md category: Vault ZK claims (add SHA-256 disclosure), AERIS WITNESS (add testnet qualifier), Roadmap (acceptable if framed as planned).

**Commit message:**
```
fix: add accurate proof-status disclosure across ZK-claiming pages

Audited 12+ pages claiming ZK-STARK or Groth16 proof verification.
Applied one of three remediations per page:
 1. Vault operations: added SHA-256 content-addressed receipt disclosure
 2. AERIS WITNESS: added "Base Sepolia testnet only" qualifier
 3. Roadmap items: verified "planned" framing is present

No changes to pages where ZK language was already correctly scoped.

Audit ref: CRITICAL-004, PATCH-012
```

---

## Commit Group 9: whitepaper.html rebuild (separate gate)

**Branch suggestion:** `feat/whitepaper-v1-2-publication`

**Files:**
- `whitepaper.html` — rebuilt from `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` using `build_whitepaper.py`

**Requires all 5 publication conditions from the canonical paper to be met AND operator authorization to publish. This is NOT part of the housekeeping patch set — it is the primary release event.**

**This commit should NOT be merged until Commit Groups 1–8 are already merged.** The housekeeping patches should precede the publication, not follow it.

---

## Recommended Merge Order

```
Group 1 (ai-plugin.json)      ← fix today, independently
Group 2 (proof.html)          ← fix today, independently
Group 3 (footer)              ← fix today, independently
Group 4 (entity + links)      ← fix today, independently
Group 5 (omega-carrier)       ← fix today, independently
Group 6 (vanguard)            ← after operator decision
Group 7 (sitemap)             ← anytime (low priority)
Group 8 (ZK pages)            ← after full page reads
Group 9 (whitepaper rebuild)  ← after 5 conditions met + Groups 1-8 done
```
