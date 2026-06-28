import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// Call Vanguard upstream directly — bypasses biological_proxy auth check for server-to-server calls
const PROXY = process.env.SEI_VANGUARD_URL ?? process.env.VANGUARD_INTERNAL_URL ?? 'http://20.127.220.199:3000';
const VG_KEY = process.env.SEI_VANGUARD_KEY ?? 'sk-vanguard-apex-internal-v1';

const LYRIC_SYSTEM = `You are a professional songwriter and lyricist. The user gives you a song concept or summary. You write complete, polished song lyrics with the following structure:

[Verse 1]
4–8 lines

[Pre-Chorus] (optional)
2–4 lines

[Chorus]
4–6 lines — the hook, most memorable

[Verse 2]
4–8 lines (new perspective, same theme)

[Pre-Chorus] (optional)

[Chorus]

[Bridge]
4–6 lines — emotional peak or contrast

[Chorus]
[Outro] (optional)

Rules:
- Match the style/genre given (e.g. trap, afrobeat, R&B, pop, soulful)
- Use vivid imagery, not clichés
- Rhyme scheme should feel natural, not forced
- Write ONLY the lyrics — no explanations, no commentary
- Use the section labels in brackets exactly as shown above`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { summary, style } = await req.json().catch(() => ({ summary: '', style: '' }));
  if (!summary?.trim()) {
    return NextResponse.json({ error: 'summary is required' }, { status: 400 });
  }

  const userPrompt = style?.trim()
    ? `Genre/style: ${style.trim()}\n\nConcept: ${summary.trim()}`
    : `Concept: ${summary.trim()}`;

  try {
    const res = await fetch(`${PROXY}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VG_KEY}` },
      body: JSON.stringify({
        model: 'vanguard-engine',
        messages: [
          { role: 'system', content: LYRIC_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1200,
        temperature: 0.85,
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Vanguard error: ${err.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const lyrics = data.choices?.[0]?.message?.content?.trim() ?? '';

    if (!lyrics) {
      return NextResponse.json({ error: 'Empty response from Vanguard' }, { status: 502 });
    }

    return NextResponse.json({ success: true, lyrics });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lyric generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
