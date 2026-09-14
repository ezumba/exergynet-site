// ExergyNet Day-1 Base Mainnet deposit integration for biological_proxy.
// Self-contained: canonical mainnet config (fail-closed, reported as CONFIG_INCOMPLETE
// until DEPOSIT_RECEIVING_WALLET is supplied — the server still boots), the validated
// deposit-verification/idempotency logic, a real Postgres-backed store keyed on
// (chain_id, tx_hash, log_index), and an Express router mounting POST /api/deposit/claim.
//
// Watch-only: needs only DEPOSIT_RECEIVING_WALLET (PUBLIC address). No private key.
// No testnet fallback: production requires 8453 + canonical USDC or the route refuses.
'use strict';

// ── Canonical production constants (non-secret) ────────────────────────────────
const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_MAINNET_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'; // Circle USDC (verified: USD Coin/USDC/6)
const USDC_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const RETIRED_ADDRESS_DENYLIST = new Set([
  '0xbd1e790f6040fa62797671b84a50025a0133109c', // retired/exposed former operator wallet — NEVER a receiver
]);
const isAddr = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);

// ── Config from env — NO defaults that could mask a testnet misconfig ──────────
function loadDay1Config(env = process.env) {
  return {
    chainId: parseInt(env.BASE_CHAIN_ID ?? '', 10),
    rpcUrl: env.BASE_RPC_URL || '',
    usdc: (env.BASE_USDC_CONTRACT ?? '').toLowerCase(),
    depositWallet: (env.DEPOSIT_RECEIVING_WALLET ?? '').toLowerCase(),
    // accept either spelling; no silent numeric default beyond the documented 12
    minConfirmations: parseInt(env.MIN_DEPOSIT_CONFIRMATIONS ?? env.DEPOSIT_MIN_CONFIRMATIONS ?? '12', 10),
  };
}

// Is the config a complete, safe production config? (walletOk => not zero, not retired, valid)
function walletOk(w) {
  w = (w || '').toLowerCase();
  return isAddr(w) && w !== ZERO_ADDR && !RETIRED_ADDRESS_DENYLIST.has(w);
}
function configComplete(cfg) {
  return cfg.chainId === BASE_MAINNET_CHAIN_ID
    && (cfg.usdc || '') === BASE_MAINNET_USDC
    && !!cfg.rpcUrl
    && walletOk(cfg.depositWallet)
    && cfg.minConfirmations >= 1;
}
function configIncompleteReason(cfg) {
  if (cfg.chainId !== BASE_MAINNET_CHAIN_ID) return 'BASE_CHAIN_ID_MUST_BE_8453';
  if ((cfg.usdc || '') !== BASE_MAINNET_USDC) return 'BASE_USDC_CONTRACT_MUST_BE_CANONICAL';
  if (!cfg.rpcUrl) return 'BASE_RPC_URL_REQUIRED';
  if (!isAddr(cfg.depositWallet)) return 'DEPOSIT_RECEIVING_WALLET_REQUIRED';
  if (cfg.depositWallet === ZERO_ADDR) return 'DEPOSIT_RECEIVING_WALLET_IS_ZERO';
  if (RETIRED_ADDRESS_DENYLIST.has(cfg.depositWallet)) return 'DEPOSIT_RECEIVING_WALLET_IS_RETIRED';
  if (!(cfg.minConfirmations >= 1)) return 'MIN_DEPOSIT_CONFIRMATIONS_INVALID';
  return null;
}

// Non-secret health object (mirrors the validated health.js).
function day1Health(cfg, extra = {}) {
  return {
    day1_environment: 'production',
    chain_id: Number.isFinite(cfg.chainId) ? cfg.chainId : null,
    usdc_address: BASE_MAINNET_USDC,
    deposit_receiver: isAddr(cfg.depositWallet) ? cfg.depositWallet : null, // PUBLIC address only, or null
    min_confirmations: Number.isFinite(cfg.minConfirmations) ? cfg.minConfirmations : null,
    status: configComplete(cfg) ? 'READY' : 'CONFIG_INCOMPLETE',
    incomplete_reason: configComplete(cfg) ? null : configIncompleteReason(cfg),
    ...extra,
    // never present: rpc credentials, private keys, stripe secrets, api tokens
  };
}

