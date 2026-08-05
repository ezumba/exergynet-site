# Remediation Master Plan
**Document type:** Approval-ready remediation package
**Based on:** Pre-White Paper Website Claim Audit, 2026-08-05
**Constraint:** NO DEPLOYMENT — plan only; operator approval required before any change is applied
**Governing files:** CRITICAL_FINDINGS.md, SECURITY_EXPOSURE_AUDIT.md, WEBSITE_CLAIM_AUDIT.md

---

## Status Summary

```
Release status:     NOT_READY
Critical blockers:  4
High blockers:      3
Security exposures: 9
Unresolved UERs:   21
```

Three release blocks inherited from the audit:

| BLOCK | REASON | FILES |
|-------|--------|-------|
| BLOCKED_BY_CRITICAL_CLAIM | False ZK/Groth16, wrong contract, wrong whitepaper | ai-plugin.json, proof.html, whitepaper.html, 12+ pages |
| BLOCKED_BY_SECURITY_EXPOSURE | Compromised-wallet contract public, trust entity exposed, APKs unreviewed | proof.html, ghost-witness.html, repo root |
| BLOCKED_BY_EVIDENCE | Vanguard performance numbers have no preserved evidence; whitepaper.html benchmark inconsistent | vanguard.html, whitepaper.html |

---

## Remediation Architecture

Seven commit stages, executed in strict order. Stages 1–4 can be prepared and approved in parallel but must be applied sequentially. Stages 5–7 depend on earlier stages being applied and verified.

```
Stage 1: Security and false claims          ← No deployment risk; apply first
Stage 2: Proof and benchmark corrections    ← Requires full reads of 12+ pages
Stage 3: Category positioning and terms     ← Marketing decision; parallel prep
Stage 4: SEO and metadata                   ← After Stage 3 copy is approved
Stage 5: Links and legacy artifacts         ← Low-risk; can precede Stage 3
Stage 6: Physical AI introduction           ← Blocked by 5 publication conditions
Stage 7: Final white-paper publication      ← Blocked by Stages 1–6 + conditions
```

Each stage has a post-application verification test defined in POST_PATCH_TEST_PLAN.md.

---

## Stage 1: Security and False Claims (Highest Priority)

**Trigger condition:** Operator approves CRITICAL_PATCH_APPROVALS.md entries CP-001 through CP-007.

| PATCH | FILE | FINDING | CHANGE TYPE |
|-------|------|---------|-------------|
| P-001 | .well-known/ai-plugin.json | CRITICAL-001 | Replace false Groth16 description with SHA-256 accurate language |
| P-002 | openapi.yaml | UER-009 | Audit and correct ZK description strings (requires read first) |
| P-003 | proof.html | CRITICAL-002 / SEX-002 | Replace compromised-wallet contract address; add mock disclaimer |
| P-004 | footer.html | HIGH-002 | LNES-03 "Live" → "Investigating" (OD-006 ruling: 10 failed txs do not support "Live") |
| P-005 | footer.html | HIGH-003 | LNES-05 removed from footer entirely (OD-005 ruling: no implementation evidence) |
| P-006 | index.html | LOW | Fix broken `edge-witness.html` → `lnes06.html` link (CP-005; footer was already correct) |
| P-007 | ghost-witness.html | SEX-003 / MEDIUM-001 | Copyright "Ezumba Dynasty Trust" → "ExergyNet Corp" (OD-007 ruling) |
| P-008 | omega-carrier.html | MEDIUM-003 | "ZK provenance metadata" → "SHA-256 content-addressed provenance metadata" (CP-007) |

**One commit.** Branch: `fix/stage1-security-and-false-claims`
**Approver:** Operator (Seven Ezumba)
**Does NOT require:** Whitepaper rebuild, full reads of unread pages, evidence from Veena, co-author acceptance.

---

## Stage 2: Proof and Benchmark Corrections

**Trigger condition:** Full reads of 12+ ZK-claiming pages complete; operator approves PROOF_CLAIM_RECONCILIATION.md per-page decisions.

