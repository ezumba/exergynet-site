import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { readFileSync, writeFileSync } from 'fs';

const PROFILES_FILE = '/home/ubuntu/sovereign-tts/custom_profiles.json';

function loadProfiles(): Record<string, any> {
  try { return JSON.parse(readFileSync(PROFILES_FILE, 'utf8')); }
  catch { return {}; }
}

function saveProfiles(p: Record<string, any>) {
  writeFileSync(PROFILES_FILE, JSON.stringify(p, null, 2));
}

// GET — list all published community voices (from all users)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const myId = (session.user as any).id ?? session.user.email ?? '';
  const profiles = loadProfiles();

  const community = Object.entries(profiles)
    .filter(([, v]: [string, any]) => v.published === true && v.userId !== myId)
    .map(([id, v]: [string, any]) => ({
      id,
      displayName: v.displayName || id,
      creatorEmail: v.userId,
      pricePerUse: v.pricePerUse ?? 5,
      publishedAt: v.publishedAt,
      pitch: v.pitch,
      baseModel: v.model,
      uses: v.uses ?? 0,
    }));

  return NextResponse.json({ voices: community });
}

// POST — publish or unpublish own voice; update pricing
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const myId = (session.user as any).id ?? session.user.email ?? '';
  const { voiceId, published, pricePerUse } = await req.json();

  if (!voiceId) return NextResponse.json({ error: 'voiceId required' }, { status: 400 });

  const profiles = loadProfiles();
  const voice = profiles[voiceId];

  if (!voice) return NextResponse.json({ error: 'Voice not found' }, { status: 404 });
  if (voice.userId !== myId) return NextResponse.json({ error: 'Not your voice' }, { status: 403 });

  profiles[voiceId] = {
    ...voice,
    published: published ?? true,
    pricePerUse: Math.max(1, Math.min(500, pricePerUse ?? voice.pricePerUse ?? 5)),
    publishedAt: voice.publishedAt ?? new Date().toISOString(),
  };

  saveProfiles(profiles);
  return NextResponse.json({ success: true, voiceId, published: profiles[voiceId].published, pricePerUse: profiles[voiceId].pricePerUse });
}
