# MCP Release Provenance — 0.2.6

**Directive:** issued 2026-08-28 as a direct follow-up to Directive 009, after a clean public install of `exergynet-mcp-server@0.2.5` exposed that its dependency hardening did not reach ordinary consumers.

**Relationship to 0.2.4 and 0.2.5:** neither prior release is modified or deprecated. 0.2.4 remains the safe release that fixed the P0 write-path defect (retired-contract targeting). 0.2.5 remains a safe, fail-closed release — its `exergynet_open_job` behavior, input validation, audit logging, and rate limiting are all unchanged and correct. 0.2.5's *specific* defect was narrower than a security regression: its `package.json` `overrides` entry, meant to force a patched `uuid` version, only takes effect when `exergynet-mcp-server`'s own `package.json` is the root of an npm install. It is not honored when the package is installed as someone else's dependency — which is how virtually every real user installs it. The corrected framing:

| Version | Status |
|---|---|
| 0.2.4 | Fail-closed emergency remediation. |
| 0.2.5 | Fail-closed release with source-root dependency-resolution hardening that does not propagate to ordinary downstream npm installs. |
| 0.2.6 | Consumer dependency-graph correction. |

Do not describe 0.2.5 as having zero dependency findings universally — it has zero findings only when it is itself the install root (e.g. when developing this repo directly). Every ordinary `npm install exergynet-mcp-server` install saw four moderate findings until 0.2.6.

---

## 1. Reproduction, before any change was made

### Repo root (`main` at `b657a94`, one commit past 0.2.5)

```
npm ci                    → 150 packages, 0 vulnerabilities
npm ls uuid                → uuid@11.1.1 (overridden from jayson@4.3.0's ^8.3.2), uuid@14.0.2 (rpc-websockets, unrelated)
npm explain uuid           → confirms "overridden uuid@'^11.1.1' (was '^8.3.2') from jayson@4.3.0"
npm audit                  → found 0 vulnerabilities
```

### Independent consumer install (fresh directory, no relation to the repo)

```bash
mkdir /tmp/exergynet-consumer-repro && cd /tmp/exergynet-consumer-repro
npm init -y
npm install exergynet-mcp-server@0.2.5
```

```
npm ls uuid                → uuid@8.3.2 (jayson, NOT overridden), uuid@14.0.2 (rpc-websockets)
npm explain uuid           → no "overridden" annotation at all for the 8.3.2 entry — the override the
                              package.json declares is silently not applied
npm audit                  → 4 moderate severity vulnerabilities
```

```
uuid  <11.1.1
Severity: moderate
uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided - GHSA-w5hq-g745-h8pq
No fix available
node_modules/uuid
  jayson  >=2.0.6
    @solana/web3.js  <=0.0.0-pr-29130 || 0.0.4 - 1.98.4
      exergynet-mcp-server  *
```

Both dependency trees and both audit outputs were captured verbatim as evidence before any source change was made.

## 2. Why it happens

npm's documented behavior: **`overrides` in `package.json` are only applied by npm's resolver when that `package.json` is the root of the install.** A library cannot use its own `overrides` field to force a resolution choice on whoever installs it as a dependency — the field simply has no effect outside the root project. This is not a bug in npm; it's the documented scope of the feature (the same is true of Yarn's `resolutions` field). The 0.2.5 `overrides` entry (`jayson` → `uuid@^11.1.1`) is not universally useless — it does exactly what it's supposed to do when `exergynet-mcp-server` itself is the root project (e.g. someone cloning this repo directly), which is why the repo's own `npm audit` legitimately showed zero findings. It simply cannot reach past that boundary into a consumer's own install.

## 3. Why a version bump of `@solana/web3.js` alone would not have fixed this

The npm-current `1.x` line of `@solana/web3.js` is `1.98.4` — already what `^1.95.0` resolves to, and already what both the repo-root and consumer-install reproductions above were tested against. npm identifies `1.x` as the maintenance branch and points integrators toward `@solana/kit` as the successor, but bumping the declared range from `^1.95.0` to `^1.98.4` changes nothing: it is already resolving to `1.98.4`, and `1.98.4` still depends on the same `jayson` version, which still declares the same vulnerable `uuid` range. This was confirmed rather than assumed before ruling it out as a fix.

## 4. Usage map — every `@solana/web3.js` import in `src/`

Exactly one call site, in `src/index.ts`'s `exergynet_verify_program` handler (dynamically imported, only executed when that specific tool is called):

