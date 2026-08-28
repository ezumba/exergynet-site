# External Propagation Report — VP Sales Directive 005

**Master report.** See also: `MCP_EXTERNAL_SECURITY_REMEDIATION_2026-08-27.md`, `EXERGYNET_ANALYST_PRESS_EVIDENCE_PACKET_2026-08-27.md`, `EXERGYNET_MEDIA_ANALYST_TARGETS_2026-08-27.md`, `EXTERNAL_PROPAGATION_CHANGELOG.md`, `EXTERNAL_NARRATIVE_PROPAGATION_QUEUE_2026-08-27.md` (updated), `docs/WEBSITE_CHANGELOG.md` (updated).

## Headline findings, most important first

1. **The `exergynet-mcp-server` npm package, as actually published (0.2.2), directs users to send a real on-chain transaction to a Base Mainnet contract this site's own `proof.html` calls retired**, with access control that cannot be independently verified. This is a live financial-risk defect, not a narrative issue, and was not fixed by this pass — it requires the operator's engineering judgment. See `MCP_EXTERNAL_SECURITY_REMEDIATION_2026-08-27.md` §0.
2. **exergynet.org has zero search-engine visibility.** Across all 10 required footprint queries, the site itself never appeared. The only indexed ExergyNet-controlled surface anywhere is a stale third-party MCP directory listing (Glama). The Gen 2 canon has nothing to propagate *to* on search yet — this is a discoverability problem, not (only) a staleness problem.
3. **The site links to a GitHub organization that does not exist** (`github.com/exergynet`, confirmed 404), including a code sample instructing developers to `git clone` a nonexistent repo. Fixed this pass.
4. **ExergyNet genuinely is listed in the official MCP registry** (`registry.modelcontextprotocol.io`, `io.github.ezumba/exergynet`, status active) — this can now be stated with confidence, using bounded language only.
5. The MCP Vouch 71/100 score is real, scanned an old build (0.1.10 vs. current 0.2.2), and — per finding #1 — the current build likely has an issue worse than what was scored.

## What changed (first-party)

Three small corrections in `exergynet-site`: two dead-link fixes (`footer.html`, `roadmap.html`) and one fake-command removal (`api-integration.html`). No homepage repositioning, no new pages, no benchmark changes — within Directive §28's allowed scope.

## What did not change (and why)

No third-party surface (Crunchbase, npm, GitHub repos other than `exergynet-site`, MCP directories, Paragraph, F6S, MetalDrug) was mutated. Reasons, per surface, are itemized in `EXTERNAL_PROPAGATION_CHANGELOG.md`: no credentials (npm, MCP registry), an unresolved engineering finding taking priority over documentation polish (`exergynet-mcp-server`), surface doesn't exist or wasn't locatable (Crunchbase, Paragraph, F6S), or control of the surface isn't confirmed (MetalDrug, KTX-affiliated pages).

## Governing-principle check

Per the directive's own framing — machine discovery → technical examination → human recognition — finding #2 above means step one hasn't actually happened yet for the *current* narrative. The recommended sequence for Directive 006 is: resolve finding #1 (it would undermine any credibility-building effort if discovered independently first), then address search visibility and the `exergynet-mcp-server`/`lnes06-edge-witness` narrative correction (now unblocked once #1 is resolved and credentials are available), before any analyst/press outreach — which this pass correctly did not attempt.
