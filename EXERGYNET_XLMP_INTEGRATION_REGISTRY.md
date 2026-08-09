# ExergyNet xLMP Integration Registry

**Prepared:** 2026-08-08 · Phase 3 of the post-LNES-59 consolidation directive
**Method:** Direct code search (`grep`/`find`) across the `exergynet` working
tree — not reconstructed from memory or prior documentation. Companion
machine-readable file: `EXERGYNET_XLMP_INTEGRATION_REGISTRY.json`.
**Scope note:** This pass covers the working tree on this machine. It does
not independently re-verify what is actually running on the two EC2 hosts
(Portal, Carrier) beyond what Phase 4's live health checks confirm —
treat "code exists" and "confirmed running" as separate claims throughout.

---

## 1. Canonical xLMP surface — Next.js Portal (`portal.exergynet.org`, port 4000)

Backing library: `portal/src/lib/xlmp_ds_core.ts` (+ `xlmp_ingest_core.ts`,
`xlmp_storage.ts`). This is the **canonical, filesystem/NVMe-backed** xLMP
implementation — confirmed canonical by an in-code comment in
`v1/vault/list/route.ts` distinguishing it from the legacy Postgres-backed
implementation in §2.

| Route | Method | Auth | xLMP operation | Notes |
|---|---|---|---|---|
| `/api/xlmp/ingest` | POST | Bearer/session (`resolveUser`) | Write — shatters payload into SHA-256 shards, returns `xlmp_root` | Delegates to shared `ingestBuffer()` (LNES-51 convergence — same path as the Google Drive Siphon route, no drift between entry points) |
| `/api/xlmp/query` | POST | Bearer/session | Read — evidence-window retrieval via `xlmp_zk_query` | Fast SHA-256 integrity stub by default (see LNES-50 note in-code); NOT the real Groth16 proof |
| `/api/xlmp/zk-query` | POST | Bearer/session | Read — identical retrieval path to `/api/xlmp/query` (`xlmp_zk_query`), separately named so callers (e.g. Omega Carrier) have a path not shadowed by the legacy biological_proxy route of the same name | Explicitly documented in-code as sharing one source of truth with `/api/xlmp/query`, "so it can never drift" |
| `/api/xlmp/prove` | POST | Bearer/session | Action — kicks off a **real** RISC Zero Groth16 proof as an async background job (~13 min on this CPU-only box) | Separate, explicit, opt-in; does not block the fast stub path |
| `/api/xlmp/proof-status` | GET | Bearer/session | Read — polls async proof job status by `xlmp_root` | Cheap filesystem read |
| `/api/xlmp/demo` | (public, no route.ts method inspected beyond header) | **None — public** | Read — synthetic patient dataset only | Used by the `storage.exergynet.org` interactive demo widget; not a real xLMP query path |
| `/api/v1/vault/content` | GET | Bearer/session | Read — `xlmp_get_content(root)`; throws `MemoryIntegrityViolation` (fatal to that request) rather than silently returning tampered content | LNES-58.10 hardening, per in-code comment |
| `/api/v1/vault/list` | GET | Bearer/session | Read — `xlmp_index_list(owner)`, lists the caller's Hollow Objects | Explicitly the canonical list route per in-code comment (see §2 for the non-canonical duplicate) |

**Public API documentation status:** `portal/src/lib/apiServicesManifest.ts`
(served publicly via `/api/docs/services`, consumed by the external
`api-integration.html` docs page) documents `/api/xlmp/ingest` and
`/api/xlmp/query` with curl/TS/Python examples. It does **not** document
`/api/xlmp/zk-query`, `/api/xlmp/prove`, `/api/xlmp/proof-status`,
`/api/v1/vault/list`, `/api/v1/vault/content`, or `/api/xlmp/demo` — see
`EXERGYNET_XLMP_DOC_CODE_DRIFT_REPORT.md`.

**Consumers (confirmed by code, this working tree):**
- **Omega Carrier** (`omega_carrier/omega_carrier_mcp.py`) — `vault_commit_state()` POSTs to `{PORTAL_URL}/api/xlmp/ingest`; `vault_recall_state()` GETs/POSTs `{PORTAL_URL}/api/xlmp/query` with a fallback to `{PORTAL_URL}/api/xlmp/zk-query` when a ZK proof is still pending. This is the live agent-tool-facing memory-commit/recall path.
- Dashboard/keys pages import `apiServicesManifest.ts` directly for in-app documentation display.

