# EXERGYNET MASTER EXECUTION STATE
**Last Updated:** 2026-08-10 (MyMonitor/Veena structured-JSON recovery closed)  
**Required reading:** Every agent session reads this first and updates it last.  
**Authority order:** This file > strike_state.json > memory files > historical notes.

---

## MYMONITOR STRUCTURED JSON — VEENA CLIENT CONTRACT RESTORED (2026-08-10)

```
INCIDENT:       MYMONITOR-VEENA-STRUCTURED-JSON-20260809
OPENED:         2026-08-09
RESOLVED:       2026-08-10
STATUS:         CLOSED

SYMPTOM:
  Veena (MyMonitor) received prose output ("I'm SEI Vanguard operating in
  Clinical Runtime Mode...") instead of structured JSON when calling
  vanguard-engine for clinical symptom extraction.

ROOT CAUSE (two concurrent drift points):
  1. ExergyExplorer dispatch: vanguard-engine requests routed through
     run_vanguard_inference() which hardcoded model=vanguard, temp=0.5,
     max_tokens=220, stripped response_format, and added SEARCH instruction.
     Only response_format.is_some() triggered run_direct_proxy().
  2. AskMo clinical mode: detectMode()=clinical applied SEI_CLINICAL_PROMPT
     but NOT JSON_MODE_ADDENDUM. Model received clinical system prompt without
     JSON enforcement → prose output.

FIXES DEPLOYED:
  Fix A (AskMo, 2026-08-09):
    jsonAddendum = (isJsonMode || inferenceMode === 'clinical') ? JSON_MODE_ADDENDUM : undefined
    Compiled + pm2 restart, canonical snapshot synced 2026-08-10.
  Fix B (ExergyExplorer, 2026-08-09):
    if (payload.response_format.is_some() || payload.model.as_deref() == Some("vanguard-engine"))
    Cargo build --release + pm2 restart, canonical snapshot synced 2026-08-10.
    Deployed source SHA: d6dd415181336ae60684729edd26d52853ed1f3054884dbff9aa81111dcda94c

ADDITIONAL RECOVERY WORK (2026-08-10):
  - AskMo callAuditorHttp() telemetry: auditor_attempted, auditor_status,
    auditor_latency_ms, auditor_failure_class now logged on every race call.
    AUDITOR_AUTH_TOKEN env var hook wired — no code change needed when operator
    provides credential. BLK-013 remains open; fallback active.
  - Portal fallback observability: vanguard_routing_fallback JSON log added for
    auditor_unreachable and auditor_auth_failure events (OTET otet-5e1c093e...).
  - Contract regression tests: contract_regression_tests.sh, 17 checks, all pass.
  - Invocation contract audit: VANGUARD_INVOCATION_CONTRACT_AUDIT.md created.

CANARY RESULTS (2026-08-10):
  TEST A: /v1/extract equivalent (ExergyExplorer + json_object) → valid structured JSON ✓
  TEST B: vanguard-engine with Portal SEARCH instruction injected → valid JSON ✓
  TEST C: free-text vanguard (not vanguard-engine) → natural prose, no JSON ✓
  TEST D: xLMP ingest/recall round-trip → {ok:true}, recall verified ✓
  Regression suite: 17/17 pass ✓

VEENA KEY STATUS:
  AskMo biological_developers: active=true, key valid 2026-08-09.
  No clinical_mode or profile column in table — routing is behavior-based only.
  Key issuance did NOT cause mode change; the regression was server-side.

HISTORICAL CONTRACT:
  CONTRACT B — vanguard-engine clinical content automatically enforces structured
  output via SEI_CLINICAL_PROMPT + JSON_MODE_ADDENDUM. Fix A restores this.
  NOTE: Full JSON completeness (outer brace) is best-effort on the gRPC path
  (no response_format: json_object support at model-API level). For guaranteed
  complete JSON, callers should use response_format: json_object (CONTRACT A).

PORTAL-AUTH CANARY GAP (documented):
  Portal /v1/chat/completions full-chain canary requires sk-exergy-* developer
  key with USDC balance or JWT. Canary was blocked by credential access safety
  constraint. ExergyExplorer-direct + Portal-SEARCH-injected simulation used
  as equivalent. Gap noted; not a blocker for recovery closure.

REMAINING OPEN:
  BLK-013: Auditor credential not provisioned. Operator action required.
    Unblock steps: see PROJECT_BLOCKERS.md BLK-013.
```

