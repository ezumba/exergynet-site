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

*Evidence sealed 2026-09-24. Operator: Ezumba Dynasty Trust.*
*Portal Mainnet Day-1 Closure — release/portal-mainnet-day1-closure*
