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
app.use(express.json());

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
  `);
  console.log('[DB] Tables ready');
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
    const dev   = result.rows[0];
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
// ADMIN PANEL — Authenticated with dedicated ADMIN_JWT_SECRET, role-based
// Roles: super_admin | ops | support
// ══════════════════════════════════════════════════════════════════════════════

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin-secret-CHANGE-IN-PROD';

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
app.put('/api/admin/developers/:id/active', requireAdmin('super_admin', 'support'), async (req, res) => {
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
app.post('/api/admin/developers/:id/credit', requireAdmin('super_admin'), async (req, res) => {
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
  const vanguardUrl = process.env.SEI_VANGUARD_URL || 'http://localhost:3000';
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
app.delete('/api/admin/keys/:id', requireAdmin('super_admin'), async (req, res) => {
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

app.post('/api/admin/apps/approve', requireAdmin('super_admin','ops'), async (req, res) => {
  const appKey = String((req.body && req.body.app_key) || '');
  if (!appKey) return res.status(400).json({ error: 'app_key required' });
  try {
    const r = await pool.query("UPDATE app_catalog SET active=TRUE, review_status='active' WHERE app_key=$1 RETURNING app_key, active, review_status", [appKey]);
    if (!r.rows.length) return res.status(404).json({ error: 'app not found' });
    emitWebhookForApp(appKey, 'app.approved', { approved_by: req.adminRole });
    res.json({ status: 'approved', app: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/apps/reject', requireAdmin('super_admin','ops'), async (req, res) => {
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

app.post('/api/admin/apps/rescan', requireAdmin('super_admin','ops'), async (req, res) => {
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
app.post('/api/music/drops',
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
app.post('/api/music/drops/:id/spaces', async (req, res) => {
  await pool.query('UPDATE music_drops SET spaces_ready = TRUE WHERE id = $1', [req.params.id]).catch(() => {});
  res.json({ ok: true });
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
