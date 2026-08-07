import { NextRequest, NextResponse } from "next/server";
import { xlmp_get_content, MemoryIntegrityViolation } from "@/lib/xlmp_ds_core";
import { resolveUser } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const root = req.nextUrl.searchParams.get('root');
  if (!root || !/^[a-f0-9]{1,64}$/i.test(root)) {
    return NextResponse.json({ error: 'Invalid root parameter' }, { status: 400 });
  }

  // LNES-58.10: xlmp_get_content now throws MemoryIntegrityViolation (fatal
  // to this request only) instead of silently returning tampered content.
  // No payload content or hash telemetry is included in the response body.
  let content: string | undefined;
  try {
    content = xlmp_get_content(root);
  } catch (err) {
    if (err instanceof MemoryIntegrityViolation) {
      return NextResponse.json({ error: 'Content failed integrity verification', code: err.code }, { status: 500 });
    }
    throw err;
  }

  if (!content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  }

  return NextResponse.json({ xlmp_root: root, content, chars: content.length });
}
