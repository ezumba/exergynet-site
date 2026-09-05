# MCP Release Provenance — 0.2.4

**Directive:** VP Sales Directive 007, §15 (originally scoped as `MCP_RELEASE_PROVENANCE_0.2.3.md`; see naming note below)

**Naming note:** Directive 007 named this deliverable for version 0.2.3. Between that directive being written and this pass executing it, 0.2.3 was superseded by 0.2.4 (the MCP Vouch remediation, §10) before either version was ever published — see `MCP_INCIDENT_CLOSURE_2026-08-28.md` for why. Since neither version has shipped to a real user yet, this document records provenance for the version that will actually be published, rather than for an intermediate version deliberately never released. 0.2.3's own chain is a strict subset of this one (same source lineage, same commit ancestor `f3f4edc`).

---

## The chain, end to end

```
Git commit  →  npm run build (tsc)  →  npm pack  →  npm registry integrity
```

| Field | Value |
|---|---|
| Source commit | [`7064acc`](https://github.com/ezumba/exergynet-mcp-server/commit/7064acc) on `main`, `github.com/ezumba/exergynet-mcp-server` |
| Parent commit (fail-closed fix, no Vouch remediation) | `f3f4edc` |
| Build command | `npm run build` → `tsc && chmod +x dist/index.js` |
| Test command | `npm test` → `node --test tests/*.test.mjs` |
| Test result | **9/9 passing** (5 from the P0 fix: retired-address absence, no `*PRIVATE_KEY` env var, no `ethers`/`viem` import, no bare EVM address literal, fail-closed behavioral test; 4 new from Vouch remediation: input-validation rejection ×2, malformed-URL rejection, audit-log presence) |
| Package version | `0.2.4` |
| Tarball filename | `exergynet-mcp-server-0.2.4.tgz` |
| Tarball shasum (as published, verified against npm 2026-08-28) | `8a264a276106f513e013638ac020ed72a57b826c` |
| npm integrity (sha512, as published, verified against npm 2026-08-28) | `sha512-z8Av07y/J9pj/hi4v6Jyi3bSiM4dMmQvIs2seroATcfreiBG95l8auCrbXtypUL/vxAEY8c5fF4kI5eNsVwv7g==` |
| Packed file list | `README.md`, `dist/index.d.ts`, `dist/index.js`, `package.json` (4 files — matches `"files": ["dist"]` plus npm's always-included `README.md`/`package.json`) |
| Publication time | **Published.** Confirmed live via `npm view exergynet-mcp-server version` → `0.2.4`, and `dist-tags.latest` → `0.2.4`. |

**Reproducibility check performed:** `npm run build` followed immediately by `git status` shows zero diff — the committed `dist/index.js` is exactly what a fresh build of the committed `src/index.ts` produces. This directly closes the provenance gap Directive 006 found (where npm's `gitHead` for 0.2.2 pointed to a real commit whose `package.json`/`README.md` didn't match what was actually published, and whose `dist/index.js` didn't correspond to its own committed `src/index.ts` at all).

**Hash correction (2026-08-28, post-publication):** the shasum/integrity values originally recorded in this document (`e79d885c...`, `sha512-5roYoat...`) were produced by a local build on a Windows session, where git's checkout normalizes line endings to CRLF. The actual npm-published tarball (built and published from a Linux/macOS environment, per normal npm tooling) uses LF line endings. `diff --strip-trailing-cr` between the two `dist/index.js` copies shows **zero content differences** — this was a line-ending artifact of the local verification environment, not a discrepancy in the shipped code. The npm-published hash above is the authoritative one; the original local-build hash is retained nowhere further and should not be compared against future publications without normalizing line endings first.

## What this closes vs. what it doesn't

**Closes:** for this specific release, the published `gitHead` (once set by `npm publish` from this commit) will correspond exactly to the actual published `package.json`, `README.md`, and `dist/index.js` — verified by direct comparison, not assumed.

**Does not close:** no CI-enforced provenance gate exists yet (e.g. `npm provenance`, a required "tarball hash == expected hash" check before publish, or a branch-protection rule preventing a hand-edited `dist/` from being committed without a matching `src/` rebuild). This is recommended as a follow-up hardening item, consistent with Directive 006's "emergency containment first, hardening second" sequencing — not addressed in this pass, which is about closing this specific incident's release, not rebuilding the whole release pipeline.

## Post-publish verification — results (2026-08-28)

Per Directive 007 §5, closure requires **npm artifact = verified safe behavior**, not merely a successful `npm publish`. All four steps below were independently re-run against the actual published registry entry, not against the local build or the operator's report of success:

1. `npm view exergynet-mcp-server version` → **`0.2.4`** ✅
2. `npm pack exergynet-mcp-server@0.2.4` in a clean directory (not this checkout) → tarball downloaded and unpacked; shasum/integrity recorded above are from this download, not the local build ✅
3. Unpacked the downloaded tarball independently: confirmed retired address `0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f` is absent from `dist/index.js` (only appears in `README.md`'s intentional advisory text); confirmed `exergynet_open_job` returns the fail-closed message via a live stdio JSON-RPC call, with no transaction constructed, signed, or submitted, and no private-key read, under any tested configuration ✅
4. `npm install exergynet-mcp-server` (no version pin) in a clean scratch directory → resolves to `0.2.4`, not a cached `0.2.2`; `npm list exergynet-mcp-server` confirms ✅

**Deprecation confirmed** (independently, via `npm view exergynet-mcp-server@<version> deprecated`): 0.2.0, 0.2.1, and 0.2.2 all carry the exact non-inflammatory required wording ("the write-transaction path in this version references a retired contract..."); 0.1.x carries no deprecation notice, correctly, since the affected Base L2 write path was introduced in 0.2.0.

## 0.2.5 — supply-chain follow-up (source published, npm publish still pending)

A routine follow-up, not a reopening of this incident. 0.2.4 remains the safe, published release; 0.2.5 additionally resolves the four moderate-severity `npm audit` findings (transitive `uuid@8.3.2` via `@solana/web3.js` → `jayson`) via a targeted `package.json` `overrides` entry pinning `jayson`'s `uuid` to `^11.1.1`, **without downgrading `@solana/web3.js`** (the destructive alternative, `npm audit fix --force`, would have forced it to a non-functional pre-1.0 version and was explicitly avoided per instruction).

| Field | Value |
|---|---|
| Source commit | [`45f5e29`](https://github.com/ezumba/exergynet-mcp-server/commit/45f5e29) on `main` |
| Parent commit | `7064acc` (0.2.4) |
| Fix mechanism | `package.json` → `"overrides": { "jayson": { "uuid": "^11.1.1" } }` |
| Verification | `npm audit` → 0 vulnerabilities (was 4 moderate); full rebuild succeeds; 9/9 regression tests pass; live `exergynet_verify_program` call against Solana Mainnet-Beta confirms no functional regression from the override |
| Package version | `0.2.5` |
| Local build tarball shasum (Windows/CRLF — see hash-correction note above; not authoritative) | `dbfc9f67bff6f91f2aebe1660d480fedcd44e187` |
| Local build integrity (same CRLF caveat) | `sha512-ImHnfAkXO+jIw3gwUvCabvIs+3Twx/GTbZ58exHaoGZCmt72ZqbHCjyziQ4W4/z33KrX4ePyTMClxr4jacxt8g==` |
| Publication status | **Source committed and pushed to `main`. Not yet published to npm** — same credential gap as 0.2.4; requires operator `npm login`/`npm publish` access. This is a lower-priority hardening follow-up, not a blocker on anything currently gated (0.2.4 is already the safe published release). |

Once published, the authoritative shasum/integrity must be re-pulled from `npm view exergynet-mcp-server@0.2.5 dist.shasum` / `dist.integrity` — do not treat the local Windows-build values above as ground truth, per the same lesson learned from 0.2.4.
