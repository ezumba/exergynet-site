'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, session } from '@/lib/api';

type Mode = 'login' | 'register';

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode: Mode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState<{ key: string; preview: string; note: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (session.exists()) router.push('/dashboard');
  }, [router]);

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
    } catch (err: any) {
      setError(err.message);
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

  // Key reveal screen (shown once after registration)
  if (newKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div
            className="en-card"
            style={{ borderColor: '#0D9488', borderWidth: 1, borderStyle: 'solid' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ color: '#0D9488', fontSize: 11, letterSpacing: '0.08em' }}>■ REGISTRATION COMPLETE</span>
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
                onClick={() => { setNewKey(null); setMode('login'); setEmail(''); setPassword(''); }}
              >
                continue to login →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        {/* Form */}
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