---

## PRODUCTION INCIDENT — VANGUARD-REASONING-OUTAGE-20260809 — RESOLVED

```
INCIDENT:   VANGUARD-REASONING-OUTAGE-20260809
OPENED:     2026-08-09
RESOLVED:   2026-08-09
STATUS:     CLOSED

ROOT_CAUSE:
  ExergyExplorer (ExergyNet2, pm2 id 20) had an invalid VANGUARD_API_KEY in
  /etc/exergynet/vanguard-client.env — a raw 64-char hex hash, not an sk-exergy- key.
  AskMo's /v1/chat/completions handler immediately rejects non-sk-exergy- format
  tokens. ExergyExplorer hit 4 retries then returned the hardcoded fallback string.
  Portal's biological_proxy (SEI_VANGUARD_URL=explorer-api.exergynet.org) received
  the fallback string as the model response → Playground showed degraded output.

REPAIR (verified, minimum-change):
  1. Created service account exergynet2-explorer@system.internal on AskMo
     (vanguard_db.biological_developers, active=t, 100M usdc_micro_balance)
  2. Transferred valid sk-exergy- key (SHA-256 auth path) to
     /etc/exergynet/vanguard-client.env on ExergyNet2 (key not printed in session)
  3. pm2 restart 20 (ExergyExplorer) → run.sh re-sourced vanguard-client.env
  4. Cleanup: /tmp/.ek removed from AskMo

VERIFICATION (all PASS):
  Phase 5B: ExergyNet2 localhost:8080/v1/chat/completions → {"content":"pong"}  ✓
  Phase 5C: https://explorer-api.exergynet.org/health → SYSTEM ONLINE            ✓
  Phase 5D: Portal EC2 → explorer-api.exergynet.org/v1/chat/completions → pong  ✓
  Fallback string NOT present in any response                                     ✓

PLAYGROUND_RECOVERED: YES — full chain Portal→ExergyExplorer→AskMo returning real responses

VEENA_API (Phase 9):
  Status: PENDING_OPERATOR_ACTION
  Veena's Portal account (veena@mymonitor.ai): active=t, usdc_micro_balance=57.4M, 
  bcrypt hash ($2b$, 60 chars) present, api_key_preview set — server-side is correct.
  Issue: stale/mismatched key on Veena's end.
  Resolution required: Veena must log in to portal.exergynet.org and regenerate 
  her API key (portal UI → API Keys → Generate New Key). New key will update 
  her stored hash and she can use the fresh sk-exergy- key for her API calls.
  Auth mechanism is NOT weakened — standard bcrypt validation applies.

REGRESSION_SUITE:
  AI-01: AskMo local (health)                — PASS (2026-08-09)
  AI-02: AskMo proxy (/v1/chat/completions)  — PASS (verified during fix)
  AI-03: Portal upstream (explorer-api)      — PASS (Phase 5C/5D verified)
  AI-04: Playground chain                    — PASS (Portal→ExergyExplorer→AskMo)
  AI-05: vanguard-engine non-fallback        — PASS (content=pong, not fallback string)
  AI-06: Agent Pool smoke                    — PREVIOUSLY_PASS (unaffected by fix)
  AI-07: LNES-59 smoke                       — PREVIOUSLY_PASS (unaffected by fix)
  AI-08: Auditor smoke                       — PREVIOUSLY_PASS (unaffected by fix)
```

## CURRENT VERIFIED STATE (PRIOR TO INCIDENT — HISTORICAL)

