require('dotenv').config({ path: __dirname + '/.env' });
'use strict';
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
  origin: ['https://portal.exergynet.org', 'http://localhost:4000', 'http://localhost:3000'],
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
    ALTER TABLE biological_developers ADD COLUMN IF NOT EXISTS profile_gallery     JSONB NOT NULL DEFAULT '[]'::jsonb;

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
      success_url: `${portalUrl}/dashboard/billing?stripe=success`,
      cancel_url:  `${portalUrl}/dashboard/billing?stripe=cancelled`,
    });
    console.log(`[STRIPE] checkout session ${session.id} for developer ${req.developerId} | $${amount_usd}`);
    res.json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error('[STRIPE] create-checkout-session error:', err.message);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
});

// ── POST /v1/chat/completions (SSE stub — validates API key) ──────────────────
app.post('/v1/chat/completions', async (req, res) => {
  const apiKey = req.headers['authorization']?.replace('Bearer ', '') || '';
  if (!apiKey.startsWith('sk-exergy-')) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }

  // Look up by preview prefix (first 18 chars of key are stored verbatim in preview)
  try {
    const prefix = apiKey.slice(0, 18);
    const devs   = await pool.query(
      `SELECT id, api_key_hash, active, usdc_micro_balance
         FROM biological_developers
        WHERE api_key_preview LIKE $1`,
      [prefix + '%']
    );

    let dev = null;
    for (const row of devs.rows) {
      if (await bcrypt.compare(apiKey, row.api_key_hash)) { dev = row; break; }
    }

    if (!dev) return res.status(401).json({ error: 'Invalid API key' });
    if (!dev.active) return res.status(403).json({ error: 'Account inactive — add USDC balance to activate' });
    if (Number(dev.usdc_micro_balance) <= 0) return res.status(402).json({ error: 'Insufficient balance' });
  } catch (err) {
    console.error('[v1/chat auth]', err);
    return res.status(500).json({ error: 'Auth check failed' });
  }

  const { stream, messages } = req.body || {};
  const prompt = messages?.[messages.length - 1]?.content ?? '';

  if (!stream) {
    return res.json({
      id:      'cmpl-' + crypto.randomBytes(8).toString('hex'),
      object:  'chat.completion',
      model:   'vanguard-engine',
      choices: [{ message: { role: 'assistant', content: 'Vanguard Engine — ' + prompt }, finish_reason: 'stop' }],
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const words = ('Vanguard Engine ZK response: ' + prompt).split(' ');
  for (const word of words) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: word + ' ' } }] })}\n\n`);
    await new Promise(r => setTimeout(r, 40));
  }
  res.write('data: [DONE]\n\n');
  res.end();
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

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'biological_proxy', ts: new Date().toISOString() })
);

// ── GET /api/apps/mine — developer's published apps ───────────────────────────
app.get('/api/apps/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT app_key, name, tier, price_micro, period, publisher_id, active,
              created_at, app_url, description, icon, usage_price_micro,
              review_status, category, tags, icon_url, featured
       FROM app_catalog WHERE publisher_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
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
       req.user.id, app_url || null, description || null, category || null,
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

// ── Start ─────────────────────────────────────────────────────────────────────
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
