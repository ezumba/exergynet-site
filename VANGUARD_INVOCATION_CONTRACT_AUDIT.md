# VANGUARD INVOCATION CONTRACT AUDIT
**Generated:** 2026-08-10  
**Incident:** MyMonitor / Veena structured-JSON regression  
**Status:** POST-FIX — audit captures state AFTER production fixes deployed

---

## 1. Stack Overview

```
External Client
  ↓  (HTTPS)
Portal /v1/chat/completions  (biological_proxy, port 5000)
  ↓  (HTTP internal)
ExergyExplorer /v1/chat/completions  (exergynet_api, port 8080, carrier EC2)
  ↓  (HTTP internal)
AskMo /v1/chat/completions  (biological_proxy, port 3000, Azure EC2)
  ↓  (gRPC)
Qwen/Vanguard model (PROPOSER or AUDITOR)
```

---

## 2. Field-by-Field Propagation Audit

| Field | Portal IN | Portal → ExergyExplorer | ExergyExplorer → AskMo | AskMo → model | Status |
|-------|-----------|------------------------|------------------------|---------------|--------|
| `model` | client-provided | **PRESERVED** (forwarded) | **PRESERVED** (run_direct_proxy path) | Used to select engine | ✅ PRESERVED |
| `messages` | client-provided | **TRANSFORMED** (SEARCH instruction or clinical guard injected by Portal) | **PRESERVED** (full body forwarded) | All messages passed to model | ⚠️ TRANSFORMED at Portal |
| `response_format` | client-provided | **PRESERVED** (forwarded) | **PRESERVED** (run_direct_proxy reads it) | Sent to model | ✅ PRESERVED |
| `temperature` | client-provided | **PRESERVED** (forwarded) | **PRESERVED** (run_direct_proxy reads it) | Sent to model | ✅ PRESERVED |
| `max_tokens` | client-provided | **PRESERVED** (forwarded) | **PRESERVED** (run_direct_proxy reads it) | Sent to model | ✅ PRESERVED |
| `stream` | client-provided | **OVERRIDDEN** (always false internally; SSE synthesized if client wants streaming) | **OVERRIDDEN** (false) | false | ⚠️ OVERRIDDEN (documented) |
| system prompt | from messages | **TRANSFORMED** (SEARCH or clinical guard prepended for applicable requests) | **TRANSFORMED** (AskMo selectes SEI_CLINICAL_PROMPT for clinical mode; JSON_MODE_ADDENDUM added for clinical or json_object) | Final combined prompt | ⚠️ TRANSFORMED (by design) |
| `json_schema` | not used | N/A | N/A | N/A | ➖ NOT SUPPORTED |
| `seed` | not used | N/A | N/A | N/A | ➖ NOT SUPPORTED |
| `tool_choice` | not used | N/A | N/A | N/A | ➖ NOT SUPPORTED (confirmed non-functional against this backend) |

---

## 3. Identified Drift (Pre-Fix State)

### DRIFT-01: vanguard-engine routed through run_vanguard_inference() [FIXED]
- **Where:** ExergyExplorer `chat_completions_handler` (main.rs line 438)
- **Before:** Only `response_format.is_some()` → `run_direct_proxy()`. All other requests → `run_vanguard_inference()`.
- **Effect on vanguard-engine:** `run_vanguard_inference()` hardcoded `model: "vanguard"`, `temperature: 0.5`, `max_tokens: 220`, added SEARCH instruction. Client's `response_format`, `temperature`, and `max_tokens` were silently dropped.
- **Fix:** `if payload.response_format.is_some() || payload.model.as_deref() == Some("vanguard-engine")` → `run_direct_proxy()`
- **Status:** FIXED, deployed 2026-08-09, canonical snapshot synced 2026-08-10

### DRIFT-02: clinical mode missing JSON_MODE_ADDENDUM [FIXED]
- **Where:** AskMo `biological_proxy/src/index.ts` line 2213 (pre-fix)
- **Before:** `jsonAddendum = isJsonMode ? JSON_MODE_ADDENDUM : undefined` — clinical mode (`detectMode()` keyword detection) received `SEI_CLINICAL_PROMPT` but NOT `JSON_MODE_ADDENDUM`. Model produced prose.
- **Effect:** Requests with clinical content (patient symptoms) returned "I'm SEI Vanguard operating in Clinical Runtime Mode..." + "Verified Claim: ..." prose.
- **Fix:** `jsonAddendum = (isJsonMode || inferenceMode === 'clinical') ? JSON_MODE_ADDENDUM : undefined`
- **Status:** FIXED, deployed 2026-08-09, canonical snapshot synced 2026-08-10

