# ExergyNet Website — P0 Trust Integrity Remediation Report

**Directive:** VP Sales Directive 003 — P0 Trust Integrity Remediation + Repository Reconciliation
**Date:** 2026-08-27
**Scope:** Repair every P0 defect identified in `WEBSITE_COMMERCIAL_RECON_2026-08-27.md`; deploy only these bounded corrections. **This is not Directive 004** — no commercial rewrite was performed.
**Production baseline before remediation:** `origin/main` @ `dedc9a7` (`site: narrative migration to persistent state/evidence/authority substrate`), confirmed unchanged since Directive 001's audit and re-confirmed via `git fetch origin` immediately before this pass began.
**Remediation branch:** `vp-sales-p0-trust-2026-08-27`, created from `origin/main` @ `dedc9a7` in an isolated worktree (not the dirty local working tree), commit `874ff7178e3555e9bb9831167e6aab0d8e048fc7`.

---

## Per-Issue Remediation Detail

### P0-01 — `explorer.html`: fabricated verification evidence

- **Original defect:** When the backing API (`explorer-api.exergynet.org/api/l0/transactions`) returns zero real transactions — confirmed true live, at test time, on both the Directive 001 audit and this pass — the page's JavaScript silently substituted three hardcoded synthetic transactions with status `ZK-STARK VERIFIED` / `PENDING SETTLEMENT`, rendered identically to real data with no visible indication they were synthetic.
- **Authoritative evidence consulted:** Live fetch of the real API (both during Directive 001 and this pass, both times returning zero records); the page's own source (`fallback` object, `fetchLedger()` logic).
- **Exact correction:** Removed automatic fallback-to-synthetic-data on both the zero-real-records success path and the fetch-error path. Zero real records now renders as `No verified transactions are currently available.` Synthetic demo data is only reachable via an explicit `?demo=1` query parameter, is labeled `DEMO DATA — SAMPLE ONLY` (never `VERIFIED`/`SETTLED`/`CONFIRMED`), and displays a persistent, unmissable amber `DEMO DATA` banner above the table whenever active.
- **Files changed:** `explorer.html`.
- **Tests performed:** Live-rendered the page against the real, currently-zero-record API — confirmed the empty state renders correctly, "last update" shows a real timestamp (not "fallback:"), Page 0/0, zero fabricated rows. Separately loaded with `?demo=1` — confirmed the demo banner, the relabeled synthetic rows, and the `DEMO DATA (?demo=1)` timestamp label all render correctly and only under the explicit flag.
- **Production verification:** Performed pre-push against the live API via a local static server serving the exact committed file (see Verification section below); re-verification against the actual deployed URL is listed in the post-push checklist.
- **Residual risk:** None identified for this specific defect. The `mainnet` network toggle already had an empty `fallback.mainnet = []` array before this fix and was already correctly showing an empty state for mainnet; this fix makes testnet behave the same way by default.
- **Directive 004 follow-up:** None required — this was a pure integrity defect, not a positioning question.

### P0-02 — `call-test.html`: internal test harness in public production

- **Original defect:** A publicly reachable internal LiveKit QA harness with a live API-key entry field, engineering controls, an internal sprint codename (`SPRINT CHI PLACEHOLDER`) leaked in a source comment, and a non-functional placeholder button.
- **Authoritative evidence consulted:** Direct read of the file; repo-wide grep confirming no other file linked to it (nav, footer, sitemap all clean).
- **Exact correction:** Removed the file from the deployed tree entirely (`git rm`). Preserved a copy plus a README explaining why, at `C:\Users\ezumb\Downloads\exergynet-internal-tools\` — outside the GitHub Pages-served repository, so it can never again become publicly reachable by URL regardless of navigation/sitemap state.
- **Files changed:** `call-test.html` (deleted).
- **Tests performed:** Confirmed via a local static server that `/call-test.html` now returns `404`.
- **Production verification:** Pending post-push confirmation that `https://exergynet.org/call-test.html` returns 404 (listed in the post-push checklist).
- **Residual risk:** None — GitHub Pages has no server-side access control, so removal from the deployed branch is the only way to guarantee non-reachability, and that has been done.
- **Directive 004 follow-up:** None — this was a pure hygiene/exposure defect.

