// ⚠ NOT what runs on AskMo (20.127.220.199) despite the identical directory/file
// name — AskMo runs a completely different, more advanced TypeScript codebase.
// See ../../deployed-snapshots/README.md before assuming this file describes
// live behavior for anything Vanguard-related. This file IS live (presumably
// on Portal EC2), but its own /api/v1/vanguard-nav route (~line 1707) is NOT
// what the Android app actually calls in production — that's a separate Rust
// service on Carrier EC2 (see deployed-snapshots/carrier-exergynet_api/).
require('dotenv').config({ path: __dirname + '/.env' });
'use strict';
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');

const DROPS_DIR = process.env.DROPS_DIR || '/home/ubuntu/music-drops';
['audio', 'video', 'cover'].forEach(sub => fs.mkdirSync(`${DROPS_DIR}/${sub}`, { recursive: true }));

const dropsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sub = file.fieldname === 'audio' ? 'audio' : file.fieldname === 'video' ? 'video' : 'cover';
    cb(null, `${DROPS_DIR}/${sub}`);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.fieldname === 'audio' ? '.webm' : file.fieldname === 'video' ? '.mp4' : '.jpg');
    cb(null, `${uuidv4()}${ext}`);
  },
});
const dropsUpload = multer({
  storage: dropsStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'audio' && !/audio/i.test(file.mimetype)) return cb(new Error('Audio files only'));
    if (file.fieldname === 'video' && !/video/i.test(file.mimetype)) return cb(new Error('Video files only'));
    cb(null, true);
  },
});
// ══════════════════════════════════════════════════════════════════════════════
// biological_proxy — ExergyNet developer portal backend
// Port 5000 (local only, behind Caddy on portal.exergynet.org)
// ══════════════════════════════════════════════════════════════════════════════
const express   = require('express');
const cors      = require('cors');
const { Pool }  = require('pg');
const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const { AccessToken: LKAccessToken, RoomServiceClient } = require('livekit-server-sdk');

const LK_API_KEY    = process.env.LIVEKIT_API_KEY    || 'exergynet';
const LK_API_SECRET = process.env.LIVEKIT_API_SECRET;
if (!LK_API_SECRET) { console.error('[FATAL] LIVEKIT_API_SECRET env var is not set'); process.exit(1); }

const app  = express();
const PORT = parseInt(process.env.PORT || '5000');

// ── Auth rate limiter (no extra package) ─────────────────────────────────────
const _authHits = new Map();
function authRateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const entry = _authHits.get(key) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 15 * 60 * 1000; }
  entry.count++;
  _authHits.set(key, entry);
  if (entry.count > 15) return res.status(429).json({ error: 'Too many requests, try again later.' });
  next();
}

// ── Meet rate limiter — shared across write endpoints ────────────────────────
// Keyed by IP. 60 write requests per minute per IP per endpoint class.
const _meetHits = new Map();
function meetRateLimit(req, res, next) {
  const key = req.ip + ':' + req.path.split('/').slice(0, 5).join('/');
  const now = Date.now();
  const entry = _meetHits.get(key) || { count: 0, reset: now + 60_000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 60_000; }
  entry.count++;
  _meetHits.set(key, entry);
  if (entry.count > 60) return res.status(429).json({ error: 'Rate limit exceeded. Slow down.' });
  next();
}
// Purge every 5 min
setInterval(() => { const now = Date.now(); for (const [k, v] of _meetHits) { if (now > v.reset + 5000) _meetHits.delete(k); } }, 300_000);

// ── Constants ─────────────────────────────────────────────────────────────────
const JWT_SECRET    = process.env.JWT_SECRET || 'dev-secret-CHANGE-IN-PROD';
const SALT_ROUNDS   = 12;
const USDC_ADDRESS  = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const OPERATOR_WALLET = '0xbd1e790f6040FA62797671B84a50025a0133109C';
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const APEX_BASE_URL    = process.env.APEX_BASE_URL || 'https://explorer-api.exergynet.org';
const APEX_TOPUP_KEY   = process.env.APEX_TOPUP_KEY || 'SOVEREIGN_BYPASS';

// Credit the L0 Apex miners ledger so the siphon sees the balance.
// Fails silently — portal DB is already credited; this is a best-effort sync.
async function creditApexMiner(miner_id, amount_micro_usdc) {
  if (!miner_id) return;
  try {
    const r = await fetch(`${APEX_BASE_URL}/api/v1/miners/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ miner_id, amount_micro_usdc, admin_key: APEX_TOPUP_KEY }),
    });
    if (!r.ok) console.error(`[apex-topup] HTTP ${r.status} for miner ${miner_id}`);
    else console.log(`[apex-topup] credited ${amount_micro_usdc}µUSDC → miner ${miner_id}`);
  } catch (e) {
    console.error('[apex-topup] fetch failed:', e.message);
  }
}

// ── Stripe (optional) — module-level singleton ─────────────────────────────
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  console.log('[Stripe] initialized');
}

// ── Stripe webhook — MUST be before express.json() ────────────────────────────
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook/stripe] signature fail:', err.message);
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const developerId = session.metadata?.developer_id;
    const amountCents = session.amount_total ?? 0;
    if (developerId && amountCents > 0) {
      // 1 USD = 1,000,000 micro-USDC; 1 cent = 10,000 micro-USDC
      const microUsdc = amountCents * 10000;
      await pool.query(
        `UPDATE biological_developers
           SET usdc_micro_balance = usdc_micro_balance + $1,
               active = TRUE
         WHERE id = $2`,
        [microUsdc, developerId]
      );
      console.log(`[webhook/stripe] credited ${microUsdc} micro-USDC to ${developerId}`);
      await pool.query(
        `UPDATE biological_developers SET stripe_session_credited = COALESCE(stripe_session_credited, '[]'::jsonb) || $1::jsonb WHERE id = $2`,
        [JSON.stringify([session.id]), developerId]
      ).catch(() => {}); // best-effort; column may not exist yet
      // Sync to L0 miners ledger so the siphon sees the balance.
      const devRow = await pool.query(`SELECT node_id FROM biological_developers WHERE id = $1`, [developerId]);
      const nodeId = devRow.rows[0]?.node_id;
      if (nodeId) creditApexMiner(nodeId, microUsdc);
    }
  }
  res.json({ received: true });
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ── PostgreSQL pool ────────────────────────────────────────────────────────────
const pool = new Pool({
  host:                 process.env.PGHOST     || 'localhost',
  port:                 parseInt(process.env.PGPORT || '5432'),
  database:             process.env.PGDATABASE || 'biological_proxy',
  user:                 process.env.PGUSER     || 'ubuntu',
  password:             process.env.PGPASSWORD || undefined,
  max:                  25,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS biological_developers (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email            TEXT UNIQUE NOT NULL,
      password_hash    TEXT NOT NULL,
      api_key_hash     TEXT NOT NULL,
      api_key_preview  TEXT NOT NULL,
      wallet_address   TEXT,
      node_id          TEXT UNIQUE,
      username         TEXT UNIQUE,
      display_name     TEXT,
      bio              TEXT,
      usdc_micro_balance BIGINT NOT NULL DEFAULT 0,
      active           BOOLEAN NOT NULL DEFAULT FALSE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS node_id           TEXT UNIQUE;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS username           TEXT UNIQUE;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS display_name       TEXT;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS bio                TEXT;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS phone              TEXT;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS profile_image_b64  TEXT;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS profile_gallery          JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS stripe_session_credited  JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS lat                      DOUBLE PRECISION;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS lng                      DOUBLE PRECISION;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS foundation_ip            TEXT;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS first_seen_at            TIMESTAMPTZ;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS rho_micro_balance        BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS phone_verified           BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS daily_transfer_usdc      BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS daily_transfer_reset_at  TIMESTAMPTZ;
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS scopes                   JSONB NOT NULL DEFAULT '[]'::jsonb;

    CREATE TABLE IF NOT EXISTS transfers (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      sender_id    TEXT NOT NULL REFERENCES biological_developers(id),
      receiver_id  TEXT NOT NULL REFERENCES biological_developers(id),
      asset        TEXT NOT NULL CHECK (asset IN ('usdc_micro','rho_micro')),
      amount       BIGINT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_transfers_sender   ON transfers(sender_id,   created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transfers_receiver ON transfers(receiver_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS node_registrations (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      developer_id TEXT NOT NULL REFERENCES biological_developers(id),
      node_id      TEXT NOT NULL UNIQUE,
      device_type  TEXT NOT NULL,
      linked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_node_registrations_developer_id ON node_registrations(developer_id);

    CREATE TABLE IF NOT EXISTS rho_buyback_queue (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      node_id    TEXT NOT NULL,
      task_id    TEXT,
      amount     BIGINT NOT NULL DEFAULT 0,
      status     TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS en_jobs (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      developer_id     TEXT NOT NULL,
      prompt_hash      TEXT,
      tokens_yielded   INTEGER NOT NULL DEFAULT 0,
      bypassed_layers  INTEGER NOT NULL DEFAULT 0,
      zk_proof_status  TEXT NOT NULL DEFAULT 'queued',
      on_chain_sig     TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS claimed_deposits (
      tx_hash          TEXT PRIMARY KEY,
      developer_id     TEXT NOT NULL,
      credited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      developer_id     TEXT NOT NULL,
      provider         TEXT NOT NULL,
      provider_id      TEXT NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(provider, provider_id)
    );

    CREATE TABLE IF NOT EXISTS music_drops (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email        TEXT NOT NULL,
      artist       TEXT NOT NULL,
      title        TEXT NOT NULL,
      genre        TEXT NOT NULL DEFAULT '',
      description  TEXT NOT NULL DEFAULT '',
      audio_file   TEXT NOT NULL,
      video_file   TEXT,
      cover_file   TEXT,
      plays        INTEGER NOT NULL DEFAULT 0,
      likes        INTEGER NOT NULL DEFAULT 0,
      source       TEXT NOT NULL DEFAULT 'portal',
      spaces_ready BOOLEAN NOT NULL DEFAULT FALSE,
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE music_drops ADD COLUMN IF NOT EXISTS source       TEXT NOT NULL DEFAULT 'portal';
    ALTER TABLE music_drops ADD COLUMN IF NOT EXISTS spaces_ready BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS rho_buyback_queue (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      node_id     TEXT,
      task_id     TEXT,
      amount      BIGINT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'PENDING',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS xlmp_vault (
      xlmp_root        TEXT PRIMARY KEY,
      owner_id         TEXT NOT NULL,
      intent           TEXT NOT NULL DEFAULT 'agent-memory-commit',
      payload          TEXT NOT NULL,
      bytes_committed  INTEGER NOT NULL,
      committed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS build_audit_ledger (
      otet         TEXT PRIMARY KEY,
      service_name TEXT NOT NULL,
      target_id    TEXT NOT NULL,
      state_hash   TEXT NOT NULL,
      issued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
      spent_at     TIMESTAMPTZ,
      status       TEXT NOT NULL DEFAULT 'UNSPENT'
    );
    -- B-02: add expires_at column to existing table if migration needed
    ALTER TABLE build_audit_ledger ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours';
    -- B-03: plain content hash (no nonce) for pre_hash verification in agent-edit
    ALTER TABLE build_audit_ledger ADD COLUMN IF NOT EXISTS content_hash TEXT;

    CREATE TABLE IF NOT EXISTS articles (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug             TEXT UNIQUE NOT NULL,
      title            TEXT NOT NULL,
      subtitle         TEXT,
      content          TEXT NOT NULL DEFAULT '',
      excerpt          TEXT,
      cover_url        TEXT,
      author_name      TEXT NOT NULL DEFAULT 'ExergyNet',
      author_avatar    TEXT,
      tags             TEXT[] DEFAULT '{}',
      status           TEXT NOT NULL DEFAULT 'draft',
      featured         BOOLEAN NOT NULL DEFAULT false,
      reading_time_mins INT NOT NULL DEFAULT 1,
      published_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS articles_status_idx   ON articles(status);
    CREATE INDEX IF NOT EXISTS articles_slug_idx     ON articles(slug);
    CREATE INDEX IF NOT EXISTS articles_featured_idx ON articles(featured);

    CREATE TABLE IF NOT EXISTS meet_rooms (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_name       TEXT NOT NULL,
      host_id         TEXT REFERENCES biological_developers(id),
      xlmp_root       TEXT,
      status          TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS meet_rooms_host_idx    ON meet_rooms(host_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS meet_rooms_status_idx  ON meet_rooms(status);

    CREATE TABLE IF NOT EXISTS meet_messages (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id    UUID NOT NULL REFERENCES meet_rooms(id) ON DELETE CASCADE,
      identity   TEXT NOT NULL,
      message    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS meet_messages_room_idx ON meet_messages(room_id, created_at ASC);

    ALTER TABLE meet_rooms ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
    ALTER TABLE meet_join_requests ADD COLUMN IF NOT EXISTS requester_ip TEXT NOT NULL DEFAULT 'unknown';
    ALTER TABLE meet_rooms ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
    ALTER TABLE meet_rooms ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
    ALTER TABLE meet_rooms ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
    ALTER TABLE meet_rooms ADD COLUMN IF NOT EXISTS room_description TEXT;
    ALTER TABLE meet_rooms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS meet_rooms_scheduled_idx ON meet_rooms(scheduled_at) WHERE scheduled_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS meet_rooms_host_scheduled_idx ON meet_rooms(host_id, scheduled_at);

    CREATE TABLE IF NOT EXISTS meet_join_requests (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id    UUID NOT NULL REFERENCES meet_rooms(id) ON DELETE CASCADE,
      identity   TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      token      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS meet_join_req_room_idx ON meet_join_requests(room_id, status);

    CREATE TABLE IF NOT EXISTS device_bindings (
      fingerprint       TEXT PRIMARY KEY,
      exergynet_number  TEXT UNIQUE NOT NULL,
      platform          TEXT NOT NULL DEFAULT 'android',
      account_id        TEXT REFERENCES biological_developers(id),
      first_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS device_bindings_account_idx ON device_bindings(account_id);
    CREATE INDEX IF NOT EXISTS device_bindings_number_idx  ON device_bindings(exergynet_number);

    CREATE TABLE IF NOT EXISTS vanguard_memory (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      fingerprint TEXT NOT NULL,
      query       TEXT NOT NULL,
      response    TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS vanguard_memory_fp_idx ON vanguard_memory(fingerprint, created_at DESC);

    -- LNES-50.4: Co-Work multi-tenant sessions. owner_id follows the exact
    -- same pattern as meet_rooms.host_id (requireAuth's req.developerId,
    -- a TEXT UUID referencing biological_developers). Membership is keyed by
    -- exact email (never fuzzy-matched -- see the invite route) so a session
    -- can be shared across a user's own devices via login, not a device
    -- fingerprint like vanguard_memory above.
    CREATE TABLE IF NOT EXISTS cowork_sessions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id   TEXT NOT NULL REFERENCES biological_developers(id),
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cowork_sessions_owner_idx ON cowork_sessions(owner_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS cowork_members (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES cowork_sessions(id) ON DELETE CASCADE,
      user_email TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS cowork_members_unique_idx ON cowork_members(session_id, user_email);
    CREATE INDEX IF NOT EXISTS cowork_members_email_idx ON cowork_members(user_email);

    CREATE TABLE IF NOT EXISTS cowork_vault_links (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES cowork_sessions(id) ON DELETE CASCADE,
      xlmp_root  TEXT NOT NULL,
      added_by   TEXT,
      label      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS cowork_vault_links_unique_idx ON cowork_vault_links(session_id, xlmp_root);
    ALTER TABLE cowork_vault_links ADD COLUMN IF NOT EXISTS label TEXT;
  `);
  console.log('[DB] Tables ready');
}

// ── Omega-Meet: shared token helper ──────────────────────────────────────────
async function generateMeetToken(identity, roomName, role = 'guest') {
  const isAI   = role === 'ai_listener';
  const isHost = role === 'host';
  const metadata = JSON.stringify({ role: isAI ? 'ai_listener' : isHost ? 'host' : 'guest' });
  const at = new LKAccessToken(LK_API_KEY, LK_API_SECRET, { identity, metadata });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: !isAI, canSubscribe: true, canPublishData: true });
  return await at.toJwt();
}

// ── LNES-17: OTET Middleware ──────────────────────────────────────────────────
// Witness-Hash nonce cache (Chapter XXVI). In-memory Map; keyed by admin token.
// Nonces expire after 10 minutes. No Redis needed for single-server deploy.
const witnessNonceCache = new Map(); // token -> { nonce, file_path, expires_at }
function pruneNonceCache() {
  const now = Date.now();
  for (const [k, v] of witnessNonceCache) {
    if (v.expires_at < now) witnessNonceCache.delete(k);
  }
}
setInterval(pruneNonceCache, 60_000);
// requireOTET(expected_prefix): scoped OTET factory.
// A-03: validates token scope — target_id must start with expected_prefix.
// A-05: auto-spends the token BEFORE calling next() — replay is impossible.
// B-06: wrapped in try/catch — DB outage returns 500 not unhandled rejection.
// Usage: requireOTET('developer_credit:') — scope prefix must match target_id.
const requireOTET = (expected_prefix) => async (req, res, next) => {
  try {
    const token = req.headers['x-otet'];
    if (!token) {
      return res.status(423).json({ error: 'LNES-17 Violation: Missing One-Time Edit Token. Read before Action.' });
    }
    const { rows } = await pool.query(
      `SELECT * FROM build_audit_ledger WHERE otet = $1 AND status = 'UNSPENT'`,
      [token]
    );
    if (rows.length === 0) {
      return res.status(403).json({ error: 'OTET Invalid or Already Spent.' });
    }
    const meta = rows[0];
    // B-02: TTL enforcement — reject expired tokens even if still UNSPENT in DB
    if (meta.expires_at && new Date(meta.expires_at) < new Date()) {
      await pool.query(`UPDATE build_audit_ledger SET status = 'EXPIRED' WHERE otet = $1`, [token]);
      return res.status(403).json({ error: 'OTET Expired. Issue a new token.' });
    }
    // A-03: scope enforcement — token must be issued for this class of target
    if (expected_prefix && !meta.target_id.startsWith(expected_prefix)) {
      console.warn(`[OTET] SCOPE VIOLATION | expected=${expected_prefix} | got=${meta.target_id}`);
      return res.status(403).json({
        error: `OTET Scope Violation. Token was issued for "${meta.target_id}", not for "${expected_prefix}*".`,
      });
    }
    // A-05: auto-spend BEFORE next() — no route can replay the token
    await pool.query(
      `UPDATE build_audit_ledger SET status = 'SPENT', spent_at = NOW() WHERE otet = $1`,
      [token]
    );
    req.otet_meta = meta;
    console.log(`[OTET] Auto-spent: ${token.slice(0,16)}… | scope=${expected_prefix || 'any'} | target=${meta.target_id}`);
    next();
  } catch (e) {
    console.error('[OTET] Middleware crash:', e.message);
    res.status(500).json({ error: 'OTET Verification Crash — try again.' });
  }
};

