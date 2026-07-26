'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { adminSession, admin } from '@/lib/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [logging, setLogging] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setAuthed(adminSession.exists());
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLogging(true);
    setError('');
    try {
      const { token } = await admin.login(email, password);
      adminSession.save(token);
      setAuthed(true);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLogging(false);
    }
  }

  if (authed === null) return null;

  if (!authed) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div className="en-card" style={{ width: 320 }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: 20 }}>
            <span style={{ color: 'var(--accent)' }}>■</span> EXERGYNET ADMIN
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="email"
              placeholder="admin email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="en-input"
              required
              autoFocus
            />
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="en-input"
              required
            />
            {error && (
              <div style={{
                background: 'var(--error-bg)',
                border: '1px solid var(--error-border)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 11,
                color: 'var(--red)',
              }}>
                {error}
              </div>
            )}
            <button type="submit" className="en-btn en-btn-primary" disabled={logging}>
              {logging ? 'signing in…' : 'sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const NAV = [
    { href: '/admin/ledger', label: '📋 otet ledger' },
    { href: '/admin/scribe', label: '📜 vanguard scribe' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <aside style={{
        width: 200,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-mid)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}>
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border-mid)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.10em', color: 'var(--text)' }}>
            EXERGY<span style={{ color: 'var(--accent)' }}>NET</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.08em', marginTop: 3 }}>
            admin panel
          </div>
        </div>
        <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ href, label }) => {
            const isActive = pathname?.startsWith(href);
            return (
              <Link key={href} href={href} style={{
                display: 'block',
                padding: '9px 12px',
                borderRadius: 'var(--radius)',
                fontSize: 12,
                textDecoration: 'none',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-faint)',
                borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                fontFamily: 'var(--font-code)',
              }}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '14px 10px', borderTop: '1px solid var(--border-mid)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 10, padding: '0 4px' }}>
            admin session
          </div>
          <button
            className="en-btn en-btn-ghost"
            style={{ width: '100%', fontSize: 10, padding: '6px 0', justifyContent: 'center' }}
            onClick={() => { adminSession.clear(); setAuthed(false); }}
          >
            sign out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
