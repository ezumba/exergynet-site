# Security Containment Plan
**Document type:** Per-exposure classification and containment action register
**Audit date:** 2026-08-05
**Constraint:** NO DEPLOYMENT — plan only; operator approval required before any action

For each exposure: immediate public risk, active/inactive status, fix type, correction notice requirement, and whether downtime is needed.

Secret values are not reproduced in this document.

---

## SCX-001 — KEEPER_PRIVATE_KEY plaintext on Carrier EC2

**Source:** VAULT_LEDGER.md (pre-existing, not introduced by website)
**Location:** `/home/ubuntu/lnes13_keeper/.env` on Carrier EC2 (3.234.120.103)
**Source file for audit purposes:** Carrier EC2 filesystem (not in exergynet website repo)

| FIELD | STATUS |
|-------|--------|
| Immediate public risk | HIGH — plaintext key on internet-facing EC2; any compromise of EC2 user or SSH key exposes this credential |
| Item remains active? | Unknown — operator must verify whether this key is still the active signing key for lnes13_keeper |
| Fix type | CREDENTIAL ROTATION — rotate key, move to secrets manager or env injection at startup; remove from `.env` at rest |
| Public correction notice required? | No — internal infrastructure; no public disclosure needed |
| Requires deployment downtime? | No — key rotation can be hot-applied if lnes13_keeper supports env reload; otherwise brief restart of keeper service |
| Can be done without website deployment? | YES — EC2 action only |

**Containment steps (in order):**
1. Operator confirms whether the KEEPER_PRIVATE_KEY is the active signing key or has already been rotated.
2. If active: generate new key, update deployment environment, verify keeper service continues to operate, retire old key.
3. Move key storage from `.env` file at rest to a startup-injected secret (AWS Secrets Manager, SSM Parameter Store, or equivalent).
4. Update VAULT_LEDGER.md with rotation record.
5. Confirm on-chain keeper authorization if the key is tied to an on-chain role.

**OTET harness note:** EC2 file edits must go through the OTET harness (`otet_harness.py apply`). SSH/SCP writes are blocked by `agent_shell_gate.sh`. This applies to the `.env` edit if the rotation is applied via file modification.

---

## SCX-002 — Compromised-wallet contract address on proof.html

**Source:** CRITICAL_FINDINGS.md CRITICAL-002 / SECURITY_EXPOSURE_AUDIT.md SEX-002
**Location:** `proof.html` (public website)

| FIELD | STATUS |
|-------|--------|
| Immediate public risk | HIGH — users may attempt to interact with or send capital to `0x5CFE...`, a contract deployed by a compromised wallet |
| Item remains active? | Unknown — the contract is ORPHANED per VAULT_LEDGER; it may still accept transactions; access-control state is unknown |
| Fix type | CONTENT REMOVAL + CONTRACT WARNING — remove/replace the listed address; add disclaimer |
| Public correction notice required? | Consider a brief notice on proof.html: "This page has been updated to reflect the current LNES-04 v5 contract addresses." |
| Requires deployment downtime? | No — static HTML change |
| Can be done without website deployment? | YES — static file change, normal git push to Pages |

**Containment steps:**
1. Apply PATCH-002 (CRITICAL_PATCH_APPROVALS.md CP-002) after operator approval.
2. Add contract-retirement notice for `0x5CFE...`.
3. Verify the new v5 address listing is accurate against VAULT_LEDGER.md before publishing.
4. Optionally: post a brief blog or developer note acknowledging the address update (if any users have bookmarked or integrated the old address).

---

## SCX-003 — Ezumba Dynasty Trust in public copyright (ghost-witness.html)

**Source:** SECURITY_EXPOSURE_AUDIT.md SEX-003
**Location:** `ghost-witness.html` footer

| FIELD | STATUS |
|-------|--------|
| Immediate public risk | MEDIUM — trust entity is indexed and publicly searchable; exposes intended-shielded entity |
| Item remains active? | YES — page is live and crawlable |
| Fix type | CONTENT REMOVAL — replace copyright notice with "ExergyNet" |
| Public correction notice required? | No — a copyright notice change does not require external announcement |
| Requires deployment downtime? | No |
| Can be done without website deployment? | YES — one-line HTML change |

