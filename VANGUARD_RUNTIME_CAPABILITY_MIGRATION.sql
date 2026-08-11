-- VANGUARD_RUNTIME_CAPABILITY_MIGRATION.sql
-- Target: vanguard_db on the AskMo host, table biological_developers.
-- Read VANGUARD_RUNTIME_CAPABILITY_MIGRATION_RUNBOOK.md before running this.
-- Do NOT run this file unattended -- it is meant to be walked through
-- interactively by an operator, verifying output at each step.

-- ============================================================
-- STEP 0: PRE-MIGRATION CHECKS (read-only, run first, inspect output)
-- ============================================================

\d biological_developers

SELECT count(*) AS total_developer_rows FROM biological_developers;

-- Row-count check for the intended backfill scope. Uses a safe LIKE pattern
-- (not SELECT *, no email column in the output) so this can be run and its
-- COUNT reviewed without printing any customer email addresses.
SELECT count(*) AS mymonitor_legacy_rows
FROM biological_developers
WHERE email ILIKE '%@mymonitor.ai' AND active = true;

-- ============================================================
-- STEP 1: FORWARD MIGRATION (additive only)
-- ============================================================

BEGIN;

ALTER TABLE biological_developers
  ADD COLUMN IF NOT EXISTS allowed_runtime_profiles TEXT[] NOT NULL DEFAULT '{general}';

-- Backfill: existing verified MyMonitor accounts only. Uses the same safe
-- ILIKE pattern as the pre-check above -- if the operator wants to confirm
-- exactly which rows will change before committing, run the SELECT variant
-- in Step 0.5 below inside the same transaction first.
UPDATE biological_developers
  SET allowed_runtime_profiles = ARRAY['general','clinical']
  WHERE email ILIKE '%@mymonitor.ai' AND active = true;

-- ============================================================
-- STEP 0.5 (optional, run BEFORE COMMIT if you want to eyeball affected
-- rows without a full email dump -- shows only id + a masked email):
--
-- SELECT id,
--        regexp_replace(email, '^(.).*(@.*)$', '\1***\2') AS email_masked,
--        allowed_runtime_profiles
-- FROM biological_developers
-- WHERE email ILIKE '%@mymonitor.ai' AND active = true;
-- ============================================================

-- ============================================================
-- STEP 2: POST-MIGRATION VERIFICATION (run before COMMIT)
-- ============================================================

-- (a) Row count unchanged -- no rows added or removed, only a column added.
SELECT count(*) AS total_developer_rows_after FROM biological_developers;
-- Compare to total_developer_rows from Step 0 -- MUST be equal.

-- (b) Default applied correctly to ordinary accounts.
SELECT count(*) AS ordinary_developers_with_general_only
FROM biological_developers
WHERE NOT (email ILIKE '%@mymonitor.ai')
  AND allowed_runtime_profiles = ARRAY['general'];
-- Should equal total_developer_rows_after - mymonitor_legacy_rows (roughly --
-- some accounts may have no email at all; those also get the default).

-- (c) MyMonitor accounts have clinical capability.
SELECT count(*) AS mymonitor_with_clinical
FROM biological_developers
WHERE email ILIKE '%@mymonitor.ai' AND active = true
  AND 'clinical' = ANY(allowed_runtime_profiles);
-- MUST equal mymonitor_legacy_rows from Step 0.

-- (d) No unrelated account received clinical capability.
SELECT count(*) AS unexpected_clinical_grants
FROM biological_developers
WHERE NOT (email ILIKE '%@mymonitor.ai')
  AND 'clinical' = ANY(allowed_runtime_profiles);
-- MUST be 0. If not 0, ROLLBACK immediately and investigate.

COMMIT;
-- Only COMMIT after confirming (a)-(d) above look correct. If anything is
-- unexpected, run ROLLBACK; instead of COMMIT; and nothing above takes
-- effect.

-- ============================================================
-- ROLLBACK (if needed AFTER commit -- additive-only, no data loss elsewhere)
-- ============================================================
-- ALTER TABLE biological_developers DROP COLUMN allowed_runtime_profiles;
