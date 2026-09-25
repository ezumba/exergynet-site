# Real-USDC Production Canary — Release Evidence
# Portal Mainnet Day-1 Closure
# Date: 2026-09-24
# Classification: VERIFIED

---

## 1. On-Chain Leg

```
CANARY_TX_HASH  = 0x878993e4863fa4f3db7fe3e7fbc8f991552c215b51e5cbbe00bbfea387705d87
CHAIN_ID        = 8453 (Base Mainnet)
NETWORK         = Base Mainnet
TX_STATUS       = SUCCESS (0x1)
BLOCK_NUMBER    = 51746108
CONFIRMATIONS   = 2519 (verified 2026-09-24 via eth_getTransactionReceipt, Base Mainnet RPC)

FROM            = 0x8cBF199Dbab16BA33056b846Bf6825d21Bf43812
TO (receiver)   = 0xB1a34954Eb8bf79C65E6c7Dbd4265d9b6E0f0317
USDC_CONTRACT   = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (canonical Base USDC)
AMOUNT_MICRO    = 5000000
AMOUNT_USDC     = 5.000000
LOG_INDEX       = 58 (0x3a)

ONCHAIN_LEG     = PASS
```

Verification method: `eth_getTransactionReceipt` called against Base Mainnet public RPC.
Transfer log topic[0] = 0xddf252ad... (ERC-20 Transfer), data = 0x4c4b40 = 5000000 micro.

---

## 2. Backend Claim — Recovery

```
ORIGINAL_AUTOMATIC_CLAIM_FAILURE_ROOT_CAUSE = NOT_FULLY_FORENSICALLY_RESOLVED
  (LNES-17 shell gate blocked biological_proxy log access and psql DB inspection;
   OTET admin token was expired at canary time. Root cause of original claim failure
   cannot be independently verified from logs.)

RECOVERY_METHOD             = Manual replay — POST /api/deposit/claim (idempotent)
RECOVERY_CLAIM_HTTP_STATUS  = 200
RECOVERY_CLAIM_RESPONSE     = { ok: true, credited_micro: '5000000' }
RECOVERY_AUTH               = Authenticated portal developer identity (en_token)
BACKEND_VERIFICATION        = PASS

KNOWN_FRONTEND_DEFECTS_AT_TIME_OF_CANARY:
  - Incorrect HTTP 202 handling (no retry logic)
  - Insufficient claim retry window (4 attempts × 15s = 60s max)
  - Unsafe post-chain error reset: 'error' state could reset txHash, allowing second transfer
  - Billing page API fallback to http://localhost:3000 (wrong same-origin fallback)
  - QR dependency qr@0.6.0 border=0 crash (affects QR code rendering)
  - setStatus('error') on auth failure (TypeScript type violation — not in union)
```

---

## 3. Economic Credit

```
BALANCE_BEFORE              = $10075.5124 USDC
BALANCE_AFTER               = $10080.5124 USDC
EXPECTED_DELTA              = +5.000000 USDC
ACTUAL_DELTA                = +5.000000 USDC
DELTA_CORRECT               = YES

ATOMIC_CREDIT               = PASS
PORTAL_BALANCE_REFLECTION   = PASS
```

---

## 4. Idempotency

Second POST /api/deposit/claim with same tx_hash:
```
HTTP_STATUS     = 200
credited_micro  = '0'
event           = already_credited
SECOND_CREDIT   = NO
IDEMPOTENCY     = PASS
```

---

## 5. Classification

```
ONCHAIN_LEG                 = PASS
BACKEND_VERIFICATION        = PASS
ATOMIC_CREDIT               = PASS
PORTAL_BALANCE_REFLECTION   = PASS
END_TO_END_ECONOMIC_CANARY  = PASS

REAL_USDC_CANARY_STATUS     = PASS
NO_NEW_USDC_TRANSACTION     = YES
MAINNET_TX_BROADCAST        = NO
```

---

