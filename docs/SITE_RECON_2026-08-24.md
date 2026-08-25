# ExergyNet Site Recon — 2026-08-24

**Scope:** Full public surface of the canonical live repo `Downloads/exergynet` (the git repo
with the freshest `security.html`, 2026-08-23, and active working tree). The sibling folders
`exergynet-site-rebase` and `exergynet-site-rebase (1)` are older identical snapshots
(commit `4c416f8`, 2026-08-14) and are **not** the deployment target.

**Method:** metadata pulled from every page; anchor pages (`security`, `index`, `header`,
`footer`, `main.js`) read in full; sitewide greps for the directive §10/§14/§15 terminology;
claims cross-checked against the evidence base listed in `SITE_NARRATIVE_CANON.md`.

Severity: **P0** misleading/incorrect/unsafe · **P1** major narrative conflict · **P2** stale
terminology · **P3** polish/consistency.

---

## A. Complete page inventory (route inventory)

**Real public pages (37):** api-integration, apps, benchmarks, call-test, certificate_physical_presence,
connect, developers, docs, enterprise, explorer, explorer-solana, faq, ghost-witness, index,
journals, legal (+ `legal/index.html` duplicate served at `/legal/`), lnes06, machines, mcp,
nodes, omega-carrier, orderbook, proof, protocol, roadmap, sdk, security, space (+ `space/index.html`),
space-listen, token, vanguard, vmn, voice, whitepaper, x402-security-brief.

**Injected partials:** `header.html`, `footer.html` (loaded by `assets/main.js`).

**Discovery/meta:** `sitemap.xml` (32 URLs), `robots.txt`, `llms.txt`,
`.well-known/exergynet.json`, `.well-known/ai-plugin.json`, `.well-known/mcp/server-card.json`.

**Orphan duplicates (byte-identical download copies — REMOVE):** `omega-carrier (1).html`,
`proof (1).html`, `vanguard (1).html`, `whitepaper (1).html`, `x402-security-brief (1).html`.

**Non-page noise (ignore):** `integration_strike/node_modules/**`, `lnes117-visual-validation/node_modules/**`,
`lnes03_desktop_prover/**/ui/index.html` (bundled app UI, not a website page).

### Route ↔ sitemap ↔ nav reconciliation
- **Sitemap dead entries:** none (all resolve).
- **Exists but not in sitemap:** `x402-security-brief.html` (linked from homepage — SEO gap, add),
  `call-test.html` (test artifact — should not be public), `space-listen.html` (orphan).
- **Header nav (top-level IA):** Benchmarks · Vault · Vanguard · Omega Carrier · Security · Build ·
  Docs · Protocol · Nodes. **VMN, MCP, SDK absent from top nav** despite being key surfaces.
- **Footer nav:** comprehensive (links nearly all pages).
- **Architectural era per page** (why the site "describes different ExergyNets"):
  - *Newest — substrate / Consequence Boundary:* security, proof, omega-carrier, developers, (index body).
  - *Middle — AI Memory Control Plane / xLMP:* index (top-level framing), benchmarks, vmn, whitepaper, vanguard (hero only).
  - *Oldest — decentralized compute marketplace / PoX / $EXG / Solana membrane:* protocol, nodes, sdk, token, apps, machines, api-integration, faq, orderbook, enterprise, docs, mcp, vanguard (body).

## B. Current primary claim per page (condensed)

