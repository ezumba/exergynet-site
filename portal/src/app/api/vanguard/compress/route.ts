import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { xlmp_shatter_payload, xlmp_store_content } from '@/lib/xlmp_ds_core';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const payload = Buffer.from(JSON.stringify(messages), 'utf-8');
    const hollowObj = await xlmp_shatter_payload(payload);
    xlmp_store_content(hollowObj.xlmp_root, JSON.stringify(messages));

    return NextResponse.json({
      success: true,
      hollow_object: hollowObj,
      compressed_message_count: messages.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Compression failure';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
