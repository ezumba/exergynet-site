# ExergyNet Portal — Base Mainnet Day-1 Deployment Summary

**Release branch:** `release/portal-mainnet-day1-closure`
**Original RC commit:** `3ce600d6d7ed84d94ea2a5cd37492ad2897b6520`
**Final release commit:** `989292c82f0dd0df6e593476cae3d25722c8f13c`
**Production host:** `52.44.165.199` (portal.exergynet.org)
**Deployment date:** 2026-09-23
**Directive:** Operator-Trustee Directive — ExergyNet Portal Mainnet Controlled Deployment Authorization

## Summary

Four portal source files and one new route were deployed from the
`release/portal-mainnet-day1-closure` RC to production via the OTET (LNES-17)
write path. A successful Next.js / Turbopack build was triggered and confirmed.
An admin authorization guard (Unit B) was applied to `biological_proxy/index.js`
as a surgical runtime patch. An incident involving MODULE_NOT_FOUND during
Unit B's initial deployment was diagnosed and resolved without data loss or
blockchain activity.

## Files Deployed

| File | Change | Production SHA (LF) |
|------|--------|---------------------|
| `portal/src/app/layout.tsx` | Remove unused JetBrains Mono font import | `a8bd070f...` |
| `portal/src/app/dashboard/billing/page.tsx` | OPERATOR_WALLET = live deposit receiver | `2a53e4e9...` |
| `portal/src/app/dashboard/aeris/page.tsx` | Revert to baseSepolia (LNES-04 testnet-only) | `cc72aefe...` |
| `portal/src/app/dashboard/deposit/page.tsx` | New — Base Mainnet deposit UI (chain_id=8453) | `fa05df75...` |
| `biological_proxy/index.js` (assembled) | Admin guard patch on `/api/admin/blog/review` | `58702ae9...` |

## Final State

- All 5 portal routes: HTTP 200
- Deposit health: chain_id=8453, status=READY, min_confirmations=12
- Both PM2 services: ONLINE
- Blog authorization: ordinary-user REJECTED, admin ADMITTED

## Safety

```
REAL_USDC_CANARY_EXECUTED = NO
MAINNET_TX_BROADCAST      = NO
CONTRACT_DEPLOYMENT       = NO
MAIN_BRANCH_MERGE         = NO
```
