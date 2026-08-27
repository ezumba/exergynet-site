# SEO and Metadata Audit
**Audit:** Pre-White Paper Website Claim Audit — ExergyNet
**Audit date:** 2026-08-05
**Constraint:** READ-ONLY
**Note:** Full reads of all HTML meta tags were not performed; this audit is based on page title tags, structural review of fully-read pages, and grep findings.

---

## 1. Domain and Indexing

| ITEM | STATUS | NOTES |
|------|--------|-------|
| robots.txt | `User-agent: * / Allow: /` — all pages indexable | Appropriate for public site |
| CNAME | `exergynet.org` — correct | Verified |
| Sitemap | sitemap.xml present | 24 URLs listed, but 11 real pages missing; 2 template fragments incorrectly included — see MEDIUM-002 |
| HTTPS | Assumed via GitHub Pages | Standard |

---

## 2. Page Title Inventory (From Fully-Read Pages)

| PAGE | TITLE TAG |
|------|-----------|
| index.html | "ExergyNet \| Sovereign Memory and Verifiable Compute" |
| whitepaper.html | "Sovereign Memory & Verifiable Compute \| ExergyNet" |
| vanguard.html | "Vanguard Engine \| ExergyNet — Enterprise AI Inference" |
| omega-carrier.html | "Omega Carrier — MCP Bridge for Stateful AI Agents" |
| proof.html | "On-Chain Proof \| ExergyNet" |
| protocol.html | "ExergyNet LNES-06 Protocol" |

---

## 3. Category Positioning Consistency

**Canonical category claim (from AI_MEMORY_CONTROL_PLANE.md):**
> "xLMP is the first AI Memory Control Plane — a distinct software category above RAG, below model architecture, that makes AI memory independently verifiable."

**Website category positioning:**
- `index.html` title: "Sovereign Memory and Verifiable Compute" — aligns with prior framing, NOT the new "AI Memory Control Plane" category claim
- `whitepaper.html` title: "Sovereign Memory & Verifiable Compute" — same prior framing
- `vanguard.html` title: "Enterprise AI Inference" — correct for that product
- `omega-carrier.html` title: "MCP Bridge for Stateful AI Agents" — correct framing

**Finding:** The canonical paper's primary category claim — "AI Memory Control Plane" — does not appear in any current page title, meta description, or header text on any fully-read page. "Sovereign Memory and Verifiable Compute" is the old framing that predates the category-positioning strategy.

**Impact:** When the white paper is published and the category claim goes public, the SEO metadata will need updating to reflect "AI Memory Control Plane" as the primary search anchor. This is a pre-publication SEO task, not a blocker for the audit.

---

## 4. Machine-Readable Category Claims

### ai-plugin.json
- `"name_for_human": "ExergyNet Memory"` — adequate
- `"description_for_human": "Trustless, Zero-Knowledge verified off-chain compute for AI agents."` — FALSE per CRITICAL-001
- `"description_for_model"`: "Returns a Groth16 cryptographic proof of execution." — FALSE per CRITICAL-001
- Category claim in plugin: positions as "trustless ZK compute" rather than "AI Memory Control Plane" — wrong category for the category-play strategy

### openapi.yaml (unread)
- OpenAPI description field and operationId strings may also contain ZK/Groth16 claims. This file was not read in this audit.
- **Required action:** Read openapi.yaml and audit all description strings for consistency with CRITICAL-001 fix.

---

## 5. Social / OG Metadata

Pages fully read did not expose `<meta property="og:...">` content. A full metadata audit would require reading the `<head>` section of each page. Social preview cards are common claims surfaces that often lag behind main content updates.

**Required before press/media distribution:** Read OG/Twitter Card metadata on:
- index.html
- whitepaper.html (or its replacement)
- vanguard.html

These pages are most likely to be shared by press. OG images and descriptions must match the corrected content post-publication.

---

## 6. Structured Data

No JSON-LD or Schema.org structured data was identified in fully-read pages. This is a neutral finding — no false structured-data claims, but also no SEO benefit from rich snippets.

---

## 7. SEO Issues Summary

| ISSUE | SEVERITY | REQUIRED BEFORE |
|-------|----------|----------------|
| ai-plugin.json false ZK category claim | CRITICAL | Any publication (see CRITICAL-001) |
| "AI Memory Control Plane" absent from page titles | MEDIUM | White paper publication |
| "Sovereign Memory and Verifiable Compute" in index/whitepaper titles (old framing) | MEDIUM | White paper publication |
| openapi.yaml description strings unreviewed | MEDIUM | Any publication |
| Sitemap missing 11 real pages | MEDIUM | SEO campaign |
| Sitemap including fragment pages | LOW | SEO campaign |
| OG/social metadata unreviewed | LOW | Press/media distribution |
| No structured data | NEUTRAL | Not blocking |
