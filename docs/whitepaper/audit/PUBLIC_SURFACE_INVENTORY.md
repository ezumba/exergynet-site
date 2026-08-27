# Public Surface Inventory
**Audit:** Pre-White Paper Website Claim Audit — ExergyNet
**Audit date:** 2026-08-05
**Scope:** exergynet.org static site (GitHub Pages, exergynet repo)
**Status:** READ-ONLY RECON

---

## Canonical Domain

- **Primary:** `exergynet.org`
- **Confirmed redirect:** `www.exergynet.org` → `exergynet.org` (CNAME in repo)
- **Storage subdomain:** `https://storage.exergynet.org` (linked from index, Exergy Vault)
- **Portal subdomain:** `https://portal.exergynet.org` (Next.js app, separate deployment)
- **MCP subdomain:** `https://mcp.exergynet.org` (Caddy reverse proxy to port 8765)
- **Explorer API:** `https://explorer-api.exergynet.org` (Carrier EC2 Rust API)
- **API endpoint:** `https://api.exergynet.org/v1` (Vanguard inference, referenced in vanguard.html)

---

## Page Inventory

| PAGE_ID | PUBLIC_URL | SOURCE_FILE | PAGE_TITLE | PRIMARY_TOPIC | INDEXABLE | LINKED_FROM | REVIEW_STATUS |
|---------|-----------|-------------|------------|---------------|-----------|-------------|---------------|
| P-001 | / | index.html | ExergyNet \| Sovereign Memory and Verifiable Compute | Home / Overview | YES | Nav, sitemap | REVIEWED — findings noted |
| P-002 | /whitepaper.html | whitepaper.html | Sovereign Memory & Verifiable Compute \| ExergyNet | Architecture whitepaper (OLD version) | YES | Nav, sitemap, many pages | REVIEWED — CRITICAL issues |
| P-003 | /vanguard.html | vanguard.html | Vanguard Engine \| ExergyNet — Enterprise AI Inference | Vanguard inference API | YES | Nav, sitemap | REVIEWED — CRITICAL issues |
| P-004 | /omega-carrier.html | omega-carrier.html | Omega Carrier — MCP Bridge for Stateful AI Agents | Omega Carrier MCP bridge | YES | Nav, sitemap | REVIEWED — HIGH issues |
| P-005 | /proof.html | proof.html | On-Chain Proof \| ExergyNet | Contract proof / on-chain verification | YES | Nav, sitemap, footer | REVIEWED — CRITICAL issues |
| P-006 | /lnes06.html | lnes06.html | (unread — 475KB) | Edge Witness / LNES-06 | YES | Footer, nav | UNREAD (file too large) |
| P-007 | /mcp.html | mcp.html | (unread) | MCP Gateway | YES | Nav, footer | UNREAD |
| P-008 | /docs.html | docs.html | (unread) | Developer Docs | YES | Sitemap | PARTIALLY REVIEWED via grep |
| P-009 | /protocol.html | protocol.html | ExergyNet LNES-06 Protocol | Protocol specification | YES | Sitemap | PARTIALLY REVIEWED via grep |
| P-010 | /enterprise.html | enterprise.html | (unread) | Enterprise | YES | Sitemap, footer | PARTIALLY REVIEWED via grep |
| P-011 | /faq.html | faq.html | (unread) | FAQ | YES | Sitemap, footer | PARTIALLY REVIEWED via grep |
| P-012 | /api-integration.html | api-integration.html | (unread) | API Integration | YES | Footer | PARTIALLY REVIEWED via grep |
| P-013 | /nodes.html | nodes.html | (unread) | Node Operations | YES | Sitemap | PARTIALLY REVIEWED via grep |
| P-014 | /security.html | security.html | (unread) | Security Architecture | YES | Sitemap | PARTIALLY REVIEWED via grep |
| P-015 | /roadmap.html | roadmap.html | (unread) | Roadmap | YES | Sitemap | PARTIALLY REVIEWED via grep |
| P-016 | /token.html | token.html | (unread) | Token Info | YES | Sitemap | PARTIALLY REVIEWED via grep |
| P-017 | /sdk.html | sdk.html | (unread) | SDK Reference | YES | Sitemap | UNREAD |
| P-018 | /explorer.html | explorer.html | (unread) | Explorer | YES | Sitemap | PARTIALLY REVIEWED via grep |
| P-019 | /connect.html | connect.html | (unread) | Connect | YES | Sitemap | UNREAD |
| P-020 | /ghost-witness.html | ghost-witness.html | (unread) | Ghost-Witness LNES-05 | YES (sitemap) | Footer | PARTIALLY REVIEWED |
| P-021 | /legal.html | legal.html | (unread) | Legal | YES (sitemap) | Footer | PARTIALLY REVIEWED |
| P-022 | /legal/index.html | legal/index.html | (unread) | Legal (duplicate?) | Unknown | Unclear | PARTIALLY REVIEWED |
| P-023 | /certificate_physical_presence.html | certificate_physical_presence.html | (unread) | Physical Presence Certificate | YES (sitemap) | Sitemap | UNREAD |
| P-024 | /orderbook.html | orderbook.html | (unread) | Orderbook | YES (sitemap) | Footer | PARTIALLY REVIEWED via grep |
| P-025 | /voice.html | voice.html | (unread) | Voice Stack | YES (footer) | Footer | UNREAD |
| P-026 | /journals.html | journals.html | (unread) | Journal | YES (footer) | Footer | UNREAD |
| P-027 | /apps.html | apps.html | (unread) | App Store | YES (footer) | Footer | UNREAD |
| P-028 | /space.html | space.html | (unread) | Live Space | YES (footer) | Footer | UNREAD |
| P-029 | /developers.html | developers.html | (unread) | Developer Keys | YES (footer) | Footer | UNREAD |
| P-030 | /footer.html | footer.html | N/A (HTML fragment) | Footer template | YES (sitemap — inappropriate) | Injected | REVIEWED |
| P-031 | /header.html | header.html | N/A (HTML fragment) | Header template | YES (sitemap — inappropriate) | Injected | UNREAD |

