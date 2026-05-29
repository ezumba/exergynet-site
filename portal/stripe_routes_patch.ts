// ══════════════════════════════════════════════════════════════════════════════
// BACKEND ROUTES PATCH — Add to biological_proxy/src/index.ts
//
// Installation:
//   npm install stripe
//
// Required env vars:
//   STRIPE_SECRET_KEY          sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET      whsec_... (from Stripe dashboard)
//   PORTAL_URL                 https://exergynet.org  (no trailing slash)
//
// CRITICAL ORDERING: Register /webhook/stripe BEFORE app.use(express.json())
// so express.raw() captures the raw body Stripe needs for signature verification.
//
// Required DB migration (run once):
//   CREATE TABLE IF NOT EXISTS claimed_deposits (
//     tx_hash      TEXT PRIMARY KEY,
//     developer_id TEXT NOT NULL,
//     credited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );
//   CREATE INDEX IF NOT EXISTS idx_claimed_deposits_developer
//     ON claimed_deposits (developer_id);
// ══════════════════════════════════════════════════════════════════════════════

// ── Add to imports at top of index.ts ─────────────────────────────────────────
// import Stripe from 'stripe';

// ── Stripe singleton (module-level, NOT per-request) ──────────────────────────
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
//   apiVersion: '2024-04-10',
// });

// ─────────────────────────────────────────────────────────────────────────────
// Paste the routes below into index.ts IN THIS ORDER:
//
//   1. /webhook/stripe   ← MUST be before app.use(express.json())
//   2. app.use(express.json())
//   3. /api/deposit/claim
//   4. /api/create-checkout-session
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /webhook/stripe ───────────────────────────────────────────────────────
// Stripe sends checkout.session.completed here.
// Configure endpoint in Stripe dashboard → Webhooks → Add endpoint:
//   URL: https://your-proxy-domain/webhook/stripe
//   Events: checkout.session.completed
//
// MUST be registered BEFORE app.use(express.json()) — express.raw() here
// is incompatible with a prior global JSON body parser.

app.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
    } catch (err: any) {
      console.error('[STRIPE] Webhook signature verification failed:', err.message);
      res.status(400).json({ error: `Webhook error: ${err.message}` });
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { developer_id, usdc_amount_micro } = session.metadata ?? {};

      if (!developer_id || !usdc_amount_micro) {
        console.warn('[STRIPE] Missing metadata in session:', session.id);
        res.json({ received: true });
        return;
      }

      const microAmount = parseInt(usdc_amount_micro, 10);
      if (isNaN(microAmount) || microAmount <= 0) {
        console.warn('[STRIPE] Invalid usdc_amount_micro:', usdc_amount_micro);
        res.json({ received: true });
        return;
      }

      try {
        const result = await pool.query<{ email: string; usdc_micro_balance: number }>(
          `UPDATE biological_developers
           SET usdc_micro_balance = usdc_micro_balance + $1, active = true
           WHERE id = $2
           RETURNING email, usdc_micro_balance`,
          [microAmount, developer_id]
        );

        if (result.rows.length > 0) {
          const dev = result.rows[0];
          console.log(
            `[STRIPE] Credited ${dev.email}` +
            ` +$${(microAmount / 1_000_000).toFixed(2)} USDC` +
            ` | session: ${session.id}` +
            ` | balance: $${(dev.usdc_micro_balance / 1_000_000).toFixed(4)}`
          );
        } else {
          console.warn('[STRIPE] Developer not found:', developer_id);
        }
      } catch (err: any) {
        console.error('[STRIPE] Credit error:', err.message);
        // Return 200 — Stripe will not retry. Log and investigate manually.
      }
    }

    res.json({ received: true });
  }
);

// ── app.use(express.json()) goes HERE (after /webhook/stripe) ─────────────────

// ── POST /api/deposit/claim ───────────────────────────────────────────────────
// JWT-authenticated. Verifies a Base Sepolia USDC transfer on-chain via RPC,
// deduplicates by tx_hash, then credits the developer's USDC balance.
// Called by the billing page after useWaitForTransactionReceipt confirms.

const BASE_SEPOLIA_RPC   = 'https://sepolia.base.org';
const USDC_CONTRACT      = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const OPERATOR_WALLET    = '0xbd1e790f6040FA62797671B84a50025a0133109C';
// keccak256("Transfer(address,address,uint256)")
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

