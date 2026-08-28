# MCP Distribution Propagation — 2026-08-28

**Directive:** VP Sales Directive 008 §4–§8, §18
**Purpose:** one place recording exactly what's wrong with each surface that describes ExergyNet's MCP software, exactly what fixes it, and exactly which fixes require the operator's own authentication versus which are already fully prepared and just waiting on that authentication.

**Governing fact:** the software itself is safe. `exergynet-mcp-server@0.2.4` is published, `latest`, and independently verified (see `MCP_INCIDENT_CLOSURE_2026-08-28.md`). Every item below is about surfaces that describe that software still presenting an older, retired write-enabled version rather than the current fail-closed release — not about any remaining defect in the software.

---

## 1. Official MCP registry (`registry.modelcontextprotocol.io`, `io.github.ezumba/exergynet`)

**Current live state (verified 2026-08-28):** version `0.1.10`. Lists `BASE_PRIVATE_KEY` as **required**, described as "Agent's Base L2 Hot Wallet Private Key (Hex)." This is not merely outdated — it actively tells a new integrator to configure a real signing key that the current safe package does not use or accept.

**Root cause:** the registry's only legitimate publish path is the `mcp-publisher` CLI — a binary distributed via GitHub Releases from `modelcontextprotocol/registry` (confirmed current release: v1.8.1). It authenticates via a GitHub OAuth device-flow tied to the operator's own `io.github.ezumba` GitHub identity. This is not something this session can or should do on the operator's behalf — same boundary as npm credentials.

**What's already done and ready:** `server.json` in the `exergynet-mcp-server` repo is fully correct — version `0.2.5`, no `BASE_PRIVATE_KEY`, `RPC_URL` marked optional, accurate description. `package.json` already has the required `mcpName: "io.github.ezumba/exergynet"` marker. Nothing needs to be rewritten before publishing; it only needs to actually be published.

**Exact operator steps** (do not paste any output containing an OAuth code or token into any chat interface):

```bash
# macOS/Linux
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
sudo mv mcp-publisher /usr/local/bin/

# Windows (PowerShell)
$arch = if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq "Arm64") { "arm64" } else { "amd64" }
Invoke-WebRequest -Uri "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_$arch.tar.gz" -OutFile "mcp-publisher.tar.gz"
tar xf mcp-publisher.tar.gz mcp-publisher.exe

# Then, from the exergynet-mcp-server repo root (server.json already correct at HEAD):
mcp-publisher login github
# Follow the printed device-flow URL and code in your own browser.
mcp-publisher validate
mcp-publisher publish

# Verify the live public representation afterward:
curl "https://registry.modelcontextprotocol.io/v0/servers?search=exergynet"
# Expect version 0.2.4 or 0.2.5 (whichever is npm-published at the time), no BASE_PRIVATE_KEY field.
```

**Priority: P0.** This is the single most authoritative surface after npm itself.

---

## 2. Glama (`glama.ai/mcp/servers/ezumba/exergynet-mcp-server`)

**Current live state:** last meaningfully crawled 2026-05-12 — before this incident existed. Instructs setting `BASE_PRIVATE_KEY` as a "hot wallet private key," and describes `exergynet_open_job` as autonomously handling "USDC approvals and on-chain escrow... without requiring human confirmation at each step," framed as an intended feature. Zero mention of the security advisory. Its "Schema" sub-tab is *even more* stale than its main listing — it references "LNES-01," an older internal name than the "LNES-03" wording on the overview tab, confirming this is a patchwork of multiple old crawls, not one coherent snapshot.

**Why this matters more than a typical stale listing:** a same-day search-footprint check (queries: "ExergyNet", "ExergyNet AI", "ExergyNet MCP", "ExergyNet Seven Ezumba") found Glama as the **#1 organic result every time**, and search engines' AI-generated summaries repeated its retired-write-path framing nearly verbatim in every case. This is not a low-traffic listing — it is currently the dominant external description of what ExergyNet is, which is exactly why bringing it current is worth prioritizing.

**Correction path:** a "Claim" button exists on the listing, gated behind sign-in (the author namespace `ezumba` matches the GitHub username, strongly suggesting GitHub-identity-based claiming). No public "request recrawl without claiming" mechanism was found. **This requires the operator's own account.**

**Exact operator steps:**
1. Go to `https://glama.ai/mcp/servers/ezumba/exergynet-mcp-server` and click "Claim."
2. Complete whatever identity verification it requests (expected: GitHub sign-in as `ezumba`).
3. Once claimed, use Glama's editing interface (or trigger a recrawl if one is offered) to bring the listing in line with the current README/`server.json` — no `BASE_PRIVATE_KEY`, `exergynet_open_job` described as disabled/fail-closed, advisory linked.
4. Re-run the search-footprint queries above after a few days to confirm the AI-summary framing has updated.

**Priority: P0** (raised from P1 — see the search-footprint finding above).

---

## 3. MCP.so (`mcp.so/servers/exergynet-mcp-server`)

**Current live state:** same substance as Glama — its FAQ literally states "Does Exergynet handle on-chain transactions autonomously? Yes... without requiring human confirmation at each step," with no advisory mention. Added roughly 4 months ago, matching the same pre-incident vintage.

**Important caution — do not pay for the wrong flow:** MCP.so's `/submit` page is a **paid ($39) new-listing / premium-placement flow**, explicitly for adding new projects with featured placement — it is not a correction mechanism for an existing listing, and using it risks creating a duplicate rather than fixing the real one. **The correct, free path is different:** the existing listing page itself has a button reading "Verify ownership via GitHub to manage this listing."

