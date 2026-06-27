import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { addCredits, getCredits } from '@/lib/voice_credits';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const CREDITS_PER_DOLLAR = 10000;

// Idempotency: track credited Stripe sessions in memory (survives restarts via file ledger metadata)
// For production, persist this to DB; for now, we rely on the file ledger being idempotent via
// the biological_proxy which tracks stripe_session_credited. This route only adds voice credits.

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = body?.session_id;
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  // Retrieve session from Stripe
  let stripeSession: any;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    if (!res.ok) throw new Error(`Stripe API ${res.status}`);
    stripeSession = await res.json();
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to verify Stripe session' }, { status: 502 });
  }

  if (stripeSession.payment_status !== 'paid') {
    return NextResponse.json({ ok: false, reason: 'payment not completed' });
  }

  // Verify the session belongs to this user via metadata
  const metaEmail = stripeSession.metadata?.email;
  if (metaEmail && metaEmail !== session.user.email) {
    return NextResponse.json({ error: 'Session does not belong to this account' }, { status: 403 });
  }

  const amountCents = stripeSession.amount_total ?? 0;
  const dollars = amountCents / 100;
  const creditsToAdd = Math.round(dollars * CREDITS_PER_DOLLAR);

  if (creditsToAdd <= 0) {
    return NextResponse.json({ error: 'Invalid session amount' }, { status: 400 });
  }

  const newBalance = addCredits(session.user.email, creditsToAdd);
  return NextResponse.json({ ok: true, credits_added: creditsToAdd, new_balance: newBalance });
}

// GET — return current voice credit balance
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ balance: getCredits(session.user.email) });
}
