# Critical Findings
**Audit:** Pre-White Paper Website Claim Audit — ExergyNet
**Audit date:** 2026-08-05
**Scope:** exergynet.org public surfaces, machine-readable manifests
**Constraint:** READ-ONLY — no modifications made to any source file

CRITICAL = Must be fixed before any public release.
HIGH = Must be fixed before formal publication; actively misleading now.
MEDIUM = Fix before broad press/media distribution.
LOW = Housekeeping; fix before launch but not release-blocking.

---

## CRITICAL-001 — ai-plugin.json falsely claims Groth16 proof execution

**File:** `.well-known/ai-plugin.json`
**Severity:** CRITICAL
**Category:** Cryptographic integrity / machine-readable overclaim

**Exact text on site:**
```json
"description_for_model": "Returns a Groth16 cryptographic proof of execution."
"description_for_human": "Trustless, Zero-Knowledge verified off-chain compute for AI agents."
```

**Canonical fact (EVD-009, confirmed in ai-plugin.json audit, corroborated by api-integration.html line 936):**
The `vault_zk_query` endpoint returns a SHA-256 content hash labeled as a receipt, not a Groth16 proof. `api-integration.html` itself contains the disclaimer: *"Vault ZK Query currently returns a SHA-256 receipt in place of a full RISC Zero proof while that circuit is finished."*

**Why CRITICAL:**
`.well-known/ai-plugin.json` is a machine-readable manifest consumed by ChatGPT, Claude, and other AI orchestrators as authoritative fact. Any agent calling the ExergyNet MCP tool is being told it received a Groth16 proof when it received a SHA-256 hash. This is a false technical claim at the agent-to-agent trust layer — the most consequential category of overclaim for an AI infrastructure product.

**Required fix:**
Replace `description_for_model` with accurate language describing SHA-256 content-addressed receipts. Remove "Zero-Knowledge verified" from `description_for_human`. Add an honest disclosure of the real ZK proof roadmap. Do NOT call it Groth16 until LNES-90 or LNES-13 delivers a verified on-chain proof.

---

## CRITICAL-002 — proof.html lists compromised-wallet contract as current LNES-04

**File:** `proof.html`
**Severity:** CRITICAL
**Category:** Contract address integrity / security

**Exact text on site (verbatim from page):**
The page lists the LNES-04 on-chain verifier contract as `0x5CFE075149776f4b3cca07a27D4fd85A60BA5e3f` (verified from VAULT_LEDGER.md research).

**Canonical fact (VAULT_LEDGER.md, verified):**
- `0x5CFE075149776f4b3cca07a27D4fd85A60BA5e3f` = pre-existing mainnet membrane deployed in May 2026 by the **compromised wallet** — access-control unknown, VAULT_LEDGER status: ORPHANED
- Current LNES-04 Membrane v5 (Base Mainnet) = `0xbb14956a88BaD822Ef38e96fF337a088b41c72be`
- Current LNES-04 Membrane v5 (Base Sepolia) = `0x831606e0312B518737D2c497469243297cFdAe2B`

**Why CRITICAL:**
The page claims "immutable, independently verifiable proofs" and "full sovereign settlement loop." Users who attempt to verify proofs against `0x5CFE...` are being routed to a contract deployed by a compromised wallet of unknown access-control state. This is a live security and trust exposure.

**Required fix:**
Replace contract address with `0xbb14956a88BaD822Ef38e96fF337a088b41c72be` (Base Mainnet v5) and add the SovereignVerifier disclaimer: "**MOCK — DO NOT ROUTE REAL CAPITAL. Verifier deployed on Base Sepolia testnet only.**" Note also: the mock status itself must be disclosed (per VAULT_LEDGER.md: "SovereignVerifier + LNES04MembraneV2: MOCK — DO NOT ROUTE REAL CAPITAL").

---

## CRITICAL-003 — whitepaper.html is a different, outdated document

**File:** `whitepaper.html`
**Severity:** CRITICAL
**Category:** Document version / category positioning

**Finding:**
`whitepaper.html` (the page linked from nav, sitemap, and dozens of other pages as *the* ExergyNet whitepaper) is titled **"Sovereign Memory & Verifiable Compute"** and covers a substantially different architecture scope from the canonical paper.

The canonical paper is `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` (v1.2, Internal Co-Author Review Draft), titled **"xLMP: The AI Memory Control Plane."**

