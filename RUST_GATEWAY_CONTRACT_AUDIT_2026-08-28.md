# Rust Gateway Contract Audit — 2026-08-28

**Directive:** VP Sales Directive 007, §16
**Trigger:** Directive 006 found `mcp_gateway.log` (a committed runtime log, since removed from the repo) showing six `exergynet_open_job` invocations from the separate Rust HTTP gateway component, matching the six real on-chain transactions to the retired contract. That component was explicitly left unaudited at the time. This document closes that gap.

## Repository / path

`github.com/ezumba/exergynet-mcp-server`, `src/main.rs` (109 lines) + `Cargo.toml`. This is the only `.rs` file in the repository (confirmed via `find . -name "*.rs"`).

## Whether deployed anywhere

**Not found at the one documented public endpoint.** `mcp.html` documents this gateway at `https://exergynet.org/mcp` (POST, Ed25519-signed). Direct verification:

- `GET https://exergynet.org/mcp` → HTTP 200, `Server: GitHub.com`, returns the static `mcp.html` page content itself (GitHub Pages serving the extensionless route to the static file).
- `POST https://exergynet.org/mcp` → HTTP 405, served by the same static-hosting stack (Varnish/Fastly headers), not an application-level rejection.

**Conclusion: the documented endpoint is not this Rust binary, or any live backend — it resolves to static site content.** The gateway is not currently reachable at the address the site itself documents.

A separate, genuinely live, distinct backend was found at `https://mcp.exergynet.org/sse` (HTTP 200, `Content-Type: text/event-stream`, `Server: uvicorn`) — this is a **different, Python (uvicorn/FastAPI-based) service**, confirmed to be `omega_carrier/omega_carrier_mcp.py` in the main `exergynet` repository by its use of `mcp.sse_app()` / `uvicorn.run()`. Its tool set (`initialize_sovereign_identity`, `vault_commit_state`, `vault_recall_state`, `witness_external_site`, `check_exergy_reserve`, `strike_rho_recursion`, `execute_rho_strike`, `recall_vault_memory`, `issue_memory_receipt`, others) does not include `exergynet_open_job` or `exergynet_settle_exergy` by name — it is not the same component, and grepping its source finds no reference to the retired address either. A full audit of *that* service's `strike_rho_recursion`/`execute_rho_strike` tools (which sound fund-adjacent) is outside this directive's scope and is flagged as a separate follow-up item, not resolved here.

**This session has no SSH or API access to ExergyNet's EC2 infrastructure (Carrier/Portal), so deployment of the Rust binary specifically cannot be ruled out there** — only ruled out at the one public URL the site itself documents. The committed `mcp_gateway.log` (banner: `[MCP] NEURAL GATEWAY IGNITED`, `nohup: ignoring input`) is consistent with it having been run at least once in what looks like a local/manual `nohup ... &` invocation, not necessarily a managed production deployment.

## Whether it still contains the retired address

**No.** Confirmed by reading the complete 109-line source: zero address literals of any kind (`grep -c "5cfE\|5CFE" src/main.rs` → 0).

## Whether it can sign transactions

**No — structurally, not just by configuration.** `Cargo.toml`'s dependency list is `axum`, `tokio`, `serde`, `serde_json`, `jsonrpc-core`, `ed25519-dalek`, `bs58` — no blockchain client library of any kind (no `ethers`, `web3`, `alloy`, `solana-sdk`, `solana-client`). The code itself:

1. Verifies an incoming Ed25519 signature against a client-supplied public key (authentication only).
2. Checks a 60-second timestamp window and an in-memory nonce set (replay protection).
3. For `method == "exergynet_open_job"` or `"exergynet_settle_exergy"`, returns a **static, hardcoded JSON response** — `{"status": "proxy_initiated", "verified": true}` or `{"status": "settlement_initiated", "verified": true}` — and does nothing else.

There is no RPC call, no wallet, no private key, no contract binding, and no code path that could construct or broadcast a transaction to any chain, retired contract or otherwise.

## Signer source / chain

Not applicable — this component holds no signing key and makes no on-chain calls.

## How this reconciles with the six real on-chain transactions

The `mcp_gateway.log` entries ("Authorized Agent (...) executed: exergynet_open_job") correspond exactly to this file's own log line (`println!("[MCP] Authorized Agent ({}) executed: {}", ...)`), confirming the log came from this component. But since this component cannot itself submit a transaction, the six real on-chain calls found in Directive 006's forensics (from wallet `0xbd1e790f6040...`, May 2026) must have been executed by a **separate** process — almost certainly the npm package's own `dist/index.js` (which does have real `ethers`-based signing logic), run directly by whoever held `BASE_PRIVATE_KEY` at the time, independent of whatever this gateway's "proxy_initiated" acknowledgment was for. This gateway is best understood as an authentication/authorization front door for a Solana-identity-based agent flow, decoupled from the actual EVM execution path — not a single fund-moving pipeline.

## Current runtime status

Unconfirmed with certainty. Not live at the one documented public URL. Cannot be confirmed or ruled out on internal infrastructure this session has no access to.

## Conclusion (per the directive's own test)

> "This is a P0 if an active gateway can still reach the retired contract."

**It cannot, under any runtime status.** Even if this exact binary is running somewhere this session cannot see, it has no capability to reach any contract at all — retired, current, or otherwise. No further containment action is required for this specific component. The recommendation is to archive/document it as a known, audited, non-fund-moving authentication stub, and to schedule the separate `omega_carrier_mcp.py` service's fund-adjacent tools (`strike_rho_recursion`, `execute_rho_strike`) for a dedicated audit in a future directive, since that is the genuinely live, uvicorn-served backend and this pass did not verify its internal signing/execution logic beyond confirming the retired address string does not appear in it.
