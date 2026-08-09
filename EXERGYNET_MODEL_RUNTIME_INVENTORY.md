# ExergyNet Model Runtime Inventory

**Prepared:** 2026-08-08 · Phase 4 of the post-LNES-59 consolidation directive
**Method:** Live HTTP(S) canary testing from this working environment
(Windows, not WSL2) plus prior verified state in `VAULT_LEDGER.md`.
**Critical scope-limiting finding, stated up front:** this environment's
outbound network reaches HTTPS (443) to the public Caddy-fronted domains
(`portal.exergynet.org`, `explorer-api.exergynet.org`,
`storage.exergynet.org`, `mcp.exergynet.org`) but **could not reach SSH
(port 22) to either EC2 host, nor the Vanguard Proposer's raw HTTP port
(3000) directly** — both attempts timed out cleanly (no refusal, no
partial handshake), consistent with either an EC2 security-group
IP-allowlist boundary (`VAULT_LEDGER.md` already documents this exact
fragility pattern for Portal) or a narrower-than-full-internet egress
policy on this machine, not yet distinguished. This means: **Level 1-3
(process/port/health) restoration requiring an SSH-based PM2/systemd
restart could not be performed from this session** — not because it was
prohibited, but because the network path does not exist from here. This
is disclosed as a real operational finding, not glossed over.

---

## Inventory (per §4.1 layers, honestly labeled where not fully verifiable)

| Logical role | Host | Port/domain | Level reached | Status |
|---|---|---|---|---|
| Portal Next.js app | Portal EC2 (`52.44.165.199`) | `portal.exergynet.org` (443) | 5 (HTTP 200 on `/` and `/api/docs/services`) | **HEALTHY** at the app-serving layer |
| Portal SSH/PM2 management plane | Portal EC2 (`52.44.165.199`) | 22 | 0 (unreachable from this session) | **UNKNOWN** — cannot confirm PM2 process table from here |
| L0 Apex Router (`apex-router.service`) | Alpha/Portal EC2 | `explorer-api.exergynet.org/api/l0/transactions` (443) | 5 (HTTP 200) | **HEALTHY** at the API layer, matches last-verified ledger state |
| Vanguard reasoning gateway shim (`/v1/chat/completions`) | Carrier EC2 (`3.234.120.103`) via `explorer-api.exergynet.org` | 443 | 4 (gateway responds 200, but the completion content is the service's own canned degraded-fallback string: *"I'm having trouble reaching my reasoning service right now"*) | **DEGRADED** — the HTTP shim is up; the actual reasoning backend it proxies to is not currently answering |
| Vanguard Proposer (raw) | `74.235.106.10:3000` | direct HTTP, non-Caddy-fronted | 0 (connection timed out from this session, 10s) | **UNKNOWN** — could not distinguish "Proposer down" from "port not reachable from this network" without SSH access to a co-located host to test locally |
| `mcp.exergynet.org` (FastMCP) | Carrier EC2 | 443, root path | Root path returned 404 | **Inconclusive by this test alone** — per `VAULT_LEDGER.md`, this service validates the `Host` header and serves its real content at an SSE endpoint (`event: endpoint`), not at `/`; a 404 at `/` is expected behavior for this service, not evidence of an outage. Not independently re-tested at its real endpoint in this pass to avoid guessing at internal SSE session mechanics without the ledger's own established test method. |
| Storage/demo surface | Portal EC2 | `storage.exergynet.org` (443) | 5 (HTTP 200) | **HEALTHY** |
| AerisKeeper, SovereignSiphon, GenesisSwarm, Solana scripts | Carrier EC2 | — | **Explicitly out of scope for this inventory** | These are financial/blockchain daemons, not model-serving infrastructure — restarting or health-checking them is not part of "model health restoration" per this directive's Phase 4 framing, and several are already deliberately stopped/gated per `VAULT_LEDGER.md` (do not restart without the operator's own explicit financial-risk review) |
| `biological_proxy` multi-model routing (Express) | Portal EC2 | — | Not independently tested in this pass (co-located with the canonical Portal Next.js app; the Next.js app itself tested healthy at Level 5) | **UNKNOWN** at the process level for this specific service |

## What was and was not attempted

**Attempted and confirmed non-destructive:** HTTPS GET/POST canaries
against public domains only; `otet_harness.py netcheck 8080 portal`
(read-only `ss -ltnp` query attempt, itself blocked by the same SSH
timeout). **Not attempted:** any `otet_harness.py restart` (would require
the same SSH path that already timed out, so would not have succeeded
regardless); any AWS console/API security-group inspection or change
(out of scope for this session — opening or modifying a security group is
a meaningful, hard-to-reverse infrastructure change and was not
independently authorized as part of this directive's Phase 4 scope, which
authorizes restarting *existing configured services*, not modifying
network ACLs); any attempt to reach the two EC2 hosts via an alternate
path (e.g., AWS Systems Manager Session Manager) — `VAULT_LEDGER.md`
records prior work on an SSM-based path for Portal specifically; whether
that path is usable from this session was not tested in this pass and is
recorded as a candidate next step, not a completed check.

## Also flagged, for the security incident record

A single otet_harness.py `--help` invocation during this session's Phase 4
work printed a config-example block containing what appears to be a real,
current admin password in plaintext (real `PORTAL_URL` and real
`ADMIN_EMAIL` alongside it, not placeholder values). Flagged to the
operator directly in-session; the operator elected to continue and rotate
the credential later, which this document records as a still-open item —
**this inventory does not treat that credential as rotated** and no
further use of `otet_harness.py`'s login-requiring commands was attempted
in this pass beyond the already-safe `netcheck` (which failed for network
reasons before reaching the login step).

---

*Feeds into `EXERGYNET_SYSTEM_HEALTH_FINAL.md`. The SSH-unreachability
finding above is the primary blocker preventing full Phase 4 completion
and should be carried into `PROJECT_BLOCKERS.md` per the project's own
canonical-register convention.*
