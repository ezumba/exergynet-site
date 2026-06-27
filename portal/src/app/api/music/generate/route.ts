import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getCredits, deductCredits } from '@/lib/voice_credits';

const VANGUARD_URL = process.env.SEI_VANGUARD_URL ?? 'http://127.0.0.1:5000';
const MUSIC_COST = 500;

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

  const { prompt, style, tempo, key } = body;
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const bpm = parseInt(tempo) || 90;
  const keyStr = key || 'C Minor';
  const styleStr = style || 'Lo-Fi';

  let trackData: unknown;
  try {
    const llmRes = await fetch(`${VANGUARD_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'vanguard-standard',
        response_format: { type: 'json_object' },
        stream: false,
        messages: [
          {
            role: 'system',
            content: `You are ExergyDSP v1.1 — a deterministic drum pattern engine.
Output ONLY a valid JSON object. No explanation. No markdown. No preamble. Start immediately with '{'.

Required output format:
{
  "title": string,
  "bpm": number,
  "key": string,
  "patterns": {
    "kick":    string,
    "snare":   string,
    "hihat":   string,
    "openHat": string
  },
  "swing": number,
  "humanize": { "timing": number, "velocity": number },
  "volume": number
}

RULES:
- Each pattern is exactly 16 characters. Use 'x' for hit, 'X' for accent, 'o' for ghost, '.' for rest.
- kick: 2-4 hits per bar. Typical: 'x...x...x...x...'
- snare: ALWAYS hit on beats 2 and 3 (positions 4 and 12). e.g. '....x.......x...'
- hihat: minimum 16 hits total across 16 steps. Dense patterns like 'xxxxxxxxxxxxxxxx' or 'x.x.x.x.x.x.x.x.'
- openHat: 0-4 hits, on off-beats. e.g. '...............x'
- swing: 0.0 to 0.3 (jazz = 0.25, lo-fi = 0.15, trap = 0.05)
- humanize.timing: 0.005 to 0.02
- humanize.velocity: 0.05 to 0.15
- volume: -6 to 0

Generate a dense, musical 4-bar groove. Reflect the genre in the pattern density and swing amount.`,
          },
          {
            role: 'user',
            content: `Compose a ${styleStr} groove: "${prompt}" | Key: ${keyStr} | BPM: ${bpm}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      return NextResponse.json({ error: err || 'Music generation failed' }, { status: 502 });
    }

    const llmData = await llmRes.json();
    const raw = llmData.choices?.[0]?.message?.content ?? '{}';
    const jsonStart = raw.indexOf('{');
    const cleaned = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
    const parsed = JSON.parse(cleaned);

    // Build SequencerTrack from LLM output
    trackData = {
      id: 'groove-1',
      name: parsed.title || `${styleStr} Groove`,
      patterns: {
        kick:    (parsed.patterns?.kick    ?? 'x...x...x...x...').padEnd(16, '.').slice(0, 16),
        snare:   (parsed.patterns?.snare   ?? '....x.......x...').padEnd(16, '.').slice(0, 16),
        hihat:   (parsed.patterns?.hihat   ?? 'x.x.x.x.x.x.x.x.').padEnd(16, '.').slice(0, 16),
        openHat: (parsed.patterns?.openHat ?? '................').padEnd(16, '.').slice(0, 16),
      },
      swing:    typeof parsed.swing === 'number' ? parsed.swing : 0.1,
      humanize: {
        timing:   typeof parsed.humanize?.timing   === 'number' ? parsed.humanize.timing   : 0.01,
        velocity: typeof parsed.humanize?.velocity === 'number' ? parsed.humanize.velocity : 0.08,
      },
      volume:   typeof parsed.volume === 'number' ? parsed.volume : 0,
      mute:     false,
    };
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Music generation failed' }, { status: 502 });
  }

  deductCredits(userId, MUSIC_COST);
  const newBalance = getCredits(userId);

  return NextResponse.json({
    success: true,
    track: trackData,
    bpm,
    title: (trackData as any).name,
    cost: MUSIC_COST,
    newBalance,
  });
}
