# Day-1 Release Reconciliation (§1)

**Generated:** 2026-09-13 (updated — CI-release-closure pass)

---

## Repo facts (verified this session)
- Repo: `github.com/ezumba/exergynet-site`; branch `feat/seo-agent-memory-cluster`; HEAD `53188af`; dirty tree.
- `merge-base(HEAD, origin/main)` = `b7d2845f5568`; HEAD is ahead/behind of origin/main.
- **Live source = the dirty working tree** (git HEAD ~7 weeks stale). A clean release must take the
  dirty-tree versions of production files (minus debris), not `git HEAD`.
- Toolchain here: Node v26.1.0, npm 11.13.0. **No Docker, no system psql, no sqlite, `gh` not authenticated.**
  Real Postgres was obtained via `embedded-postgres` (userspace PostgreSQL 18.4) — no Docker needed.

## What is now PROVEN with real, executed evidence (this session)
| Layer | Result | Evidence |
|---|---|---|
| Config fail-closed | **PASS 8/8** | `base-mainnet.config.selftest.js` |
| Deposit logic (idempotency/atomicity) | **PASS 12/12** | `deposit.test.js` |
| Concurrent + health | **PASS 5/5** (CONCURRENT_REPLAY_CREDITS=1) | `extra.test.js` |
| **Real Postgres migration up/down/reapply** | **PASS** | `migration-manifest.json` |
| **Real Postgres atomicity (failure injection)** | **PASS** (partial_credit_states=0) | `integration-test-results.json` |
| **Real Postgres concurrency (16-way, + after reconnect)** | **PASS** (credits=1) | `concurrency-test-results.json` |
| Secret audit (module set) | **EMBEDDED_PRODUCTION_SECRETS=0** | `secret-audit.json` |
| Runtime fallback audit (modules) | **all 0** | `runtime-fallback-audit.json` |
| **Live Base Mainnet read-only smoke** | **PASS** (8453; USDC USD Coin/USDC/6; 273 Transfer logs) | `mainnet-readonly-smoke.json` |

All of the above ran to green **against real PostgreSQL 18.4 and the live Base mainnet RPC** — not an
emulator, not a claim. The DB layer that §4/§5/§6 asked for is closed with evidence.

## Backend integration — DONE + VERIFIED (2026-09-13)
The tested modules are now integrated into the **real** `portal/biological_proxy`:
- New `day1_mainnet.js` (config + deposit verification/idempotency + Express router + `ensureSchema`).
- `index.js`: removed hardcoded test USDC / retired `OPERATOR_WALLET` / `BASE_SEPOLIA_RPC` and the
  `BASE_CHAIN_ID||'84532'` / `BASE_USDC_CONTRACT||testUSDC` fallbacks; `/api/deposit/claim` now delegates
  to the day1 module (chain 8453, canonical USDC, `DEPOSIT_RECEIVING_WALLET`, `(chain_id,tx_hash,log_index)`
  idempotency, atomic credit); `initDb` calls `ensureSchema`. Also fixed a **latent fresh-init ordering
  bug** (`ALTER meet_join_requests` before its `CREATE`) that only bit a truly fresh DB.
- The **real index.js was booted fresh** against embedded PostgreSQL 18.4 and its **actual HTTP route
  exercised: 15/15 PASS** (see `integration-test-results.json`). Integrated-backend testnet defaults = 0.

## What still blocks a clean, committed candidate
1. **Frontend — FRONTEND_SOURCE_INCOMPLETE.** The Next.js portal source (`portal/src`) has **no build
   definition in any ref/object/tag or the deploy remote** (never a `portal/package.json`,
   `next.config`, `tsconfig`, or lockfile). It cannot be built or the mainnet deposit UI implemented
   from recoverable source. Deployed portal appears to be a **static HTML site + biological_proxy API**
   (host confirmation pending). Per directive §7 this is classified, not fabricated. See
   `docs/FRONTEND_SOURCE_RECOVERY.md`. **This is the sole blocker to READY_FOR_WALLET_INJECTION.**
2. **CI not executed from here** — `gh` unauthenticated; the pipeline is authored + locally validated.
3. **Clean release commit — NOT CUT** — needs the frontend resolution and explicit go-ahead.

## Classification of dirty production files (unchanged from prior pass)
- `portal/biological_proxy/index.js` → **PORT_REQUIRED** (integrate modules; strip testnet/retired).
- `portal/src/**` → **PORT_REQUIRED?** (per-file mainnet-gating review) — but not buildable without frontend config.
- `docs/whitepaper/**`, `PROJECT_BLOCKERS.md`, `whitepaper.html` → **REPORT_ONLY**.
- `omega_carrier/*`, `otet_harness.py`, `intel-console/*`, `deploy*.sh` → **PORT_NOT_REQUIRED**.
- untracked benchmark dirs / `*.zip` / `.env*` / `*.key` / `index.js.live` → **EXCLUDE always**.

`RELEASE_WORKTREE_CLEAN = NO` (blocked on integration + frontend build config + user go-ahead to commit).
`BASE_COMMIT=53188af` · `RELEASE_COMMIT=NOT_CUT` · no git mutation performed.