### DRIFT-03: callAuditorHttp() sends no Authorization header [PARTIALLY FIXED]
- **Where:** AskMo `callAuditorHttp()` function
- **Before:** `headers: { 'Content-Type': 'application/json' }` — no bearer token. Auditor always returns 401. Error was silent (Promise.any() let other engines win).
- **Partial fix:** `AUDITOR_AUTH_TOKEN` env var hook added; structured telemetry added (auditor_attempted, auditor_status, auditor_latency_ms, auditor_failure_class).
- **Remaining:** Operator must set `AUDITOR_AUTH_TOKEN` to the credential matching auditor's `PROD_TOKEN_SHA256`. See BLK-013.
- **Status:** TELEMETRY LIVE; AUTH BLOCKED on BLK-013

### DRIFT-04: Portal NVIDIA route has no auditor credential [OPEN — BLK-013]
- **Where:** Portal `/v1/chat/completions` — NVIDIA/vanguard-auditor model path
- **Before:** Portal sends `VG_KEY = process.env.SEI_VANGUARD_KEY` to auditor. Portal's `SEI_VANGUARD_KEY` SHA-256 (`79477a3c...`) ≠ auditor's `PROD_TOKEN_SHA256` (`af16d345...`).
- **Effect:** NVIDIA model always falls back to Proposer. 401 from auditor triggers fallback silently.
- **Status:** FALLBACK TELEMETRY ADDED (auditor_auth_failure:401 now logged); credential rotation BLOCKED on operator action

---

## 4. Known Safe Transformations (Not Drift)

- **stream override:** Portal and ExergyExplorer both force `stream: false` internally and synthesize SSE if client requested streaming. Upstream ignores stream flag; this is documented behavior.
- **SEARCH instruction injection:** Portal injects SEARCH instruction for non-JSON, non-clinical requests. This is intentional LNES-70 behavior. Does not affect clinical extraction path (searchEnabled=false for isClinical or isJsonObject).
- **Clinical guard injection:** Portal prepends deterministic extraction system prompt for `domain: 'clinical'` or `response_format: json_object`. Correct behavior for /v1/extract path.
- **AskMo system prompt selection:** AskMo selects SEI_CLINICAL_PROMPT for clinical keyword matches. Correct behavior, enriched by JSON_MODE_ADDENDUM (post-fix).

---

## 5. Contract Classification (Status Review findings)

Based on investigation of the incident:

**CONTRACT B applies:** `vanguard-engine` used for clinical content should automatically enforce structured JSON output without requiring the caller to send `response_format`.

This is the historical contract as implemented: AskMo's `detectMode()` + `SEI_CLINICAL_PROMPT` is the server-side enforcement mechanism. The regression was that `JSON_MODE_ADDENDUM` (the hard enforcement addendum) was missing for the `detectMode() → 'clinical'` path.

Fix A restores CONTRACT B by adding `JSON_MODE_ADDENDUM` whenever `inferenceMode === 'clinical'`.

---

## 6. Veena Client Path Analysis

**Veena's request shape:**
```
POST /v1/chat/completions (Portal)
Authorization: Bearer <sk-exergy-* or JWT>
{
  "model": "vanguard-engine",
  "messages": [{"role": "user", "content": "<clinical content>"}]
  // No response_format, no domain: 'clinical'
}
```

**Pre-fix path:**
1. Portal: searchEnabled=true → SEARCH instruction injected → forward to ExergyExplorer
2. ExergyExplorer: model=vanguard-engine, no response_format → `run_vanguard_inference()` → hardcode temp=0.5, max_tokens=220, add second SEARCH, change model to "vanguard"
3. AskMo: detectMode() = 'clinical' → SEI_CLINICAL_PROMPT, NO JSON_MODE_ADDENDUM → prose response

**Post-fix path:**
1. Portal: searchEnabled=true → SEARCH instruction injected → forward to ExergyExplorer  
2. ExergyExplorer: model=vanguard-engine → `run_direct_proxy()` → forward all fields preserving model, temperature, max_tokens
3. AskMo: detectMode() = 'clinical' → SEI_CLINICAL_PROMPT + JSON_MODE_ADDENDUM → valid JSON response

**First divergence point (pre-fix):** ExergyExplorer line 438 — vanguard-engine was NOT routing to run_direct_proxy(), stripping response_format and overriding all model parameters.

---

## 7. Revision Log

| Date | Change | Verified by |
|------|--------|-------------|
| 2026-08-09 | Fix A: AskMo clinical mode JSON_MODE_ADDENDUM | Direct ExergyExplorer canary: valid JSON ✓ |
| 2026-08-09 | Fix B: ExergyExplorer vanguard-engine → run_direct_proxy() | Direct canary with SEARCH instruction injected: valid JSON ✓ |
| 2026-08-10 | AskMo callAuditorHttp() telemetry + AUDITOR_AUTH_TOKEN hook | Compiled dist/index.js grep ✓ |
| 2026-08-10 | Portal fallback telemetry (auditor_unreachable, auditor_auth_failure) | OTET apply hash verified ✓ |
| 2026-08-10 | ExergyExplorer canonical snapshot synced to deployed SHA | SHA match: d6dd415181336ae6... ✓ |
| 2026-08-10 | AskMo canonical snapshot synced to deployed | MD5 match verified ✓ |