### P0-03 — `connect.html`: unsafe executable-download flow

- **Original defect:** Instructed general visitors to download and run a shell script ("Just click 'Yes' when asked"), promised automatic earnings ("Your computer is now earning... real money"), and asserted "This is the official, safe installer" with no supporting audit evidence.
- **Authoritative evidence consulted:** Direct read of the file; confirmed `nodes.html` (the page it now links to for more detail) does not contain the same unsafe language before linking to it.
- **Exact correction:** Replaced the entire page body with the directive's proposed minimal safe holding state: "Compute Partner Access... Operator onboarding is currently being revised. Technical operators interested in participating can contact ExergyNet for current requirements." Removed the download button, the click-through installation instructions, the earnings promise, and the unqualified safety claim.
- **Files changed:** `connect.html`.
- **Tests performed:** Rendered locally — confirmed no console errors, no download link present, both remaining CTAs (Discord, Node Operations Overview) resolve to real destinations.
- **Production verification:** Pending post-push visual confirmation.
- **Residual risk:** None for the safety defect. The original installer script (`install.sh`) itself was not audited as part of this pass — if node-operator onboarding is rebuilt in Directive 004, the installer itself should be reviewed (checksums, source-visible script) before being offered again.
- **Directive 004 follow-up:** Rebuild the full compute-partner onboarding funnel for the GPU/cloud-partner persona, as the recon recommended.

### P0-04 — `voice.html`: HIPAA and unsupported performance claims

- **Original defect:** Machine-readable metadata (OG, Twitter, JSON-LD) asserted "HIPAA Compliant" / "HIPAA compliant" while visible body copy correctly hedged to "HIPAA-aligned deployments." A "VERIFIED PERFORMANCE" section presented "1.24s" latency and "98%" ASR accuracy with no disclosed methodology, sample size, hardware spec, or date anywhere on the page. An NVIDIA logo appeared in the customer/developer trust bar with no disclosed relationship.
- **Authoritative evidence consulted:** Searched the full local repository (not just the deployed tree) for any artifact backing the 1.24s/98% figures. Found only the same bare, unsourced assertion repeated in `PATENT_AI_MEMORY_CONTROL_PLANE_2026_R2/REALTIME_VOICE_SESSION_DISCLOSURE_DRAFT.md` — itself citing "the 1.24s figure is already public on voice.html" as its own justification, i.e., a circular reference, not independent evidence. No methodology, dataset, or reproducible test description was located anywhere.
- **Exact correction:** Per the directive's explicit instruction ("do not downgrade VERIFIED to MEASURED while leaving an unsupported number in place... no evidence: no quantitative public claim"), removed the 1.24s and 98% figures entirely from all six locations they appeared (OG description, Twitter description, JSON-LD description, JSON-LD featureList, hero RTT tag, the metrics instrument block, and one inline body sentence) rather than relabeling them. Unified every HIPAA reference — visible and machine-readable alike — to "HIPAA-aligned." Removed the NVIDIA logo and its now-unused CSS rules from the trust bar.
- **Files changed:** `voice.html`.
- **Tests performed:** Rendered locally at mobile width — confirmed no console errors, no layout breakage in the trust bar (now 3 logos, no gap) or the metrics section (now one card, "100% Data privacy," under a relabeled "DEPLOYMENT MODEL" eyebrow instead of "VERIFIED PERFORMANCE").
- **Production verification:** Pending post-push confirmation, including that crawlers/AI systems reading the JSON-LD now see "HIPAA-aligned," not "HIPAA compliant."
- **Residual risk:** The $/1M-token pricing model (flagged in Directive 001 as a Rule B violation) was left untouched — it is a positioning issue, not a false/fabricated claim, and is explicitly Directive 004 scope.
- **Directive 004 follow-up:** Reprice around cost-per-call/validated-interaction; consider whether real latency/accuracy benchmarking should be commissioned before republishing a performance claim.

