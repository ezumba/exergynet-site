# MCP External Security Remediation — 2026-08-27

**Directive:** VP Sales Directive 005, §9
**Scope:** the independent MCP Vouch security scan of `exergynet-mcp-server`, whether its findings still reproduce, and remediation.

> **UPDATE — 2026-08-28 (VP Sales Directive 006):** the §0 critical finding below was escalated to a formal P0 incident and has been fixed. `exergynet_open_job` is disabled as of commit `f3f4edc` on the `exergynet-mcp-server` repository's `main` branch (version 0.2.3) — it now performs no network call, signing, or calldata construction under any configuration, and the package's `ethers`/`viem` signing dependencies have been removed entirely. npm publication remains pending (no registry credentials available in this environment). Full incident record: `MCP_P0_CONTRACT_INCIDENT_2026-08-28.md`, `MCP_PUBLISHED_ARTIFACT_PROVENANCE_2026-08-28.md`, `PUBLIC_CONTRACT_ADDRESS_REGISTRY_2026-08-28.md`, `MCP_SECURITY_ADVISORY_2026-08-28.md`. The MCP Vouch category remediation (§18 onward, below) remains open and deliberately deferred until after npm publication, per Directive 006 §18/§19.

**Critical scope note before the findings below:** while investigating this package for narrative and security remediation, direct inspection of the actually-published npm tarball (`exergynet-mcp-server@0.2.2`, fetched read-only via `npm pack` — not assumed from the GitHub repo) surfaced a defect materially more serious than stale marketing language. That finding is reported first, separately from the MCP Vouch category-by-category remediation, because it changes the risk calculus for the whole package.

---

## 0. Critical finding: shipped package targets a retired, access-control-unknown contract

**No code was modified in the `exergynet-mcp-server` repository during this investigation.** Everything below is read-only inspection: a `git clone` of `github.com/ezumba/exergynet-mcp-server`, direct comparison against `npm pack exergynet-mcp-server@latest` (the real, currently-installable 0.2.2 tarball), and comparison against this site's own `proof.html`.

**What the published package actually does.** `exergynet-mcp-server@0.2.2`'s shipped `dist/index.js` includes a real `exergynet_open_job` tool. When an operator configures a real `BASE_PRIVATE_KEY` and `RPC_URL` (exactly as the package's own README instructs), calling this tool will: check the wallet's USDC balance, approve USDC spend if needed, and call `openJob()` on a hardcoded Base Mainnet contract address:

```
0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f
```

**This is the exact contract `proof.html` — this site's own canonical verification page — labels retired**, stating explicitly: *"The former contract beginning `0x5CFE…` is retired and is not part of the current verification infrastructure."* Per `VAULT_LEDGER.md`, this contract was deployed by a wallet later found to be compromised, and its `owner()`/`architectTreasury()`/`paused()` getters all revert — meaning its access-control state is unknown and it cannot be confirmed whether the compromised key retains control of it.

**Practical consequence:** anyone who installs `exergynet-mcp-server` via `npx -y exergynet-mcp-server` and follows its own README to configure a funded wallet is directed by the tool itself to approve USDC spend and send a transaction to a contract this same company's own status page says should not be used. The current V5 contract (`0xbb14956a88BaD822Ef38e96fF337a088b41c72be`) is not referenced anywhere in the package.

**Verification method (so this can be independently re-checked):**
1. `git clone https://github.com/ezumba/exergynet-mcp-server.git` — read-only clone, confirmed public repo.
2. `npm pack exergynet-mcp-server@latest` in a separate directory — downloads the actual tarball anyone running `npx` would receive, independent of the GitHub repo.
3. Byte-level diff of the GitHub repo's checked-in `dist/index.js` against the npm tarball's `dist/index.js`: **functionally identical** (the only difference is EIP-55 checksum letter-casing on the same address — `0x5CFE...` vs `0x5cfE...` — the same contract either way). This confirms the GitHub repo's `dist/index.js` is genuinely what's shipped.
4. Cross-referenced the hardcoded address against `proof.html`'s STATUS NOTICE for the retired contract.

**A second, related finding: the published `dist/index.js` does not correspond to the repository's own `src/index.ts`.** The committed TypeScript source (`src/index.ts`) implements a completely different, simpler, Solana-only, read-only server (four tools, no private key, no fund movement, a different program ID) that has nothing to do with the Base L2/EVM/USDC-escrow logic actually shipped in `dist/index.js`. A third generation of code also exists as stale, unreferenced build artifacts (`src/index.js`, `src/index.d.ts` and their source maps) implementing yet another, older variant that reads a Solana keypair directly from `~/.config/solana/id.json`. **None of the three versions agree with each other, and only the compiled `dist/index.js` — which does not appear to build from the committed `src/index.ts` — is what actually ships.** This means an external reviewer who reads the linked GitHub source to evaluate what `npx -y exergynet-mcp-server` will do would be evaluating the wrong code. This is itself a supply-chain-provenance issue (see MCP10 below).

**What this report does NOT do:** it does not modify `dist/index.js`, `src/index.ts`, or any other file in this repository. Swapping the hardcoded address to the current V5 contract without first verifying V5's function signatures match the ABI this code calls (`openJob(bytes32)`, `settleExergy(bytes32,bytes,bytes,address)`) could silently break the tool rather than fix it, and is an engineering decision requiring the operator's direct involvement, not a documentation-pass judgment call.

