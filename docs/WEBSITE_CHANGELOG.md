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

## 2026-08-27 (later) — P0 Trust Integrity Remediation (VP Sales Directive 003)

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

**Step 3 — isolated remediation worktree:** `git fetch origin` confirmed `origin/main` unchanged
at `dedc9a7` since Directive 001. Created `vp-sales-p0-trust-2026-08-27` from `origin/main` via
`git worktree add`, in a scratch location entirely separate from the dirty local working tree —
245 tracked files, `git status` clean at creation. All P0 remediation below happened exclusively
in this worktree.

**Steps 4-13 — the ten numbered P0 fixes:** full per-issue detail (original defect, evidence
consulted, exact correction, files changed, tests performed, residual risk, Directive 004
follow-up) is recorded in `WEBSITE_P0_TRUST_REMEDIATION_2026-08-27.md` and is not duplicated here.
Summary: `explorer.html` (stopped fabricating verified evidence on zero real records),
`call-test.html` (removed from public production, preserved outside the repo), `connect.html`
(unsafe installer flow replaced with a safe holding page), `voice.html` (HIPAA language unified,
unsourced performance numbers removed, NVIDIA logo removed), `security.html`/`proof.html`/
`faq.html`/`token.html`/`protocol.html`/`nodes.html` (LNES-03 status reconciled to one canonical
sentence, verified against `VAULT_LEDGER.md`), `api-integration.html` (FDA acceptance implication
removed), `omega-carrier.html` (one comparison-table cell reconciled), `machines.html`
(sovereignty/authority overreach removed while correctly preserving the KTX/EDT relationship per
the operator's Directive 003 addendum), `vanguard.html` (unverified production claim removed,
replacement framing corrected to explicit coexistence), `enterprise.html` (five separate trust
defects corrected).

**Step 14/15 — machine-readable surfaces + repository-wide search:** checked meta/JSON-LD/OG/
Twitter/JS constants for every changed page (the `voice.html` HIPAA fix specifically required
this). Repository-wide grep for the directive's 13 named risky phrases run before and after the
ten fixes — full result table in the remediation report; one additional bare `ZK-STARK verified`
instance found and fixed in `nodes.html`'s CTA section during this sweep, beyond the ten named
issues.

**Step 17 — verification:** all 15 changed files rendered locally via a static server over the
exact committed worktree content — zero console errors across all pages. `explorer.html`'s zero-
record path was tested live against the real backend API (currently genuinely empty) and its
`?demo=1` path was tested separately. `<div>`/`</div>` counts balanced in every edited HTML file.
`git status` in the worktree showed exactly the 15 intended files before commit — no white-paper
file, no Aug 24 migration file, no backend/portal file entered the diff.

**Commit:** `874ff7178e3555e9bb9831167e6aab0d8e048fc7` on branch `vp-sales-p0-trust-2026-08-27`,
15 files changed (106 insertions, 454 deletions — net negative, consistent with removing
fabricated content rather than adding new copy).

**Step 18/19 — deployment diff gate:** diffed the remediation branch against `origin/main`;
confirmed the diff contains only the 15 P0 files plus this changelog and the remediation report
(added to the branch immediately before push, see below) — no white-paper content, no Aug 24
migration, no unrelated backend file. Re-ran `git fetch origin` immediately before push:
`origin/main` still at `dedc9a7`, unchanged — no rebase or conflict resolution was required.

**Step 20 — deployment:** pushed `vp-sales-p0-trust-2026-08-27` to `origin`, then fast-forward
merged it into `origin/main` with no force-push, no history rewrite, and no bypassed checks
(this repository has no CI gate configured to bypass). Production commit after remediation and
live-verification results are recorded in `WEBSITE_P0_TRUST_REMEDIATION_2026-08-27.md`'s
completion state and this session's final terminal report.