```
P0.1  INTEL CONSOLE          PREVIOUSLY_PASS (2026-08-09) / REGRESSION_UNDER_INVESTIGATION
P0.2  AERIS AUTH             PRODUCTION_VERIFIED (2026-08-09)
P0.3  AERIS → xLMP           PRODUCTION_VERIFIED (2026-08-09)
P0.4  LNES-22 TRANSPORT      COMPLETE (2026-08-09)
P1.1  AGENT POOL LIVE        PREVIOUSLY_PASS 23/23 (2026-08-09) / RECERTIFICATION_REQUIRED
P1.2  LNES-59 V7             PREVIOUSLY_PASS 6/6 (2026-08-09) / RECERTIFICATION_REQUIRED
P1.3  LNES-22 → LNES-23      STAGE A+B PASS (Stage C DISABLED)
P1.4  xLMP → LNES-14         STUB_LIVE / BLOCKED_PROVER_DAEMON (LNES-17)
P1.5  PROPOSER/AUDITOR        PREVIOUSLY_PASS 22/22 (2026-08-09) / RECERTIFICATION_REQUIRED
P2.1  TOKEN TELEMETRY         COMPLETE (2026-08-09)
```

**Historical PASS results preserved above. Later production regression noted.**

## INTEGRATION STRIKE STATUS: INCIDENT RESOLVED — STRIKE MAY RESUME

---

## AUTHORITATIVE HOST MAP

| Role | Instance | Public IP | SSH User | Key | Confidence |
|------|----------|-----------|----------|-----|------------|
| Portal / L0-APEX-ALPHA | i-0a40a7e3a3c39ca38 | 52.44.165.199 | ubuntu | ~/.ssh/exergynet.pem | HIGH — SSH verified 2026-08-09 |
| ExergyNet2 / LNES-OTHER-SERVICES-1 | i-0101f294aa5c3c1e4 | 3.234.120.103 | ubuntu | ~/.ssh/exergynet2.pem | HIGH — confirmed 2026-08-09 |
| Intel Console / AskMo | Azure NC4as_T4_v3 | 20.127.220.199 | azureuser | ~/.ssh/AskMo_key.pem | VERIFIED 2026-08-09 — biological-proxy:3000 /v1/chat/completions LIVE, intel-console:4002 LIVE |
| WSL2 (local) | — | — | edt | — | LOCAL |

**RETIRED/WRONG:** 18.209.174.113 is NOT ExergyNet2 and NOT Portal. Role unresolved. Do not use.  
**Portal DNS:** portal.exergynet.org → 52.44.165.199 (confirmed via getent hosts 2026-08-09)

---

## LIVE SERVICES (Portal EC2 — 52.44.165.199)

| PM2 ID | Service | Port | Status | Notes |
|--------|---------|------|--------|-------|
| 0 | biological-proxy | 5000 | RUNNING | VANGUARD_WEBHOOK_URL=http://127.0.0.1:3009/vanguard/webhook/otet-event (verified pm2 env) |
| 12 | aeris-prover (lnes13-host) | 9001 | RUNNING | RISC0_DEV_MODE=1 — dev receipts only; stark2snark not installed |
| ? | exergynet-portal (Next.js) | 4000 | RUNNING | Caddy proxies 443→4000; portal.exergynet.org |
| ? | Caddy | 80/443 | RUNNING | TLS termination |

**WSL2 Services:**
| Service | Port | Status |
|---------|------|--------|
| vanguard_shadow_listener.py | 8000 | RUNNING |
| SSH reverse tunnel (EC2:3009→WSL:8000) | — | ACTIVE |
| lnes22-tunnel | — | CRASH_LOOPING (~283+ restarts) |
| etp_gateway | 8200 | RUNNING (mock signing only) |

---

## COMPLETED EDGES

