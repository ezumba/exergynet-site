# Website Commercial Rebuild — Implementation Report

**Directive:** VP Sales Directive 004 — Full Commercial Website Rebuild + Canonical Machine Narrative
**Branch:** `vp-sales-commercial-rebuild-2026-08-27`
**Base:** `origin/main` @ `74b798068acba047dc85c9e76eb656c5bde0e02f` (the Directive 003 P0 remediation production commit)
**Isolation:** built in a dedicated git worktree, never touching the dirty local `main`.

This report is the implementation record. See `docs/WEBSITE_CHANGELOG.md`'s "Full Commercial
Website Rebuild + Canonical Machine Narrative" entry for the full narrative account of what
changed and why; this document is the structured summary plus the deployment record.

---

## 1. Canonical reference produced

`docs/PUBLIC_NARRATIVE_CANON_2026-08-27.md` — the master document every rewritten page derives
from: the frozen four-layer hierarchy (Useful Work → Authoritative State → Interoperability →
Authority; Authority is never the opening pitch or homepage primary CTA), loaded-term governance
rules, the sovereignty-language rule, the KTX/Kunfirm dual-boundary framing, and the two held
external claims (MCP Vouch score, Anthropic MCP Registry affiliation).

## 2. Pages fully rewritten

`index.html`, `enterprise.html`, `machines.html`, `vanguard.html`, `faq.html`, `whitepaper.html`
(rewritten as a prose-only commercial bridge, no PDF offered pending publication approval),
`header.html`, `footer.html`.

## 3. New pages

`design-partner.html`, `connect.html` (rebuilt from Directive 003's holding page into a full
compute/operator page), `lnes06-release-notes.html` (extracted consumer changelog, `noindex`).

## 4. Targeted-edit pages (not full rewrites)

`security.html`, `benchmarks.html`, `lnes06.html`, `vmn.html`, `journals.html`,
`ghost-witness.html`, `mcp.html`, `docs.html`, `protocol.html`, `nodes.html`,
`api-integration.html`, `developers.html`, `openapi.yaml`, `.well-known/ai-plugin.json`,
`.well-known/exergynet.json`, `llms.txt`, `sitemap.xml`.

## 5. Site-wide sovereignty vocabulary purge

Completed the purge Directive 003 deliberately deferred. Full file list and before/after grep
counts are in `docs/WEBSITE_CHANGELOG.md`. Summary: zero remaining case-insensitive "sovereign"
occurrences site-wide outside four deliberately-preserved exceptions — two unused/dead CSS class
selectors in `vmn.html`, the `security.html` "CUSTOMER SOVEREIGNTY" HTML comment (correct per the
governance rule — describes customer control, not ExergyNet self-description), and two real
code/API identifiers (`initialize_sovereign_identity` in `omega-carrier.html`,
`sovereignVaultMicroUsdc` in `orderbook.html`) correctly left unchanged. The highest-priority
item — the live runtime LLM system prompt in `space-listen.html` (`"You are Vanguard, the
ExergyNet sovereign AI assistant..."`) — is fixed.

## 6. Developer surface consistency audit

A dedicated research pass read `docs.html`, `sdk.html`, `api-integration.html`, `mcp.html`,
`developers.html`, `.well-known/ai-plugin.json`, and `openapi.yaml` in full against `proof.html`
as ground truth. Findings and fixes are detailed in `docs/WEBSITE_CHANGELOG.md`; the two most
consequential:

- **Critical bug:** `api-integration.html` cited a retired Base Mainnet contract address and a
  wrong/deprecated Sepolia address for LNES-04. Corrected to the current V5 addresses in all
  four occurrences.
- **Base Mainnet mock-only status was inconsistently disclosed or missing entirely** on
  `docs.html`, `protocol.html`, `nodes.html`, `connect.html`, and this pass's own newly-written
  `faq.html` (a regression caught and fixed before deployment). All now state plainly that the
  Base Mainnet LNES-04 contract does not yet route real capital. `nodes.html` and `connect.html`
  — the two pages that recruit paid compute/node operators — now carry an explicit warning
  against acquiring hardware or applying on an expectation of real income today.

Also fixed independently: `ghost-witness.html`'s unsourced "99.9% Contradiction detection
accuracy" stat and three inconsistent audit-time figures (found via the original Directive 001
recon registry, missed by Directive 003).

## 7. Machine-readable narrative sync

