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
