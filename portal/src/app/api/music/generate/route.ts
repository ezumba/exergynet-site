import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getCredits, deductCredits } from '@/lib/voice_credits';
import { orchestrate } from '@/lib/music_orchestrator';
import type { MusicIntent } from '@/types/edl';

const MUSIC_COST = 500;

function parsePromptToIntent(prompt: string): MusicIntent {
  const lower = prompt.toLowerCase();

  const bpmMatch = lower.match(/(\d+)\s*bpm/);
  const bpm = bpmMatch ? parseInt(bpmMatch[1]) : undefined;

  const keyMatch = prompt.match(/in\s+([A-G][#b]?\s+(?:major|minor))/i);
  const key = keyMatch?.[1];

  const genreMap: Record<string, string> = {
    afrobeat: 'afrobeat', afro: 'afrobeat',
    jazz: 'jazz', swing: 'jazz',
    cinematic: 'cinematic', film: 'cinematic', orchestral: 'cinematic',
    lofi: 'lofi', 'lo-fi': 'lofi', 'lo fi': 'lofi', chillhop: 'lofi',
    trap: 'electronic', electronic: 'electronic', techno: 'electronic',
    synthwave: 'electronic', house: 'electronic', edm: 'electronic',
    cyberpunk: 'electronic',
  };
  const genre = Object.keys(genreMap).find(k => lower.includes(k))
    ? genreMap[Object.keys(genreMap).find(k => lower.includes(k))!]
    : 'electronic';

  const moodMap: [string, string][] = [
    ['dark', 'dark'], ['moody', 'dark'], ['sinister', 'dark'],
    ['bright', 'bright'], ['uplifting', 'bright'], ['happy', 'bright'],
    ['ethereal', 'ethereal'], ['dreamy', 'ethereal'],
    ['aggressive', 'aggressive'], ['intense', 'aggressive'], ['hard', 'aggressive'],
    ['calm', 'calm'], ['relaxed', 'calm'], ['peaceful', 'calm'],
    ['euphoric', 'euphoric'], ['euphoria', 'euphoric'],
    ['melancholic', 'melancholic'], ['sad', 'melancholic'],
  ];
  const moodEntry = moodMap.find(([k]) => lower.includes(k));
  const mood = moodEntry?.[1] ?? 'dark';

  const energyMap: [string, string][] = [
    ['explosive', 'explosive'], ['driving', 'driving'], ['energetic', 'driving'],
    ['calm', 'intimate'], ['soft', 'intimate'], ['whisper', 'whisper'],
    ['fading', 'fading'],
  ];
  const energyEntry = energyMap.find(([k]) => lower.includes(k));
  const energy = energyEntry?.[1] ?? 'driving';

  return {
    genre,
    mood,
    energy,
    bpm,
    key,
    title: prompt.slice(0, 60),
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.email;
  if (getCredits(userId) < MUSIC_COST) {
    return NextResponse.json(
      { error: 'Insufficient Exergy Credits. Top up in Billing.', balance: getCredits(userId) },
      { status: 402 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { prompt } = body;
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const intent = parsePromptToIntent(prompt);
  const script = orchestrate(intent);

  deductCredits(userId, MUSIC_COST);
  const newBalance = getCredits(userId);

  return NextResponse.json({
    success: true,
    script,
    bpm: script.bpm,
    title: script.title,
    cost: MUSIC_COST,
    newBalance,
  });
}
