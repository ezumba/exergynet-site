# Incident and Recovery Addendum — Unit B Initial Deployment

**Date:** 2026-09-23
**Severity:** Service outage (biological_proxy); no data loss; no blockchain activity

## Incident Summary

- Initial Unit B deployment unintentionally replaced the complete assembled
  biological_proxy production artifact with repository-style source.

- That source expected `./day1_mainnet.js` as a separate runtime module.

- Production used an embedded Day-1 implementation instead.

- biological_proxy failed with MODULE_NOT_FOUND.

- Exact pre-deployment production artifact was recovered by SHA-256:
  `2277746e1a6a2dfb4fb57bcf3da2db062efdd44e59443aa66870522683cfa64a`

- Service was restored successfully.

- Admin authorization correction was then applied as a verified one-line
  surgical patch.

- Final production backend SHA:
  `58702ae92acbe820285fc53d28577b0a086338f3bf11fe516f5fa7309d4db5fc`

- No blockchain transaction or real-USDC transfer occurred during incident
  or recovery.

## Timeline

1. Unit B patch (requireAuth → requireAdmin on blog review) applied to repository
   `portal/biological_proxy/index.js` and pushed in RC commit `3ce600d6`.

2. OTET apply of the repository `index.js` to production replaced the assembled
   artifact (which had day1_mainnet.js embedded inline) with source that
   `require('./day1_mainnet.js')` as an external module.

3. `pm2 restart biological_proxy` triggered. New process failed to start:
   `Error: Cannot find module './day1_mainnet.js'`.

4. PM2 auto-restart attempts exhausted. biological_proxy entered errored state.

5. All `/api/*` routes returned HTTP 502 (Next.js proxy could not reach backend).

6. Operator performed manual recovery via SSH with personal key.

7. Pre-deployment backup (`2277746e...`) restored to
   `/home/ubuntu/biological_proxy/index.js`.

8. `pm2 restart biological_proxy` — success, service restored.

9. Admin guard patch re-applied as surgical one-line change via OTET write path
   to the now-running assembled artifact.

10. Final production backend SHA confirmed: `58702ae9...`.

## Classification

- Not a contract vulnerability
- Not a data breach
- Not a funds risk
- Not a blockchain incident
- Deployment tooling error: repository source / assembled artifact confusion

---

## Corrective Directive — Closure Gate Corrections (2026-09-23)

**Issued by:** Operator / Trustee Corrective Directive — ExergyNet Portal Mainnet Release — Final Two-Gate Closure

**Finding 1 — R6 prematurely marked PASS:**
- First closure committed `30b40d14` called zero-byte tombstoning of `_deposit_seed.sh`
  and `.gitkeep` "removal." The OTET write-only API surface has no `unlink`/`rm`
  capability. Writing a zero-byte file is not physical deletion.
- Corrected status: `R6 = NOT_COMPLETE`
- Files exist on production at 0 bytes (re-verified 2026-09-23 via OTET witness).
- Dependency check re-run: neither file is referenced by `_rebuild.sh`,
  `biological_proxy/index.js`, or any other production file.
- `deposit/page.tsx` SHA re-confirmed: `fa05df75...` — unaffected.
- Physical deletion requires operator SSH with personal key. Exact commands:

```bash
# Pre-deletion dependency check (run first):
grep -RIn '_deposit_seed\.sh\|dashboard/deposit/.gitkeep' \
  /home/ubuntu/exergynet-portal \
  /home/ubuntu/biological_proxy \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  2>/dev/null
# Expected: no output

# Physical deletion:
rm /home/ubuntu/exergynet-portal/src/lib/_deposit_seed.sh
rm /home/ubuntu/exergynet-portal/src/app/dashboard/deposit/.gitkeep

# Verification:
test ! -e /home/ubuntu/exergynet-portal/src/lib/_deposit_seed.sh \
  && echo "SEED_DELETED=PASS" || echo "SEED_DELETED=FAIL"
test ! -e /home/ubuntu/exergynet-portal/src/app/dashboard/deposit/.gitkeep \
  && echo "GITKEEP_DELETED=PASS" || echo "GITKEEP_DELETED=FAIL"
sha256sum /home/ubuntu/exergynet-portal/src/app/dashboard/deposit/page.tsx
# Must output: fa05df751772d08d35ab09a37e690171f0f868976638c43711d00cd6d88a784f
```

**Finding 2 — R8 prematurely marked PASS:**
- First closure test_a (HTTP 401, no Authorization header) proved only that
  UNAUTHENTICATED requests are rejected. The two HTTP 401 responses are distinct:
  - Unauthenticated: `{"error": "Missing authorization header"}`
  - Authenticated non-admin (required): `{"error": "Invalid or expired admin token"}`
- Corrected status: `R8 = BLOCKED_NO_SAFE_TEST_IDENTITY`
- The harness holds only super_admin credentials (`get_admin_token()`).
  No developer email/password, developer JWT, or developer API key is available
  in the agent session.
- To unblock R8, the operator must either:
  (a) Provide a safe developer test credential (API key or portal session JWT with
      a non-super_admin, non-ops role), or
  (b) Accept BLOCKED as the permanent record for R8.
- R8 evidence required: HTTP 401 `{"error": "Invalid or expired admin token"}` or
  HTTP 403 `{"error": "Insufficient role..."}` from POST /api/admin/blog/review
  with a valid developer Bearer token.

**Smoke re-run (post-correction):**
- 5/5 portal routes HTTP 200 (re-confirmed)
- `GET /api/deposit/health`: HTTP 200, status=READY, chain_id=8453
- Backend SHA: `58702ae9...` — unchanged, matches prior evidence
- Both residue files: 0 bytes (zero-byte tombstones, NOT physically deleted)
- REAL_USDC_CANARY_EXECUTED = NO
- MAINNET_TX_BROADCAST = NO
