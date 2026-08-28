# External Propagation Changelog

**Directive:** VP Sales Directive 005, §26
**Purpose:** append-only audit trail of every attempted or completed external-surface mutation. Never log credentials.

---

## 2026-08-27 — Directive 005 initial pass

No external (third-party-hosted) surface was actually mutated this pass. All corrections identified were either (a) first-party surfaces already covered by the existing `docs/WEBSITE_CHANGELOG.md`, or (b) blocked by missing credentials/authorization, or (c) held pending operator review due to the critical finding in `MCP_EXTERNAL_SECURITY_REMEDIATION_2026-08-27.md`.

| Timestamp | Surface | Old wording | New wording | Controls surface? | Login/account used | Supporting source | Update status | Moderation pending? | Expected propagation | Live verification |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-27 | `github.com/ezumba/exergynet-mcp-server` (README, package.json, server.json, server-card.json, smithery.yaml, llms.txt) | "thermodynamic compute clearinghouse," EVM/USDC framing, `BASE_PRIVATE_KEY` required | Drafted, accurate-to-shipped-code correction — **NOT applied** | Git write access confirmed available (same credential resolves for this repo as `exergynet-site`) | n/a — not executed | `MCP_EXTERNAL_SECURITY_REMEDIATION_2026-08-27.md` §0 | **HELD** — resolving the retired-contract/source-mismatch finding takes priority over narrative polish; documenting a description before that resolution risks describing code that still won't match what ships | No | N/A until resolved | N/A |
| 2026-08-27 | npm `exergynet-mcp-server` package description/keywords | "MCP server for ExergyNet LNES-04 Base Mainnet autonomous compute settlement," keywords incl. `depin`, `usdc`, `machine-to-machine` | (same as above — held) | No npm publish credentials in this environment (`npm whoami` → `ENEEDAUTH`) | n/a | Registry JSON fetch, `npm pack` | **BLOCKED** (no credentials) + **HELD** (see above) | No | N/A | N/A |
| 2026-08-27 | Official MCP registry entry `io.github.ezumba/exergynet` | description "ExergyNet thermodynamic compute settlement for autonomous agents," version pinned at 0.1.10 | (would require a `server.json` republish via the registry's publish tooling) | No registry publish credentials in this environment | n/a | `registry.modelcontextprotocol.io` API | **BLOCKED** (no credentials) | No | N/A | N/A |
| 2026-08-27 | `exergynet-site` — `footer.html` line 54 | `https://github.com/exergynet` (dead — org does not exist, confirmed via GitHub API 404) | `https://github.com/ezumba/vanguard-memory-node` | Yes — same repo/credentials used for Directive 003/004 | git (existing credential manager entry, no secret logged) | GitHub API `users/exergynet` → 404; `users/ezumba/repos` → confirmed real repo | **Applied** (this pass's worktree commit) | No | Immediate on push | Pending this session's push |
| 2026-08-27 | `exergynet-site` — `roadmap.html` line 141 | `https://github.com/exergynet` (same dead link) | `https://github.com/ezumba/vanguard-memory-node` | Yes | git | Same as above | **Applied** | No | Immediate on push | Pending this session's push |
| 2026-08-27 | `exergynet-site` — `api-integration.html` prover-setup code sample | `git clone https://github.com/exergynet/moleculogic-prover` (repo confirmed 404 via GitHub API) | Removed the fake clone instruction; replaced with a note that the source isn't yet public and directs to `operators@exergynet.org` | Yes | git | GitHub API 404 confirmation | **Applied** | No | Immediate on push | Pending this session's push |
| 2026-08-27 | Crunchbase | N/A — no profile found | N/A | Unknown (no profile exists to claim/edit) | n/a | Search + direct-fetch attempts (403 on org pages checked) | **No profile found — nothing to correct**; recommend periodic re-check | N/A | N/A | N/A |
| 2026-08-27 | Paragraph article | N/A — not located | N/A | Unknown | n/a | Search did not locate an indexed URL | **Unconfirmed / not located** | N/A | N/A | N/A |
| 2026-08-27 | F6S | N/A — not located (bot-detection blocked direct site search) | N/A | Unknown | n/a | Search + blocked direct fetch | **Unconfirmed / not located** | N/A | N/A | N/A |
| 2026-08-27 | `metaldrug.com` (affiliated site) | "ExergyNet Secure Compute... 88.6% below centralized cloud rates" (unsourced specific figure, presented as live/operational) | Not corrected this pass — flagged for operator review | Unconfirmed whether this session has edit access to this separate site's repo | n/a | Direct fetch of metaldrug.com and its "Who We Serve" page | **FLAGGED, not corrected** — need to confirm control of this surface before editing | No | N/A | N/A |

## Credentials note

No credential values, tokens, or secrets are recorded anywhere in this file or any other Directive 005 deliverable. Where a credential's *existence* was confirmed (e.g. git's credential manager resolving a request for `github.com`), only that fact is noted — never the value.
