# Security Advisory: exergynet-mcp-server retired-contract exposure

**Date:** 2026-08-28
**Affected package:** `exergynet-mcp-server` (npm)
**Affected versions:** 0.2.0 through 0.2.2 (the `exergynet_open_job` write tool only; other tools in these versions were not affected — see below)
**Fixed version:** 0.2.4, published to npm and confirmed as the `latest` release (see status note). An intermediate 0.2.3 fixed the same issue but was never published — 0.2.4 supersedes it with additional hardening (see below).

## Summary

Versions 0.2.0–0.2.2 of `exergynet-mcp-server` included a working `exergynet_open_job` MCP tool. When a user configured it with a real, funded EVM wallet exactly as the package's own documentation instructed, the tool would grant an unlimited USDC spending approval and then attempt to open a job on a Base Mainnet contract address that ExergyNet's own status page identifies as retired.

## Affected capability

Only the write path (`exergynet_open_job`). The package's read-only tools (`exergynet_get_program_id`, `exergynet_verify_program`, `exergynet_get_proof_transaction`, `exergynet_estimate_gate`) do not sign transactions, do not require a private key, and are not affected.

## Impact

If you configured `BASE_PRIVATE_KEY` for this package and invoked `exergynet_open_job`, your wallet would have submitted a real USDC `approve()` transaction on Base Mainnet granting unlimited spending allowance to `0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f`. That contract's access-control functions cannot be independently verified (standard owner/pause checks revert), so the party who can act on that approval cannot be confirmed.

We found no evidence that any independent user's wallet ever completed this flow. On-chain records show only six transactions ever sent to that contract, all from a single wallet used for internal testing in May 2026, not from any third-party installation of this package.

The `openJob()` call itself does not match that contract's real function interface and would have failed after the approval step — meaning the approval, not a completed "job," is the actual residual risk.

## Mitigation

**If you configured a real private key for any version of this package before 0.2.4:**

1. Revoke the USDC approval to `0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f` on Base Mainnet. You can do this at [revoke.cash](https://revoke.cash/address/0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f?chainId=8453) or any equivalent approval-management tool, using the wallet that granted the approval.
2. Upgrade to 0.2.4 or later — `npm install exergynet-mcp-server` (no version pin) now resolves to the fixed release.

**If you never configured `BASE_PRIVATE_KEY`,** the tool would have returned a configuration error and taken no on-chain action — no mitigation is needed.

## Fixed version

0.2.4 disables `exergynet_open_job` entirely — it returns a fixed message and performs no network call, signing, or calldata construction under any configuration. It has no transaction-signing dependency at all. The write tool will not be re-enabled until a current execution target is independently verified end-to-end and that verification is documented publicly. 0.2.4 additionally fixes input-validation, audit-logging, and rate-limiting gaps identified by an independent MCP security scan of an earlier build — see the package README for detail.

## Status

- Fixed source: published to `github.com/ezumba/exergynet-mcp-server` (`main` branch), commit `7064acc`.
- **npm publication: confirmed.** `exergynet-mcp-server@0.2.4` is live on the npm registry and is the `latest` dist-tag (verified independently, not taken on report — shasum `8a264a276106f513e013638ac020ed72a57b826c`, integrity `sha512-z8Av07y/J9pj/hi4v6Jyi3bSiM4dMmQvIs2seroATcfreiBG95l8auCrbXtypUL/vxAEY8c5fF4kI5eNsVwv7g==`). Ordinary installs — `npx -y exergynet-mcp-server` or `npm install exergynet-mcp-server` with no version pin — now resolve to this fixed release.
- Versions 0.2.0, 0.2.1, and 0.2.2 are marked deprecated on npm with a notice pointing users to upgrade.
- A follow-up release, 0.2.5, resolves four unrelated moderate-severity `npm audit` findings in a transitive dependency (`uuid`, via `@solana/web3.js` → `jayson`) — its source is published but not yet on npm. This is a supply-chain hygiene fix, not a security issue in `exergynet-mcp-server` itself, and does not change anything in this advisory.
- **Known residual propagation lag (not a security issue, but disclosed for accuracy):** the official MCP registry (`registry.modelcontextprotocol.io`) and two third-party directories (Glama, MCP.so) still display cached data from version 0.1.10, predating this incident, and have not yet recrawled or been updated to reflect 0.2.4. Their cached install instructions do not reflect the current safe package. Any install performed via npm directly — which is how the vast majority of users actually receive this package — is unaffected by this lag.
- Read-only functionality is unaffected in every version and remains safe to use.

## Reporting

Questions about this advisory: `operators@exergynet.org`.
