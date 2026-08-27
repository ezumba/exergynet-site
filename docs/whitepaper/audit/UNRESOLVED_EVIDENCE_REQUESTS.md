# Unresolved Evidence Requests
**Audit:** Pre-White Paper Website Claim Audit — ExergyNet
**Audit date:** 2026-08-05
**Constraint:** READ-ONLY — items below are open questions, not assertions

Each item is a claim on the public website (or a gap in evidence) that requires operator, author, legal, engineering, or FAA confirmation before the claim can be retained, corrected, or removed. Items are grouped by who must provide the resolution.

---

## A. Operator / Founder Confirmation Required

### UER-001 — Vanguard TTFT and overhead benchmarks
**Claim site:** vanguard.html — "5× Faster TTFT vs legacy cloud," "~40ms avg TTFT," "97% lower overhead vs frontier API"
**Evidence needed:** Test methodology, date of measurement, baseline definition (what is "legacy cloud"? what is "frontier API"?), hardware environment, number of samples, reproducibility documentation.
**If evidence doesn't exist:** Remove specific numbers per PATCH-010 Option A.
**Required before:** vanguard.html publication (HIGH-001)

### UER-002 — Vanguard per-token pricing
**Claim site:** vanguard.html — "$0.40 per 1K tokens"
**Evidence needed:** Confirm this is the current billing rate actually charged to API customers, or remove.
**If the API is not yet fee-bearing:** Remove the pricing claim.
**Required before:** vanguard.html publication (HIGH-001)

### UER-003 — Vanguard "Proprietary Silicon Geometry"
**Claim site:** vanguard.html — "Built on Proprietary Silicon Geometry"
**Evidence needed:** What does this mean? If it refers to a real hardware feature (custom ASIC, custom kernel geometry, specific NPU configuration), it needs documentation. If it is marketing language with no specific referent, it should be removed.
**Required before:** vanguard.html publication (HIGH-001)

### UER-004 — Vanguard "Zero-Retention Hardware Enclave"
**Claim site:** vanguard.html — "Zero-Retention Hardware Enclave"
**Evidence needed:** Specific TEE hardware (SGX enclave, TrustZone, AMD SEV), attestation mechanism, configuration. If no TEE hardware: remove and replace with accurate data-retention policy description.
**Required before:** vanguard.html publication (HIGH-001)

### UER-005 — LNES-05 (Ghost-Witness) deployment status
**Claim site:** footer.html — "LNES-05 · Ghost-Witness · Live"
**Evidence needed:** On-chain address, transaction hash, or test confirming deployment. Add to canonical claim ledger.
**If not deployed:** Change "Live" to "Staged" or remove per PATCH-004.
**Required before:** footer.html fix can be finalized (HIGH-003)

### UER-006 — LNES-03 (Solana) operational status
**Claim site:** footer.html — "LNES-03 · Solana Mainnet · Live"
**Evidence needed:** Current operational status of Solana program `7BCPpUMBxQMPomsgTaJsQdLEfycNwPWqkQD1Cea4CcCL`. VAULT_LEDGER shows 10 consecutive failed txs as of 2026-07-28. Has this been investigated and resolved?
**Required before:** footer.html fix (HIGH-002). PATCH-003 changes it to "Testnet" even if operational status improves — operator should confirm correct label.

### UER-007 — Legal entity name for public use
**Question:** Is "ExergyNet" the correct public-facing entity name? The operator's note from the prior session stated: "EDT 100% owns EDT INC as its holding company and has assigned Exergynet Technology to Exergynet Corp." and wanted to use "Exergynet Corp" for simplicity.
**However:** The canonical white paper v1.2 uses "ExergyNet" throughout (not "ExergyNet Corp") until a legal entity confirmation is obtained. The white paper's publication condition #2 requires this confirmation.
**Required before:** Final whitepaper.html rebuild; also relevant to copyright notices across all pages.

### UER-008 — developer-guide.md content review
**Location:** `developer-guide.md` in public repo root
**Evidence needed:** Full read and operator confirmation that no internal endpoints, credential formats, or proprietary implementation details are inappropriately disclosed.
**Required before:** Publication (LOW — security review)

---

## B. Engineering / Architecture Confirmation Required

### UER-009 — openapi.yaml description strings
**Location:** `openapi.yaml` (not read in this audit)
**Evidence needed:** Full read of all `description` fields in openapi.yaml. Confirm whether Groth16/ZK language appears, and whether it matches CRITICAL-001 fix scope.
**Required before:** ai-plugin.json fix (Commit Group 1) should also cover openapi.yaml

### UER-010 — lnes03_desktop_prover_tauri_scaffold.zip content review
**Location:** Repo root
**Evidence needed:** Engineering confirms no internal endpoints, development credentials, or proprietary architecture are exposed in the zip.
**Required before:** Publication

### UER-011 — APK files: hardcoded strings review
**Location:** exergynet-edge-witness-v1.5.apk through v1.5.4.apk (4 files)
**Evidence needed:** Engineering confirms no hardcoded API keys, internal endpoints, or development credentials exist in the APK binaries.
**Required before:** Publication (security review per SEX-004)

