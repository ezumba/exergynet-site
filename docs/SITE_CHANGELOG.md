# ExergyNet Site Changelog

Ground source of truth for public-website changes under the 2026-08-24 sitewide narrative
migration. **Append chronologically; never overwrite history.** Newest entries at the bottom
of each dated section. Every material action records: timestamp · file · previous framing ·
new framing · reason · evidence/reference · test performed · result · unresolved issue.

Companion docs: `SITE_NARRATIVE_CANON.md` (source of truth), `SITE_RECON_2026-08-24.md`
(findings), `SITE_PAGE_MIGRATION_MATRIX.md` (per-page plan).

---

## 2026-08-24

### Recon phase (no site edits)
- **Files:** created `docs/SITE_NARRATIVE_CANON.md`, `docs/SITE_RECON_2026-08-24.md`,
  `docs/SITE_PAGE_MIGRATION_MATRIX.md`, this changelog.
- **Previous framing:** site described ExergyNet as ≥8 different things across eras
  (AI Memory Control Plane, decentralized protocol, physical compute mesh, ZK-compute
  marketplace, etc.).
- **New framing:** single canon — "persistent state, evidence, and authority substrate for
  autonomous intelligence"; xLMP/memory demoted to a subsystem; status vocabulary unified.
- **Reason:** directive §1–§20.
- **Evidence:** `PUBLIC_SECURITY_CLAIM_MATRIX.md`, `CLAIM_LEDGER.md`, `SUBSYSTEM_STATUS_MATRIX.md`,
  `VAULT_LEDGER.md`, sitewide greps.
- **Test performed:** enumerated 37 pages + partials + meta; read anchor pages + shared
  components in full; grepped §10/§14/§15 terminology; reconciled routes↔sitemap↔nav.
- **Result:** recon complete; migration authorized to begin (P0 first).
- **Unresolved:** legal entity name; legal.html vs legal/index.html canonical; voice 1.24s
  source; whitepaper publication plan; call-test/space-listen public status. (See recon §Open.)

### P0 migration pass — factual/safety fixes

**P0-01 · Internal IP leaks removed (directive §23).**
- Files: `protocol.html` (×3: network pill, Host spec, routing text), `nodes.html` (×2: Apex Router spec, CLI example), `lnes06.html` (TURN relay), `voice.html` (signal-panel tag).
- Previous: published `18.209.174.113` (stale internal AWS EC2 Alpha IP) and `20.127.220.199` (AskMo Azure host).
- New: raw IPs removed; replaced with public hostnames (`explorer-api.exergynet.org`), a Portal-provisioned reference, an `$APEX_ROUTER` env var, or a neutral label (`NODE 1 · ON-PREM`).
- Reason: internal host IPs must never appear on the public site; the leaked IP was also stale (host moved to a non-published address per VAULT_LEDGER).
- Evidence: `VAULT_LEDGER.md` Infrastructure/Network table. Test: `grep` for all known infra IPs across `*.html` → **0 remaining**. Result: ✓.

**P0-02 · "Absolute Truth" and competitor/correctness overclaims — enterprise.html.**
- Previous: H1 "Absolute Truth for the Autonomous Enterprise"; meta "Absolute truth…"; "AWS/GCP … you must blindly trust … single point of failure"; "ZK-STARK guarantees — inference proven correct".
- New: H1 "Verifiable Execution for the Autonomous Enterprise"; substrate meta; competitor line reframed to an architectural gap (no attack); correctness claim bounded to execution-integrity ("proves execution integrity, not that the conclusion is correct").
- Reason: §14 (no "absolute"), §15 (competitor language), integrity ≠ correctness. Evidence: Canon §9–10. Result: ✓.

**P0-03 · "100% HIPAA / Zero third-party API leakage" — voice.html.**
- Previous: meta + hero "100% HIPAA compliant. Zero third-party API leakage."
- New: architectural description — "on-premise processing with no third-party API calls in the speech path — supporting HIPAA-aligned deployments."
- Reason: §14 ("100%"/"zero" absolutes); HIPAA compliance is not self-certifiable as absolute. Result: ✓. Unresolved: "1.24s round-trip" source still to verify.

