# Isolated Commit Plan
**Document type:** Proposed git commit groups, branch names, messages, and merge order
**Audit date:** 2026-08-05
**Constraint:** NO DEPLOYMENT — plan only; operator approval required before any commit is created or merged

Commits are grouped to ensure security remediation is never combined with marketing redesign. Each group is independently reviewable and independently revertable.

---

## Commit Group 1: Security and False Claims

**Purpose:** Fix every CRITICAL and HIGH finding that does not require a full whitepaper rebuild.
**Branch:** `fix/stage1-security-false-claims`
**Base:** `main` (current HEAD)
**Merge condition:** Operator approves all CP-00X entries in CRITICAL_PATCH_APPROVALS.md for Stage 1

**Files changed:**
- `.well-known/ai-plugin.json` — CP-001: replace Groth16/ZK claims with SHA-256 accurate description
- `openapi.yaml` — UER-009: audit and correct ZK description strings (after full read)
- `proof.html` — CP-002: replace `0x5CFE...` with current v5 addresses + mock disclaimer
- `footer.html` — CP-003, CP-004, CP-005: LNES-03 status, LNES-05 status, broken link
- `ghost-witness.html` — CP-006: copyright entity
- `omega-carrier.html` — CP-007: ZK provenance language

**Commit message:**
```
fix(security): correct false proof claims and security exposures

Resolves six CRITICAL/HIGH findings from the 2026-08-05 website claim audit:

- ai-plugin.json: replace false "Groth16 cryptographic proof" claim with
  accurate SHA-256 receipt description (CRITICAL-001, EVD-009)
- openapi.yaml: align tool descriptions with ai-plugin.json correction
- proof.html: replace orphaned 0x5CFE... (compromised-wallet contract) with
  current LNES-04 v5 addresses; add mock-status disclaimer (CRITICAL-002)
- footer.html: LNES-03 "Live"→"Investigating"; LNES-05 "Live"→"Staged";
  fix broken edge-witness.html→lnes06.html link (HIGH-002, HIGH-003)
- ghost-witness.html: copyright "Ezumba Dynasty Trust"→"ExergyNet" (MEDIUM-001)
- omega-carrier.html: "ZK provenance metadata"→"SHA-256 content-addressed
  provenance metadata" (MEDIUM-003)

Audit refs: CRITICAL-001, CRITICAL-002, HIGH-002, HIGH-003, MEDIUM-001,
MEDIUM-003; SEX-002, SEX-003, SEX-005.
Approved by: [OPERATOR_SIGNATURE]
```

**Does NOT include:** Marketing copy changes, category terminology updates, SEO changes, whitepaper rebuild.

**Post-commit verification:** See POST_PATCH_TEST_PLAN.md TEST-STAGE-1.

---

## Commit Group 2: Proof and Benchmark Corrections

**Purpose:** Fix pervasive ZK-STARK claims across 12+ pages and remove unsubstantiated Vanguard benchmarks.
**Branch:** `fix/stage2-proof-benchmark`
**Base:** `fix/stage1-security-false-claims` (must be merged first)
**Merge condition:** Full reads of 12 pages complete; operator approves per-page decisions in PROOF_CLAIM_RECONCILIATION.md; operator decides CP-008 Option A or Option B

**Files changed:**
- `enterprise.html` — apply CLASS-A, CLASS-B, or CLASS-C replacement per full read
- `explorer.html` — apply demo/live ZK label correction
- `faq.html` — apply CLASS-A/B/C per FAQ context
- `docs.html` — apply CLASS-A/B/C per developer doc context
- `api-integration.html` — verify disclosure prominence; add where missing
- `nodes.html` — apply CLASS-A/B/C per context
- `protocol.html` — apply CLASS-A/B/C per context
- `roadmap.html` — verify CLASS-C framing for LNES-90 / FFLONK
- `security.html` — apply CLASS-A/B/C per context (HIGH PRIORITY — security context)
- `token.html` — apply CLASS-A/B per context
- `mcp.html` — apply CLASS-A; confirm no ai-plugin.json repetition
- `orderbook.html` — apply CLASS-B per AERIS WITNESS context
- `lnes06.html` — apply CLASS-A/B per context (full read required for 475KB file)
- `vanguard.html` — remove or evidence: TTFT, overhead, price, silicon, enclave claims (CP-008)
- `index.html` — update Sovereign Verifier label V2→V5 testnet (CL-006)

