'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { session } from '@/lib/api';
import { useSidebar } from '@/lib/SidebarContext';

const NAV_ITEMS = [
  { href: '/dashboard',             label: '◈ overview',    exact: true  },
  { href: '/dashboard/keys',        label: '⌗ api keys',    exact: false },
  { href: '/dashboard/billing',     label: '◇ billing',     exact: false },
  { href: '/dashboard/analytics',   label: '▦ analytics',   exact: false },
  { href: '/dashboard/playground',  label: '▷ playground',  exact: false },
  { href: '/dashboard/settlements', label: '⊞ settlements', exact: false },
  { href: '/dashboard/intel',       label: '⬡ app store',   exact: false },
  { href: '/dashboard/voice',       label: '◎ voice',       exact: false },
  { href: '/dashboard/apps',        label: '▦ my apps',     exact: false },
  { href: '/dashboard/aeris',       label: '◬ aeris',       exact: false },
  { href: '/dashboard/vanguard',    label: '⟁ vanguard',    exact: false },
  { href: '/dashboard/vault',       label: '⊗ vault',       exact: false },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { open } = useSidebar();

  function handleSignOut() {
    session.clear();
    router.push('/');
  }

  return (
    <aside
      style={{
        width: open ? 'var(--sidebar-w)' : 0,
        minWidth: 0,
        background: 'var(--bg-surface)',
        borderRight: open ? '1px solid var(--border-mid)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.2s ease, border-color var(--ease), background var(--ease)',
      }}
    >
      {/* Fixed-width inner wrapper so content doesn't reflow during slide animation */}
      <div style={{ width: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>

      {/* Logo */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border-mid)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.10em', marginBottom: 3, color: 'var(--text)' }}>
          EXERGY<span style={{ color: 'var(--accent)' }}>NET</span>
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
          developer portal
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ href, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'block',
                padding: '7px 12px',
                borderRadius: 'var(--radius)',
                fontSize: 11,
                letterSpacing: '0.04em',
                textDecoration: 'none',
                transition: 'background var(--ease), color var(--ease)',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-faint)',
                borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                fontFamily: 'var(--font-code)',
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px 10px', borderTop: '1px solid var(--border-mid)' }}>
        <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 10, lineHeight: 1.8, padding: '0 4px' }}>
          base sepolia testnet<br />
          vanguard engine · v1
        </div>
        <button
          className="en-btn en-btn-ghost"
          style={{ width: '100%', justifyContent: 'center', fontSize: 10, padding: '6px 0' }}
          onClick={handleSignOut}
        >
          sign out
        </button>
      </div>
      </div>{/* end inner wrapper */}
    </aside>
  );
}