// spendOTET: kept for backward compat (spend-otet endpoint uses it explicitly)
async function spendOTET(otet) {
  await pool.query(
    `UPDATE build_audit_ledger SET status = 'SPENT', spent_at = NOW() WHERE otet = $1`,
    [otet]
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function generateApiKey() {
  return 'sk-exergy-' + crypto.randomBytes(32).toString('hex');
}

function apiKeyPreview(key) {
  // Shows: sk-exergy-XXXXXXXX••••••••••••••••XXXX
  return key.slice(0, 18) + '••••••••••••••••' + key.slice(-4);
}

function signToken(developerId) {
  return jwt.sign({ sub: developerId }, JWT_SECRET, { expiresIn: '30d' });
}

// requireAuth accepts EITHER a portal JWT (Authorization: Bearer <jwt>)
// OR a raw API key (Authorization: Bearer sk-exergy-... OR X-API-Key: sk-exergy-...).
// Sets req.developerId on success.
async function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  const xApiKey = req.headers['x-api-key'];
  const raw = header?.startsWith('Bearer ') ? header.slice(7) : xApiKey || '';

  if (!raw) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  // Raw API key path
  if (raw.startsWith('sk-exergy-')) {
    try {
      const prefix = raw.slice(0, 18);
      const devs = await pool.query(
        `SELECT id, api_key_hash FROM biological_developers WHERE api_key_preview LIKE $1`,
        [prefix + '%']
      );
      let dev = null;
      for (const row of devs.rows) {
        if (await bcrypt.compare(raw, row.api_key_hash)) { dev = row; break; }
      }
      if (!dev) return res.status(401).json({ error: 'Invalid API key' });
      req.developerId = dev.id;
      req.dev = { id: dev.id };
      return next();
    } catch (err) {
      console.error('[requireAuth/apikey]', err);
      return res.status(500).json({ error: 'Auth check failed' });
    }
  }

  // JWT path
  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    req.developerId = payload.sub;
    req.dev = { id: payload.sub };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── GET /space/guest-token — developer-authenticated listener token for Spaces ─
// [PaaS-Alpha] requireAuth gate: developer must supply a valid sk-exergy-* key
// or portal JWT. Their users receive the guest token via the developer's backend.
// Ghost-mode browser listeners must go through an authenticated developer proxy.
app.get('/space/guest-token', requireAuth, async (req, res) => {
  const room = (req.query.room || '').trim();
  if (!room) return res.status(400).json({ error: 'room required' });

  const rawName = (req.query.name || '').trim().replace(/[^a-zA-Z0-9 _\-]/g, '').slice(0, 24);
  const suffix   = crypto.randomBytes(4).toString('hex');
  const identity = rawName
    ? `ghost_${rawName.replace(/\s+/g, '_')}_${suffix}`
    : `ghost_${suffix}`;

  try {
    // Strip Express's reflected-origin CORS header — Caddy's global "Access-Control-Allow-Origin: *"
    // is already set for this vhost. Two ACAO headers break the browser preflight check.
    res.removeHeader('Access-Control-Allow-Origin');
    res.removeHeader('Vary');

    const at = new LKAccessToken(LK_API_KEY, LK_API_SECRET, {
      identity,
      metadata: JSON.stringify({ role: 'ghost', displayName: rawName || null }),
    });
    at.addGrant({ roomJoin: true, room, canPublish: false, canSubscribe: true, canPublishData: false });
    const token = await at.toJwt();

    // Fetch current participant names so the web listener shows real names immediately
    // instead of waiting for a space.name broadcast that already happened before they joined.
    let nameMap = {};
    try {
      const svc = new RoomServiceClient('https://livekit.exergynet.org', LK_API_KEY, LK_API_SECRET);
      const participants = await svc.listParticipants(room);
      for (const p of participants) {
        let label = null;
        try { label = JSON.parse(p.metadata || '{}').displayName; } catch (_) {}
        if (!label && p.name) label = p.name;
        if (!label) {
          // ghost identity: ghost_Name_hex → extract name
          const gm = p.identity.match(/^ghost_(.+)_[0-9a-f]{4,8}$/i);
          label = gm ? gm[1].replace(/_/g, ' ') : null;
        }
        if (label) nameMap[p.identity] = label;
      }
    } catch (_) { /* room may not exist yet or LK unreachable — not fatal */ }

    return res.json({ token, identity, room, nameMap });
  } catch (err) {
    console.error('[space/guest-token]', err);
    return res.status(500).json({ error: 'Token generation failed' });
  }
});

// ── GET /api/v1/livekit/space/promote — host grants a listener speaker permission ─
// [LNES-68] Mirror endpoint so the Edge Witness Android app can reach portal.exergynet.org
// instead of the (now removed) standalone token service on livekit.exergynet.org.
// requireAuth: caller must present their developer API key (sk-exergy-*) or portal JWT.
app.get('/api/v1/livekit/space/promote', requireAuth, async (req, res) => {
  const room     = (req.query.room     || '').trim();
  const identity = (req.query.identity || '').trim();
  if (!room || !identity) return res.status(400).json({ error: 'room and identity required' });
  try {
    const svc = new RoomServiceClient('https://livekit.exergynet.org', LK_API_KEY, LK_API_SECRET);
    await svc.updateParticipant(room, identity, undefined, {
      canPublish: true, canSubscribe: true, canPublishData: true,
    });
    return res.json({ ok: true, action: 'promote', identity });
  } catch (err) {
    console.error('[space/promote]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/v1/livekit/space/demote — revokes a speaker's publish permission ──
app.get('/api/v1/livekit/space/demote', requireAuth, async (req, res) => {
  const room     = (req.query.room     || '').trim();
  const identity = (req.query.identity || '').trim();
  if (!room || !identity) return res.status(400).json({ error: 'room and identity required' });
  try {
    const svc = new RoomServiceClient('https://livekit.exergynet.org', LK_API_KEY, LK_API_SECRET);
    await svc.updateParticipant(room, identity, undefined, {
      canPublish: false, canSubscribe: true, canPublishData: false,
    });
    return res.json({ ok: true, action: 'demote', identity });
  } catch (err) {
    console.error('[space/demote]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/livekit/token — authenticated publisher/subscriber token for calls ─
// [PaaS-Alpha] requireAuth gate: bcrypt-validates sk-exergy-* keys against DB.
// When the room name matches a meet_rooms record, Meet rules apply:
//   - ARCHIVED rooms are rejected (410)
//   - Private rooms are rejected unless caller is the room host (403)
//   - Participant cap (50) is enforced (429)
// DLTN call rooms (dltn_* prefix) and Space rooms bypass Meet checks.
// Query params: room (required), identity (required), publish (optional, default 1)
app.get('/api/livekit/token', requireAuth, async (req, res) => {
  const room     = (req.query.room     || '').trim();
  const identity = (req.query.identity || '').trim();
  const publish  = req.query.publish !== '0';

  console.log('[LK-TOKEN-REQUEST] dev=' + req.developerId + ' room=' + room + ' identity=' + identity);

  if (!room || !identity) {
    return res.status(400).json({ error: 'room and identity are required' });
  }

  try {
    // Meet room registry enforcement — skip for DLTN call rooms and Space rooms
    const isMeetRoom = !room.startsWith('dltn_') && !room.startsWith('space_');
    if (isMeetRoom) {
      const meetRow = await pool.query(
        `SELECT id, status, is_private, host_id FROM meet_rooms WHERE room_name = $1`,
        [room]
      );
      if (meetRow.rows.length) {
        const mr = meetRow.rows[0];
        if (mr.status === 'ARCHIVED') {
          return res.status(410).json({ error: 'room_archived', message: 'This meeting has ended.' });
        }
        if (mr.is_private && mr.host_id !== req.developerId) {
          return res.status(403).json({ error: 'room_is_private', message: 'This is a private meeting. Only the host can join via API token.' });
        }
        // Participant cap
        const PARTICIPANT_CAP = 50;
        try {
          const roomSvc = new RoomServiceClient('https://livekit.exergynet.org', LK_API_KEY, LK_API_SECRET);
          const participants = await roomSvc.listParticipants(room);
          if (participants.length >= PARTICIPANT_CAP) {
            return res.status(429).json({ error: 'room_full', message: `This meeting has reached its ${PARTICIPANT_CAP}-participant limit.` });
          }
        } catch (capErr) {
          console.warn('[api/livekit/token] participant cap check failed:', capErr.message);
        }
      }
    }

    const at = new LKAccessToken(LK_API_KEY, LK_API_SECRET, { identity });
    at.addGrant({
      roomJoin:       true,
      room,
      canPublish:     publish,
      canSubscribe:   true,
      canPublishData: true,
    });
    const token = await at.toJwt();
    return res.json({ token, room, identity });
  } catch (err) {
    console.error('[api/livekit/token]', err);
    return res.status(500).json({ error: 'Token generation failed' });
  }
});

// ── Omega-Meet: Room Registry ─────────────────────────────────────────────────

// POST /api/meet/rooms — create a room (used by breakout room creation and external clients)
app.post('/api/meet/rooms', requireAuth, async (req, res) => {
  const room_name = (req.body?.room_name || '').trim();
  if (!room_name) return res.status(400).json({ error: 'room_name is required' });
  try {
    const r = await pool.query(
      `INSERT INTO meet_rooms (room_name, host_id) VALUES ($1, $2) RETURNING id, room_name, status, is_private, created_at`,
      [room_name, req.developerId]
    );
    const room = r.rows[0];
    return res.json({ room, join_url: `https://portal.exergynet.org/meet/${room.id}` });
  } catch (err) {
    console.error('[meet/create]', err);
    return res.status(500).json({ error: 'Room creation failed' });
  }
});

// POST /api/meet/rooms/create — host creates a sovereign room
app.post('/api/meet/rooms/create', requireAuth, async (req, res) => {
  const room_name      = (req.body?.room_name || '').trim();
  const is_private     = req.body?.is_private === true || req.body?.is_private === 'true';
  const scheduled_at   = req.body?.scheduled_at || null;
  const duration_mins  = parseInt(req.body?.duration_minutes) || 60;
  const timezone       = (req.body?.timezone || 'UTC').trim().slice(0, 64);
  const description    = (req.body?.room_description || '').trim().slice(0, 500) || null;
  if (!room_name) return res.status(400).json({ error: 'room_name is required' });
  try {
    const r = await pool.query(
      `INSERT INTO meet_rooms (room_name, host_id, is_private, scheduled_at, duration_minutes, timezone, room_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, room_name, status, is_private, scheduled_at, duration_minutes, timezone, room_description, created_at`,
      [room_name, req.developerId, is_private, scheduled_at, duration_mins, timezone, description]
    );
    const room = r.rows[0];
    const join_url = `https://portal.exergynet.org/meet/${room.id}`;
    return res.json({ room, join_url });
  } catch (err) {
    console.error('[meet/create]', err);
    return res.status(500).json({ error: 'Room creation failed' });
  }
});

// GET /api/meet/rooms — list host's rooms (upcoming scheduled first, then recent)
app.get('/api/meet/rooms', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, room_name, status, is_private, xlmp_root, created_at,
              scheduled_at, duration_minutes, timezone, room_description
       FROM meet_rooms WHERE host_id = $1
       ORDER BY
         CASE WHEN status='ACTIVE' AND scheduled_at > NOW() THEN 0
              WHEN status='ACTIVE' THEN 1
              ELSE 2 END,
         scheduled_at ASC NULLS LAST,
         created_at DESC
       LIMIT 50`,
      [req.developerId]
    );
    return res.json({ rooms: r.rows });
  } catch (err) {
    console.error('[meet/list]', err);
    return res.status(500).json({ error: 'List failed' });
  }
});

// GET /api/meet/rooms/:id — public room lookup; optionally returns is_host when Bearer JWT provided
app.get('/api/meet/rooms/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, room_name, status, is_private, host_id, created_at,
              scheduled_at, duration_minutes, timezone, room_description
       FROM meet_rooms WHERE id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Room not found' });
    const row = r.rows[0];
    let is_host = false;
    try {
      const authHeader = req.headers['authorization'];
      if (authHeader?.startsWith('Bearer ') && !authHeader.slice(7).startsWith('sk-exergy-')) {
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
        is_host = payload.sub === row.host_id;
      }
    } catch {}
    const { host_id, ...publicRoom } = row;
    return res.json({ room: publicRoom, is_host });
  } catch (err) {
    console.error('[meet/get]', err);
    return res.status(500).json({ error: 'Lookup failed' });
  }
});

// POST /api/meet/rooms/:id/end — host archives room
app.post('/api/meet/rooms/:id/end', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE meet_rooms SET status = 'ARCHIVED' WHERE id = $1 AND host_id = $2 RETURNING id`,
      [req.params.id, req.developerId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Room not found or not your room' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[meet/end]', err);
    return res.status(500).json({ error: 'End room failed' });
  }
});

// ── Omega-Meet AI Listener control (LNES-06 Option B) ──────────────────────────
// Host-only proxy to the actual bot control API on AskMo (20.127.220.199) —
// the bot runs there because that is where whisper-server lives. See
// meet_transcriber.js and the /api/meet-transcriber/* routes in AskMo's
// biological_proxy/src/index.ts for the real implementation.
const ASKMO_TRANSCRIBER_URL = process.env.ASKMO_TRANSCRIBER_URL || 'http://20.127.220.199:3000';
const MEET_TRANSCRIBER_SECRET = process.env.MEET_TRANSCRIBER_SECRET || 'exergynet-meet-transcriber-2026';

async function requireRoomHost(req, res) {
  const r = await pool.query('SELECT id, room_name, status, host_id FROM meet_rooms WHERE id = $1', [req.params.id]);
  if (!r.rows.length) { res.status(404).json({ error: 'Room not found' }); return null; }
  const room = r.rows[0];
  if (room.host_id !== req.developerId) { res.status(403).json({ error: 'Only the host can control AI transcription' }); return null; }
  if (room.status !== 'ACTIVE') { res.status(410).json({ error: 'Room is archived' }); return null; }
  return room;
}

app.post('/api/meet/rooms/:id/ai-listener/start', requireAuth, async (req, res) => {
  try {
    const room = await requireRoomHost(req, res);
    if (!room) return;
    const r = await fetch(`${ASKMO_TRANSCRIBER_URL}/api/meet-transcriber/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-transcriber-secret': MEET_TRANSCRIBER_SECRET },
      body: JSON.stringify({ room_id: req.params.id }),
    });
    const d = await r.json();
    return res.status(r.status).json(d);
  } catch (err) {
    console.error('[meet/ai-listener/start]', err);
    return res.status(502).json({ error: 'AI listener control unreachable' });
  }
});

app.post('/api/meet/rooms/:id/ai-listener/stop', requireAuth, async (req, res) => {
  try {
    const room = await requireRoomHost(req, res);
    if (!room) return;
    const r = await fetch(`${ASKMO_TRANSCRIBER_URL}/api/meet-transcriber/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-transcriber-secret': MEET_TRANSCRIBER_SECRET },
      body: JSON.stringify({ room_id: req.params.id }),
    });
    const d = await r.json();
    return res.status(r.status).json(d);
  } catch (err) {
    console.error('[meet/ai-listener/stop]', err);
    return res.status(502).json({ error: 'AI listener control unreachable' });
  }
});

app.get('/api/meet/rooms/:id/ai-listener/status', requireAuth, async (req, res) => {
  try {
    const room = await requireRoomHost(req, res);
    if (!room) return;
    const r = await fetch(`${ASKMO_TRANSCRIBER_URL}/api/meet-transcriber/status?room_id=${encodeURIComponent(req.params.id)}`, {
      headers: { 'x-transcriber-secret': MEET_TRANSCRIBER_SECRET },
    });
    const d = await r.json();
    return res.status(r.status).json(d);
  } catch (err) {
    console.error('[meet/ai-listener/status]', err);
    return res.status(502).json({ error: 'AI listener control unreachable' });
  }
});

// POST /api/meet/rooms/:id/guest-token — no auth; generates subscribe-only guest LK token
app.post('/api/meet/rooms/:id/guest-token', meetRateLimit, async (req, res) => {
  const identity = (req.body?.identity || 'guest').trim().slice(0, 64);
  // RT-01: role is forced to 'guest' — callers cannot self-assign 'ai_listener' to bypass private rooms
  const role = 'guest';
  try {
    const r = await pool.query(
      `SELECT id, room_name, status, is_private, host_id FROM meet_rooms WHERE id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Room not found' });
    const room = r.rows[0];
    if (room.status !== 'ACTIVE') return res.status(410).json({ error: 'Room is archived' });

    const subscribe_only = req.body?.subscribe_only === true;

    // Host bypass: if caller supplies their portal JWT and is the room creator, skip private gate
    let caller_is_host = false;
    try {
      const authHeader = req.headers['authorization'];
      if (authHeader?.startsWith('Bearer ') && !authHeader.slice(7).startsWith('sk-exergy-')) {
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
        caller_is_host = payload.sub === room.host_id;
      }
    } catch {}

    // RT-01 fix: private check applies to all callers; subscribe_only (bg audio from breakout) and verified host exempt
    if (room.is_private && !subscribe_only && !caller_is_host) {
      return res.status(403).json({ error: 'room_is_private', message: 'This meeting is private. Request access from the host.' });
    }

    // RT-07: enforce 50-participant cap
    const PARTICIPANT_CAP = 50;
    try {
      const roomSvc = new RoomServiceClient('https://livekit.exergynet.org', LK_API_KEY, LK_API_SECRET);
      const participants = await roomSvc.listParticipants(room.room_name);
      if (participants.length >= PARTICIPANT_CAP) {
        return res.status(429).json({ error: 'room_full', message: `This meeting has reached its ${PARTICIPANT_CAP}-participant limit.` });
      }
    } catch (capErr) {
      // LiveKit unavailable — don't block join, just log
      console.warn('[meet/guest-token] participant cap check failed:', capErr.message);
    }

    const metadata = JSON.stringify({ role: subscribe_only ? 'listener' : 'guest', type: 'human' });
    const at = new LKAccessToken(LK_API_KEY, LK_API_SECRET, { identity, metadata });
    at.addGrant({ roomJoin: true, room: room.room_name, canPublish: !subscribe_only, canSubscribe: true, canPublishData: !subscribe_only });
    const token = await at.toJwt();
    return res.json({ token, room_name: room.room_name, identity, role });
  } catch (err) {
    console.error('[meet/guest-token]', err);
    return res.status(500).json({ error: 'Token generation failed' });
  }
});

// ── Omega-Meet: Chat ──────────────────────────────────────────────────────────

// POST /api/meet/rooms/:id/message — participant sends a chat message
// RT-03: rate limited. RT-04: identity verified against LiveKit participants.
app.post('/api/meet/rooms/:id/message', meetRateLimit, async (req, res) => {
  const identity = (req.body?.identity || 'anonymous').trim().slice(0, 64);
  const message  = (req.body?.message  || '').trim().slice(0, 1000);
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    const room = await pool.query('SELECT status, room_name FROM meet_rooms WHERE id = $1', [req.params.id]);
    if (!room.rows.length) return res.status(404).json({ error: 'Room not found' });
    if (room.rows[0].status === 'ARCHIVED') return res.status(410).json({ error: 'Room is archived' });

    // RT-04: verify identity is an active LiveKit participant
    try {
      const roomSvc = new RoomServiceClient('https://livekit.exergynet.org', LK_API_KEY, LK_API_SECRET);
      const participants = await roomSvc.listParticipants(room.rows[0].room_name);
      const isInRoom = participants.some(p => p.identity === identity);
      if (!isInRoom) return res.status(403).json({ error: 'not_in_room', message: 'You must be in the room to send messages.' });
    } catch (lkErr) {
      // LiveKit unavailable — allow chat to avoid blocking legitimate users
      console.warn('[meet/message] LiveKit participant check failed:', lkErr.message);
    }

    const r = await pool.query(
      `INSERT INTO meet_messages (room_id, identity, message)
       VALUES ($1, $2, $3) RETURNING id, identity, message, created_at`,
      [req.params.id, identity, message]
    );
    return res.json({ message: r.rows[0] });
  } catch (err) {
    console.error('[meet/message]', err);
    return res.status(500).json({ error: 'Send failed' });
  }
});

// GET /api/meet/rooms/:id/messages?since=<ISO> — poll chat (unauthenticated)
app.get('/api/meet/rooms/:id/messages', async (req, res) => {
  const since = req.query.since;
  try {
    let r;
    if (since) {
      r = await pool.query(
        `SELECT id, identity, message, created_at FROM meet_messages
         WHERE room_id = $1 AND created_at > $2 ORDER BY created_at ASC LIMIT 100`,
        [req.params.id, since]
      );
    } else {
      r = await pool.query(
        `SELECT id, identity, message, created_at FROM meet_messages
         WHERE room_id = $1 ORDER BY created_at ASC LIMIT 100`,
        [req.params.id]
      );
    }
    return res.json({ messages: r.rows });
  } catch (err) {
    console.error('[meet/messages]', err);
    return res.status(500).json({ error: 'Fetch failed' });
  }
});

// PATCH /api/meet/rooms/:id/settings — host updates room settings (privacy, name, schedule, etc.)
app.patch('/api/meet/rooms/:id/settings', requireAuth, async (req, res) => {
  const body = req.body || {};
  const sets = []; const vals = [];
  let i = 1;
  if (body.room_name       !== undefined) { sets.push(`room_name=$${i++}`);        vals.push(body.room_name.trim().slice(0,255)); }
  if (body.is_private      !== undefined) { sets.push(`is_private=$${i++}`);       vals.push(!!body.is_private); }
  if (body.scheduled_at    !== undefined) { sets.push(`scheduled_at=$${i++}`);     vals.push(body.scheduled_at || null); }
  if (body.duration_minutes!== undefined) { sets.push(`duration_minutes=$${i++}`); vals.push(parseInt(body.duration_minutes)||60); }
  if (body.timezone        !== undefined) { sets.push(`timezone=$${i++}`);         vals.push((body.timezone||'UTC').trim().slice(0,64)); }
  if (body.room_description!== undefined) { sets.push(`room_description=$${i++}`); vals.push((body.room_description||'').trim().slice(0,500)||null); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  sets.push(`updated_at=NOW()`);
  vals.push(req.params.id, req.developerId);
  try {
    const r = await pool.query(
      `UPDATE meet_rooms SET ${sets.join(',')} WHERE id=$${i++} AND host_id=$${i++}
       RETURNING id, room_name, status, is_private, scheduled_at, duration_minutes, timezone, room_description`,
      vals
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Room not found or not your room' });
    return res.json({ ok: true, room: r.rows[0] });
  } catch (err) {
    console.error('[meet/settings]', err);
    return res.status(500).json({ error: 'Settings update failed' });
  }
});

// POST /api/meet/rooms/:id/join-request — guest submits a join request for a private room
// RT-03: rate limited. RT-08: dedup by (room_id, identity, requester_ip) to prevent token theft via name collision.
app.post('/api/meet/rooms/:id/join-request', meetRateLimit, async (req, res) => {
  const identity = (req.body?.identity || '').trim().slice(0, 64);
  if (!identity) return res.status(400).json({ error: 'identity required' });
  const requesterIp = req.ip || 'unknown';
  try {
    const room = await pool.query(`SELECT status, is_private FROM meet_rooms WHERE id=$1`, [req.params.id]);
    if (!room.rows.length) return res.status(404).json({ error: 'Room not found' });
    if (room.rows[0].status === 'ARCHIVED') return res.status(410).json({ error: 'Room is archived' });
    if (!room.rows[0].is_private) return res.status(400).json({ error: 'Room is not private' });

    // RT-08: dedup by IP — two different requesters with the same name get separate requests
    const existing = await pool.query(
      `SELECT id, status, token FROM meet_join_requests
       WHERE room_id=$1 AND identity=$2 AND requester_ip=$3 AND status IN ('pending','approved')
       ORDER BY created_at DESC LIMIT 1`,
      [req.params.id, identity, requesterIp]
    );
    if (existing.rows.length) {
      const ex = existing.rows[0];
      return res.json({ requestId: ex.id, status: ex.status, ...(ex.token ? { token: ex.token } : {}) });
    }
    const r = await pool.query(
      `INSERT INTO meet_join_requests (room_id, identity, requester_ip) VALUES ($1, $2, $3) RETURNING id`,
      [req.params.id, identity, requesterIp]
    );
    return res.json({ requestId: r.rows[0].id, status: 'pending' });
  } catch (err) {
    // RT-08 column may not exist yet — fall back to old dedup on first deploy
    if (err.code === '42703') {
      try {
        await pool.query(`ALTER TABLE meet_join_requests ADD COLUMN IF NOT EXISTS requester_ip TEXT NOT NULL DEFAULT 'unknown'`);
      } catch {}
    }
    console.error('[meet/join-request]', err);
    return res.status(500).json({ error: 'Join request failed' });
  }
});

// GET /api/meet/rooms/:id/join-request/:reqId — guest polls their request status
app.get('/api/meet/rooms/:id/join-request/:reqId', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT status, token FROM meet_join_requests WHERE id=$1 AND room_id=$2`,
      [req.params.reqId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Request not found' });
    const { status, token } = r.rows[0];
    return res.json({ status, ...(token ? { token } : {}) });
  } catch (err) {
    console.error('[meet/join-request/poll]', err);
    return res.status(500).json({ error: 'Poll failed' });
  }
});

// GET /api/meet/rooms/:id/join-requests — host views all pending requests
app.get('/api/meet/rooms/:id/join-requests', requireAuth, async (req, res) => {
  try {
    const room = await pool.query(`SELECT host_id FROM meet_rooms WHERE id=$1`, [req.params.id]);
    if (!room.rows.length) return res.status(404).json({ error: 'Room not found' });
    if (room.rows[0].host_id !== req.developerId) return res.status(403).json({ error: 'Not your room' });
    const r = await pool.query(
      `SELECT id, identity, created_at FROM meet_join_requests WHERE room_id=$1 AND status='pending' ORDER BY created_at ASC`,
      [req.params.id]
    );
    return res.json({ requests: r.rows });
  } catch (err) {
    console.error('[meet/join-requests/list]', err);
    return res.status(500).json({ error: 'List failed' });
  }
});

// POST /api/meet/rooms/:id/join-requests/:reqId/approve — host approves a join request
app.post('/api/meet/rooms/:id/join-requests/:reqId/approve', requireAuth, async (req, res) => {
  try {
    const room = await pool.query(`SELECT room_name, host_id FROM meet_rooms WHERE id=$1`, [req.params.id]);
    if (!room.rows.length) return res.status(404).json({ error: 'Room not found' });
    if (room.rows[0].host_id !== req.developerId) return res.status(403).json({ error: 'Not your room' });
    const jr = await pool.query(
      `SELECT identity FROM meet_join_requests WHERE id=$1 AND room_id=$2 AND status='pending'`,
      [req.params.reqId, req.params.id]
    );
    if (!jr.rows.length) return res.status(404).json({ error: 'Request not found or already handled' });
    const token = await generateMeetToken(jr.rows[0].identity, room.rows[0].room_name, 'guest');
    await pool.query(
      `UPDATE meet_join_requests SET status='approved', token=$1, updated_at=NOW() WHERE id=$2`,
      [token, req.params.reqId]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[meet/join-requests/approve]', err);
    return res.status(500).json({ error: 'Approval failed' });
  }
});

// POST /api/meet/rooms/:id/join-requests/:reqId/deny — host denies a join request
app.post('/api/meet/rooms/:id/join-requests/:reqId/deny', requireAuth, async (req, res) => {
  try {
    const room = await pool.query(`SELECT host_id FROM meet_rooms WHERE id=$1`, [req.params.id]);
    if (!room.rows.length) return res.status(404).json({ error: 'Room not found' });
    if (room.rows[0].host_id !== req.developerId) return res.status(403).json({ error: 'Not your room' });
    await pool.query(
      `UPDATE meet_join_requests SET status='denied', updated_at=NOW() WHERE id=$1 AND room_id=$2`,
      [req.params.reqId, req.params.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[meet/join-requests/deny]', err);
    return res.status(500).json({ error: 'Deny failed' });
  }
});

// POST /api/meet/rooms/:id/vault-anchor — host stores xlmp_root after recording
app.post('/api/meet/rooms/:id/vault-anchor', requireAuth, async (req, res) => {
  const xlmp_root = (req.body?.xlmp_root || '').trim();
  if (!xlmp_root) return res.status(400).json({ error: 'xlmp_root required' });
  try {
    const r = await pool.query(
      `UPDATE meet_rooms SET xlmp_root = $1 WHERE id = $2 AND host_id = $3 RETURNING id`,
      [xlmp_root, req.params.id, req.developerId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Room not found or not your room' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[meet/vault-anchor]', err);
    return res.status(500).json({ error: 'Anchor failed' });
  }
});

// ── POST /api/meet/vanguard — CORS-safe Vanguard AI proxy for Omega-Meet ────
// Forwards queries from portal.exergynet.org to the carrier (explorer-api)
// without the CORS issue caused by direct browser→carrier cross-origin POST.
// No auth required — the carrier itself is the authority; this is a thin relay.
app.post('/api/meet/vanguard', async (req, res) => {
  const { query, context } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query required' });
  try {
    const r = await fetch('https://explorer-api.exergynet.org/api/v1/vanguard-nav', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context: context || '' }),
    });
    const d = await r.json();
    return res.json(d);
  } catch (err) {
    console.error('[meet/vanguard]', err.message);
    return res.status(502).json({ error: 'Vanguard unreachable', response: '' });
  }
});

// ── POST /auth/api-token — exchange API key for a short-lived JWT (§1.2b) ────
app.post('/auth/api-token', authRateLimit, async (req, res) => {
  const apiKey = (req.body?.api_key || '').trim();
  if (!apiKey.startsWith('sk-exergy-')) {
    return res.status(400).json({ error: 'Invalid API key format' });
  }
  try {
    const prefix = apiKey.slice(0, 18);
    const devs = await pool.query(
      `SELECT id, api_key_hash FROM biological_developers WHERE api_key_preview LIKE $1`,
      [prefix + '%']
    );
    let dev = null;
    for (const row of devs.rows) {
      if (await bcrypt.compare(apiKey, row.api_key_hash)) { dev = row; break; }
    }
    if (!dev) return res.status(401).json({ error: 'Invalid API key' });
    res.json({ token: signToken(dev.id), expires_in: '30d' });
  } catch (err) {
    console.error('[auth/api-token]', err);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// ── POST /auth/register ───────────────────────────────────────────────────────
app.post('/auth/register', authRateLimit, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const apiKey       = generateApiKey();
    const apiKeyHash   = await bcrypt.hash(apiKey, SALT_ROUNDS);
    const preview      = apiKeyPreview(apiKey);

    const result = await pool.query(
      `INSERT INTO biological_developers (id, email, password_hash, api_key_hash, api_key_preview)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4) RETURNING id`,
      [email.toLowerCase().trim(), passwordHash, apiKeyHash, preview]
    );

    const token = signToken(result.rows[0].id);
    res.json({
      token,
      api_key:         apiKey,
      api_key_preview: preview,
      note: 'Save your API key immediately — it will never be shown again. Your password can be reset; this key cannot be recovered.',
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('[register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
app.post('/auth/login', authRateLimit, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const result = await pool.query(
      'SELECT id, password_hash FROM biological_developers WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const dev = result.rows[0];
    if (!dev.password_hash) {
      return res.status(401).json({ error: 'This account was created with Google or X login. Please use the social login button to sign in.' });
    }
    const valid = await bcrypt.compare(password, dev.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: signToken(dev.id) });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /auth/me — verify Bearer token, return email (used by Next.js API routes) ──
app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT email, display_name, usdc_micro_balance, node_id, lat FROM biological_developers WHERE id = $1',
      [req.developerId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    const { email, display_name, usdc_micro_balance, node_id, lat } = result.rows[0];
    res.json({ id: req.developerId, email, name: display_name, balance: usdc_micro_balance });
    // Backfill foundation coordinates for existing nodes that predate the geo pipeline
    if (node_id && lat === null) {
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
      const isPrivate = !ip || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip === '::1';
      if (!isPrivate) {
        fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon`)
          .then(r => r.json())
          .then(g => {
            if (g.status === 'success') {
              pool.query(
                `UPDATE biological_developers SET lat=$1, lng=$2, foundation_ip=$3, first_seen_at=NOW()
                 WHERE id=$4 AND lat IS NULL`,
                [g.lat, g.lon, ip, req.developerId]
              ).catch(() => {});
            }
          }).catch(() => {});
      }
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// ── POST /auth/rotate-key ─────────────────────────────────────────────────────
app.post('/auth/rotate-key', requireAuth, async (req, res) => {
  try {
    const apiKey     = generateApiKey();
    const apiKeyHash = await bcrypt.hash(apiKey, SALT_ROUNDS);
    const preview    = apiKeyPreview(apiKey);

    await pool.query(
      'UPDATE biological_developers SET api_key_hash = $1, api_key_preview = $2 WHERE id = $3',
      [apiKeyHash, preview, req.developerId]
    );
    res.json({ api_key: apiKey, note: 'New API key issued. Save it immediately.' });
  } catch (err) {
    console.error('[rotate-key]', err);
    res.status(500).json({ error: 'Key rotation failed' });
  }
});

// ── GET /developer/me ─────────────────────────────────────────────────────────
app.get('/developer/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, active, usdc_micro_balance, api_key_preview,
              wallet_address, node_id, username, display_name, bio,
              phone, profile_image_b64, profile_gallery, created_at
         FROM biological_developers WHERE id = $1`,
      [req.developerId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Developer not found' });

    const dev = result.rows[0];
    res.json({
      id:                 dev.id,
      email:              dev.email,
      active:             dev.active,
      usdc_micro_balance: Number(dev.usdc_micro_balance),
      usdc_balance_usd:   (Number(dev.usdc_micro_balance) / 1_000_000).toFixed(4),
      api_key_preview:    dev.api_key_preview,
      wallet_address:     dev.wallet_address,
      node_id:            dev.node_id,
      username:           dev.username,
      display_name:       dev.display_name,
      bio:                dev.bio,
      phone:              dev.phone,
      profile_image_b64:  dev.profile_image_b64,
      profile_gallery:    dev.profile_gallery || [],
      created_at:         dev.created_at,
    });
  } catch (err) {
    console.error('[developer/me]', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── PATCH /developer/me — update profile fields ───────────────────────────────
app.patch('/developer/me', requireAuth, async (req, res) => {
  const { username, display_name, bio, phone } = req.body || {};
  const updates = [];
  const params  = [];

  if (username !== undefined) {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3 || clean.length > 30) {
      return res.status(400).json({ error: 'Username must be 3–30 characters (letters, numbers, underscore)' });
    }
    params.push(clean);
    updates.push(`username = $${params.length}`);
  }
  if (display_name !== undefined) {
    params.push(display_name.trim().slice(0, 60));
    updates.push(`display_name = $${params.length}`);
  }
  if (bio !== undefined) {
    params.push(bio.trim().slice(0, 200));
    updates.push(`bio = $${params.length}`);
  }
  if (phone !== undefined) {
    const cleanPhone = phone.trim().slice(0, 30);
    params.push(cleanPhone || null);
    updates.push(`phone = $${params.length}`);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  params.push(req.developerId);
  try {
    await pool.query(
      `UPDATE biological_developers SET ${updates.join(', ')} WHERE id = $${params.length}`,
      params
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' });
    console.error('[PATCH /developer/me]', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// ── POST /developer/profile-image — upload/add image to gallery ───────────────
// Body: { image_b64: "data:image/jpeg;base64,..." or raw base64, set_active: true/false }
app.post('/developer/profile-image', requireAuth, async (req, res) => {
  const { image_b64, set_active } = req.body || {};
  if (!image_b64 || typeof image_b64 !== 'string') {
    return res.status(400).json({ error: 'image_b64 required' });
  }
  // Strip data URI prefix if present
  const raw = image_b64.replace(/^data:image\/[a-z]+;base64,/, '');
  if (raw.length > 1_500_000) { // ~1.1MB base64 limit per image
    return res.status(413).json({ error: 'Image too large (max ~800KB)' });
  }
  try {
    // Append to gallery array, cap at 8 images
    const result = await pool.query(
      `UPDATE biological_developers
          SET profile_gallery = (
            CASE WHEN jsonb_array_length(COALESCE(profile_gallery,'[]'::jsonb)) >= 8
              THEN profile_gallery
              ELSE COALESCE(profile_gallery,'[]'::jsonb) || $1::jsonb
            END
          )
        WHERE id = $2
        RETURNING profile_gallery`,
      [JSON.stringify(raw), req.developerId]
    );
    const gallery = result.rows[0]?.profile_gallery || [];
    const activeIdx = gallery.length - 1;
    if (set_active !== false) {
      await pool.query(
        `UPDATE biological_developers SET profile_image_b64 = $1 WHERE id = $2`,
        [raw, req.developerId]
      );
    }
    res.json({ ok: true, gallery_size: gallery.length, active_index: activeIdx });
  } catch (err) {
    console.error('[POST /developer/profile-image]', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── DELETE /developer/profile-image/:idx ─────────────────────────────────────
app.delete('/developer/profile-image/:idx', requireAuth, async (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'Invalid index' });
  try {
    const r = await pool.query(
      `SELECT profile_gallery, profile_image_b64 FROM biological_developers WHERE id = $1`,
      [req.developerId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    const gallery = r.rows[0].profile_gallery || [];
    if (idx >= gallery.length) return res.status(404).json({ error: 'Index out of range' });
    gallery.splice(idx, 1);
    const newActive = gallery.length > 0 ? gallery[0] : null;
    await pool.query(
      `UPDATE biological_developers SET profile_gallery = $1::jsonb, profile_image_b64 = $2 WHERE id = $3`,
      [JSON.stringify(gallery), newActive, req.developerId]
    );
    res.json({ ok: true, gallery_size: gallery.length });
  } catch (err) {
    console.error('[DELETE /developer/profile-image]', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ── PUT /developer/profile-image/active/:idx — set active image ──────────────
app.put('/developer/profile-image/active/:idx', requireAuth, async (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'Invalid index' });
  try {
    const r = await pool.query(
      `SELECT profile_gallery FROM biological_developers WHERE id = $1`,
      [req.developerId]
    );
    const gallery = r.rows[0]?.profile_gallery || [];
    if (idx >= gallery.length) return res.status(404).json({ error: 'Index out of range' });
    await pool.query(
      `UPDATE biological_developers SET profile_image_b64 = $1 WHERE id = $2`,
      [gallery[idx], req.developerId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /developer/profile-image/active]', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── POST /developer/link-node — bind node_id (16-char EC pubkey hash) to account
// The app sends the node_id + a hex-encoded EC signature over the account_id
// so the server can confirm the caller actually holds the private key.
app.post('/developer/link-node', requireAuth, async (req, res) => {
  const { node_id, device_type } = req.body || {};
  if (!node_id || typeof node_id !== 'string' || node_id.length !== 16) {
    return res.status(400).json({ error: 'node_id must be a 16-character string' });
  }
  const dtype = (['edge_witness', 'desktop_prover', 'ghost_node'].includes(device_type))
    ? device_type
    : 'edge_witness';
  try {
    // Check if node_id is already registered to a different account
    const existing = await pool.query(
      `SELECT developer_id FROM node_registrations WHERE node_id = $1`,
      [node_id]
    );
    if (existing.rows.length > 0 && existing.rows[0].developer_id !== req.developerId) {
      return res.status(409).json({ error: 'Node already linked to a different account' });
    }
    // Append to relational registry (upsert: update last_seen_at if already owned by this account)
    await pool.query(
      `INSERT INTO node_registrations (developer_id, node_id, device_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (node_id) DO UPDATE SET last_seen_at = NOW()`,
      [req.developerId, node_id, dtype]
    );
    // Geolocate registration IP → store as foundation coordinates (fire-and-forget)
    (async () => {
      try {
        const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
        const isPrivate = !ip || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip === '::1';
        if (!isPrivate) {
          const geo = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon`);
          const g = await geo.json();
          if (g.status === 'success') {
            await pool.query(
              `UPDATE biological_developers SET lat=$1, lng=$2, foundation_ip=$3, first_seen_at=NOW()
               WHERE id=$4 AND lat IS NULL`,
              [g.lat, g.lon, ip, req.developerId]
            );
          }
        }
      } catch (_) {}
    })();
    // Credit $10 (10,000,000 µUSDC) to the L0 miners ledger for every new node link.
    // Fire-and-forget — don't block the response on Apex availability.
    creditApexMiner(node_id, 10_000_000);
    res.json({ ok: true, node_id, device_type: dtype });
  } catch (err) {
    console.error('[link-node]', err);
    res.status(500).json({ error: 'Failed to link node' });
  }
});

// ── POST /developer/link-wallet ───────────────────────────────────────────────
app.post('/developer/link-wallet', requireAuth, async (req, res) => {
  const { wallet_address } = req.body || {};
  if (!wallet_address) return res.status(400).json({ error: 'wallet_address required' });

  try {
    await pool.query(
      'UPDATE biological_developers SET wallet_address = $1 WHERE id = $2',
      [wallet_address, req.developerId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[link-wallet]', err);
    res.status(500).json({ error: 'Failed to link wallet' });
  }
});

// ── POST /api/verify/send-code — dispatch 6-digit OTP via Twilio Verify ──────
app.post('/api/verify/send-code', requireAuth, async (req, res) => {
  const { phone } = req.body || {};
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'phone required (E.164 format, e.g. +13175550123)' });
  }
  const sid    = process.env.TWILIO_ACCOUNT_SID;
  const token  = process.env.TWILIO_AUTH_TOKEN;
  const vsid   = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token || !vsid) {
    return res.status(503).json({ error: 'Twilio not configured' });
  }
  try {
    const resp = await fetch(
      `https://verify.twilio.com/v2/Services/${vsid}/Verifications`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, Channel: 'sms' }).toString(),
      }
    );
    const body = await resp.json();
    if (!resp.ok) {
      console.error('[verify/send-code]', body);
      return res.status(502).json({ error: body.message || 'Twilio error' });
    }
    // Store phone on account (not yet verified)
    await pool.query(
      'UPDATE biological_developers SET phone = $1 WHERE id = $2',
      [phone, req.developerId]
    );
    res.json({ ok: true, status: body.status });
  } catch (err) {
    console.error('[verify/send-code]', err);
    res.status(500).json({ error: 'Failed to send code' });
  }
});

// ── POST /api/verify/confirm-code — validate OTP, set phone_verified = TRUE ──
app.post('/api/verify/confirm-code', requireAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code required' });
  }
  const sid    = process.env.TWILIO_ACCOUNT_SID;
  const token  = process.env.TWILIO_AUTH_TOKEN;
  const vsid   = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token || !vsid) {
    return res.status(503).json({ error: 'Twilio not configured' });
  }
  try {
    // Look up the phone stored during send-code
    const { rows } = await pool.query(
      'SELECT phone FROM biological_developers WHERE id = $1',
      [req.developerId]
    );
    if (!rows.length || !rows[0].phone) {
      return res.status(400).json({ error: 'No pending verification — call send-code first' });
    }
    const phone = rows[0].phone;
    const resp = await fetch(
      `https://verify.twilio.com/v2/Services/${vsid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, Code: code }).toString(),
      }
    );
    const body = await resp.json();
    if (!resp.ok || body.status !== 'approved') {
      return res.status(400).json({ error: 'Invalid or expired code', twilio_status: body.status });
    }
    await pool.query(
      'UPDATE biological_developers SET phone_verified = TRUE WHERE id = $1',
      [req.developerId]
    );
    res.json({ ok: true, phone_verified: true });
  } catch (err) {
    console.error('[verify/confirm-code]', err);
    res.status(500).json({ error: 'Failed to confirm code' });
  }
});

// ── POST /api/wallet/transfer — P2P µUSDC/µRHO transfer (KYC + cap gated) ───
const DAILY_TRANSFER_CAP_USDC = 500_000; // $0.50 bootstrap cap
app.post('/api/wallet/transfer', requireAuth, async (req, res) => {
  const { to_email, asset, amount } = req.body || {};
  if (!to_email || !asset || !amount) {
    return res.status(400).json({ error: 'to_email, asset, and amount required' });
  }
  if (!['usdc_micro', 'rho_micro'].includes(asset)) {
    return res.status(400).json({ error: 'asset must be usdc_micro or rho_micro' });
  }
  const amt = Math.floor(Number(amount));
  if (!Number.isInteger(amt) || amt <= 0) {
    return res.status(400).json({ error: 'amount must be a positive integer' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Auth: load sender, check phone_verified
    const { rows: senderRows } = await client.query(
      `SELECT id, email, phone_verified, usdc_micro_balance, rho_micro_balance,
              daily_transfer_usdc, daily_transfer_reset_at
         FROM biological_developers WHERE id = $1 FOR UPDATE`,
      [req.developerId]
    );
    if (!senderRows.length) throw Object.assign(new Error('Sender not found'), { status: 404 });
    const sender = senderRows[0];

    // 2. KYC guard
    if (!sender.phone_verified) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Phone verification required before transfers' });
    }

    // 3. Daily cap guard (USDC transfers only during bootstrap)
    if (asset === 'usdc_micro') {
      const now = new Date();
      const resetAt = sender.daily_transfer_reset_at ? new Date(sender.daily_transfer_reset_at) : null;
      const isNewDay = !resetAt || (now - resetAt) >= 86_400_000;
      const currentSpend = isNewDay ? 0 : Number(sender.daily_transfer_usdc);
      if (currentSpend + amt > DAILY_TRANSFER_CAP_USDC) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: 'Daily transfer cap reached (500,000 µUSDC / $0.50)',
          remaining_today: Math.max(0, DAILY_TRANSFER_CAP_USDC - currentSpend),
        });
      }
      // Update spend tracker
      await client.query(
        `UPDATE biological_developers
           SET daily_transfer_usdc = $1, daily_transfer_reset_at = $2
           WHERE id = $3`,
        [isNewDay ? amt : currentSpend + amt, isNewDay ? now : sender.daily_transfer_reset_at, req.developerId]
      );
    }

    // 4. Balance check
    const balanceCol = asset === 'usdc_micro' ? 'usdc_micro_balance' : 'rho_micro_balance';
    if (Number(sender[balanceCol]) < amt) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // 5. Load receiver
    const { rows: recvRows } = await client.query(
      `SELECT id FROM biological_developers WHERE email = $1 FOR UPDATE`,
      [to_email.toLowerCase()]
    );
    if (!recvRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipient not found' });
    }
    if (recvRows[0].id === req.developerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot transfer to self' });
    }

    // 6. Atomic debit/credit + transfer log
    await client.query(
      `UPDATE biological_developers SET ${balanceCol} = ${balanceCol} - $1 WHERE id = $2`,
      [amt, req.developerId]
    );
    await client.query(
      `UPDATE biological_developers SET ${balanceCol} = ${balanceCol} + $1 WHERE id = $2`,
      [amt, recvRows[0].id]
    );
    const { rows: txRows } = await client.query(
      `INSERT INTO transfers (sender_id, receiver_id, asset, amount)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [req.developerId, recvRows[0].id, asset, amt]
    );

    await client.query('COMMIT');

    const assetLabel = asset === 'usdc_micro' ? 'µUSDC' : 'µRHO';
    console.log(`[TRANSFER] ${sender.email} → ${to_email} | ${amt} ${assetLabel}`);
    res.json({ ok: true, transfer_id: txRows[0].id, transferred: amt, asset, to: to_email });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[wallet/transfer]', err);
    res.status(err.status || 500).json({ error: err.message || 'Transfer failed' });
  } finally {
    client.release();
  }
});

// ── GET /developer/transfers — paginated P2P transfer history (sent + received)
app.get('/developer/transfers', requireAuth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const [rows, totRow] = await Promise.all([
      pool.query(
        `SELECT t.id, t.asset, t.amount, t.created_at,
                CASE WHEN t.sender_id = $1 THEN 'sent' ELSE 'received' END AS direction,
                CASE WHEN t.sender_id = $1 THEN r.email ELSE s.email END AS counterparty
           FROM transfers t
           JOIN biological_developers s ON s.id = t.sender_id
           JOIN biological_developers r ON r.id = t.receiver_id
          WHERE t.sender_id = $1 OR t.receiver_id = $1
          ORDER BY t.created_at DESC
          LIMIT $2 OFFSET $3`,
        [req.developerId, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM transfers WHERE sender_id = $1 OR receiver_id = $1`,
        [req.developerId]
      ),
    ]);
    res.json({ transfers: rows.rows, total: parseInt(totRow.rows[0].count), limit, offset });
  } catch (err) {
    console.error('[developer/transfers]', err);
    res.status(500).json({ error: 'Failed to load transfers' });
  }
});

// ── GET /developer/jobs ───────────────────────────────────────────────────────
app.get('/developer/jobs', requireAuth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;

  try {
    const params = [req.developerId];
    let where = 'WHERE developer_id = $1';

    if (status) {
      params.push(status);
      where += ` AND zk_proof_status = $${params.length}`;
    }

    const [rows, total] = await Promise.all([
      pool.query(
        `SELECT id as job_id, prompt_hash, tokens_yielded, bypassed_layers,
                zk_proof_status, on_chain_sig, created_at
           FROM en_jobs ${where}
          ORDER BY created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM en_jobs ${where}`, params),
    ]);

    res.json({
      jobs:   rows.rows,
      total:  parseInt(total.rows[0].count),
      limit,
      offset,
    });
  } catch (err) {
    console.error('[developer/jobs]', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// ── GET /developer/stats ──────────────────────────────────────────────────────
app.get('/developer/stats', requireAuth, async (req, res) => {
  try {
    const [agg, daily, byStatus] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(tokens_yielded), 0)       AS total_tokens,
                COUNT(*)                                AS total_jobs,
                COALESCE(SUM(bypassed_layers), 0)       AS total_bypassed_layers,
                COALESCE(AVG(bypassed_layers)::text, '0') AS avg_bypassed_layers
           FROM en_jobs WHERE developer_id = $1`,
        [req.developerId]
      ),
      pool.query(
        `SELECT DATE_TRUNC('day', created_at) AS day,
                COALESCE(SUM(tokens_yielded), 0) AS tokens
           FROM en_jobs
          WHERE developer_id = $1
            AND created_at > NOW() - INTERVAL '7 days'
          GROUP BY 1 ORDER BY 1`,
        [req.developerId]
      ),
      pool.query(
        `SELECT zk_proof_status, COUNT(*) AS cnt
           FROM en_jobs WHERE developer_id = $1
          GROUP BY zk_proof_status`,
        [req.developerId]
      ),
    ]);

    const byStatusMap = { queued: 0, settled: 0, pending: 0 };
    for (const row of byStatus.rows) {
      byStatusMap[row.zk_proof_status] = parseInt(row.cnt);
    }

    const a = agg.rows[0];
    res.json({
      total_tokens:          parseInt(a.total_tokens),
      total_jobs:            parseInt(a.total_jobs),
      total_bypassed_layers: parseInt(a.total_bypassed_layers),
      avg_bypassed_layers:   a.avg_bypassed_layers,
      daily:                 daily.rows.map(r => ({ day: r.day, tokens: parseInt(r.tokens) })),
      by_status:             byStatusMap,
    });
  } catch (err) {
    console.error('[developer/stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── POST /api/deposit/claim ───────────────────────────────────────────────────
app.post('/api/deposit/claim', requireAuth, async (req, res) => {
  const { tx_hash, usdc_amount_micro } = req.body || {};
  if (!tx_hash || usdc_amount_micro == null) {
    return res.status(400).json({ error: 'tx_hash and usdc_amount_micro required' });
  }

  // Quick dedup check before hitting the RPC
  try {
    const dup = await pool.query(
      'SELECT tx_hash FROM claimed_deposits WHERE tx_hash = $1',
      [tx_hash]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'Deposit already claimed' });
    }
  } catch (err) {
    console.error('[deposit/claim dedup]', err);
    return res.status(500).json({ error: 'Deposit verification failed' });
  }

  // Verify on Base Sepolia
  try {
    const rpcRes = await fetch(BASE_SEPOLIA_RPC, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method:  'eth_getTransactionReceipt',
        params:  [tx_hash],
      }),
    });
    const rpcData = await rpcRes.json();
    const receipt = rpcData.result;

    if (!receipt)            return res.status(400).json({ error: 'Transaction not found or not yet confirmed' });
    if (receipt.status !== '0x1') return res.status(400).json({ error: 'Transaction reverted on-chain' });

    // Find USDC Transfer log with operator as recipient (topic[2])
    const operatorPadded = OPERATOR_WALLET.slice(2).toLowerCase().padStart(64, '0');
    const transferLog = (receipt.logs || []).find(
      (log) =>
        log.address?.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
        log.topics?.[0] === ERC20_TRANSFER_TOPIC &&
        log.topics?.[2]?.slice(2).toLowerCase() === operatorPadded
    );

    if (!transferLog) {
      return res.status(400).json({ error: 'No USDC transfer to operator wallet found in this transaction' });
    }

    const onChainMicro = parseInt(transferLog.data, 16);
    const claimed      = parseInt(usdc_amount_micro);

    // Allow ±1 micro-USDC for rounding
    if (Math.abs(onChainMicro - claimed) > 1) {
      return res.status(400).json({
        error: `Amount mismatch — on-chain: ${onChainMicro} µUSDC, claimed: ${claimed} µUSDC`,
      });
    }

    // Atomic insert + credit (dedup on tx_hash PK prevents double-claim races)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO claimed_deposits (tx_hash, developer_id) VALUES ($1, $2)',
        [tx_hash, req.developerId]
      );
      await client.query(
        `UPDATE biological_developers
            SET usdc_micro_balance = usdc_micro_balance + $1,
                active = TRUE
          WHERE id = $2`,
        [onChainMicro, req.developerId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Deposit already claimed (concurrent request)' });
      }
      throw err;
    } finally {
      client.release();
    }

    console.log(`[deposit/claim] credited ${onChainMicro} µUSDC → developer ${req.developerId}`);
    // Sync to L0 miners ledger so the siphon sees the balance.
    const devRow = await pool.query(`SELECT node_id, email FROM biological_developers WHERE id = $1`, [req.developerId]);
    const nodeId = devRow.rows[0]?.node_id;
    if (nodeId) creditApexMiner(nodeId, onChainMicro);

    // LNES-65/LNES-66: credit portal voice credits proportionally to the USDC deposit.
    // 1 USD = 10,000 voice credits (same rate as Stripe billing/confirm/route.ts).
    // Fire-and-forget — biological_proxy DB is already credited; portal sync is best-effort.
    const devEmail = devRow.rows[0]?.email;
    const billingAdminToken = process.env.BILLING_ADMIN_TOKEN;
    if (devEmail && billingAdminToken) {
      const voiceCredits = Math.round((onChainMicro / 1_000_000) * 10_000);
      if (voiceCredits > 0) {
        fetch('https://portal.exergynet.org/api/billing/add-credits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-billing-admin-token': billingAdminToken,
          },
          body: JSON.stringify({ email: devEmail, credits: voiceCredits }),
        })
          .then(r => r.ok
            ? console.log(`[deposit/claim] voice-credits synced ${voiceCredits} → ${devEmail}`)
            : r.text().then(t => console.error(`[deposit/claim] voice-credits HTTP ${r.status}: ${t.slice(0, 120)}`))
          )
          .catch(e => console.error('[deposit/claim] voice-credits sync failed:', e.message));
      }
    }
    res.json({
      ok:           true,
      credited_micro: onChainMicro,
      credited_usd:   (onChainMicro / 1_000_000).toFixed(4),
    });
  } catch (err) {
    console.error('[deposit/claim]', err);
    res.status(500).json({ error: 'Deposit verification failed' });
  }
});

// ── POST /api/create-checkout-session ─────────────────────────────────────────
app.post('/api/create-checkout-session', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  const { amount_usd } = req.body ?? {};
  if (!amount_usd || typeof amount_usd !== 'number' || amount_usd < 5) {
    return res.status(400).json({ error: 'amount_usd must be a number >= 5' });
  }
  const portalUrl = (process.env.PORTAL_URL ?? 'https://portal.exergynet.org').replace(/\/$/, '');
  const amountCents = Math.round(amount_usd * 100);
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: 'ExergyNet Compute Credits',
            description: `$${amount_usd.toFixed(2)} USDC compute credit — ${Math.floor(amount_usd / 0.0004).toLocaleString()} tokens`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        developer_id:      req.developerId,
        usdc_amount_micro: String(Math.round(amount_usd * 1_000_000)),
      },
      success_url: `${portalUrl}/dashboard/billing?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${portalUrl}/dashboard/billing?stripe=cancelled`,
    });
    console.log(`[STRIPE] checkout session ${session.id} for developer ${req.developerId} | $${amount_usd}`);
    res.json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error('[STRIPE] create-checkout-session error:', err.message);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
});

// ── POST /api/stripe/verify-session — fallback credit on return from Stripe ──────
// Called by billing page when ?stripe=success lands. Retrieves the session directly
// from Stripe API and credits the user if payment succeeded and not already credited.
// Idempotent — safe to call multiple times for the same session.
app.post('/api/stripe/verify-session', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  const { session_id } = req.body ?? {};
  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({ error: 'session_id required' });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id);
  } catch (err) {
    console.error('[verify-session] Stripe retrieve error:', err.message);
    return res.status(502).json({ error: 'Failed to retrieve Stripe session' });
  }

  if (session.payment_status !== 'paid') {
    return res.json({ ok: false, reason: 'payment not completed' });
  }

  const developerId = session.metadata?.developer_id;
  if (developerId !== req.developerId) {
    return res.status(403).json({ error: 'Session does not belong to this account' });
  }

  // Idempotency check — if webhook already credited this session, skip
  const already = await pool.query(
    `SELECT id FROM biological_developers
     WHERE id = $1 AND stripe_session_credited @> $2::jsonb`,
    [developerId, JSON.stringify([session_id])]
  ).catch(() => ({ rows: [] }));

  if (already.rows.length > 0) {
    const dev = await pool.query(
      `SELECT usdc_micro_balance FROM biological_developers WHERE id = $1`,
      [developerId]
    );
    return res.json({ ok: true, already_credited: true, new_balance_micro: dev.rows[0]?.usdc_micro_balance ?? 0 });
  }

  const amountCents = session.amount_total ?? 0;
  if (amountCents <= 0) {
    return res.status(400).json({ error: 'Invalid session amount' });
  }
  const microUsdc = amountCents * 10000;

  try {
    const result = await pool.query(
      `UPDATE biological_developers
         SET usdc_micro_balance = usdc_micro_balance + $1,
             active = TRUE,
             stripe_session_credited = COALESCE(stripe_session_credited, '[]'::jsonb) || $3::jsonb
       WHERE id = $2
       RETURNING usdc_micro_balance`,
      [microUsdc, developerId, JSON.stringify([session_id])]
    );
    const newBalance = result.rows[0]?.usdc_micro_balance ?? 0;
    console.log(`[verify-session] credited ${microUsdc} µUSDC to ${developerId} | session ${session_id} | balance ${newBalance}`);

    const devRow = await pool.query(`SELECT node_id FROM biological_developers WHERE id = $1`, [developerId]);
    const nodeId = devRow.rows[0]?.node_id;
    if (nodeId) creditApexMiner(nodeId, microUsdc);

    res.json({ ok: true, credited_micro: microUsdc, new_balance_micro: newBalance });
  } catch (err) {
    console.error('[verify-session] credit error:', err.message);
    res.status(500).json({ error: 'Credit failed' });
  }
});

// ── POST /api/dt-token — device token for Vanguard chat (Edge Witness app) ─────
app.post('/api/dt-token', async (req, res) => {
  const DT_PASSWORD = process.env.DT_TOKEN_PASSWORD || 'Exergynet2026@';
  const { password } = req.body || {};
  if (!password || password !== DT_PASSWORD) {
    return res.status(401).json({ error: 'Invalid device token password' });
  }
  const token = jwt.sign(
    { sub: 'edge-witness-device', iss: 'exergynet-dt', role: 'vanguard_chat' },
    JWT_SECRET, { expiresIn: '2h' }
  );
  res.json({ ok: true, token });
});

// ── POST /v1/chat/completions — Vanguard LLM proxy (API key OR dt-token JWT) ──
app.post('/v1/chat/completions', async (req, res) => {
  const raw = req.headers['authorization']?.replace('Bearer ', '') || '';
  if (!raw) return res.status(401).json({ error: 'Missing authorization' });

  // devId is set for billable callers (API key or portal session JWT).
  // dt-tokens (edge-witness-device) pass through without billing.
  let devId = null;

  if (raw.startsWith('sk-exergy-')) {
    // API key path — fetch balance for billing
    try {
      const prefix = raw.slice(0, 18);
      const devs = await pool.query(
        `SELECT id, api_key_hash, active, usdc_micro_balance FROM biological_developers WHERE api_key_preview LIKE $1`,
        [prefix + '%']
      );
      let dev = null;
      for (const row of devs.rows) { if (await bcrypt.compare(raw, row.api_key_hash)) { dev = row; break; } }
      if (!dev) return res.status(401).json({ error: 'Invalid API key' });
      if (!dev.active) return res.status(403).json({ error: 'Account inactive' });
      if (Number(dev.usdc_micro_balance) <= 0) return res.status(402).json({ error: 'Insufficient balance — top up USDC to continue' });
      devId = dev.id;
    } catch (err) {
      console.error('[v1/chat auth]', err);
      return res.status(500).json({ error: 'Auth check failed' });
    }
  } else {
    // JWT path — verify signature first
    let payload;
    try {
      payload = jwt.verify(raw, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    // Portal session JWTs have sub=developerId (UUID). dt-tokens have sub='edge-witness-device'.
    // Only bill portal sessions; let service tokens through without balance check.
    if (payload.sub && payload.role !== 'vanguard_chat' && payload.sub !== 'edge-witness-device' && payload.sub !== 'claude-code-agent') {
      try {
        const { rows } = await pool.query(
          'SELECT id, active, usdc_micro_balance FROM biological_developers WHERE id = $1',
          [payload.sub]
        );
        if (rows.length > 0) {
          if (!rows[0].active) return res.status(403).json({ error: 'Account inactive' });
          if (Number(rows[0].usdc_micro_balance) <= 0) return res.status(402).json({ error: 'Insufficient balance — top up USDC to continue' });
          devId = rows[0].id;
        }
      } catch (err) {
        console.error('[v1/chat jwt-lookup]', err);
      }
    }
  }

  // Helper: record job + deduct balance after a successful inference
  async function recordJob(tokensYielded, prompt) {
    if (!devId || tokensYielded <= 0) return;
    const microUsdcCost = Math.max(1, Math.floor(tokensYielded * 400));
    const promptHash = prompt ? crypto.createHash('sha256').update(String(prompt)).digest('hex').slice(0, 16) : null;
    try {
      await pool.query(
        `UPDATE biological_developers SET usdc_micro_balance = GREATEST(0, usdc_micro_balance - $1) WHERE id = $2`,
        [microUsdcCost, devId]
      );
      await pool.query(
        `INSERT INTO en_jobs (developer_id, prompt_hash, tokens_yielded, zk_proof_status) VALUES ($1, $2, $3, 'settled')`,
        [devId, promptHash, tokensYielded]
      );
    } catch (e) {
      console.error('[v1/chat record]', e.message);
    }
  }

  // [LNES-20] Cognitive Router — model-gated path selection
  const requestedModel = req.body?.model || 'vanguard-standard';
  const PROPOSER_URL   = process.env.SEI_VANGUARD_URL  || 'http://20.127.220.199:3000';
  const AUDITOR_URL    = process.env.NVIDIA_NIM_URL     || 'http://40.124.170.30:3000';
  const XAI_URL        = process.env.XAI_VANGUARD_URL  || 'https://api.x.ai/v1/chat/completions';
  let   VG_KEY         = process.env.SEI_VANGUARD_KEY  || 'sk-vanguard-apex-internal-v1';

  // Probe Auditor liveness (fast 3s timeout); fall back to Proposer if down
  let VG_URL;
  if (requestedModel === 'grok-4.5' || requestedModel === 'grok-build-0.1') {
    // [LNES-61] xAI Grok endpoint — /M tokens, 20% sovereign margin
    VG_URL = XAI_URL;
    VG_KEY = process.env.XAI_API_KEY || '';
    console.log(`[LNES-20] Routing model="${requestedModel}" → xAI Grok ${XAI_URL}`);
  } else if (requestedModel === 'NVIDIA' || requestedModel === 'vanguard-auditor') {
    let auditorLive = false;
    try {
      const probe = await fetch(`${AUDITOR_URL}/health`, { signal: AbortSignal.timeout(3000) });
      auditorLive = probe.ok;
    } catch (_) { auditorLive = false; }
    if (auditorLive) {
      VG_URL = AUDITOR_URL;
      console.log(`[LNES-20] Routing model="${requestedModel}" → Auditor (Nemotron) ${AUDITOR_URL}`);
    } else {
      VG_URL = PROPOSER_URL;
      console.warn(`[LNES-20] Auditor unreachable — failing over model="${requestedModel}" → Proposer ${PROPOSER_URL}`);
    }
  } else {
    // vanguard-standard, vanguard-engine, vanguard, or any unrecognized → Proposer
    VG_URL = PROPOSER_URL;
    console.log(`[LNES-20] Routing model="${requestedModel}" → Proposer (Qwen) ${PROPOSER_URL}`);
  }

  const isStreaming   = req.body?.stream === true;
  const isJsonObject  = req.body?.response_format?.type === 'json_object';
  const isClinical    = req.body?.domain === 'clinical' || req.headers['x-vanguard-domain'] === 'clinical';
  const lastUserMsg   = (() => { const msgs = req.body?.messages; return Array.isArray(msgs) ? (msgs.filter(m => m.role === 'user').pop()?.content ?? '') : ''; })();

  // Inject clinical system guard for json_object or clinical domain requests
  let upstreamBody = req.body;
  if ((isJsonObject || isClinical) && !isStreaming) {
    const clinicalGuard = {
      role: 'system',
      content: 'You are a deterministic extraction engine. Your entire output must be a valid JSON object. Never mention your name. Never prepend system labels. Never explain your reasoning. No markdown. No code fences. If information is missing: return null. If uncertain: set confidence accordingly.',
    };
    const messages = Array.isArray(upstreamBody?.messages) ? upstreamBody.messages : [];
    // Prepend guard only if not already present
    const hasGuard = messages[0]?.role === 'system' && messages[0]?.content?.includes('deterministic');
    upstreamBody = { ...upstreamBody, stream: false, messages: hasGuard ? messages : [clinicalGuard, ...messages.filter(m => m.role !== 'system')] };
  }

  try {
    const upstream = await fetch(`${VG_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VG_KEY}` },
      body: JSON.stringify(upstreamBody),
      signal: AbortSignal.timeout(90000),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('[v1/chat proxy]', upstream.status, errText.slice(0, 200));
      return res.status(502).json({ error: 'Vanguard unavailable' });
    }

    // Non-streaming path: read full response, apply normalizer for json_object calls
    if (!isStreaming) {
      const data = await upstream.json();
      if (isJsonObject || isClinical) {
        const rawContent = data.choices?.[0]?.message?.content ?? '';
        const normalized = normalizeExtractionResponse(rawContent);
        try {
          JSON.parse(normalized); // validate
          if (data.choices?.[0]?.message) {
            data.choices[0].message.content = normalized;
          }
        } catch {
          console.error('[v1/chat proxy] json_object normalizer failed to produce valid JSON. raw:', rawContent.slice(0, 200));
          return res.status(502).json({ error: 'Model returned non-JSON response for json_object request' });
        }
      }
      // Record job: prefer model-reported token count, fall back to word count
      const completionText = data.choices?.[0]?.message?.content ?? '';
      const tokensYielded = data.usage?.completion_tokens || Math.max(1, completionText.split(/\s+/).filter(Boolean).length);
      recordJob(tokensYielded, lastUserMsg).catch(() => {});
      return res.json(data);
    }

    // Streaming path: intercept SSE chunks to accumulate text for job recording
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    let streamedText = '';
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      res.write(chunk);
      // Accumulate delta.content for billing
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const token = JSON.parse(data)?.choices?.[0]?.delta?.content;
          if (token) streamedText += token;
        } catch {}
      }
    }
    res.end();
    // Record after stream ends
    const tokensYielded = Math.max(1, streamedText.split(/\s+/).filter(Boolean).length);
    recordJob(tokensYielded, lastUserMsg).catch(() => {});
  } catch (e) {
    console.error('[v1/chat proxy]', e.message);
    if (!res.headersSent) res.status(503).json({ error: 'Vanguard unreachable' });
    else res.end();
  }
});

// ── POST /api/v1/vanguard-nav ─ Edge Witness → Vanguard bridge (service-to-service) ──
// Auth: x-explorer-secret header matched against EXPLORER_BRIDGE_SECRET env var.
// Body: { query: string, context: string }
// Returns: { response: string }  (same format Kotlin/Axum expects)
app.post('/api/v1/vanguard-nav', async (req, res) => {
  const bridgeSecret = process.env.EXPLORER_BRIDGE_SECRET;
  if (!bridgeSecret || req.headers['x-explorer-secret'] !== bridgeSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { query, context } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query required' });

  const VG_KEY      = process.env.SEI_VANGUARD_KEY  || 'sk-vanguard-apex-internal-v1';
  const PROPOSER    = process.env.SEI_VANGUARD_URL   || 'http://20.127.220.199:3000';
  const AUDITOR     = process.env.NVIDIA_NIM_URL     || 'http://40.124.170.30:3000';

  // Prefer Auditor (A10 GPU, Nemotron-3 — better spoken responses); fall back to Proposer.
  let VG_URL = AUDITOR;
  try {
    const probe = await Promise.race([
      fetch(`${AUDITOR}/health`).then(r => r.ok ? AUDITOR : null),
      new Promise(r => setTimeout(() => r(null), 2000)),
    ]);
    if (!probe) VG_URL = PROPOSER;
  } catch { VG_URL = PROPOSER; }

  try {
    const upstream = await fetch(`${VG_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VG_KEY}` },
      body: JSON.stringify({
        model: 'vanguard',
        messages: [
          { role: 'system', content: context || 'You are Vanguard, an ExergyNet navigation AI.' },
          { role: 'user',   content: query },
        ],
        max_tokens: 120,
        temperature: 0.5,
        stream: false,
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!upstream.ok) {
      console.error(`[VANGUARD_NAV] upstream ${upstream.status}`);
      return res.json({ response: '' });
    }
    const data = await upstream.json();
    let raw = data?.choices?.[0]?.message?.content || '';
    // Strip markdown so Android TTS never reads punctuation aloud.
    raw = raw.replace(/[*_`#>~\[\]]/g, '').replace(/\s{2,}/g, ' ').trim();
    console.log(`[VANGUARD_NAV] query="${query.slice(0,40)}" → ${raw.length} chars`);
    res.json({ response: raw });
  } catch (e) {
    console.error('[VANGUARD_NAV] error:', e.message);
    res.json({ response: '' });
  }
});

// ── POST /auth/oauth ─ called server-side by NextAuth after OAuth sign-in ─────
app.post('/auth/oauth', async (req, res) => {
  if (req.headers['x-internal-secret'] !== process.env.ASKMO_INTERNAL_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { provider, provider_id, email, name } = req.body || {};
  if (!provider || !provider_id) {
    return res.status(400).json({ error: 'provider and provider_id required' });
  }

  try {
    // Check if this OAuth provider account already exists
    const existing = await pool.query(
      `SELECT d.id FROM oauth_accounts o
         JOIN biological_developers d ON d.id = o.developer_id
        WHERE o.provider = $1 AND o.provider_id = $2`,
      [provider, String(provider_id)]
    );
    if (existing.rows.length > 0) {
      // Returning user — issue fresh portal JWT
      return res.json({ token: signToken(existing.rows[0].id), is_new_user: false });
    }

    // New OAuth sign-in — check if email already has an email/password account
    let developerId = null;
    let isNewUser   = true;

    if (email) {
      const emailMatch = await pool.query(
        'SELECT id FROM biological_developers WHERE email = $1',
        [email.toLowerCase().trim()]
      );
      if (emailMatch.rows.length > 0) {
        // Link OAuth to existing account (no new API key needed)
        developerId = emailMatch.rows[0].id;
        isNewUser   = false;
      }
    }

    let apiKey  = null;
    let preview = null;
    let note    = null;

    if (!developerId) {
      // Brand-new developer via OAuth — create account + generate API key
      const oauthEmail    = email?.toLowerCase().trim()
                          || (provider + ':' + String(provider_id) + '@oauth.local');
      const randomPwd     = crypto.randomBytes(32).toString('hex');
      const passwordHash  = await bcrypt.hash(randomPwd, SALT_ROUNDS);
      apiKey              = generateApiKey();
      const apiKeyHash    = await bcrypt.hash(apiKey, SALT_ROUNDS);
      preview             = apiKeyPreview(apiKey);
      note                = 'Your ExergyNet API key — save it immediately, it will never be shown again.';

      const result = await pool.query(
        `INSERT INTO biological_developers (id, email, password_hash, api_key_hash, api_key_preview)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4) RETURNING id`,
        [oauthEmail, passwordHash, apiKeyHash, preview]
      );
      developerId = result.rows[0].id;
    }

    // Link this OAuth provider to the developer account
    await pool.query(
      `INSERT INTO oauth_accounts (developer_id, provider, provider_id)
         VALUES ($1, $2, $3) ON CONFLICT (provider, provider_id) DO NOTHING`,
      [developerId, provider, String(provider_id)]
    );

    const token = signToken(developerId);
    res.json({
      token,
      is_new_user: isNewUser,
      ...(isNewUser && apiKey ? { api_key: apiKey, api_key_preview: preview, note } : {}),
    });
  } catch (err) {
    // Race condition: concurrent insert on UNIQUE(provider, provider_id)
    if (err.code === '23505') {
      try {
        const retry = await pool.query(
          `SELECT d.id FROM oauth_accounts o
             JOIN biological_developers d ON d.id = o.developer_id
            WHERE o.provider = $1 AND o.provider_id = $2`,
          [provider, String(provider_id)]
        );
        if (retry.rows.length > 0) {
          return res.json({ token: signToken(retry.rows[0].id), is_new_user: false });
        }
      } catch (_) { /* fall through */ }
    }
    console.error('[auth/oauth]', err);
    res.status(500).json({ error: 'OAuth sign-in failed' });
  }
});

// ── Clinical response normalizer ──────────────────────────────────────────────
// Strips all personality prefixes, markdown fences, and any text before the
// first JSON object. Applied to all /v1/extract responses before returning.
function normalizeExtractionResponse(text) {
  text = text.replace(/^\*\*SEI Vanguard Response\*\*\s*/i, '');
  text = text.replace(/^\*\*Vanguard(?:\s+Engine)?[^*]*\*\*\s*/i, '');
  text = text.replace(/^Vanguard Engine[\s—\-:]+/i, '');
  text = text.replace(/^\*\*JSON Output[:\s]*\*\*\s*/i, '');
  text = text.replace(/^(?:Here is|I found|Assistant:|SEI\s+\w+\s+Response)[:\s]+/i, '');
  text = text.replace(/^```(?:json)?\s*/im, '');
  text = text.replace(/\s*```\s*$/m, '');
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return text.trim();
}

// ── POST /v1/extract — Sovereign Clinical Extraction ─────────────────────────
// Accepts: { text: string, schema: Record<string, string>, domain?: string }
// Returns: { extraction: Record<string, { value, confidence, needs_clarification }> }
// ── GET /v1/nodes/map — real tester node locations (foundation coordinates) ───
app.get('/v1/nodes/map', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.node_id, d.username, d.display_name, d.lat, d.lng,
             d.foundation_ip, d.first_seen_at, d.created_at,
             MAX(j.created_at) AS last_job_at
      FROM biological_developers d
      LEFT JOIN en_jobs j ON j.developer_id = d.id
      WHERE d.node_id IS NOT NULL
        AND d.lat IS NOT NULL
        AND d.lng IS NOT NULL
      GROUP BY d.id
      ORDER BY d.first_seen_at ASC NULLS LAST
    `);
    const now = Date.now();
    res.json(rows.map(r => {
      const lastJob = r.last_job_at ? new Date(r.last_job_at).getTime() : 0;
      const ageDays = lastJob ? (now - lastJob) / 86400000 : Infinity;
      const status = ageDays < 1 ? 'ACTIVE' : ageDays < 7 ? 'SYNCING' : 'OFFLINE';
      return {
        nodeId:     r.node_id,
        label:      r.display_name || r.username || `Node·${r.node_id.slice(0, 8)}`,
        lat:        parseFloat(r.lat),
        lng:        parseFloat(r.lng),
        firstSeen:  r.first_seen_at || r.created_at,
        lastJobAt:  r.last_job_at,
        status,
      };
    }));
  } catch (e) {
    console.error('[nodes/map]', e);
    res.status(500).json({ error: 'Map query failed' });
  }
});

app.post('/v1/extract', requireAuth, async (req, res) => {
  const { text, schema, domain } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text (string) is required' });
  }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return res.status(400).json({ error: 'schema (object mapping field names to types) is required' });
  }

  const VG_URL = process.env.SEI_VANGUARD_URL || 'http://20.127.220.199:3000';
  const VG_KEY = process.env.SEI_VANGUARD_KEY || 'sk-vanguard-apex-internal-v1';

  const fieldList = Object.entries(schema)
    .map(([k, t]) => `  "${k}" (${t})`)
    .join('\n');

  // Regression test contract (must always pass):
  // "I am 35 years old"     → { value: 35, confidence: 0.9, needs_clarification: false }
  // "I do not know"         → { value: null, confidence: 0, needs_clarification: true }
  // "For about 7 days"      → { value: 7, confidence: 0.8, needs_clarification: false }
  const systemPrompt =
`You are a deterministic clinical extraction engine.
OUTPUT RULES — ABSOLUTE, NO EXCEPTIONS:
1. Your ENTIRE response must be ONE valid JSON object. Nothing before it. Nothing after it.
2. NEVER write your name, "Vanguard", "Assistant", "Here is", "I found", or any introduction.
3. NEVER use markdown, code fences, or explanation.
4. START your response with the character { and END with the character }.

Extract the following fields from the clinical text provided by the user:
${fieldList}

Return a JSON object where each key is the EXACT field name listed above, and each value is:
  { "value": <extracted value cast to the correct type, or null>, "confidence": <0.0–1.0>, "needs_clarification": <true|false> }

Rules:
- Use the EXACT field names from the list above. Do not rename or add prefix to them.
- If the patient says "I do not know" or is ambiguous: value=null, confidence=0.0, needs_clarification=true
- If a field is clearly not present in the text: value=null, confidence=1.0, needs_clarification=false`;

  try {
    const upstream = await fetch(`${VG_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VG_KEY}`,
      },
      body: JSON.stringify({
        model: 'vanguard-engine',
        stream: false,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: text },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('[v1/extract upstream]', upstream.status, errText.slice(0, 200));
      return res.status(502).json({ error: 'Extraction engine unavailable' });
    }

    const data = await upstream.json();
    let raw = data.choices?.[0]?.message?.content || '';

    raw = normalizeExtractionResponse(raw);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('[v1/extract] JSON parse failed. Raw:', raw.slice(0, 300));
      return res.status(502).json({ error: 'Extraction engine returned unparseable response' });
    }

    // Build final extraction object keyed strictly by schema fields
    const extraction = {};
    for (const [field, type] of Object.entries(schema)) {
      const fieldData = parsed[field];
      if (fieldData && typeof fieldData === 'object' && 'value' in fieldData) {
        extraction[field] = {
          value: fieldData.value,
          confidence: typeof fieldData.confidence === 'number' ? fieldData.confidence : 1.0,
          needs_clarification: Boolean(fieldData.needs_clarification),
        };
      } else if (fieldData !== undefined) {
        // Model returned a flat value instead of the schema object
        extraction[field] = { value: fieldData, confidence: 1.0, needs_clarification: false };
      } else {
        // Field not found in model response — mark for clarification
        extraction[field] = { value: null, confidence: 0.0, needs_clarification: true };
      }
    }

    console.log(`[v1/extract] ok — ${Object.keys(extraction).length} field(s) for developer ${req.developerId}`);
    res.json({ extraction });
  } catch (e) {
    console.error('[v1/extract]', e.message);
    res.status(503).json({ error: 'Extraction engine unreachable' });
  }
});

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'biological_proxy', ts: new Date().toISOString() })
);

// ── GET /api/apps — public catalog of all active apps ─────────────────────────
app.get('/api/apps', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT app_key, name, tier, price_micro, usage_price_micro, description,
              category, tags, icon_url, icon, app_url, featured
       FROM app_catalog WHERE active = true
       ORDER BY featured DESC NULLS LAST, created_at ASC`
    );
    const apps = rows.map(r => ({
      app_key:         r.app_key,
      name:            r.name,
      tier:            r.tier,
      price_usd:       (r.price_micro / 1_000_000).toFixed(2),
      usage_price_usd: (r.usage_price_micro / 1_000_000).toFixed(4),
      description:     r.description || null,
      category:        r.category || null,
      tags:            r.tags || [],
      icon_url:        r.icon_url || r.icon || null,
      app_url:         r.app_url || null,
      featured:        r.featured || false,
    }));
    res.json({ apps, count: apps.length });
  } catch (e) {
    console.error('[/api/apps]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── GET /api/apps/public — alias of /api/apps (called by /intel page) ───────
app.get('/api/apps/public', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT app_key, name, tier, price_micro, usage_price_micro, description,
              category, tags, icon_url, icon, app_url, featured
       FROM app_catalog WHERE active = true AND review_status = 'active'
       ORDER BY featured DESC NULLS LAST, created_at ASC`
    );
    const apps = rows.map(r => ({
      app_key:         r.app_key,
      name:            r.name,
      tier:            r.tier,
      price_usd:       (r.price_micro / 1_000_000).toFixed(2),
      usage_price_usd: (r.usage_price_micro / 1_000_000).toFixed(4),
      description:     r.description || null,
      category:        r.category || null,
      tags:            r.tags || [],
      icon_url:        r.icon_url || null,
      icon_emoji:      r.icon || null,
      app_url:         r.app_url || null,
      standalone_url:  null,
      featured:        r.featured || false,
    }));
    res.json({ apps, count: apps.length });
  } catch (e) {
    console.error('[/api/apps/public]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── GET /api/apps/mine — developer's published apps ───────────────────────────
app.get('/api/apps/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT app_key, name, tier, price_micro, period, publisher_id, active,
              created_at, app_url, description, icon, usage_price_micro,
              review_status, category, tags, icon_url, featured
       FROM app_catalog WHERE publisher_id = $1 ORDER BY created_at DESC`,
      [req.developerId]
    );
    const apps = rows.map(r => ({
      app_key:           r.app_key,
      name:              r.name,
      tier:              r.tier,
      price_usd:         (r.price_micro / 1_000_000).toFixed(2),
      period:            r.period,
      publisher_id:      r.publisher_id,
      active:            r.active,
      created_at:        r.created_at,
      app_url:           r.app_url || null,
      description:       r.description || null,
      icon_url:          r.icon_url || r.icon || null,
      usage_price_usd:   (r.usage_price_micro / 1_000_000).toFixed(4),
      review_status:     r.review_status,
      category:          r.category || null,
      tags:              r.tags || [],
      featured:          r.featured,
    }));
    res.json({ apps });
  } catch (e) {
    console.error('[/api/apps/mine]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── POST /api/apps/publish — create or update a developer app listing ─────────
app.post('/api/apps/publish', requireAuth, async (req, res) => {
  const {
    app_key, name, app_url, description, category,
    tags, price_usd, usage_price_usd, icon_url,
  } = req.body || {};

  if (!app_key || !/^[a-z0-9_]{3,40}$/.test(String(app_key))) {
    return res.status(400).json({ error: 'app_key must be 3–40 chars [a-z0-9_]' });
  }
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (app_url && !/^https:\/\//i.test(String(app_url))) {
    return res.status(400).json({ error: 'app_url must be an https:// URL' });
  }

  const priceMicro      = Math.round((parseFloat(price_usd)       || 0) * 1_000_000);
  const usagePriceMicro = Math.round((parseFloat(usage_price_usd) || 0) * 1_000_000);
  const tier            = priceMicro > 0 ? 'subscription' : (usagePriceMicro > 0 ? 'usage' : 'free');
  const tagsJson        = JSON.stringify(Array.isArray(tags) ? tags.slice(0, 4) : []);

  try {
    const { rows } = await pool.query(
      `INSERT INTO app_catalog
         (app_key, name, tier, price_micro, usage_price_micro, publisher_id,
          app_url, description, category, tags, icon_url, active, review_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,false,'pending_review')
       ON CONFLICT (app_key) DO UPDATE SET
         name = EXCLUDED.name, tier = EXCLUDED.tier,
         price_micro = EXCLUDED.price_micro, usage_price_micro = EXCLUDED.usage_price_micro,
         app_url = EXCLUDED.app_url, description = EXCLUDED.description,
         category = EXCLUDED.category, tags = EXCLUDED.tags,
         icon_url = EXCLUDED.icon_url, review_status = 'pending_review'
       RETURNING *`,
      [app_key, name.trim(), tier, priceMicro, usagePriceMicro,
       req.developerId, app_url || null, description || null, category || null,
       tagsJson, icon_url || null]
    );
    const r = rows[0];
    res.json({
      status: 'pending_review',
      app: {
        app_key: r.app_key, name: r.name, tier: r.tier,
        price_usd: (r.price_micro / 1_000_000).toFixed(2),
        usage_price_usd: (r.usage_price_micro / 1_000_000).toFixed(4),
        publisher_id: r.publisher_id, active: r.active,
        app_url: r.app_url, description: r.description,
        icon_url: r.icon_url, category: r.category,
        tags: r.tags || [], review_status: r.review_status,
        created_at: r.created_at,
      },
    });
  } catch (e) {
    console.error('[/api/apps/publish]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── POST /api/apps/submit — Governed submission (pending_review, NOT live) ──────
app.post('/api/apps/submit', requireAuth, async (req, res) => {
  const b = req.body || {};
  const appKey = String(b.app_key || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40);
  const name = String(b.name || '').trim().slice(0, 80);
  const priceUsd = parseFloat(b.price_usd) || 0;
  const usageUsd = parseFloat(b.usage_price_usd) || 0;
  if (!appKey || appKey.length < 3) return res.status(400).json({ error: 'app_key must be 3-40 chars [a-z0-9_]' });
  if (!name) return res.status(400).json({ error: 'name required' });
  if (priceUsd < 0 || priceUsd > 9999) return res.status(400).json({ error: 'price_usd must be 0-9999' });
  const appUrl = b.app_url ? String(b.app_url).trim().slice(0, 300) : null;
  if (appUrl && !/^https:\/\//i.test(appUrl)) return res.status(400).json({ error: 'app_url must be https://' });
  const description = b.description ? String(b.description).trim().slice(0, 500) : null;
  if (!description || description.length < 10) return res.status(400).json({ error: 'description required (10+ chars)' });
  const icon = b.icon ? String(b.icon).trim().slice(0, 8) : null;
  const iconUrl = b.icon_url ? String(b.icon_url).trim().slice(0, 300) : null;
  if (iconUrl && !/^https:\/\//i.test(iconUrl)) return res.status(400).json({ error: 'icon_url must be https://' });
  const category = b.category ? String(b.category).trim().slice(0, 40) : null;
  const tags = Array.isArray(b.tags) ? b.tags.filter(t => typeof t === 'string').slice(0, 4).map(t => String(t).trim().slice(0, 24)) : null;
  const priceMicro = Math.round(priceUsd * 1e6);
  const usageMicro = Math.round(usageUsd * 1e6);
  const tier = priceMicro > 0 ? 'subscription' : (usageMicro > 0 ? 'metered' : 'free');
  try {
    const ex = await pool.query('SELECT publisher_id, review_status FROM app_catalog WHERE app_key = $1', [appKey]);
    if (ex.rows.length && ex.rows[0].publisher_id !== req.developerId) {
      return res.status(409).json({ error: 'app_key already taken by another developer' });
    }
    if (ex.rows.length && ex.rows[0].review_status === 'pending_review') {
      return res.status(409).json({ error: 'App already submitted and awaiting review' });
    }
    let row;
    if (ex.rows.length) {
      // Resubmit after rejection
      const r = await pool.query(
        `UPDATE app_catalog SET name=$2, tier=$3, price_micro=$4, usage_price_micro=$5, description=$6,
         app_url=$7, icon=$8, icon_url=$9, category=$10, tags=$11, active=false, review_status='pending_review'
         WHERE app_key=$1 RETURNING *`,
        [appKey, name, tier, priceMicro, usageMicro, description, appUrl, icon, iconUrl, category, tags ? JSON.stringify(tags) : null]
      );
      row = r.rows[0];
    } else {
      const r = await pool.query(
        `INSERT INTO app_catalog (app_key, name, tier, price_micro, usage_price_micro, description, app_url,
         icon, icon_url, category, tags, publisher_id, fee_bps, active, review_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,500,false,'pending_review') RETURNING *`,
        [appKey, name, tier, priceMicro, usageMicro, description, appUrl, icon, iconUrl, category,
         tags ? JSON.stringify(tags) : null, req.developerId]
      );
      row = r.rows[0];
    }
    // Trigger Vanguard scan asynchronously (don't block response)
    if (typeof scanAppWithVanguard === 'function') {
      scanAppWithVanguard(appKey).catch(e => console.error('[submit/scan]', e.message));
    }
    res.json({ ok: true, app_key: row.app_key, review_status: 'pending_review',
      message: 'App submitted for Vanguard review. You will be notified when approved.' });
  } catch (e) {
    console.error('[/api/apps/submit]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});


// ── GET /api/apps/entitlement — check subscription gate ─────────────────────
app.get('/api/apps/entitlement', requireAuth, async (req, res) => {
  try {
    const appKey = String(req.query.app_key || '');
    if (!appKey) return res.status(400).json({ error: 'app_key required' });
    const cat = await pool.query('SELECT tier FROM app_catalog WHERE app_key = $1 AND active = TRUE', [appKey]);
    if (cat.rows.length === 0) return res.status(404).json({ error: 'app not found' });
    if (cat.rows[0].tier === 'free') return res.json({ entitled: true, app_key: appKey, tier: 'free' });
    if (cat.rows[0].tier === 'metered') return res.json({ entitled: true, app_key: appKey, tier: 'metered' });
    const r = await pool.query(
      `SELECT status, renews_at FROM app_subscriptions
       WHERE developer_id = $1 AND app_key = $2 AND status = 'active' AND renews_at > NOW() LIMIT 1`,
      [req.developerId, appKey]);
    res.json({ entitled: r.rows.length > 0, app_key: appKey, tier: cat.rows[0].tier, subscription: r.rows[0] || null });
  } catch (e) { console.error('[/api/apps/entitlement]', e); res.status(500).json({ error: e.message }); }
});

// ── POST /api/apps/subscribe { app_key } — debit balance, activate sub ──────
app.post('/api/apps/subscribe', requireAuth, async (req, res) => {
  const appKey = String((req.body && req.body.app_key) || '');
  if (!appKey) return res.status(400).json({ error: 'app_key required' });
  const client = await pool.connect();
  try {
    const cat = await client.query('SELECT * FROM app_catalog WHERE app_key = $1 AND active = TRUE', [appKey]);
    if (cat.rows.length === 0) return res.status(404).json({ error: 'app not found' });
    const appRow = cat.rows[0];
    if (appRow.tier !== 'subscription') return res.status(400).json({ error: 'app is not a subscription', tier: appRow.tier });
    const price = Number(appRow.price_micro);

    const existing = await client.query(
      `SELECT id FROM app_subscriptions WHERE developer_id=$1 AND app_key=$2 AND status='active' AND renews_at > NOW()`,
      [req.developerId, appKey]);
    if (existing.rows.length) return res.json({ status: 'already_subscribed', app_key: appKey });

    // Check balance
    const dev = await client.query('SELECT usdc_micro_balance FROM biological_developers WHERE id = $1 FOR UPDATE', [req.developerId]);
    const balance = Number(dev.rows[0]?.usdc_micro_balance ?? 0);
    if (balance < price) {
      return res.status(402).json({
        error: 'insufficient_balance',
        message: 'Not enough USDC. Fund your balance in the Billing tab.',
        balance_micro: balance, price_micro: price,
        shortfall_micro: price - balance,
      });
    }

    await client.query('BEGIN');
    // Debit developer
    await client.query(
      'UPDATE biological_developers SET usdc_micro_balance = usdc_micro_balance - $1 WHERE id = $2',
      [price, req.developerId]);
    // Activate subscription (30-day period, upsert)
    const sub = await client.query(
      `INSERT INTO app_subscriptions (developer_id, app_key, price_micro, status, started_at, renews_at, cancelled_at)
       VALUES ($1,$2,$3,'active',NOW(),NOW() + INTERVAL '30 days', NULL)
       ON CONFLICT (developer_id, app_key) DO UPDATE
         SET status='active', price_micro=$3, started_at=NOW(), renews_at=NOW() + INTERVAL '30 days', cancelled_at=NULL
       RETURNING renews_at`,
      [req.developerId, appKey, price]);
    await client.query('COMMIT');
    res.json({
      status: 'subscribed', app_key: appKey, name: appRow.name,
      charged_micro: price, charged_usd: (price / 1_000_000).toFixed(2),
      new_balance_micro: balance - price,
      new_balance_usd: ((balance - price) / 1_000_000).toFixed(4),
      renews_at: sub.rows[0].renews_at,
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[/api/apps/subscribe]', e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ── GET /api/apps/subscriptions — caller's active subscriptions ──────────────
app.get('/api/apps/subscriptions', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT s.app_key, c.name, s.price_micro, s.status, s.started_at, s.renews_at, s.cancelled_at
       FROM app_subscriptions s LEFT JOIN app_catalog c ON c.app_key = s.app_key
       WHERE s.developer_id = $1 AND (s.status = 'active' OR s.renews_at > NOW())
       ORDER BY s.started_at DESC`, [req.developerId]);
    res.json({ subscriptions: r.rows.map(s => ({
      app_key: s.app_key, name: s.name, status: s.status,
      price_micro: Number(s.price_micro), price_usd: (Number(s.price_micro)/1_000_000).toFixed(2),
      started_at: s.started_at, renews_at: s.renews_at, cancelled_at: s.cancelled_at,
    })) });
  } catch (e) { console.error('[/api/apps/subscriptions]', e); res.status(500).json({ error: e.message }); }
});

// ── POST /api/apps/unsubscribe { app_key } — cancel (no refund) ─────────────
app.post('/api/apps/unsubscribe', requireAuth, async (req, res) => {
  const appKey = String((req.body && req.body.app_key) || '');
  if (!appKey) return res.status(400).json({ error: 'app_key required' });
  try {
    const r = await pool.query(
      `UPDATE app_subscriptions SET status='cancelled', cancelled_at=NOW()
       WHERE developer_id=$1 AND app_key=$2 AND status='active' RETURNING renews_at`,
      [req.developerId, appKey]);
    if (r.rows.length === 0) return res.json({ status: 'not_subscribed', app_key: appKey });
    res.json({ status: 'cancelled', app_key: appKey, access_until: r.rows[0].renews_at });
  } catch (e) { console.error('[/api/apps/unsubscribe]', e); res.status(500).json({ error: e.message }); }
});

// ── POST /v1/internal/chat — internal Vanguard proxy (portal → AskMo) ────────
app.post('/v1/internal/chat', async (req, res) => {
  const secret = req.headers['x-internal-secret'];
  const expected = process.env.ASKMO_INTERNAL_SECRET;
  if (!expected || secret !== expected) return res.status(403).json({ error: 'Forbidden' });
  const base = (process.env.SEI_VANGUARD_URL || 'http://20.127.220.199:3000').replace(/\/$/, '');
  const apiKey = process.env.SEI_VANGUARD_KEY || 'sk-vanguard-apex-internal-v1';
  try {
    const upstream = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(60000),
    });
    if (!upstream.ok) {
      const err = await upstream.text();
      return res.status(502).json({ error: `Upstream ${upstream.status}`, detail: err.slice(0, 200) });
    }
    return res.json(await upstream.json());
  } catch (e) { return res.status(503).json({ error: e.message }); }
});

// ── Start ─────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════
// ── DEVICE IDENTITY — KYC Foundation (LNES-KYC) ──────────────────────────────
// POST /api/identity/bind  — register or refresh device fingerprint
//   body: { fingerprint: string, platform: 'android'|'ios' }
//   returns: { exergynet_number, fingerprint }
// No auth required — called on app launch before login. The fingerprint
// itself is the opaque key; account linkage happens separately on login.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/identity/bind', async (req, res) => {
  try {
    const { fingerprint, platform = 'android' } = req.body || {};
    if (!fingerprint || fingerprint.length < 16) {
      return res.status(400).json({ error: 'Invalid fingerprint' });
    }

    // Check if already exists
    const existing = await pool.query(
      `SELECT exergynet_number FROM device_bindings WHERE fingerprint = $1`,
      [fingerprint]
    );

    if (existing.rows.length > 0) {
      // Refresh last_seen and return stable number
      await pool.query(
        `UPDATE device_bindings SET last_seen = NOW() WHERE fingerprint = $1`,
        [fingerprint]
      );
      return res.json({ exergynet_number: existing.rows[0].exergynet_number, fingerprint });
    }

    // New device — generate stable EXN number
    const suffix = fingerprint.slice(-8).toUpperCase();
    const exergynet_number = `EXN-${suffix}`;

    await pool.query(
      `INSERT INTO device_bindings (fingerprint, exergynet_number, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (fingerprint) DO UPDATE SET last_seen = NOW()`,
      [fingerprint, exergynet_number, platform]
    );

    console.log(`[KYC] New device bound: ${exergynet_number} (${platform})`);
    return res.json({ exergynet_number, fingerprint });
  } catch (e) {
    console.error('[KYC] bind error:', e.message);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Link device fingerprint to a logged-in account (called after successful login)
app.post('/api/identity/link', requireAuth, async (req, res) => {
  try {
    const { fingerprint } = req.body || {};
    if (!fingerprint) return res.status(400).json({ error: 'Missing fingerprint' });

    // requireAuth sets req.dev (both its API-key and JWT branches) — never req.developer.
    // This referenced req.developer.id, which is always undefined, so every call to this
    // endpoint threw and fell into the catch block below, returning 500 unconditionally.
    await pool.query(
      `UPDATE device_bindings SET account_id = $1, last_seen = NOW()
       WHERE fingerprint = $2`,
      [req.dev.id, fingerprint]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[KYC] link error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ── PHASE 4: VANGUARD SOVEREIGN FUNCTION LOOP ────────────────────────────────
// POST /api/v1/vanguard-nav
// The Vanguard Cognitive Bridge. Implements the OpenAI tool-calling spec with
// a 2-turn recursive inference loop so the LLM can:
//   - query live ledger data (query_exergy_ledger)
//   - command the Android client to take physical actions (execute_client_action)
// Returns: { speech_text, client_action: {verb, param} | null, response }
// ══════════════════════════════════════════════════════════════════════════════

const VANGUARD_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'execute_client_action',
      description: 'Commands the Android device to perform a physical action.',
      parameters: {
        type: 'object',
        properties: {
          action_type: {
            type: 'string',
            enum: ['navigate', 'screen', 'dial'],
            description: 'navigate = route to destination; screen = open app screen; dial = open phone dialer.'
          },
          target: {
            type: 'string',
            description: 'navigate: destination address/place. screen: messages|jobs|drops|dashboard|analytics|settlements. dial: phone number.'
          }
        },
        required: ['action_type', 'target']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_exergy_ledger',
      description: 'Query live ExergyNet ledger state: account balance, job queue, music drops, or network metrics.',
      parameters: {
        type: 'object',
        properties: {
          query_type: {
            type: 'string',
            enum: ['balance', 'jobs', 'drops', 'network_state'],
            description: 'Which ledger dimension to query.'
          },
          account_fingerprint: {
            type: 'string',
            description: 'Device fingerprint to identify the account (optional — uses request fingerprint if omitted).'
          }
        },
        required: ['query_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the live web for current information — news, weather, sports scores, who holds an office today, or anything else outside your training data or the ExergyNet ledger. Use this whenever the driver asks something that needs up-to-date real-world information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query, phrased as you would type it into a search engine.'
          }
        },
        required: ['query']
      }
    }
  }
];

async function executeExergyLedgerQuery(queryType, fingerprint) {
  switch (queryType) {
    case 'balance': {
      if (!fingerprint) return 'No device fingerprint — cannot resolve account.';
      const b = await pool.query(`SELECT account_id FROM device_bindings WHERE fingerprint = $1`, [fingerprint]);
      if (!b.rows.length || !b.rows[0].account_id) return 'Account not linked to this device.';
      const d = await pool.query(`SELECT usdc_micro_balance, rho_micro_balance FROM biological_developers WHERE id = $1`, [b.rows[0].account_id]);
      if (!d.rows.length) return 'Account not found.';
      const usdc = (parseInt(d.rows[0].usdc_micro_balance) / 1_000_000).toFixed(2);
      const rho  = (parseInt(d.rows[0].rho_micro_balance)  / 1_000_000).toFixed(4);
      return `Balance: $${usdc} USDC, ${rho} RHO.`;
    }
    case 'jobs': {
      if (!fingerprint) return 'No device fingerprint.';
      const b = await pool.query(`SELECT account_id FROM device_bindings WHERE fingerprint = $1`, [fingerprint]);
      if (!b.rows.length || !b.rows[0].account_id) return 'Account not linked.';
      const j = await pool.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE zk_proof_status IN ('queued','processing')) as active,
                (SELECT id FROM en_jobs WHERE developer_id = $1 ORDER BY created_at DESC LIMIT 1) as latest_id
         FROM en_jobs WHERE developer_id = $1`,
        [b.rows[0].account_id]
      );
      return `Jobs: ${j.rows[0].active} active, ${j.rows[0].total} total.`;
    }
    case 'drops': {
      if (!fingerprint) return 'No device fingerprint.';
      const b = await pool.query(`SELECT account_id FROM device_bindings WHERE fingerprint = $1`, [fingerprint]);
      if (!b.rows.length || !b.rows[0].account_id) return 'Account not linked.';
      const dev = await pool.query(`SELECT email FROM biological_developers WHERE id = $1`, [b.rows[0].account_id]);
      if (!dev.rows.length) return 'Account not found.';
      const dr = await pool.query(
        `SELECT COUNT(*) as total, COALESCE(SUM(plays),0) as plays,
                (SELECT title FROM music_drops WHERE email = $1 ORDER BY published_at DESC LIMIT 1) as latest
         FROM music_drops WHERE email = $1`,
        [dev.rows[0].email]
      );
      return `Music drops: ${dr.rows[0].total} published, ${dr.rows[0].plays} total plays. Latest: ${dr.rows[0].latest || 'none'}.`;
    }
    case 'network_state': {
      const n = await pool.query(`SELECT COUNT(*) FROM node_registrations WHERE last_seen_at > NOW() - INTERVAL '24 hours'`);
      return `ExergyNet: ${n.rows[0].count} active nodes in last 24 hours.`;
    }
    default:
      return `Unknown query type: ${queryType}.`;
  }
}

// Same SERP_API_KEY / SerpAPI call shape already proven working in
// intel-console/lib/agent/profileBuilder.ts — reused here, not reinvented.
// Vanguard had zero live web-search capability before this: every existing
// intel-console product (Entities, Origin Index, Intel Briefs) collects data
// on a schedule/watchlist basis and only ever hands Vanguard a static blob to
// summarize afterward — none of them let the model decide to search live
// during a conversation. This is that missing live path.
async function executeWebSearch(query) {
  console.log(`[WEB_SEARCH] invoked, query="${query}"`);
  const serpKey = process.env.SERP_API_KEY;
  if (!serpKey) { console.log('[WEB_SEARCH] SERP_API_KEY not set — skipping'); return 'Web search is not configured on this server.'; }
  if (!query) return 'No search query provided.';
  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 8000);
    let res;
    try {
      res = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${serpKey}`, {
        signal: controller.signal
      });
    } finally { clearTimeout(tId); }
    console.log(`[WEB_SEARCH] SerpAPI HTTP ${res.status}`);
    if (!res.ok) return `Search failed (HTTP ${res.status}).`;
    const data = await res.json();

    // Direct-answer sources first — these cover weather, calculators, sports
    // scores, "who is the president" style facts far better than snippets.
    if (data.answer_box) {
      const ab = data.answer_box;
      const direct = ab.answer || ab.snippet || ab.result ||
        (Array.isArray(ab.snippet_highlighted_words) ? ab.snippet_highlighted_words.join(', ') : '');
      if (direct) return String(direct).slice(0, 600);
    }
    if (data.knowledge_graph?.description) {
      return String(data.knowledge_graph.description).slice(0, 600);
    }
    if (data.sports_results?.game_spotlight) {
      const g = data.sports_results.game_spotlight;
      return `${g.tournament || ''} ${g.status || ''}: ${g.teams?.map(t => `${t.name} ${t.score ?? ''}`).join(' vs ')}`.trim().slice(0, 400);
    }

    const results = (data.organic_results || []).slice(0, 5);
    if (!results.length) return 'No search results found for that query.';
    return results.map(r => `${r.title}: ${r.snippet || ''}`).join('\n').slice(0, 1200);
  } catch (e) {
    return `Search error: ${e.message}`;
  }
}

app.post('/api/v1/vanguard-nav', async (req, res) => {
  try {
    const { query, context, fingerprint } = req.body || {};
    if (!query) return res.status(400).json({ speech_text: '', response: '', client_action: null, error: 'Missing query' });

    const proposerUrl = process.env.SEI_VANGUARD_URL
      ? `${process.env.SEI_VANGUARD_URL}/v1/chat/completions`
      : 'http://20.127.220.199:3000/v1/chat/completions';
    const apiKey = process.env.SEI_VANGUARD_KEY || 'sk-vanguard-apex-internal-v1';

    const messages = [
      { role: 'system', content: context || 'You are a voice assistant in a car navigation app.' },
      { role: 'user',   content: query }
    ];

    let clientAction = null;
    let speechText   = '';

    // ── Recursive inference loop (max 2 turns) ────────────────────────────────
    for (let turn = 0; turn < 2; turn++) {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 9500);
      let llmResp;
      try {
        llmResp = await fetch(proposerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'vanguard',
            messages,
            tools: VANGUARD_TOOLS,
            tool_choice: 'auto',
            max_tokens: 220,
            temperature: 0.5,
            stream: false
          }),
          signal: controller.signal
        });
      } finally { clearTimeout(tId); }

      if (!llmResp.ok) {
        console.error(`[VANGUARD_LOOP] LLM HTTP ${llmResp.status} turn=${turn}`);
        break;
      }

      const llmJson = await llmResp.json();
      const choice  = llmJson.choices?.[0];
      if (!choice) break;

      const { finish_reason, message } = choice;
      console.log(`[VANGUARD_LOOP] turn=${turn} finish_reason=${finish_reason} tool_calls=${(message?.tool_calls || []).map(t => t.function?.name).join(',') || 'none'}`);

      if (finish_reason === 'tool_calls' && message?.tool_calls?.length > 0) {
        messages.push(message); // append assistant tool-call message

        for (const tc of message.tool_calls) {
          const fnName = tc.function?.name || '';
          let fnArgs = {};
          try { fnArgs = JSON.parse(tc.function?.arguments || '{}'); } catch (_) {}

          if (fnName === 'execute_client_action') {
            // Android client action — no server-side execution, just capture
            clientAction = {
              verb:  fnArgs.action_type || '',
              param: fnArgs.target      || ''
            };
            messages.push({ role: 'tool', tool_call_id: tc.id, content: 'Action dispatched to device.' });

          } else if (fnName === 'query_exergy_ledger') {
            const fp = fnArgs.account_fingerprint || fingerprint || '';
            let result = '';
            try { result = await executeExergyLedgerQuery(fnArgs.query_type, fp); }
            catch (e) { result = `Ledger error: ${e.message}`; }
            messages.push({ role: 'tool', tool_call_id: tc.id, content: result });

          } else if (fnName === 'web_search') {
            let result = '';
            try { result = await executeWebSearch(fnArgs.query); }
            catch (e) { result = `Search error: ${e.message}`; }
            messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
          }
        }
        continue; // second LLM turn with tool results injected
      }

      // Final spoken response
      speechText = message?.content || '';
      break;
    }

    // Strip markdown so Android TTS reads cleanly
    speechText = speechText
      .replace(/\*\*/g, '').replace(/\*/g, '')
      .replace(/#{1,3} /g, '').replace(/#/g, '')
      .replace(/^- /gm, '')
      .replace(/\s{2,}/g, ' ').trim();

    // Also strip any residual Phase-3 ACTION: lines (backward compat fallback)
    const lines = speechText.split('\n');
    const actionLine = lines.find(l => l.trim().startsWith('ACTION:'));
    if (actionLine && !clientAction) {
      const payload = actionLine.trim().replace('ACTION:', '');
      const ci = payload.indexOf(':');
      clientAction = {
        verb:  ci >= 0 ? payload.slice(0, ci).trim() : payload.trim(),
        param: ci >= 0 ? payload.slice(ci + 1).trim() : ''
      };
      speechText = lines.filter(l => !l.trim().startsWith('ACTION:')).join('\n').trim();
    }

    console.log(`[VANGUARD_LOOP] "${query.slice(0, 40)}" → "${speechText.slice(0, 60)}" | action=${JSON.stringify(clientAction)}`);

    return res.json({
      speech_text:   speechText,
      client_action: clientAction,
      response:      speechText   // backward-compat field — old Axum clients read this
    });

  } catch (e) {
    console.error('[VANGUARD_LOOP] fatal:', e.message);
    return res.status(500).json({ speech_text: '', response: '', client_action: null });
  }
});

// ═══════════════════════════════════════════════════════════════
// ── ACCOUNT SNAPSHOT — Vanguard Context Feed (LNES-CTX) ──────────────────────
// GET /api/account/snapshot?fingerprint=X
// Looks up account via device_bindings → returns lightweight state for Vanguard.
// No auth required — fingerprint is the opaque key; returns {linked:false} if
// device is not yet bound to an account.
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/account/snapshot', async (req, res) => {
  try {
    const { fingerprint } = req.query;
    if (!fingerprint) return res.status(400).json({ error: 'Missing fingerprint' });

    // Resolve account via device_bindings
    const binding = await pool.query(
      `SELECT account_id FROM device_bindings WHERE fingerprint = $1`,
      [fingerprint]
    );
    if (!binding.rows.length || !binding.rows[0].account_id) {
      return res.json({ linked: false });
    }
    const accountId = binding.rows[0].account_id;

    // Fetch account row
    const dev = await pool.query(
      `SELECT display_name, email, usdc_micro_balance, rho_micro_balance
       FROM biological_developers WHERE id = $1`,
      [accountId]
    );
    if (!dev.rows.length) return res.json({ linked: false });
    const d = dev.rows[0];

    // Active jobs (queued or in-flight)
    const jobsActive = await pool.query(
      `SELECT COUNT(*) FROM en_jobs
       WHERE developer_id = $1 AND zk_proof_status IN ('queued','processing')`,
      [accountId]
    );
    const jobsTotal = await pool.query(
      `SELECT COUNT(*),
              MAX(created_at) as latest_at,
              (SELECT tokens_yielded || ' tokens — ' || zk_proof_status
                 FROM en_jobs WHERE developer_id = $1
                ORDER BY created_at DESC LIMIT 1) as latest_summary
       FROM en_jobs WHERE developer_id = $1`,
      [accountId]
    );

    // Drops
    const drops = await pool.query(
      `SELECT COUNT(*), MAX(plays) as top_plays,
              (SELECT title FROM music_drops WHERE email = $1 ORDER BY published_at DESC LIMIT 1) as latest_title
       FROM music_drops WHERE email = $1`,
      [d.email]
    );

    const balanceUsdc = (parseInt(d.usdc_micro_balance) / 1_000_000).toFixed(2);
    const balanceRho  = (parseInt(d.rho_micro_balance)  / 1_000_000).toFixed(4);
    const activeJobs  = parseInt(jobsActive.rows[0].count);
    const totalJobs   = parseInt(jobsTotal.rows[0].count);
    const latestJob   = jobsTotal.rows[0].latest_summary || null;
    const dropsCount  = parseInt(drops.rows[0].count);
    const latestDrop  = drops.rows[0].latest_title || null;

    res.json({
      linked: true,
      display_name: d.display_name || 'Driver',
      balance_usdc: balanceUsdc,
      balance_rho:  balanceRho,
      active_jobs:  activeJobs,
      total_jobs:   totalJobs,
      latest_job:   latestJob,
      drops_count:  dropsCount,
      latest_drop:  latestDrop,
    });
  } catch (e) {
    console.error('[SNAPSHOT] error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ── VANGUARD MEMORY — Conversation History (LNES-MEM) ────────────────────────
// POST /api/xlmp/vanguard/ingest  — store one exchange (no auth, keyed by fingerprint)
// GET  /api/xlmp/vanguard/recall  — fetch last N exchanges for a device
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/xlmp/vanguard/ingest', async (req, res) => {
  try {
    const { fingerprint, query, response: resp } = req.body || {};
    if (!fingerprint || !query || !resp) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    // Trim to 500 chars each — voice exchanges are short
    await pool.query(
      `INSERT INTO vanguard_memory (fingerprint, query, response)
       VALUES ($1, $2, $3)`,
      [fingerprint, query.slice(0, 500), resp.slice(0, 500)]
    );
    // Keep only last 50 exchanges per device — prune older ones
    await pool.query(
      `DELETE FROM vanguard_memory
       WHERE fingerprint = $1
         AND id NOT IN (
           SELECT id FROM vanguard_memory
           WHERE fingerprint = $1
           ORDER BY created_at DESC
           LIMIT 50
         )`,
      [fingerprint]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[VANGUARD_MEM] ingest error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/xlmp/vanguard/recall', async (req, res) => {
  try {
    const { fingerprint, limit = 5 } = req.query;
    if (!fingerprint) return res.status(400).json({ error: 'Missing fingerprint' });
    const cap = Math.min(parseInt(limit) || 5, 10);
    const { rows } = await pool.query(
      `SELECT query, response, created_at
       FROM vanguard_memory
       WHERE fingerprint = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [fingerprint, cap]
    );
    // Return in chronological order (oldest first — natural for prompt injection)
    res.json({ exchanges: rows.reverse() });
  } catch (e) {
    console.error('[VANGUARD_MEM] recall error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── COWORK SESSIONS — Multi-tenant workspaces (LNES-50.4) ────────────────────
// Deliberately separate from vanguard_memory above: sessions are keyed to a
// logged-in account (email, via requireAuth -> req.developerId -> a lookup),
// not a device fingerprint. Caddy must route /api/v1/cowork/* to this process
// (127.0.0.1:5000) — see Caddyfile; without that rule these fall through to
// the Next.js catch-all and 404 silently, the exact failure mode documented
// in VANGUARD_INTELLIGENCE_ARCHITECTURE.md Phase 6.
// ══════════════════════════════════════════════════════════════════════════════

async function requireDeveloperEmail(req, res) {
  const r = await pool.query('SELECT email FROM biological_developers WHERE id = $1', [req.developerId]);
  if (!r.rows.length) { res.status(401).json({ error: 'Developer not found' }); return null; }
  return r.rows[0].email;
}

// POST /api/v1/cowork/session — create a new workspace, caller becomes owner
app.post('/api/v1/cowork/session', requireAuth, async (req, res) => {
  try {
    const email = await requireDeveloperEmail(req, res);
    if (!email) return;
    const name = (req.body?.name || 'Untitled Workspace').toString().trim().slice(0, 100) || 'Untitled Workspace';

    const s = await pool.query(
      `INSERT INTO cowork_sessions (owner_id, name) VALUES ($1, $2) RETURNING id, name, created_at`,
      [req.developerId, name]
    );
    const session = s.rows[0];
    await pool.query(
      `INSERT INTO cowork_members (session_id, user_email, role) VALUES ($1, $2, 'owner')`,
      [session.id, email]
    );
    return res.json({ session: { ...session, owner_id: req.developerId } });
  } catch (err) {
    console.error('[cowork/session/create]', err);
    return res.status(500).json({ error: 'Session creation failed' });
  }
});

// GET /api/v1/cowork/sessions — list workspaces the caller belongs to (owner or approved member)
app.get('/api/v1/cowork/sessions', requireAuth, async (req, res) => {
  try {
    const email = await requireDeveloperEmail(req, res);
    if (!email) return;
    const r = await pool.query(
      `SELECT s.id, s.name, s.owner_id, s.created_at, m.role
       FROM cowork_sessions s
       JOIN cowork_members m ON m.session_id = s.id
       WHERE m.user_email = $1 AND m.role != 'pending'
       ORDER BY s.created_at DESC`,
      [email]
    );
    return res.json({ sessions: r.rows });
  } catch (err) {
    console.error('[cowork/sessions/list]', err);
    return res.status(500).json({ error: 'List failed' });
  }
});

// GET /api/v1/cowork/session/:id — details + members + linked documents (members only)
app.get('/api/v1/cowork/session/:id', requireAuth, async (req, res) => {
  try {
    const email = await requireDeveloperEmail(req, res);
    if (!email) return;

    const session = await pool.query(`SELECT id, name, owner_id, created_at FROM cowork_sessions WHERE id=$1`, [req.params.id]);
    if (!session.rows.length) return res.status(404).json({ error: 'Session not found' });

    const membership = await pool.query(
      `SELECT role FROM cowork_members WHERE session_id=$1 AND user_email=$2 AND role != 'pending'`,
      [req.params.id, email]
    );
    if (!membership.rows.length) return res.status(403).json({ error: 'Not a member of this session' });

    const members = await pool.query(
      `SELECT user_email, role, created_at FROM cowork_members WHERE session_id=$1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    const links = await pool.query(
      `SELECT xlmp_root, added_by, label, created_at FROM cowork_vault_links WHERE session_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    return res.json({
      session: session.rows[0],
      my_role: membership.rows[0].role,
      members: members.rows,
      documents: links.rows,
    });
  } catch (err) {
    console.error('[cowork/session/get]', err);
    return res.status(500).json({ error: 'Fetch failed' });
  }
});

// POST /api/v1/cowork/session/:id/invite — owner adds a user by EXACT email match.
// Exact equality only (never ILIKE/wildcard) — this is a lookup against every
// registered account's email, so a fuzzy match would let a caller enumerate
// accounts that share a prefix/substring. An exact match either hits one row
// or none.
app.post('/api/v1/cowork/session/:id/invite', requireAuth, async (req, res) => {
  try {
    const targetEmail = (req.body?.email || '').toString().trim().toLowerCase();
    if (!targetEmail) return res.status(400).json({ error: 'email required' });

    const session = await pool.query(`SELECT owner_id FROM cowork_sessions WHERE id=$1`, [req.params.id]);
    if (!session.rows.length) return res.status(404).json({ error: 'Session not found' });
    if (session.rows[0].owner_id !== req.developerId) return res.status(403).json({ error: 'Only the owner can invite' });

    const target = await pool.query(`SELECT email FROM biological_developers WHERE email = $1`, [targetEmail]);
    if (!target.rows.length) return res.status(404).json({ error: 'No ExergyNet account with that exact email' });

    await pool.query(
      `INSERT INTO cowork_members (session_id, user_email, role) VALUES ($1, $2, 'member')
       ON CONFLICT (session_id, user_email) DO UPDATE SET role = 'member'`,
      [req.params.id, targetEmail]
    );
    return res.json({ ok: true, email: targetEmail, role: 'member' });
  } catch (err) {
    console.error('[cowork/session/invite]', err);
    return res.status(500).json({ error: 'Invite failed' });
  }
});

// POST /api/v1/cowork/session/:id/join — caller requests access via a shared link (status: pending)
app.post('/api/v1/cowork/session/:id/join', requireAuth, async (req, res) => {
  try {
    const email = await requireDeveloperEmail(req, res);
    if (!email) return;

    const session = await pool.query(`SELECT id FROM cowork_sessions WHERE id=$1`, [req.params.id]);
    if (!session.rows.length) return res.status(404).json({ error: 'Session not found' });

    const existing = await pool.query(
      `SELECT role FROM cowork_members WHERE session_id=$1 AND user_email=$2`,
      [req.params.id, email]
    );
    if (existing.rows.length && existing.rows[0].role !== 'pending') {
      return res.json({ ok: true, role: existing.rows[0].role }); // already owner/member
    }
    await pool.query(
      `INSERT INTO cowork_members (session_id, user_email, role) VALUES ($1, $2, 'pending')
       ON CONFLICT (session_id, user_email) DO NOTHING`,
      [req.params.id, email]
    );
    return res.json({ ok: true, role: 'pending' });
  } catch (err) {
    console.error('[cowork/session/join]', err);
    return res.status(500).json({ error: 'Join request failed' });
  }
});

// POST /api/v1/cowork/session/:id/approve — SECURITY GATE: owner only. pending -> member.
app.post('/api/v1/cowork/session/:id/approve', requireAuth, async (req, res) => {
  try {
    const targetEmail = (req.body?.email || '').toString().trim().toLowerCase();
    if (!targetEmail) return res.status(400).json({ error: 'email required' });

    const session = await pool.query(`SELECT owner_id FROM cowork_sessions WHERE id=$1`, [req.params.id]);
    if (!session.rows.length) return res.status(404).json({ error: 'Session not found' });
    if (session.rows[0].owner_id !== req.developerId) return res.status(403).json({ error: 'Only the owner can approve members' });

    const r = await pool.query(
      `UPDATE cowork_members SET role='member' WHERE session_id=$1 AND user_email=$2 AND role='pending' RETURNING user_email`,
      [req.params.id, targetEmail]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No pending request for that email' });
    return res.json({ ok: true, email: targetEmail, role: 'member' });
  } catch (err) {
    console.error('[cowork/session/approve]', err);
    return res.status(500).json({ error: 'Approval failed' });
  }
});

// POST /api/v1/cowork/session/:id/reject — owner only. Removes a pending request.
app.post('/api/v1/cowork/session/:id/reject', requireAuth, async (req, res) => {
  try {
    const targetEmail = (req.body?.email || '').toString().trim().toLowerCase();
    if (!targetEmail) return res.status(400).json({ error: 'email required' });

    const session = await pool.query(`SELECT owner_id FROM cowork_sessions WHERE id=$1`, [req.params.id]);
    if (!session.rows.length) return res.status(404).json({ error: 'Session not found' });
    if (session.rows[0].owner_id !== req.developerId) return res.status(403).json({ error: 'Only the owner can reject members' });

    await pool.query(
      `DELETE FROM cowork_members WHERE session_id=$1 AND user_email=$2 AND role='pending'`,
      [req.params.id, targetEmail]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[cowork/session/reject]', err);
    return res.status(500).json({ error: 'Reject failed' });
  }
});

// POST /api/v1/cowork/session/:id/documents — link an already-ingested xlmp_root
// to this session (members only). Context isolation on the frontend relies on
// this table being the sole source of "which documents belong to this session".
app.post('/api/v1/cowork/session/:id/documents', requireAuth, async (req, res) => {
  try {
    const xlmpRoot = (req.body?.xlmp_root || '').toString().trim();
    if (!xlmpRoot) return res.status(400).json({ error: 'xlmp_root required' });
    const label = (req.body?.label || '').toString().trim().slice(0, 200) || null;
    const email = await requireDeveloperEmail(req, res);
    if (!email) return;

    const membership = await pool.query(
      `SELECT role FROM cowork_members WHERE session_id=$1 AND user_email=$2 AND role != 'pending'`,
      [req.params.id, email]
    );
    if (!membership.rows.length) return res.status(403).json({ error: 'Not a member of this session' });

    await pool.query(
      `INSERT INTO cowork_vault_links (session_id, xlmp_root, added_by, label) VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, xlmp_root) DO UPDATE SET label = COALESCE(EXCLUDED.label, cowork_vault_links.label)`,
      [req.params.id, xlmpRoot, email, label]
    );
    return res.json({ ok: true, label });
  } catch (err) {
    console.error('[cowork/session/documents/add]', err);
    return res.status(500).json({ error: 'Link failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ── xLMP VAULT — Sovereign Agent State Storage ────────────────────────────────
// POST /api/xlmp/ingest  — commit agent state, returns durable xlmp_root handle
// GET  /api/xlmp/query   — recall state by xlmp_root
// GET  /api/xlmp/list    — list all commits for authenticated agent
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/xlmp/ingest', requireAuth, async (req, res) => {
  try {
    const { intent, payload: _payload, content } = req.body || {};
    const payload = _payload ?? content;
    if (!payload) return res.status(400).json({ error: 'payload required' });

    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Enforce 512 KB cap — strip to first 512KB if over
    const MAX_BYTES = 512 * 1024;
    const stripped = Buffer.byteLength(raw, 'utf8') > MAX_BYTES
      ? raw.slice(0, MAX_BYTES)
      : raw;

    // Content-addressed root: SHA-256(owner_id + intent + payload)
    const xlmp_root = crypto
      .createHash('sha256')
      .update(req.dev.id + (intent || 'agent-memory-commit') + stripped)
      .digest('hex');

    const bytes_committed = Buffer.byteLength(stripped, 'utf8');

    await pool.query(
      `INSERT INTO xlmp_vault (xlmp_root, owner_id, intent, payload, bytes_committed)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (xlmp_root) DO UPDATE SET committed_at = NOW()`,
      [xlmp_root, req.dev.id, intent || 'agent-memory-commit', stripped, bytes_committed]
    );

    console.log(`[xLMP] Committed | root=${xlmp_root.slice(0,16)}… | bytes=${bytes_committed} | intent=${intent}`);
    res.json({ xlmp_root, bytes_committed, status: 'committed' });
  } catch (e) {
    console.error('[xLMP ingest]', e.message);
    res.status(500).json({ error: 'xLMP_Compress failure', detail: e.message });
  }
});

app.get('/api/xlmp/query', requireAuth, async (req, res) => {
  try {
    const { xlmp_root } = req.query;
    if (!xlmp_root) return res.status(400).json({ error: 'xlmp_root required' });

    const { rows } = await pool.query(
      `SELECT xlmp_root, intent, payload, bytes_committed, committed_at
       FROM xlmp_vault WHERE xlmp_root = $1 AND owner_id = $2`,
      [xlmp_root, req.dev.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'State not found' });

    const row = rows[0];
    let parsed;
    try { parsed = JSON.parse(row.payload); } catch { parsed = row.payload; }

    res.json({
      xlmp_root: row.xlmp_root,
      intent: row.intent,
      payload: parsed,
      bytes_committed: row.bytes_committed,
      committed_at: row.committed_at,
      status: 'recalled',
    });
  } catch (e) {
    console.error('[xLMP query]', e.message);
    res.status(500).json({ error: 'xLMP recall failure', detail: e.message });
  }
});

app.get('/api/xlmp/list', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT xlmp_root, intent, bytes_committed, committed_at
       FROM xlmp_vault WHERE owner_id = $1 ORDER BY committed_at DESC LIMIT 50`,
      [req.dev.id]
    );
    res.json({ commits: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: 'xLMP list failure' });
  }
});

// ADMIN PANEL — Authenticated with dedicated ADMIN_JWT_SECRET, role-based
// Roles: super_admin | ops | support
// ══════════════════════════════════════════════════════════════════════════════

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin-secret-CHANGE-IN-PROD';

// ── OMEGA CARRIER TOKEN AUTO-ROTATION ─────────────────────────────────────────
// Rotates the Omega Carrier machine account API key every 24 hours.
// New key is written to .env, hashed in DB, and broadcast to any subscribed
// agents via the /api/admin/token-rotation SSE stream.
const TOKEN_ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const OMEGA_EMAIL = 'omega-carrier@exergynet.org';
const tokenRotationSubscribers = new Set(); // SSE clients

async function rotateOmegaCarrierToken() {
  try {
    const newToken = 'sk-exergy-' + require('crypto').randomBytes(32).toString('hex');
    const newHash  = await bcrypt.hash(newToken, 12);
    const preview  = newToken.slice(0, 16) + '...';

    // Update DB
    const { rowCount } = await pool.query(
      `UPDATE biological_developers
       SET api_key_hash = $1, api_key_preview = $2
       WHERE email = $3`,
      [newHash, preview, OMEGA_EMAIL]
    );
    if (rowCount === 0) {
      console.warn('[TOKEN-ROTATION] Omega Carrier account not found in DB — skipping.');
      return;
    }

    // Update .env file
    const fs2 = require('fs');
    const envPath = '/home/ubuntu/biological_proxy/.env';
    let envContent = fs2.readFileSync(envPath, 'utf8');
    if (envContent.includes('OMEGA_CARRIER_TOKEN=')) {
      envContent = envContent.replace(/OMEGA_CARRIER_TOKEN=.*/, `OMEGA_CARRIER_TOKEN=${newToken}`);
    } else {
      envContent = envContent.trimEnd() + `\nOMEGA_CARRIER_TOKEN=${newToken}\n`;
    }
    fs2.writeFileSync(envPath, envContent);

    // Update runtime env var
    process.env.OMEGA_CARRIER_TOKEN = newToken;

    const rotatedAt = new Date().toISOString();
    console.log(`[TOKEN-ROTATION] Omega Carrier token rotated at ${rotatedAt} | preview=${preview}`);

    // Notify SSE subscribers
    const payload = JSON.stringify({ event: 'token_rotated', preview, rotated_at: rotatedAt });
    for (const res of tokenRotationSubscribers) {
      try { res.write(`data: ${payload}\n\n`); } catch {}
    }
  } catch (e) {
    console.error('[TOKEN-ROTATION] Rotation failed:', e.message);
  }
}

// Start rotation timer
setInterval(rotateOmegaCarrierToken, TOKEN_ROTATION_INTERVAL_MS);
console.log('[TOKEN-ROTATION] Auto-rotation armed — interval: 24h');

function signAdminToken(adminId, role) {
  return jwt.sign({ sub: adminId, role, iss: 'exergynet-admin' }, ADMIN_JWT_SECRET, { expiresIn: '8h' });
}

function requireAdmin(...roles) {
  return (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }
    try {
      const payload = jwt.verify(header.slice(7), ADMIN_JWT_SECRET);
      if (payload.iss !== 'exergynet-admin') return res.status(401).json({ error: 'Not an admin token' });
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: 'Insufficient role — requires: ' + roles.join(' | ') });
      }
      req.adminId = payload.sub;
      req.adminRole = payload.role;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired admin token' });
    }
  };
}

// ── GET /api/admin/token-rotation (SSE stream) ──────────────────────────────
// Super admins subscribe to receive rotation events in real time.
app.get('/api/admin/token-rotation', requireAdmin('super_admin'), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ event: 'connected', current_preview: (process.env.OMEGA_CARRIER_TOKEN || '').slice(0, 16) + '...' })}\n\n`);
  tokenRotationSubscribers.add(res);
  req.on('close', () => tokenRotationSubscribers.delete(res));
});

// ── POST /api/admin/token-rotation/trigger ───────────────────────────────────
// Manually trigger an immediate rotation (super_admin only).
app.post('/api/admin/token-rotation/trigger', requireAdmin('super_admin'), async (req, res) => {
  await rotateOmegaCarrierToken();
  res.json({
    ok: true,
    message: 'Token rotated immediately.',
    preview: (process.env.OMEGA_CARRIER_TOKEN || '').slice(0, 16) + '...',
    rotated_at: new Date().toISOString(),
  });
});

// ── GET /api/admin/token-rotation/status ────────────────────────────────────
// Returns current token preview and next rotation time.
app.get('/api/admin/token-rotation/status', requireAdmin('super_admin'), (req, res) => {
  res.json({
    omega_email: OMEGA_EMAIL,
    current_preview: (process.env.OMEGA_CARRIER_TOKEN || '').slice(0, 16) + '...',
    rotation_interval_hours: 24,
    subscribers: tokenRotationSubscribers.size,
  });
});

// ── POST /admin/login ────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, role, is_active FROM admin_users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const admin = result.rows[0];
    if (!admin.is_active) return res.status(403).json({ error: 'Account disabled' });
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    await pool.query('UPDATE admin_users SET last_login = NOW() WHERE id = $1', [admin.id]);
    res.json({ token: signAdminToken(admin.id, admin.role), role: admin.role, email: admin.email });
  } catch (err) {
    console.error('[admin/login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /admin/me ─────────────────────────────────────────────────────
app.get('/api/admin/me', requireAdmin(), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, is_active, created_at, last_login FROM admin_users WHERE id = $1',
      [req.adminId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Admin not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin profile' });
  }
});

// ── GET /admin/developers ───────────────────────────────────────────
app.get('/api/admin/developers', requireAdmin('super_admin', 'ops', 'support'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.email, d.active, d.usdc_micro_balance,
             ROUND(d.usdc_micro_balance::numeric / 1000000, 4)::text AS usdc_balance_usd,
             d.api_key_preview, d.wallet_address, d.created_at,
             COUNT(j.id)::int AS total_jobs,
             COALESCE(SUM(j.tokens_yielded), 0)::bigint AS total_tokens
      FROM biological_developers d
      LEFT JOIN en_jobs j ON j.developer_id = d.id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `);
    res.json({ developers: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[admin/developers]', err);
    res.status(500).json({ error: 'Failed to fetch developers' });
  }
});

// ── PUT /admin/developers/:id/active ─────────────────────────────────
app.put('/api/admin/developers/:id/active', requireAdmin('super_admin', 'support'), requireOTET('developer_active:'), async (req, res) => {
  const { active } = req.body || {};
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'active (boolean) required' });
  try {
    const result = await pool.query(
      'UPDATE biological_developers SET active = $1 WHERE id = $2 RETURNING id, email, active',
      [active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Developer not found' });
    res.json({ developer: result.rows[0] });
  } catch (err) {
    console.error('[admin/developers/active]', err);
    res.status(500).json({ error: 'Failed to update developer' });
  }
});

// ── POST /admin/developers/:id/credit ────────────────────────────────
app.post('/api/admin/developers/:id/credit', requireAdmin('super_admin'), requireOTET('developer_credit:'), async (req, res) => {
  const { usdc_micro } = req.body || {};
  if (!usdc_micro || typeof usdc_micro !== 'number' || usdc_micro <= 0) {
    return res.status(400).json({ error: 'usdc_micro (positive number) required' });
  }
  try {
    const result = await pool.query(
      `UPDATE biological_developers SET usdc_micro_balance = usdc_micro_balance + $1
       WHERE id = $2
       RETURNING id, email, usdc_micro_balance`,
      [Math.round(usdc_micro), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Developer not found' });
    const dev = result.rows[0];
    res.json({
      developer: dev,
      new_balance_usd: (dev.usdc_micro_balance / 1_000_000).toFixed(4),
      credited_usd: (usdc_micro / 1_000_000).toFixed(4),
    });
  } catch (err) {
    console.error('[admin/developers/credit]', err);
    res.status(500).json({ error: 'Failed to credit developer' });
  }
});

// ── POST /api/admin/miners/sync-balances — L0 ↔ L1 Reconciliation Valve
// Fetches full node ledger from Virtual Gamma (bank_api), joins via node_registrations,
// sums usdc_micro + rho_micro per developer_id, writes to biological_developers.
app.post('/api/admin/miners/sync-balances', requireAdmin('super_admin'), requireOTET('sync_balances:'), async (req, res) => {
  try {
    // 1. Pull master node ledger from Virtual Gamma
    const bankRes = await fetch('http://127.0.0.1:6000/internal/bank/state', {
      headers: { 'x-bank-secret': process.env.BANK_ADMIN_SECRET || 'VIRTUAL_GAMMA_INTERNAL' },
    });
    if (!bankRes.ok) {
      return res.status(502).json({ error: `bank_api returned ${bankRes.status}` });
    }
    const bankState = await bankRes.json();
    const ledger = bankState.ledger || {};

    // 2. Load all node → developer mappings from relational registry
    const { rows: regs } = await pool.query(
      'SELECT developer_id, node_id FROM node_registrations'
    );

    // 3. Accumulate per developer
    const devBalances = {};
    for (const reg of regs) {
      const { developer_id, node_id } = reg;
      if (!devBalances[developer_id]) devBalances[developer_id] = { usdc: 0, rho: 0 };
      if (ledger[node_id]) {
        devBalances[developer_id].usdc += parseInt(ledger[node_id].usdc_micro || 0, 10);
        devBalances[developer_id].rho  += parseInt(ledger[node_id].rho_micro  || 0, 10);
      }
    }

    // 4. Write aggregated totals to Portal layer
    let updateCount = 0;
    for (const [devId, bals] of Object.entries(devBalances)) {
      await pool.query(
        `UPDATE biological_developers
         SET usdc_micro_balance = $1, rho_micro_balance = $2
         WHERE id = $3`,
        [bals.usdc, bals.rho, devId]
      );
      updateCount++;
    }

    console.log(`[SYNC_BALANCES] Swept ${bankState.node_count} nodes → ${updateCount} developer accounts`);
    res.json({
      status: 'synced',
      nodes_in_ledger: bankState.node_count || 0,
      registrations_scanned: regs.length,
      developers_updated: updateCount,
      ts: Date.now(),
    });
  } catch (e) {
    console.error('[SYNC_BALANCES]', e);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ── GET /admin/settlements ────────────────────────────────────────────
app.get('/api/admin/settlements', requireAdmin('super_admin', 'ops'), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;
  const developer_id = req.query.developer_id;

  try {
    const params = [];
    const conditions = [];
    let i = 1;
    if (status) { conditions.push(`j.zk_proof_status = $${i++}`); params.push(status); }
    if (developer_id) { conditions.push(`j.developer_id = $${i++}`); params.push(developer_id); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countParams = [...params];
    params.push(limit, offset);

    const [rows, countResult] = await Promise.all([
      pool.query(`
        SELECT j.id AS job_id, j.developer_id, d.email AS developer_email,
               j.prompt_hash, j.tokens_yielded, j.bypassed_layers,
               j.zk_proof_status, j.on_chain_sig, j.created_at
        FROM en_jobs j
        LEFT JOIN biological_developers d ON d.id = j.developer_id
        ${where}
        ORDER BY j.created_at DESC
        LIMIT $${i++} OFFSET $${i}
      `, params),
      pool.query(`SELECT COUNT(*) FROM en_jobs j ${where}`, countParams),
    ]);

    res.json({
      jobs: rows.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    });
  } catch (err) {
    console.error('[admin/settlements]', err);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

// ── GET /admin/instructions ───────────────────────────────────────────
app.get('/api/admin/instructions', requireAdmin('super_admin', 'support'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.developer_id, d.email AS developer_email,
             i.name, i.instruction_text, i.is_active, i.created_at, i.updated_at
      FROM developer_instructions i
      LEFT JOIN biological_developers d ON d.id = i.developer_id
      ORDER BY i.created_at DESC
    `);
    res.json({ instructions: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[admin/instructions]', err);
    res.status(500).json({ error: 'Failed to fetch instructions' });
  }
});

// ── GET /admin/engine ──────────────────────────────────────────────────
app.get('/api/admin/engine', requireAdmin('super_admin', 'ops'), async (req, res) => {
  const vanguardUrl = process.env.SEI_VANGUARD_URL || 'http://20.127.220.199:3000';
  const vanguardKey = process.env.SEI_VANGUARD_KEY;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    const response = await fetch(`${vanguardUrl}/health`, {
      headers: vanguardKey ? { Authorization: `Bearer ${vanguardKey}` } : {},
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    const body = await response.json().catch(() => ({}));
    res.json({ url: vanguardUrl, ...body, status: response.ok ? 'online' : 'degraded' });
  } catch (err) {
    res.json({ status: 'offline', url: vanguardUrl, error: err.message });
  }
});

// ── GET /admin/keys ─────────────────────────────────────────────────────
app.get('/api/admin/keys', requireAdmin('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.email, d.api_key_preview, d.active,
             COUNT(j.id)::int AS total_jobs,
             COALESCE(SUM(j.tokens_yielded), 0)::bigint AS total_tokens,
             MAX(j.created_at) AS last_active,
             d.created_at
      FROM biological_developers d
      LEFT JOIN en_jobs j ON j.developer_id = d.id
      GROUP BY d.id, d.email, d.api_key_preview, d.active, d.created_at
      ORDER BY total_jobs DESC NULLS LAST, d.created_at DESC
    `);
    res.json({ keys: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[admin/keys]', err);
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

// ── DELETE /admin/keys/:id (revoke) ──────────────────────────────────────
app.delete('/api/admin/keys/:id', requireAdmin('super_admin'), requireOTET('key_revoke:'), async (req, res) => {
  try {
    const deadHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
    const result = await pool.query(
      "UPDATE biological_developers SET api_key_hash = $1, api_key_preview = 'REVOKED', active = false WHERE id = $2 RETURNING id, email",
      [deadHash, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Developer not found' });
    res.json({ ok: true, revoked: result.rows[0] });
  } catch (err) {
    console.error('[admin/keys/revoke]', err);
    res.status(500).json({ error: 'Failed to revoke key' });
  }
});


// ═══════════════════════════════════════════════════════════════
// VANGUARD SCAN + APP STORE REVIEW
// ═══════════════════════════════════════════════════════════════
const SEI_VG_URL = process.env.SEI_VANGUARD_URL || 'http://20.127.220.199:3000';
const SEI_VG_KEY = process.env.SEI_VANGUARD_KEY || 'sk-vanguard-apex-internal-v1';
const VG_FLAG_THRESHOLD = 0.65;
let CONSOLE_HTML = '<h1>console missing</h1>';
try { CONSOLE_HTML = require('./console_html.js'); } catch (e) { console.error('[console] load failed', e.message); }

async function scanAppWithVanguard(appKey) {
  try {
    const row = await pool.query('SELECT app_key, name, tier, price_micro, usage_price_micro, app_url, description FROM app_catalog WHERE app_key=$1', [appKey]);
    if (!row.rows.length) return;
    const a = row.rows[0];
    const priceUsd = Number(a.price_micro)/1e6, usageUsd = Number(a.usage_price_micro||0)/1e6;
    // ── Deterministic objective checks (code, never hallucinated) ──
    const det = [];
    if (!a.app_url) det.push('no app_url set');
    else if (!/^https:\/\//i.test(a.app_url)) det.push('app_url is not https');
    if (priceUsd > 9999) det.push('price exceeds $9999');
    if (usageUsd > 100) det.push('per-use price unusually high ($' + usageUsd.toFixed(2) + ')');
    if (!a.description || a.description.trim().length < 10) det.push('missing or too-short description');
    // ── Subjective CONTENT assessment from Vanguard (objective facts already validated) ──
    const profile = { name: a.name, tier: a.tier, price_usd: priceUsd, usage_price_usd: usageUsd, app_url: a.app_url, description: a.description };
    const sys = 'You are SEI Vanguard, the ExergyNet app-store CONTENT scanner. Technical checks (https, required fields, price bounds) are ALREADY validated in code — do NOT comment on URLs, https, or missing fields. Judge ONLY the listing CONTENT for: deceptive or unverifiable claims, safety/abuse/illegal signals, or a real contradiction between the name and the description. Reply with ONLY compact JSON, no prose: {"risk":0.0,"reasons":[]}. risk in [0,1] = content risk (0 = benign and coherent). Give reasons ONLY when the risk is concrete and specific; otherwise return an empty list.';
    let vrisk = null, vreasons = [];
    try {
      const vRes = await fetch(SEI_VG_URL + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SEI_VG_KEY },
        body: JSON.stringify({ model: 'vanguard-engine', stream: true, max_tokens: 250, temperature: 0,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(profile) }] }),
        signal: AbortSignal.timeout(45000),
      });
      let text = '';
      if (vRes.ok && vRes.body) {
        const raw = await vRes.text();
        for (const line of raw.split('\n')) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const p = t.slice(5).trim();
          if (p === '[DONE]') continue;
          try { const j = JSON.parse(p); text += (j.choices && j.choices[0] && (j.choices[0].delta && j.choices[0].delta.content || j.choices[0].message && j.choices[0].message.content)) || ''; } catch (e) {}
        }
      }
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const v = JSON.parse(m[0]);
        const r = Number(v.risk);
        if (!isNaN(r)) vrisk = Math.max(0, Math.min(1, r));
        if (Array.isArray(v.reasons)) vreasons = v.reasons.filter(x => typeof x === 'string' && x.trim().length > 3).slice(0, 8);
      }
    } catch (e) { console.warn('[vanguard-scan] model error', appKey, e.message); }
    // ── Combine: deterministic dominates; Vanguard adds subjective risk ──
    let entropy;
    if (vrisk == null) entropy = det.length ? 0.6 : 0.2;          // model unreachable -> lean on deterministic
    else entropy = Math.max(vrisk, det.length ? 0.55 : 0);
    entropy = Math.max(0, Math.min(1, entropy));
    const reasons = det.concat(vreasons);
    const flagged = det.length > 0 || (vrisk != null && vrisk >= VG_FLAG_THRESHOLD);
    const status = flagged ? 'flagged' : 'vanguard_clean';
    await pool.query("UPDATE app_catalog SET entropy=$2, review_reasons=$3, review_status=$4 WHERE app_key=$1 AND review_status NOT IN ('active','rejected')",
      [appKey, entropy, JSON.stringify(reasons), status]);
    if (flagged) emitWebhookForApp(appKey, 'app.flagged', { entropy, reasons });
    console.log('[vanguard-scan]', appKey, status, 'entropy=' + entropy.toFixed(2), 'det=' + det.length, 'vrisk=' + vrisk);
  } catch (e) { console.error('[vanguard-scan] error', appKey, e.message); }
}

// GET review queue (all publisher apps + governance state)
app.get('/api/admin/apps/review-queue', requireAdmin('super_admin','ops','support'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.app_key, c.name, c.tier, c.price_micro, c.usage_price_micro, c.app_url, c.description, c.active,
              c.review_status, c.entropy, c.review_reasons, c.created_at, d.email AS publisher_email
       FROM app_catalog c LEFT JOIN biological_developers d ON d.id = c.publisher_id
       WHERE 1=1
       ORDER BY (c.review_status = 'active') ASC, c.created_at DESC`);
    res.json({ apps: r.rows.map(a => ({
      app_key: a.app_key, name: a.name, tier: a.tier,
      price_usd: (Number(a.price_micro)/1e6).toFixed(2),
      usage_price_usd: (Number(a.usage_price_micro||0)/1e6).toFixed(2),
      app_url: a.app_url, description: a.description, active: a.active,
      review_status: a.review_status, entropy: a.entropy,
      review_reasons: a.review_reasons || [], publisher_email: a.publisher_email,
    })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/apps/approve', requireAdmin('super_admin','ops'), requireOTET('app_approve:'), async (req, res) => {
  const appKey = String((req.body && req.body.app_key) || '');
  if (!appKey) return res.status(400).json({ error: 'app_key required' });
  try {
    const r = await pool.query("UPDATE app_catalog SET active=TRUE, review_status='active' WHERE app_key=$1 RETURNING app_key, active, review_status", [appKey]);
    if (!r.rows.length) return res.status(404).json({ error: 'app not found' });
    emitWebhookForApp(appKey, 'app.approved', { approved_by: req.adminRole });
    res.json({ status: 'approved', app: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/apps/reject', requireAdmin('super_admin','ops'), requireOTET('app_reject:'), async (req, res) => {
  const appKey = String((req.body && req.body.app_key) || '');
  const reason = String((req.body && req.body.reason) || '').slice(0, 300);
  if (!appKey) return res.status(400).json({ error: 'app_key required' });
  try {
    const r = await pool.query("UPDATE app_catalog SET active=FALSE, review_status='rejected', review_reasons=$2 WHERE app_key=$1 RETURNING app_key, active, review_status",
      [appKey, JSON.stringify(reason ? [reason] : ['rejected by admin'])]);
    if (!r.rows.length) return res.status(404).json({ error: 'app not found' });
    emitWebhookForApp(appKey, 'app.rejected', { reason, rejected_by: req.adminRole });
    res.json({ status: 'rejected', app: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/apps/rescan', requireAdmin('super_admin','ops'), requireOTET('app_rescan:'), async (req, res) => {
  const appKey = String((req.body && req.body.app_key) || '');
  if (!appKey) return res.status(400).json({ error: 'app_key required' });
  await pool.query("UPDATE app_catalog SET review_status='pending_review' WHERE app_key=$1 AND review_status<>'active'", [appKey]);
  scanAppWithVanguard(appKey).catch(() => {});
  res.json({ status: 'rescanning', app_key: appKey });
});

// Self-contained admin review console (login + queue + approve/reject)
app.get('/api/admin/apps/console', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(CONSOLE_HTML);
});

// ── LNES-17: OTET Build Ledger Endpoints ─────────────────────────────────────

// GET /api/admin/build/witness-file?path=<absolute-path-on-server>
// Chapter XXVI: Challenge phase. Agent calls this FIRST to prove it will read
// the file NOW. Returns file content + a 32-byte nonce. The nonce is stored
// server-side, keyed by the admin token. It expires in 10 minutes.
// ── LNES-17 Carrier relay (Portal -> Carrier EC2, 3.234.120.103) ────────────
// Extends OTET witness/write coverage to Carrier, which previously had zero
// write path here (WRITE_ALLOWED_ROOTS below is Portal-local fs only and
// cannot reach a different machine). Uses a DEDICATED, narrowly-scoped
// keypair (portal-carrier-otet-relay) authorized on Carrier with a
// forced command= restriction (/usr/local/bin/carrier_otet_relay.sh) that
// only permits read/write/hash within CARRIER_ALLOWED_ROOTS -- NOT the
// unrestricted operator key used for pm2 restarts elsewhere. A file_path
// prefixed "carrier:" routes witness-file/agent-edit through this relay
// instead of the local filesystem; everything else (nonce, nulls, OTET
// issuance, Vanguard Scribe) is unchanged.
const { spawnSync } = require('child_process');
const CARRIER_RELAY_KEY = '/home/ubuntu/.ssh/carrier_relay_key';
const CARRIER_HOST = 'ubuntu@3.234.120.103';
const CARRIER_ALLOWED_ROOTS = [
  '/home/ubuntu/exergynet_api/src/',
  '/home/ubuntu/exergynet_api/Cargo.toml',
  // LNES-22: extends the relay to the Omega Carrier MCP server so its
  // systemd-deployed source can go through OTET instead of deploy.sh's raw SSH.
  '/home/ubuntu/omega_carrier/',
];
function isCarrierPathAllowed(p) {
  return CARRIER_ALLOWED_ROOTS.some(r => p === r || p.startsWith(r));
}
function carrierRelay(op, remotePath, inputContent) {
  const result = spawnSync('ssh', [
    '-i', CARRIER_RELAY_KEY,
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=10',
    CARRIER_HOST,
    `${op} ${remotePath}`,
  ], {
    input: inputContent !== undefined ? inputContent : undefined,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw new Error(`carrier relay spawn error: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`carrier relay failed (exit ${result.status}): ${(result.stderr || '').trim()}`);
  return result.stdout;
}

app.get('/api/admin/build/witness-file', requireAdmin('super_admin', 'ops'), async (req, res) => {
  const file_path = req.query.path;
  if (!file_path) return res.status(400).json({ error: 'path query param required' });

  // Carrier relay branch — file_path looks like "carrier:/home/ubuntu/exergynet_api/src/main.rs"
  if (file_path.startsWith('carrier:')) {
    const carrierPath = file_path.slice('carrier:'.length);
    if (!isCarrierPathAllowed(carrierPath)) {
      console.warn(`[WITNESS] CARRIER PATH TRAVERSAL ATTEMPT blocked: ${carrierPath}`);
      return res.status(403).json({ error: 'Path traversal detected. Access denied.' });
    }
    try {
      const witness_content = carrierRelay('read', carrierPath);
      const nonce = crypto.randomBytes(32).toString('hex');
      const admin_token = req.headers['authorization']?.replace('Bearer ', '') || '';
      const cache_key = admin_token + ':' + file_path;
      const witness_hash = crypto.createHash('sha256').update(witness_content + nonce).digest('hex');
      witnessNonceCache.set(cache_key, {
        nonce, file_path, is_directory: false, witness_content,
        file_content_hash: witness_hash,
        expires_at: Date.now() + 10 * 60 * 1000,
      });
      console.log(`[WITNESS] Challenge issued | path=${file_path} (CARRIER) | nonce=${nonce.slice(0, 8)}…`);
      return res.json({
        file_path, is_directory: false, file_content: witness_content, nonce,
        challenge_note: 'Compute SHA-256(file_content + nonce) and pass as witness_hash in POST /api/admin/build/issue-otet',
        expires_in_seconds: 600,
      });
    } catch (err) {
      console.error('[WITNESS] carrier relay read failed:', err.message);
      return res.status(502).json({ error: 'Carrier relay unreachable: ' + err.message });
    }
  }

  // Whitelist: resolve() first to collapse traversal sequences, then check roots
  const nodePath = require('path');
  const ALLOWED_ROOTS = [
    '/home/ubuntu/biological_proxy/',
    '/home/ubuntu/exergynet-portal/src/',
    '/home/ubuntu/omega_carrier/',
    '/home/ubuntu/sovereign-tts/',
    '/home/ubuntu/livekit-token/',
    '/home/ubuntu/lnes04-base-membrane/',
    '/home/ubuntu/lnes_siphon_evm/',
    '/etc/caddy/',
  ];
  // A-01: path.resolve() collapses ../ traversal before the whitelist check
  const resolved_path = nodePath.resolve(file_path);
  const allowed = ALLOWED_ROOTS.some(r => resolved_path.startsWith(r));
  if (!allowed) {
    console.warn(`[WITNESS] PATH TRAVERSAL ATTEMPT blocked: ${file_path} → ${resolved_path}`);
    return res.status(403).json({ error: 'Path traversal detected. Access denied.' });
  }
  // A-02: ban secret file extensions regardless of location
  const SECRET_EXTENSIONS = ['.env', '.pem', '.key', '.p12', '.pfx', '.cer', '.secret'];
  const SECRET_NAMES = ['.env', '.env.local', '.env.production', '.env.development'];
  const basename = nodePath.basename(resolved_path);
  if (SECRET_EXTENSIONS.some(ext => resolved_path.endsWith(ext)) || SECRET_NAMES.includes(basename)) {
    console.warn(`[WITNESS] SECRET FILE ACCESS blocked: ${resolved_path}`);
    return res.status(403).json({ error: 'Secret file access forbidden.' });
  }
  // Use the resolved path from here on
  const file_path_safe = resolved_path;

  if (!fs.existsSync(file_path_safe)) return res.status(404).json({ error: 'File not found on server.' });

  try {
    const nonce = crypto.randomBytes(32).toString('hex');
    const admin_token = req.headers['authorization']?.replace('Bearer ', '') || '';
    const stat = fs.statSync(file_path_safe);
    const is_directory = stat.isDirectory();

    let witness_content;
    if (is_directory) {
      // Chapter XXVII: directory witness — content is comma-separated filename list
      const entries = fs.readdirSync(file_path_safe).sort();
      witness_content = entries.join('\x00'); // B-03: null-byte separator — filenames can contain commas
    } else {
      witness_content = fs.readFileSync(file_path_safe, 'utf8');
    }

    const witness_hash = crypto.createHash('sha256').update(witness_content + nonce).digest('hex');
    const cache_key = admin_token + ':' + file_path_safe;

    witnessNonceCache.set(cache_key, {
      nonce,
      file_path,
      is_directory,
      witness_content,
      file_content_hash: witness_hash,
      expires_at: Date.now() + 10 * 60 * 1000,
    });

    console.log(`[WITNESS] Challenge issued | path=${file_path_safe} | type=${is_directory ? 'DIR' : 'FILE'} | nonce=${nonce.slice(0,8)}…`);
    res.json({
      file_path: file_path_safe,
      is_directory,
      ...(is_directory
        ? { directory_entries: witness_content.split('\x00').filter(Boolean), entry_count: witness_content.split('\x00').filter(Boolean).length }
        : { file_content: witness_content }),
      nonce,
      challenge_note: is_directory
        ? 'Compute SHA-256(directory_entries_string + nonce) and pass as witness_hash. Use create_mode:true in issue-otet.'
        : 'Compute SHA-256(file_content + nonce) and pass as witness_hash in POST /api/admin/build/issue-otet',
      expires_in_seconds: 600,
    });
  } catch (err) {
    console.error('[WITNESS]', err);
    res.status(500).json({ error: 'Witness challenge failed' });
  }
});

// POST /api/admin/build/issue-otet
// Agent calls this BEFORE editing any record. Returns a single-use OTET
// cryptographically bound to the target's current state hash.
app.post('/api/admin/build/issue-otet', requireAdmin('super_admin', 'ops'), async (req, res) => {
  const { service_name, target_id, current_state, witness_hash, content_hash: supplied_content_hash, file_path } = req.body || {};
  if (!service_name || !target_id) {
    return res.status(400).json({ error: 'service_name and target_id are required' });
  }

  // Chapter XXVI/XXVII: If file_path provided, enforce Witness-Hash Challenge.
  // If no file_path, fall back to legacy current_state hash (DB-record edits).
  const { create_mode } = req.body || {};
  let state_hash;
  if (file_path) {
    if (!witness_hash) {
      return res.status(423).json({
        error: 'LNES-17 Witness Violation: witness_hash required for file edits. Call GET /api/admin/build/witness-file?path=... first.',
      });
    }
    const admin_token = req.headers['authorization']?.replace('Bearer ', '') || '';
    const cache_key = admin_token + ':' + file_path;
    const cached = witnessNonceCache.get(cache_key);

    if (!cached) {
      return res.status(403).json({ error: 'No active witness challenge for this path. Call witness-file first.' });
    }
    if (cached.expires_at < Date.now()) {
      witnessNonceCache.delete(cache_key);
      return res.status(403).json({ error: 'Witness challenge expired. Call witness-file again.' });
    }
    if (witness_hash !== cached.file_content_hash) {
      witnessNonceCache.delete(cache_key);
      console.warn(`[WITNESS] HASH MISMATCH — Agent caught lying. path=${file_path} | create_mode=${!!create_mode}`);
      return res.status(403).json({ error: 'WITNESS HASH MISMATCH. Agent does not possess current directory/file state. Access violently denied.' });
    }

    // Chapter XXVII: create_mode — Proof of Void
    if (create_mode) {
      if (!cached.is_directory) {
        witnessNonceCache.delete(cache_key);
        return res.status(400).json({ error: 'create_mode requires witnessing the parent DIRECTORY, not a file.' });
      }
      // Extract new filename from target_id: "NEW:/path/to/file.js"
      const NEW_PREFIX = 'NEW:';
      if (!target_id.startsWith(NEW_PREFIX)) {
        witnessNonceCache.delete(cache_key);
        return res.status(400).json({ error: 'create_mode requires target_id in format "NEW:/absolute/path/to/newfile.js"' });
      }
      const new_file_path = target_id.slice(NEW_PREFIX.length);
      const new_filename = new_file_path.split('/').pop();
      // Verify the file does NOT already exist in the witnessed directory listing
      const existing_entries = cached.witness_content.split('\x00').filter(Boolean);
      if (existing_entries.includes(new_filename)) {
        witnessNonceCache.delete(cache_key);
        console.warn(`[VOID] CONFLICT — file already exists: ${new_filename} in ${file_path}`);
        return res.status(409).json({
          error: `CONFLICT: File "${new_filename}" already exists in the witnessed directory. Use Edit Mode, not create_mode.`,
          existing_files: existing_entries,
        });
      }
      console.log(`[VOID] Proof of Void verified | new_file=${new_filename} | dir=${file_path}`);
    }

    // Witness verified — consume the nonce
    state_hash = cached.file_content_hash;  // nonce-bound hash (for tamper detection)
    witnessNonceCache.delete(cache_key);
    console.log(`[WITNESS] VERIFIED | path=${file_path} | create_mode=${!!create_mode} | hash=${state_hash.slice(0,16)}…`);
  } else {
    // Legacy path: DB-record edits. Caller provides current_state JSON.
    const state_input = current_state ? JSON.stringify(current_state) : target_id;
    state_hash = crypto.createHash('sha256').update(state_input).digest('hex');
  }

  try {
    const otet = 'otet-' + crypto.randomBytes(24).toString('hex');
    // content_hash: plain SHA256(file_content) without nonce — used for pre_hash check in agent-edit
    const stored_content_hash = supplied_content_hash || null;
    await pool.query(
      `INSERT INTO build_audit_ledger (otet, service_name, target_id, state_hash, content_hash, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'UNSPENT', NOW() + INTERVAL '24 hours')`,
      [otet, service_name, target_id, state_hash, stored_content_hash]
    );
    console.log(`[OTET] Issued: ${otet} | service=${service_name} | target=${target_id} | witness=${!!file_path}`);
    res.json({ otet, service_name, target_id, state_hash, status: 'UNSPENT', witness_verified: !!file_path, create_mode: !!create_mode, expires_note: 'Single-use. Submit as x-otet header on mutating request.' });
  } catch (err) {
    console.error('[OTET issue]', err);
    res.status(500).json({ error: 'OTET issuance failed' });
  }
});

// POST /api/admin/build/spend-otet
// Spend a token and optionally trigger Vanguard Scribe (Chapter XXIII).
// Body: { otet, post_state? (object), lines_added?, lines_removed? }
// If post_state provided, Vanguard computes a semantic diff and appends
// the result to service_evolution_v2.json on disk.
app.post('/api/admin/build/spend-otet', requireAdmin('super_admin', 'ops'), async (req, res) => {
  const { otet, post_state, lines_added, lines_removed } = req.body || {};
  if (!otet) return res.status(400).json({ error: 'otet required' });
  const { rows } = await pool.query(
    `SELECT * FROM build_audit_ledger WHERE otet = $1`, [otet]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'OTET not found' });
  if (rows[0].status !== 'UNSPENT') return res.status(409).json({ error: `OTET already ${rows[0].status}` });

  await spendOTET(otet);
  const spent_at = new Date().toISOString();

  // ── Chapter XXIII: Vanguard Scribe ────────────────────────────────────────
  // If post_state provided, call Vanguard to produce a semantic diff narrative
  // and append it to service_evolution_v2.json.
  let scribe_entry = null;
  if (post_state) {
    try {
      const pre_hash = rows[0].state_hash;
      const post_hash = crypto.createHash('sha256').update(JSON.stringify(post_state)).digest('hex');
      const vanguard_url = process.env.SEI_VANGUARD_URL || 'http://20.127.220.199:3000';
      const vanguard_key = process.env.SEI_VANGUARD_KEY || '';

      const prompt = `You are the Vanguard Scribe — the sovereign auditor of the ExergyNet build process.
A verified OTET edit has just occurred on service: ${rows[0].service_name}, target: ${rows[0].target_id}.

PRE-EDIT STATE HASH: ${pre_hash}
POST-EDIT STATE HASH: ${post_hash}
Lines added: ${lines_added ?? 'unknown'}, Lines removed: ${lines_removed ?? 'unknown'}

Write a concise (2–4 sentence) semantic diff narrative describing what changed, why it matters to the architecture, and what invariants were preserved or introduced. Output only the narrative — no preamble.`;

      const vr = await fetch(`${vanguard_url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vanguard_key}` },
        body: JSON.stringify({ model: 'vanguard', messages: [{ role: 'user', content: prompt }], stream: false, max_tokens: 300 }),
        signal: AbortSignal.timeout(12000),
      });
      const vd = await vr.json().catch(() => ({}));
      const narrative = vd?.choices?.[0]?.message?.content?.trim() || 'Scribe unavailable — diff recorded by hash only.';

      scribe_entry = {
        otet,
        service_name: rows[0].service_name,
        target_id: rows[0].target_id,
        pre_hash,
        post_hash,
        lines_added: lines_added ?? null,
        lines_removed: lines_removed ?? null,
        narrative,
        spent_at,
      };

      // Append to service_evolution_v2.json
      const EVOLUTION_PATH = '/home/ubuntu/biological_proxy/service_evolution_v2.json';
      let ledger = [];
      if (fs.existsSync(EVOLUTION_PATH)) {
        try { ledger = JSON.parse(fs.readFileSync(EVOLUTION_PATH, 'utf8')); } catch (_) { ledger = []; }
      }
      ledger.unshift(scribe_entry);  // newest first
      fs.writeFileSync(EVOLUTION_PATH, JSON.stringify(ledger, null, 2));
      console.log(`[SCRIBE] Evolution recorded: ${otet} | ${rows[0].service_name} → ${narrative.slice(0, 80)}…`);
    } catch (scribe_err) {
      console.warn('[SCRIBE] Vanguard diff failed:', scribe_err.message);
    }
  }

  res.json({ status: 'SPENT', otet, spent_at, scribe_entry });
});

// POST /api/admin/build/agent-edit
// Claude Code OTET harness endpoint — final step of agent edit discipline.
// Claude must: witness-file → issue-otet → make edit → call this to record.
// Requires: admin auth + valid OTET scoped to "agent_edit:<file_path>"
// Body: { otet, file_path, pre_hash, post_hash, narrative, lines_added, lines_removed, service_name }
app.post('/api/admin/build/agent-edit', requireAdmin('super_admin', 'ops'), async (req, res) => {
  const { otet, file_path, content, pre_hash, post_hash, narrative, lines_added, lines_removed, service_name } = req.body || {};
  if (!otet || !file_path) return res.status(400).json({ error: 'otet and file_path required' });

  // Validate OTET exists and is unspent
  const { rows } = await pool.query(
    `SELECT * FROM build_audit_ledger WHERE otet = $1`, [otet]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'OTET not found' });
  if (rows[0].status !== 'UNSPENT') return res.status(409).json({ error: `OTET already ${rows[0].status}` });

  // Scope check: target_id must be scoped to this file, either "agent_edit:"
  // (editing an existing file) or "NEW:" (LNES-17 Chapter XXVII create_mode).
  // issue-otet stores create_mode OTETs with the NEW: prefix so it can run its
  // own "file doesn't already exist yet" check; this endpoint accepts either
  // since both mean "this OTET authorizes writing exactly this path". Without
  // this, create_mode was issuable but never actually writable -- agent-edit
  // rejected every one of its own OTETs.
  const SCOPE_PREFIXES = ['agent_edit:', 'NEW:'];
  const matchedPrefix = SCOPE_PREFIXES.find(p => rows[0].target_id.startsWith(p));
  if (!matchedPrefix) {
    return res.status(403).json({ error: 'OTET not scoped for agent_edit. Reissue with target_id="agent_edit:<file>"' });
  }

  // Verify the file_path in body matches what was witnessed
  const witnessed_path = rows[0].target_id.slice(matchedPrefix.length);
  if (witnessed_path !== file_path) {
    return res.status(403).json({ error: `OTET path mismatch. Witnessed: ${witnessed_path}, submitted: ${file_path}` });
  }

  await spendOTET(otet);
  const spent_at = new Date().toISOString();

  // If content provided — write it to the file (API-only write path, LNES-17)
  if (content !== undefined && content !== null) {
    // Verify pre_hash matches what was witnessed (bait-and-switch guard) — shared
    // by both the Carrier-relay branch and the local-fs branch below.
    if (pre_hash && rows[0].content_hash) {
      if (pre_hash !== rows[0].content_hash) {
        return res.status(403).json({
          error: `PRE-HASH MISMATCH: witnessed content hash does not match submitted pre_hash. Bait-and-switch attempt blocked.`,
          expected: rows[0].content_hash.slice(0, 16) + '...',
          received: pre_hash.slice(0, 16) + '...',
        });
      }
    }

    if (file_path.startsWith('carrier:')) {
      const carrierPath = file_path.slice('carrier:'.length);
      if (!isCarrierPathAllowed(carrierPath)) {
        return res.status(403).json({ error: 'Write path not in Carrier allowed roots.' });
      }
      try {
        const relay_hash = carrierRelay('write', carrierPath, content).trim();
        const expected_hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
        if (relay_hash !== expected_hash) {
          return res.status(500).json({ error: `Carrier write verification failed — relay reports ${relay_hash.slice(0,16)}…, expected ${expected_hash.slice(0,16)}….` });
        }
        console.log(`[AGENT-WRITE] File written via Carrier relay | path=${carrierPath} | bytes=${Buffer.byteLength(content)} | verified_hash=${relay_hash.slice(0,16)}…`);
      } catch (write_err) {
        return res.status(502).json({ error: 'Carrier relay write failed: ' + write_err.message });
      }
    } else {
      const nodePath = require('path');
      const WRITE_ALLOWED_ROOTS = [
        '/home/ubuntu/biological_proxy/',
        '/home/ubuntu/exergynet-portal/src/',
        '/home/ubuntu/omega_carrier/',
        '/home/ubuntu/sovereign-tts/',
        '/home/ubuntu/exergynet-ledger/',
        '/home/ubuntu/lnes04-base-membrane/',
        '/home/ubuntu/lnes_siphon_evm/',
      ];
      const resolved = nodePath.resolve(file_path);
      const writeAllowed = WRITE_ALLOWED_ROOTS.some(r => resolved.startsWith(r));
      if (!writeAllowed) {
        return res.status(403).json({ error: 'Write path not in LNES-17 allowed roots.' });
      }
      try {
        fs.writeFileSync(resolved, content, 'utf8');
        console.log(`[AGENT-WRITE] File written via API | path=${resolved} | bytes=${Buffer.byteLength(content)}`);
      } catch (write_err) {
        return res.status(500).json({ error: 'File write failed: ' + write_err.message });
      }
    }
  }

  // Compute post_hash from written content or supplied value
  const actual_post_hash = post_hash ||
    (content !== undefined ? crypto.createHash('sha256').update(content).digest('hex') : 'unknown');

  // Write to Vanguard Scribe
  const scribe_entry = {
    otet,
    service_name: service_name || rows[0].service_name,
    target_id: file_path,
    agent: 'claude-code',
    origin: 'trustee', // LNES-22: Physical actuation — human-directed agent. See vanguard_review (Logical audit).
    pre_hash: pre_hash || rows[0].state_hash,
    post_hash: actual_post_hash,
    lines_added: lines_added ?? null,
    lines_removed: lines_removed ?? null,
    narrative: narrative || 'Agent edit — no narrative provided.',
    spent_at,
    api_write: content !== undefined,
  };

  try {
    const EVOLUTION_PATH = '/home/ubuntu/biological_proxy/service_evolution_v2.json';
    let ledger = [];
    if (fs.existsSync(EVOLUTION_PATH)) {
      try { ledger = JSON.parse(fs.readFileSync(EVOLUTION_PATH, 'utf8')); } catch (_) { ledger = []; }
    }
    ledger.unshift(scribe_entry);
    fs.writeFileSync(EVOLUTION_PATH, JSON.stringify(ledger, null, 2));
    console.log(`[AGENT-EDIT] Scribe recorded | file=${file_path} | otet=${otet.slice(0,16)}… | narrative="${(narrative||'').slice(0,60)}…"`);
  } catch (e) {
    console.warn('[AGENT-EDIT] Scribe write failed:', e.message);
  }

  // ── LNES-22: Sensory Trigger ──────────────────────────────────────────────
  // Fire-and-forget: converts this build event into sensory input for the
  // independent Vanguard audit process (shadow_listener.py). Never awaited —
  // an unreachable Vanguard listener must not delay or fail the Trustee's
  // own OTET write. Re-injected 2026-07-23 — was missing entirely, meaning
  // vanguard-review's receiver had nothing calling it either way.
  const VANGUARD_WEBHOOK_URL = process.env.VANGUARD_WEBHOOK_URL || '';
  if (VANGUARD_WEBHOOK_URL) {
    fetch(VANGUARD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'otet-event', ...scribe_entry, content: content ?? null }),
      signal: AbortSignal.timeout(5000),
    }).then(r => { if (!r.ok) console.warn(`[LNES-22] Vanguard webhook responded ${r.status}`); })
      .catch(err => console.warn('[LNES-22] Vanguard webhook unreachable (non-fatal):', err.message));
  }

  res.json({ status: 'recorded', otet, file_path, spent_at, scribe_entry });
});

// ── LNES-22: Sovereign Signature — Verification Gate ────────────────────────
// Vanguard's independent audit process pushes its review back here, signed with
// its own Ed25519 key (never held by this server). We verify the signature and
// pin the public key against VANGUARD_PUBLIC_KEY — a valid self-consistent
// signature alone isn't enough; it must be from the ONE recognized Vanguard
// identity, or it's rejected as Synthetic Noise. Canonicalization must match
// shadow_listener.py's identity.py sign_review() byte-for-byte: recursively
// sort keys, no whitespace.
//
// Live end-to-end retest fired 2026-07-23 immediately after this route and
// the sensory-trigger webhook above were both restored — confirming the
// shadow_listener.py round trip closes again (see LNES22_TEST_NOTES.md).
// Re-injected 2026-07-23 (LNES-22 loop was fractured — this route was
// entirely missing from production despite shadow_listener.py actively
// POSTing to it). Verification rewritten to use Node's built-in `crypto`
// Ed25519 (same SPKI-DER-wrap pattern the KRV valve above already uses in
// production) instead of the original tweetnacl-based check — tweetnacl is
// not an installed dependency here, and Node's built-in Ed25519 verifies the
// exact same standard 64-byte signature format shadow_listener.py already
// produces, so no client-side change is needed.
function canonicalJSON(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJSON(obj[k])).join(',') + '}';
}

// POST /api/admin/build/vanguard-review
// No requireAdmin — by design. The Ed25519 signature IS the credential here;
// Vanguard is a separate sovereign actor, not a browser session with a JWT.
// LNES-22 remediation Phase 6: replay cache. In-memory only -- resets on
// process restart, which reopens a narrow replay window right after a
// restart. Documented, not hidden: durable replay protection needs a store
// that survives restarts (Postgres/Redis), which is a real follow-up, not
// done here. Still strictly better than no replay protection at all.
const _vanguardReviewSeenEventIds = new Set();
const VANGUARD_REVIEW_MAX_CLOCK_SKEW_MS = 60_000; // tolerate 60s clock drift

app.post('/api/admin/build/vanguard-review', async (req, res) => {
  const VANGUARD_PUBLIC_KEY = process.env.VANGUARD_PUBLIC_KEY || '';
  if (!VANGUARD_PUBLIC_KEY) {
    return res.status(503).json({ error: 'VANGUARD_PUBLIC_KEY not configured — signature verification unavailable.' });
  }
  const { vanguard_sig, ...body } = req.body || {};
  const otet = body.otet;
  if (!otet || !vanguard_sig || !body.vanguard_pubkey) {
    return res.status(400).json({ error: 'otet, vanguard_sig, and vanguard_pubkey required.' });
  }

  // Phase 6 schema/freshness checks -- BEFORE signature verification would
  // leak nothing extra (these are structural, not secret), and rejecting
  // malformed/stale envelopes early keeps the crypto.verify call for
  // envelopes that are at least well-formed.
  if (!body.event_id || !body.expires_at || !body.issued_at) {
    return res.status(400).json({ error: 'event_id, issued_at, and expires_at required (LNES-22 replay/freshness hardening).' });
  }
  if (_vanguardReviewSeenEventIds.has(body.event_id)) {
    console.warn(`[LNES-22] REJECTED — replayed event_id: ${body.event_id}`);
    return res.status(409).json({ error: 'Replayed event_id. Entry rejected.' });
  }
  const now = Date.now();
  const expiresAtMs = Date.parse(body.expires_at);
  const issuedAtMs = Date.parse(body.issued_at);
  if (Number.isNaN(expiresAtMs) || Number.isNaN(issuedAtMs)) {
    return res.status(400).json({ error: 'issued_at/expires_at must be valid RFC3339 timestamps.' });
  }
  if (now > expiresAtMs) {
    console.warn(`[LNES-22] REJECTED — expired review | event_id=${body.event_id} | expired_at=${body.expires_at}`);
    return res.status(409).json({ error: 'Review expired. Entry rejected.' });
  }
  if (issuedAtMs > now + VANGUARD_REVIEW_MAX_CLOCK_SKEW_MS) {
    console.warn(`[LNES-22] REJECTED — future-dated review | event_id=${body.event_id} | issued_at=${body.issued_at}`);
    return res.status(409).json({ error: 'Future-dated review beyond clock-skew tolerance. Entry rejected.' });
  }

  if (body.vanguard_pubkey !== VANGUARD_PUBLIC_KEY) {
    console.warn(`[LNES-22] REJECTED — unrecognized public key: ${body.vanguard_pubkey}`);
    return res.status(403).json({ error: 'Unrecognized public key. Entry rejected as Synthetic Noise.' });
  }
  let sigValid = false;
  try {
    const message = Buffer.from(canonicalJSON(body), 'utf8');
    const pubKeyDer = Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'), // Ed25519 SubjectPublicKeyInfo prefix
      Buffer.from(body.vanguard_pubkey, 'hex'),
    ]);
    const pubKey = crypto.createPublicKey({ key: pubKeyDer, format: 'der', type: 'spki' });
    sigValid = crypto.verify(null, message, pubKey, Buffer.from(vanguard_sig, 'hex'));
  } catch (e) {
    console.warn('[LNES-22] Signature verification error:', e.message);
  }
  if (!sigValid) {
    console.warn(`[LNES-22] REJECTED — signature mismatch | otet=${otet}`);
    return res.status(403).json({ error: 'Signature verification failed. Entry rejected as Synthetic Noise.' });
  }
  // Only mark the event_id as seen AFTER signature verification passes --
  // an attacker replaying a bad signature under a fresh event_id should
  // keep failing every time, not burn real event_ids off the replay cache.
  _vanguardReviewSeenEventIds.add(body.event_id);
  try {
    const EVOLUTION_PATH = '/home/ubuntu/biological_proxy/service_evolution_v2.json';
    let ledger = [];
    if (fs.existsSync(EVOLUTION_PATH)) {
      try { ledger = JSON.parse(fs.readFileSync(EVOLUTION_PATH, 'utf8')); } catch (_) { ledger = []; }
    }
    const vanguard_review = { ...body, vanguard_sig, verified: true, received_at: new Date().toISOString() };
    const idx = ledger.findIndex(e => e.otet === otet);
    if (idx >= 0) {
      ledger[idx].vanguard_review = vanguard_review;
    } else {
      ledger.unshift({ otet, origin: 'vanguard-standalone', vanguard_review });
    }
    fs.writeFileSync(EVOLUTION_PATH, JSON.stringify(ledger, null, 2));
    console.log(`[LNES-22] Vanguard Audit VERIFIED and recorded | otet=${otet.slice(0,16)}…`);
    res.json({ status: 'verified-and-recorded', otet });
  } catch (e) {
    console.error('[LNES-22] Ledger write failed:', e.message);
    res.status(500).json({ error: 'Ledger write failed: ' + e.message });
  }
});

// GET /api/admin/build/evolution
// Vanguard Scribe manifest — semantic diff history (Chapter XXIII).
app.get('/api/admin/build/evolution', requireAdmin('super_admin', 'ops'), (req, res) => {
  const EVOLUTION_PATH = '/home/ubuntu/biological_proxy/service_evolution_v2.json';
  if (!fs.existsSync(EVOLUTION_PATH)) return res.json([]);
  try {
    const ledger = JSON.parse(fs.readFileSync(EVOLUTION_PATH, 'utf8'));
    res.json(ledger);
  } catch (_) {
    res.status(500).json({ error: 'Evolution manifest corrupted' });
  }
});

// GET /api/admin/build/otet-status/:otet
app.get('/api/admin/build/otet-status/:otet', requireAdmin('super_admin', 'ops'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM build_audit_ledger WHERE otet = $1`, [req.params.otet]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'OTET not found' });
  res.json(rows[0]);
});

// GET /api/admin/build/ledger
// Full audit log — paginated, newest first.
app.get('/api/admin/build/ledger', requireAdmin('super_admin', 'ops'), async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50'), 200);
  const offset = parseInt(req.query.offset || '0');
  const service = req.query.service || null;
  try {
    const where  = service ? `WHERE service_name = $3` : '';
    const params = service ? [limit, offset, service] : [limit, offset];
    const { rows } = await pool.query(
      `SELECT otet, service_name, target_id, state_hash, issued_at, spent_at, status
       FROM build_audit_ledger
       ${where}
       ORDER BY issued_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    const total = await pool.query(
      `SELECT COUNT(*) FROM build_audit_ledger ${service ? 'WHERE service_name=$1' : ''}`,
      service ? [service] : []
    );
    res.json({ entries: rows, total: parseInt(total.rows[0].count), limit, offset });
  } catch (err) {
    res.status(500).json({ error: 'Ledger query failed' });
  }
});

// GET /api/admin/build/active-otet-check
// LNES-17 gate check — SSH agent_shell_gate.sh calls this to allow pm2/deploy commands.
// Returns { active: true } if any UNSPENT OTET was issued in the last 24 hours.
app.get('/api/admin/build/active-otet-check', async (req, res) => {
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== process.env.ASKMO_INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*) FROM build_audit_ledger WHERE status = 'UNSPENT' AND issued_at > NOW() - INTERVAL '24 hours'"
    );
    res.json({ active: parseInt(rows[0].count, 10) > 0 });
  } catch (e) {
    res.status(500).json({ error: 'Ledger query failed' });
  }
});

