# ExergyNet Site Migration — Change-Control Handoff

**Date:** 2026-08-24
**State:** Attribution-safe staging prepared. **NOT committed. NOT pushed. NOT deployed.**
**HEAD at prep time:** `1bb50fa` (2026-08-17) "docs: reconcile and seal AI Memory Control Plane v1.9 baseline"
**Companion docs:** `SITE_NARRATIVE_CANON.md`, `SITE_RECON_2026-08-24.md`,
`SITE_PAGE_MIGRATION_MATRIX.md`, `SITE_CHANGELOG.md`.

> **Attribution method.** This repo held large pre-existing uncommitted work before the
> migration. No pre-session snapshot exists, so attribution was done by: (1) inspecting every
> `git diff` hunk against the known migration edits; (2) `--ignore-all-space` to separate real
> content from line-ending noise; (3) `git status` ASCII-sort analysis of the session-start
> state; (4) comparing HEAD blobs to content observed mid-session. Every staged file was
> confirmed to contain **only** migration content. Nothing was reset, checked out, restored,
> stashed, or committed.

---

## A. Final migration status
Narrative migration (P0–P3) complete and verified (see §I). Change-control staging complete:
**26 migration-only files staged; 2 migration-touched mixed files intentionally left unstaged;
57 pre-existing-only tracked files left untouched and unstaged.** No commit performed.

## B. Files changed by this migration (STAGED — 26)
All verified migration-only (content-only; autocrlf/EOL noise normalized where present).

**New migration documents (5):**
`docs/SITE_NARRATIVE_CANON.md`, `docs/SITE_RECON_2026-08-24.md`,
`docs/SITE_PAGE_MIGRATION_MATRIX.md`, `docs/SITE_CHANGELOG.md`, and this file
(`docs/SITE_MIGRATION_HANDOFF_2026-08-24.md`).

**Modified public pages/assets (21):**
`index.html`, `enterprise.html`, `voice.html`, `vanguard.html`, `ghost-witness.html`,
`nodes.html`, `lnes06.html`, `sdk.html`, `mcp.html`, `vmn.html`, `benchmarks.html`,
`api-integration.html`, `machines.html`, `apps.html`, `footer.html`, `docs.html`,
`protocol.html`, `whitepaper.html`, `certificate_physical_presence.html`,
`sitemap.xml`, `llms.txt`, `.well-known/exergynet.json`.

**Deleted migration artifacts:** 5 byte-identical orphan download duplicates
(`omega-carrier (1).html`, `proof (1).html`, `vanguard (1).html`, `whitepaper (1).html`,
`x402-security-brief (1).html`). These were **untracked** (never committed), so `rm` produced
no git-tracked deletion — nothing to stage.

## C. Files containing pre-existing changes (UNSTAGED, untouched by migration — 57)
Never edited by this migration; left exactly as found. **Do not attribute to the migration.**
- **Public pages:** `security.html` (378 real content lines, pre-existing), `journals.html`
  (235), `header.html` (1), `legal/index.html` (2), `main.js` (root, 2).
- **Internal docs:** `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md`,
  `docs/whitepaper/CLAIM_LEDGER.md`, `LWP_MAINTENANCE_POLICY.md`, `PROJECT_BLOCKERS.md`,
  `xLMP_v2_ARCHITECTURE_PROPOSAL.md`.
- **App/backend (all pre-existing):** `otet_harness.py`, `server.js.new`,
  `intel-console/app/api/admin/cleanup/route.ts`, `omega_carrier/*` (4 files),
  `portal/**` (~44 files: `biological_proxy/index.js`, `deploy_portal.sh`,
  `src/app/**`, `src/components/**`, `src/lib/**`, `globals.css`, etc.).
- **Untracked (2346):** pre-existing artifacts, node_modules, patent dirs, benchmark
  bundles, `* (1)` copies of other files, etc. None are migration output except the 5 SITE_
  docs in §B (now staged).

## D. Mixed files requiring hunk-level treatment (UNSTAGED — 2)
Both are files the migration edited that **also had pre-existing uncommitted changes**, where
the pre-existing and migration edits are **not separable** (same line / whole-file rewrite).
Left unstaged per directive rule 5.