| PATCH | FILES | FINDING | CHANGE TYPE |
|-------|-------|---------|-------------|
| P-008 | enterprise.html, faq.html, nodes.html, security.html, token.html, mcp.html, orderbook.html, lnes06.html | CRITICAL-004 | Add SHA-256 receipt disclosure block |
| P-009 | explorer.html | CRITICAL-004 | Clarify "ZK-STARK VERIFIED" demo labels as simulated |
| P-010 | docs.html, api-integration.html | CRITICAL-004 | Verify existing disclosure is prominent; add where missing |
| P-011 | protocol.html, roadmap.html | CRITICAL-004 | Verify "planned" framing; add where ZK presented as live |
| P-012 | omega-carrier.html | MEDIUM-003 | "ZK provenance metadata" → "SHA-256 content-addressed provenance metadata" |
| P-013 | vanguard.html | HIGH-001 / BLOCKED_BY_EVIDENCE | Remove or evidence: TTFT, overhead, price, silicon, enclave claims |
| P-014 | index.html | LOW-002 | Update Sovereign Verifier label from V2 → V5 testnet |

**Two or three commits depending on page-read results.**
**Branch:** `fix/stage2-proof-and-benchmark`
**Approver:** Operator (benchmark decision); Engineering (per-page ZK scope review)

---

## Stage 3: Category Positioning and Terminology

**Trigger condition:** Operator approves CATEGORY_COPY_PACKAGE.md proposed copy.

| PATCH | FILES | CHANGE TYPE |
|-------|-------|-------------|
| P-015 | index.html | Update hero copy to "AI Memory Control Plane" category framing |
| P-016 | index.html | Update architecture summary |
| P-017 | vanguard.html, omega-carrier.html | Align subsystem descriptions to canonical paper vocabulary |
| P-018 | whitepaper.html | Placeholder: "Whitepaper publishing soon" or redirect, until Stage 7 |

**One commit.**
**Branch:** `feat/stage3-category-positioning`
**Approver:** Operator (copy decision)
**Note:** Stage 3 copy is prepared in CATEGORY_COPY_PACKAGE.md for approval. No deployment until approved.

---

## Stage 4: SEO and Metadata — APPLIED 2026-08-05

**Trigger condition:** Stage 3 copy is approved; operator authorizes metadata pass.

| PATCH | FILES | CHANGE TYPE | STATUS |
|-------|-------|-------------|--------|
| P-019 | index.html, whitepaper.html, vanguard.html, proof.html | Update `<title>` tags to "AI Memory Control Plane" framing | APPLIED |
| P-020 | index.html, whitepaper.html, vanguard.html, proof.html, omega-carrier.html | Add/update `<meta name="description">` | APPLIED |
| P-021 | index.html (OG updated + Twitter card added); whitepaper.html, vanguard.html, proof.html (OG added); omega-carrier.html (OG updated) | Add/update OG tags; Twitter card on index | APPLIED |
| P-022 | index.html (JSON-LD added in Stage 3) | JSON-LD Organization structured data | APPLIED (Stage 3) |
| P-023 | sitemap.xml | Removed /index.html duplicate, removed llms.txt and .well-known/exergynet.json non-page entries | APPLIED |
| P-024 | openapi.yaml | Verified aligned with Stage 1 corrections — no further change needed | VERIFIED |

**Commit:** `b87d31f61da9856aa74de3a4c686444d3a4a1897` on branch `feat/stage4-seo-metadata`, merged to `main`, pushed to GitHub Pages 2026-08-05 18:29:15 -0400.
**Branch:** `feat/stage4-seo-metadata`
**Approver:** Operator (authorized 2026-08-05)
**Verification:** STAGE4_VERIFICATION_RECORD.md — all 9 blocking checks passed; 2 P3 items (JSON-LD on secondary pages; canonical tags) documented and deferred.
**Status: VERIFIED — Stage 4 CLOSED.**

