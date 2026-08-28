# MCP Release Provenance — 0.2.5

**Directive:** VP Sales Directive 008, §1–§2 and §18

**Relationship to 0.2.4:** this is a dependency-hygiene follow-up, not a reopening of the P0 incident that 0.2.4 closed. 0.2.4 remains the safe, published, `latest` release that fixed the write-path defect (retired-contract targeting) and the MCP Vouch remediation items (input validation, audit logging, rate limiting). 0.2.5 additionally resolves the four remaining moderate-severity `npm audit` findings. A short summary of 0.2.5 also lives in `MCP_RELEASE_PROVENANCE_0.2.4.md`'s addendum section; this document is the canonical, detailed record going forward — if the two ever disagree, this one wins.

---

## What 0.2.5 fixes

`npm audit` against 0.2.4's dependency tree reports four moderate-severity advisories, all reachable via one path: `@solana/web3.js` → `jayson` → `uuid@8.3.2`. The destructive fix npm itself suggests, `npm audit fix --force`, would downgrade `@solana/web3.js` to a non-functional pre-1.0 version — explicitly rejected, per instruction, as an unacceptable trade.

**The actual fix:** a `package.json` `overrides` entry —

```json
"overrides": {
  "jayson": {
    "uuid": "^11.1.1"
  }
}
```

This forces only `jayson`'s nested `uuid` dependency to a patched version, leaving `@solana/web3.js` itself untouched. `rpc-websockets` (a separate dependency of `@solana/web3.js`) resolves its own `uuid@14.0.2` independently and was never part of the vulnerable path — confirmed via `npm ls uuid`.

## The chain, end to end

```
Git commit  →  npm run build (tsc)  →  npm pack  →  npm registry integrity
```

