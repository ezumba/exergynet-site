// ══════════════════════════════════════════════════════════════════════════════
// NextAuth.js route handler
// Google + Twitter (X) OAuth → upserts developer in biological_proxy
// ══════════════════════════════════════════════════════════════════════════════
import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import TwitterProvider from 'next-auth/providers/twitter';

// Server-side only: call biological_proxy directly via loopback (no Caddy hop)
const INTERNAL_API = process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:5000';

interface OAuthResult {
  token: string;
  is_new_user: boolean;
  api_key?: string;
  api_key_preview?: string;
  note?: string;
}

async function upsertOAuthDeveloper(
  provider: string,
  providerId: string,
  email: string | null | undefined,
  name: string | null | undefined,
): Promise<OAuthResult> {
  const res = await fetch(`${INTERNAL_API}/auth/oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, provider_id: providerId, email, name }),
  });
  const body = await res.json().catch(() => ({})) as { error?: string } & OAuthResult;
  if (!res.ok) throw new Error(body.error ?? `OAuth upsert failed: ${res.status}`);
  return body;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    TwitterProvider({
      clientId:     process.env.TWITTER_CLIENT_ID!,    // Consumer Key
      clientSecret: process.env.TWITTER_CLIENT_SECRET!, // Consumer Secret
      // version: '1.0a' is default — matches the credentials from X Developer Console
    }),
  ],

  callbacks: {
    // Fires on every JWT creation/refresh; account is only present on first sign-in
    async jwt({ token, account, user }) {
      if (account) {
        try {
          const data = await upsertOAuthDeveloper(
            account.provider,
            account.providerAccountId,
            user?.email,
            user?.name,
          );
          token.portalToken    = data.token;
          token.isNewUser      = data.is_new_user;
          if (data.is_new_user) {
            token.apiKey         = data.api_key         ?? null;
            token.apiKeyPreview  = data.api_key_preview ?? null;
            token.apiKeyNote     = data.note            ?? null;
          }
        } catch (err) {
          console.error('[NextAuth jwt] biological_proxy error:', err);
          token.oauthError = String(err);
        }
      }
      return token;
    },

    // Exposes the token fields to the client via useSession()
    async session({ session, token }) {
      return {
        ...session,
        portalToken:   token.portalToken   as string | undefined,
        isNewUser:     token.isNewUser     as boolean | undefined,
        apiKey:        token.apiKey        as string | null | undefined,
        apiKeyPreview: token.apiKeyPreview as string | null | undefined,
        apiKeyNote:    token.apiKeyNote    as string | null | undefined,
        oauthError:    token.oauthError    as string | undefined,
      };
    },
  },

  pages: {
    signIn: '/',   // Redirect here on sign-in / errors
    error:  '/',
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