**P0-04 · Legacy GPU marketing + absolute "zero retention" — vanguard.html.**
- Previous: "Direct GPU kernel invocation" / "Direct kernel path"; "01 / ABSOLUTE IP SOVEREIGNTY"; "Zero-Retention Session Policy"; stat "Zero"; "as if it never existed"; footer "Vanguard Neural Engine · Sovereign AI Infrastructure".
- New: "Model selection → execution routing" / "Low-overhead execution path"; "IP SOVEREIGNTY"; "Stateless Session Policy"; stat "Stateless"; "not retained after the session ends"; footer "Vanguard · Reasoning & Execution Coordination".
- Reason: §11 (drop legacy direct-GPU marketing), §14 ("absolute"/"zero"). Evidence: `CLAIM_LEDGER.md` — vanguard-pro GPU NOT operational (CPU fallback, BLK-012). Result: ✓. Note: competitor comparison table + OpenAI-compatible section retained (factual) — full body reframe pending (P2).

**P0-05 · "First cryptographic truth layer" / "permanently" / unverified SGX — ghost-witness.html.**
- Previous: meta "The first cryptographic truth layer…"; "anchored permanently on Base L2"; "Intel SGX enclave with zero data retention".
- New: "research-stage consistency-checking layer"; scoped to internal-consistency-not-external-truth; "anchored on Base L2"; SGX claim removed, replaced with stateless-session-policy wording.
- Reason: §14 ("first"/"permanent"); LNES-05 UNVERIFIED (SUBSYSTEM_STATUS_MATRIX); SGX unverified in evidence base. Result: ✓. Note: H1 hook + full CLC reframe pending (P2).

**P0-06 · "ZK-STARK VERIFIED on Base Mainnet" — docs.html.**
- Previous: code comment "// Settlement recorded as ZK-STARK VERIFIED on Base Mainnet".
- New: "recorded on L0 ledger (Base Sepolia testnet); on-chain ZK proof verification is in development — see proof.html".
- Reason: mainnet FFLONK verifier is MOCK/fail-open; no real mainnet ZK settlement. Evidence: `VAULT_LEDGER.md` (mainnet SovereignVerifier MOCK), `CLAIM_LEDGER.md` NOT-CLAIMED. Result: ✓.

**P0-07 · main.js fallback footer.**
- Previous: fallback footer hardcoded "LNES-03 · Solana · Live" + tagline "Sovereign ZK-Compute for Autonomous Agents".
- New: "LNES-03 · Solana Mainnet · Investigating" + tagline "Persistent State, Evidence & Authority for Autonomous Intelligence".
- Reason: match corrected `footer.html` (Solana settlement failing) + substrate tagline. Result: ✓ (fires only on footer.html fetch failure).

**P0-08 · Stale MCP server-card — .well-known/mcp/server-card.json.**
- Previous: "Deterministic ZK-Compute … onchain_settlement with LNES-01"; capabilities `["compute_jobs","zk_proofs","onchain_settlement"]`.
- New: substrate description; capabilities `["persistent_memory","bounded_evidence_retrieval","provenance_receipts","authority_scoped_tools"]`; honest ZK-in-development note.
- Reason: §16 status discipline; overclaimed zk/settlement capabilities. Evidence: Canon §5, `ai-plugin.json` (already honest). Result: ✓.

**P0-09 · Orphan duplicate pages removed (hygiene).**
- Deleted byte-identical download duplicates: `omega-carrier (1).html`, `proof (1).html`, `vanguard (1).html`, `whitepaper (1).html`, `x402-security-brief (1).html` (diff-confirmed identical; not in sitemap or nav). Reversible via git. Result: ✓.

**NOT changed — flagged for human/operator (no copy edit made):**
- Legal entity contradiction ("ExergyNet Corp" JSON-LD vs `legal.html` "not a corporation / sovereign mathematical physics engine"). Legal-substance change — human/legal review required before deploy (directive §11, §24).