// Validate a single candidate Transfer event against production requirements.
function validateDeposit(ev, cfg) {
  if (ev.chainId !== BASE_MAINNET_CHAIN_ID) return { ok: false, reason: 'wrong_chain' };
  if ((ev.token || '').toLowerCase() !== BASE_MAINNET_USDC) return { ok: false, reason: 'wrong_token' };
  if (ev.txStatus !== 'success') return { ok: false, reason: 'tx_failed' };
  if (ev.topic0 !== USDC_TRANSFER_TOPIC) return { ok: false, reason: 'not_transfer_log' };
  if ((ev.to || '').toLowerCase() !== (cfg.depositWallet || '').toLowerCase()) return { ok: false, reason: 'wrong_recipient' };
  if (!(BigInt(ev.amount) > 0n)) return { ok: false, reason: 'zero_or_negative_amount' };
  if (!(ev.confirmations >= cfg.minConfirmations)) return { ok: false, reason: 'insufficient_confirmations' };
  if (typeof ev.logIndex !== 'number') return { ok: false, reason: 'missing_log_index' };
  return { ok: true };
}

// Ensure the deposit-ledger schema exists (matches db/migrations/20260913_day1_deposit_idempotency.sql).
async function ensureSchema(pool) {
  await pool.query(`
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
      status             TEXT        NOT NULL DEFAULT 'pending',
      developer_id       TEXT,
      credited_at        TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_usdc_deposit_identity UNIQUE (chain_id, tx_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS ix_usdc_deposits_dev    ON usdc_deposits(developer_id);
    CREATE INDEX IF NOT EXISTS ix_usdc_deposits_status ON usdc_deposits(status);
  `);
}

