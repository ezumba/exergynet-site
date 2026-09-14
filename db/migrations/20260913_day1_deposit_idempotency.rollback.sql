-- Rollback for 20260913_day1_deposit_idempotency.sql
-- WARNING: drops the deposit ledger table. Ensure no production deposits recorded before rollback,
-- or archive usdc_deposits first. Does NOT touch biological_developers balances.
BEGIN;
DROP INDEX IF EXISTS ix_usdc_deposits_status;
DROP INDEX IF EXISTS ix_usdc_deposits_dev;
DROP TABLE IF EXISTS usdc_deposits;
COMMIT;
