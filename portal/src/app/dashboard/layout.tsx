'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { session } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

type Theme = 'dark' | 'light' | 'color';

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t === 'dark' ? '' : t);
  localStorage.setItem('en_theme', t);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    if (!session.exists()) {
      router.replace('/');
      return;
    }
    const saved = (localStorage.getItem('en_theme') as Theme) ?? 'dark';
    setTheme(saved);
    applyTheme(saved);
  }, [router]);

  function switchTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  if (typeof window !== 'undefined' && !session.exists()) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Theme toggle bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '10px 24px',
          gap: 4,
          borderBottom: '1px solid var(--border-dim)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}>
          {(['dark', 'light', 'color'] as Theme[]).map(t => (
            <button
              key={t}
              onClick={() => switchTheme(t)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: `1px solid ${theme === t ? 'var(--accent)' : 'var(--border-dim)'}`,
                background: theme === t
                  ? t === 'color' ? '#B45309' : 'var(--accent)'
                  : 'transparent',
                color: theme === t ? '#fff' : 'var(--text-dim)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                letterSpacing: '0.04em',
                transition: 'all 0.12s',
              }}
            >
              {t === 'dark' ? '◑ Dark' : t === 'light' ? '◎ Light' : '✦ Color'}
            </button>
          ))}
        </div>
        <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