### UER-012 — LNES-90 FRI verifier 100-query path
**Claim site:** ZK-STARK claims on 12+ pages imply production-ready ZK verification
**Evidence needed:** Engineering confirms current blocked status (BLK-003: N=100 extrapolates to ~470GB RAM; BLK-004: FFLONK needs ≥64GB build machine). No public page should claim ZK-STARK as live until either block is resolved.
**Required before:** PATCH-012 finalization (CRITICAL-004)

### UER-013 — api-integration.html ZK disclosure scope
**Location:** api-integration.html line 936
**Current:** The page contains an accurate disclosure: "Vault ZK Query currently returns a SHA-256 receipt in place of a full RISC Zero proof while that circuit is finished."
**Evidence needed:** Full page read to confirm the disclosure is prominently positioned relative to the ZK claims on the same page, and that no other ZK claims on the page are left uncovered by the disclosure.
**Required before:** PATCH-012 per-page assessment

---

## C. White Paper Publication Conditions (Operator + Co-Author)

### UER-014 — Veena co-author acceptance
**Condition:** Veena must accept co-authorship under the 4-condition framework in the canonical paper.
**Required before:** White paper publication (GATE-C)

### UER-015 — Phone co-author acceptance
**Condition:** Phone must accept co-authorship under the 4-condition framework.
**Required before:** White paper publication (GATE-C)

### UER-016 — FAA docket FAA-2025-5731 exact NEURO-LOCK language
**Condition:** Retrieve and confirm exact language from FAA docket that supports NEURO-LOCK claims in the Physical AI section.
**Required before:** White paper Physical AI section can be published (GATE-C + FAA_NEUROLOCK_WEB_AUDIT.md)

### UER-017 — GPS-independent positioning LNES number assignment
**Condition:** Assign a LNES number to the GPS-independent positioning capability. LNES-11 is occupied (bilateral consensus). "[LNES TBD]" in the canonical paper is a placeholder.
**Required before:** White paper publication (GATE-C)

### UER-018 — LNES-22 port 3000 tunnel decision
**Condition:** Decide and document the status of LNES-22 reverse tunnel (port 3000 currently BROKEN). Either repair it (changes LNES-22 BROKEN component to DEPLOYED) or document it as deliberately removed.
**Required before:** White paper publication (GATE-C)

---

## D. Veena Technical Confirmation Required

### UER-019 — Veena QPS 10–45 intermediate saturation data
**Claim site:** Canonical paper references QPS ladder analysis. Per white paper note, intermediate QPS data between 10 and 45 is pending from Veena.
**Evidence needed:** QPS data for intermediate steps in saturation testing, or confirmation that the existing EVD-002 data set is complete.
**Required before:** White paper Evidence Appendix is complete (GATE-C)

---

## E. Legal Review Required

### UER-020 — ghost-witness.html and legal.html "Ezumba Dynasty Trust" context
**Claim site:** ghost-witness.html footer (public copyright), legal.html and legal/index.html (legal notices)
**Evidence needed:** Legal review of whether trust entity disclosure in legal.html / legal/index.html is appropriate (general legal notices often require disclosing the operating entity). May be appropriate in legal context even if not in page footers.
**Required before:** Publication (MEDIUM-001 partial)

### UER-021 — Pricing claim compliance
**Claim site:** vanguard.html "$0.40 per 1K tokens"
**Evidence needed:** Confirm the public pricing claim complies with applicable consumer-facing pricing disclosure requirements and matches actual billing.
**Required before:** vanguard.html publication (UER-002 parent)

---

## Evidence Request Summary

| UER_ID | CLAIM / GAP | OWNER | URGENCY |
|--------|-------------|-------|---------|
| UER-001 | Vanguard TTFT/overhead benchmarks | Operator | HIGH |
| UER-002 | Vanguard per-token pricing | Operator | HIGH |
| UER-003 | "Proprietary Silicon Geometry" | Operator | HIGH |
| UER-004 | "Hardware Enclave" TEE detail | Operator | HIGH |
| UER-005 | LNES-05 Ghost-Witness deployment | Operator | HIGH |
| UER-006 | LNES-03 Solana operational status | Operator | HIGH |
| UER-007 | Legal entity name confirmation | Operator + Legal | MEDIUM (publication gate) |
| UER-008 | developer-guide.md content | Operator | MEDIUM |
| UER-009 | openapi.yaml ZK descriptions | Engineering | CRITICAL |
| UER-010 | Tauri zip content | Engineering | LOW |
| UER-011 | APK hardcoded strings | Engineering | MEDIUM |
| UER-012 | LNES-90 blocked status (per public claims) | Engineering | HIGH |
| UER-013 | api-integration.html disclosure scope | Engineering | MEDIUM |
| UER-014 | Veena co-author acceptance | Veena + Operator | Publication gate |
| UER-015 | Phone co-author acceptance | Phone + Operator | Publication gate |
| UER-016 | FAA docket NEURO-LOCK language | Operator + FAA | Publication gate |
| UER-017 | GPS positioning LNES number | Operator | Publication gate |
| UER-018 | LNES-22 port 3000 tunnel decision | Operator + Engineering | Publication gate |
| UER-019 | Veena QPS intermediate data | Veena | Publication gate |
| UER-020 | Trust entity in legal pages | Legal | MEDIUM |
| UER-021 | Pricing disclosure compliance | Legal | MEDIUM |
