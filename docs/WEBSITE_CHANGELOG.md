# ExergyNet Website — Ground-Truth Development Log

This log is the persistent, chronological, source-of-truth record of actions taken against
the `exergynet-site` website (this repository). It is intended to let any future agent —
regardless of session, interface, or memory system — reconstruct what happened to this
website and why, without relying on chat history.

**Do not overwrite prior entries. Append new entries chronologically, newest at the bottom
of the file (or newest-first if a future maintainer prefers — pick one convention and keep
it; this first entry uses append-at-bottom).** Every entry must record: timestamp,
agent/session, files inspected, files modified, reason, exact strategic directive invoked,
evidence used, tests performed, deployment status, commit hash if available, unresolved
items, and rollback information where relevant.

This log is distinct from `docs/SITE_CHANGELOG.md` (a prior, narrower migration-specific log
for the Aug 24 narrative-migration work) — that log remains valid for its own scope and is
not superseded by this one. This file is the general-purpose website action log going
forward, as required by VP Sales Directive 001 §13.

---

## 2026-08-27 — Full Commercial Recon and Content Repositioning Audit (VP Sales Directive 001)

**Timestamp:** 2026-08-27 (session-local; exact time not machine-stamped by this tooling)
**Agent/session:** Claude Code session (interactive), operator Seven Ezumba / ExergyNet, plus
8 parallel general-purpose subagents spawned by that session to read and analyze the 30
public HTML pages against the governing framework below.

**Exact strategic directive invoked:**
`C:\Users\ezumb\Downloads\VP Sales Directive 001 — Full Website Commercial Recon and Content
Repositioning Audit.md` — full reconnaissance and recommendation pass from a VP-of-Sales
perspective; explicitly **no substantive rewrite, no deletion, no navigation restructuring,
no benchmark-number changes, no deployment** permitted in this pass.

**Files inspected (read-only):**
- All 30 public HTML pages served from `origin/main` (the confirmed-live production branch):
  index.html, whitepaper.html, benchmarks.html, security.html, proof.html, vanguard.html,
  omega-carrier.html, enterprise.html, docs.html, protocol.html, faq.html,
  api-integration.html, nodes.html, roadmap.html, token.html, sdk.html, explorer.html,
  explorer-solana.html, connect.html, ghost-witness.html, legal.html, legal/index.html,
  certificate_physical_presence.html, orderbook.html, voice.html, journals.html, apps.html,
  space.html, space-listen.html, developers.html, mcp.html, vmn.html, machines.html,
  call-test.html, x402-security-brief.html, lnes06.html.
- header.html, footer.html (shared templates).
- `.well-known/ai-plugin.json`, `openapi.yaml`, `sitemap.xml`, `robots.txt` (machine-readable
  surfaces).
- Prior internal audit trail: `docs/whitepaper/audit/PUBLIC_SURFACE_INVENTORY.md`,
  `docs/whitepaper/audit/CRITICAL_FINDINGS.md`, `docs/whitepaper/audit/SEO_METADATA_AUDIT.md`,
  `docs/whitepaper/audit/PROPOSED_WEBSITE_PATCHES.md` (2026-08-05, unrelated prior session).
- `EXERGYNET_PUBLIC_BENCHMARK_CLAIM_LEDGER.md`,
  `EXERGYNET_EXTERNAL_CLAIMS_AND_TS_BOUNDARY_REGISTER.md` (internal claim-safety ledgers, used
  as the evidence-classification baseline for this audit).
- `docs/SITE_MIGRATION_HANDOFF_2026-08-24.md`, `docs/SITE_MIXED_FILE_RECONCILIATION_2026-08-24.md`
  (prior, unrelated, un-pushed local migration work — read for context only, not audited as
  live content; see rollback/unresolved note below).
- Git state: local `main` branch, `origin/main` branch, and the local uncommitted working
  tree — compared to determine which state is actually deployed (see Unresolved Items).
