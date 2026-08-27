# Post-Patch Test Plan
**Document type:** Verification tests required after each proposed commit stage
**Audit date:** 2026-08-05
**Constraint:** Tests defined here; NOT executed — execution happens after operator authorizes each stage

Each stage's tests must PASS before the next stage branch is created. The final release gate (GATE-G) must pass before any external publication announcement.

---

## TEST-STAGE-1: Security and False Claims

Tests to run after Stage 1 commit is merged to main and deployed to GitHub Pages.

### T1-001 — ai-plugin.json content verification
```
Fetch: https://exergynet.org/.well-known/ai-plugin.json
Assert: description_for_model does NOT contain "Groth16"
Assert: description_for_model does NOT contain "zero-knowledge"
Assert: description_for_model CONTAINS "SHA-256"
Assert: description_for_human does NOT contain "Zero-Knowledge verified"
Status: PASS / FAIL
```

### T1-002 — proof.html contract address verification
```
Fetch: https://exergynet.org/proof.html
Assert: page does NOT contain "0x5CFE075149776f4b3cca07a27D4fd85A60BA5e3f"
Assert: page CONTAINS "0xbb14956a88BaD822Ef38e96fF337a088b41c72be" (mainnet v5)
Assert: page CONTAINS "0x831606e0312B518737D2c497469243297cFdAe2B" (sepolia v5)
Assert: page CONTAINS "mock" or "testnet" disclaimer language
Status: PASS / FAIL
```

### T1-003 — footer status claim verification
```
Fetch: https://exergynet.org/footer.html (or any page with injected footer)
Assert: footer does NOT contain "LNES-03 · Solana Mainnet · Live"
Assert: footer does NOT contain "LNES-05 · Ghost-Witness · Live"
Assert: footer does NOT contain href="edge-witness.html"
Assert: footer CONTAINS href="lnes06.html"
Status: PASS / FAIL
```

### T1-004 — ghost-witness.html entity verification
```
Fetch: https://exergynet.org/ghost-witness.html
Assert: page does NOT contain "Ezumba Dynasty Trust" in footer/copyright context
Assert: page CONTAINS "ExergyNet" in copyright
Status: PASS / FAIL
```

### T1-005 — omega-carrier.html provenance language
```
Fetch: https://exergynet.org/omega-carrier.html
Assert: page does NOT contain "ZK provenance metadata"
Assert: page CONTAINS "SHA-256 content-addressed provenance"
Status: PASS / FAIL
```

### T1-006 — No regressions in verified content
```
Fetch: https://exergynet.org/
Assert: page CONTAINS "11.3×"
Assert: page CONTAINS "660–820"
Assert: page CONTAINS "Omega Carrier"
Assert: no navigation links are broken (spot check 5 links)
Status: PASS / FAIL
```

---

## TEST-STAGE-2: Proof and Benchmark Corrections

### T2-001 — Per-page ZK claim verification (run for each of the 12+ pages)
```
For each page in [enterprise, explorer, faq, docs, api-integration, nodes,
protocol, roadmap, security, token, mcp, orderbook, lnes06]:

Fetch: https://exergynet.org/[page].html
Assert: if Vault ZK context: page CONTAINS CLASS-A disclosure text
Assert: if AERIS WITNESS context: page CONTAINS "Base Sepolia testnet"
Assert: if roadmap context: page CONTAINS "in development" or "planned"
Assert: page does NOT claim ZK-STARK as a live Vault feature without disclosure
Status: PASS / FAIL per page
```

### T2-002 — Vanguard benchmark removal verification
```
Fetch: https://exergynet.org/vanguard.html
Assert: page does NOT contain "5× Faster TTFT" (if Option A chosen)
Assert: page does NOT contain "97% lower overhead" (if Option A chosen)
Assert: page does NOT contain "$0.40 per 1K" (if Option A chosen)
  OR (if Option B chosen):
Assert: page CONTAINS evidence reference link for each benchmark claim
Status: PASS / FAIL
```

### T2-003 — No CRITICAL findings remain
```
Manual review: re-run WEBSITE_CLAIM_AUDIT.md classification pass on all
modified pages.
Assert: zero FALSE classifications on reviewed pages
Assert: zero OVERSTATED classifications on proof/ZK claims on reviewed pages
Status: PASS / FAIL
```

