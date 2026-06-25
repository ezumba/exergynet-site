// app/api/agent/register/route.ts
// Named Personal SEI Agent — registration + CRUD
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function toSeiId(name: string): string {
  return 'SEI-' + name
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

export async function GET(req: NextRequest) {
  const userKey = req.nextUrl.searchParams.get('userKey') ?? 'default';
  const rows = await db.execute(sql`
    SELECT * FROM agents WHERE user_key = ${userKey} LIMIT 1
  `);
  const agent = (rows.rows ?? rows)[0] ?? null;
  return NextResponse.json({ agent });
}

export async function POST(req: NextRequest) {
  const { name, userKey = 'default' } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const seiId = toSeiId(name.trim());

  // Upsert agent
  const result = await db.execute(sql`
    INSERT INTO agents (user_key, name, sei_id, phase, calibration, instructions)
    VALUES (${userKey}, ${name.trim()}, ${seiId}, 1,
            '{"signal_threshold":0,"brief_style":0,"entity_relevance":0,"prediction_pattern":0}'::jsonb,
            '[]'::jsonb)
    ON CONFLICT (user_key) DO UPDATE SET
      name = EXCLUDED.name,
      sei_id = EXCLUDED.sei_id,
      updated_at = NOW()
    RETURNING *
  `);

  return NextResponse.json({ agent: (result.rows ?? result)[0] });
}

export async function PATCH(req: NextRequest) {
  const { userKey = 'default', instructions, calibration } = await req.json();

  await db.execute(sql`
    UPDATE agents SET
      instructions = COALESCE(${instructions ? JSON.stringify(instructions) : null}::jsonb, instructions),
      calibration  = COALESCE(${calibration  ? JSON.stringify(calibration)  : null}::jsonb, calibration),
      updated_at   = NOW()
    WHERE user_key = ${userKey}
  `);

  return NextResponse.json({ ok: true });
}