**Commit message:**
```
fix(proof-claims): correct ZK/proof language across 12+ pages and
remove unsupported Vanguard benchmark claims

Applied three-class replacement vocabulary per PROOF_CLAIM_RECONCILIATION.md:
- CLASS-A (Vault/SHA-256): [list affected pages]
- CLASS-B (AERIS WITNESS/Groth16 testnet): [list affected pages]
- CLASS-C (roadmap/planned): [list affected pages]

vanguard.html: removed unsubstantiated "5× TTFT", "97% lower overhead",
"$0.40/1K tokens" claims (REMOVE_PENDING_EVIDENCE status per
BENCHMARK_RECONCILIATION.md). [Option A: removed / Option B: evidenced at...]

Audit refs: CRITICAL-004, HIGH-001; BENCHMARK_RECONCILIATION.md Table 3.
Approved by: [OPERATOR_SIGNATURE]
```

**Does NOT include:** New marketing copy, hero text, title tags.

**Post-commit verification:** POST_PATCH_TEST_PLAN.md TEST-STAGE-2.

---

## Commit Group 3: Category Positioning and Terminology

**Purpose:** Update copy to reflect "AI Memory Control Plane" category framing.
**Branch:** `feat/stage3-category-positioning`
**Base:** `fix/stage2-proof-benchmark`
**Merge condition:** Operator approves CATEGORY_COPY_PACKAGE.md sections A, F, G; legal entity confirmation received (UER-007)

**Files changed:**
- `index.html` — hero headline, subhead, architecture summary, developer CTA
- `vanguard.html` — align language to canonical paper vocabulary
- `omega-carrier.html` — align tool descriptions to canonical vocabulary
- `whitepaper.html` — add interim update notice (Section H of CATEGORY_COPY_PACKAGE.md)

**Commit message:**
```
feat(copy): update category positioning to "AI Memory Control Plane"

Hero copy, architecture summary, and developer CTA updated to reflect
canonical xLMP category claim from AI_MEMORY_CONTROL_PLANE.md v1.2.

Key changes:
- index.html: headline → "xLMP — The AI Memory Control Plane"
- index.html: architecture summary aligned to three-property framework
  (Integrity / Provenance / Authority)
- whitepaper.html: added interim update notice pending v1.2 publication
- Removed "Sovereign Memory and Verifiable Compute" as primary headline

No benchmark numbers changed. No ZK claims added.
Approved by: [OPERATOR_SIGNATURE]
```

**Does NOT include:** SEO metadata, title tags, JSON-LD (those are Stage 4).

**Post-commit verification:** POST_PATCH_TEST_PLAN.md TEST-STAGE-3.

---

## Commit Group 4: SEO and Metadata

**Purpose:** Update title tags, meta descriptions, OG tags, JSON-LD, sitemap.
**Branch:** `feat/stage4-seo-metadata`
**Base:** `feat/stage3-category-positioning`
**Merge condition:** Operator approves CATEGORY_COPY_PACKAGE.md sections B, C, D, E

**Files changed:**
- All major pages — `<title>` tags (CATEGORY_COPY_PACKAGE.md Table B)
- All major pages — `<meta name="description">` (Table C)
- `index.html`, `whitepaper.html` — OG tags and Twitter Card tags (Section D)
- `index.html` — JSON-LD Organization structured data (Section E)
- `sitemap.xml` — remove fragment pages; add 11 missing real pages (MEDIUM-002)

**Commit message:**
```
feat(seo): update title tags, meta descriptions, OG, JSON-LD, sitemap

Page titles and meta descriptions updated to reflect "AI Memory Control Plane"
category framing. Open Graph and Twitter Card tags added to index.html and
whitepaper.html. JSON-LD Organization schema added.

sitemap.xml: removed footer.html and header.html (template fragments);
added 11 missing public pages.

Audit ref: MEDIUM-002, SEO_METADATA_AUDIT.md.
Approved by: [OPERATOR_SIGNATURE]
```

**Post-commit verification:** POST_PATCH_TEST_PLAN.md TEST-STAGE-4.

---

## Commit Group 5: Links and Legacy Artifacts

**Purpose:** Fix broken links; confirm APKs and scaffold zip safe for public.
**Branch:** `fix/stage5-links-artifacts`
**Base:** Can be based on `main` or any prior stage — independent
**Merge condition:** Engineering reviews and approves UER-010, UER-011; operator approves UER-008