**Unresolved repository split (carried forward, not resolved by this pass):** local `main` is
now 110 commits ahead / 7 behind `origin/main` (after this session's own whitepaper-preservation
commit). The dirty local working tree's ~60 modified tracked files and 2,300+ untracked files,
and the never-pushed Aug 24 narrative-migration content, remain exactly as Directive 001 found
them — this pass worked exclusively in an isolated worktree built from `origin/main` and did not
touch, merge, or resolve any of that. See `WEBSITE_P0_TRUST_REMEDIATION_2026-08-27.md`'s
"Repository State After Directive 003" section for the full map.

**Stale `exergynet-release` worktree:** investigated, not cleaned up — confirmed orphaned (no
`gitdir` pointer, absent from `git worktree list`, no working directory found on disk, last
commit already an ancestor of `origin/main` so nothing unique is at risk). Recommended cleanup
(`git worktree prune`, non-aggressive form) recorded but not executed, per this directive's
explicit prohibition on force-cleaning it during this pass.

**Directive 004 dependencies:** the remediation report's per-issue "Directive 004 follow-up"
fields are the authoritative list. In summary: rebuild the compute-partner onboarding funnel
(`connect.html`), full commercial redesign of `machines.html` and `enterprise.html` (positioning
only — their P0 claim risks are now closed), consider commissioning real voice-latency/accuracy
benchmarks before `voice.html` republishes any performance number, and the site-wide "sovereign"
vocabulary purge inventoried in `WEBSITE_COMMERCIAL_RECON_2026-08-27.md` §D.1 remains entirely
open for Directive 004.

---

## 2026-08-27 — Full Commercial Website Rebuild + Canonical Machine Narrative (VP Sales Directive 004)

**Agent/session:** Claude Code session (interactive), operator Seven Ezumba / ExergyNet.

**Exact strategic directive invoked:** `C:\Users\ezumb\Downloads\VP SALES DIRECTIVE 004.txt`,
executed in an isolated worktree at branch `vp-sales-commercial-rebuild-2026-08-27`, based on
`origin/main` at `74b798068acba047dc85c9e76eb656c5bde0e02f` (the Directive 003 production
commit). This entry covers the full directive; QA and deployment steps are recorded separately
below once complete (see status note at the end of this entry if still in progress).

**New canonical reference:** `docs/PUBLIC_NARRATIVE_CANON_2026-08-27.md` — the master document
every other page in this pass derives from: the frozen four-layer hierarchy (Useful Work →
Authoritative State → Interoperability → Authority, Authority never the opening pitch or
homepage primary CTA), the loaded-term governance rules, the sovereignty-language rule (KEEP
only for customer/entity self-control, REWRITE where ExergyNet self-describes as sovereign,
RENAME internal brand names built on "sovereign," never touch API/protocol code identifiers),
the KTX/Kunfirm dual-boundary framing carried forward from Directive 003's addendum, and the
two held external claims (Anthropic MCP Registry affiliation, MCP Vouch score) with their
required non-advertisement treatment.

**Full page rewrites:** `index.html` (new hero, four-layer proof block, "Does Not Require"
compatibility box with an `id="does-not-require"` anchor added this pass for `faq.html` to link
to, Context≠Memory≠State box, fixed dead Agent Manifest link, removed an internal audit-ID leak
line), `enterprise.html`, `machines.html` (KTX dual-boundary framing preserved), `vanguard.html`,
`whitepaper.html` (rewritten as a prose-only "commercial bridge" mirroring V2's structure, with
an explicit STATUS NOTICE that no downloadable PDF is offered pending separate publication
approval), `faq.html` (restructured into Enterprise/Technical/Security/Network-Economic
sections per §17, leading with the seven specified buyer questions, crypto-native questions
moved to the bottom section), `header.html`, `footer.html` (7-column reorganization).

**New pages:** `design-partner.html` (evaluation funnel, six-step process, cost-terms chip
list), `connect.html` (rebuilt from Directive 003's minimal holding page into a full
compute/operator page per §16: GPU/cloud/research/node-operator targeting, source-visible
installation, checksums/signatures, security expectations, no guaranteed-earnings language),
`lnes06-release-notes.html` (the consumer changelog surgically extracted out of `lnes06.html`,
`noindex, follow`).

