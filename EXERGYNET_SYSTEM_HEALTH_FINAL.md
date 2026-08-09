# ExergyNet System Health — Final Report

**Prepared:** 2026-08-08 · Phase 7 of the post-LNES-59 consolidation directive
**No "mostly healthy."** Every row below uses one of: HEALTHY, DEGRADED,
DOWN, NOT DEPLOYED, BENCHMARK ONLY, UNKNOWN.

## Component health matrix

| Component | Expected | Process | Port | Health | Canary | xLMP path | Model | Governance | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Portal Next.js app | Yes | Unknown (no SSH) | 443 confirmed open | 200 OK | `/`, `/api/docs/services` both 200 | n/a | n/a | n/a | **HEALTHY** | App-serving layer confirmed live via HTTPS |
| L0 Apex Router | Yes | Unknown (no SSH) | 443 via proxy | 200 OK | `GET /api/l0/transactions` → 200 | n/a | n/a | n/a | **HEALTHY** | Matches last-verified `VAULT_LEDGER.md` state |
| Vanguard reasoning gateway (`/v1/chat/completions` shim) | Yes | Unknown | 443 via proxy | 200 OK (gateway) | Real prompt returned the gateway's own canned degraded-fallback text, not a real completion | Not exercised (canary didn't reach a real model) | **Backend model not confirmed reachable by its own gateway** | n/a | **DEGRADED** | Gateway itself is healthy; whatever it proxies to (Vanguard Proposer) is not answering through it right now |
| Vanguard Proposer (raw) | Yes | Unknown | 3000, direct | Unreachable (timeout, 10s) | Not run | n/a | n/a | n/a | **UNKNOWN** | Cannot distinguish "down" from "unreachable from this network" without a co-located test point |
| `mcp.exergynet.org` (FastMCP) | Yes | Unknown | 443 | Root path 404 (expected per its Host-header/SSE-endpoint design, not itself evidence of an outage) | Not run at its real endpoint in this pass | n/a | n/a | n/a | **UNKNOWN** | Needs a proper SSE-aware test, not attempted this pass |
| Storage/demo surface | Yes | Unknown | 443 | 200 OK | Not exercised beyond root | n/a | n/a | n/a | **HEALTHY** | |
| xLMP canonical data plane (`/api/xlmp/*`, `/api/v1/vault/*`) | Yes | Unknown (no SSH) | via Portal 443 | Not independently re-canaried this pass (embedded-credential canary attempt was blocked by this session's own permission classifier; not retried by an unsafe workaround) | **Not completed** | n/a (this is the path) | n/a | **Not present at all** — see below | **DEGRADED (partially verified)** | App-serving layer confirmed healthy (see Portal row); the specific ingest/query round-trip was not independently re-confirmed in this session beyond the code-level recon in Phase 3 |
| xLMP deterministic state-governance gate (LNES-59 Part N mechanism) | No (benchmark-only, by design) | n/a | n/a | n/a | n/a | n/a | n/a | **NOT DEPLOYED** | **BENCHMARK ONLY** | Confirmed by Phase 3 code recon: none of the live `/api/xlmp/*` routes implement the X2 gate; it exists only in `LNES59_Procurement_Bench/` and the frozen V7 architecture files, not in the production route surface |
| `biological_proxy` legacy xLMP surface | Ambiguous — present in source, live status unconfirmed | Unknown (no SSH) | n/a | Not tested | Not run | Legacy/duplicate, see Phase 3 registry | n/a | n/a | **UNKNOWN** | Flagged as a real drift risk in Phase 3, not resolved by this report |
| AerisKeeper / SovereignSiphon / GenesisSwarm / Solana scripts | n/a for this report | — | — | — | — | — | — | — | **OUT OF SCOPE** | Financial/blockchain daemons, deliberately excluded from "model health" per Phase 4 framing; several already intentionally stopped/gated per `VAULT_LEDGER.md` |

## 7.1 Final end-to-end canary

**Not fully completed.** A real end-to-end canary (`persistent xLMP state →
retrieval/resolution → active model → valid structured response`) was
attempted via the Vanguard `/v1/chat/completions` shim (the closest live
approximation of "active model" reachable from this session) and returned
HTTP 200 with the service's own degraded-fallback content rather than a
real model completion — this is itself the honest canary result, not a
failure to run one. A parallel canary against the xLMP ingest/query path
specifically was blocked by this session's own permission classifier
(embedded credential in a raw shell command) and was not retried via an
unsafe workaround; Phase 3's code-level recon stands in its place for this
report but is not a substitute for a live round-trip test.

Recorded, no secrets included:
- Timestamp: 2026-08-08 (session date)
- Route tested: `POST https://explorer-api.exergynet.org/v1/chat/completions`
- Response class: HTTP 200, degraded-fallback content (not a real model completion)
- Latency: ~3.4s
- Health result: **DEGRADED**

## Where the production governance gate is (and isn't) deployed

Per Phase 3's code recon: **nowhere in the live xLMP route surface.** The
deterministic state-governance mechanism LNES-59 validated on the sealed
holdout exists only in the benchmark harness and the frozen V7 architecture
files. This report does not simulate it and call that production, per the
directive's own instruction.

---

*Companion: `EXERGYNET_MODEL_RUNTIME_INVENTORY.md` (Phase 4 detail),
`EXERGYNET_XLMP_INTEGRATION_REGISTRY.md`/`.json` and
`EXERGYNET_XLMP_DOC_CODE_DRIFT_REPORT.md` (Phase 3), `PROJECT_BLOCKERS.md`
BLK-010/BLK-011 (the two blockers preventing a fuller pass).*