1. **`assets/main.js`** — line-level mixed.
   - HEAD tagline: `"Thermodynamic ZK-Compute…"`. A pre-existing uncommitted edit had changed
     it to `"Sovereign ZK-Compute…"` (that is what the migration's Edit matched). The migration
     then changed it to `"Persistent State, Evidence & Authority…"`, and the status line
     `LNES-03 · Solana · Live` → `… Solana Mainnet · Investigating`.
   - The pre-existing `Sovereign` edit and the migration edit are on the **same line** →
     inseparable. The pre-existing intermediate value is not recoverable from git (it was
     never committed). **Operator action:** confirm the intended tagline, then stage manually.
2. **`.well-known/mcp/server-card.json`** — pre-existing edit overwritten.
   - HEAD description: `"Thermodynamic ZK-Compute…"`. A pre-existing uncommitted edit had
     changed it to `"Deterministic ZK-Compute…"`. The migration performed a **full-file Write**
     (new substrate content), which overwrote that pre-existing edit. The pre-existing
     `Deterministic` version is not recoverable from git.
   - **Operator action:** the current working-tree content is the migration's substrate rewrite
     and is correct for the new narrative; if the pre-existing `Deterministic` edit mattered,
     recover it from a deployment/backup before staging.

## E. Migration hunks staged
All migration content is staged as **whole files** (26), because each staged file was verified
to contain migration-only content (no pre-existing hunks). Content totals (whitespace-ignored):
**802 insertions / 131 deletions across 26 files.** Note: `whitepaper.html` has an LF/CRLF
mixed-EOL HEAD blob, so its *raw* staged diff shows EOL-normalization noise (734/734) while its
*content* change is exactly 3 lines (title, og:title, eyebrow) — verify with
`git diff --cached --ignore-all-space -- whitepaper.html`.

## F. Migration hunks intentionally left unstaged
- The 2 mixed files in §D (`assets/main.js`, `.well-known/mcp/server-card.json`).
- Their migration intent is preserved in the working tree; only staging is withheld pending
  operator reconciliation of the overwritten pre-existing edits.

## G. Remaining legal / entity issue
- `legal.html` / `legal/index.html` were **not modified** by the migration (legal substance is
  human-gated). They still read "decentralized protocol", "sovereign mathematical physics
  engine", "not a corporation", "mathematically final", "absolute legal responsibility".
- **Entity contradiction:** `index.html` JSON-LD retains `"name": "ExergyNet Corp"`. Per the
  change-control directive, **"ExergyNet Corp" is treated as an unsupported entity designation**
  (no repository evidence establishes that exact legal entity). The migration did **not** invent
  a replacement entity and did **not** rewrite legal terms.
- **Applied (non-legal metadata only):** per the change-control directive's authorization to
  "remove unsupported 'Corp' naming from non-legal metadata rather than replacing it with
  another guessed legal entity," the two **non-legal** occurrences were changed
  `"ExergyNet Corp"` → `"ExergyNet"`: `index.html` JSON-LD `name` and `ghost-witness.html`
  footer copyright (the standard site footer already used "© ExergyNet"). No entity was
  invented; no legal-page term was touched. `grep "ExergyNet Corp"` across the public site now
  returns 0.
- **Still open (operator):** the legal pages' own entity language remains human-gated; do not
  assume IP holder = operator = licensor = site owner = service provider. A verified legal
  entity name is still required before any legal-page edit.

## H. Remaining factual questions (operator)
1. Verified legal entity name (blocks the JSON-LD `name` fix and any legal-page edit).
2. `legal.html` vs `legal/index.html` — which is canonical for `/legal/`?
3. Voice stack "1.24s round-trip" — source/envelope (voice.html still carries the number).
4. Whitepaper publication target (page now says "Preview / In Preparation").
5. `call-test.html`, `space-listen.html` — intended public, or remove?
6. The 2 overwritten pre-existing edits in §D — reconcile if they mattered.

## I. Final verification results (working tree)
- **Local link audit:** 0 broken local links across all `*.html`.
- **Internal/private IP scan:** 0 (public html + meta + llms.txt + sitemap).
- **Secret scan:** 0 real secrets. Hits are integration-doc **placeholders** only
  (`0xYOUR_ED25519_PRIVATE_KEY`, `your_base58_private_key`, `agentKeypair.secretKey`,
  `private_key_hex` parameter) — pre-existing code samples, not leaked material.
- **Stale narrative grep:** "AI Memory Control Plane" remains only as the **xLMP subsystem
  label** (canon §7-compliant) on benchmarks/index/vmn/whitepaper; it is **not** the Level-1
  identity anywhere. "sovereign mathematical physics engine"/"decentralized protocol" remain
  only on the human-gated legal pages.
- **Placeholder/TODO scan:** 0 in public HTML (the last "(coming soon)" cell in vmn.html →
  "(planned)"). Remaining "Coming Soon" strings live only inside the migration docs as records.
- **Status terminology scan:** consistent vocabulary present — in development (18), testnet mode
  (10), Legacy (9), Preview (12+9), Planned (10), Investigating (2), shadow mode (1),
  research-validated (1), Patent Pending (3).
- **JSON validation:** `exergynet.json`, `ai-plugin.json`, `mcp/server-card.json` all parse OK.
- **Sitemap validation:** well-formed XML; 33 entries; 0 dead targets; `http://` namespace.
- **HTML structural check:** `<div>`/`</div>` balanced on all staged pages except
  `certificate_physical_presence.html` (−1), which is a **pre-existing** imbalance at HEAD
  (13/14), not introduced by the migration; browsers auto-correct.
- **Renders (0 console errors each):** Homepage, Vanguard, Security, Developer Docs, Protocol,
  Proof — all render with header/footer injected and correct new copy.
- **Reintroduction guards (staged additions):** 0 occurrences of "absolute truth", "100%
  HIPAA/compliant", "zero leakage/retention", "direct GPU kernel", "Vanguard Neural Engine",
  "ZK-STARK VERIFIED on Base Mainnet", per-segment "Groth16-settled", "recursive O(1)", or
  "first cryptographic truth" in public HTML. (Such strings appear only inside the migration
  docs, quoted as "Previous:" records.)
- **Internal IP / host info in staged content:** 0.
- **Competitor factual claims:** the vanguard provider-comparison table (specific retention
  windows, pricing, "trains on your data") was removed and replaced with a self-describing
  capability table; the enterprise "blindly trust AWS/GCP" jab was reframed. No unsupported
  competitor factual claims remain in staged content.

## J. Exact `git status` (representative — full is long)
```
On branch (detached/working per repo), HEAD = 1bb50fa
Changes to be committed (staged): 26 files  — see §B
Changes not staged for commit (tracked): 59 files
  - 2 migration-mixed (see §D): assets/main.js, .well-known/mcp/server-card.json
  - 57 pre-existing-only (see §C)
Untracked files: 2346 (pre-existing artifacts; none are migration output except the
  5 SITE_ docs now staged)
```
Reproduce precisely with: `git status` · staged names: `git diff --cached --name-only`.

## K. Exact staged diff summary
`git diff --cached --ignore-all-space --shortstat` → **26 files changed, 802 insertions(+), 131 deletions(-)** (content-only).
`git diff --cached --shortstat` (raw) → 26 files, 1532 insertions(+), 861 deletions(-)
(raw includes the whitepaper.html mixed-EOL normalization noise; content is as above).
Per-file content stat: see §E and `git diff --cached --ignore-all-space --stat`.

## L. Exact unstaged diff summary
`git diff --shortstat` (tracked, unstaged) → **59 files changed** (~1000+ insertions),
of which:
- 2 migration-mixed files (§D) — small edits atop pre-existing.
- 57 pre-existing-only files (§C) — includes large diffs on `security.html` (378 content),
  `journals.html` (235 content), `portal/**`, `omega_carrier/**`, internal docs — **none
  authored by this migration.**

---

## STOP CONDITION MET
Attribution-safe staging state prepared and reported. **No commit. No push. No deploy.**
Next step is the operator's: review §D/§G, resolve §H, then commit the staged set (optionally
`git commit` the 26 staged files as the narrative-migration commit) — separately from the
pre-existing work, which remains unstaged and intact.