**Targeted edits (not full rewrites):** `security.html` (new "Whose Authority This Is /
Customer Sovereignty" section inserted before Verifiable Security), `benchmarks.html` (light
kicker/CTA touch), `lnes06.html` (split its consumer-changelog and enterprise-evidence
identities per §15; hero/CTA reframed toward "Request an Enterprise Pilot"), `vmn.html`
(reframed per §18: "Sovereign" tier renamed to "Verified," hero and closing CTA rewritten to
explicitly distinguish the local VMN vault from ExergyNet's model-independent state
architecture, preserving all installable-product evidence unchanged), `journals.html` (title/
meta/hero reframed away from "Sovereign Compute" toward "Verified Compute" / useful-work
framing), `ghost-witness.html` (see Trust Integrity Fixes below), `mcp.html`,
`docs.html`, `protocol.html`, `nodes.html`, `api-integration.html` (see Developer Surface
Consistency Audit below).

**Site-wide sovereignty vocabulary purge (§29, completing what Directive 003 deliberately
deferred):** grepped the full site for case-insensitive "sovereign" before starting; fixed every
instance outside the four deliberately-preserved exceptions across `space-listen.html`
(including the **live runtime LLM system prompt** — highest-priority item, previously
`"You are Vanguard, the ExergyNet sovereign AI assistant..."`), `space.html`/`space/index.html`
(also removed the factually-false "no middleman" claim), `api-integration.html`, `docs.html`,
`explorer-solana.html`, `explorer.html`, `legal.html`/`legal/index.html` (self-description
"sovereign mathematical physics engine" rewritten; "ARTICLE V. REGULATORY SOVEREIGNTY..."
retitled to "ASSET CLASSIFICATION AND REGULATORY POSTURE"), `nodes.html`, `omega-carrier.html`
(prose only — the `initialize_sovereign_identity` code/API identifier correctly preserved
unchanged, per the never-rename-code-identifiers rule), `orderbook.html` (prose only — the
`sovereignVaultMicroUsdc` JS variable correctly preserved unchanged), `proof.html`,
`protocol.html`, `roadmap.html` ("Treasury Sovereignty"→"Treasury Custody", "Sovereign Memory"→
"Verified Memory"), `sdk.html`, `token.html`, `vmn.html`, `voice.html` (full brand rename,
10+ instances: "Sovereign Voice Stack"→"On-Premise Voice Stack" across title/meta/OG/Twitter/
JSON-LD/body, "Sovereign Inference/Reasoning Engine"→"Local Inference/Reasoning Engine",
"SOVEREIGN CLINICAL EXTRACTOR"→"ON-PREMISE CLINICAL EXTRACTOR"). Also renamed the "Sovereign
Siphon" settlement-routing brand name (a marketing name, not a code identifier) to "Settlement
Router" consistently across `nodes.html`, `protocol.html`, `sdk.html`, `token.html`. Final grep
confirms zero remaining "sovereign" occurrences site-wide outside the four preserved exceptions
(`vmn.html`'s two unused/dead CSS class selectors, `security.html`'s "CUSTOMER SOVEREIGNTY"
HTML comment describing customer control — correct per the governance rule, and the two code
identifiers named above).

**Developer surface consistency audit (§19):** a dedicated research pass read `docs.html`,
`sdk.html`, `api-integration.html`, `mcp.html`, `developers.html`, `.well-known/ai-plugin.json`,
and `openapi.yaml` in full and cross-referenced them against `proof.html` (the site's canonical
settlement/verification status page). Findings and fixes:
- **Critical — wrong/stale LNES-04 contract addresses in `api-integration.html`:** the page
  cited a retired Base Mainnet contract (`0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f`, labeled
  merely "not yet the recommended default" when `proof.html` actually says it is **retired** and
  its access-control status is unknown) and a wrong/deprecated Sepolia address
  (`0x3241941beBE7D7f0c42097D8646DF50992B272FB`, a pre-V5 deployment). Both corrected to the
  current V5 addresses (`0xbb14956a88BaD822Ef38e96fF337a088b41c72be` mainnet,
  `0x831606e0312B518737D2c497469243297cFdAe2B` Sepolia) in all four occurrences (inline JS
  example, Solidity comment, and the contracts reference table).
