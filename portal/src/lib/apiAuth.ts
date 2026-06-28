/**
 * Unified auth resolver for Next.js API routes.
 * Accepts EITHER a NextAuth session (OAuth users) OR an en_token Bearer
 * header (email/password users). Falls back to /auth/me on biological_proxy.
 */
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextRequest } from 'next/server';

const PROXY = process.env.INTERNAL_API_URL ?? process.env.VANGUARD_INTERNAL_URL ?? 'http://127.0.0.1:5000';

export interface AuthUser {
  id?: string;
  email: string;
  name?: string;
}

export async function resolveUser(req: NextRequest): Promise<AuthUser | null> {
  // 1. Try NextAuth session (OAuth sign-in users)
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      return { email: session.user.email, name: session.user.name ?? undefined };
    }
  } catch { /* NextAuth not configured / env missing — fall through */ }

  // 2. Try Bearer token from Authorization header (email/password users)
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  // Verify token with biological_proxy /auth/me
  try {
    const res = await fetch(`${PROXY}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.email) return null;
    return { id: data.id, email: data.email, name: data.name };
  } catch {
    return null;
  }
}
