# MCP Incident Closure — 2026-08-28

**Directive:** VP Sales Directive 007 — MCP Incident Closure, Safe Release Publication, and External Propagation Resume Gate

## What this closes

- **Wallet classification, everywhere:** corrected. See "Wallet classification audit" below for the exact repository-wide grep result.
- **Incident reclassification:** done in `MCP_P0_CONTRACT_INCIDENT_2026-08-28.md` §8 — "Unsafe legacy integration / contract-target configuration drift," with explicit established/not-established lists.
- **Path C preserved:** `exergynet_open_job` remains disabled. Not reversed, not repointed at V5, despite V5's confirmed ABI compatibility — see the incident report §3–4.
- **MCP Vouch remediation:** done, on top of the fail-closed fix, as version 0.2.4 (commit `7064acc`).
- **Rust gateway audit:** done — see `RUST_GATEWAY_CONTRACT_AUDIT_2026-08-28.md`. No fund-movement capability found in that component under any deployment status.
- **Outstanding allowance:** documented, not acted on — see `RETIRED_CONTRACT_ALLOWANCE_ACTION_2026-08-28.md`.
- **Release provenance:** documented — see `MCP_RELEASE_PROVENANCE_0.2.4.md`.
- **Operator wallet decision:** the question the directive poses ("which wallet is operationally canonical now?") was already put to the operator directly and answered: keep `wallet_1` on the public-facing surfaces. Not reverted. See "Operator wallet audit" below.

## Update — 2026-08-28, post-publication pass

The operator published 0.2.4 to npm and reported "OPERATOR GATE 007-A COMPLETE." Per standing instruction, that report was **not** taken on trust — every claim in it was independently re-verified against the live registry and a fresh clean install. Results:

- **npm 0.2.4 is genuinely published and is `latest`.** Confirmed via `npm view exergynet-mcp-server version` and `dist-tags`.
- **The downloaded artifact matches the claim.** A fresh `npm pack exergynet-mcp-server@0.2.4` in a clean directory, unpacked and inspected directly: retired contract address absent from `dist/index.js` (present only in the intentional README advisory); `exergynet_open_job` fails closed on a live stdio JSON-RPC call, with zero signing/transaction capability under any input.
- **Ordinary unpinned install resolves to 0.2.4.** Confirmed via a clean `npm init && npm install exergynet-mcp-server` with no version pin.
- **Deprecation is correctly scoped.** 0.2.0/0.2.1/0.2.2 carry the exact required non-inflammatory wording; 0.1.x is untouched, correctly.
- **One apparent discrepancy, investigated and resolved as benign:** the locally-built tarball hash recorded in `MCP_RELEASE_PROVENANCE_0.2.4.md` did not match the npm-published hash. Diagnosed as a Windows CRLF vs. published-build LF line-ending artifact (`diff --strip-trailing-cr` shows zero content difference) — not a provenance failure. The document has been corrected to record the npm-published hash as authoritative.
- **A new, separate finding: four moderate `npm audit` vulnerabilities** (transitive `uuid@8.3.2` via `@solana/web3.js` → `jayson`) were assessed without using `npm audit fix --force` (which would have forced a non-functional `@solana/web3.js` downgrade). A targeted `overrides` fix was found, verified (0 vulnerabilities, 9/9 tests, live Mainnet-Beta smoke test), and shipped as source-only **0.2.5** (commit `45f5e29` on `main`) — **not yet published to npm**, same credential gap as 0.2.4. This is a hygiene follow-up, not a reopening of the incident; 0.2.4 remains the safe published release. See `MCP_RELEASE_PROVENANCE_0.2.4.md` for full detail.

### Official MCP registry — checked, confirmed still stale, root cause identified

`registry.modelcontextprotocol.io` still serves the `io.github.ezumba/exergynet` entry at **version 0.1.10**, published 2026-05-07, presenting the retired write-enabled configuration rather than the current fail-closed release: it lists `BASE_PRIVATE_KEY` as a **required** environment variable, described as "Agent's Base L2 Hot Wallet Private Key (Hex)." The real publisher tool is `mcp-publisher`, a binary distributed via GitHub Releases from `modelcontextprotocol/registry` (confirmed current release: v1.8.1), which authenticates via a GitHub OAuth device-flow tied to the operator's own `io.github.ezumba` GitHub identity. That authentication step belongs to the operator, the same way npm credentials do — this session did not attempt it and is documenting it as an operator action, not treating it as done.

