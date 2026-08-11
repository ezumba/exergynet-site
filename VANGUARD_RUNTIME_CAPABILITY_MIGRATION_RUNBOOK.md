# Vanguard Runtime Capability Migration — Operator Runbook

Ready for an authorized operator/DBA to execute directly. This agent's
permission safeguards blocked automated execution of this migration twice
this session (once before, once after explicit in-chat authorization) —
see `PROJECT_BLOCKERS.md` BLK-015. This runbook exists so the migration
doesn't require that path at all.

## What this does

Adds one additive column (`allowed_runtime_profiles TEXT[]`) to
`biological_developers`, defaulting every existing and future row to
`{general}`, then grants `{general, clinical}` to accounts already using
`@mymonitor.ai` email addresses (the existing, verified integration).
Nothing else changes. No rows are added or removed. No other column is
touched. No credentials, keys, or billing fields are read or written.

## Zero-secret operator instructions

1. SSH to the AskMo host as a user with access to run `psql` against the
   local `vanguard_db` database (the same access already used for routine
   maintenance on this host).
2. Run the pre-migration checks in `VANGUARD_RUNTIME_CAPABILITY_MIGRATION.sql`
   Step 0 first. Note the `total_developer_rows` and `mymonitor_legacy_rows`
   values — you'll compare against them after.
3. Run Step 1 (the `BEGIN` through the `UPDATE`) — do not `COMMIT` yet.
4. Run Step 2's four verification queries inside the same open transaction.
   Confirm:
   - (a) total row count is unchanged from Step 0.
   - (b) ordinary (non-MyMonitor) accounts show `{general}` only.
   - (c) the MyMonitor count with `clinical` capability matches the
     `mymonitor_legacy_rows` count from Step 0.
   - (d) zero non-MyMonitor accounts received `clinical`.
5. Only if all four look correct: run `COMMIT;`. Otherwise run `ROLLBACK;`
   and stop — nothing will have changed, and the file's own comments have
   space for you to note what looked wrong.

No step in this process requires printing a real customer email address —
Step 0.5 (optional, commented out in the SQL file) shows a masked email
(`v***@mymonitor.ai`) if you want to visually sanity-check which rows will
be touched before committing, without a full data dump.

## Rollback

Additive-only migration — a straight `ALTER TABLE ... DROP COLUMN` reverses
it completely with no data loss elsewhere (see the bottom of the SQL file).
Can be run at any point after the fact, not just immediately after a bad
commit.

## After this migration lands

The application-layer code that reads this column (`authenticate`
middleware's three `SELECT` queries extending to include
`allowed_runtime_profiles`, the new `runtime_profile` request field, and
server-side membership enforcement) is designed but **not yet written** —
see `VANGUARD_RUNTIME_CAPABILITY_MODEL.md`. That code should be written and
deployed in the same pass as confirming this migration succeeded, since the
interim email-domain-based tightening currently in production is explicitly
a stopgap, not the intended end state.

Once the column exists, the interim `clinicalAuthorized = isMyMonitorAccount`
check at ~`src/index.ts:2260` (and its `/v1/batch/chain` counterpart) should
be replaced with a check against `req.developer.allowed_runtime_profiles`,
with the email check kept only as an `OR` fallback labeled
`LEGACY_COMPATIBILITY_SHIM`, per the original design.