`llms.txt` and `.well-known/exergynet.json` rewritten to open with Useful Work / model-
independent state framing (previously opened with "persistent state, evidence, and authority
substrate"); all existing bounded-claim policy lines preserved unchanged since they were already
accurate. `sitemap.xml` updated (added `design-partner.html`; `lnes06-release-notes.html`
correctly excluded per its own `noindex` tag). `robots.txt` and
`.well-known/mcp/server-card.json` required no changes — both already accurate.
`ai-plugin.json`/`openapi.yaml` internal name/description mismatch corrected (see changelog).
No new pseudo-standard created — `llms.txt` is an established convention and already existed.

## 8. August 24 migration disposition

Two distinct things investigated: branch `release/narrative-migration` (commit `dedc9a7`) is
**SUPERSEDED** — already an ancestor of `origin/main`, fully incorporated. The separate,
larger effort at commit `251e297` (2026-08-24, sitting only on dirty local `main` and the pushed
`vp-sales-whitepaper-v2-2026-08-27` branch, confirmed not an ancestor of `origin/main`) is
classified **CONFLICT** — its target narrative is the Authority-forward framing this directive
supersedes, and must not be merged as-is if ever revived. Its one concrete factual-fix
recommendation (`"ExergyNet Corp"` → `"ExergyNet"`) was independently verified already correct in
the current lineage — nothing to **SALVAGE**. Not merged, rebased, or force-cleaned.

## 9. Required deliverables — locations

- `docs/PUBLIC_NARRATIVE_CANON_2026-08-27.md`
- `WEBSITE_COMMERCIAL_REBUILD_2026-08-27.md` (this file)
- `docs/PUBLIC_CLAIM_SURFACE_CROSSWALK_2026-08-27.md`
- `EXTERNAL_NARRATIVE_PROPAGATION_QUEUE_2026-08-27.md`
- `docs/WEBSITE_CHANGELOG.md` (appended, not overwritten)

## 10. Held claims (not published)

MCP Vouch 71/100 Grade C score — not advertised, not hidden if asked, queued for Directive 005
(remediate → re-scan). "Official Anthropic MCP Registry" affiliation — classified
`HOLD_FOR_EXTERNAL_VERIFICATION`, confirmed absent from every first-party surface searched.

## 11. QA performed

- **Structural:** `<div>`/`</div>` balance checked on every modified/new HTML file — all
  balanced.
- **Machine-readable validation:** `sitemap.xml` valid XML; `ai-plugin.json`,
  `exergynet.json`, `mcp/server-card.json` valid JSON.
- **Link audit:** automated scan of every `.html`-to-`.html` internal link site-wide — zero
  broken links.
- **Risk grep:** re-ran the sovereignty grep (clean, four documented exceptions only) plus a
  targeted sweep for absolute/overclaim language (`guaranteed`, `100% secure`, `unhackable`,
  `trustless`, `flawless`, etc.) — the handful of hits found are correctly-used negations
  ("no guaranteed earnings," "not a guaranteed... volume") or accurate engineering claims
  (deterministic hashing), not overclaims.
- **Content/console QA:** served the full worktree from a local static server and navigated
  through `index.html`, `design-partner.html`, `connect.html`, `faq.html`, `vmn.html`,
  `mcp.html`, `docs.html`, `nodes.html`, `protocol.html`, `ghost-witness.html`, `explorer.html`,
  and `space.html` — zero console errors on any page, all header/footer fetches and asset loads
  returned 200, and rendered content matched the intended rewrites (verified via
  `get_page_text`).
- **Runtime QA:** `explorer.html` correctly shows a genuine empty state ("0 visible testnet
  transactions... No verified transactions are currently available") rather than any fabricated
  demo data — confirms the Directive 003 P0 fix for this page still holds. `space.html` renders
  the sovereignty-purged copy correctly with no console errors.
- **Mobile QA:** homepage checked at 375×812 — zero console errors, mobile nav (hamburger menu)
  present and structurally correct via the accessibility tree.
- **Not performed this pass:** visual screenshots and click-through interaction testing — the
  Browser pane was not displayed on the user's side during this session, which blocks
  screenshot capture and simulated clicks/taps (both timed out with "Browser pane is currently
  hidden"). Console, network, content, and structural verification were used as the substitute
  evidence; a follow-up session with the pane visible could add screenshot-based visual QA if
  desired.

## 12. Deployment

See the deployment diff gate and push record appended to this report / the session's final
report at the time of push — the diff gate must show only the files listed in sections 2–7 above
plus this report and the other three deliverables before any push is authorized.
