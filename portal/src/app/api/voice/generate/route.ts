import { NextRequest, NextResponse } from 'next/server';
import { getCredits, deductCredits } from '@/lib/voice_credits';
import { resolveUser } from '@/lib/apiAuth';

const PIPER_TTS_URL = process.env.PIPER_TTS_URL ?? 'http://127.0.0.1:5020/tts';

export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.email;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { text, voice_id, model, settings } = body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const charCount = text.length;
  const currentBalance = getCredits(userId);

  if (currentBalance < charCount) {
    return NextResponse.json(
      { error: 'Insufficient Exergy Credits. Top up in Billing.', balance: currentBalance },
      { status: 402 }
    );
  }

  // Call Piper TTS service
  let audioUrl: string;
  let duration: number;
  try {
    const ttsRes = await fetch(PIPER_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: voice_id ?? 'sovereign-meridian', model, settings }),
      signal: AbortSignal.timeout(60000),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      return NextResponse.json({ error: err || 'TTS generation failed' }, { status: 502 });
    }

    const result = await ttsRes.json();
    audioUrl = result.audioUrl ?? result.audio_url ?? '';
    duration = result.duration ?? Math.ceil(charCount / 15);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'TTS service unavailable' }, { status: 502 });
  }

  // Deduct only after successful generation
  deductCredits(userId, charCount);
  const newBalance = getCredits(userId);

  return NextResponse.json({ success: true, audioUrl, duration, cost: charCount, newBalance });
}