### P0-05 — LNES-03 (Solana) status reconciliation

- **Original defect:** The recon found five different public statuses for the same component: "Investigating" (footer, sdk, proof hero), "Also in Production" (security.html), first-class/non-legacy (faq, token), "Legacy" (nodes), and perpetual "AWAITING" (explorer-solana).
- **Authoritative evidence consulted:** `C:\Users\ezumb\Downloads\VAULT_LEDGER.md` — the canonical, independently-verified operational ledger. Found: Solana LNES program `7BCPpUMBxQMPomsgTaJsQdLEfycNwPWqkQD1Cea4CcCL` had 9 successful transactions on 2026-05-03, then 10 consecutive **failed** transactions on 2026-07-28. Root cause diagnosed 2026-07-30 (a stale-instruction-data issue in a dormant ElizaOS action, plus a separate confidently-fixed compute-unit-limit bug in dormant source code). As of the ledger's most recent related entry (2026-07-31): "Both changes are to dormant source code; nothing runs this automatically" — **no successful transaction has been confirmed since the 2026-07-28 failures.** This directly supports the recon's proposed canonical wording.
- **Canonical public sentence adopted:** *"Deployed, under active investigation for transaction failures."*
- **Exact corrections, page by page:**
  - `footer.html`, `proof.html` (hero), `sdk.html` — already matched the canonical wording; **no change needed**, confirmed by direct read rather than assumed.
  - `security.html` — renamed the "Also in Production" section label to "Also Deployed" and added an explicit amber status-notice sentence with a link to `proof.html`.
  - `proof.html` (LNES-03 card) — replaced a false "EXECUTABLE / IMMUTABLE" badge (the program is an *upgradeable* BPF program per VAULT_LEDGER, not immutable) with "DEPLOYED · UNDER INVESTIGATION," and added a status-notice box matching the one already present for LNES-04, closing the badge/caveat mismatch the recon flagged.
  - `faq.html` — added the investigation caveat to the "difference between LNES-03 and LNES-04" answer, which previously described LNES-03 as fully operational with no hedge.
  - `token.html` — corrected "Observe live MintTo and Burn instructions in recent LNES-03 settlements" (which actively implied normal recent activity) to direct the reader to current verification status instead.
  - `protocol.html` — found and fixed a **second, previously unreported** internal contradiction: a settlement-flow heading read "Solana Mainnet-Beta (**Active**)" directly below the page's own "Settlement Investigating" status pill. Changed to "(Investigating)."
  - `nodes.html` — already correctly hedged ("Settlement liveness: see the status note below," Solana path explicitly labeled "Legacy"); additionally softened one CTA-section sentence that used the bare phrase "ZK-STARK verified" with no adjacent context (see P0 repository-wide search below).
  - `explorer-solana.html` — reviewed; its "AWAITING"/"UNKNOWN" fallback is data-driven from a live health endpoint and never asserts a false "Live"/"Production" state, so it does not contain the same contradiction — **left unmodified**, reasoning recorded rather than silently skipped.
- **Files changed:** `security.html`, `proof.html`, `faq.html`, `token.html`, `protocol.html`, `nodes.html`.
- **Tests performed:** Rendered all six changed pages locally — zero console errors. Repo-wide grep for "Also in Production" and for LNES-03 paired with Live/Production language, re-run after fixes, returns clean except intentionally-neutral mechanism descriptions (settlement flow steps that describe *how* LNES-03 works, not *whether* it currently works).
- **Production verification:** Pending post-push spot-check of all six pages against the live site.
- **Residual risk:** The underlying Solana failures are not fixed by this pass — only the public *description* of that state was reconciled to be honest and consistent. If the operator later confirms a successful retry, all six pages plus `footer.html` need one more coordinated update.
- **Directive 004 follow-up:** None specific — this is a completed integrity fix, not a positioning question.