- Live production site `https://exergynet.org` (fetched via browser) — compared byte-for-byte
  against `origin/main:index.html` to confirm which git state is authoritative.
- Live API endpoints referenced by `explorer.html`, `apps.html`, `journals.html` (fetched to
  distinguish real data from client-side fallback/placeholder behavior).

**Files modified:** None in the website's public/source surface. Two new files created (both
new, neither previously existed):
- `WEBSITE_COMMERCIAL_RECON_2026-08-27.md` (repo root) — the full audit deliverable.
- `docs/WEBSITE_CHANGELOG.md` (this file).

**Reason:** VP Sales Directive 001 required a full page-by-page commercial recon before any
repositioning edits are made, plus establishment of this persistent changelog for all future
website actions.

**Evidence used:** See "Files inspected" above. All quantitative benchmark claims were
cross-checked against `EXERGYNET_PUBLIC_BENCHMARK_CLAIM_LEDGER.md`'s VERIFIED rows rather than
re-derived. All page content was read from `origin/main` via `git show origin/main:<path>`,
confirmed as the live production source (byte-identical to a direct fetch of
`https://exergynet.org`), not from the local uncommitted working tree.

**Tests performed:**
- Live fetch of `https://exergynet.org` homepage, diffed against `origin/main:index.html`
  (exact match — confirms origin/main is the deployed source).
- Live fetch of `explorer.html`'s backing API (`explorer-api.exergynet.org/api/l0/transactions`)
  — confirmed it currently returns zero transactions, which triggers a client-side fallback to
  hardcoded fake "ZK-STARK VERIFIED" records (see Unresolved Items — this is a live defect,
  not a hypothetical one, as of the test time).
- Live fetch of `apps.html`'s backing API (`portal.exergynet.org/api/apps/public`) — confirmed
  13 real, live app listings (not a placeholder page).
- Live fetch of `journals.html`'s backing API (`portal.exergynet.org/api/blog/articles`) —
  confirmed 2 real published articles.
- Repo-wide grep sweeps for the Directive §9/§5 keyword and benchmark-term lists across all
  public HTML.
