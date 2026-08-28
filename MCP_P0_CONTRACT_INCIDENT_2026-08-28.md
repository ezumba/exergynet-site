# MCP P0 Contract Incident — Master Report

**Directive:** VP Sales Directive 006 — Emergency MCP Package Containment, Contract Forensics, and Safe Migration
**Status: CLOSED for the containment phase.** Fix is written, tested, and pushed to the source repository. npm publication is pending credentials (see status notes throughout). No on-chain or fund-moving action was taken or is required.

See also: `MCP_PUBLISHED_ARTIFACT_PROVENANCE_2026-08-28.md`, `PUBLIC_CONTRACT_ADDRESS_REGISTRY_2026-08-28.md` (+ `public-contracts.json`), `MCP_SECURITY_ADVISORY_2026-08-28.md`, updated `MCP_EXTERNAL_SECURITY_REMEDIATION_2026-08-27.md`, updated `EXTERNAL_PROPAGATION_CHANGELOG.md`, updated `docs/WEBSITE_CHANGELOG.md`.

---

## 1. What happened

`exergynet-mcp-server` versions 0.2.0–0.2.2 (npm) shipped a working `exergynet_open_job` MCP tool. Configured with a real funded EVM wallet exactly as the package's own README instructed, it would: check USDC balance, grant an unconditional unlimited USDC spending approval, then attempt to call `openJob()` on `0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f` — a Base Mainnet contract that `proof.html` (ExergyNet's own canonical status page) identifies as retired.

## 2. Contract forensics summary

Verified live via public RPC and Blockscout on 2026-08-28 (full detail in `PUBLIC_CONTRACT_ADDRESS_REGISTRY_2026-08-28.md`):

