# ExergyNet xLMP Documentation/Code Drift Report

**Prepared:** 2026-08-08 · Phase 3 of the post-LNES-59 consolidation directive
**Method:** Direct comparison of `portal/src/lib/apiServicesManifest.ts`
(the documented single source of truth, served publicly at
`/api/docs/services`) and the Living White Paper against the actual route
files found in `EXERGYNET_XLMP_INTEGRATION_REGISTRY.md`.

---

## 1. Public API docs vs. actual routes (undocumented live endpoints)

`apiServicesManifest.ts` documents `/api/xlmp/ingest` and `/api/xlmp/query`
with curl/TypeScript/Python examples. Confirmed by direct grep: it does
**not** mention any of the following, all of which exist as real route
files on the canonical portal surface:

| Route | Exists in code | Documented publicly | Drift type |
|---|---|---|---|
| `/api/xlmp/zk-query` | Yes | No | Production-only feature not documented |
| `/api/xlmp/prove` | Yes | No | Production-only feature not documented |
| `/api/xlmp/proof-status` | Yes | No | Production-only feature not documented |
| `/api/v1/vault/list` | Yes | No | Production-only feature not documented |
| `/api/v1/vault/content` | Yes | No | Production-only feature not documented |
| `/api/xlmp/demo` | Yes | No | Not a real xLMP path (synthetic-only), reasonably excluded but worth an explicit doc note so external readers don't assume it exercises the real store |

**Read on this:** this is not stale documentation describing something that
no longer exists — it is the opposite pattern, real shipped capability the
public docs haven't caught up to. Lower urgency than the reverse pattern
(docs promising something broken) but still worth closing, particularly
`/api/xlmp/zk-query` and `/api/v1/vault/list`, since Omega Carrier (a real
consumer) already depends on the former.

## 2. Legacy/duplicate implementation not reflected in public docs at all

`apiServicesManifest.ts` and the Living White Paper describe a single
`/api/xlmp/ingest` → `/api/xlmp/query` path. Neither mentions that a second,
Postgres-backed implementation of the same route names exists in
`biological_proxy` (`EXERGYNET_XLMP_INTEGRATION_REGISTRY.md` §2). This is
not necessarily a doc bug — internal implementation duplication is
reasonably out of scope for public API docs — but it is a real drift risk
for **internal** documentation and onboarding: nothing in this working
tree's docs states which implementation is canonical except a single
in-code comment in `v1/vault/list/route.ts`. Recommend that comment's
substance be promoted to a short internal note (e.g., in this same registry
or a `README` near `biological_proxy/`), not left as the only record.

## 3. Living White Paper vs. code

The white paper (post-Phase-1 update, v1.5) describes xLMP's
discovery/recall distinction, completeness guarantees, and the new
Section 35.4 state-governance result in general architectural terms. It
does not reference specific route paths (by design — Appendix B's
open-vs-proprietary discipline keeps implementation-level detail out of
the public paper), so no route-level drift exists between the paper and
code by construction. One thing worth a maturity-label check in Phase 5:
the paper's Section 35.4 (LNES-59) is framed as BENCHMARK IMPLEMENTED
throughout — confirm no reader could mistake it for PRODUCTION DEPLOYED,
since none of the LNES-59 state-governance gate mechanism (`X2`) is
present anywhere in the routes inventoried in
`EXERGYNET_XLMP_INTEGRATION_REGISTRY.md` — the live `/api/xlmp/*` routes
perform ingest/recall/proof, not deterministic state-governance gating.
**This is the single most important drift-adjacent finding from this
recon: the production xLMP surface does not yet implement the Part N /
Section 35.4 state-governance gate at all.** It is benchmark-only, exactly
as the white paper's maturity labels already say — flagging this
explicitly here so Phase 5's alignment pass has a concrete, code-confirmed
basis for that label rather than an assumption.

## 4. Not evaluated in this pass

README/SDK docs beyond `apiServicesManifest.ts` (no separate SDK doc
directory was located in this recon); the `exergynet-mcp-server` npm
package referenced in `.well-known/exergynet.json` (external package, not
in this working tree); whether `biological_proxy`'s undocumented routes
have their own drift relative to any internal doc that does describe them
(none was found, but absence-of-evidence is not confirmed absence).

---

*Companion: `EXERGYNET_XLMP_INTEGRATION_REGISTRY.md` /
`EXERGYNET_XLMP_INTEGRATION_REGISTRY.json`.*
