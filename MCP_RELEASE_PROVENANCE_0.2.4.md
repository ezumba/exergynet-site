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
| Tarball shasum | `e79d885ce3aae34e9e588c45f9e71a7a63ea4998` |
| npm integrity (sha512) | `sha512-5roYoat/XW8Uj[...]epRxzXeWFpb5Q==` |
| Packed file list | `README.md`, `dist/index.d.ts`, `dist/index.js`, `package.json` (4 files — matches `"files": ["dist"]` plus npm's always-included `README.md`/`package.json`) |
| Publication time | **Not yet published** — see `MCP_INCIDENT_CLOSURE_2026-08-28.md` for the exact command sequence prepared for the operator |

**Reproducibility check performed:** `npm run build` followed immediately by `git status` shows zero diff — the committed `dist/index.js` is exactly what a fresh build of the committed `src/index.ts` produces. This directly closes the provenance gap Directive 006 found (where npm's `gitHead` for 0.2.2 pointed to a real commit whose `package.json`/`README.md` didn't match what was actually published, and whose `dist/index.js` didn't correspond to its own committed `src/index.ts` at all).

## What this closes vs. what it doesn't

**Closes:** for this specific release, the published `gitHead` (once set by `npm publish` from this commit) will correspond exactly to the actual published `package.json`, `README.md`, and `dist/index.js` — verified by direct comparison, not assumed.

**Does not close:** no CI-enforced provenance gate exists yet (e.g. `npm provenance`, a required "tarball hash == expected hash" check before publish, or a branch-protection rule preventing a hand-edited `dist/` from being committed without a matching `src/` rebuild). This is recommended as a follow-up hardening item, consistent with Directive 006's "emergency containment first, hardening second" sequencing — not addressed in this pass, which is about closing this specific incident's release, not rebuilding the whole release pipeline.

## Post-publish verification steps (to run once npm access is available)

Per Directive 007 §5, closure requires **npm artifact = verified safe behavior**, not merely a successful `npm publish`. Once published:

1. `npm view exergynet-mcp-server version` → confirm `0.2.4`
2. `npm pack exergynet-mcp-server@0.2.4` in a clean directory (not this checkout) → confirm shasum matches `e79d885ce3aae34e9e588c45f9e71a7a63ea4998`
3. Unpack the downloaded tarball independently and run the same 9 regression tests **against the downloaded artifact**, not the local build
4. `npm install -g exergynet-mcp-server` (no version pin) in a clean environment → confirm it resolves to `0.2.4`, not a cached `0.2.2`

This document will be updated with the actual results once those steps run — see the "Publication status" line in `MCP_INCIDENT_CLOSURE_2026-08-28.md` for current status.
