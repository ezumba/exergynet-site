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

## What remains open

- **npm publication of 0.2.4.** This is the actual blocker on lifting the marketing hold. See the exact command sequence below — this session has no npm credentials and will not acquire or request them in chat.
- **Official MCP registry update.** Blocked on the same credential gap (registry publish typically also requires an authenticated flow).
- **MCP directory re-propagation check** (Glama, MCP.so, Smithery, etc.) — deferred until after npm publication, since most of these crawl from npm/GitHub and checking now would just confirm they're still showing pre-fix data.
- **Fresh independent MCP Vouch rescan** — deferred until 0.2.4 is actually on npm, per Directive 007 §11's explicit sequencing (do not rescan unpublished code and market that as current).
- **Directive 005 external propagation** — stays paused. The required gate (npm safe release published, ordinary install verified, affected releases deprecated, registry updated or documented, incident docs corrected, zero active retired-address runtime references) is only partially met — see the checklist below.
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

## Directive 005 resume-gate checklist (Directive 007 §19)

| Required item | Status |
|---|---|
| npm safe release published | ❌ Not yet — blocked on credentials |
| Ordinary install returns safe release | ❌ Cannot verify until published |
| Downloaded artifact independently verified | ❌ Cannot verify until published |
| Affected releases deprecated where possible | ❌ Blocked on credentials |
| Official registry updated or stale state clearly documented | ✅ Documented as stale (this doc + `MCP_P0_CONTRACT_INCIDENT_2026-08-28.md`) |
| Incident docs corrected | ✅ Done |
| Active retired-address runtime references = 0 | ✅ Confirmed |

**Conclusion: the gate is not yet met.** Directive 005 external propagation stays paused. The items that "may remain pending" per §19 (MCP Vouch rescan, search-engine propagation, directory crawler refresh, analyst outreach, white paper publication, visual QA) correctly remain pending and are not blocking anything else.