| Page | Current primary claim | Era |
|---|---|---|
| index | "AI Memory Control Plane" (title/hero) over a mostly-migrated body | Middle→New |
| security | "The Consequence Boundary" — machine authority control | **New (anchor)** |
| vanguard | Hero: "Reasoning & Execution Coordination"; body: direct-GPU/Neural-Engine/zero-retention | New hero / Old body |
| vmn | "Local AI Memory via MCP", "no cloud/vector DB/embedding drift", per-segment Groth16 | Middle |
| developers | State/evidence/provenance/Vanguard/authority build path | New |
| proof | "Verification & evidence receipts … without overclaiming" | New |
| benchmarks | "Measured AI Memory Results" (bounded) | Middle |
| omega-carrier | "Persistent memory transport; portability ≠ authority" | New |
| protocol | "LNES-06 … Unidirectional Sump, PoX, ZK-STARK on Solana; recursive O(1) master proof" | Old |
| sdk | "TypeScript interface to LNES-03 Unidirectional Membrane on Solana Mainnet-Beta" | Old |
| mcp | "MCP Neural Gateway … Ed25519 authenticated compute access" | Old/mixed |
| nodes | "Join the decentralized swarm … earn USDC/SOL" | Old |
| enterprise | **"Absolute Truth for the Autonomous Enterprise"** | Old |
| voice | "100% HIPAA compliant. Zero third-party API leakage." | Old |
| ghost-witness | **"The first cryptographic truth layer for AI agent conversations"** | Old |
| token | "$EXG Token Physics … not a speculative token" | Old |
| machines | "trust layer for autonomous machines … PoX verified" | Old |
| apps | "App Store … on-chain-billed apps inside the ExergyNet OS" | Old |
| api-integration | "decentralized compute network … biotech SaaS to ZK-verified pharma sim; 30% USDC yield; permissionless DePIN" | Old |
| docs | "Build Agents Bound by Physical Truth" | Old |
| faq | PoX / LNES-03 Membrane / $EXG mechanics | Old |
| roadmap | "Phase 8 complete, 9 active, 10 planned" | Mixed |
| legal | "not a corporation … a sovereign mathematical physics engine … decentralized protocol" | Old |
| whitepaper | "White Paper Coming Soon" | Placeholder |
| orderbook | "deterministic 10-vector job pricing matrix" | Old |
| explorer / explorer-solana | L0 explorer, "ZK-STARK VERIFIED" testnet rows | Old |
| lnes06 | Edge Witness + Desktop Prover physical pipeline | Mixed (accurate) |
| certificate_physical_presence | verifiable physical presence certificate | Mixed |

## C. Contradictions (cross-page, P0/P1)

1. **Legal entity — P0.** `index.html` JSON-LD `"ExergyNet Corp"` (Organization) vs
   `legal.html`/`legal/index.html` "ExergyNet is not a corporation … a sovereign mathematical
   physics engine." Unresolved open item in `CLAIM_LEDGER.md`. **Human/legal review required.**