**Still pending (per SITE_PAGE_MIGRATION_MATRIX):**
- P1: homepage top-level identity (title/hero/OG/JSON-LD "AI Memory Control Plane" → substrate); vanguard full body + competitor table; docs/sdk/mcp capability-first IA; legal consistency (gated).
- P1 overclaims not yet done: vmn per-segment Groth16 (E6); protocol "recursive O(1) master proof" (E7); api-integration DePIN/30% yield/immutable (E9).
- P2: vmn/vault/omega/aeris/edge-witness/protocol/proof/nodes/token/apps/faq/roadmap/benchmarks framing; ghost-witness full reframe; llms.txt + exergynet.json top-level identity.
- P3: SEO/OG/Twitter/JSON-LD; "Coming Soon" CTAs; nav labels; footer tagline; sitemap (add x402-security-brief, fix namespace, drop call-test).

**Post-edit verification: partial** (edited-file sanity only). Full sitewide render/link/SEO audit (directive §23) to run after P1/P2 copy is complete.

### P1 migration pass — top-level narrative

**P1-01 · Homepage top-level identity — index.html.**
- Previous: title/hero/OG/Twitter/JSON-LD framed "AI Memory Control Plane" as the Level-1 identity; hero "AI Memory Should Be Controlled, Not Replayed."
- New: substrate identity — title "State, Evidence & Authority Infrastructure for Autonomous Intelligence"; hero "Models Reason. ExergyNet Is the System Around Them."; sub "A persistent state, evidence, and authority substrate…"; xLMP explicitly "one plane of it"; OG/Twitter/JSON-LD aligned. Strong body (trust table, planes, Consequence Boundary, bounded benchmarks) retained. Primary CTA now → Consequence Boundary.
- Reason: §4 (new top-level thesis), §12 (hierarchy). Evidence: Canon §1–3. Note: JSON-LD `"name":"ExergyNet Corp"` left unchanged (entity name is human-gated).

**P1-02 · "Coming Soon" placeholder CTAs — index.html, benchmarks.html, whitepaper.html.**
- Previous: "White Paper - Coming Soon" (index ×3, benchmarks ×2); whitepaper title/hero "White Paper Coming Soon".
- New: "White Paper (Preview)"; whitepaper title "White Paper (Preview) - xLMP", eyebrow "White Paper · In Preparation".
- Reason: §14 (no "coming soon" placeholder). Canonical LWP remains the internal `AI_MEMORY_CONTROL_PLANE.md`; the public page is an honest preview.

**P1-03 · Vanguard full body — vanguard.html.**
- Previous: competitor comparison table (OpenAI/Anthropic/AWS Bedrock with specific retention windows, pricing "$15–$60", "trains on your data", "always active"); "AI Memory Control Plane" in hero-sub/og; "direct kernel"; two "absolute" instances.
- New: table replaced with a self-describing Vanguard capability table (stateless policy, model independence, OpenAI-compatible surface, evidence handling, authority) — no competitor attacks; "state plane" wording; "absolute" removed; OpenAI-compatible integration section (factual) retained.
- Reason: §11 (Vanguard = orchestration, not legacy marketing), §15 (competitor language), §14. Evidence: Canon §5–6, CLAIM_LEDGER (BLK-012).

**P1-04 · Developer surfaces capability-first — sdk.html, mcp.html, docs.html.**
- sdk: was entirely the legacy Solana-membrane SDK. New: leads with a "Start Here — Current Surfaces" grid (VMN / MCP / Vanguard API / ElizaOS, each LIVE), and the Solana `exergynet-agent-sdk` section relabeled **Legacy** with a settlement-liveness caveat.
- mcp: "MCP Neural Gateway / physical compute mesh" → "MCP Gateway / access to the ExergyNet substrate — memory, evidence, authority-scoped tools" (title/meta/hero); Ed25519 handshake mechanics retained.
- docs: hero "Build Agents Bound by Physical Truth" → "Build Agents on State, Evidence & Authority" with the capability path; "sovereign compute", "MCP Neural Gateway", "ZK-STARK verified physical truth" reframed.
- Reason: §11 (SDK/Docs capability-first; separate current/legacy), §10. Evidence: Canon §11, §14.