// ── Music Drops — static file serve ─────────────────────────────────────────
app.use('/drops-media', express.static(DROPS_DIR, { maxAge: '7d' }));

// ── Music Drops — GET public feed ────────────────────────────────────────────
app.get('/api/music/drops', async (req, res) => {
  const genre = (req.query.genre || '').slice(0, 40);
  const limit = Math.min(parseInt(req.query.limit) || 24, 60);
  try {
    const where  = genre ? 'WHERE genre ILIKE $1' : '';
    const params = genre ? [`%${genre}%`, limit] : [limit];
    const idx    = genre ? 3 : 2;
    const rows   = await pool.query(
      `SELECT id, email, artist, title, genre, description,
              audio_file, video_file, cover_file,
              plays, likes, source, spaces_ready, published_at
         FROM music_drops
         ${where}
         ORDER BY published_at DESC
         LIMIT $${genre ? 2 : 1}`,
      params
    );
    const drops = rows.rows.map(d => ({
      ...d,
      audio_url: `/drops-media/audio/${d.audio_file}`,
      video_url: d.video_file ? `/drops-media/video/${d.video_file}` : null,
      cover_url: d.cover_file ? `/drops-media/cover/${d.cover_file}` : null,
    }));
    res.json({ drops });
  } catch (err) {
    console.error('[drops/GET]', err.message);
    res.json({ drops: [] });
  }
});

