# MCP Published Artifact Provenance — 2026-08-28

**Directive:** VP Sales Directive 006, §1/§17
**Method:** every claim below was checked by directly downloading the real npm tarball (`npm pack`), not by trusting the GitHub repository, the registry's cached metadata, or any prior document.

---

## Full published version list (`exergynet-mcp-server`)

| Version | Published | Recorded `gitHead` | Commit exists in repo? | `gitHead` matches actual published content? |
|---|---|---|---|---|
| 0.1.0 | 2026-04-25T20:44:03Z | *(none recorded)* | N/A | **No — provenance gap.** No source commit on record for this release. |
| 0.1.1 | 2026-04-25T20:58:45Z | *(none recorded)* | N/A | **No — provenance gap.** |
| 0.1.2 | 2026-04-25T21:04:36Z | *(none recorded)* | N/A | **No — provenance gap.** |
| 0.1.3 | 2026-04-26T08:02:31Z | `3286cfb...` | Yes | Not independently re-checked this pass |
| 0.1.9 | 2026-05-05T18:05:50Z | `5de6265...` | Yes | Not independently re-checked this pass |
| 0.1.10 | 2026-05-07T00:08:36Z | `feeafa1...` | Yes | Not independently re-checked this pass — this is the version MCP Vouch scanned |
| 0.1.11 | 2026-05-09T16:34:22Z | `dc48891...` | **No — `git cat-file` fails: object does not exist in the repository.** | **No — confirmed provenance gap.** The exact source for this published version no longer exists anywhere in the public repository's history. |
| 0.1.12 | 2026-05-10T07:33:06Z | `7dcf9c7...` | Yes | Not independently re-checked this pass |
| 0.1.13 | 2026-05-10T08:24:34Z | `69aca1b...` | Yes | Not independently re-checked this pass |
| 0.1.14 | 2026-05-10T08:35:17Z | `69aca1b...` | Yes | Not independently re-checked this pass |
| 0.2.0 | 2026-05-12T18:50:56Z | `faeaaa2...` | Yes | Not independently re-checked this pass |
| 0.2.1 | 2026-05-16T18:18:07Z | *(none recorded)* | N/A | **No — provenance gap.** |
| **0.2.2** | 2026-05-19T17:13:29Z | `c1a3466a869437e4d007684394440f6b1271a05e` | Yes | **Partially — see below.** |

## The 0.2.2 ↔ `c1a3466` mismatch, in detail

npm's registry records `gitHead: c1a3466a869437e4d007684394440f6b1271a05e` for the published 0.2.2 tarball. That commit exists in the repository. But comparing the actual downloaded tarball (`npm pack exergynet-mcp-server@0.2.2`) against that exact commit's tree:

| File | Match? |
|---|---|
| `dist/index.js` | **Yes, functionally.** Byte-identical except for the letter-casing of one address (`0x5CFE...` vs `0x5cfE...` — the same address either way; EIP-55 checksum casing only). |
| `package.json` | **No.** The commit's `package.json` says version `0.2.0` and lists three dependencies (`@modelcontextprotocol/sdk`, `@solana/web3.js`, `ethers`). The actually-published 0.2.2 `package.json` says version `0.2.2`, lists five dependencies (adds `dotenv` and `viem`, neither of which is imported anywhere in the shipped `dist/index.js`), and has a longer keyword list (adds `depin`, `x402`, `base`, `zk-proof`, `sensor-data`, `physical-data`). |
| `README.md` | **No — substantially different.** The commit's README describes "the ExergyNet thermodynamic compute clearinghouse" with a single documented tool. The published 0.2.2 README describes "physical-reality ZK proof infrastructure," a ten-opcode physical-sensor marketplace (camera, GPS, biometric gate, etc.), and an x402 pay-per-call API — **none of which exists anywhere in the actual shipped `dist/index.js`.** The real handler for `exergynet_open_job` silently ignores the documented `opcode` parameter entirely. |

**Conclusion: the `gitHead` provenance link recorded by npm for 0.2.2 is unreliable.** The build output happens to match closely enough to audit (one cosmetic difference), but the manifest and documentation shipped to real users did not come from the commit npm says they did. This is a distinct defect from the missing/nonexistent `gitHead` entries above — it is a case where provenance metadata exists, points to a real commit, and is still wrong.

## Separate finding: `src/index.ts` never matched what was shipped

The commit that introduced the Base L2 `exergynet_open_job` functionality (`c1a3466`, "feat: v0.2.0 - Base Mainnet LNES-04 openJob + S3 binding") changed only `dist/index.js`, `package.json`, and `package-lock.json`. **It did not touch `src/index.ts` at all.** The TypeScript source in that commit (and every commit after it, until this incident's fix) implemented a completely different, Solana-only, read-only server. This means: from v0.2.0 onward, there was no source file anywhere in the repository from which the actually-shipped `dist/index.js` could have been rebuilt. The compiled output was authored and committed directly, bypassing the project's own `tsc` build step.

This is now corrected: as of commit `f3f4edc`, `dist/index.js` is built fresh from `src/index.ts` via `npm run build`, and the working tree was verified clean (no diff) after that rebuild — the source and the shipped artifact match exactly.

## Stray artifacts found and removed

- `src/index.js`, `src/index.d.ts` (and their `.map` files): a third, even older generation of the code — reads a Solana keypair directly from `~/.config/solana/id.json`, uses a different dependency (`exergynet-agent-sdk-core`) not present in `package.json`, and calls hardcoded empty `PublicKey("")` arguments that would throw if ever executed. Confirmed unreferenced by any build script or the npm `"files"` allowlist — never shipped. Removed as dead weight, not functional code.
- `mcp_gateway.log`: a committed runtime log from the separate Rust HTTP gateway component (`src/main.rs`, out of scope for this incident) showing six `exergynet_open_job` invocations from one Solana-format agent identity, timestamped May 11–12 2026 — this independently corroborates the six on-chain transactions found in this incident's forensics. A copy was preserved as evidence before removal from the repository (operational logs should not be committed).
- `node_modules/` (~8,000 files) was committed to the repository at HEAD, unrelated to this incident but discovered while investigating it. Untracked in a separate, clearly-labeled commit; files remain on disk, no functional change.

## Reproducible release chain, going forward

As of the fix commit:

```
git commit f3f4edc  →  npm run build (tsc)  →  npm pack  →  sha512-YAPWP8Y8...9p5PI6V12Jr6w==
```

`npm run build` followed immediately by `git status` shows no diff — the committed `dist/index.js` is exactly what a fresh build of the committed `src/index.ts` produces. This was not true for any version from 0.2.0 through 0.2.2.

**Not implemented this pass** (per the directive's own "emergency containment first, hardening second" instruction): CI-enforced provenance (e.g. npm provenance attestations, a required `gitHead`-matches-tag check before publish), or a full audit of the separate Rust gateway component. Recommended for a follow-up hardening pass, not this incident's closure.