**Specific divergences between the published page and canonical paper:**
- Published page has NO mention of: xLMP as an AI Memory Control Plane category, the three-property framework (Integrity/Provenance/Authority), LNES-22, NEURO-LOCK, Bolt/FAA, Physical AI, Atlas, VMN as an open-source implementation
- Published page benchmark: "96.0% xLMP accuracy versus 82.6% for tested sparse top-k RAG" — this number is NOT in EVD-001/EVD-002 as documented in the canonical paper's Appendix E
- Published page's status table lacks all Physical AI subsystems
- Published page covers content from an earlier architectural frame that may conflict with current positioning

**Why CRITICAL:**
Every inbound link to "the ExergyNet whitepaper" sends readers to a document that does not represent the current system architecture, does not contain the real benchmark evidence, and does not stake the category claim that is the entire strategic purpose of the v1.2 paper.

**Required fix:**
This is a release gate decision: the canonical `AI_MEMORY_CONTROL_PLANE.md` must pass all 5 publication conditions before rebuilding `whitepaper.html`. Publishing now with the old HTML is a category positioning failure. Publishing with incorrect benchmark numbers is a precision/credibility risk.

---

## CRITICAL-004 — Pervasive false "ZK-STARK" and "Groth16" claims across 12+ pages

**Files (confirmed via grep):** `enterprise.html`, `explorer.html`, `faq.html`, `docs.html`, `api-integration.html`, `nodes.html`, `protocol.html`, `roadmap.html`, `security.html`, `token.html`, `mcp.html`, `orderbook.html`, `lnes06.html`

**Severity:** CRITICAL (aggregate)
**Category:** Cryptographic integrity / systemic overclaim

**Canonical fact:**
- AERIS WITNESS (LNES-04 v5 on Base Sepolia): Groth16-sealed — DEPLOYED TESTNET ONLY. Mainnet = MOCK.
- Vault ZK Query: SHA-256 receipt labeled as Groth16/STARK — NOT real ZK (EVD-009)
- LNES-90 FRI verifier: one-query circuit VALIDATED; 100-query monolithic circuit BLOCKED (BLK-003, BLK-004); no on-chain deployment
- FFLONK: build-machine BLOCKED (BLK-004, needs ≥64GB RAM)

`api-integration.html` is the one page with an accurate in-line disclosure:
> *"Vault ZK Query currently returns a SHA-256 receipt in place of a full RISC Zero proof while that circuit is finished."*

Every other page that references ZK-STARK or Groth16 proofs in the context of the Vault tool does so without this disclosure.

**Why CRITICAL:**
Falsely implying trustless ZK verification across 12+ pages is a systematic misrepresentation that touches every major marketing, developer-facing, and technical page. For an AI memory control plane product where proof integrity is a core value proposition, overstating ZK status is the highest-impact claim category.

**Required fix:**
Audit each page individually. For pages claiming ZK execution of Vault operations: replace with accurate language referencing SHA-256 content-addressed receipts and a roadmap to full ZK. For pages claiming AERIS WITNESS Groth16: add testnet-only and mock disclaimer. Do NOT simplify to just "remove all ZK language" — AERIS WITNESS testnet Groth16 is genuine.

---

## HIGH-001 — vanguard.html unsubstantiated performance claims

**File:** `vanguard.html`
**Severity:** HIGH
**Category:** Benchmark integrity

**Exact text on site:**
- "5× Faster TTFT vs legacy cloud"
- "~40ms avg TTFT"
- "97% lower overhead vs frontier API"
- "$0.40 per 1K tokens" vs competitors
- "Built on Proprietary Silicon Geometry" (implies custom silicon)
- "Zero-Retention Hardware Enclave" (implies SGX/TEE)
- "Now in production."
- "97% lower overhead vs frontier API"

**Canonical fact:**
None of these figures appear in EVD-001, EVD-002, the canonical white paper, or any evidence file reviewed during this audit. The VAULT_LEDGER and canonical evidence are silent on TTFT, per-token pricing, silicon geometry, and hardware enclave claims.

The H200 benchmarks in EVD-001/EVD-002 are about xLMP vs RAG vs full-context, not inference TTFT.