| Field | Value |
|---|---|
| Source commit | [`45f5e29`](https://github.com/ezumba/exergynet-mcp-server/commit/45f5e29) on `main` |
| Parent commit | `7064acc` (0.2.4) |
| Verification method | **Fresh clone** (not the working checkout used to develop the fix) — `git clone` → `git checkout main` → `git pull --ff-only` → confirmed `git rev-parse --short HEAD` = `45f5e29` |
| Build command | `npm ci` (lockfile-exact install, not `npm install`) → `npm run build` → `tsc && chmod +x dist/index.js` |
| Test command | `npm test` → `node --test tests/*.test.mjs` |
| Test result | **9/9 passing** |
| `npm audit` result | **0 vulnerabilities** (was 4 moderate on 0.2.4's tree) |
| Reproducibility check | `npm run build` immediately followed by `git status --short` shows a diff in `dist/index.js` and `dist/index.d.ts` — investigated and confirmed to be the same benign Windows-CRLF-vs-committed-LF line-ending artifact documented for 0.2.4 (`diff` after stripping `\r` shows zero content difference). Not a real reproducibility failure. |
| Package version | `0.2.5` |
| Tarball filename | `exergynet-mcp-server-0.2.5.tgz` |
| Local build shasum (Windows/CRLF — **not authoritative**, see caveat below) | `321b09c22ffb7abbd83d745ae3824df0c11fbb44` |
| Local build integrity (same caveat) | `sha512-3VGj5KQA+IiUUjcRpC9P7Yr63+oBUqQByQNCxIq91XnqR7CyTnY7JYnV7oOfLxEkv9ppIitvW1KlSIDlVMudjA==` |
| Packed file list | `README.md`, `dist/index.d.ts`, `dist/index.js`, `package.json` — matches 0.2.4's file list exactly |
| Publication status | **Source ready on `main`. Not yet published to npm** — requires the operator's own `npm login`/`npm publish` access, same credential boundary as every prior npm-publish step in this incident chain. |

**Hash caveat, same lesson as 0.2.4:** the shasum/integrity values above were produced on this session's Windows environment, where git checkout normalizes line endings to CRLF. Do not treat them as the value to expect from the actual npm-published tarball — once published, pull the authoritative values fresh via:

```bash
npm view exergynet-mcp-server@0.2.5 dist.shasum
npm view exergynet-mcp-server@0.2.5 dist.integrity
```

and update this document with those values, not the ones recorded here.

## Functional regression testing beyond the standard suite

Because this fix touches a dependency in the only tool that makes a real network call (`exergynet_verify_program`, via `@solana/web3.js`), the standard 9-test suite was supplemented with a live smoke test: a real JSON-RPC `tools/call` invocation of `exergynet_verify_program` against the actual Solana Mainnet-Beta RPC endpoint, run against the overrides-patched dependency tree. Result: `{"exists":true,"executable":true}` — correct, and identical in shape to the pre-fix behavior. This confirms the `uuid` override does not alter `@solana/web3.js`'s real request/response handling.

## Exact publish sequence prepared for the operator

Identical pattern to 0.2.4's handoff in `MCP_INCIDENT_CLOSURE_2026-08-28.md` — nothing here should be pasted into any chat interface:

```bash
git clone https://github.com/ezumba/exergynet-mcp-server.git
cd exergynet-mcp-server
git checkout main
git pull --ff-only origin main
git rev-parse --short HEAD
# Expect: 45f5e29

npm ci
npm test
# Expect: 9 pass, 0 fail
npm run build
npm audit
# Expect: found 0 vulnerabilities
npm pack --dry-run
git status --short
# A dist/ diff here is expected and benign (CRLF/LF) if building on Windows;
# on Linux/macOS it should show no diff at all.

npm login          # interactive — your own credentials, not shared here
npm publish

# Immediately verify what was actually published — do not trust step above alone:
npm view exergynet-mcp-server version
npm view exergynet-mcp-server@0.2.5 dist.integrity
npm view exergynet-mcp-server@0.2.5 dist.shasum

# Confirm ordinary install resolves to it:
mkdir /tmp/verify-0.2.5 && cd /tmp/verify-0.2.5
npm init -y && npm install exergynet-mcp-server
npm list exergynet-mcp-server
# Expect: exergynet-mcp-server@0.2.5
```

**Do not deprecate 0.2.4.** It remains a safe, historical, fully-fixed release for the P0 write-path defect; 0.2.5 is additive hardening, not a replacement for a defective release. See Directive 008 §3.

## Independent re-verification, 2026-08-28 (Directive 009 §0–§1)

Per Directive 009's instruction to "independently rerun" the pre-publish sequence rather than trust the prior pass's result, this was repeated from a **second, completely fresh clone** (not the worktree used to develop the fix, and not the clone used for the first verification pass):

| Check | Result |
|---|---|
| Source commit | `45f5e29` (confirmed via `git log -1` on the fresh clone — matches expected) |
| `npm ci` | 150 packages installed, 0 vulnerabilities at install time |
| `npm test` | 9/9 passing |
| `npm run build` | succeeds |
| `npm audit` | 0 vulnerabilities |
| `git status --short` after build | shows a `dist/` diff — re-confirmed as the same benign Windows-CRLF-vs-committed-LF artifact via `diff` after stripping `\r` (byte-identical content) |
| `npm pack --dry-run` shasum | `321b09c22ffb7abbd83d745ae3824df0c11fbb44` — **identical to the first verification pass's local-build hash**, run from a separate clone. This is a positive reproducibility signal: two independent clones of the same commit produce byte-identical (modulo line endings) local builds. |
| `npm pack --dry-run` integrity | `sha512-3VGj5KQA+IiUUjcRpC9P7Yr63+oBUqQByQNCxIq91XnqR7CyTnY7JYnV7oOfLxEkv9ppIitvW1KlSIDlVMudjA==` — identical to the first pass |
| Package version | `0.2.5`, confirmed |

**Publication status: unchanged — still not published to npm.** This session does not have and will not request the operator's npm account credentials. This re-verification exists so that when the operator does run `npm publish`, they're publishing a version whose local build has now been independently reproduced twice, not once.