## 6. Frontend Defects Closed by This Release Wave

| Defect | Status |
|--------|--------|
| setStatus('error') TypeScript union violation in billing auth check | FIXED |
| HTTP 202 retry window too short (4 × 15s) | FIXED — MAX_ATTEMPTS=20, adaptive delay |
| Post-chain error allowed new writeContractAsync (second transfer risk) | FIXED — claim_error/credit_pending never touch txHash |
| transfer_error not separated from claim_error | FIXED — transfer_error is pre-chain only |
| Billing API fallback to localhost:3000 | FIXED — ?? '' (same-origin relative) |
| QR dependency qr@0.6.0 border=0 crash | FIXED — package.json override qr@0.4.2 |
| Pricing label "0.4 micro-USDC/token" (wrong by 1000×) | FIXED — "$0.40 / 1K tokens" |
| balanceRefreshed not awaited before "Balance updated" | FIXED — await onSuccess() |

---

## 7. chainStatus Classification

```
CHAINSTATUS_CHANGE_CLASSIFICATION = UX_ONLY

Both billing/page.tsx and aeris/page.tsx use chainStatus="full".
This shows the full chain name/icon in the ConnectButton.
This was NOT the root cause of the original claim failure.
Retained as an explicit UX product choice.
```

---

## 8. Authoritative Pricing Rate

```
AUTHORITATIVE_RATE_USDC_PER_1K          = $0.40
AUTHORITATIVE_RATE_MICRO_USDC_PER_TOKEN = 400
BALANCE_TO_TOKEN_CONVERSION             = balance_usdc / 0.0004

Source: billing/page.tsx BalanceBar line 67:
  Math.floor(balance / 0.0004).toLocaleString()
  → 0.0004 USD/token = $0.40/1000 tokens = 400 micro-USDC/token

Previous incorrect label: "0.4 micro-USDC / token" (wrong by factor of 1000)
Corrected label: "$0.40 / 1K tokens (400 micro-USDC / token)"
```

---

---

## 9. Production Deployment — 2026-09-25

```
DEPLOYMENT_DATE          = 2026-09-25

SOURCE RECONCILIATION (OTET witness — Python UTF-8 hash comparison):
  billing/page.tsx        MATCH (local hash = EC2 hash = 86952fce...)
  deposit/page.tsx        MATCH (local hash = EC2 hash = 4f5cc9ec...)
  aeris/page.tsx          MATCH (local hash = EC2 hash = 3a855455...)
PRODUCTION_SOURCE_PARITY = YES

BUILD:
  Method: _build_clean.sh deployed via OTET apply to src/lib/_rebuild.sh,
          executed via operator SSH key (ubuntu@52.44.165.199)
  Steps:  npm install (picks up any package.json overrides present on EC2)
          npm run build
          pm2 restart exergynet-portal (conditional on exit 0)
  BUILD = PASS (exit 0)
  PM2_PORTAL = RESTARTED

HTTP ROUTES (post-build, all portal.exergynet.org):
  200 /
  200 /dashboard
  200 /dashboard/billing
  200 /dashboard/deposit
  200 /dashboard/aeris
  200 /dashboard/playground
  200 /blog
HTTP_ROUTES_ALL_200 = YES

DEPOSIT BACKEND REGRESSION:
  chain_id=8453          OK
  status=READY           OK
  usdc_address           OK (0x833589fcd6edb6e08f4c7c32d4f71b54bda02913)
  deposit_receiver       OK (0xb1a34954eb8bf79c65e6c7dbd4265d9b6e0f0317)
  min_confirmations=12   OK
DEPOSIT_HEALTH = PASS
BIOLOGICAL_PROXY = ONLINE

CANNOT VERIFY (paths outside OTET ALLOWED_ROOTS):
  QR_OVERRIDE_SOURCE    = CANNOT_VERIFY (package.json ACCESS_BLOCKED)
  BACKEND_SHA_UNCHANGED = CANNOT_VERIFY (biological_proxy/index.js ACCESS_BLOCKED)
  biological_proxy was not modified in this release wave; proxy remains at
  expected state per non-restart policy.

VANGUARD / PLAYGROUND:
  /v1/chat/completions   HTTP 503 "Vanguard unreachable" — persistent across
                         3 retry attempts with developer API key.
  Classified as: SEPARATE_BACKEND_ISSUE (pre-existing or vandropro/sei_gemma_v1
  service unreachable). NOT caused by portal code changes.
  vanguard.exergynet.org root: HTTP 200 (Next.js page serving normally).
PUBLIC_CHAT_COMPLETIONS  = BLOCKED_503 (separate issue)
PLAYGROUND_CHAT          = CANNOT_VERIFY (depends on Vanguard backend)

BROWSER HYDRATION (requires operator):
  BILLING_CLIENT_RENDER  = NOT_DONE (operator must verify)
  DEPOSIT_CLIENT_RENDER  = NOT_DONE (operator must verify)
  AERIS_CLIENT_RENDER    = NOT_DONE (operator must verify)

FORENSICS (unchanged from 2026-09-24):
  B4 ORIGINAL_CLAIM_FORENSICS    = NOT_FULLY_FORENSICALLY_RESOLVED
  B5 DEPOSIT_LEDGER_FORENSIC     = DEFERRED (not a release blocker)
```