// ── Music Drops — POST publish ────────────────────────────────────────────────
app.post('/api/music/drops', requireOTET('music_drop_create:'),
  dropsUpload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  async (req, res) => {
    const { title, artist, genre = '', description = '', email, source = 'portal' } = req.body;
    if (!title || !email) return res.status(400).json({ error: 'title and email required' });

    const audioFile = req.files?.audio?.[0]?.filename;
    if (!audioFile) return res.status(400).json({ error: 'Audio file required' });

    const videoFile = req.files?.video?.[0]?.filename ?? null;
    const coverFile = req.files?.cover?.[0]?.filename ?? null;

    try {
      const r = await pool.query(
        `INSERT INTO music_drops (email, artist, title, genre, description, audio_file, video_file, cover_file, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, title, artist, published_at`,
        [email, artist || 'Artist', title, genre, description, audioFile, videoFile, coverFile, source]
      );
      const drop = r.rows[0];
      res.json({
        success: true,
        drop: {
          ...drop,
          audio_url: `/drops-media/audio/${audioFile}`,
          video_url: videoFile ? `/drops-media/video/${videoFile}` : null,
          cover_url: coverFile ? `/drops-media/cover/${coverFile}` : null,
        },
      });
    } catch (err) {
      console.error('[drops/POST]', err.message);
      res.status(500).json({ error: 'Publish failed' });
    }
  }
);

