'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  { href: '/music',                 label: '♫ drops',       exact: false },
  { href: '/dashboard/apps',        label: '▦ my apps',     exact: false },
  { href: '/dashboard/aeris',       label: '◬ aeris',       exact: false },
  { href: 'https://vanguard.exergynet.org', label: '⟁ vanguard',    exact: false, external: true },
  { href: '/dashboard/vault',       label: '⊗ vault',       exact: false },
  { href: '/dashboard/blog',        label: '✦ journal',     exact: false },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { open, close } = useSidebar();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close sidebar on route change on mobile
  useEffect(() => {
    if (isMobile) close();
  }, [pathname, isMobile, close]);

  function handleSignOut() {
    session.clear();
    router.push('/');
  }

  const sidebarStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100dvh',
        width: 'var(--sidebar-w)',
        zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s ease',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-mid)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }
    : {
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
      };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 49,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        />
      )}

      <aside style={sidebarStyle}>
        <div style={{ width: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>

          {/* Logo */}
          <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border-mid)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.10em', marginBottom: 3, color: 'var(--text)' }}>
                EXERGY<span style={{ color: 'var(--accent)' }}>NET</span>
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
                developer portal
              </div>
            </div>
            {/* Mobile close button */}
            {isMobile && (
              <button
                onClick={close}
                aria-label="Close navigation"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6,
                  border: '1px solid var(--border-mid)',
                  background: 'transparent',
                  color: 'var(--text-faint)',
                  cursor: 'pointer',
                  fontSize: 16, lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
            {NAV_ITEMS.map((item) => {
              const { href, label } = item;
              const external = 'external' in item && item.external;
              const exact     = 'exact' in item ? item.exact : false;
              const isActive  = external ? false : (exact ? pathname === href : pathname.startsWith(href));
              const linkStyle: React.CSSProperties = {
                display: 'block',
                padding: '9px 12px',
                borderRadius: 'var(--radius)',
                fontSize: 13,
                letterSpacing: '0.02em',
                textDecoration: 'none',
                transition: 'background var(--ease), color var(--ease)',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-faint)',
                borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                fontFamily: 'var(--font-code)',
              };
              return external ? (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  {label} <span style={{ fontSize: 9, opacity: 0.5 }}>↗</span>
                </a>
              ) : (
                <Link key={href} href={href} style={linkStyle}>
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
        </div>
      </aside>
    </>
  );
}