2. **Settlement liveness — P1.** `docs.html:225` "Settlement recorded as **ZK-STARK VERIFIED on
   Base Mainnet**" and multiple "immutable on Base L2 / ZK-STARK VERIFIED" strings vs the honest
   amber banners on the same pages and `ai-plugin.json` ("not a Groth16 or ZK-STARK proof …
   under development"). Body copy contradicts the page's own status notice.
3. **ZK proof reality — P1.** `vmn.html` / `roadmap.html` "each memory segment … Groth16-settled
   on-chain" vs `CLAIM_LEDGER.md` NOT CLAIMED: "Every Vault query is ZK-proven" (sync path = SHA-256).
4. **Vanguard identity — P1.** New hero ("keeps memory, reasoning, and consequence authority in
   separate lanes") vs same page's legacy "Direct GPU kernel invocation" / "Vanguard Neural Engine".
5. **Footer status — P2.** `footer.html` now says "LNES-03 · Solana Mainnet · Investigating"
   (honest) but the `main.js` fallback footer still hardcodes "LNES-03 · Solana · Live".
6. **Top-level identity — P1.** Home/benchmarks/llms.txt/exergynet.json still frame **"AI Memory
   Control Plane" as the category (Level 1)**; security/developers/proof already frame the
   substrate. Site describes two different top-level things.

## D. Stale architecture (positioned as identity, should be subsystem/rail)

- "AI Memory Control Plane" as the **top-level** identity (index, benchmarks, llms.txt, exergynet.json, benchmarks JSON-LD `applicationCategory`).
- "decentralized protocol" / "sovereign mathematical physics engine" (legal).
- "physical compute mesh" / "Build Agents Bound by Physical Truth" (docs, protocol, machines).
- "Vanguard Neural Engine" / "direct GPU kernel invocation" (vanguard).
- PoX / Unidirectional Sump / $EXG framed as the definition of ExergyNet (protocol, token, faq, nodes).
- `mcp/server-card.json`: "Deterministic ZK-Compute … onchain_settlement" with `zk_proofs`/`onchain_settlement` capabilities.

## E. Stale product claims (P0/P1 overclaims)

| # | Page:loc | Claim | Problem | Sev |
|---|---|---|---|---|
| E1 | enterprise.html:11,42 | "Absolute Truth for the Autonomous Enterprise" | §14 "absolute"; unsupportable | P0 |
| E2 | voice.html:18,450 | "100% HIPAA compliant. Zero third-party API leakage." | §14 "100%"/"zero"; HIPAA can't be self-certified absolute | P0 |
| E3 | vanguard.html:196,286 | "Zero-Retention Session Policy … as if it never existed" | prod logs to Postgres (VAULT_LEDGER) — unsupported "zero" | P0 |
| E4 | ghost-witness.html:11 | "The first cryptographic truth layer" | §14 "first"; LNES-05 UNVERIFIED in ledger | P0 |
| E5 | docs.html:225 | "ZK-STARK VERIFIED on Base Mainnet" | mainnet verifier MOCK / no real settlement | P0 |
| E6 | vmn.html:468,486 | per-segment "Groth16-settled on-chain" | contradicts NOT-CLAIMED ledger | P1 |
| E7 | protocol.html:247,269,433 | "recursive O(1) master proof" | §14 O(1); FRI 1-query only, FFLONK blocked | P1 |
| E8 | enterprise.html:155 | "ZK-STARK guarantees — inference proven correct" | integrity ≠ correctness | P1 |
| E9 | api-integration.html:802,378,410 | "permissionless DePIN … 30% USDC yield … proof immutable on Base L2" | testnet/mock; yield economics unproven | P1 |
| E10 | enterprise.html:70 | "AWS / GCP … you must blindly trust … single point of failure" | §15 competitor claim | P2 |

## F. Technical claims requiring verification (before they may stay/expand)

- Every benchmark number on benchmarks.html (spot-checked vs `CLAIM_LEDGER.md`; deep read pending).
- Voice stack "1.24s round-trip" (voice.html) — envelope/source not yet located.
- Orderbook "deterministic 10-vector job pricing matrix" — implementation reality unverified.
- Explorer live-data rows — confirm they are labeled testnet/synthetic (they are, "Base Sepolia").
- `machines.html` autonomous-machine claims — must not imply FAA/physical-AI capability (currently doesn't).

## G. Broken links / routes

- No dead sitemap entries. Full local-link crawl **pending** (post-edit verification step, directive §23).
- `x402-security-brief.html` linked from homepage but missing from sitemap.
- `legal.html` (footer link) vs `/legal/` = `legal/index.html` (ai-plugin.json `legal_info_url`) — two legal pages; pick one canonical.

## H. Conflicting network / protocol information

- **P0 internal IP leak:** `protocol.html:288` publishes `18.209.174.113 (AWS EC2 — Alpha)` —
  a (now-stale) internal host IP. Directive §23 prohibits internal IPs on the public site. Remove.
- "Solana + Base … economic finality" (index) vs Solana LNES-03 settlement **FAILING** and mainnet
  ZK verifiers **MOCK** — bound the finality claim.
- `mcp/server-card.json` "Solana/Base blockchain compute settlement with LNES-01" — LNES-01 not in canon.

## I. Conflicting production / testnet status

- Old-era pages carry an honest amber "ZK-STARK compute settlement is operating in testnet mode"
  banner (good), but body text on the same pages still asserts "VERIFIED"/"immutable"/"Mainnet".
- "Base LNES-04 · Live" (footer) is defensible for the deployed membrane, but on-chain ZK
  *settlement* is mock — keep the distinction (deployment ≠ enforcing verifier).

## J. SEO / metadata contradictions

- Titles/OG/Twitter/JSON-LD across index, benchmarks split between "AI Memory Control Plane" and
  the substrate narrative.
- `benchmarks.html` JSON-LD `applicationCategory: "AI Memory Control Plane"` (stale category).
- JSON-LD org name "ExergyNet Corp" (unresolved entity name — see C1).
- "Coming Soon" strings in titles/CTAs (whitepaper, index ×3, benchmarks ×2) — §14 placeholder language.
- `sitemap.xml` uses `https://www.sitemaps.org/...` namespace (convention is `http://`).

## K. Recommended page role
See `SITE_NARRATIVE_CANON.md` §14 (page responsibilities) — adopted as the target IA.

## L. Exact migration priority
See `SITE_PAGE_MIGRATION_MATRIX.md`. Summary order (directive §21):
**P0** factual/safety fixes (IP leak, absolute/100%/zero/first overclaims, mainnet-settlement wording,
legal contradiction flag, orphan-dupe removal, mcp server-card) →
**P1** homepage top-level narrative, Vanguard, Docs/SDK/MCP, legal consistency →
**P2** VMN/Vault/Omega/AERIS/Edge Witness/protocol/proof, benchmarks framing, ghost-witness →
**P3** SEO/OG/Twitter/JSON-LD, nav labels, CTA consistency, sitemap.

---

## Open factual questions for the operator (unresolved — do not guess in copy)
1. Legal entity name ("ExergyNet" vs "ExergyNet Corp" vs other) — blocks C1 resolution.
2. `legal.html` vs `legal/index.html` — which is canonical for `/legal/`?
3. Voice stack "1.24s round-trip" source/envelope.
4. Should `call-test.html` / `space-listen.html` be public at all, or removed?
5. Whitepaper: keep an honest "preview / in preparation" page, or a dated publication target?
   (Canonical LWP is internal `AI_MEMORY_CONTROL_PLANE.md`, not the public `whitepaper.html`.)
