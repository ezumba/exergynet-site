'use client';

import { useState, useEffect } from 'react';

interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  cover_url: string | null;
  author_name: string;
  tags: string[];
  reading_time_mins: number;
  published_at: string;
  featured: boolean;
}

interface ArticlesResponse {
  articles: Article[];
  total: number;
  page: number;
  pages: number;
}

function ArticleCard({ article, featured = false }: { article: Article; featured?: boolean }) {
  const date = new Date(article.published_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  if (featured) {
    return (
      <a href={`/blog/${article.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: article.cover_url ? '1fr 1fr' : '1fr',
          gap: 0,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-mid)',
          borderRadius: 12,
          overflow: 'hidden',
          transition: 'border-color 0.15s ease',
        }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
        >
          {article.cover_url && (
            <div style={{ position: 'relative', minHeight: 320, background: 'var(--bg-card-2)' }}>
              <img src={article.cover_url} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            </div>
          )}
          <div style={{ padding: '40px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {article.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                  {tag}
                </span>
              ))}
            </div>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1.25, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {article.title}
            </h2>
            {article.subtitle && (
              <p style={{ margin: 0, fontSize: 15, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                {article.subtitle}
              </p>
            )}
            {article.excerpt && (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-faint)', lineHeight: 1.7 }}>
                {article.excerpt.slice(0, 160)}…
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{article.author_name}</span>
              <span style={{ fontSize: 11, color: 'var(--border-hi)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{date}</span>
              <span style={{ fontSize: 11, color: 'var(--border-hi)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{article.reading_time_mins} min read</span>
            </div>
          </div>
        </div>
      </a>
    );
  }

  return (
    <a href={`/blog/${article.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-mid)',
        borderRadius: 10,
        overflow: 'hidden',
        height: '100%',
        display: 'flex', flexDirection: 'column',
        transition: 'border-color 0.15s ease, transform 0.15s ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {article.cover_url ? (
          <div style={{ height: 180, position: 'relative', background: 'var(--bg-card-2)', flexShrink: 0 }}>
            <img src={article.cover_url} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ height: 120, background: 'linear-gradient(135deg, var(--bg-card-2) 0%, var(--bg-surface) 100%)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 28, opacity: 0.15, fontFamily: 'var(--font-code)' }}>◈</span>
          </div>
        )}
        <div style={{ padding: '20px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {article.tags.slice(0, 2).map(tag => (
              <span key={tag} style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase' }}>
                {tag}
              </span>
            ))}
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, lineHeight: 1.3, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {article.title}
          </h3>
          {article.excerpt && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.65, flex: 1 }}>
              {article.excerpt.slice(0, 110)}…
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-dim)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{date}</span>
            <span style={{ fontSize: 10, color: 'var(--border-hi)' }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{article.reading_time_mins} min</span>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function BlogPage() {
  const [data, setData]       = useState<ArticlesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tag, setTag]         = useState('');
  const [page, setPage]       = useState(1);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '12' });
    if (tag) qs.set('tag', tag);
    fetch(`/api/blog/articles?${qs}`)
      .then(r => r.json())
      .then((d: ArticlesResponse) => {
        setData(d);
        // Collect all tags from results
        const tags = new Set<string>();
        d.articles.forEach(a => a.tags.forEach(t => tags.add(t)));
        if (page === 1) setAllTags(Array.from(tags));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tag, page]);

  const featured  = data?.articles.filter(a => a.featured) ?? [];
  const rest      = data?.articles.filter(a => !a.featured) ?? [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 80px' }}>
      {/* Hero */}
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
          ExergyNet <span style={{ color: 'var(--accent)' }}>Journal</span>
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--text-soft)', maxWidth: 480, marginInline: 'auto', lineHeight: 1.6 }}>
          Zero-knowledge proofs, sovereign AI infrastructure, and the economics of decentralized compute.
        </p>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 36, justifyContent: 'center' }}>
          <button
            onClick={() => { setTag(''); setPage(1); }}
            style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1px solid',
              borderColor: !tag ? 'var(--accent)' : 'var(--border-mid)',
              background: !tag ? 'var(--accent-dim)' : 'transparent',
              color: !tag ? 'var(--accent)' : 'var(--text-faint)',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            All
          </button>
          {allTags.map(t => (
            <button
              key={t}
              onClick={() => { setTag(t); setPage(1); }}
              style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1px solid',
                borderColor: tag === t ? 'var(--accent)' : 'var(--border-mid)',
                background: tag === t ? 'var(--accent-dim)' : 'transparent',
                color: tag === t ? 'var(--accent)' : 'var(--text-faint)',
                cursor: 'pointer', transition: 'all 0.15s ease', textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-code)' }}>
          loading articles…
        </div>
      )}

      {!loading && data?.articles.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-faint)', fontSize: 14 }}>
          No articles published yet.
        </div>
      )}

      {/* Featured */}
      {!loading && featured.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          {featured.slice(0, 1).map(a => <ArticleCard key={a.id} article={a} featured />)}
        </div>
      )}

      {/* Grid */}
      {!loading && rest.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {rest.map(a => <ArticleCard key={a.id} article={a} />)}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 48 }}>
          {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width: 36, height: 36, borderRadius: 8, border: '1px solid',
                borderColor: page === p ? 'var(--accent)' : 'var(--border-mid)',
                background: page === p ? 'var(--accent-dim)' : 'transparent',
                color: page === p ? 'var(--accent)' : 'var(--text-faint)',
                cursor: 'pointer', fontSize: 13,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