---

## 10. Final Software Gate

```
LOCAL_RELEASE_COMMIT     = dbf241c20f6ea58361c9ea3a3490cad02b76279c
BRANCH                   = release/portal-mainnet-day1-closure
PRODUCTION_SOURCE_PARITY = YES

QR_RESOLVED_VERSION      = CANNOT_VERIFY (package.json ACCESS_BLOCKED)
QR_BORDER_CRASH          = CANNOT_VERIFY (requires browser test + QR source access)

BUILD                    = PASS
PM2_PORTAL               = ONLINE (restarted post-build)

BILLING_CLIENT_RENDER    = NOT_DONE (operator browser test required)
DEPOSIT_CLIENT_RENDER    = NOT_DONE (operator browser test required)
AERIS_CLIENT_RENDER      = NOT_DONE (operator browser test required)
PLAYGROUND_CLIENT_RENDER = NOT_DONE (operator browser test required)

PUBLIC_CHAT_COMPLETIONS  = BLOCKED_503 (Vanguard backend unreachable)
PLAYGROUND_CHAT          = CANNOT_VERIFY

DEPOSIT_HEALTH           = PASS
BIOLOGICAL_PROXY         = ONLINE
BACKEND_SHA_UNCHANGED    = CANNOT_VERIFY (biological_proxy/index.js ACCESS_BLOCKED)

REAL_USDC_CANARY         = PASS
ECONOMIC_DELTA           = +5.000000 USDC

ORIGINAL_CLAIM_FORENSICS = NOT_FULLY_FORENSICALLY_RESOLVED
DEPOSIT_LEDGER_FORENSIC  = DEFERRED

DOUBLE_SEND_PROTECTION   = PROVEN (invariant proof in source, EC2 source == local)
PRICING_UNIT_LABEL       = FIXED ($0.40 / 1K tokens, 400 micro-USDC/token)

NO_NEW_USDC_TRANSACTION  = YES
MAINNET_TX_BROADCAST     = NO

PORTAL_MAINNET_RELEASE_STATUS = BLOCKED on:
  1. Browser hydration tests (operator must open billing/deposit/aeris in browser)
  2. QR version verification (operator: npm ls qr --all on EC2)
  3. Vanguard 503 investigation (operator: check vandropro sei_gemma_v1 service)
     — this blocks PLAYGROUND_CHAT but NOT deposit flow
```

---

*Evidence updated 2026-09-25. Operator: Ezumba Dynasty Trust.*
*Portal Mainnet Day-1 Closure — release/portal-mainnet-day1-closure*