```ts
const { Connection, PublicKey } = await import("@solana/web3.js");
const connection = new Connection(rpcUrl, "confirmed");
const info = await connection.getAccountInfo(new PublicKey(LNES03_PROGRAM_ID));
```

| Primitive | What it actually does here |
|---|---|
| `PublicKey` | Wraps a single hardcoded constant (`LNES03_PROGRAM_ID`, the LNES-03 Solana program address) — not user-supplied input, no dynamic validation logic exercised |
| `Connection` | Wraps a single HTTP endpoint (the caller-supplied or default `rpcUrl`) with a fixed default commitment level (`"confirmed"`) |
| `connection.getAccountInfo(...)` | Exactly one Solana JSON-RPC method call: `getAccountInfo` |

No signing, no transaction construction, no key handling, no WebSocket subscriptions, no batching, no other SDK primitive is used anywhere in the package. This is the entire real runtime surface that depended on `@solana/web3.js`.

## 5. Fix chosen: Option A — full removal

Given the usage map above, the package's actual requirement reduces to one outbound HTTPS POST implementing Solana's public JSON-RPC `getAccountInfo` method. `@solana/web3.js` (and the `jayson`/`rpc-websockets`/`uuid` subtree it pulls in for its broader RPC/WebSocket client, none of which this package uses) was removed entirely and replaced with a direct `fetch()` call:

```ts
async function getSolanaAccountInfo(rpcUrl: string, base58PublicKey: string): Promise<{ executable: boolean } | null> {
    const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getAccountInfo",
            params: [base58PublicKey, { encoding: "base64", commitment: "confirmed" }]
        })
    });
    if (!res.ok) throw new Error(`RPC request failed: ${res.status} ${res.statusText}`);
    const json: any = await res.json();
    if (json.error) throw new Error(`RPC error: ${json.error.message ?? JSON.stringify(json.error)}`);
    return json.result?.value ?? null;
}
```

The `commitment: "confirmed"` parameter is included explicitly in the RPC call config to exactly reproduce the behavior the old `Connection(rpcUrl, "confirmed")` constructor previously supplied as a connection-level default. Behavioral equivalence was verified with a live smoke test against real Solana Mainnet-Beta both before and after the change — identical result, `{"exists":true,"executable":true}`.

Options B (migrate to `@solana/kit`) and C (vendor a broader RPC client) were considered and rejected as unnecessary — a full API migration or a hand-built client would be strictly more code and more risk than a single ~20-line function for a package whose entire Solana usage is one read-only call. Removal was possible without any loss of behavior, so the priority-order instruction to prefer it was followed.

Net effect: `@solana/web3.js`, `jayson`, `rpc-websockets`, and `uuid` are no longer in the dependency tree at all — 150 packages down to 97. There is nothing left to override, so the now-pointless `overrides` block was also removed from `package.json`.

## 6. Reachability analysis

```
DEPENDENCY_FINDING_PRESENT = YES
EXERGYNET_RUNTIME_REACHABILITY = UNREACHABLE
EVIDENCE =
```

The advisory (GHSA-w5hq-g745-h8pq, "Missing buffer bounds check in v3/v5/v6 when `buf` is provided") concerns `uuid`'s `v3()`, `v5()`, and `v6()` functions specifically when called with an explicit `buf` argument to write into. Direct inspection of the installed `jayson@4.3.0` package source shows it uses `uuid` at exactly two call sites:

```
lib/generateRequest.js:3:  const uuid = require('uuid').v4;
lib/generateRequest.js:49: const generator = ... function() { return uuid(); };
lib/utils.js:6:  const uuid = require('uuid').v4;
lib/utils.js:52: return uuid();
```

Both calls invoke `v4()` — a different function than the advisory concerns — with **zero arguments**, never passing a `buf`. `v4()`'s own internal buffer-writing branch (which does structurally exist, for API completeness) is therefore never exercised by `jayson` either. The finding was real and correctly flagged against the installed package version, but was never reachable through this package's actual runtime call graph. It is fixed regardless, per instruction, since it could be — and was — cleanly removed rather than left in place on a "not reachable so it doesn't matter" rationale.

## 7. Verification performed for 0.2.6