- **Base Mainnet overstated as live/production** in `docs.html` (overview prose, Desktop Prover
  spec table, Network Addresses table, ElizaOS/Solana sections), `protocol.html` ("Primary"
  network pill and status notice), `nodes.html` (operator-payout language — the highest-stakes
  instance, since this page recruits people to spend money on hardware), `connect.html`
  (economics section), and this session's own newly-written `faq.html` (a regression introduced
  earlier in this same pass, caught and fixed before deployment) — all corrected to state
  plainly that the Base Mainnet LNES-04 contract is deployed and recommended but **currently
  operating in mock-only mode; do not route real capital**, with Base Sepolia named as the
  currently-testable path. `nodes.html` and `connect.html` specifically now warn against
  acquiring hardware or applying on an expectation of real income today.
- **Solana investigation status inconsistently disclosed** — `docs.html`'s ElizaOS and Native-
  SOL-Escrow sections, and its Network Addresses table, previously omitted the investigation
  caveat that `sdk.html` already carried correctly; caveat added in both places and the address-
  table badge changed from "Active" to "Deployed · Under Investigation."
- **Receipt-vs-ZK-proof conflation:** `mcp.html`'s `exergynet_get_proof` tool description
  ("Retrieve ZK-STARK proof for a completed job") and `docs.html`'s settlement-flow language
  ("ZK-STARK VERIFIED") asserted a proof where the site's own `ai-plugin.json`/`openapi.yaml`
  correctly disclose a SHA-256 receipt; both reworded to be internally consistent, and
  `api-integration.html`'s `/jobs/{id}/proof` endpoint description (previously conflating
  Groth16 and STARK — two different proof systems — and calling the same value both a "receipt"
  and "raw proof bytes" in one sentence) corrected to describe a settlement receipt honestly.
- **Machine-readable manifest vs. human docs:** confirmed `ai-plugin.json` and `openapi.yaml`
  did **not** overclaim relative to human docs (the specific prohibition Directive §19 checks
  for was already satisfied) — if anything they were the more conservative documents. A separate
  completeness problem was found and fixed instead: `openapi.yaml`'s only operation
  (`getNetworkState`) didn't match any endpoint documented on `docs.html`/`sdk.html`/`mcp.html`/
  `api-integration.html`, and `ai-plugin.json`'s name (`"ExergyNet Compute"`) contradicted its
  own description ("AI memory"). Both files' descriptions rewritten to accurately describe what
  each actually exposes (network/settlement state), pointing readers to `mcp.html`/`vmn.html`
  for the separate memory/evidence surfaces, with stale "thermodynamic state and latest strikes"
  wording also replaced.
- `developers.html`'s meta description (previously describing a state/evidence/Vanguard product
  that doesn't match the page's actual App Store-publishing content) corrected to match the
  rendered page.
- No violations found for model-compatibility claims, memory/state overclaims, or missing
  benchmark-envelope caveats in the five audited developer-surface pages.

**Ghost-Witness trust-integrity fix (found via the original Directive 001 recon registry,
missed by Directive 003):** `ghost-witness.html` carried an unsourced "99.9% Contradiction
detection accuracy" headline stat with no evidence record, and three inconsistent audit-time
figures on one page (`<8s`, `<10s`, and a `28ms` demo figure for what were three different
things being described as the same metric). Removed the unsourced percentage in favor of a
qualitative "Deterministic Logic Check — not a probabilistic score" framing, and reconciled the
two end-to-end timing figures to one number (`<10s`) explicitly distinguished from the 28ms
compute-only demo figure.