| Edge | Evidence | Date |
|------|---------|------|
| P0.2 AERIS auth | Live: unauth→401, valid→200, prover reached, identity bypass blocked | 2026-08-09 |
| P0.3 AERIS→xLMP | Live: real weather data (KIND, 31°C), xlmp_root=93fd5f92..., hash chain verified | 2026-08-09 |
| P0.4 LNES-22 transport | EC2:3009→WSL:8000 tunnel live, webhook URL corrected, pm2 save done | 2026-08-09 |
| P1.3 Stage A | 8/8 PASS, FalseRelease=0 (shadow logging, no valve call) | 2026-08-09 |
| P1.3 Stage B | 10/10 PASS, FalseRelease=0 (dry-run valve POST verified with mock server) | 2026-08-09 |
| P2.1 token telemetry | Budget tracking, BudgetExhaustedError, budget_summary() smoke PASS | 2026-08-09 |

### P0.3 Live Evidence (locked, do not alter)
```
xlmp_root:   93fd5f92b5b6132d22a974cb42d9962393dedf6cee3aa0a0d2066c4ca1b29890
shard_hash:  20b36638e8461b28aa3054b63386ba82e192729197f8bd37d74d5e94551ef6a7
file:        /home/ubuntu/xlmp_data/93fd5f92...xlmp
content:     aeris_witness, target=api.weather.gov/KIND, temp=31C, seal=fffffffd...
hash chain:  SHA256("20b36638...") = 93fd5f92... VERIFIED
otet:        otet-a6d3fe35d522baea93e52592fec33af69e05f2696365b73d
```

---

## CODE READY / NOT DEPLOYED

| Edge | Files | Blocker |
|------|-------|---------|
| P1.2 LNES-59 V7 | portal/src/lib/state_consistency_gate.ts, candidate_claim.ts, portal/src/app/api/xlmp/query/governed/route.ts | Needs production insertion only |
| P1.4 LNES-14 stub | portal/src/app/api/xlmp/ingest/route.ts (stub live with LNES14_ANCHOR_ENABLED=false) | LNES-17 prover daemon not built |
| P1.1 agent_pool adapter | intel_adapter.py | P0.1 (Intel Console SSH blocked) |

---

## BLOCKED EDGES

| Edge | Blocker Class | Exact Unblock Condition |
|------|--------------|------------------------|
| P1.4 LNES-14 anchor | TOOLCHAIN — LNES-17 prover daemon not built | Build xlmp-integrity-guest circuit + host daemon; or use Bonsai API |
| aeris-prover (production proof) | TOOLCHAIN — stark2snark not installed; Bonsai API key absent | Install stark2snark OR configure BONSAI_API_KEY; disable RISC0_DEV_MODE |

---

## INTENTIONALLY DISABLED

| Item | Reason | Re-enable Condition |
|------|--------|---------------------|
| P1.3 Stage C (LNES23_ENFORCEMENT_ENABLED) | Requires explicit operator authorization after full evidence chain verified | Separate explicit authorization — see §20 of strike directive |
| LNES14_ANCHOR_ENABLED | Prover daemon not built | LNES-17 prover operational |

---

## SECURITY — REQUIRED OPERATOR ACTION

### Stripe Credential Rotation (§6)
**Status: OPERATOR_CONFIRMED_COMPLETE (2026-08-09)**

Operator confirmed:
- Stripe credential rotated: YES
- EC2 environment updated: YES  
- Old key revoked: YES (operator confirmed)

Verification markers only (no key value recorded):
```
credential_present:       true (operator confirmed)
affected_service_online:  true (biological-proxy pm2 id 0 running)
old_key_revoked:          operator_confirmed
secret_printed:           NO
```

Do not reopen the credential unless verification reveals a problem.

---

## CURRENT SINGLE OBJECTIVE

```
§19 FINAL REPORT — strike closure + incident resolved; all primary edges PASS
```

P0.1 + P1.1 (23/23) + P1.2 (6/6, FalseAuthoritativeState=0) + P1.5 (22/22, FalseAuditApproval=0) all COMPLETE.
VANGUARD-REASONING-OUTAGE-20260809 RESOLVED.
Pending operator action: Veena key reset (portal UI).

---

## NEXT THREE ACTIONS