---

## TEST-STAGE-3: Category Positioning

### T3-001 — Hero copy verification
```
Fetch: https://exergynet.org/
Assert: page CONTAINS "AI Memory Control Plane"
Assert: page CONTAINS "xLMP"
Assert: page does NOT use "Sovereign Memory and Verifiable Compute" as primary headline
Status: PASS / FAIL
```

### T3-002 — Vocabulary consistency
```
Fetch: https://exergynet.org/
Assert: page does NOT contain "zero-knowledge verified" in copy (approved terms only)
Assert: page does NOT contain "ZK-STARK" in marketing copy
Assert: benchmark numbers match approved wording in BENCHMARK_RECONCILIATION.md Table 4
Status: PASS / FAIL
```

### T3-003 — whitepaper.html interim notice
```
Fetch: https://exergynet.org/whitepaper.html
Assert: page CONTAINS update notice language indicating new edition is in review
Assert: existing architecture content still present (notice is additive, not replacement)
Status: PASS / FAIL
```

---

## TEST-STAGE-4: SEO and Metadata

### T4-001 — Title tag verification
```
For each page in CATEGORY_COPY_PACKAGE.md Table B:
Fetch page HTML
Assert: <title> tag matches proposed title in table
Status: PASS / FAIL per page
```

### T4-002 — Meta description verification
```
For each page in CATEGORY_COPY_PACKAGE.md Table C:
Fetch page HTML
Assert: <meta name="description"> content matches proposed description
Assert: meta description length ≤ 160 characters
Status: PASS / FAIL per page
```

### T4-003 — OG tag verification
```
Fetch: https://exergynet.org/
Assert: og:title is present and correct
Assert: og:description is present and correct
Assert: og:type is present

Use a social preview checker (e.g., metatags.io) to verify unfurl appearance.
Status: PASS / FAIL
```

### T4-004 — Sitemap verification
```
Fetch: https://exergynet.org/sitemap.xml
Assert: footer.html NOT in sitemap
Assert: header.html NOT in sitemap
Assert: omega-carrier.html IN sitemap
Assert: vanguard.html IN sitemap
Assert: lnes06.html IN sitemap
For each URL in sitemap: HTTP GET returns 200 (not 404)
Status: PASS / FAIL
```

---

## TEST-STAGE-5: Links and Artifacts

### T5-001 — Broken link scan
```
Run an automated broken-link checker against https://exergynet.org/
Tools: linkchecker, deadlinkchecker.com, or equivalent
Assert: zero 404 responses for internal links
Assert: zero internal links pointing to edge-witness.html
Assert: zero internal links pointing to agents.html
Assert: zero internal links pointing to journal.html (correct is journals.html)
Status: PASS / FAIL
```

### T5-002 — APK distribution verification (if APKs retained)
```
Engineering confirms: no hardcoded API keys in APK strings
Engineering confirms: no internal endpoints (portal.exergynet.org admin paths, etc.)
Engineering confirms: no private key patterns in APK
Status: PASS / FAIL (engineering sign-off required)
```

---

## TEST-STAGE-6: Physical AI Introduction

### T6-001 — Status label accuracy
```
Fetch: [new Physical AI page URL]
Assert: NEURO-LOCK described as DESIGNED (not deployed)
Assert: Atlas described as DESIGNED (not deployed)
Assert: Bolt described as DESIGNED (not deployed)
Assert: FAA Exemption 26214 mentioned with correct docket number FAA-2025-5731
Assert: no "live," "deployed," or "operational" language for DESIGNED systems
Status: PASS / FAIL
```

### T6-002 — Five publication conditions verified
```
Verify in writing before merge:
[ ] Veena co-authorship accepted (signed document or equivalent)
[ ] Phone co-authorship accepted
[ ] FAA docket FAA-2025-5731 language confirmed
[ ] GPS-independent positioning LNES number assigned: LNES-[NUMBER]
[ ] LNES-22 port 3000 tunnel decision documented
Status: PASS only if all 5 checked
```

---

## TEST-STAGE-7 / GATE-G: Final White-Paper Publication

This is the final release gate. ALL conditions must PASS before any external publication announcement.