| Check | Result |
|---|---|
| `npm ci` at repo root | 97 packages, 0 vulnerabilities |
| `npm ls uuid` / `jayson` / `@solana/web3.js` at repo root | all three: empty — none present |
| `npm run build` | succeeds (global `fetch` typings resolve via `@types/node@^20`, no `lib` config change needed) |
| `npm test` | **9/9 passing**, unchanged from 0.2.5 |
| `npm audit` at repo root | 0 vulnerabilities |
| Live network smoke test | `exergynet_verify_program` against real Solana Mainnet-Beta → `{"exists":true,"executable":true}`, identical to the pre-change result |
| **New, permanent release gate:** `npm run test:consumer-install` (`scripts/verify-consumer-install.mjs`) | Packs the real tarball, installs it in a fresh unrelated directory, runs `npm audit` there. **PASS: `CLEAN_CONSUMER_INSTALL_NPM_AUDIT = 0`** |
| Manual tarball-as-dependency test (same steps, run independently of the new script) | `npm pack` → fresh directory → `npm install <tarball>` → `npm ls uuid` empty, `npm audit` 0 vulnerabilities, `npx exergynet-mcp-server` launches, retired contract address absent from `dist/`, no `PRIVATE_KEY` reference, no signing library imported, `exergynet_open_job` still returns the exact fail-closed message |

**Acceptance criteria, both met:**
```
SOURCE_TREE_NPM_AUDIT = 0
CLEAN_CONSUMER_INSTALL_NPM_AUDIT = 0
```

The second of these is now a permanent, automated release gate (`npm run test:consumer-install`) rather than a one-time manual check — a repo-root `npm audit` alone is no longer treated as sufficient evidence that a release is clean for real consumers.

## The chain, end to end

| Field | Value |
|---|---|
| Source commit | [`2188b27`](https://github.com/ezumba/exergynet-mcp-server/commit/2188b27) on `main` |
| Parent commit | `b657a94` (0.2.5 + registry-description fix) |
| Package version | `0.2.6` |
| Local build tarball shasum (Windows/CRLF — not authoritative, same caveat as every prior release) | `0467caecd03811e3df0ea476d40337ea3cc76539` |
| Local build integrity (same caveat) | `sha512-pMcgIRYfuSC3WtADrPiHMeLZst7oAwD8Vy3/Q7rh61/4uTh9kRbWhLWkJBy97RTFzmO/BnpIHLcVgJaLKMBtMw==` |
| Packed file list | `README.md`, `dist/index.d.ts`, `dist/index.js`, `package.json` (unchanged from prior releases) |
| Publication status | **Source committed and pushed to `main`. Not published to npm** — same operator-credential boundary as every prior release. This session does not have and will not request the `lnes` npm account's credentials. |

Once published, pull the authoritative shasum/integrity from `npm view exergynet-mcp-server@0.2.6 dist.shasum` / `dist.integrity` — do not treat the local values above as ground truth, per the same lesson already learned twice (0.2.4, 0.2.5).

## Exact publish sequence prepared for the operator

Identical handoff pattern to every prior release:

```bash
git clone https://github.com/ezumba/exergynet-mcp-server.git
cd exergynet-mcp-server
git checkout main && git pull --ff-only origin main
git rev-parse --short HEAD
# Expect: 2188b27 (or a descendant)

npm ci
npm test                        # expect 9/9
npm run build
npm audit                       # expect 0 vulnerabilities
npm run test:consumer-install   # the new permanent gate — expect PASS, CLEAN_CONSUMER_INSTALL_NPM_AUDIT = 0
npm pack --dry-run

npm login
npm publish

# Immediately verify what was actually published:
npm view exergynet-mcp-server version
npm view exergynet-mcp-server@0.2.6 dist.integrity
npm view exergynet-mcp-server@0.2.6 dist.shasum

# Confirm ordinary install resolves to it and is clean:
mkdir /tmp/verify-0.2.6 && cd /tmp/verify-0.2.6
npm init -y && npm install exergynet-mcp-server
npm list exergynet-mcp-server   # expect exergynet-mcp-server@0.2.6
npm audit                       # expect 0 vulnerabilities — this is the check that failed for 0.2.5
```

**Do not deprecate 0.2.4 or 0.2.5.** Both remain safe, historical releases; 0.2.6 is additive dependency-graph correction, not a replacement for a defective release.

After 0.2.6 is published: clean-install from public npm, verify `npm audit = 0` from that install, update the official MCP Registry from 0.2.5 → 0.2.6, update Glama/MCP.so, and run Snyk Agent Scan against the actually-published 0.2.6 package (not source) — all per the existing prepared instructions in `MCP_DISTRIBUTION_PROPAGATION_2026-08-28.md`.