**P1-05 · Remaining P1 overclaims.**
- vmn.html (E6): per-segment "Groth16-settled on-chain" → "designed to issue RISC Zero receipts with on-chain Groth16 verification (in development)"; "Coming Soon" tier labels → "Planned"; teaser bounded to the single-object EVD-011 reality. Evidence: CLAIM_LEDGER NOT-CLAIMED.
- protocol.html (E7): "recursive O(1) master proof" (×2) + "compresses proofs into O(1) ZK-STARK Master Proof" → "recursive proof aggregation (in development)". Also reframed protocol meta/hero to "interfaces connecting the planes; settlement rails beneath" (§11) and Solana pill → "Settlement Investigating". Evidence: CLAIM_LEDGER (O(1) NOT-CLAIMED; FRI 1-query only).
- api-integration.html (E9): "permissionless DePIN … 30% USDC yield", "proof is immutable on Base L2", "FDA-compliant audit trail" → testnet-bounded wording; meta "decentralized compute network" → "ExergyNet substrate".

### P2 migration pass — subsystem framing & machine canon

**P2-01 · Machine-readable canon — llms.txt, .well-known/exergynet.json.**
- Previous: xLMP = "AI Memory Control Plane" as the category (Level 1).
- New: substrate identity + architectural planes + xLMP as a component; explicit claim policy (sync query = SHA-256 not ZK; policy gate = shadow mode; xISA = research-validated; whitepaper = PREVIEW). Reason: §4, §16, §17.

**P2-02 · Old-era page identity metas — nodes, api-integration, machines, apps, benchmarks.**
- nodes: "decentralized swarm / physical mesh" → operator role under the substrate; settlement-liveness caveat added.
- benchmarks: JSON-LD `applicationCategory` "AI Memory Control Plane" → "DeveloperApplication"; description + twitter framed as "xLMP, the persistent-memory plane of the ExergyNet substrate". Bounded numbers unchanged (all trace to CLAIM_LEDGER).
- machines / apps: metas reframed from "trust layer / ExergyNet OS" to substrate application framing (kept as Level-5 use cases; no FAA/physical-AI claims introduced).

**P2-03 · Ghost-Witness residual overclaim — ghost-witness.html.**
- "The verdict is permanent and tamper-proof on Base L2" → "anchored on Base L2, where it is tamper-evident"; reinforced internal-consistency-not-external-truth scope. Reason: §14.

### P3 migration pass — SEO, nav, sitemap, hygiene

**P3-01 · footer.html + certificate/lnes06 inline footers tagline** → "Persistent State, Evidence & Authority for Autonomous Intelligence" (was "Verifiable Compute & Physical-World Proof" / "Sovereign ZK-Compute").
**P3-02 · sitemap.xml** → namespace fixed to `http://`; added `x402-security-brief.html` (linked from homepage but missing). 33 entries, no duplicates.
**P3-03 · Broken links (§23)** → `presence.html` (dead) → `certificate_physical_presence.html` on certificate_physical_presence.html and lnes06.html. Full crawl now shows **0 broken local links**.

### Final verification (directive §23)
- **Local links:** full href crawl across all pages → **0 broken**.
- **Internal IPs:** sitewide grep for all known infra IPs → **0 on public pages**.
- **Orphan dupes:** 5 `* (1).html` removed; **0 references** to them remain.
- **HTML sanity:** `<div>`/`</div>` balanced on all edited files (one pre-existing −1 in the minified `certificate_physical_presence.html`, not introduced by this migration; browsers auto-correct).
- **JSON:** exergynet.json / ai-plugin.json / mcp server-card.json all parse valid.
- **Overclaim sweep:** absolute/100%/zero/first/tamper-proof/direct-GPU/neural-engine → **0 on public pages** (remaining "mathematically final" is on-chain-irreversibility language on the human-gated legal page).
- **Render:** index.html and vanguard.html served over http → correct new hero copy, header/footer inject, **0 console errors**.

### Still open / not changed (human action required)
- **legal.html / legal/index.html** — "decentralized protocol", "sovereign mathematical physics engine", "not a corporation", "mathematically final", "absolute legal responsibility" **left intact**; contradicts homepage JSON-LD "ExergyNet Corp". Legal substance — **flagged for human/legal review before deploy** (§11, §24). Not edited.
- Legal entity name resolution (blocks JSON-LD `name` correction).
- voice "1.24s round-trip" source; whitepaper publication target; call-test/space-listen public status; canonical `/legal/` page choice.
- Deeper body-copy reframes on token/faq/orderbook/journals bodies (identity metas aligned; bodies retain accurate technical/PoX content per §22 — PoX correctly framed as a verification primitive, not the identity).