### GATE-G-001 — Zero CRITICAL findings
```
Run a full website claim audit (second independent audit)
Assert: zero FALSE classifications across all pages
Assert: zero Groth16/ZK claims unsupported by evidence
Status: PASS / FAIL
```

### GATE-G-002 — Zero unresolved security exposures
```
Review SECURITY_CONTAINMENT_PLAN.md
Assert: SCX-001 (KEEPER_PRIVATE_KEY) — rotation confirmed in VAULT_LEDGER
Assert: SCX-002 (compromised contract) — resolved by Stage 1
Assert: SCX-003 (entity copyright) — resolved by Stage 1
Assert: SCX-004 (APKs) — engineering sign-off received
Assert: SCX-005 (false Groth16) — resolved by Stage 1
Assert: SCX-006 (developer-guide.md) — reviewed and cleared
Assert: SCX-007 (scaffold zip) — reviewed and cleared
Assert: SCX-008 (false TEE claim) — resolved by Stage 2 (vanguard)
Assert: SCX-009 (RPC outage notice) — notice added or BLK-001 resolved
Status: PASS only if all 9 cleared
```

### GATE-G-003 — Zero unsupported benchmark claims
```
Review BENCHMARK_RECONCILIATION.md
Assert: zero REMOVE_PENDING_EVIDENCE items remain on any public page
Assert: all public benchmark numbers match EVD-001 or EVD-002
Assert: whitepaper.html benchmark numbers match canonical paper
Status: PASS / FAIL
```

### GATE-G-004 — Zero mock-proof misrepresentations
```
Review PROOF_CLAIM_RECONCILIATION.md
Assert: all 16 pages cleared (full read + replacement applied)
Assert: ai-plugin.json replacement verified (T1-001)
Assert: no page describes Vault operations as Groth16 or ZK-STARK
Assert: all AERIS WITNESS claims include testnet qualifier
Status: PASS / FAIL
```

### GATE-G-005 — Legal publisher identity confirmed
```
Assert: operator has confirmed legal entity name (UER-007)
Assert: all page copyright notices use confirmed entity name
Assert: JSON-LD Organization schema uses confirmed entity name
Status: PASS / FAIL
```

### GATE-G-006 — Co-authorship confirmed
```
Assert: Veena acceptance documented (UER-014)
Assert: Phone acceptance documented (UER-015)
Status: PASS / FAIL
```

### GATE-G-007 — Evidence links valid
```
Assert: all EVD-00X references cited in whitepaper.html resolve or are included
Assert: Appendix E (References) entries in canonical paper are internally consistent
Assert: Appendix F (Revision Log) is complete and current
Status: PASS / FAIL
```

### GATE-G-008 — Successful broken-link scan
```
Run T5-001 against final deployed site
Assert: zero 404s for internal links
Assert: zero 404s for evidence references
Status: PASS / FAIL
```

### GATE-G-009 — Successful metadata scan
```
Run T4-001 through T4-004
Assert: all PASS
Status: PASS / FAIL
```

### GATE-G-010 — Second independent website claim audit
```
A second auditor (human or independent AI agent in a fresh session with no
prior context of this audit) must:
1. Read the published whitepaper.html
2. Read the published ai-plugin.json
3. Run the same claim classification exercise against CRITICAL-001 through HIGH-003
4. Confirm: zero CRITICAL and zero HIGH findings

Auditor: [Name or session ID]
Date: [Date]
Result: PASS / FAIL
```

### Final Gate Checklist

| GATE | TEST | STATUS |
|------|------|--------|
| G-001 | Zero CRITICAL findings | [ ] |
| G-002 | Zero security exposures | [ ] |
| G-003 | Zero unsupported benchmarks | [ ] |
| G-004 | Zero mock-proof misrepresentations | [ ] |
| G-005 | Legal identity confirmed | [ ] |
| G-006 | Co-authorship confirmed | [ ] |
| G-007 | Evidence links valid | [ ] |
| G-008 | Broken-link scan PASS | [ ] |
| G-009 | Metadata scan PASS | [ ] |
| G-010 | Second independent audit PASS | [ ] |

**RELEASE AUTHORIZED only when all 10 gates show PASS.**