**Exact operator steps:**
1. Go to `https://mcp.so/servers/exergynet-mcp-server`.
2. Click "Verify ownership via GitHub to manage this listing" (do **not** use `/submit` or pay the $39 fee).
3. Authenticate as `ezumba` on GitHub.
4. Update the description/FAQ to match current safe behavior — suggested priority wording (from Directive 008 §5): *"Current ExergyNet MCP package provides read-only protocol lookups and local compute-cost estimation. Write settlement is disabled pending verified contract migration."*

**Priority: P1.**

---

## 4. Smithery (`smithery.ai/server/@ezumba/exergynet-mcp-server`)

**Current live state:** empty stub — no description, no capabilities, no deployments.

**New finding:** the listing page carries a banner, "Read more in our announcement here," linking to `arcade.dev/blog/smithery-joins-arcade`. Smithery appears to be in the process of being folded into Arcade.dev. This is a more likely explanation for the persistent empty state than "not yet crawled."

**Recommendation: leave alone**, per Directive 008 §6's own default guidance for a listing that isn't meaningfully indexed. Investing effort populating a listing on a platform mid-acquisition is a poor use of time; if Arcade.dev becomes the actual successor platform, that would be worth a fresh, separate evaluation later — not a reason to act on Smithery now.

**Priority: low, deliberately not pursued.**

---

## 5. MCP Vouch / independent scanner

**Finding: treat the 71/100 score as historical, and the rescan mechanism as currently unavailable.**

The site formerly reached via `mcpvouch.com` (now redirecting to `mcp-registry-dh5.pages.dev`) still shows the original 71/100, grade-C result scored 2026-07-09 against version 0.1.10. Its own page instructs "re-run it yourself with `npx mcpr scan`" — but:
- `mcpr` returns a 404 on the public npm registry.
- The GitHub repository it links to (`Incultnitollc/mcp-registry`) also returns 404.
- A broad web search for "MCP Vouch" found zero independent mentions anywhere outside that one site — it does not appear to be a widely-recognized reference in the MCP security-tooling ecosystem.

**No rescan was executed.** Per Directive 008 §7, this closes as:

```
INDEPENDENT_RESCAN_UNAVAILABLE
```

Do not cite the 71/100 figure as a current score in any outreach material — it should be described only as "an independent scan of an earlier package version" (see the evidence-packet update).

## 6. Replacement independent scanner — identified, not yet run

Researched per Directive 008 §8's requirements (external, actual technical examination, visible methodology, identifiable package/version, publicly linkable result). Found: **Snyk Agent Scan** (`github.com/snyk/agent-scan`).

- This is the same lineage as "Invariant Labs' `mcp-scan,`" a tool referenced in independent MCP-security writeups; Snyk acquired it, and the old GitHub path (`invariantlabs-ai/mcp-scan`) now 301-redirects to `snyk/agent-scan`.
- Actively maintained: ~3,000 GitHub stars, last push the same day this research was done.
- Open-source scan methodology; backed by Snyk, an established, independent security vendor — not a project shopping for a guaranteed good score.
- Scans MCP servers, tools, and skills for prompt injection, tool poisoning, cross-origin escalation, and other risks.

**Why it wasn't run this pass:** it requires the operator's own free Snyk account and an API token (`SNYK_TOKEN`) — this session does not create accounts or handle API credentials on the operator's behalf, same boundary as npm/GitHub.

**Exact operator steps:**

```bash
# 1. Sign up at https://snyk.io and get an API token from https://app.snyk.io/account
export SNYK_TOKEN=your-api-token-here

# 2. Create a minimal MCP client config pointing only at this one server, e.g. mcp-scan-target.json:
# {
#   "mcpServers": {
#     "exergynet": { "command": "npx", "args": ["-y", "exergynet-mcp-server@0.2.5"] }
#   }
# }

# 3. Run the scan (uv must be installed: https://docs.astral.sh/uv/getting-started/installation/)
uvx snyk-agent-scan@latest mcp-scan-target.json
```

**Safety note carried over from the tool's own documentation:** scanning a stdio MCP server starts it (executes the configured command) to inspect its tool definitions. This is expected and safe for `exergynet-mcp-server` specifically, since its write path is already fail-closed with no signing capability — but the tool's own default behavior is to prompt for consent before starting each server, which is appropriate to leave enabled.

**Priority: P1, new item** — not previously identified in any earlier directive.

---

## Summary table (ties to Directive 008 §19's final-report items 8–17)

| Surface | Current state | Correction ready? | Blocked on | Priority |
|---|---|---|---|---|
| Official MCP registry | 0.1.10, requires `BASE_PRIVATE_KEY` | Yes — `server.json` already correct | Operator GitHub OAuth device-flow | P0 |
| Glama | Pre-incident, describes disabled behavior as live feature | Content plan ready, needs claiming first | Operator GitHub-identity claim | P0 |
| MCP.so | Same substance as Glama | Content plan ready; free path identified | Operator GitHub-identity claim | P1 |
| Smithery | Empty stub, platform mid-acquisition | N/A — recommend leaving alone | — | Low, deliberate |
| MCP Vouch | Stale 71/100; rescan tool non-functional | Closed as `INDEPENDENT_RESCAN_UNAVAILABLE` | — | Closed |
| Snyk Agent Scan (replacement) | Not yet run | Exact command prepared | Operator Snyk account/token | P1, new |
