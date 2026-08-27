# Security Exposure Audit
**Audit:** Pre-White Paper Website Claim Audit — ExergyNet
**Audit date:** 2026-08-05
**Scope:** Publicly accessible files and pages in exergynet GitHub Pages repo
**Constraint:** READ-ONLY

---

## 1. Exposed Internal Information

### SEX-001 — KEEPER_PRIVATE_KEY on Carrier EC2 (not in website, but context-relevant)

**Location:** Not in the public website repo — in `/home/ubuntu/lnes13_keeper/.env` on Carrier EC2 (3.234.120.103)
**Severity:** CRITICAL (pre-existing, not introduced by website)
**Status:** Already documented in VAULT_LEDGER.md as a known exposure
**Action required:** Key rotation. This is a VAULT_LEDGER issue, not a website issue. Included here for completeness because VAULT_LEDGER says "KEEPER_PRIVATE_KEY in plaintext on Carrier EC2 at `/home/ubuntu/lnes13_keeper/.env`."

---

### SEX-002 — Compromised wallet contract `0x5CFE...` publicly listed as canonical

**Location:** `proof.html`
**Severity:** HIGH
**Finding:** The public proof page directs users to interact with `0x5CFE075149776f4b3cca07a27D4fd85A60BA5e3f`, a contract deployed by the compromised wallet. Access control on this contract is unknown. Directing public users to this address is a trust-chain security issue.
**Action required:** See CRITICAL-002 in CRITICAL_FINDINGS.md — replace contract address and add appropriate disclaimers.

---

### SEX-003 — "Ezumba Dynasty Trust" in public page copyright

**Location:** `ghost-witness.html` footer
**Severity:** MEDIUM
**Finding:** The footer reads: `© 2026 Ezumba Dynasty Trust · LNES-05 · Base L2`. The trust entity is visible to web crawlers and search indexers. Per operator intent, the trust and its holding structure should be shielded from public exposure.
**Action required:** Replace with `© 2026 ExergyNet`. Review `legal.html` and `legal/index.html` for contextual appropriateness.

---

### SEX-004 — APK files in public GitHub repo (version history visible)

**Location:** repo root — `exergynet-edge-witness-v1.5.apk`, `v1.5.1.apk`, `v1.5.2.apk`, `v1.5.4.apk`
**Severity:** LOW
**Finding:** APK files are committed directly to the website repository. This means:
1. All versions are permanently in git history
2. APKs can be downloaded, decompiled, and analyzed for hardcoded strings, endpoint URLs, and signing key metadata
3. Version history reveals the release cadence
**Action required:** Assess APKs for hardcoded credentials or internal endpoint strings before publication. Consider serving APKs from a separate release host rather than in the git repo.

---

### SEX-005 — Groth16 false claim invites adversarial proof verification

**Location:** `.well-known/ai-plugin.json`, 12+ pages claiming ZK-STARK
**Severity:** HIGH (secondary)
**Finding:** Beyond being a false product claim, the "Groth16 cryptographic proof of execution" language in ai-plugin.json creates an expectation of verifiable proofs. A security researcher or adversarial reviewer who attempts to verify the claimed Groth16 receipt will find it is a SHA-256 hash — and can publish this discrepancy. This is a reputational/security surface.
**Action required:** See CRITICAL-001 and CRITICAL-004 — correct the claims before publication.

---

### SEX-006 — developer-guide.md in public repo (content unreviewed)

**Location:** `developer-guide.md` in repo root
**Severity:** LOW (unverified)
**Finding:** A developer guide is committed to the public repository. The content has not been reviewed in this audit. Developer guides sometimes contain internal endpoint documentation, API key patterns, or environment variable references that are not appropriate for public exposure.
**Action required:** Full read of `developer-guide.md` before publication. Flag any internal endpoint, credential format, or key variable references.

---

### SEX-007 — lnes03_desktop_prover_tauri_scaffold.zip in public repo

**Location:** `lnes03_desktop_prover_tauri_scaffold.zip` in repo root
**Severity:** LOW
**Finding:** A zip archive of a scaffold project is in the public repo. The content has not been reviewed. Scaffold archives may contain `.env` templates, hardcoded development endpoints, or internal documentation.
**Action required:** Unzip and review for internal content before confirming it is safe to serve publicly.

---

### SEX-008 — Vanguard "Zero-Retention Hardware Enclave" implies TEE

**Location:** `vanguard.html`
**Severity:** MEDIUM
**Finding:** Claiming a "Zero-Retention Hardware Enclave" implies SGX, TrustZone, or similar TEE hardware. If users make trust decisions (particularly for sensitive data) based on this claim and no TEE exists, this is a security representation failure.
**Action required:** Either document the actual TEE hardware and its configuration, or remove the "Hardware Enclave" language and replace with accurate description of the retention/privacy properties that are actually implemented.

---

### SEX-009 — rpc.exergynet.org DOWN — no public disclosure

**Location:** Website (no relevant page found)
**Severity:** LOW
**Finding:** Per VAULT_LEDGER.md: `rpc.exergynet.org` has been DOWN since 2026-08-01 (disk full, BLK-001). No public status page, status badge, or disclosure was found on the website. Users or developers relying on this RPC endpoint have no notification.
**Action required:** Add a status notice or status page. Update the VAULT_LEDGER and PROJECT_BLOCKERS (already done — BLK-001). Consider a status.exergynet.org subdomain for operational transparency.

---

## 2. Summary

| SEX_ID | LOCATION | SEVERITY | TYPE | ACTION |
|--------|----------|----------|------|--------|
| SEX-001 | Carrier EC2 `.env` | CRITICAL | Exposed key (pre-existing) | Rotate key — VAULT_LEDGER action |
| SEX-002 | proof.html | HIGH | Compromised-wallet address | Fix address — see CRITICAL-002 |
| SEX-003 | ghost-witness.html | MEDIUM | Trust entity exposure | Replace with ExergyNet |
| SEX-004 | APK files in repo | LOW | Binary exposure | Review APKs before publish |
| SEX-005 | ai-plugin.json, 12+ pages | HIGH | False proof claims invite attack | Fix claims — see CRITICAL-001/004 |
| SEX-006 | developer-guide.md | LOW | Unreviewed public doc | Full read required |
| SEX-007 | scaffold zip | LOW | Unreviewed archive | Review before publish |
| SEX-008 | vanguard.html | MEDIUM | False TEE implication | Remove or evidence |
| SEX-009 | Website | LOW | No RPC outage disclosure | Add status notice |