- **Chain:** Base Mainnet (8453) — confirmed via `eth_chainId`.
- **Bytecode:** present, real contract, unverified source on Blockscout.
- **Function selectors:** the on-chain dispatcher's 7 real selectors do **not** include `openJob(bytes32)` (`0x59bac6aa`) or `settleExergy(bytes32,bytes,bytes,address)` (`0x42bfb804`) — the ABI the npm package hardcoded does not match this contract at all.
- **Access control:** `owner()` and `paused()` both revert — cannot be independently verified.
- **State:** holds a static 700,000 micro-USDC ($0.70), unchanged since first documented internally. All 6 transactions ever sent to it (confirmed via Blockscout transaction and token-transfer history) came from `0xbd1e790f6040FA62797671B84a50025a0133109C` on 2026-05-11/12. **No transaction from any other address was found.** A committed log from a separate Rust gateway component corroborates these same six calls from one agent identity. A live, near-unlimited USDC allowance from that same wallet to this contract is still outstanding (`allowance(...) ≈ type(uint256).max`, confirmed via `eth_call`) — the operator has been notified directly, since revoking it requires that wallet's own key, not an action available to this session.
- **Embedded addresses inside the bytecode** (`0x39ae1c50...`, `0x5b39e59e...`, `0x26bd71c6...`) match the previously-documented `vaultAlpha`/`vaultBeta`-equivalent/`vaultGamma` addresses of a known, already-classified pre-V5 LNES04Membrane deployment.
- **Deployer wallet status:** `0xbd1e790f6040FA62797671B84a50025a0133109C` had its key exposed in an agent/session environment (already flagged for rotation in `CLAUDE.md`'s Pending Credential Rotation list). The operator has directly confirmed they retain full access to this wallet and no third-party compromise is established — an earlier draft of this report used "compromised," which `VAULT_LEDGER.md` itself already corrects (see its 2026-07-31 and 2026-08-28 entries); that language is corrected here to match.
- **Retirement classification: access-control concern.** Not "confirmed compromise" of the contract or its deployer wallet — neither is established. The contract's own access-control getters (`owner()`/`paused()`) are unverifiable regardless of who holds the deployer key, and it does not match the current V5 architecture. This is the strongest classification the actual evidence supports, per the directive's own instruction not to overstate.

## 3. The current (V5) contract — checked, not assumed safe

Read from `contracts/src/LNES04Membrane.sol` in `exergynet-site` and independently confirmed on-chain:

- `openJob(bytes32 jobId)` and `settleExergy(bytes32 jobId, bytes seal, bytes journal, address droneNode)` — **exact ABI match** to what the npm package already assumed.
- `TOLL_AMOUNT()` on-chain = 2,000,000 (micro-USDC) — matches the package's own hardcoded `2000000n` check.
- `owner()` on-chain = `0x27cC42ee80CA945F96b93999CCdb02520618578B` (`wallet_1`, the known legitimate current deployer). `paused()` = false.

**This ABI compatibility is not treated as authorization to repoint the package at V5.** `proof.html` explicitly states this contract is operating in mock-only mode and does not accept real capital, and no evidence was found that the settlement half of the pipeline (a live prover calling `settleExergy`) is actually running end-to-end. Per the directive's governing rule — *do not point users at a contract we cannot presently prove is the intended execution target* — "intended for production use" is a separate, unmet condition from "ABI-compatible."

## 4. Remediation path chosen: **Path C**

Not because compatibility couldn't be established (it was) — because the operator's own separate, explicit declaration that the compatible contract isn't ready for real capital is an independent gate. `exergynet_open_job` is disabled: it returns a fixed fail-closed message and has no signing capability at all in the fixed version (no `ethers`/`viem` dependency exists in 0.2.3). This satisfies the required invariant: unknown/not-yet-authorized execution target ⇒ no transaction, structurally, not just by a runtime conditional.

## 5. User exposure

No evidence of any independent (non-developer) wallet ever invoking the affected flow. All six real transactions to the retired contract came from the same wallet, in a ~24-hour window in May 2026, consistent with internal testing rather than organic npm-package adoption. No funds are known to be trapped, exposed, or awaiting recovery from a third party's wallet. **No fund recovery action is required or was performed.**

A separate, related finding surfaced during this investigation: the same exposed wallet was live on three `exergynet-site` pages as the current "Operator Wallet" (`docs.html`, `protocol.html`) and as the direct target of `explorer.html`'s donation button. The operator has confirmed they retain full access to this wallet; it was replaced on these public surfaces because it is already flagged for rotation, not because of confirmed third-party control. This is corrected in this pass — see §7 below and `EXTERNAL_PROPAGATION_CHANGELOG.md`.

## 6. Fix delivered

- **Source repository:** `github.com/ezumba/exergynet-mcp-server`, `main` branch, commit `f3f4edc` (pushed, fast-forward, verified live via raw GitHub content fetch).
- **Version:** 0.2.3.
- **Tarball (built, not yet published):** `exergynet-mcp-server-0.2.3.tgz`, sha512 integrity `sha512-YAPWP8Y8663zn[...]9p5PI6V12Jr6w==`, shasum `11449ee9391ce3ac8effbb97b80376e8444e606d`.
- **Tests:** 5/5 pass — a static check that the retired address, any hardcoded EVM address, any `*PRIVATE_KEY` env var, and `ethers`/`viem` can never reappear in a build, and a behavioral test that spawns the real built server and confirms `exergynet_open_job` fails closed.
- **Active runtime references to the retired address: 0** (confirmed by repo-wide grep — the only two remaining mentions are the security advisory's own remediation instructions and the regression test that guards against reintroduction, both correctly classified as documentation/test, not runtime).
- **npm publication: not performed** — `npm whoami` returns `ENEEDAUTH` in this environment. The package is publish-ready; see `MCP_SECURITY_ADVISORY_2026-08-28.md` for the exact state and instructions for whoever holds npm credentials.
- **MCP registry update: not performed** — no registry publish credentials available. `io.github.ezumba/exergynet`'s registry entry still points to the old 0.1.10 metadata; this should be updated once 0.2.3 is on npm.

## 7. First-party website corrections (small, per §28)

- `docs.html`, `protocol.html`: the "Operator Wallet" field showed the exposed wallet; corrected to `wallet_1` (`0x27cC42ee80CA945F96b93999CCdb02520618578B`), independently confirmed on-chain as V5's actual `owner()`.
- `docs.html`: the x402 payment-manifest example's `"payTo"` field showed the same exposed wallet; corrected likewise. (The live `explorer-api.exergynet.org/x402/sensor/magnetometer` endpoint currently returns 404, so this was not being actively paid into by real traffic at time of check — but the documentation itself was wrong and is now fixed.)
- `explorer.html`: the "♥ Support ExergyNet" donation button linked directly to the exposed wallet on BaseScan; corrected to `wallet_1`.
- No page directs users to install the affected npm package by name — `mcp.html` documents a separate, unrelated HTTP gateway mechanism. **No §15 write-tool safety notice was required or added**, since no first-party surface points at the affected package.

## 8. Incident classification

**Unsafe legacy integration.** The published write path targeted a retired deployment that should no longer receive transactions. This is not classified as "confirmed compromise" of the package or the contract itself — no evidence of unauthorized modification of the npm package or malicious intent was found; the defect is best explained by configuration/address drift compounded by a broken source-to-build pipeline (see provenance report), not an attack on ExergyNet's infrastructure.

## 9. MCP Vouch (deferred, not mixed with this incident per §18)

Not addressed in this pass. The four previously-reproduced warnings (input validation, audit/telemetry, rate limiting, supply chain) remain open and are correctly treated as a separate workstream from this P0 contract-address defect, to be picked up once this incident's npm publication completes.

## 10. Marketing hold status

In effect for the remainder of this incident per §24: no pitching MCP transaction functionality, no driving traffic to `exergynet_open_job`, no advertising the MCP registry listing as a security signal. Can be lifted once npm 0.2.3 is published and verified.
