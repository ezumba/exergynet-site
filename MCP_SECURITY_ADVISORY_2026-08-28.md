# Security Advisory: exergynet-mcp-server retired-contract exposure

**Date:** 2026-08-28
**Affected package:** `exergynet-mcp-server` (npm)
**Affected versions:** 0.2.0 through 0.2.2 (the `exergynet_open_job` write tool only; other tools in these versions were not affected — see below)
**Fixed version:** 0.2.3 (source published to GitHub; npm publication pending — see status note)

## Summary

Versions 0.2.0–0.2.2 of `exergynet-mcp-server` included a working `exergynet_open_job` MCP tool. When a user configured it with a real, funded EVM wallet exactly as the package's own documentation instructed, the tool would grant an unlimited USDC spending approval and then attempt to open a job on a Base Mainnet contract address that ExergyNet's own status page identifies as retired.

## Affected capability

Only the write path (`exergynet_open_job`). The package's read-only tools (`exergynet_get_program_id`, `exergynet_verify_program`, `exergynet_get_proof_transaction`, `exergynet_estimate_gate`) do not sign transactions, do not require a private key, and are not affected.

## Impact

If you configured `BASE_PRIVATE_KEY` for this package and invoked `exergynet_open_job`, your wallet would have submitted a real USDC `approve()` transaction on Base Mainnet granting unlimited spending allowance to `0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f`. That contract's access-control functions cannot be independently verified (standard owner/pause checks revert), so the party who can act on that approval cannot be confirmed.

We found no evidence that any independent user's wallet ever completed this flow. On-chain records show only six transactions ever sent to that contract, all from a single wallet used for internal testing in May 2026, not from any third-party installation of this package.

The `openJob()` call itself does not match that contract's real function interface and would have failed after the approval step — meaning the approval, not a completed "job," is the actual residual risk.

## Mitigation

**If you configured a real private key for any version of this package before 0.2.3:**

1. Revoke the USDC approval to `0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f` on Base Mainnet. You can do this at [revoke.cash](https://revoke.cash/address/0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f?chainId=8453) or any equivalent approval-management tool, using the wallet that granted the approval.
2. Upgrade to 0.2.3 or later once it is available on npm (see status below), or remove the package until it is.

**If you never configured `BASE_PRIVATE_KEY`,** the tool would have returned a configuration error and taken no on-chain action — no mitigation is needed.

## Fixed version

0.2.3 disables `exergynet_open_job` entirely — it returns a fixed message and performs no network call, signing, or calldata construction under any configuration. It has no transaction-signing dependency at all. The write tool will not be re-enabled until a current execution target is independently verified end-to-end and that verification is documented publicly.

## Status

- Fixed source: published to `github.com/ezumba/exergynet-mcp-server` (`main` branch), commit `f3f4edc`.
- npm publication: **pending** — this advisory will be updated with the published version and its integrity hash once available. Until then, installing via `npx -y exergynet-mcp-server` or `npm install exergynet-mcp-server` will fetch version 0.2.2, which still contains the affected tool. If you need it today, install directly from the fixed GitHub commit instead of npm.
- Read-only functionality is unaffected in every version and remains safe to use.

## Reporting

Questions about this advisory: `operators@exergynet.org`.