// ── Real Postgres store: idempotent + atomic (both-or-neither) ─────────────────
function makePgStore(pool) {
  return {
    async depositExists(key) {
      const r = await pool.query(
        `SELECT 1 FROM usdc_deposits WHERE chain_id=$1 AND tx_hash=$2 AND log_index=$3`,
        [key.chain_id, key.tx_hash, key.log_index]);
      return r.rowCount > 0;
    },
    // Atomic: INSERT the canonical identity (ON CONFLICT DO NOTHING) and, only if it was
    // the first observation, credit the developer — in ONE transaction.
    async creditAtomic(key, account, microUsdc, meta) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const ins = await client.query(
          `INSERT INTO usdc_deposits
             (chain_id, tx_hash, log_index, block_number, token_address, from_address,
              to_address, amount_base_units, confirmation_count, status, developer_id, credited_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'credited',$10, now())
           ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING
           RETURNING id`,
          [key.chain_id, key.tx_hash, key.log_index, meta.block_number, meta.token_address,
           meta.from_address, meta.to_address, meta.amount_base_units, meta.confirmation_count, account]);
        if (ins.rowCount === 0) { await client.query('COMMIT'); return { firstTime: false }; }
        const upd = await client.query(
          `UPDATE biological_developers SET usdc_micro_balance = usdc_micro_balance + $1, active = TRUE WHERE id = $2`,
          [microUsdc.toString(), account]);
        if (upd.rowCount !== 1) { await client.query('ROLLBACK'); throw new Error('unknown_account_mapping'); } // fail closed: no partial state
        await client.query('COMMIT');
        return { firstTime: true };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

// Credit one validated event idempotently. Returns {credited, reason}.
async function creditDeposit(ev, cfg, store, resolveAccount) {
  const v = validateDeposit(ev, cfg);
  if (!v.ok) return { credited: false, reason: v.reason };
  const account = resolveAccount ? await resolveAccount(ev) : ev.account;
  if (!account) return { credited: false, reason: 'unknown_account_mapping' }; // fail closed
  const key = { chain_id: ev.chainId, tx_hash: ev.txHash.toLowerCase(), log_index: ev.logIndex };
  if (await store.depositExists(key)) return { credited: false, reason: 'already_credited' };
  const microUsdc = BigInt(ev.amount); // canonical USDC 6-dec base unit == 1 micro-USDC
  try {
    const r = await store.creditAtomic(key, account, microUsdc, {
      block_number: ev.blockNumber, token_address: ev.token, from_address: ev.from,
      to_address: ev.to, amount_base_units: ev.amount.toString(), confirmation_count: ev.confirmations,
    });
    if (!r.firstTime) return { credited: false, reason: 'already_credited' };
  } catch (e) {
    return { credited: false, reason: 'atomic_credit_failed_no_mutation' };
  }
  return { credited: true, microUsdc: microUsdc.toString() };
}

// ── RPC helpers (read-only) ────────────────────────────────────────────────────
async function rpc(rpcUrl, method, params = []) {
  const r = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}
const padAddrTopic = (addr) => '0x' + addr.slice(2).toLowerCase().padStart(64, '0');

// ── Express router: POST /api/deposit/claim (mainnet, watch-only) ──────────────
// requireAuth must populate req.developerId. injectFetchChainId/rpcImpl for tests.
function mountDeposit(app, { pool, requireAuth, envRef }) {
  const store = makePgStore(pool);
  const cfgOf = () => loadDay1Config(envRef || process.env);

  app.get('/api/deposit/health', (req, res) => res.json(day1Health(cfgOf())));

  app.post('/api/deposit/claim', requireAuth, async (req, res) => {
    const cfg = cfgOf();
    if (!configComplete(cfg)) {
      return res.status(503).json({ error: 'CONFIG_INCOMPLETE', reason: configIncompleteReason(cfg) });
    }
    const { tx_hash } = req.body || {};
    if (!tx_hash || typeof tx_hash !== 'string') return res.status(400).json({ error: 'tx_hash required' });

    try {
      // 1. RPC must actually be chain 8453 (no Sepolia fallback).
      const liveChain = parseInt(await rpc(cfg.rpcUrl, 'eth_chainId'), 16);
      if (liveChain !== BASE_MAINNET_CHAIN_ID) return res.status(500).json({ error: 'rpc_wrong_chain', got: liveChain });

      // 2. Receipt + success.
      const receipt = await rpc(cfg.rpcUrl, 'eth_getTransactionReceipt', [tx_hash]);
      if (!receipt) return res.status(400).json({ error: 'tx_not_found_or_unconfirmed' });
      if (receipt.status !== '0x1') return res.status(400).json({ error: 'tx_reverted' });

      // 3. Confirmations.
      const latest = parseInt(await rpc(cfg.rpcUrl, 'eth_blockNumber'), 16);
      const blockNumber = parseInt(receipt.blockNumber, 16);
      const confirmations = latest - blockNumber + 1;

      // 4. Every canonical-USDC Transfer to the receiving wallet is an independent event (by logIndex).
      const wantTo = padAddrTopic(cfg.depositWallet);
      const matches = (receipt.logs || []).filter(l =>
        (l.address || '').toLowerCase() === BASE_MAINNET_USDC &&
        l.topics?.[0] === USDC_TRANSFER_TOPIC &&
        (l.topics?.[2] || '').toLowerCase() === wantTo);
      if (matches.length === 0) return res.status(400).json({ error: 'no_usdc_transfer_to_receiving_wallet' });

      const resolveAccount = async () => req.developerId;
      const events = [];
      let creditedMicro = 0n, pending = false;
      for (const log of matches) {
        const ev = {
          chainId: BASE_MAINNET_CHAIN_ID, token: BASE_MAINNET_USDC, txStatus: 'success',
          topic0: USDC_TRANSFER_TOPIC, to: cfg.depositWallet,
          from: '0x' + (log.topics?.[1] || '').slice(26),
          amount: BigInt(log.data).toString(), confirmations,
          logIndex: parseInt(log.logIndex, 16), txHash: tx_hash, blockNumber,
        };
        if (confirmations < cfg.minConfirmations) { pending = true; events.push({ logIndex: ev.logIndex, status: 'pending' }); continue; }
        const out = await creditDeposit(ev, cfg, store, resolveAccount);
        if (out.credited) creditedMicro += BigInt(out.microUsdc);
        events.push({ logIndex: ev.logIndex, status: out.credited ? 'credited' : out.reason, micro: out.credited ? out.microUsdc : undefined });
      }
      if (pending && creditedMicro === 0n) return res.status(202).json({ ok: false, status: 'pending', confirmations, required: cfg.minConfirmations, events });
      return res.json({ ok: true, credited_micro: creditedMicro.toString(), credited_usd: (Number(creditedMicro) / 1_000_000).toFixed(6), events });
    } catch (err) {
      return res.status(500).json({ error: 'deposit_verification_failed', detail: err.message });
    }
  });
}

module.exports = {
  BASE_MAINNET_CHAIN_ID, BASE_MAINNET_USDC, USDC_TRANSFER_TOPIC, RETIRED_ADDRESS_DENYLIST,
  isAddr, loadDay1Config, configComplete, configIncompleteReason, day1Health,
  validateDeposit, creditDeposit, makePgStore, mountDeposit, ensureSchema,
};