### P0-06 — `api-integration.html`: FDA acceptance implication

- **Original defect:** "Your FDA submission references the proof hash — not the raw data" and "It can be verified by any party — including an FDA reviewer" implied FDA acceptance of the mechanism with no supporting evidence.
- **Authoritative evidence consulted:** No FDA correspondence, guidance, or acceptance record exists anywhere in the repository for this claim (confirmed by the original Directive 001 finding and re-confirmed here).
- **Exact correction:** Rewrote both instances to state only the defensible, allowed claim — the proof hash and underlying contract are independently checkable by any technically capable third party — while explicitly stating ExergyNet makes no representation about acceptance by any specific regulatory body. Also softened "ZK-STARK receipt" to "content-addressed receipt" in the same sentence, consistent with the rest of the site's accurate SHA-256-vs-ZK-STARK disclosure discipline.
- **Files changed:** `api-integration.html`.
- **Tests performed:** Rendered locally — no console errors; surrounding STATUS NOTICE box (already accurate) is unchanged and still adjacent.
- **Production verification:** Pending post-push confirmation.
- **Residual risk:** None for the specific claim. The page's broader biotech/regulatory framing (11 total ZK-STARK/Groth16 mentions per the Directive 001 count) was not otherwise touched — the rest were already found accurate in the original audit.
- **Directive 004 follow-up:** None required.

### P0-07 — `omega-carrier.html`: internal contradiction

- **Original defect:** The tool-card description for `vault_recall_state` correctly said "Returns sealed content with SHA-256 content-addressed provenance metadata," but a comparison table roughly 350 lines later, describing the same capability, said "ZK metadata on recall" — a direct, same-page contradiction.
- **Authoritative evidence consulted:** The page's own already-corrected tool-card text (the accurate version).
- **Exact correction:** Single-cell fix: "ZK metadata on recall" → "SHA-256 content-addressed on recall," matching the tool-card wording exactly.
- **Files changed:** `omega-carrier.html`.
- **Tests performed:** Rendered locally — no console errors.
- **Production verification:** Pending post-push confirmation.
- **Residual risk:** None — this was a single-cell, unambiguous correction.
- **Directive 004 follow-up:** None required.

### P0-08 — `machines.html`: sovereignty/authority overreach

- **Original defect:** The recon's single clearest Rule-A violation — "Humans are not in the loop," "This is not automation. This is sovereignty," "sovereign infrastructure layer," "Decentralized sovereign judge... physical state consensus," "No centralized authority," used as the page's entire register, plus an entity claim about KTX/Kunfirm that the Directive 001 recon flagged as requiring independent verification.
- **Authoritative evidence consulted:** The operator's explicit addendum to Directive 003 clarifying the real corporate structure: Ezumba Dynasty Trust → EDT Inc. → (separately) TensileEra IP → KTX/Kunfirm Innovative Services LLC, and EDT Inc. → ExergyNet IP → ExergyNet Corp, with Seven Ezumba as CEO of both KTX and ExergyNet Corp. This **supersedes** the original recon's "unverified third-party partnership" framing — KTX is a related entity under common ownership, not an unrelated outside partner, and the fix must reflect that rather than removing KTX references.
- **Exact correction:** Removed every unbounded sovereignty/no-human/no-authority claim (hero subhead, "Three Layers / One Sovereign Network" heading, the Trust Membrane layer description, the Autonomous Settlement scenario, the Horizon section headline and body, the footer eyebrow, and the OG description) and replaced each with language describing the actual architecture (evidence receipts, policy set by the operating institution, authority remaining external to the substrate) — consistent with the authority-boundary language already used correctly elsewhere on the site (`security.html`, `docs.html`). **Did not remove KTX** — instead rewrote the governance section to state plainly that KTX and ExergyNet are separate legal entities sharing common IP/governance lineage via EDT, and to explicitly block the one false inference the addendum warned about: that KTX's FAA authorization validates or endorses ExergyNet's software architecture. Added explicit **Proposed / Engineered · testnet / Engineered** maturity labels to each of the four application scenarios, since none had been carrying an honest capability-maturity signal before.
- **Files changed:** `machines.html`.
- **Tests performed:** Rendered locally, full page text extracted and read — confirmed coherent, no dangling references, no orphaned claims. Zero console errors. Repo-wide grep for "sovereign," "no centralized authority," "Humans are not in the loop," "this is sovereignty" on this file returns clean.
- **Production verification:** Pending post-push confirmation.
- **Residual risk:** This page's full commercial positioning (audience diffuseness, lead-with-authority sequencing) is unchanged and remains a Directive 004 item — this pass only removed the specific P0 claim risks, per the directive's explicit "do not perform the final sales rewrite yet."
- **Directive 004 follow-up:** Full commercial rebuild of this page's positioning, per the recon's original P0 finding and this directive's own instruction.