**Recommended next action (for the operator, not executed here):**
1. Decide whether `exergynet_open_job` should remain enabled. If yes, verify V5's ABI compatibility before repointing `MEMBRANE_ADDR`, or add an explicit guard that returns a clear "not currently available — retired contract" message instead of attempting the transaction, until a verified current address is wired in.
2. Reconcile `src/index.ts` to actually match what's shipped (or replace `dist/index.js` with a real build of the intended current source) so the public repository's source corresponds to the published package.
3. Treat this as higher priority than the MCP Vouch category remediation below — this is a live financial-risk path, not a documentation gap.

---

## 1. MCP Vouch scan record

- **Scanner:** MCP Vouch (`github.com/Incultnitollc/mcp-vouch`), hosted at `mcp-registry-dh5.pages.dev` (the `mcpvouch.com` domain redirects here). Scores against the OWASP MCP Top 10.
- **Scanned identifier:** `io.github.ezumba/exergynet`
- **Scanned package version:** `0.1.10` — published 2026-05-07
- **Scan date:** 2026-07-09
- **Score:** 71/100, Grade C
- **Current published version at time of this report:** `0.2.2` (published 2026-05-19) — **the scan is four releases behind current.** Any citation of "71/100" should be qualified as describing a since-superseded build, not necessarily current code.

## 2. Per-category findings and current reproduction assessment

Reproduction assessed by direct inspection of the current `0.2.2` source (see §0) — no automated re-scan was run (no scanner credentials/access available in this session).

| Check | Category | Original result | Current reproduction (code inspection, 0.2.2) | Assessment |
|---|---|---|---|---|
| MCP01 | Tool Poisoning | PASS (10/10) | Tool descriptions are static strings, not user-influenced at runtime | Still passes |
| MCP02 | Insufficient Input Validation | WARN (5/10) | `exergynet_estimate_gate` coerces all numeric args via `Number(x) \|\| 0` — malformed/non-numeric input silently becomes `0` rather than being rejected. `exergynet_open_job` takes no validated `opcode` schema enforcement beyond JSON-Schema type checking (present in the schema, but the handler doesn't re-validate `opcode` values against a known set before use). | **Still reproduces** — confirmed by code inspection |
| MCP03 | Resource Injection | SKIP (N/A, stdio) | Transport unchanged (stdio) | Not applicable, as before |
| MCP04 | Unauthorized Capability Exposure | PASS (10/10) | Tool list is fixed at registration; no dynamic capability escalation found | Still passes |
| MCP05 | Missing Authentication | SKIP (N/A, stdio) | Transport unchanged | Not applicable, as before |
| MCP06 | Insecure Transport | SKIP (N/A, stdio) | Transport unchanged | Not applicable, as before |
| MCP07 | Shadow Tool Registration | PASS (10/10) | Tools registered once at startup via a single static list | Still passes |
| MCP08 | Lack of Audit and Telemetry | WARN (5/10) | No logging/audit trail of tool invocations, no record of `exergynet_open_job` calls beyond the on-chain transaction itself and a generic `console.error` on fatal startup failure only | **Still reproduces** — confirmed by code inspection |
| MCP09 | Inadequate Rate Limiting | WARN (5/10) | No rate limiting logic anywhere in the 162-line handler | **Still reproduces** — confirmed by code inspection |
| MCP10 | Supply Chain Risk | WARN (5/10) | Confirmed and **worse than the original scan likely captured**: (a) the published `dist/index.js` targets a retired, access-control-unknown contract (§0); (b) the public GitHub repository's own committed `src/index.ts` does not correspond to what's actually shipped, so reading the linked source does not tell a reviewer what they're actually running; (c) an `ethers` runtime dependency is imported and used for real on-chain signing with no further scoping/allowlisting of contract interaction beyond the two hardcoded addresses | **Still reproduces, and the underlying risk is more severe than a category label conveys** |

## 3. Remediation performed this pass

**None to the running code**, per the scope decision in §0 — the retired-contract and source/package mismatch findings require operator judgment on contract ABI compatibility that this pass is not positioned to make safely. No commits were made to `exergynet-mcp-server`.

**Documentation/metadata remediation was drafted but not committed**, for the same reason: an accurate README/manifest description depends on first resolving which code is actually intended to ship (the Base L2/EVM tool as documented, or the Solana-only read-only tool the TypeScript source implements) — writing polished documentation for either one, without that resolution, risks documenting something that still won't match what actually runs.

## 4. Rescan status

Not requested. MCP Vouch's own scan page invites self-service re-scanning via `npx mcpr scan`; this session has no reason to run a scanner against production credentials/infrastructure without the operator's direct involvement, and a rescan before the §0 finding is resolved would still surface the same MCP10 warning at minimum.

## 5. Target framing (per Directive §9)

The goal stated in the directive is *"independently observable improvement supported by actual engineering changes,"* not a specific score. Given the severity of the §0 finding, the honest current status is: **score remains 71/100 (on a now-stale build); the actual current build has at least one issue more serious than what was scored.** This is reported as required by the directive rather than minimized.