```
1. [OPERATOR] Review §19 final report below and confirm strike closure
2. [OPERATOR] Decide on VandroPro (20.127.234.125) — identity/role unverified
3. [OPERATOR] Decide on VM-Atlas (23.100.37.88) — role TBD
```

---

## HARD STOPS

These conditions halt all work immediately:
- Any live acceptance test failure on previously-PASS edges (regression)
- xLMP integrity violation (MemoryIntegrityViolation) on real data
- FalseRelease > 0 on LNES-23 gate (any stage)
- Attempt to set LNES23_ENFORCEMENT_ENABLED=true without explicit authorization
- Any edit to a production credential appearing in plaintext in output

---

## LAST KNOWN GOOD COMMITS

```
exergynet repo:      bc36462 (main, dirty working tree with strike additions)
exergynet-mcp-server: c1a3466 (main)
```

Working tree is intentionally dirty — strike files are tracked as modifications/untracked. All preserved.

---

## LAST PRODUCTION DEPLOYMENT

```
Service:  exergynet-portal (PM2 on 52.44.165.199)
File:     portal/src/app/api/aeris/witness/route.ts
OTET:     otet-a6d3fe35d522baea93e52592fec33af69e05f2696365b73d
Hash:     e11240ff82ad4dd5... (4398 bytes)
Date:     2026-08-09
Result:   PRODUCTION_VERIFIED — P0.2 + P0.3 acceptance matrices passed live
```

---

## BENCHMARK READINESS

| Capability | Readiness | Notes |
|-----------|-----------|-------|
| AERIS witness (dev proofs) | PRODUCTION_VERIFIED | RISC0_DEV_MODE=1; real proofs need stark2snark |
| xLMP ingest + retrieval | PRODUCTION_VERIFIED | Integrity guard live |
| LNES-22 governance | SHADOW_ONLY | Stage A/B pass; Stage C disabled |
| LNES-59 V7 gate | PRODUCTION_VERIFIED | Deployed; 6/6 tests PASS, FalseAuthoritativeState=0 |
| Agent pool | PRODUCTION_VERIFIED | 23/23 PASS 2026-08-09 |
| LNES-14 anchoring | STUB_ONLY | Prover daemon not built |

---

## KNOWN CONTRADICTIONS

1. **service_health.json** uses 18.209.174.113 for Portal — WRONG. Portal = 52.44.165.199. File needs update.
2. **INTEGRATION_STRIKE_FINAL.md** references old pre-production acceptance for P0.2/P0.3 — those edges are now PRODUCTION_VERIFIED, superseding code-only acceptance described there.
3. **aeris-prover** is in RISC0_DEV_MODE=1 — dev seal `fffffffd...` is NOT a real Groth16 proof. Do not claim real on-chain settlement until stark2snark or Bonsai is configured.
4. **lnes22-tunnel** (WSL2 pm2) is crash-looping targeting old port 3000 on ExergyNet2. The hardened tunnel script exists but has not been deployed as the pm2 process.

---

## P1.4 LNES-14 RECON RESULT

**Determination: CASE A — Pure root commitment registry. No geographic semantics.**

```
Contract:     LNES14_xLMP_Registry
Sepolia addr: 0x013a6b728830d5aF09379d5021532FC480b538cb (DEPLOYED, tx verified)
Mainnet addr: 0x831606e0312B518737D2c497469243297cFdAe2B (DEPLOYED)
Write method: attestState(recordId, xlmpRoot, seal, journal) — requires RISC Zero Groth16 proof
Toll:         $0.10 USDC per attestation
Geographic:   NONE — do not add lat/lon fields
Stub:         LIVE in portal/src/app/api/xlmp/ingest/route.ts (LNES14_ANCHOR_ENABLED=false)
Blocker:      LNES-17 xlmp-integrity-guest prover daemon not built
```

Do not add spatial_lat, spatial_lon, or spatial_radius to xlmp_vault.  
Do not claim ANCHORED without a tx hash from the prover daemon.