// ── Music Drops — POST increment play count ───────────────────────────────────
app.post('/api/music/drops/:id/play', async (req, res) => {
  await pool.query('UPDATE music_drops SET plays = plays + 1 WHERE id = $1', [req.params.id]).catch(() => {});
  res.json({ ok: true });
});

// ── Music Drops — POST mark spaces_ready (link portal drop → Spaces room) ────
app.post('/api/music/drops/:id/spaces', requireOTET('music_drop_spaces:'), async (req, res) => {
  await pool.query('UPDATE music_drops SET spaces_ready = TRUE WHERE id = $1', [req.params.id]).catch(() => {});
  res.json({ ok: true });
});

// ── $RHO Bond — POST /api/rho/sump ───────────────────────────────────────────
// Landing zone for the 5% recursion tax from the Omega Carrier (strike_rho_recursion tool).
// Logs sump to rho_buyback_queue. When queue total reaches RHO_SUMP_THRESHOLD µUSDC,
// triggers the Siphon Market Strike (Uniswap-v3 $RHO swap on Base L2 — Phase 2).
const RHO_SUMP_THRESHOLD = parseInt(process.env.RHO_SUMP_THRESHOLD || '50000', 10);

app.post('/api/rho/sump', requireAuth, async (req, res) => {
  const { node_id, task_id, sump } = req.body || {};
  const amount = parseInt(sump, 10);

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'sump must be a positive integer (micro-USDC)' });
  }

  try {
    // Step 1: Record in the buyback ledger
    const insert = await pool.query(
      `INSERT INTO rho_buyback_queue (node_id, task_id, amount, status)
       VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
      [node_id || null, task_id || null, amount]
    );
    const sump_id = insert.rows[0].id;

    console.log(`[RHO_SUMP] Ingesting 5% Recursion Tax: ${amount}µ from node=${node_id} task=${task_id} id=${sump_id}`);

    // Step 2: Check if threshold reached — trigger Siphon Market Strike
    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM rho_buyback_queue WHERE status = 'PENDING'`
    );
    const pendingTotal = parseInt(totalResult.rows[0].total, 10);

    let market_strike = null;
    if (pendingTotal >= RHO_SUMP_THRESHOLD) {
      // Phase 2: call Uniswap-v3 router on Base L2 to swap USDC → $RHO
      // For now: mark all PENDING as QUEUED_FOR_STRIKE and log — swap contract TBD
      await pool.query(
        `UPDATE rho_buyback_queue SET status = 'QUEUED_FOR_STRIKE' WHERE status = 'PENDING'`
      );
      market_strike = {
        triggered: true,
        pending_total_micro_usdc: pendingTotal,
        action: 'swap_for_rho',
        network: 'base_l2',
        note: 'Uniswap-v3 swap pending — Siphon contract address required to execute',
      };
      console.log(`[RHO_SUMP] THRESHOLD HIT: ${pendingTotal}µ queued for $RHO market strike`);
    }

    res.json({
      status: 'signaled',
      sump_id,
      amount_micro_usdc: amount,
      pending_queue_total: pendingTotal,
      market_strike,
      message: '$RHO buyback queued.',
    });
  } catch (err) {
    console.error('[RHO_SUMP]', err);
    res.status(500).json({ error: 'Sump ingestion failed' });
  }
});