**Files changed:**
- `index.html` — broken link fixes: journal.html→journals.html, edge-witness.html→lnes06.html, agents.html removed (LOW-001)
- `developer-guide.md` — sanitize if internal content found (UER-008)
- Repo root — if APK or zip issues found: remove problematic files

**Commit message:**
```
fix(links): repair broken links and clear artifact review

index.html: fixed three broken links from audit:
  journal.html → journals.html (benchmark notes)
  edge-witness.html → lnes06.html (Edge Witness product page)
  agents.html → [removed — file does not exist in repo]

[If artifact issues found]: Removed/sanitized [file] per engineering review.
[If clean]: APKs and scaffold zip confirmed clean for public distribution.

Audit refs: LOW-001, UER-008, UER-010, UER-011.
Approved by: [OPERATOR_SIGNATURE] + Engineering
```

**Post-commit verification:** POST_PATCH_TEST_PLAN.md TEST-STAGE-5.

---

## Commit Group 6: Physical AI Introduction

**Purpose:** Add Physical AI section to public site after white paper publication conditions are met.
**Branch:** `feat/stage6-physical-ai`
**Base:** `feat/stage3-category-positioning`
**Merge condition:** ALL 5 white paper publication conditions met; legal review of FAA claims complete

**Files changed:**
- New page or whitepaper.html section — NEURO-LOCK / Atlas / Bolt with DESIGNED status labels
- `sitemap.xml` — add new page

**Commit message:**
```
feat(physical-ai): introduce Physical AI section with verified DESIGNED status

Added Physical AI section covering NEURO-LOCK, Atlas, and Bolt. All three
systems are at DESIGNED status. FAA Exemption 26214 (Docket FAA-2025-5731)
confirmed and referenced. No deployed or operational status claimed.

Required conditions verified:
- FAA docket language confirmed: [reference]
- GPS-independent positioning LNES assigned: LNES-[NUMBER]
- Co-author acceptance: Veena [date], Phone [date]
- Legal entity confirmed: ExergyNet [confirmation ref]
- LNES-22 port 3000 decision: [decision]

Approved by: [OPERATOR_SIGNATURE] + Legal
```

**Post-commit verification:** POST_PATCH_TEST_PLAN.md TEST-STAGE-6.

---

## Commit Group 7: Final White-Paper Publication

**Purpose:** Rebuild whitepaper.html from canonical source and publish.
**Branch:** `feat/stage7-whitepaper-publication`
**Base:** All prior stages merged
**Merge condition:** Second independent website claim audit passed; all gates in POST_PATCH_TEST_PLAN.md GATE-G confirmed

**Files changed:**
- `whitepaper.html` — rebuilt from `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` v1.2 using `build_whitepaper.py`
- `index.html` — remove "coming soon" placeholder if one was added in Stage 3

**Commit message:**
```
feat(whitepaper): publish xLMP AI Memory Control Plane v1.2

Rebuilt whitepaper.html from canonical source
docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md v1.2 (Internal Co-Author Review
Draft → published).

Pre-publication checklist verified:
- Zero CRITICAL findings (audit re-run: [date])
- Zero unresolved security exposures
- Zero unsupported benchmark claims
- Zero mock-proof misrepresentations
- Legal publisher identity confirmed: [entity]
- Co-author acceptance: Veena [date], Phone [date]
- Evidence links valid: EVD-001, EVD-002
- Broken-link scan: PASS
- Metadata scan: PASS
- Second independent audit: PASS ([auditor], [date])

Approved by: [OPERATOR_SIGNATURE] + Veena + Phone
```

---

## Merge Order Summary

```
fix/stage1-security-false-claims      ← Apply first; blocks release risk NOW
  └─ fix/stage2-proof-benchmark       ← Apply after Stage 1 merge + 12 page reads
       └─ feat/stage3-category        ← After Stage 2; requires copy approval
            └─ feat/stage4-seo        ← After Stage 3; requires metadata approval

fix/stage5-links-artifacts            ← Independent; can merge any time
feat/stage6-physical-ai               ← After 5 publication conditions met
feat/stage7-whitepaper-publication    ← After ALL prior stages + second audit
```

**Stages 1–2 are the release gate blockers. Stages 3–7 are the publication roadmap.**