---

## Stage 5: Links and Legacy Artifacts

**Trigger condition:** Engineering reviews APKs and scaffold zip (UER-010, UER-011).

| PATCH | FILES | CHANGE TYPE |
|-------|-------|-------------|
| P-025 | index.html | Fix broken links: journal.html → journals.html, edge-witness.html → lnes06.html, remove agents.html |
| P-026 | Repo root | Confirm APK files safe for public distribution (or remove) |
| P-027 | Repo root | Confirm scaffold zip safe for public distribution (or remove) |
| P-028 | developer-guide.md | Review and sanitize any internal endpoints or credential references |

**One commit.**
**Branch:** `fix/stage5-links-and-artifacts`
**Approver:** Operator + Engineering

---

## Stage 6: Physical AI Introduction

**Trigger condition:** All 5 publication conditions for the canonical white paper are met:
1. Veena co-author acceptance
2. Phone co-author acceptance
3. FAA docket FAA-2025-5731 exact NEURO-LOCK language retrieved
4. GPS-independent positioning LNES number assigned
5. LNES-22 port 3000 tunnel decision made

| PATCH | FILES | CHANGE TYPE |
|-------|-------|-------------|
| P-029 | New page or section | Add Physical AI / NEURO-LOCK / Atlas / Bolt section with DESIGNED status labels |
| P-030 | sitemap.xml | Add physical-AI page |
| P-031 | FAA-NEUROLOCK_WEB_AUDIT.md | Update to CONDITION_MET status |

**One commit.**
**Branch:** `feat/stage6-physical-ai`
**Approver:** Operator + Legal

---

## Stage 7: Final White-Paper Publication

**Trigger condition:** Stages 1–6 complete; all 5 publication conditions met; operator authorizes rebuild.

| PATCH | FILES | CHANGE TYPE |
|-------|-------|-------------|
| P-032 | whitepaper.html | Rebuild from `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` using `build_whitepaper.py` |
| P-033 | sitemap.xml | Confirm whitepaper URL is indexed |
| P-034 | Various | Remove any "coming soon" placeholders added in Stage 3 |

**One commit.**
**Branch:** `feat/stage7-whitepaper-publication`
**Approver:** Operator + both co-authors
**Required:** Second independent website claim audit post-publication (per POST_PATCH_TEST_PLAN.md GATE-G)

---

## Critical Path

The absolute minimum to get from NOT_READY to a safe public state for existing pages (excluding whitepaper.html rebuild):

```
Stage 1 → Stage 2 (partial: ai-plugin.json, proof.html, footer, omega-carrier) → Stage 5 (links)
```

This covers all CRITICAL and HIGH findings without requiring the whitepaper rebuild, co-author acceptance, or the 12-page ZK deep-audit. Estimated: 2 sessions after operator approvals are received.

Full release (including whitepaper.html) requires all 7 stages and is gated on the 5 publication conditions. Estimated: 5–8 sessions after all conditions are met.

---

## Files in This Remediation Package

| FILE | PURPOSE |
|------|---------|
| REMEDIATION_MASTER_PLAN.md | This document — stage map and critical path |
| CRITICAL_PATCH_APPROVALS.md | Per-finding approval forms with exact before/after text |
| SECURITY_CONTAINMENT_PLAN.md | Per-exposure classification and containment actions |
| BENCHMARK_RECONCILIATION.md | Website vs white-paper vs evidence-package number comparison |
| PROOF_CLAIM_RECONCILIATION.md | Every ZK/proof page with exact replacement text |
| CATEGORY_COPY_PACKAGE.md | Proposed hero, titles, OG tags, JSON-LD, developer CTA |
| ISOLATED_COMMIT_PLAN.md | Commit groups with messages, branch names, merge order |
| POST_PATCH_TEST_PLAN.md | Verification tests per stage; final release gate checklist |
| OPERATOR_DECISIONS_REQUIRED.md | Decisions the operator must make before work can proceed |