**Why HIGH:**
These are marketing claims for a live, fee-bearing inference API with no disclosed evidence basis. "Now in production" + specific benchmark numbers without evidence = potentially deceptive commercial claims. "Proprietary Silicon Geometry" implies custom hardware that has not been mentioned in any technical record. "Zero-Retention Hardware Enclave" implies SGX/TEE — a security feature claim that affects purchasing decisions.

**Required fix:**
Either provide evidence for each claim and add an evidence reference, or remove the specific numbers and replace with accurate general-capability descriptions. "Zero-Retention Hardware Enclave" must be changed or removed unless a TEE deployment is verified and documented. "Proprietary Silicon Geometry" must be clarified or removed.

---

## HIGH-002 — footer.html "LNES-03 · Solana Mainnet · Live" is false

**File:** `footer.html`
**Severity:** HIGH
**Category:** Live product status claim

**Exact text on site:**
```
LNES-03 · Solana Mainnet · Live
```

**Canonical fact (VAULT_LEDGER.md):**
> "Solana LNES program `7BCPpUMBxQMPomsgTaJsQdLEfycNwPWqkQD1Cea4CcCL` — 10 consecutive FAILED txs as of 2026-07-28"

The footer appears on every page of the site. Claiming "Live" on a component with 10 consecutive failed transactions is not accurate.

**Why HIGH:**
Footer-level claims are seen by every visitor on every page. "Live" for a non-functional component misleads every visitor about the system's operational status. This appears on every single page.

**Required fix:**
Change to "LNES-03 · Solana Mainnet · Testnet" or "Staged" or remove the "Live" claim entirely until the Solana integration is confirmed operational. Must verify current Solana program state before any claim of "Live" is restored.

---

## HIGH-003 — "LNES-05 · Ghost-Witness · Live" unverified in any evidence record

**File:** `footer.html`
**Severity:** HIGH
**Category:** Live product status claim

**Exact text on site:**
```
LNES-05 · Ghost-Witness · Live
```

**Canonical fact:**
LNES-05 (Ghost-Witness) is NOT present in the canonical claim ledger, the white paper's LNES summary table, or any evidence file reviewed. `ghost-witness.html` exists and uses "© 2026 Ezumba Dynasty Trust" entity branding (inconsistent with canonical "ExergyNet"). No deployment evidence for LNES-05 was found in this audit.

**Why HIGH:**
Same as HIGH-002 — footer-level "Live" claim on every page for a component with no verified evidence in the audit trail.

**Required fix:**
Remove "Live" status or replace with verified status from the canonical claim ledger. Separately: the ghost-witness.html page's "© 2026 Ezumba Dynasty Trust" footer should be standardized to "ExergyNet" to avoid trust-entity exposure.

---

## MEDIUM-001 — "Ezumba Dynasty Trust" in ghost-witness.html footer (entity exposure)

**Files:** `ghost-witness.html` (footer), `legal.html`, `legal/index.html`
**Severity:** MEDIUM
**Category:** Legal entity / trust exposure

**Exact text found:**
`ghost-witness.html`: `© 2026 Ezumba Dynasty Trust · LNES-05 · Base L2`

**Canonical fact:**
Per governance: the public-facing entity should be "ExergyNet" (pending formal legal entity confirmation). The trust structure (Ezumba Dynasty Trust → EDT INC holding → ExergyNet Corp operating subsidiary) is the operator's internal structure, not a public claim. The trust and holding company are intended to be shielded from direct public exposure.

**Why MEDIUM:**
`ghost-witness.html` is publicly accessible and indexed. "Ezumba Dynasty Trust" appearing in the footer copyright line exposes the trust entity to web crawlers and search indexers — the opposite of the shielding intent.

`legal.html` and `legal/index.html` may legitimately reference the trust in a legal notice context, but this needs review.

**Required fix:**
`ghost-witness.html` footer: change to "© 2026 ExergyNet" consistent with all other pages. Review `legal.html` / `legal/index.html` — if the trust is mentioned there, confirm it is in a legally appropriate context or consult counsel.

---

## MEDIUM-002 — Sitemap includes template fragments, missing real pages

**File:** `sitemap.xml`
**Severity:** MEDIUM
**Category:** SEO / content integrity

**Finding:**
The sitemap includes `footer.html` and `header.html` (HTML template fragments, not real pages). It is missing: `omega-carrier.html`, `vanguard.html`, `lnes06.html`, `apps.html`, `voice.html`, `ghost-witness.html`, `developers.html`, `api-integration.html`, `enterprise.html`, `space.html`, `journals.html`.