// ── $RHO Bond — GET /api/rho/sump/status ─────────────────────────────────────
app.get('/api/rho/sump/status', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
       FROM rho_buyback_queue GROUP BY status ORDER BY status`
    );
    const pending = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM rho_buyback_queue WHERE status = 'PENDING'`
    );
    res.json({
      breakdown: result.rows,
      pending_micro_usdc: parseInt(pending.rows[0].total, 10),
      threshold_micro_usdc: RHO_SUMP_THRESHOLD,
      threshold_pct: Math.min(100, Math.round((parseInt(pending.rows[0].total, 10) / RHO_SUMP_THRESHOLD) * 100)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Status query failed' });
  }
});

// ── $RHO Bond — POST /api/rho/strike (Strike Valve) ──────────────────────────
// Privileged: sets PENDING rows to PROCESSING and logs a simulation strike.
// Phase 2: will trigger Uniswap-v3 swap on Base L2 via Sovereign Siphon Rust binary.
app.post('/api/rho/strike', async (req, res) => {
  const { admin_key } = req.body || {};
  const RHO_STRIKE_KEY = process.env.RHO_STRIKE_KEY || process.env.APEX_TOPUP_KEY;
  if (!admin_key || admin_key !== RHO_STRIKE_KEY) {
    return res.status(403).json({ error: 'Forbidden — invalid admin_key' });
  }

  try {
    // Snapshot current PENDING total before sweep
    const totalRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM rho_buyback_queue WHERE status = 'PENDING'`
    );
    const pending_total = parseInt(totalRes.rows[0].total, 10);

    if (pending_total < RHO_SUMP_THRESHOLD) {
      return res.status(400).json({
        error: 'Thermodynamic Starvation — threshold not reached',
        pending_total_micro_usdc: pending_total,
        threshold_micro_usdc: RHO_SUMP_THRESHOLD,
      });
    }

    // Move PENDING → PROCESSING
    await pool.query(
      `UPDATE rho_buyback_queue SET status = 'PROCESSING' WHERE status = 'PENDING'`
    );

    const tx_uuid = require('crypto').randomUUID();
    const strike_time = new Date().toISOString();

    // Simulation strike log — Phase 2: replace with Uniswap-v3 call
    console.log(`[RHO_STRIKE] TX_UUID=${tx_uuid} amount=${pending_total}µUSDC time=${strike_time} [SIMULATION]`);

    res.json({
      status: 'strike_executed',
      strike_id: tx_uuid,
      tx_uuid,
      swept_micro_usdc: pending_total,
      strike_time,
      note: 'Simulation strike. Phase 2: Uniswap-v3 Base L2 swap pending contract address.',
    });
  } catch (err) {
    console.error('[RHO_STRIKE] error:', err);
    res.status(500).json({ error: 'Strike execution failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ARTICLES — public read + admin write
// ─────────────────────────────────────────────────────────────────────────────

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function calcReadTime(html) {
  const text = html.replace(/<[^>]+>/g, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 238));
}

// GET /api/blog/articles — public feed (published only)
app.get('/api/blog/articles', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 20, 60);
    const offset = parseInt(req.query.offset) || 0;
    const tag    = req.query.tag || null;
    const featured = req.query.featured === 'true';

    let where = `WHERE status = 'published'`;
    const params = [];
    if (tag) { params.push(tag); where += ` AND $${params.length} = ANY(tags)`; }
    if (featured) where += ` AND featured = true`;

    const { rows } = await pool.query(
      `SELECT id, slug, title, subtitle, excerpt, cover_url, author_name, author_avatar,
              tags, featured, reading_time_mins, published_at, created_at
       FROM articles ${where}
       ORDER BY featured DESC, published_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const total = await pool.query(`SELECT COUNT(*) FROM articles ${where}`, params);
    res.json({ articles: rows, total: parseInt(total.rows[0].count), limit, offset });
  } catch (e) {
    console.error('[BLOG] list error:', e);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// GET /api/blog/articles/:slug — public single article
app.get('/api/blog/articles/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM articles WHERE slug = $1 AND status = 'published'`,
      [req.params.slug]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Article not found' });
    res.json({ article: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// GET /api/admin/blog/articles — admin list (all statuses)
app.get('/api/admin/blog/articles', requireAuth, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || null;

    let where = status ? `WHERE status = $1` : '';
    const params = status ? [status] : [];

    const { rows } = await pool.query(
      `SELECT id, slug, title, subtitle, excerpt, cover_url, author_name,
              tags, status, featured, reading_time_mins, published_at, created_at, updated_at
       FROM articles ${where}
       ORDER BY updated_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const total = await pool.query(`SELECT COUNT(*) FROM articles ${where}`, params);
    res.json({ articles: rows, total: parseInt(total.rows[0].count) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// POST /api/admin/blog/review — Vanguard content safety review before publish
// Body: { title, subtitle?, content, tags? }
// Returns: { approved, verdict, reason, suggestions? }
app.post('/api/admin/blog/review', requireAuth, async (req, res) => {
  const { title, subtitle, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });

  const VG_URL = process.env.SEI_VANGUARD_URL || 'http://20.127.220.199:3000';
  const VG_KEY = process.env.SEI_VANGUARD_KEY || 'sk-vanguard-apex-internal-v1';

  const systemPrompt = `You are the ExergyNet Content Guardian — a permissive safety reviewer for the ExergyNet Journal.

Your job: review articles before they are published to exergynet.org/journals. Approve the VAST MAJORITY of content. Be non-restrictive toward technical, business, educational, opinion, and industry commentary.

ONLY flag or reject for genuine harms:
- Hate speech, slurs, or targeted harassment of individuals
- Instructions for illegal activity (fraud, hacking, violence)
- Malware, phishing, or exploit code intended for attack
- Graphic or explicit sexual content
- Defamatory false statements presented as fact
- Commercial spam with no legitimate informational value

DO NOT flag for: strong opinions, criticism of companies or institutions, controversial but legal topics, technical security research, competitive commentary, blunt or provocative language, or anything a reasonable tech publication would print.

Respond ONLY with this exact JSON structure:
{
  "approved": true or false,
  "verdict": "approved" | "flagged" | "rejected",
  "reason": "one sentence explaining the decision",
  "suggestions": ["optional array of brief improvement suggestions, only if flagged"]
}

verdict meanings:
- "approved": safe to publish immediately
- "flagged": borderline concern — user should review before publishing
- "rejected": clear policy violation — do not publish without significant revision`;

  const userContent = `Title: ${title}
${subtitle ? `Subtitle: ${subtitle}\n` : ''}
Content:
${content.slice(0, 8000)}`;

  try {
    const upstream = await fetch(`${VG_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VG_KEY}` },
      body: JSON.stringify({
        model: 'vanguard-engine',
        stream: false,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok) {
      // Vanguard unavailable — auto-approve so publish is never blocked by infra outage
      console.warn(`[BLOG-REVIEW] Vanguard unavailable (${upstream.status}) — auto-approving`);
      return res.json({ approved: true, verdict: 'approved', reason: 'Vanguard unavailable — auto-approved.', auto_approved: true });
    }

    const data = await upstream.json();
    const raw  = data.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) {
      console.warn('[BLOG-REVIEW] Could not parse Vanguard JSON response — auto-approving');
      return res.json({ approved: true, verdict: 'approved', reason: 'Review parse error — auto-approved.', auto_approved: true });
    }

    const verdict = parsed.verdict || (parsed.approved === false ? 'flagged' : 'approved');
    const approved = verdict === 'approved';
    console.log(`[BLOG-REVIEW] title="${title.slice(0,40)}" verdict=${verdict} approved=${approved}`);
    res.json({
      approved,
      verdict,
      reason:      parsed.reason      || '',
      suggestions: parsed.suggestions || [],
    });
  } catch (err) {
    // Network error — auto-approve
    console.warn('[BLOG-REVIEW] Vanguard request failed — auto-approving:', err.message);
    res.json({ approved: true, verdict: 'approved', reason: 'Vanguard unreachable — auto-approved.', auto_approved: true });
  }
});

// POST /api/admin/blog/articles — create
app.post('/api/admin/blog/articles', requireAuth, async (req, res) => {
  try {
    const { title, subtitle, content = '', excerpt, cover_url, author_name = 'ExergyNet',
            author_avatar, tags = [], status = 'draft', featured = false } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

    let slug = slugify(title);
    // deduplicate slug
    const existing = await pool.query('SELECT id FROM articles WHERE slug LIKE $1', [`${slug}%`]);
    if (existing.rows.length) slug = `${slug}-${existing.rows.length + 1}`;

    const reading_time_mins = calcReadTime(content);
    const published_at = status === 'published' ? new Date().toISOString() : null;

    const { rows } = await pool.query(
      `INSERT INTO articles (slug, title, subtitle, content, excerpt, cover_url, author_name,
         author_avatar, tags, status, featured, reading_time_mins, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [slug, title.trim(), subtitle || null, content, excerpt || null, cover_url || null,
       author_name, author_avatar || null, tags, status, featured, reading_time_mins, published_at]
    );
    res.json({ article: rows[0] });
  } catch (e) {
    console.error('[BLOG] create error:', e);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// PUT /api/admin/blog/articles/:id — update
app.put('/api/admin/blog/articles/:id', requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Article not found' });

    const cur = existing[0];
    const { title, subtitle, content, excerpt, cover_url, author_name,
            author_avatar, tags, status, featured } = req.body || {};

    const newTitle   = title   ?? cur.title;
    const newContent = content ?? cur.content;
    const newStatus  = status  ?? cur.status;
    const published_at = newStatus === 'published' && cur.status !== 'published'
      ? new Date().toISOString() : cur.published_at;

    const { rows } = await pool.query(
      `UPDATE articles SET
         title=$2, subtitle=$3, content=$4, excerpt=$5, cover_url=$6,
         author_name=$7, author_avatar=$8, tags=$9, status=$10, featured=$11,
         reading_time_mins=$12, published_at=$13, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, newTitle, subtitle ?? cur.subtitle, newContent,
       excerpt ?? cur.excerpt, cover_url ?? cur.cover_url,
       author_name ?? cur.author_name, author_avatar ?? cur.author_avatar,
       tags ?? cur.tags, newStatus, featured ?? cur.featured,
       calcReadTime(newContent), published_at]
    );
    res.json({ article: rows[0] });
  } catch (e) {
    console.error('[BLOG] update error:', e);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// DELETE /api/admin/blog/articles/:id
app.delete('/api/admin/blog/articles/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM articles WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Article not found' });
    res.json({ deleted: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// POST /api/admin/blog/upload-cover — cover image upload
app.post('/api/admin/blog/upload-cover', requireAuth, dropsUpload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext  = req.file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const name = `cover_${Date.now()}.${ext}`;
    const dest = `/home/ubuntu/downloads/covers/${name}`;
    require('fs').mkdirSync('/home/ubuntu/downloads/covers', { recursive: true });
    require('fs').renameSync(req.file.path, dest);
    res.json({ url: `/downloads/covers/${name}` });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── LNES-12 Private Session Lock ──────────────────────────────────────────────
// POST /api/v1/mesh/call/pair/:nodeA/:nodeB
// Acquires an exclusive session lock for a sorted node pair before LiveKit join.
// Prevents a third node from stealing the deterministic room name.
// Lock auto-expires after 10 minutes.
const _callSessions = new Map(); // key: sorted pair string → { room, lockedAt }
const CALL_LOCK_TTL_MS = 10 * 60 * 1000;

function _pairKey(a, b) {
  return [a, b].sort().join('_');
}
function _gcCallSessions() {
  const now = Date.now();
  for (const [k, v] of _callSessions) {
    if (now - v.lockedAt > CALL_LOCK_TTL_MS) _callSessions.delete(k);
  }
}

app.post('/v1/mesh/call/pair/:nodeA/:nodeB', (req, res) => {
  _gcCallSessions();
  const key  = _pairKey(req.params.nodeA, req.params.nodeB);
  const room = 'call_' + key;
  const existing = _callSessions.get(key);
  if (existing && Date.now() - existing.lockedAt < CALL_LOCK_TTL_MS) {
    return res.status(409).json({ locked: false, reason: 'session_in_progress', room });
  }
  _callSessions.set(key, { room, lockedAt: Date.now() });
  console.log(`[MESH-LOCK] acquired: ${key}`);
  res.json({ locked: true, room });
});

app.delete('/v1/mesh/call/pair/:nodeA/:nodeB', (req, res) => {
  const key = _pairKey(req.params.nodeA, req.params.nodeB);
  _callSessions.delete(key);
  console.log(`[MESH-LOCK] released: ${key}`);
  res.json({ released: true });
});

// ── LNES-KRV: Kinetic Rebuild Valve ──────────────────────────────────────────
// Vanguard Agent posts here to trigger portal rebuild + pm2 restart without SSH.
// Auth: Ed25519 signature over JSON body using VANGUARD_PUBLIC_KEY env var.
// Uses Node built-in crypto (no new deps) — Ed25519 available since Node 15.
app.post('/api/admin/build/rebuild', async (req, res) => {
  if (!process.env.VANGUARD_PUBLIC_KEY) {
    return res.status(503).json({ error: 'VANGUARD_PUBLIC_KEY not configured on this server.' });
  }
  const signature = req.headers['x-vanguard-sig'];
  if (!signature) return res.status(401).json({ error: 'Missing x-vanguard-sig header.' });
  try {
    const body = JSON.stringify(req.body);
    const pubKeyDer = Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'), // Ed25519 SubjectPublicKeyInfo prefix
      Buffer.from(process.env.VANGUARD_PUBLIC_KEY, 'hex'),
    ]);
    const pubKey = crypto.createPublicKey({ key: pubKeyDer, format: 'der', type: 'spki' });
    const isValid = crypto.verify(null, Buffer.from(body), pubKey, Buffer.from(signature, 'hex'));
    if (!isValid) return res.status(403).json({ error: 'Sovereign Signature Invalid.' });
  } catch (e) {
    return res.status(400).json({ error: 'Signature verification failed: ' + e.message });
  }

  const target = (req.body && req.body.target) || 'portal';
  const LOG = '/home/ubuntu/krv_build.log';
  const TARGETS = {
    portal: `echo "[KRV] $(date) starting portal build" > ${LOG} && cd /home/ubuntu/exergynet-portal && npm run build >> ${LOG} 2>&1 && echo "[KRV] build ok, restarting portal" >> ${LOG} && pm2 restart exergynet-portal >> ${LOG} 2>&1 && echo "[KRV] done" >> ${LOG}`,
    proxy:  `echo "[KRV] $(date) restarting proxy" > ${LOG} && pm2 restart biological_proxy`,
    both:   `echo "[KRV] $(date) starting portal build" > ${LOG} && cd /home/ubuntu/exergynet-portal && npm run build >> ${LOG} 2>&1 && echo "[KRV] build ok, restarting portal" >> ${LOG} && pm2 restart exergynet-portal >> ${LOG} 2>&1 && pm2 restart biological_proxy`,
  };
  const cmd = TARGETS[target];
  if (!cmd) return res.status(400).json({ error: `Unknown target "${target}". Valid: portal, proxy, both.` });

  res.json({ status: 'Strike Accepted. Rebuild Initialized.', target });

  const { exec } = require('child_process');
  exec(cmd, { timeout: 300000, shell: '/bin/bash' }, (error, stdout, stderr) => {
    if (error) {
      fs.appendFileSync(LOG, `\n[KRV_FAIL] ${error.message}\n${stderr}\n`);
      console.error(`[KRV_FAIL] target=${target} error=${error.message}`);
    } else {
      console.log(`[KRV_SUCCESS] target=${target}`);
    }
  });
});

// GET /api/admin/build/build-log — read last KRV build log
app.get('/api/admin/build/build-log', requireAdmin('super_admin', 'ops'), (req, res) => {
  const LOG = '/home/ubuntu/krv_build.log';
  try {
    const content = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : '(no log yet)';
    res.json({ log: content, path: LOG });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, '127.0.0.1', () =>
      console.log(`[biological_proxy] listening on 127.0.0.1:${PORT}`)
    );
  })
  .catch(err => {
    console.error('[DB init failed]', err);
    process.exit(1);
  });