app.post('/api/deposit/claim', authenticate, async (req: AuthedRequest, res: Response): Promise<void> => {
  const { tx_hash, usdc_amount_micro } = req.body ?? {};
  const developerId = req.developer!.id;

  // ── Input validation ───────────────────────────────────────────────────────
  if (!tx_hash || typeof tx_hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(tx_hash)) {
    res.status(400).json({ error: 'invalid tx_hash' });
    return;
  }
  if (!usdc_amount_micro || typeof usdc_amount_micro !== 'number' || usdc_amount_micro <= 0) {
    res.status(400).json({ error: 'invalid usdc_amount_micro' });
    return;
  }

  // ── Deduplication check ────────────────────────────────────────────────────
  const existing = await pool.query(
    'SELECT developer_id FROM claimed_deposits WHERE tx_hash = $1',
    [tx_hash]
  );
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'tx_hash already claimed' });
    return;
  }

  // ── On-chain verification via JSON-RPC ────────────────────────────────────
  let receipt: any;
  try {
    const rpcRes = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [tx_hash],
      }),
    });
    const rpcJson: { result: any; error?: any } = await rpcRes.json();

    if (rpcJson.error) throw new Error(rpcJson.error.message ?? 'RPC error');
    receipt = rpcJson.result;
  } catch (err: any) {
    console.error('[DEPOSIT] RPC error:', err.message);
    res.status(502).json({ error: 'Failed to query Base Sepolia RPC' });
    return;
  }

  if (!receipt) {
    res.status(400).json({ error: 'Transaction not found or still pending' });
    return;
  }
  if (receipt.status !== '0x1') {
    res.status(400).json({ error: 'Transaction reverted on-chain' });
    return;
  }

  // ── Find matching ERC-20 Transfer log ─────────────────────────────────────
  // Log structure: topics[0] = Transfer sig, topics[1] = from (padded), topics[2] = to (padded)
  // data = amount as uint256 (hex, 32 bytes)
  const operatorPadded = OPERATOR_WALLET.slice(2).toLowerCase().padStart(64, '0');

  const transferLog = (receipt.logs ?? []).find((log: any) =>
    log.address?.toLowerCase() === USDC_CONTRACT.toLowerCase() &&
    log.topics?.[0] === ERC20_TRANSFER_TOPIC &&
    log.topics?.[2]?.toLowerCase() === `0x${operatorPadded}`
  );

  if (!transferLog) {
    res.status(400).json({
      error: 'No USDC transfer to operator wallet found in transaction logs',
    });
    return;
  }

  // ── Parse on-chain amount ──────────────────────────────────────────────────
  const onChainMicro = parseInt(transferLog.data, 16);
  if (isNaN(onChainMicro) || onChainMicro <= 0) {
    res.status(400).json({ error: 'Could not parse transfer amount from log' });
    return;
  }

  // Allow 1 micro tolerance for rounding edge cases
  if (Math.abs(onChainMicro - usdc_amount_micro) > 1) {
    res.status(400).json({
      error: `Amount mismatch: on-chain=${onChainMicro} micro, claimed=${usdc_amount_micro} micro`,
    });
    return;
  }

  // ── Atomic credit + dedup insert ──────────────────────────────────────────
  try {
    await pool.query('BEGIN');

    await pool.query(
      'INSERT INTO claimed_deposits (tx_hash, developer_id) VALUES ($1, $2)',
      [tx_hash, developerId]
    );

    const result = await pool.query<{ email: string; usdc_micro_balance: number }>(
      `UPDATE biological_developers
       SET usdc_micro_balance = usdc_micro_balance + $1, active = true
       WHERE id = $2
       RETURNING email, usdc_micro_balance`,
      [onChainMicro, developerId]
    );

    await pool.query('COMMIT');

    const dev = result.rows[0];
    console.log(
      `[DEPOSIT] Credited ${dev.email}` +
      ` +$${(onChainMicro / 1_000_000).toFixed(4)} USDC` +
      ` | tx: ${tx_hash}` +
      ` | balance: $${(dev.usdc_micro_balance / 1_000_000).toFixed(4)}`
    );

    res.json({
      ok: true,
      credited_micro: onChainMicro,
      new_balance_micro: dev.usdc_micro_balance,
    });
  } catch (err: any) {
    await pool.query('ROLLBACK');
    if (err.code === '23505') {
      // Race condition: another request claimed same tx_hash between our check and insert
      res.status(409).json({ error: 'tx_hash already claimed (race condition)' });
    } else {
      console.error('[DEPOSIT] Credit error:', err.message);
      res.status(500).json({ error: 'Credit failed' });
    }
  }
});

// ── POST /api/create-checkout-session ─────────────────────────────────────────
// Called by billing page to redirect user to Stripe checkout.
// auth: Bearer JWT (portal session token)

app.post('/api/create-checkout-session', authenticate, async (req: AuthedRequest, res: Response): Promise<void> => {
  const { amount_usd } = req.body ?? {};

  if (!amount_usd || typeof amount_usd !== 'number' || amount_usd < 5) {
    res.status(400).json({ error: 'amount_usd must be a number >= 5' });
    return;
  }

  const portalUrl = (process.env.PORTAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const amountCents = Math.round(amount_usd * 100);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: 'ExergyNet Compute Credits',
              description:
                `$${amount_usd.toFixed(2)} USDC internal compute credit` +
                ` — ${Math.floor(amount_usd / 0.0004).toLocaleString()} tokens`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        developer_id:       req.developer!.id,
        email:              req.developer!.email,
        usdc_amount_micro:  String(Math.round(amount_usd * 1_000_000)),
      },
      success_url: `${portalUrl}/dashboard/billing?stripe=success`,
      cancel_url:  `${portalUrl}/dashboard/billing?stripe=cancelled`,
    });

    console.log(
      `[STRIPE] Checkout session ${session.id}` +
      ` for ${req.developer!.email} | $${amount_usd}`
    );
    res.json({ url: session.url, session_id: session.id });
  } catch (err: any) {
    console.error('[STRIPE] Checkout session error:', err.message);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
});
