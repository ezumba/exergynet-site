'use client';

import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/useTheme';
import { useSidebar } from '@/lib/SidebarContext';

const PAGE_MAP: Record<string, string> = {
  '/dashboard':             'Overview',
  '/dashboard/keys':        'API Keys',
  '/dashboard/billing':     'Billing',
  '/dashboard/analytics':   'Analytics',
  '/dashboard/playground':  'Playground',
  '/dashboard/settlements': 'Settlements',
  '/dashboard/intel':       'App Store',
  '/dashboard/voice':       'Voice Studio',
  '/dashboard/apps':        'My Apps',
  '/dashboard/aeris':       'AERIS',
};

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export default function Topbar() {
  const pathname = usePathname();
  const { theme, applyTheme } = useTheme();
  const { toggle } = useSidebar();

  const pageTitle = PAGE_MAP[pathname] ?? 'Dashboard';

  return (
    <header
      style={{
        height: 'var(--topbar-h)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        gap: 12,
        borderBottom: '1px solid var(--border-mid)',
        background: 'var(--bg-card)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        flexShrink: 0,
      }}
    >
      <button
        className="en-hamburger"
        onClick={toggle}
        aria-label="Toggle navigation"
        style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: 8,
          border: '1px solid var(--border-mid)',
          background: 'var(--bg-surface)',
          color: 'var(--text)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <HamburgerIcon />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-faint)', letterSpacing: '0.01em' }}>
          ExergyNet
        </span>
        <span style={{ color: 'var(--border-mid)', fontSize: 14 }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          {pageTitle}
        </span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Three-way theme toggle: Dark / Light / Color */}
        <div
          className="en-theme-switch"
          aria-label="Color theme"
          style={{ gap: 2 }}
        >
          {/* Dark */}
          <button
            className={'en-theme-btn' + (theme === 'dark' ? ' active' : '')}
            onClick={() => applyTheme('dark')}
            aria-pressed={theme === 'dark'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            Dark
          </button>

          {/* Light */}
          <button
            className={'en-theme-btn' + (theme === 'light' ? ' active' : '')}
            onClick={() => applyTheme('light')}
            aria-pressed={theme === 'light'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2"  x2="12" y2="5"  />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="4.22"  y1="4.22"  x2="6.34"  y2="6.34"  />
              <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
              <line x1="2"  y1="12" x2="5"  y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
              <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66" />
              <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22"  />
            </svg>
            Light
          </button>

          {/* Color — aurora gradient */}
          <button
            className={'en-theme-btn' + (theme === 'color' ? ' active' : '')}
            onClick={() => applyTheme('color')}
            aria-pressed={theme === 'color'}
            style={theme === 'color' ? {
              background: 'linear-gradient(135deg, #ffc8e0, #ffe88a, #b8d9ff, #d4b8ff)',
              color: '#4a1e7a',
              fontWeight: 700,
            } : undefined}
          >
            {/* Color swatch icon */}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13.5" cy="6.5"  r="2.5" />
              <circle cx="17.5" cy="10.5" r="2.5" />
              <circle cx="8.5"  cy="7.5"  r="2.5" />
              <circle cx="6.5"  cy="12.5" r="2.5" />
              <path d="M12 22c4.97 0 9-4.03 9-9H3c0 4.97 4.03 9 9 9z" />
            </svg>
            Color
          </button>
        </div>
      </div>
    </header>
  );
}