- Targeted `git show origin/main:<file>` spot-checks confirming which of the 2026-08-05
  CRITICAL/HIGH findings (`docs/whitepaper/audit/CRITICAL_FINDINGS.md`) are fixed in the
  currently-deployed site: CRITICAL-001 (ai-plugin.json Groth16 claim) — **fixed**.
  CRITICAL-002 (proof.html compromised-wallet contract) — **fixed**. HIGH-002 (footer LNES-03
  false "Live") — **fixed** (now "Investigating"). HIGH-003/MEDIUM-001 (ghost-witness.html
  trust-entity exposure) — **fixed**. MEDIUM-002 (sitemap fragments) — **fixed**. LOW-001
  (index.html broken links) — **fixed**. CRITICAL-003 (whitepaper.html wrong document) —
  **substantially addressed** (retitled "White Paper (Preview) - xLMP"). CRITICAL-004
  (pervasive ZK-STARK/Groth16 overclaims across 12+ pages) — **partially addressed**; several
  pages (docs.html, protocol.html, api-integration.html) now carry accurate inline
  disclaimers, but `mcp.html` and `enterprise.html` still contradict the corrected
  `ai-plugin.json` language for the same underlying capability (see this audit's §A/§E).
  HIGH-001 (vanguard.html unsubstantiated benchmarks) — **partially addressed**; the specific
  fabricated numbers are gone, but "Now in production" remains unverified.

**Deployment status:** No deployment performed. This is a read-only reconnaissance pass per
Directive §11. The live site (`origin/main` @ `dedc9a7`, 2026-08-27) is unchanged by this
audit.

**Commit hash:** None — no commit was made as part of this pass. The two new files above are
untracked in the local working tree as of this entry; a future commit/push decision belongs
to the operator, per the Directive's explicit "no deployment" constraint for this phase.

**Unresolved items (carried forward for the next agent/session):**
1. **`explorer.html` is live-fabricating "ZK-STARK VERIFIED" data** when its backing API
   returns zero real transactions (confirmed true at test time). This is a technical/evidence
   defect, not a content-strategy question, and per Directive §11 ("Only make an immediate
   source change if required to prevent... another clearly technical defect") a case could be
   made this qualifies for an immediate fix outside the no-edits constraint — it was
   **deliberately left unfixed in this pass** pending explicit operator authorization, since
   it touches live JS behavior rather than pure copy. Flagged as the top-priority follow-up.
2. **Local repo state is split-brain relative to `origin/main`.** Local `main` is 109 commits
   ahead (unrelated backend work) and 7 commits behind (missing real site changes, including
   today's `dedc9a7` narrative migration). The local uncommitted working tree contains a
   separate, never-shipped Aug 24 "narrative migration" (`docs/SITE_MIGRATION_HANDOFF_2026-08-24.md`)
   that appears to overlap in intent with, but was not reconciled against, the migration that
   *did* reach `origin/main` today. **Someone needs to decide whether the local uncommitted
   migration work is now redundant, still needed, or should be merged with what's live**,
   before any future session trusts the local working tree as a starting point.
3. **`docs/SITE_MIGRATION_HANDOFF_2026-08-24.md` §H's open factual questions remain open**
   (verified legal entity name; legal.html vs legal/index.html canonical URL — this audit
   found them byte-identical with legal/index.html orphaned, see §B row 22; voice.html's
   "1.24s round-trip" sourcing — this audit independently flagged the same number as
   unsupported, see §A/§E; call-test.html/space-listen.html public-vs-remove status — this
   audit recommends removing call-test.html and leaving space-listen.html as a consumer
   feature with one system-prompt wording fix).
4. All P0 findings in `WEBSITE_COMMERCIAL_RECON_2026-08-27.md` §A/§B/§E remain unfixed as of
   this entry — that report is the authoritative punch list for the next phase.

**Rollback information:** N/A — no source files were modified. To roll back this entry's
output, delete `WEBSITE_COMMERCIAL_RECON_2026-08-27.md` and this changelog entry; no other
repository state was touched.

---

## 2026-08-27 (later) — P0 Trust Integrity Remediation (VP Sales Directive 003) — in progress

**Exact strategic directive invoked:**
`C:\Users\ezumb\Downloads\deploy.txt` — VP Sales Directive 003, "P0 Trust Integrity Remediation +
Repository Reconciliation." Authorized to deploy P0 fixes only; explicitly not Directive 004
(full commercial rewrite).

**Step 1 — white-paper preservation (completed):**
- Verified commit `9cb7be47720aed9c94c566fd60e3dc78a52e33e7` (the VP Sales whitepaper evidence
  package committed under Directive 002) is reachable and is an ancestor of local `main`'s HEAD.
- Created branch `vp-sales-whitepaper-v2-2026-08-27` pointing at `9cb7be4`.
- Pushed that branch **only** to `origin` (`https://github.com/ezumba/exergynet-site.git`) as a
  non-deploying preservation ref — confirmed via `git push origin vp-sales-whitepaper-v2-2026-08-27`
  (new branch created on GitHub; not merged into `origin/main`).
- GitHub Pages deployment source: no `.github/workflows/` directory exists in this repo (no
  Actions-based Pages pipeline), and `CNAME` + `.nojekyll` are present at repo root — consistent
  with classic branch-based GitHub Pages serving directly from `main`. `gh api repos/.../pages`
  could not be queried directly in this environment (`gh` CLI present but not authenticated,
  `gh auth login` not run) so this is inferred from repo structure and from Directive 001's
  independent confirmation that `exergynet.org`'s live content is byte-identical to `origin/main`,
  not from a direct Pages-settings API read. **Not a blocker** — no evidence contradicts
  branch-based `main` deployment, but flagged as an unconfirmed-by-API item.

(Remainder of this entry — P0 fixes, verification, deployment, and repository-reconciliation
map — appended below as Directive 003 completes.)