**Machine-readable narrative sync (§20, §21, §22):** confirmed `llms.txt` already exists (an
established convention — no new pseudo-standard created per §21) but opened with the old
"persistent state, evidence, and authority substrate" framing; rewrote its lead paragraph and
page list to open with Useful Work / model-independent state, added Benchmarks/Design-
Partnership/Enterprise/Machines links, kept every existing bounded-claim policy line unchanged
(SHA-256-receipt-not-ZK-proof, shadow-mode gate, xISA research-only status, etc.) since those
were already accurate. Applied the same category/identity rewrite to
`.well-known/exergynet.json` and added `design-partner.html`/`enterprise.html` to its
`public_pages` map. Added `design-partner.html` to `sitemap.xml` (33→34 entries);
`lnes06-release-notes.html` correctly excluded, consistent with its own `noindex` meta tag.
`robots.txt` required no change (no narrative content). `.well-known/mcp/server-card.json` was
read and found already accurate — no change needed there.

**Aug 24 migration disposition (§45's classification requirement):** investigated the
previously-flagged "unmerged Aug 24 migration." Found two distinct things: (1) branch
`release/narrative-migration` at commit `dedc9a7`, which is fully **SUPERSEDED** — it is an
ancestor of `origin/main` and its content is already incorporated (Directive 003 built directly
on top of it); no action needed. (2) A separate, larger, genuinely unmerged effort: commit
`251e297` ("site: migrate ExergyNet narrative to state evidence authority substrate," 2026-08-24)
sitting only on the dirty local `main` branch (and the pushed `vp-sales-whitepaper-v2-2026-08-27`
preservation branch), confirmed via `git merge-base --is-ancestor` to **not** be an ancestor of
`origin/main` — it was staged and documented (`docs/SITE_MIGRATION_HANDOFF_2026-08-24.md` and
three companion docs) but deliberately never committed-and-pushed by the session that produced
it. Classification: **CONFLICT** — its target narrative ("persistent state, evidence, and
authority substrate," Authority-forward framing) is the same framing Directive 001's recon
diagnosed as the core problem and that this directive's canon deliberately supersedes; it must
not be merged as-is if ever revived. **SALVAGE:** the one concrete factual fix documented in its
own handoff (`"ExergyNet Corp"` → `"ExergyNet"` in `index.html` JSON-LD and `ghost-witness.html`
footer, an unsupported-entity-name correction) was independently verified already correct in the
current `origin/main` lineage — nothing to pull forward. Its five remaining open factual
questions (§H of the handoff doc: verified legal entity name, `legal.html` vs `legal/index.html`
canonical status, `voice.html`'s unsourced "1.24s round-trip" figure, and two others already
resolved by Directive 003/004) are carried into this directive's own open items rather than
resolved unilaterally. The branch and its worktree were not merged, rebased, deleted, or
force-cleaned — left exactly as found, consistent with the directive's explicit prohibition.

**New required deliverables produced this pass:** `docs/PUBLIC_CLAIM_SURFACE_CROSSWALK_2026-08-27.md`
(claim / evidence source / website ledger ID / white-paper ledger ID / current public pages /
tested envelope / safe wording / prohibited wording / status — mapping the core benchmark
claims, the two settlement-chain status claims, the LNES-04 contract-address correction, the
receipt-vs-proof correction, and the two open items — Ghost-Witness's now-qualitative claim and
`voice.html`'s still-unsourced performance figures — onto current page wording without
duplicating the existing benchmark/whitepaper ledgers) and
`EXTERNAL_NARRATIVE_PROPAGATION_QUEUE_2026-08-27.md` (Crunchbase, npm, Glama, CrossAI Tools,
MCP.so, Metatext, MCP Vouch, Libraries.io, F6S, Smithery, Paragraph, affiliated-entity pages, and
the Optimism governance record as diligence-only — no third-party surface edited this pass, per
§25's explicit scope limit).

**Held claims, not published (per §23/§24, unchanged from the canon doc):** the MCP Vouch
71/100 Grade C score (real, but evaluated an older package version — not advertised, not hidden
if asked, queued for remediate-then-rescan) and the "Official Anthropic MCP Registry" affiliation
claim (classified `HOLD_FOR_EXTERNAL_VERIFICATION`, confirmed absent from every first-party
surface this pass touched or searched).

**Status at the time of this entry:** the content, sovereignty-purge, developer-surface, and
machine-readable-sync workstreams above are complete. QA (visual, navigation, link, evidence-
crosswalk, risk-grep, runtime, regression against Directive 003's P0 invariants), the
implementation report (`WEBSITE_COMMERCIAL_REBUILD_2026-08-27.md`), the deployment diff gate,
and the fast-forward push to `origin/main` had not yet run as of this entry — see the session's
final terminal report for their outcome, or a follow-up changelog entry if this work continued
in a later session before those steps completed.

---

## 2026-08-27 — External Narrative Propagation + Independent Validation (VP Sales Directive 005)

**Agent/session:** Claude Code session (interactive), operator Seven Ezumba / ExergyNet.

**Exact strategic directive invoked:** `C:\Users\ezumb\Downloads\VP SALES DIRECTIVE 004.txt` (the user's acceptance message for Directive 004 contained the full VP SALES DIRECTIVE 005 text). Executed in a fresh isolated worktree at branch `vp-sales-external-propagation-2026-08-27`, based on `origin/main` at `1c82bc0b64f226b74be157e02119e262f2d54faf` (the Directive 004 production commit, confirmed unchanged via `git fetch` before starting).

**Scope:** Directive 005 is primarily an external-surface research and validation directive (Crunchbase, npm, GitHub, MCP directories, the official MCP registry, MCP Vouch, Paragraph, F6S, affiliated sites, Optimism governance, search-engine footprint) with conditional, narrow first-party correction authority per its own §28. Four parallel research agents were dispatched to cover the external surfaces; this session directly investigated the `exergynet-mcp-server` repository's actual shipped code, since that required source-level inspection rather than web research.

**First-party website fixes applied this pass (small, per §28):**
- `footer.html` and `roadmap.html`: the generic "GitHub" link pointed to `https://github.com/exergynet`, an organization confirmed via the GitHub REST API to **not exist** (404). Repointed both to `https://github.com/ezumba/vanguard-memory-node`, the real, narrative-consistent, actively-published open-source repository.
- `api-integration.html`: the Prover Setup code sample instructed `git clone https://github.com/exergynet/moleculogic-prover`, a repository confirmed 404 under both the nonexistent org and the real `ezumba` account. Replaced with an honest note that this source is not yet publicly published and directs interested operators to `operators@exergynet.org`, rather than leaving a broken command in a code sample a developer would actually try to run.

**Critical finding NOT applied to any repository (engineering judgment call, not a credentials block):** direct inspection of the actually-published `exergynet-mcp-server@0.2.2` npm tarball (fetched read-only via `npm pack`, independent of the GitHub repo, to avoid trusting an unverified source) found that its real `exergynet_open_job` tool — when a user configures a funded wallet exactly as its own README instructs — sends an on-chain transaction to a Base Mainnet contract address (`0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f`) that this site's own `proof.html` explicitly labels **retired and not part of current verification infrastructure**, with unknown/possibly-compromised access control per `VAULT_LEDGER.md`. A second, related defect: the repository's own committed `src/index.ts` implements an entirely different, unrelated (Solana-only, read-only, no-private-key) server that does not correspond to what's actually shipped in `dist/index.js` — meaning the public source does not reveal what actually runs. An initial attempt to correct the narrative/documentation files in this repository was made, then **fully reverted** (`git checkout -- .`, confirmed clean, nothing committed or pushed) once it became clear that (a) a `npm run build` invocation had nearly overwritten the real shipped `dist/index.js` with a compiled version of the unrelated stub source, and (b) any documentation correction written under the wrong understanding of which code is authoritative would itself be inaccurate. Full detail, verification method, and recommended remediation (requiring the operator's engineering judgment on contract-ABI compatibility, not a documentation-pass decision) is in `MCP_EXTERNAL_SECURITY_REMEDIATION_2026-08-27.md` §0. **No file in the `exergynet-mcp-server` repository was modified, committed, or pushed.**

**External research findings (no third-party surface mutated, per §25):** Crunchbase — no profile found. npm — `vanguard-memory-node` already clean; `exergynet-mcp-server` carries stale Gen 0/1 "thermodynamic compute clearinghouse"/DePIN framing, correction blocked by both missing npm credentials and the critical finding above. GitHub — the `github.com/exergynet` org referenced from the live site does not exist (see first-party fixes above); `github.com/ezumba/lnes06-edge-witness`'s repo description contains "sovereign," queued for Directive 006 (repo-description-field edits need `gh`/API auth this session did not have, distinct from the git push access already confirmed). MCP directories — Glama and MCP.so both mechanically crawl the same stale npm/README source (confirmed via byte-for-byte and timing-based evidence, not assumed); Smithery's listing is an empty stub; CrossAI Tools and Metatext do not list ExergyNet at all. The "Official Anthropic MCP Registry" claim is now **VERIFIED with a nuance**: `io.github.ezumba/exergynet` is genuinely listed in the real official MCP registry (`registry.modelcontextprotocol.io`, status active), confirmed via direct API query — but that registry is explicitly a self-publish system with no editorial review, so "listed" must never be upgraded to "endorsed"/"certified"/"partner." MCP Vouch's 71/100 Grade C score is confirmed real, scanned version 0.1.10 (2026-07-09), four releases behind the current 0.2.2 — full per-category reproduction assessment in the security remediation report. Paragraph article and F6S listing could not be located (reported as unconfirmed, not fabricated). MetalDrug.com (an affiliated site) carries an unsourced "88.6% cost reduction" claim presenting ExergyNet as production-ready for paying biotech customers — flagged, not corrected (control of that surface not confirmed this session). MyMonitor.ai's one mention of ExergyNet is accurate/biographical and surfaced a previously-untracked affiliated project name, "TensileEra." The Optimism Season 9 governance record (a real, declined 50,000 OP grant request, no reason stated in the public record) was documented as a diligence entry per §14 — not touched, not promoted, not concealed. The search-engine footprint audit found that **exergynet.org itself does not appear in any of the 10 required search queries** — the only indexed ExergyNet-controlled surface anywhere is the stale Glama listing — a finding more significant than any single stale description, since it means the Gen 2 canon currently has zero search visibility to correct toward.

**Full detail:** see `EXTERNAL_PROPAGATION_REPORT_2026-08-27.md` (master report), `MCP_EXTERNAL_SECURITY_REMEDIATION_2026-08-27.md`, `EXERGYNET_ANALYST_PRESS_EVIDENCE_PACKET_2026-08-27.md`, `EXERGYNET_MEDIA_ANALYST_TARGETS_2026-08-27.md` (research list, zero outreach sent), `EXTERNAL_PROPAGATION_CHANGELOG.md`, and the updated `EXTERNAL_NARRATIVE_PROPAGATION_QUEUE_2026-08-27.md`.

**Visual QA status:** the Directive 004 visual-QA gap (screenshots/interactive click-through) remained blocked this pass — the Browser pane was not displayed on the user's side, and both `computer` (click) and `screenshot` actions timed out with "the Browser pane is not displayed." Non-visual verification (console, network, content, structural) was used as before.

**Deployment status at the time of this entry:** the three first-party link/reference fixes above are staged for commit in the `vp-sales-external-propagation-2026-08-27` worktree; see the session's final terminal report for the deployment diff gate outcome and push status.
