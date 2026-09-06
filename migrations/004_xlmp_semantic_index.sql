-- LNES-84 Phase 10 — O(vocab) Indexed Bounded Retrieval Engine
-- Migration: 004_xlmp_semantic_index.sql
-- Deploy date: 2026-09-06
-- Depends on: xlmp_vault table (created by biological_proxy initDb())

CREATE TABLE IF NOT EXISTS xlmp_index_postings (
    id              BIGSERIAL    PRIMARY KEY,
    xlmp_root       TEXT         NOT NULL,
    shard_hash      TEXT         NOT NULL,
    term            TEXT         NOT NULL,
    term_frequency  INTEGER      NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_xlmp_postings_root
        FOREIGN KEY (xlmp_root)
        REFERENCES xlmp_vault(xlmp_root)
        ON DELETE CASCADE
);

-- Dedup constraint: one term entry per (root, shard, term)
CREATE UNIQUE INDEX IF NOT EXISTS idx_xlmp_postings_root_shard_term
    ON xlmp_index_postings (xlmp_root, shard_hash, term);

-- Term lookup — primary index for O(vocab) candidate generation
CREATE INDEX IF NOT EXISTS idx_xlmp_postings_term
    ON xlmp_index_postings (term);

-- Root coverage scan — for bulk delete on vault eviction
CREATE INDEX IF NOT EXISTS idx_xlmp_postings_xlmp_root
    ON xlmp_index_postings (xlmp_root);
