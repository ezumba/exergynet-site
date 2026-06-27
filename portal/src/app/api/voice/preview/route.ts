import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const PIPER_TTS_URL = process.env.PIPER_TTS_URL ?? 'http://127.0.0.1:5020/tts';

// Short, distinct preview phrases per voice identity
const VOICE_PREVIEWS: Record<string, string> = {
  'sovereign-meridian': 'Meridian speaking. Deep, resonant, commanding.',
  'sovereign-atlas':    'Atlas here. Authoritative broadcast voice.',
  'sovereign-lyra':     'Hi, I\'m Lyra. Warm, intimate, conversational.',
  'sovereign-nova':     'Nova here! Bright, expressive, energetic.',
  'sovereign-cipher':   'Cipher. Neutral. Clinical. Precise.',
  'sovereign-kael':     'Kael speaking. Smooth narrative storytelling.',
};

// Server-side in-memory cache so previews are generated once per server lifetime
const previewCache = new Map<string, string>();

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get('voiceId') ?? 'sovereign-meridian';

  const phrase = VOICE_PREVIEWS[voiceId] ?? 'Hello from ExergyNet Voice Studio.';

  // Return cached preview if available
  const cached = previewCache.get(voiceId);
  if (cached) {
    return NextResponse.json({ success: true, audioUrl: cached });
  }

  try {
    const ttsRes = await fetch(PIPER_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: phrase, voice_id: voiceId }),
      signal: AbortSignal.timeout(30000),
    });

    if (!ttsRes.ok) {
      return NextResponse.json({ error: 'Preview unavailable' }, { status: 502 });
    }

    const result = await ttsRes.json();
    const audioUrl = result.audioUrl ?? result.audio_url ?? '';
    if (audioUrl) previewCache.set(voiceId, audioUrl);

    return NextResponse.json({ success: true, audioUrl });
  } catch {
    return NextResponse.json({ error: 'Preview unavailable' }, { status: 502 });
  }
}
