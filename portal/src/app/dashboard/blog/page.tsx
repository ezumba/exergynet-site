'use client';

import { useState, useEffect } from 'react';

interface Article {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  featured: boolean;
  tags: string[];
  reading_time_mins: number;
  published_at: string | null;
  created_at: string;
  author_name: string;
}

export default function BlogAdminPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter]     = useState<'all' | 'published' | 'draft'>('all');

  function authHeader() {
    const tok = typeof window !== 'undefined' ? localStorage.getItem('en_token') : null;
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  }

  function load() {
    setLoading(true);
    fetch('/api/admin/blog/articles', { headers: authHeader() })
      .then(r => r.json())
      .then(d => { setArticles(d.articles ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function togglePublish(a: Article) {
    const newStatus = a.status === 'published' ? 'draft' : 'published';
    await fetch(`/api/admin/blog/articles/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ status: newStatus, published_at: newStatus === 'published' ? new Date().toISOString() : null }),
    });
    load();
  }

  async function toggleFeatured(a: Article) {
    await fetch(`/api/admin/blog/articles/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ featured: !a.featured }),
    });
    load();
  }

  async function deleteArticle(id: string) {
    if (!confirm('Delete this article permanently?')) return;
    setDeleting(id);
    await fetch(`/api/admin/blog/articles/${id}`, { method: 'DELETE', headers: authHeader() });
    setDeleting(null);
    load();
  }

  const visible = articles.filter(a => filter === 'all' || a.status === filter);

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Articles
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-faint)' }}>
            {articles.filter(a => a.status === 'published').length} published · {articles.filter(a => a.status === 'draft').length} drafts
          </p>
        </div>
        <a href="/dashboard/blog/new" className="en-btn en-btn-primary" style={{ fontSize: 12, padding: '8px 18px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          + New Article
        </a>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['all', 'published', 'draft'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid',
              borderColor: filter === f ? 'var(--accent)' : 'var(--border-mid)',
              background: filter === f ? 'var(--accent-dim)' : 'transparent',
              color: filter === f ? 'var(--accent)' : 'var(--text-faint)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-faint)', fontFamily: 'var(--font-code)', fontSize: 12 }}>
          loading…
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="en-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-faint)' }}>
          <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.2 }}>◈</div>
          <div style={{ fontSize: 14 }}>No articles yet.</div>
          <a href="/dashboard/blog/new" style={{ fontSize: 12, color: 'var(--accent)', marginTop: 12, display: 'inline-block', textDecoration: 'none' }}>
            Write your first article →
          </a>
        </div>
      )}

      {/* Table */}
      {!loading && visible.length > 0 && (
        <div className="en-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
                {['Title', 'Status', 'Tags', 'Read time', 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-faint)', fontWeight: 500, textAlign: 'left', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((a, i) => (
                <tr
                  key={a.id}
                  style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border-dim)' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 16px', maxWidth: 300 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.featured && <span style={{ fontSize: 9, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 5px', borderRadius: 3, marginRight: 6 }}>FEATURED</span>}
                      {a.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2, fontFamily: 'var(--font-code)' }}>/{a.slug}</div>
                  </td>
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase',
                      background: a.status === 'published' ? 'var(--success-bg)' : 'var(--bg-card-2)',
                      color: a.status === 'published' ? 'var(--accent)' : 'var(--text-faint)',
                      border: `1px solid ${a.status === 'published' ? 'var(--success-border)' : 'var(--border-mid)'}`,
                    }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {a.tags.slice(0, 2).map(t => (
                        <span key={t} style={{ fontSize: 9, color: 'var(--text-faint)', background: 'var(--bg-card-2)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--border-dim)', textTransform: 'capitalize' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                    {a.reading_time_mins} min
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                    {new Date(a.published_at ?? a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => togglePublish(a)}
                        title={a.status === 'published' ? 'Unpublish' : 'Publish'}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-faint)', cursor: 'pointer' }}
                      >
                        {a.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => toggleFeatured(a)}
                        title={a.featured ? 'Unfeature' : 'Feature'}
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border-mid)', background: a.featured ? 'var(--accent-dim)' : 'transparent', color: a.featured ? 'var(--accent)' : 'var(--text-faint)', cursor: 'pointer' }}
                      >
                        ★
                      </button>
                      <a
                        href={`/dashboard/blog/${a.id}`}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-faint)', cursor: 'pointer', textDecoration: 'none' }}
                      >
                        Edit
                      </a>
                      <a
                        href={`/blog/${a.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-faint)', textDecoration: 'none' }}
                      >
                        ↗
                      </a>
                      <button
                        onClick={() => deleteArticle(a.id)}
                        disabled={deleting === a.id}
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--error-border)', background: 'transparent', color: 'var(--red)', cursor: 'pointer', opacity: deleting === a.id ? 0.5 : 1 }}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