**Containment steps:**
1. Apply CP-006 after operator approval.
2. Review `legal.html` and `legal/index.html` for contextually appropriate vs. inappropriate trust entity references. Legal notices may legitimately name the operating entity — operator should confirm what is required by applicable jurisdiction.
3. Search git history for any other pages referencing the trust entity by name and assess each.

---

## SCX-004 — APK files in public GitHub repo (version history)

**Source:** SECURITY_EXPOSURE_AUDIT.md SEX-004
**Location:** Repo root — `exergynet-edge-witness-v1.5.apk` through `v1.5.4.apk`

| FIELD | STATUS |
|-------|--------|
| Immediate public risk | LOW — APKs are downloadable and decompilable; risk is proportional to embedded secrets or endpoints |
| Item remains active? | YES — all four APK versions are in public repo and git history |
| Fix type | ENGINEERING REVIEW — confirm no hardcoded keys, internal endpoint URLs, or proprietary implementation details before confirming as safe |
| Public correction notice required? | No — unless a vulnerability is found in the APKs |
| Requires deployment downtime? | No — review action; deployment (removal if needed) would require one commit |
| Can be done without website deployment? | YES for review; removal would require a commit |

**Containment steps:**
1. Engineering decompiles or strings-searches each APK for: API keys, private key patterns (`0x` hex strings of key length), internal endpoint hostnames, hardcoded passwords.
2. If clean: mark APKs as approved for public distribution in UNRESOLVED_EVIDENCE_REQUESTS.md UER-011.
3. If issues found: remove APKs from the repo (note: git history will still contain them — requires git-filter-repo or GitHub support if truly sensitive). Serve cleaned versions from a separate release host.
4. Consider migrating APK distribution to GitHub Releases or a CDN to separate app delivery from website source.

---

## SCX-005 — False Groth16 claim in ai-plugin.json (adversarial verification exposure)

**Source:** SECURITY_EXPOSURE_AUDIT.md SEX-005
**Location:** `.well-known/ai-plugin.json`

| FIELD | STATUS |
|-------|--------|
| Immediate public risk | HIGH — machine-readable; consumed by AI orchestrators as authoritative; will be discovered and published by security researchers |
| Item remains active? | YES — file is public and being consumed by AI tools right now |
| Fix type | CONTENT CORRECTION — see CP-001 |
| Public correction notice required? | Consider a brief developer-facing note: "The ai-plugin.json description has been updated to accurately describe the SHA-256 receipt implementation." |
| Requires deployment downtime? | No |
| Can be done without website deployment? | YES — one-file change |

**Containment steps:**
1. This is the highest-priority single-file fix. Apply CP-001 as first action in Stage 1.
2. Simultaneously correct openapi.yaml (UER-009) if it contains equivalent claims.
3. After correction, monitor for any developer tooling or AI agent references to the false Groth16 description that may have been cached.

---

## SCX-006 — developer-guide.md unreviewed (content unknown)

**Source:** SECURITY_EXPOSURE_AUDIT.md SEX-006
**Location:** `developer-guide.md` in repo root

| FIELD | STATUS |
|-------|--------|
| Immediate public risk | LOW (unverified — could be LOW or HIGH depending on content) |
| Item remains active? | YES — file is in public repo |
| Fix type | ENGINEERING REVIEW — full read required |
| Public correction notice required? | Depends on content found |
| Requires deployment downtime? | No for review; commit required if content must be removed |
| Can be done without website deployment? | YES |

**Containment steps:**
1. Read the full file.
2. Flag any: API key patterns, internal endpoint hostnames, credential templates, proprietary architecture not intended for public.
3. If clean: approve for public distribution (close UER-008).
4. If issues: remove sensitive sections and commit corrected version.

---

## SCX-007 — lnes03_desktop_prover_tauri_scaffold.zip unreviewed