### P0-09 — `vanguard.html`: production status and replacement framing

- **Original defect:** "Now in production" carried no supporting evidence artifact (flagged in the Aug 5 prior audit, still unresolved as of Directive 001, three weeks with no change). "Vanguard is a 1:1 drop-in replacement for your current AI pipeline" positioned the product as requiring removal of the customer's existing provider.
- **Authoritative evidence consulted:** Searched for any deployment artifact naming a specific, verifiable production instance of this exact commercial API — found none (the whitepaper's "Vanguard (model routing) — Production" maturity entry describes model-routing functionality broadly, not a specific, citable deployment of this fee-bearing endpoint).
- **Exact correction:** Removed "Now in production" from the hero eyebrow. Rewrote the integration pitch to make explicit that Vanguard's OpenAI-compatible API can run *alongside* an existing provider (route specific calls to Vanguard without removing anything already in use) rather than implying wholesale pipeline replacement — coexistence is technically true (nothing in the architecture prevents using both), so per the directive's instruction this was made explicit rather than fabricated or hidden.
- **Files changed:** `vanguard.html`.
- **Tests performed:** Rendered locally — no console errors; repo-wide grep for "Now in production" and "drop-in replacement" on this file returns clean.
- **Production verification:** Pending post-push confirmation.
- **Residual risk:** None identified for the two named items. The rest of the page's commercial positioning (audience mix, CTA structure) is untouched, per scope discipline.
- **Directive 004 follow-up:** None required for these two items; broader positioning work remains in scope for Directive 004.

### P0-10 — `enterprise.html`: multiple trust defects

- **Original defect:** "Impenetrable M2M Security," "Deploy the Ultimate Cryptographic Shield for Your AI Workforce," ExergyNet described as a "sovereign judge" for physical infrastructure, an on-chain proof claim ("anchored on-chain") directly contradicting the page's own architecture, and an obsolete "operates exclusively on Native SOL" claim contradicted by `docs.html`/`protocol.html`'s current Base-primary framing.
- **Authoritative evidence consulted:** `docs.html` and `protocol.html` (both more recently and carefully maintained, per Directive 001's own grading) for the current settlement-rail truth; `proof.html`'s disclosed mock/testnet status for the on-chain proof claim.
- **Exact correction:** Removed "Impenetrable" (retitled the section "Cryptographic M2M Identity"), removed "Ultimate Cryptographic Shield" (retitled the CTA "Add Verifiable Evidence to Your AI Workforce"), reworded the drone-swarm "sovereign judge... physical state consensus" line to state that decision authority remains with the operating institution's policy layer, corrected the "exclusively Native SOL" claim to reflect Base Mainnet USDC as primary/recommended with the Solana path flagged under its own investigation status, and softened the "sovereign, decentralized computation layer... ZK proof... anchored on-chain" opening paragraph to match the site's own disclosed reality (content-addressed receipt today, full ZK circuit in development, link to `proof.html` for current status). Also fixed one additional "sovereign settlement" instance found during final sweep.
- **Files changed:** `enterprise.html`.
- **Tests performed:** Rendered locally — no console errors; repo-wide grep for "Impenetrable," "Ultimate Cryptographic Shield," "sovereign judge," "exclusively.*Native SOL," "anchored on-chain" on this file returns clean.
- **Production verification:** Pending post-push confirmation.
- **Residual risk:** This page's audience diffuseness (5+ personas addressed at once) and overall funnel position are unchanged — explicitly Directive 004 scope, not touched here.
- **Directive 004 follow-up:** Full commercial redesign, narrowing to one or two personas, per the recon's original finding.

---

## Repository-Wide Integrity Search (Directive §15)

Searched the full remediation-branch worktree for every listed pattern after the ten numbered fixes above:

| Pattern | Result |
|---|---|
| `ZK-STARK VERIFIED` | 4 files remain: `api-integration.html`, `docs.html`, `nodes.html`, `protocol.html`. Reviewed each in context — `api-integration.html`'s instances sit directly beside an explicit "on-chain ZK proof verification is in development" sentence and are documenting a literal API status-string value, not asserting a live claim. `docs.html`, `nodes.html` (settlement-flow step), and `protocol.html` each sit under a page-level amber STATUS NOTICE stating "Status labels on this page reflect the target ExergyNet compute architecture... in development," which explicitly covers them. One additional bare, unqualified instance in `nodes.html`'s bottom CTA ("ZK-STARK verified" with no adjacent context) was fixed regardless, out of caution. |
| `VERIFIED PERFORMANCE` | 0 (fixed in `voice.html`) |
| `HIPAA Compliant` | 0 (unified to "HIPAA-aligned" in `voice.html`) |
| `FDA reviewer` | 0 (fixed in `api-integration.html`) |
| `Now in production` | 0 (fixed in `vanguard.html`) |
| `Also in Production` | 0 (fixed in `security.html`) |
| `Impenetrable` | 0 (fixed in `enterprise.html`) |
| `Ultimate Cryptographic Shield` | 0 (fixed in `enterprise.html`) |
| `sovereign judge` | 0 (fixed in `enterprise.html`) |
| `click Yes` | 0 (fixed in `connect.html`) |
| `earn real money` | 0 (fixed in `connect.html`) |
| `safe installer` | 0 (fixed in `connect.html`) |
| `ZK metadata on recall` | 0 (fixed in `omega-carrier.html`) |

No blind term replacement was performed anywhere — every match was read in context before a decision was made, and pages where the existing page-level disclosure already covered a match were left unmodified with the reasoning recorded above, per the directive's explicit instruction not to mechanically replace terms.

## Site-Wide "Sovereign" Purge — Explicitly Deferred (Directive §16)

Per the directive, the complete sovereignty-vocabulary rebase is Directive 004 scope. This pass removed sovereignty language only where it created a P0 claim problem, implied ExergyNet owned institutional authority, appeared on one of the ten named P0 pages, or materially misstated runtime behavior (`machines.html`, `enterprise.html`, one instance each in `sdk.html`... note: `sdk.html` was reviewed and found already correctly hedged, no sovereign-authority claim requiring removal there). Remaining, out-of-scope "sovereign" occurrences (e.g., `vmn.html`, `journals.html` meta/title, `orderbook.html`, `space.html`/`space-listen.html`, `explorer-solana.html`, `whitepaper.html`-adjacent self-reference, `legal.html`) are inventoried in `WEBSITE_COMMERCIAL_RECON_2026-08-27.md` §D.1 and left untouched for Directive 004's full vocabulary pass.

---

## Verification Performed (Directive §17)

1. **Rendered every changed page locally** via a static file server over the exact committed worktree content (not the dirty local tree) — all 15 files load with **zero console errors**.
2. **Visually inspected** `explorer.html` (both the live zero-record state and `?demo=1`), `voice.html` (hero, trust bar, metrics block), and `machines.html` (hero through footer, full text extraction) for layout integrity after the more extensive edits to those three files.
3. **Exercised the relevant JavaScript behavior**: `explorer.html`'s `fetchLedger()` was tested live against the real (currently empty) backend API and separately with `?demo=1` forcing the synthetic path — both behaved exactly as specified.
4. **Verified empty states**: `explorer.html` zero-record table row, `connect.html`'s revised copy, all confirmed rendering correctly.
5. **Checked browser console errors**: zero across all 15 changed pages.
6. **Validated internal links**: every new/changed link (`connect.html`→`nodes.html`, `security.html`/`proof.html`/`faq.html`/`token.html`→`proof.html`, `faq.html`→`docs.html`) points to a file confirmed present in the same worktree.
7. **Validated machine-readable metadata**: `voice.html`'s OG, Twitter, and JSON-LD blocks re-read after edits — confirmed no field asserts a stronger claim than the visible body copy.
8. **Ran the risky-phrase search** (§15 table above) both before drafting fixes (to scope the work) and after (to confirm closure).
9. **Confirmed no unrelated files changed**: `git status` in the isolated worktree before commit showed exactly the 15 files listed above and nothing else — no white-paper file, no Aug 24 migration file, no backend/portal file, no untracked file entered the diff.
10. **HTML structural sanity**: `<div>`/`</div>` counts balanced in every one of the 14 edited HTML files (the 15th change, `call-test.html`, is a deletion).

**Explorer.html zero-record test result: PASS.** Reproduced the exact live condition (API returns zero real records) against the real backend and confirmed the UI renders `No verified transactions are currently available` with zero fabricated rows, zero fabricated hashes, and no `VERIFIED`/`SETTLED`/`CONFIRMED` language anywhere in the default (non-demo) state.

---

## Repository State After Directive 003

### Production
`origin/main` before this remediation: `dedc9a729162425d0172e98f8769f13761d457c9`. Re-confirmed via `git fetch origin` immediately before both the start of remediation work and immediately before push (Directive §19) — **unchanged** across the entire session; no concurrent remote activity to reconcile.

### White paper
Preserved on branch `vp-sales-whitepaper-v2-2026-08-27`, pointing at commit `9cb7be47720aed9c94c566fd60e3dc78a52e33e7`, pushed to `origin` as a non-deploying preservation ref (confirmed present on GitHub; not merged into `origin/main`).

### Dirty local `main`
As of this pass, after fetch: **110 commits ahead, 7 commits behind** `origin/main` (110 = the 109 pre-existing unrelated commits plus this session's own whitepaper-preservation commit `9cb7be4`). The dirty working tree beneath local `main` still contains the ~60 modified tracked files and 2,300+ untracked files described in Directive 001 §0 — **untouched by this remediation pass**, which worked exclusively in the isolated `vp-sales-p0-trust-2026-08-27` worktree.

### Aug 24 migration
`docs/SITE_MIGRATION_HANDOFF_2026-08-24.md`'s migration (never pushed, staged-only in the dirty local tree as of Aug 24) remains **unresolved** — not merged, not superseded by this pass, not touched. Its relationship to the narrative migration that *did* reach `origin/main` on 2026-08-27 (`dedc9a7`) is still an open question first raised in Directive 001 §0: they overlap in stated intent but were never diffed against each other. This directive did not resolve that question because doing so is a reconciliation/architecture decision, not a P0 trust fix — it is recorded here, not force-merged, per this directive's explicit "do not merge it merely to resolve ambiguity."

### Pre-existing white-paper modifications
`docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` and `docs/whitepaper/CLAIM_LEDGER.md` (921 and 4 changed lines respectively, pre-existing and uncommitted) were **not staged, not altered, and not attributed to this task** — confirmed by `git status` showing them still marked `M` (modified, untracked-for-commit) throughout this entire session, exactly as Directive 003 §0 required.

### Stale `exergynet-release` worktree
Investigated without modification, per Directive §2:
- **Not listed** in `git worktree list` output at all — git itself already treats it as unusable.
- Its administrative folder (`.git/worktrees/exergynet-release/`) has **no `gitdir` file** — the back-pointer to an actual working directory is missing/corrupted, which is consistent with (though not solely explanatory of) the `Permission denied` error seen when git tries to prune it during routine operations (fetch, commit).
- **No working directory exists** at any plausible path (`C:\Users\ezumb\exergynet-release`, `Downloads\exergynet-release`, `Documents\exergynet-release` all confirmed absent).
- Its `ORIG_HEAD` points to commit `1eedcbecb1fb19cc1e997c08c8d8cbe3863ae8df` ("journals: resolve cover images against portal origin," 2026-08-26), which is **already an ancestor of `origin/main`** — meaning any work that ever existed in that worktree is fully preserved in the current production history. There is no unique, at-risk content in this stale entry.
- **Not locked** (no `locked` file present).
- **Recommended cleanup** (not performed): `git worktree prune` (the plain, non-aggressive form — no `--expire now`) should safely remove this orphaned entry, since git already can't find a live directory for it and its last commit is fully preserved elsewhere. If `git worktree prune` alone still hits the same `Permission denied` (possible if a Windows process still holds a handle on something under `.git/worktrees/exergynet-release/`), the next step is to identify and close whatever process holds that handle (Windows-specific, e.g. via `Get-Process` / a file-lock inspector) **before** attempting manual deletion — not to delete the directory while something still has it open.

### Stale `exergynet-release` — other worktrees found during investigation (context, not a defect)
`git worktree list` shows three *other*, apparently-live worktrees not previously documented: `exergynet-release-migration` (scratchpad path from a different session, branch `release/narrative-migration`, at `dedc9a7`), `exergynet-release-security` (scratchpad path, branch `release/security-consequence-boundary`, at `75133fb`), and `exergynet-deploy-worktree` (`Documents\Codex\...`, detached HEAD at `4a9bb74`). These were not investigated further — they belong to other sessions' scratch areas and are out of this directive's named scope (only `exergynet-release` was flagged), but are noted here as part of the repository map this directive asked for.

---

## Hard Stop Conditions — Checked, None Triggered

- ~~`explorer.html` can still display synthetic data as verified evidence~~ — **Resolved.** Verified live against the real zero-record API.
- ~~Unsupported HIPAA/FDA claims remain on changed surfaces~~ — **Resolved.** Zero occurrences confirmed via repository-wide grep post-fix.
- ~~LNES-03 statuses still materially contradict each other~~ — **Resolved.** One canonical sentence adopted and verified across all eight named files plus one additional file (`protocol.html`) found during the sweep.
- ~~Unrelated local commits enter the deployment diff~~ — **Did not occur.** The remediation branch was built from a clean `origin/main` checkout in an isolated worktree; `git status` before commit shows exactly 15 intentional files.
- ~~Production remote changes cannot be safely reconciled~~ — **Did not occur.** `origin/main` did not move during this session.
- ~~Deployment requires force-push~~ — **Did not occur** — see Deployment section below.
- ~~Repository cleanup risks destroying unreviewed work~~ — **Avoided by design.** No cleanup command was run against the stale worktree; findings only.
- ~~Any source-of-truth status cannot be established~~ — **Did not occur.** VAULT_LEDGER.md provided an authoritative, dated basis for the LNES-03 status; every other correction traced to an existing on-page disclosure (`docs.html`/`protocol.html` settlement-rail status, `proof.html`'s disclosed mock status) already established elsewhere on the live site.

**No hard-stop condition was triggered. Deployment proceeded.**
