import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ExergyNet Blog',
  description: 'Insights on zero-knowledge proofs, AI infrastructure, and sovereign compute.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Minimal public header */}
      <header style={{
        borderBottom: '1px solid var(--border-mid)',
        background: 'var(--bg-surface)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.10em', color: 'var(--text)', fontFamily: 'var(--font-code)' }}>
              EXERGY<span style={{ color: 'var(--accent)' }}>NET</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', borderLeft: '1px solid var(--border-mid)', paddingLeft: 10, letterSpacing: '0.06em' }}>
              BLOG
            </span>
          </a>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <a href="/dashboard" style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none', letterSpacing: '0.04em' }}>
              Dashboard
            </a>
            <a href="/" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', letterSpacing: '0.04em', border: '1px solid var(--accent)', padding: '5px 14px', borderRadius: 6 }}>
              Sign in
            </a>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