**Why MEDIUM:**
Search engines will crawl and index the fragment files (wasted crawl budget, duplicate-content risk). Legitimate pages not in the sitemap receive lower search priority.

**Required fix:**
Remove `footer.html` and `header.html` from sitemap; add the 11 missing real pages. Verify all listed URLs actually resolve.

---

## MEDIUM-003 — omega-carrier.html "vault_recall_state ZK provenance metadata" misleads

**File:** `omega-carrier.html`
**Severity:** MEDIUM
**Category:** Cryptographic integrity (single page)

**Exact text on site:**
> `vault_recall_state: Returns sealed content with ZK provenance metadata`

**Canonical fact:**
Per EVD-009 and the white paper: ZK provenance on Vault operations is SHA-256 content-addressed, not a real ZK proof. The Omega Carrier Tools 1–5 are DEPLOYED and accurately described overall, but this specific tool description overclaims ZK provenance.

**Why MEDIUM:**
Not as severe as CRITICAL-001 (ai-plugin.json) because this is human-readable product copy, not a machine-readable manifest. But "ZK provenance metadata" will be read by technical evaluators as implying cryptographic zero-knowledge properties.

**Required fix:**
Change to: `vault_recall_state: Returns sealed content with SHA-256 content-addressed provenance metadata` (or equivalent accurate description).

---

## LOW-001 — Three broken links on index.html

**File:** `index.html`
**Severity:** LOW
**Category:** Content integrity / link rot

**Broken links (exact):**
- `journal.html` → should be `journals.html`
- `edge-witness.html` → should be `lnes06.html`
- `agents.html` → file not found in repository

**Required fix:**
- Fix `journal.html` → `journals.html`
- Fix `edge-witness.html` → `lnes06.html`
- Either create `agents.html` or update the link to the correct destination

---

## LOW-002 — index.html benchmark footnote inconsistency

**File:** `index.html`
**Severity:** LOW
**Category:** Benchmark precision

**Finding:**
`index.html` displays benchmark numbers including "11.3×" correct-task throughput vs full-context and "660–820" flat xLMP prompt tokens, sourced from EVD-001/EVD-002 and consistent with the canonical paper.

However, `whitepaper.html` states "96.0% xLMP accuracy versus 82.6% for tested sparse top-k RAG" — a number NOT in EVD-001/EVD-002 and inconsistent with the canonical paper's "+24.4 accuracy points over RAG at equal evidence budget."

This divergence means the two public "documents" give contradictory benchmark figures.

**Required fix:**
The inconsistency will be resolved when `whitepaper.html` is rebuilt from the canonical `AI_MEMORY_CONTROL_PLANE.md` (blocked by CRITICAL-003). No immediate action needed other than ensuring the build uses canonical numbers.

---

## Release Gate Summary

| Finding | Severity | Fix required before release? |
|---------|----------|------------------------------|
| CRITICAL-001: ai-plugin.json false Groth16 claim | CRITICAL | YES — fix now, independently of whitepaper rebuild |
| CRITICAL-002: proof.html compromised-wallet contract | CRITICAL | YES — fix now, independently of whitepaper rebuild |
| CRITICAL-003: whitepaper.html is a different document | CRITICAL | YES — rebuild whitepaper.html from canonical paper (after 5 conditions met) |
| CRITICAL-004: Pervasive false ZK-STARK claims | CRITICAL | YES — page-by-page remediation required |
| HIGH-001: vanguard.html unsubstantiated benchmarks | HIGH | YES — either provide evidence or remove numbers |
| HIGH-002: footer "LNES-03 Live" false | HIGH | YES — fix footer |
| HIGH-003: footer "LNES-05 Live" unverified | HIGH | YES — verify or remove |
| MEDIUM-001: Trust entity in ghost-witness.html | MEDIUM | Before broad distribution |
| MEDIUM-002: Sitemap integrity | MEDIUM | Before SEO campaign |
| MEDIUM-003: omega-carrier.html ZK provenance language | MEDIUM | Before broad distribution |
| LOW-001: Broken links | LOW | Before launch |
| LOW-002: Benchmark inconsistency | LOW | Resolved by CRITICAL-003 fix |

**RELEASE GATE DECISION: NOT READY**

Four CRITICAL blockers. Three HIGH blockers. Not ready for white paper publication, press release, or product launch announcement.