---

## Machine-Readable Files

| FILE_ID | PUBLIC_URL | SOURCE_FILE | PURPOSE | REVIEW_STATUS |
|---------|-----------|-------------|---------|---------------|
| M-001 | /.well-known/ai-plugin.json | .well-known/ai-plugin.json | ChatGPT / AI plugin manifest | REVIEWED — CRITICAL issue |
| M-002 | /openapi.yaml | openapi.yaml | OpenAPI schema | UNREAD |
| M-003 | /sitemap.xml | sitemap.xml | Search sitemap | REVIEWED |
| M-004 | /robots.txt | robots.txt | Crawl directives | REVIEWED |
| M-005 | /llms.txt | (not found in repo) | LLM discovery manifest (linked) | NOT FOUND IN REPO — BROKEN LINK |
| M-006 | /.well-known/exergynet.json | (not found in repo as separate file) | Protocol coordinates | NOT CONFIRMED IN REPO |

---

## Downloadable Artifacts

| FILE_ID | PATH | TYPE | STATUS |
|---------|------|------|--------|
| D-001 | exergynet-edge-witness-v1.5.apk | APK | Present in repo |
| D-002 | exergynet-edge-witness-v1.5.1.apk | APK | Present in repo |
| D-003 | exergynet-edge-witness-v1.5.2.apk | APK | Present in repo |
| D-004 | exergynet-edge-witness-v1.5.4.apk | APK | Present in repo |
| D-005 | developer-guide.md | Markdown | Present in repo |
| D-006 | lnes03_desktop_prover_tauri_scaffold.zip | ZIP | Present in repo |

---

## Broken/Missing Links Found

| LOCATION | LINK | STATUS |
|----------|------|--------|
| index.html "Read Benchmark Notes" | journal.html | FILE IS journals.html — BROKEN |
| index.html Core Systems "Edge Witness" | edge-witness.html | FILE IS lnes06.html — BROKEN |
| index.html Machine Interfaces | agents.html | FILE NOT FOUND IN REPO — BROKEN |
| index.html Machine Interfaces | llms.txt | NOT CONFIRMED IN REPO |
| index.html Network Details | .well-known/exergynet.json | NOT CONFIRMED AS SEPARATE FILE |
| whitepaper.html | journal.html (not linked but) | Benchmark link on index goes to journal.html |
| sitemap.xml | footer.html, header.html | Template fragments should not be in sitemap |

---

## Pages Not Yet Fully Read

Due to file size limits and the scope of this audit, the following pages were assessed only through grep searches and not full reads: mcp.html, docs.html, protocol.html, enterprise.html, faq.html, api-integration.html, nodes.html, security.html, roadmap.html, token.html, sdk.html, explorer.html, connect.html, ghost-witness.html, legal.html, certificate_physical_presence.html, orderbook.html, voice.html, journals.html, apps.html, space.html, developers.html, lnes06.html (475KB — too large to read in one pass).

The full audit would require reading each of these files in full. Claims identified via grep are included in WEBSITE_CLAIM_AUDIT.md with a REQUIRES_FULL_READ flag.
