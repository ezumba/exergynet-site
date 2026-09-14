-- Day-1 Base Mainnet deposit idempotency migration (Postgres).
-- Canonical deposit identity = (chain_id, tx_hash, log_index). Enforces no-double-credit.
-- Apply in a transaction. Rollback: 20260913_day1_deposit_idempotency.rollback.sql
BEGIN;

CREATE TABLE IF NOT EXISTS usdc_deposits (
    id                 BIGSERIAL PRIMARY KEY,
    chain_id           BIGINT      NOT NULL,
    tx_hash            TEXT        NOT NULL,
    log_index          INTEGER     NOT NULL,
    block_number       BIGINT      NOT NULL,
    token_address      TEXT        NOT NULL,
    from_address       TEXT        NOT NULL,
    to_address         TEXT        NOT NULL,
    amount_base_units  NUMERIC(78,0) NOT NULL CHECK (amount_base_units > 0),
    confirmation_count INTEGER     NOT NULL,
    status             TEXT        NOT NULL DEFAULT 'pending',  -- pending | credited | rejected
    developer_id       TEXT,                                    -- account mapping (nullable until resolved)
    credited_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- canonical identity: never credit from tx_hash alone
    CONSTRAINT uq_usdc_deposit_identity UNIQUE (chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS ix_usdc_deposits_dev    ON usdc_deposits(developer_id);
CREATE INDEX IF NOT EXISTS ix_usdc_deposits_status ON usdc_deposits(status);

COMMIT;

-- Atomic credit pattern (application, run inside one tx):
--   INSERT INTO usdc_deposits (...) VALUES (...)
--     ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING RETURNING id;
--   -- if a row was returned (first time): UPDATE biological_developers
--   --   SET usdc_micro_balance = usdc_micro_balance + <amount> WHERE id = <dev>;
--   -- else: already credited -> no balance mutation.
-- The INSERT and the balance UPDATE MUST share one transaction (both-or-neither).
