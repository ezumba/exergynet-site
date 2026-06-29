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
const LK_API_SECRET = process.env.LIVEKIT_API_SECRET || 'LNES06RHObridgeSecret2026exergynetSFU';

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
app.use(cors({
  origin: ['https://portal.exergynet.org', 'https://dt.portal.exergynet.org', 'http://localhost:4000', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// ── PostgreSQL pool ────────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.PGHOST     || 'localhost',
  port:     parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'biological_proxy',
  user:     process.env.PGUSER     || 'ubuntu',
  password: process.env.PGPASSWORD || undefined,
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
  `);
  console.log('[DB] Tables ready');
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

// ── GET /space/guest-token — anonymous listener token for public Spaces ───────
// No auth. Issues a canPublish:false LiveKit JWT so any browser can listen in.
// Rate-limiting should be added before mainnet; this is intentionally open for ghost-mode.
app.get('/space/guest-token', async (req, res) => {
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
      'SELECT email, display_name, usdc_micro_balance FROM biological_developers WHERE id = $1',
      [req.developerId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    const { email, display_name, usdc_micro_balance } = result.rows[0];
    res.json({ id: req.developerId, email, name: display_name, balance: usdc_micro_balance });
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
  const { node_id } = req.body || {};
  if (!node_id || typeof node_id !== 'string' || node_id.length !== 16) {
    return res.status(400).json({ error: 'node_id must be a 16-character string' });
  }
  try {
    // Check if node_id belongs to a different account already
    const existing = await pool.query(
      `SELECT id FROM biological_developers WHERE node_id = $1 AND id != $2`,
      [node_id, req.developerId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Node already linked to a different account' });
    }
    await pool.query(
      `UPDATE biological_developers SET node_id = $1 WHERE id = $2`,
      [node_id, req.developerId]
    );
    // Credit $10 (10,000,000 µUSDC) to the L0 miners ledger for every new node link.
    // Fire-and-forget — don't block the response on Apex availability.
    creditApexMiner(node_id, 10_000_000);
    res.json({ ok: true, node_id });
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
    const devRow = await pool.query(`SELECT node_id FROM biological_developers WHERE id = $1`, [req.developerId]);
    const nodeId = devRow.rows[0]?.node_id;
    if (nodeId) creditApexMiner(nodeId, onChainMicro);
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

  // API key path (sk-exergy-*)
  if (raw.startsWith('sk-exergy-')) {
    try {
      const prefix = raw.slice(0, 18);
      const devs = await pool.query(
        `SELECT id, api_key_hash, active FROM biological_developers WHERE api_key_preview LIKE $1`,
        [prefix + '%']
      );
      let dev = null;
      for (const row of devs.rows) { if (await bcrypt.compare(raw, row.api_key_hash)) { dev = row; break; } }
      if (!dev) return res.status(401).json({ error: 'Invalid API key' });
      if (!dev.active) return res.status(403).json({ error: 'Account inactive' });
    } catch (err) {
      console.error('[v1/chat auth]', err);
      return res.status(500).json({ error: 'Auth check failed' });
    }
  } else {
    // JWT path (dt-token or portal session JWT)
    try {
      jwt.verify(raw, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // Proxy to real Vanguard LLM
  const VG_URL = process.env.SEI_VANGUARD_URL || 'http://20.127.220.199:3000';
  const VG_KEY = process.env.SEI_VANGUARD_KEY || 'sk-vanguard-apex-internal-v1';

  const isStreaming   = req.body?.stream === true;
  const isJsonObject  = req.body?.response_format?.type === 'json_object';
  const isClinical    = req.body?.domain === 'clinical' || req.headers['x-vanguard-domain'] === 'clinical';

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
        const raw = data.choices?.[0]?.message?.content ?? '';
        const normalized = normalizeExtractionResponse(raw);
        try {
          JSON.parse(normalized); // validate
          if (data.choices?.[0]?.message) {
            data.choices[0].message.content = normalized;
          }
        } catch {
          console.error('[v1/chat proxy] json_object normalizer failed to produce valid JSON. raw:', raw.slice(0, 200));
          return res.status(502).json({ error: 'Model returned non-JSON response for json_object request' });
        }
      }
      return res.json(data);
    }

    // Streaming path: pass through as SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(dec.decode(value, { stream: true }));
    }
    res.end();
  } catch (e) {
    console.error('[v1/chat proxy]', e.message);
    if (!res.headersSent) res.status(503).json({ error: 'Vanguard unreachable' });
    else res.end();
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

// ── Start ─────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// ADMIN PANEL
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
app.get('/api/admin/build/witness-file', requireAdmin('super_admin', 'ops'), async (req, res) => {
  const file_path = req.query.path;
  if (!file_path) return res.status(400).json({ error: 'path query param required' });

  // Whitelist: resolve() first to collapse traversal sequences, then check roots
  const nodePath = require('path');
  const ALLOWED_ROOTS = [
    '/home/ubuntu/biological_proxy/',
    '/home/ubuntu/exergynet-portal/src/',
    '/home/ubuntu/omega_carrier/',
    '/home/ubuntu/sovereign-tts/',
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

  // Scope check: target_id must start with "agent_edit:"
  if (!rows[0].target_id.startsWith('agent_edit:')) {
    return res.status(403).json({ error: 'OTET not scoped for agent_edit. Reissue with target_id="agent_edit:<file>"' });
  }

  // Verify the file_path in body matches what was witnessed
  const witnessed_path = rows[0].target_id.replace('agent_edit:', '');
  if (witnessed_path !== file_path) {
    return res.status(403).json({ error: `OTET path mismatch. Witnessed: ${witnessed_path}, submitted: ${file_path}` });
  }

  await spendOTET(otet);
  const spent_at = new Date().toISOString();

  // If content provided — write it to the file (API-only write path, LNES-17)
  if (content !== undefined && content !== null) {
    const nodePath = require('path');
    const WRITE_ALLOWED_ROOTS = [
      '/home/ubuntu/biological_proxy/',
      '/home/ubuntu/exergynet-portal/src/',
      '/home/ubuntu/omega_carrier/',
      '/home/ubuntu/sovereign-tts/',
      '/home/ubuntu/exergynet-ledger/',
    ];
    const resolved = nodePath.resolve(file_path);
    const writeAllowed = WRITE_ALLOWED_ROOTS.some(r => resolved.startsWith(r));
    if (!writeAllowed) {
      return res.status(403).json({ error: 'Write path not in LNES-17 allowed roots.' });
    }
    // Verify pre_hash matches what was witnessed (bait-and-switch guard)
    // Uses content_hash (plain SHA256 of file content, no nonce) stored at issue-otet time.
    if (pre_hash && rows[0].content_hash) {
      if (pre_hash !== rows[0].content_hash) {
        return res.status(403).json({
          error: `PRE-HASH MISMATCH: witnessed content hash does not match submitted pre_hash. Bait-and-switch attempt blocked.`,
          expected: rows[0].content_hash.slice(0, 16) + '...',
          received: pre_hash.slice(0, 16) + '...',
        });
      }
    }

    try {
      fs.writeFileSync(resolved, content, 'utf8');
      console.log(`[AGENT-WRITE] File written via API | path=${resolved} | bytes=${Buffer.byteLength(content)}`);
    } catch (write_err) {
      return res.status(500).json({ error: 'File write failed: ' + write_err.message });
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

  res.json({ status: 'recorded', otet, file_path, spent_at, scribe_entry });
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
app.get('/api/admin/blog/articles', requireAdmin('super_admin', 'ops'), async (req, res) => {
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

// POST /api/admin/blog/articles — create
app.post('/api/admin/blog/articles', requireAdmin('super_admin', 'ops'), async (req, res) => {
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
app.put('/api/admin/blog/articles/:id', requireAdmin('super_admin', 'ops'), async (req, res) => {
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
app.delete('/api/admin/blog/articles/:id', requireAdmin('super_admin', 'ops'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM articles WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Article not found' });
    res.json({ deleted: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// POST /api/admin/blog/upload-cover — cover image upload
app.post('/api/admin/blog/upload-cover', requireAdmin('super_admin', 'ops'), dropsUpload.single('cover'), async (req, res) => {
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