**Source:** SECURITY_EXPOSURE_AUDIT.md SEX-007
**Location:** `lnes03_desktop_prover_tauri_scaffold.zip` in repo root

| FIELD | STATUS |
|-------|--------|
| Immediate public risk | LOW (unverified) |
| Item remains active? | YES |
| Fix type | ENGINEERING REVIEW — unzip and inspect |
| Public correction notice required? | No |
| Requires deployment downtime? | No |
| Can be done without website deployment? | YES |

**Containment steps:**
1. Unzip and review: `.env` templates, hardcoded development endpoints, internal notes, private key examples.
2. If clean: approve (close UER-010).
3. If issues: remove from repo. Note: git history — same caveat as SCX-004.

---

## SCX-008 — Vanguard "Zero-Retention Hardware Enclave" implies TEE (false security claim)

**Source:** SECURITY_EXPOSURE_AUDIT.md SEX-008
**Location:** `vanguard.html`

| FIELD | STATUS |
|-------|--------|
| Immediate public risk | MEDIUM — users making trust decisions about sensitive data processing may rely on this claim |
| Item remains active? | YES |
| Fix type | CONTENT REMOVAL or CORRECTION — remove "Hardware Enclave" if no TEE; replace with accurate retention policy |
| Public correction notice required? | If any customers have made data-processing decisions based on this claim, a correction should be communicated to them |
| Requires deployment downtime? | No |
| Can be done without website deployment? | YES |

**Containment steps:**
1. Operator confirms whether any TEE hardware (SGX, TrustZone, AMD SEV) is deployed for Vanguard.
2. If no TEE: replace with "Stateless inference sessions — no input retention by default." Remove "Hardware Enclave" language.
3. If TEE exists: document specific hardware, attestation mechanism, and configuration. Add evidence reference.
4. Review whether any enterprise customers or trial users were given this representation. If so, proactive communication may be required.

---

## SCX-009 — rpc.exergynet.org DOWN with no public disclosure

**Source:** SECURITY_EXPOSURE_AUDIT.md SEX-009
**Location:** No website page found for this

| FIELD | STATUS |
|-------|--------|
| Immediate public risk | LOW — developers relying on this RPC have no notification; potential silent failures |
| Item remains active? | Endpoint is DOWN (disk full, BLK-001, since 2026-08-01) |
| Fix type | INFRASTRUCTURE ACTION (resolve disk full) + CONTENT ADDITION (status notice) |
| Public correction notice required? | YES — a status notice or status page should inform developers of the outage |
| Requires deployment downtime? | No — adding a status notice is additive; infrastructure fix is separate |
| Can be done without website deployment? | YES for status notice; EC2 infrastructure fix via OTET harness |

**Containment steps:**
1. Investigate and resolve BLK-001 (disk full on sovereign RPC node). Update PROJECT_BLOCKERS.md when resolved.
2. Add a status notice to the website (status badge, status page, or developer-facing announcement) indicating the RPC outage and estimated resolution.
3. After resolution, update VAULT_LEDGER.md.

---

## Containment Priority Order

| PRIORITY | SCX_ID | ACTION TYPE | URGENCY |
|----------|--------|-------------|---------|
| 1 | SCX-005 | Fix ai-plugin.json (CP-001) | Immediate — being consumed now |
| 2 | SCX-002 | Fix proof.html address (CP-002) | Immediate — security/trust risk |
| 3 | SCX-001 | KEEPER_PRIVATE_KEY rotation | Immediate — infrastructure action |
| 4 | SCX-008 | Remove false TEE claim | Before vanguard.html publication |
| 5 | SCX-003 | Entity copyright correction (CP-006) | Before broad crawl/indexing |
| 6 | SCX-009 | Add RPC outage status notice | Before developer outreach |
| 7 | SCX-004 | APK engineering review | Before publication |
| 8 | SCX-006 | developer-guide.md review | Before publication |
| 9 | SCX-007 | Scaffold zip review | Before publication |

**Actions 1–2 can be applied as a single website commit (Stage 1).
Action 3 (SCX-001) is an EC2/infrastructure action, independent of website deploy.**
