import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entities } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const [entity] = await db.select().from(entities).where(eq(entities.id, params.id)).limit(1);
  if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const current = (entity.profileData as any) ?? {};
  await db.execute(sql`
    UPDATE entities SET
      profile_data   = ${JSON.stringify({ ...current, profile_status: 'approved', approved_at: new Date().toISOString() })}::jsonb,
      baseline_ready = true
    WHERE id = ${params.id}
  `);

  return NextResponse.json({ status: 'approved', entityId: params.id });
}
