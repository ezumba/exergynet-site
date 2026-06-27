import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { addCredits } from '@/lib/voice_credits';

// Called after a verified Web3 USDC deposit. The claim verification happens
// in biological_proxy (/api/deposit/claim) before this is called, so the
// on-chain verification is already done. This just syncs the voice ledger.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const credits = body?.credits;
  if (!credits || typeof credits !== 'number' || credits <= 0 || credits > 10_000_000) {
    return NextResponse.json({ error: 'invalid credits amount' }, { status: 400 });
  }

  const newBalance = addCredits(session.user.email, credits);
  return NextResponse.json({ ok: true, new_balance: newBalance });
}