## 2. Legacy/duplicate xLMP surface — `biological_proxy` Express service

Backing store: PostgreSQL `xlmp_vault` table (schema in-code at
`portal/biological_proxy/index.js` lines ~301-302), **a different backend
from §1's filesystem/NVMe store.**

| Route | Method | Auth | xLMP operation | Notes |
|---|---|---|---|---|
| `/api/xlmp/ingest` | POST | `requireAuth` | Write — commits agent state, returns `xlmp_root` handle | **Same route path as §1's canonical route, different backend** — a real naming collision if both services are ever reachable under the same public path |
| `/api/xlmp/query` | GET | (inspect further before relying on this) | Read — recall state by `xlmp_root` | Same collision concern |
| `/api/xlmp/list` | GET | (inspect further) | Read — list commits for authenticated agent | No `/api/v1/vault/list` equivalent naming here; separate route shape |
| `/api/xlmp/vanguard/ingest` | POST | None noted at first read (keyed by device fingerprint) | Write — store one Vanguard exchange | Distinct sub-namespace, not a duplicate of the above |
| `/api/xlmp/vanguard/recall` | GET | — | Read — fetch last N exchanges for a device | Distinct sub-namespace |
| `/api/meet/rooms/:id/vault-anchor` | POST | host-only | Write — stores an `xlmp_root` (produced elsewhere) against a meeting room record | Consumes an xLMP root, does not mint one itself |
| `/api/v1/cowork/session/:id/documents` | POST | — | Write — links an already-ingested `xlmp_root` to a Cowork session | Consumes an xLMP root, does not mint one itself |

**Label: LEGACY / PARTIAL xLMP — confirmed by in-code comment in the
canonical route (§1) as an older, separate implementation, not the one the
canonical `/api/v1/vault/list` route reads from.** This registry does not
resolve whether `biological_proxy`'s `/api/xlmp/*` routes are still
publicly reachable in production, still actively written to, or fully
retired — that is a Phase 4 live-health question, not a code-recon
question. Flagged, not silently merged with §1, per the directive's
explicit instruction not to conflate multiple versions.

## 3. Non-xLMP-specific but xLMP-adjacent surfaces (context, not full entries)

- **AERIS witness** (`portal/src/app/api/aeris/witness`) — separate
  attestation path, not an xLMP read/write per this pass's grep; not
  expanded further here.
- **Vanguard chat/compress** (`portal/src/app/api/vanguard/*`) — model
  routing/coordination surface; whether it stages xLMP evidence into model
  context was not independently confirmed in this pass — flagged for
  Phase 4 live-path testing rather than asserted here.
- **`.well-known/exergynet.json`** — a public LNES-04 protocol discovery
  document (on-chain settlement coordinates, MCP package name, an
  `explorer-api.exergynet.org` state endpoint). Describes ExergyNet as
  "xLMP-class sovereign memory substrate" at a marketing/discovery level;
  not an xLMP data-plane endpoint itself.
- **`xlmp_h200_healthcheck.sh`** (repo root) — a health-check script for
  the remote H200 benchmark environment referenced in the white paper's
  Part VI, not the production portal path in §1.

## 4. What this recon did NOT independently verify

Whether `biological_proxy` (§2) is currently deployed and publicly
reachable, or retired-but-present-in-source. Whether all consumers of the
canonical §1 surface have been found (this pass grepped the working tree,
not every deployed process's actual configuration). Whether
`/api/xlmp/demo`'s public/no-auth status is enforced anywhere beyond the
route file itself (e.g., a reverse-proxy rule). All three are Phase 4
questions (live process/health verification), not resolved by this static
recon pass.

---

*Companion: `EXERGYNET_XLMP_INTEGRATION_REGISTRY.json` (machine-readable),
`EXERGYNET_XLMP_DOC_CODE_DRIFT_REPORT.md` (doc/code gaps this recon
surfaced).*