### MCP directory recheck — two directories materially inconsistent with the current release

- **Glama** (`glama.ai/mcp/servers/ezumba/exergynet-mcp-server`): last crawled 2026-05-12 (pre-incident). The cached page continues to describe automated USDC approval and private-key configuration associated with the earlier write-enabled integration, while the current npm release disables write settlement and does not require a private key for that disabled path. It instructs new users to configure `BASE_PRIVATE_KEY` and describes `exergynet_open_job` as handling "USDC approvals and on-chain escrow... without requiring human confirmation at each step," with no mention of the security advisory. Correcting this requires claiming the listing, which is gated behind the operator's own GitHub identity (a "Claim" flow) — operator action required.
- **MCP.so** (`mcp.so/servers/exergynet-mcp-server`): same vintage (added ~4 months ago) and the same substance — its public FAQ states "Does Exergynet handle on-chain transactions autonomously? Yes... without requiring human confirmation at each step," again with no advisory reference. Same "Claim"-gated correction path.
- **Smithery**: confirmed still an empty stub (no description, no capabilities, no deployments) — not misleading, just unpopulated. No action needed.
- **Libraries.io**: confirmed **live-synced** directly from the npm registry — already correctly shows version 0.2.4 with the full security advisory text mirrored verbatim from the current README. No action needed; this one self-corrects because it doesn't independently cache content.
- **CrossAI Tools, Metatext**: could not locate confirmed listings at the URLs tried in this session. Not asserting either way rather than guessing — flagged as unconfirmed, low priority pending a known-correct URL.

**Important risk-scoping note:** although Glama's and MCP.so's instructions still describe the retired write-enabled configuration, a user who follows them exactly (`npx -y exergynet-mcp-server`, unpinned) still receives the current npm `latest` — 0.2.4 today — whose `exergynet_open_job` fails closed **unconditionally**, regardless of whether `BASE_PRIVATE_KEY` is set. The write path that existed in 0.2.0–0.2.2 is closed at the npm layer regardless of what these stale third-party pages say. The residual exposure from these listings is reputational and trust-accuracy — it does not translate into a live fund-loss path — unless someone deliberately pins to a deprecated 0.2.0–0.2.2 version, which neither page instructs.

### MCP Vouch rescan — attempted, tooling itself could not be verified as functional

The registry entry for `io.github.ezumba/exergynet` at the site formerly reached via `mcpvouch.com` (now redirecting to `mcp-registry-dh5.pages.dev`) still shows the original **71/100, grade C** result from the 2026-07-09 scan of 0.1.10. Its own page instructs "re-run it yourself with `npx mcpr scan`" — but the `mcpr` package returns a 404 on the public npm registry, and the GitHub repository linked from that site (`Incultnitollc/mcp-registry`) also returns 404. **No rescan was executed.** Rather than assume the previously-cited scanning service still functions as before, or execute an unverified/nonexistent tool, this is being flagged as a genuine open question for the operator: confirm whether MCP Vouch has moved, rebranded, or whether this service should no longer be treated as the authoritative source for the 71/100 figure going forward.

## What remains open

- **npm publication of 0.2.5** (the uuid-override hygiene fix) — blocked on the same credential gap as every npm-publish step in this incident; source is ready on `main` at commit `45f5e29`.
- **Official MCP registry update to 0.2.4/0.2.5** — blocked on GitHub OAuth device-flow authentication that belongs to the operator, not this session.
- **Glama and MCP.so listing corrections** — blocked on claiming each listing under the operator's own identity; until claimed, both continue to describe the retired write-enabled behavior as current.
- **MCP Vouch rescan** — blocked on a scanning tool this session could not confirm is currently functional; needs operator confirmation of the service's current state before relying on it further.
- **Directive 005 external propagation** — see the updated gate checklist below for the current determination.
- **Visual QA** — still blocked, same as the last three directives. The Browser pane was not displayed on the user's side this session either.

---

## Wallet classification audit (Directive 007 §1)

Repository-wide grep for `compromised`, `burned`, `compromised wallet`, `known-compromised`, `already-compromised` in reference to wallet `0xbd1e790f6040...109C`, across both repositories, run at the start of this directive:

**Result: already 0 as of commit `404413b`** (pushed in direct response to the operator's correction, before this directive was issued). Directive 007's premise §1 describes a state from before that commit — this session verified the *current* repository state rather than assuming the directive's snapshot was still accurate, and confirmed no stale "compromised" language remains in any of: `MCP_P0_CONTRACT_INCIDENT_2026-08-28.md`, `PUBLIC_CONTRACT_ADDRESS_REGISTRY_2026-08-28.md`, `public-contracts.json`, `MCP_SECURITY_ADVISORY_2026-08-28.md`, `MCP_EXTERNAL_SECURITY_REMEDIATION_2026-08-27.md`, `EXTERNAL_PROPAGATION_CHANGELOG.md`, `docs/WEBSITE_CHANGELOG.md`, `VAULT_LEDGER.md`. One unrelated historical entry (`docs/WEBSITE_CHANGELOG.md`, a Directive-003-era note referencing a differently-named audit finding "CRITICAL-002 (proof.html compromised-wallet contract)") was left untouched, per the no-silent-history-rewrite rule — it describes what a past audit finding was called at the time, not a current claim about this wallet.

`MCP_PUBLISHED_ARTIFACT_PROVENANCE_2026-08-28.md` was checked this pass and contains no "compromised" language — it was already worded around "a wallet later found to be compromised" — wait, this was checked and found clean; see the grep output in the working log. (No edit was needed there.)

## Operator wallet audit (Directive 007 §13)

The directive's own framing: the correct question is "which wallet is operationally canonical now," not "which wallet was mistakenly labeled compromised." This was already resolved correctly — the operator was asked directly, in chat, before Directive 007 was issued: *"The website's 'Operator Wallet' field... currently point to wallet_1 — what should they point to now?"* Answer: **"Keep wallet_1 (recommended)."** This was an informed operator decision made with the correct facts (wallet not compromised, still controlled), not a decision made under the mistaken belief the old wallet was compromised. No reversion performed or warranted.

## Exact npm publication command sequence (Directive 007 §4/§5)

**This session has no npm credentials and did not request any.** The steps below are for the operator (or whoever holds `npm login` access to the `exergynet-mcp-server` package) to run directly. Nothing here should be pasted into this chat.

```bash
# 1. Fetch clean main and verify the commit
git clone https://github.com/ezumba/exergynet-mcp-server.git
cd exergynet-mcp-server
git log -1 --format="%H %s"
# Expect: 7064acc ... "fix(security): MCP Vouch remediation ..."

# 2. Install and run all tests
npm install
npm test
# Expect: 9 pass, 0 fail

# 3. Clean rebuild
npm run build
git status
# Expect: no diff (dist/ matches src/ exactly)

# 4. Generate the tarball and compare its hash to the one already recorded
npm pack --dry-run
# Expect shasum: e79d885ce3aae34e9e588c45f9e71a7a63ea4998
# Expect integrity: sha512-5roYoat/XW8Uj[...]epRxzXeWFpb5Q==
# If the hash differs, STOP and document why before publishing (do not assume it's fine).

# 5. Inspect the packed file list
npm pack --dry-run 2>&1 | grep -A6 "Tarball Contents"
# Expect exactly: README.md, dist/index.d.ts, dist/index.js, package.json

# 6. Verify the retired address is absent and the write path fails closed (local, one more time)
grep -c "5cfE075149776f4b3cca07a27D4fd85A60BA5e3f" dist/index.js   # expect 0
node dist/index.js <<< '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"exergynet_open_job","arguments":{}}}'
# Expect the fail-closed message, not a transaction

# 7. Publish
npm login          # interactive — enter your own credentials, not shared here
npm publish

# 8. Immediately verify what was actually published (do not trust step 7 alone)
npm view exergynet-mcp-server version
# Expect: 0.2.4
npm view exergynet-mcp-server dist.integrity
# Expect it to match the integrity value from step 4

# 9. Download the PUBLISHED artifact independently (not your local build) and retest
mkdir /tmp/verify-published && cd /tmp/verify-published
npm pack exergynet-mcp-server@0.2.4
tar -xzf exergynet-mcp-server-0.2.4.tgz
diff package/dist/index.js ../exergynet-mcp-server/dist/index.js
# Expect: no difference

# 10. Confirm ordinary install resolves to the safe version
npm view exergynet-mcp-server version   # latest dist-tag
npx -y exergynet-mcp-server --help 2>&1 | head -5   # or equivalent smoke check
# in a scratch directory: npm install exergynet-mcp-server (no version pin), check installed version
```

## Deprecation (Directive 007 §6)

Once 0.2.4 is confirmed live (step 8 above), run:

```bash
npm deprecate exergynet-mcp-server@"0.2.0 - 0.2.2" "Deprecated: the write-transaction path in this version references a retired contract. Upgrade to 0.2.3 or later before using transaction tools."
```

Do not deprecate 0.1.x — those versions predate the Base L2 write functionality entirely and are unaffected. Do not use "hacked," "compromised," "stolen," or "breached" in the deprecation message — none of those is established.

## MCP registry update (Directive 007 §8)

Once npm 0.2.4 is verified live, update `io.github.ezumba/exergynet`'s `server.json` entry through the registry's own authorized publish mechanism (typically `mcp-publisher` CLI with GitHub OAuth for this namespace — this session does not have that authentication either). After updating, verify:

- The entry still resolves as `io.github.ezumba/exergynet`.
- Version metadata shows 0.2.4, not 0.1.10.
- The description matches the current canonical framing (already corrected in this repo's `server.json`, ready to publish).
- It does not describe `exergynet_open_job` as active/functional.
- The public claim remains exactly **"Listed in the official MCP registry"** — never "partner," "approved," "certified," or "endorsed."

## Directive 005 resume-gate checklist (Directive 007 §19) — re-evaluated 2026-08-28

| Required item | Status |
|---|---|
| npm safe release published | ✅ **0.2.4 confirmed live and `latest`**, independently verified from a clean install, not from the operator's report |
| Ordinary install returns safe release | ✅ Confirmed — unpinned `npm install` resolves to 0.2.4 |
| Downloaded artifact independently verified | ✅ Confirmed — retired address absent, fail-closed behavior confirmed on the actual downloaded tarball |
| Affected releases deprecated where possible | ✅ Confirmed — 0.2.0/0.2.1/0.2.2 deprecated with required wording; 0.1.x correctly untouched |
| Official registry updated or stale state clearly documented | ✅ Documented as stale, with root cause (operator GitHub OAuth device-flow required) and the specific retired-configuration content it still serves |
| Incident docs corrected | ✅ Done, including this pass's hash correction and 0.2.5 addendum |
| Active retired-address runtime references = 0 | ✅ Confirmed — zero in currently-published npm code; only remaining occurrences anywhere are the intentional README/advisory text and third-party directory caches (Glama, MCP.so) that are documented as stale, not runtime code |

**Conclusion: the gate is now met.** Every item that was blocking Directive 005 is either done or reduced to a clearly-documented, non-blocking residual (registry/directory staleness on services this session cannot authenticate to). npm — the channel through which every real user actually receives code — serves only the safe release. The MCP marketing hold tied specifically to "npm still serves an unsafe release" **can be lifted**.

**This is not an unconditional green light for Directive 008.** Two items should be carried forward as known, disclosed limitations rather than silently dropped:

1. The official MCP registry and two directory listings (Glama, MCP.so) still describe pre-fix behavior and, in the registry's case, actively request a private key. Any external communication (press, analyst outreach, marketing copy) should not claim "the MCP registry reflects the current safe release" — that claim is false today. It's accurate to say "the npm package — the actual install path for essentially all users — is fixed and verified independently," which is a narrower but true and still strong claim.
2. The MCP Vouch 71/100 grade C figure currently displayed publicly is stale (scored against 0.1.10) and this session could not get a fresh rescan running due to the scanning tool's own tooling not resolving. Any outreach that cites "we fixed the issues an independent scanner found" should not claim a new score has been obtained — only that the previously-found issues have been remediated in the current release, which is independently verifiable by re-reading the code, even without a fresh automated score.

---

## Directive 008 update — 2026-08-28 (later)

The operator's own review of Directive 007 refined the determination above into two separate holds: **user-protection hold — closed**, but **MCP promotional/analyst hold — partially open**, pending distribution-surface accuracy (not software safety). Directive 008 tasked completing that distribution work. Results:

### What's newly done
- **0.2.5 prepared and source-published.** Resolves the four remaining moderate `npm audit` findings via a targeted `uuid` override (no `@solana/web3.js` downgrade). Fresh-clone verification (not the dev checkout): 9/9 tests, clean build, 0 audit findings. Commit `45f5e29` on `main`. **npm publication still requires operator credentials** — full detail and exact commands in `MCP_RELEASE_PROVENANCE_0.2.5.md`.
- **0.2.4 explicitly preserved**, not deprecated — it remains a fully safe, distinct historical release for the P0 write-path fix, separate from 0.2.5's dependency hardening.
- **Full root-cause and fix-path research completed** for the official MCP registry, Glama, and MCP.so — see `MCP_DISTRIBUTION_PROPAGATION_2026-08-28.md` for exact operator steps for each. Key new finding: Glama's stale content is not a low-visibility issue — it is the **#1 organic search result** for "ExergyNet" across every variant tried, and search engines' AI summaries repeat its framing directly (raising its priority from P1 to P0). MCP.so has a paid ($39) submission flow that is **not** the correction path — the free "Verify ownership via GitHub" button on the existing listing is.
- **MCP Vouch rescan formally closed as `INDEPENDENT_RESCAN_UNAVAILABLE`** — its documented `npx mcpr scan` command doesn't resolve to any real package, its linked GitHub repo 404s, and broad web search found no independent corroboration that this service is a recognized reference at all.
- **A credible replacement identified: Snyk Agent Scan** (`github.com/snyk/agent-scan`, the successor to Invariant Labs' `mcp-scan`, actively maintained, ~3,000 stars). Not yet run — requires the operator's own Snyk account and API token, a credential boundary this session does not cross. Exact command prepared.
- **Visual/funnel QA performed** to the extent this session's tooling allows. True pixel-level screenshot inspection remains blocked — the Browser pane is not displayed on the user's side, so screenshots time out. What *was* verified directly: all 32 internal pages return HTTP 200; the homepage's 38 links (including `.well-known` manifests and external social/portal links) all resolve; the mobile hamburger menu opens and correctly reveals all 9 nav links. **Do not treat this as complete visual QA** — see the visual QA note below.
- **New findings outside the original npm-package scope, found via this QA pass:**
  - `exergynet.org/mcp.html` (first-party) documents a *different*, HTTP+Ed25519-signed "MCP Gateway" with an `exergynet_open_job` method that instructs signing a request with a real Solana private key to "lock" SOL. Verified this endpoint is **not actually live** (`POST` returns a generic 405; `GET` just serves the static doc page) — but the page does not disclose that, and describes exactly the autonomous-signing pattern this whole incident has been correcting elsewhere. **Not corrected this pass — flagged for a product decision** (label unimplemented, or remove).
  - `docs.html` links to `https://explorer-api.exergynet.org/command.html`, which returns 404 (the domain root also 404s).
  - Nearly every page's nav/footer Discord link uses a channel-permalink format (`discord.com/channels/{guild}/{channel}`) that doesn't function as a public join flow for new visitors; only `connect.html` has the correct public invite link (`discord.gg/EXERGYNET`).

### Visual QA note — do not claim complete

Per Directive 008 §9's own instruction: screenshot-based visual inspection (fold, typography, clipping, exact card layout) could not be performed this session because the Browser pane isn't displayed on the user's side, and this session's attempt to substitute a geometry-based check (`window.innerWidth`/`scrollWidth` comparisons) produced two separate measurement artifacts in this non-composited state (an impossible `width: 0` reading, and an anomalous mobile-width reading) — both traced to the lack of real compositing, not real page defects. One page (`security.html`) showed an ambiguous possible-overflow signal from an absolutely-positioned decorative element that already has a standard `overflow-x: hidden` mitigation on `<body>` — likely a false positive, but **unconfirmed** without real visual rendering. **Visual QA is not being claimed complete.** What's reliable and was actually done: link-resolution, image-load, and click-through functional checks (see above), which is a different and narrower guarantee than true visual QA.

### Revised Directive 005 / marketing-hold determination

Adopting the operator's own two-hold framing:

- **User-protection hold: remains closed.** Nothing found this pass changes that — the npm-published software is safe, and the new first-party `mcp.html` finding describes a non-functional endpoint, not a live risk.
- **MCP promotional/analyst hold: still partially open, narrower than before.** What's now blocking it is exclusively operator-authenticated actions (npm publish for 0.2.5, GitHub OAuth for the registry, GitHub-identity claims for Glama/MCP.so, a Snyk account for a fresh independent scan) — every research, verification, and preparation task that doesn't require the operator's own credentials has been completed. Safe to say publicly now, unchanged from Directive 007: *"The current npm release disables write settlement pending verified contract migration."* Still not safe to say: *"MCP ecosystem surfaces are fully current and security-remediated"* — the registry and two directories still aren't, as of this writing.
