'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { auth, session } from '@/lib/api';

type Mode = 'login' | 'register';

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: oauthSession, status: oauthStatus } = useSession();

  const initialMode: Mode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode]         = useState<Mode>(initialMode);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [newKey, setNewKey]     = useState<{ key: string; preview: string; note: string } | null>(null);
  /** Portal JWT held during OAuth key-reveal — saved to localStorage when user clicks continue */
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);

  // ── Redirect if already logged in via localStorage ─────────────────────────
  useEffect(() => {
    if (session.exists()) router.push('/dashboard');
  }, [router]);

  // ── Handle OAuth redirect back to this page ────────────────────────────────
  useEffect(() => {
    if (oauthStatus !== 'authenticated' || !oauthSession) return;
    if (session.exists()) return; // already have a localStorage portal session

    const { portalToken, isNewUser, apiKey, apiKeyPreview, apiKeyNote, oauthError } =
      oauthSession as typeof oauthSession & {
        portalToken?:   string;
        isNewUser?:     boolean;
        apiKey?:        string | null;
        apiKeyPreview?: string | null;
        apiKeyNote?:    string | null;
        oauthError?:    string;
      };

    if (oauthError) {
      setError('OAuth sign-in failed — please try again or use email/password.');
      signOut({ redirect: false });
      return;
    }

    if (!portalToken) return;

    if (isNewUser && apiKey) {
      // New OAuth user: show API key reveal before heading to dashboard
      setNewKey({
        key:     apiKey,
        preview: apiKeyPreview ?? '',
        note:    apiKeyNote    ?? 'Save your API key immediately — it will never be shown again.',
      });
      setPendingToken(portalToken);
    } else {
      // Returning OAuth user: save portal JWT and navigate
      session.save(portalToken);
      signOut({ redirect: false }); // clear NextAuth cookie (we have what we need in localStorage)
      router.push('/dashboard');
    }
  }, [oauthSession, oauthStatus, router]);

  // ── Email / password submit ────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await auth.login(email, password);
        session.save(res.token);
        router.push('/dashboard');
      } else {
        const res = await auth.register(email, password);
        setNewKey({ key: res.api_key, preview: res.api_key_preview, note: res.note });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Key reveal screen (shown once after registration OR first OAuth sign-in) ─
  if (newKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div
            className="en-card"
            style={{ borderColor: '#0D9488', borderWidth: 1, borderStyle: 'solid' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ color: '#0D9488', fontSize: 11, letterSpacing: '0.08em' }}>
                ■ {pendingToken ? 'ACCOUNT CREATED' : 'REGISTRATION COMPLETE'}
              </span>
            </div>

            <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 16, lineHeight: 1.7 }}>
              {newKey.note}
            </p>

            <div
              style={{
                background: '#0F172A',
                border: '1px solid #0F766E',
                borderRadius: 8,
                padding: '12px 14px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                color: '#0D9488',
                wordBreak: 'break-all',
                marginBottom: 8,
                lineHeight: 1.6,
              }}
            >
              {newKey.key}
            </div>

            <div style={{ fontSize: 10, color: '#334155', marginBottom: 16 }}>
              Preview (safe to store): {newKey.preview}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="en-btn en-btn-ghost"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={copyKey}
              >
                {copied ? '✓ copied' : 'copy key'}
              </button>
              <button
                className="en-btn en-btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  if (pendingToken) {
                    // OAuth flow: save portal JWT to localStorage, clear NextAuth cookie, go to dashboard
                    session.save(pendingToken);
                    signOut({ redirect: false });
                    router.push('/dashboard');
                  } else {
                    // Email/password flow: go to login form
                    setNewKey(null); setMode('login'); setEmail(''); setPassword('');
                  }
                }}
              >
                {pendingToken ? 'go to dashboard →' : 'continue to login →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main auth form ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: '0.12em', marginBottom: 4 }}>
            EXERGY<span style={{ color: '#0D9488' }}>NET</span>
          </div>
          <div style={{ fontSize: 10, color: '#334155', letterSpacing: '0.08em' }}>
            developer portal · base sepolia
          </div>
        </div>

        {/* Tab toggle */}
        <div
          style={{
            display: 'flex',
            background: '#1E293B',
            borderRadius: 8,
            padding: 3,
            marginBottom: 20,
            border: '1px solid #334155',
          }}
        >
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1,
                padding: '7px 0',
                border: 'none',
                borderRadius: 6,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: mode === m ? '#0D9488' : 'transparent',
                color: mode === m ? 'white' : '#475569',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* OAuth buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button
            className="en-btn en-btn-ghost"
            style={{ flex: 1, justifyContent: 'center', gap: 7, fontSize: 12 }}
            onClick={() => signIn('google')}
            disabled={loading || oauthStatus === 'loading'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          <button
            className="en-btn en-btn-ghost"
            style={{ flex: 1, justifyContent: 'center', gap: 7, fontSize: 12 }}
            onClick={() => signIn('twitter')}
            disabled={loading || oauthStatus === 'loading'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            X
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#1E293B' }} />
          <span style={{ fontSize: 10, color: '#334155', letterSpacing: '0.07em' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: '#1E293B' }} />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 10, color: '#475569', marginBottom: 6, letterSpacing: '0.07em' }}>
              EMAIL
            </label>
            <input
              className="en-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="dev@example.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 10, color: '#475569', marginBottom: 6, letterSpacing: '0.07em' }}>
              PASSWORD
            </label>
            <input
              className="en-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'min 8 characters' : '••••••••'}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
            />
          </div>

          {error && (
            <div style={{
              background: '#2D0808',
              border: '1px solid #991B1B',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 11,
              color: '#EF4444',
              marginBottom: 16,
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="en-btn en-btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading
              ? 'processing…'
              : mode === 'login'
                ? 'sign in →'
                : 'create account →'}
          </button>
        </form>

        {mode === 'register' && (
          <div style={{ marginTop: 16, padding: '10px 12px', background: '#1E293B', borderRadius: 6, fontSize: 10, color: '#334155', lineHeight: 1.8 }}>
            <span style={{ color: '#475569' }}>On registration:</span> your API key is shown <em>once</em> and never stored in plain text.
            Copy it immediately. Your password can be reset; your API key cannot be recovered.
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: '#1E293B' }}>
          exergynet.org · vanguard engine · base sepolia testnet
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthPageInner />
    </Suspense>
  );
}
