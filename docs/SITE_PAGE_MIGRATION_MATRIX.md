# ExergyNet Site Page Migration Matrix — 2026-08-24

Derived from `SITE_RECON_2026-08-24.md` + `SITE_NARRATIVE_CANON.md`.
**No page is edited unless it appears here.** Priority per directive §21
(P0 factual/safety → P1 home/Vanguard/dev/legal → P2 subsystems/benchmarks → P3 SEO/polish).

Legend for actions: **Keep** = leave as-is · **Reframe** = rewrite framing, keep facts ·
**Remove** = delete claim/page · **Add** = new content/label.

> **Execution status (2026-08-24):** P0, P1, P2, and P3 passes executed and verified — see
> `SITE_CHANGELOG.md` for the itemized record and the final §23 verification results.
> **Not done (human-gated):** `legal.html`/`legal/index.html` legal-substance changes and the
> legal-entity-name resolution. Body-level reframes on a few Level-5 pages
> (token/faq/orderbook/journals) were scoped to identity/metadata; their accurate technical
> bodies were preserved per §22.

| Page | Keep | Reframe | Remove | Add | Evidence needed | Priority |
|---|---|---|---|---|---|---|
| **security.html** | Whole page (anchor) | — | — | Adopt its status vocab sitewide | none (reference) | Keep |
| **index.html** | Body (trust table, planes, Consequence Boundary, bounded benchmarks) | Top-level identity → substrate (§1); title/hero/OG/Twitter/JSON-LD | "Coming Soon" CTA text ×3; bound "economic finality" | Substrate one-liner; planes intro | Canon §1–3 | **P1** |
| **vanguard.html** | New hero; multi-model routing; OpenAI-compatible API surface (real) | Body → orchestration/model-selection/execution coordination | "Direct GPU kernel invocation"; "Vanguard Neural Engine"; "Zero-Retention … as if it never existed"; unsupported competitor table cells | Model-independence framing (§6); status labels | CLAIM_LEDGER (BLK-012 GPU fallback); VAULT_LEDGER (prod logging) | **P1** |
| **docs.html** | Endpoint/API mechanics | "Physical Truth" hero → capability-first dev path (§14) | "ZK-STARK VERIFIED on Base Mainnet" (E5) | Capability-first ordering: state→evidence→orchestration→authority→tools→verify→receipts | CLAIM_LEDGER (sync=SHA-256) | **P0/P1** |
| **sdk.html** | Real API reference | LNES-03/Solana-membrane framing → current SDK surface; label current/legacy/testnet/deprecated | Solana-Mainnet-Beta-only positioning if inaccurate | "Legacy" labels; VMN/MCP/Vanguard integration | Read sdk.html in full first | **P1** |
| **mcp.html** | MCP gateway mechanics | "Neural Gateway / compute access" → agent tooling over state/authority | overclaimed compute-settlement capability | Honest capability list | server-card reconcile | **P1** |
| **legal.html** + **legal/index.html** | Disclaimer intent | "sovereign mathematical physics engine / decentralized protocol" → accurate entity/service description | entity contradiction w/ JSON-LD | **HUMAN-REVIEW FLAG** | Operator: legal entity name (open item) | **P1 (gated)** |
| **enterprise.html** | Enterprise value props; testnet banner | "Absolute Truth" → bounded value (§10) | "Absolute" (E1); "blindly trust AWS/GCP" competitor jab (E10); "ZK-STARK guarantees inference correct" (E8) | Status labels | Canon §9–10 | **P0** |
| **voice.html** | On-prem/local-processing architecture; Whisper+Piper | "100% HIPAA / Zero leakage" → architectural description | "100%"; "Zero third-party API leakage" absolute (E2) | Bounded envelope for round-trip latency | Operator: 1.24s source | **P0** |
| **ghost-witness.html** | CLC concept as scoped app | "first cryptographic truth layer" → scoped reference/app surface | "first"; "truth layer" identity (E4) | RESEARCH/UNVERIFIED status label; "does not redefine parent" | SUBSYSTEM_MATRIX (LNES-05 unverified) | **P0/P2** |
| **vmn.html** | Local xLMP/MCP value; 60-sec deploy; npm v2.0.0 | per-segment "Groth16-settled" → honest receipt story | on-chain per-segment Groth16 claim (E6) | LIVE status; local-state role (§14) | CLAIM_LEDGER NOT-CLAIMED | **P2** |
| **protocol.html** | Interfaces/rules; endpoint tables | "definition of ExergyNet" → interfaces connecting planes; rails beneath | **`18.209.174.113` internal IP (H)**; "recursive O(1) master proof" (E7) | Rails-beneath framing | VAULT_LEDGER; CLAIM_LEDGER O(1) | **P0/P2** |
| **proof.html** | Honest verification framing | minor: tie to system verification property | — | receipts ≠ semantic truth callout (if absent) | read in full | P2 |
| **benchmarks.html** | Bounded numbers | JSON-LD category; "Coming Soon" CTAs; tie each metric to a proposition | stale "AI Memory Control Plane" category | proposition labels per metric | CLAIM_LEDGER §9 | **P2/P3** |
| **nodes.html** | Operator onboarding | "decentralized swarm/PoX identity" → operator role under substrate; keep testnet banner | overclaimed yields if unproven | status labels | read in full | P2 |
| **token.html** | $EXG accounting-unit honesty | de-emphasize as identity; rails-beneath | speculative framing (already disclaimed) | — | read in full | P2 |
| **machines.html** | M2M use case | "trust layer / PoX identity" → application of substrate | any physical-AI overreach (none present — keep out) | Level-5 app framing | ensure no FAA | P2 |
| **apps.html** | App-store concept | "ExergyNet OS" identity → application surface | on-chain-billing overclaim if unproven | status labels | read in full | P2 |
| **api-integration.html** | 4-step integration; honest banner (:943) | "permissionless DePIN / 30% yield / immutable" → bounded testnet | E9 overclaims | testnet labels | read in full | P2 |
| **faq.html** | Q&A format; testnet banner | PoX-centric answers → substrate-centric | "zero yield/absolute" phrasing | authority/state Q&A | read in full | P2 |
| **roadmap.html** | Phase structure | ZK/Groth16 items → PLANNED labels | — | status labels aligned to §8 | CLAIM_LEDGER PLANNED | P2 |
| **omega-carrier.html** | Whole page (already new; transport≠authority; model-independence) | minor status labels | — | — | none | Keep/P3 |
| **developers.html** | Whole page (already new) | — | — | — | none | Keep |
| **lnes06.html** | Edge Witness pipeline (accurate) | witness boundary framing (what is/ isn't witnessed) | — | evidence-boundary callout | none | P2/P3 |
| **certificate_physical_presence.html** | concept | scope to Edge Witness evidence boundary | universal "presence proof" overclaim if present | bounded language | read in full | P2/P3 |
| **explorer.html / explorer-solana.html** | testnet explorer | ensure testnet labels remain | — | — | none | P3 |
| **orderbook.html** | pricing-matrix concept | de-hype "absolute/only" strings (11 hits) | overclaims | bounded | read in full | P2/P3 |
| **journals.html** | blog/insights | sovereign-compute framing → substrate insights | — | — | none | P3 |
| **whitepaper.html** | preview content | "Coming Soon" title/hero → honest "in preparation / preview" | placeholder language (§14) | preview-status label | Operator: publication plan | **P1/P3** |
| **connect.html / space.html / space-listen.html / call-test.html** | app/utility pages | minor | consider removing call-test/space-listen from public if not intended | — | Operator decision | P3 |
| **header.html** | nav | add VMN/MCP/SDK grouping; tagline consistency | — | Security/Build ordering ok | — | P3 |
| **footer.html** | structure; corrected LNES-03 "Investigating" | tagline "Verifiable Compute & Physical-World Proof" → substrate tagline | — | — | — | P3 |
| **assets/main.js** | injection logic | — | fallback footer "LNES-03 · Solana · Live" → "Investigating" (C5) | — | footer.html parity | P2 |
| **llms.txt / .well-known/exergynet.json** | structure | xLMP=category → substrate identity + xLMP as component | stale category | planes/status policy | Canon §1–8 | P2/P3 |
| **.well-known/ai-plugin.json** | already honest | — | — | — | none | Keep |
| **.well-known/mcp/server-card.json** | — | "ZK-Compute/onchain_settlement" → memory+authority; honest capabilities | zk_proofs/onchain_settlement overclaim; LNES-01 | — | Canon §5 | **P1/P2** |
| **sitemap.xml** | URL set | — | — | add x402-security-brief; fix namespace; drop call-test | — | P3 |
| **`* (1).html` dupes** | — | — | **DELETE all 5 orphan duplicates** | — | diff-confirmed identical | **P0 (hygiene)** |

**Pending full reads before their edits:** sdk, proof, nodes, token, apps, api-integration, faq,
roadmap, orderbook, machines, certificate_physical_presence, benchmarks, whitepaper, vmn (body),
vanguard (body), voice, ghost-witness, legal.
