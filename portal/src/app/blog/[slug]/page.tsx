'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  content: string;
  cover_url: string | null;
  author_name: string;
  author_avatar: string | null;
  tags: string[];
  reading_time_mins: number;
  published_at: string;
  featured: boolean;
}

function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 100, background: 'var(--border-dim)' }}>
      <div style={{ height: '100%', background: 'var(--accent)', width: `${progress}%`, transition: 'width 0.1s linear' }} />
    </div>
  );
}

function ArticleContent({ html }: { html: string }) {
  return (
    <div
      className="article-prose"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        fontSize: 17,
        lineHeight: 1.85,
        color: 'var(--text-soft)',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    />
  );
}

export default function ArticleReaderPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/blog/articles/${slug}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then(d => { if (d) { setArticle(d); setLoading(false); } })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 24px', color: 'var(--text-faint)', fontFamily: 'var(--font-code)', fontSize: 13 }}>
        loading…
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>◈</div>
        <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Article not found.</p>
        <a href="/blog" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none', marginTop: 12, display: 'inline-block' }}>
          ← Back to Journal
        </a>
      </div>
    );
  }

  const date = new Date(article.published_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <>
      <ReadingProgress />

      {/* Cover image */}
      {article.cover_url && (
        <div style={{ width: '100%', maxHeight: 480, overflow: 'hidden', position: 'relative' }}>
          <img
            src={article.cover_url}
            alt={article.title}
            style={{ width: '100%', height: 480, objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, var(--bg) 100%)' }} />
        </div>
      )}

      <div style={{ maxWidth: 720, margin: '0 auto', padding: article.cover_url ? '0 24px 80px' : '56px 24px 80px' }}>

        {/* Back link */}
        <a href="/blog" style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 32 }}>
          ← Journal
        </a>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {article.tags.map(tag => (
              <span key={tag} style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '3px 9px', borderRadius: 4, textTransform: 'uppercase' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 style={{ margin: '0 0 16px', fontSize: 36, fontWeight: 800, lineHeight: 1.2, color: 'var(--text)', letterSpacing: '-0.03em', fontFamily: 'Georgia, serif' }}>
          {article.title}
        </h1>

        {article.subtitle && (
          <p style={{ margin: '0 0 24px', fontSize: 18, color: 'var(--text-soft)', lineHeight: 1.6, fontFamily: 'Georgia, serif' }}>
            {article.subtitle}
          </p>
        )}

        {/* Byline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 32, marginBottom: 40, borderBottom: '1px solid var(--border-dim)' }}>
          {article.author_avatar ? (
            <img src={article.author_avatar} alt={article.author_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--accent)', fontFamily: 'var(--font-code)' }}>
              {article.author_name.charAt(0)}
            </div>
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{article.author_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{date} · {article.reading_time_mins} min read</div>
          </div>
        </div>

        {/* Body */}
        <ArticleContent html={article.content} />

        {/* Footer */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <a href="/blog" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', letterSpacing: '0.02em' }}>
            ← Back to Journal
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            {article.tags.map(tag => (
              <a key={tag} href={`/blog?tag=${tag}`} style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-faint)', background: 'var(--bg-card)', padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase', textDecoration: 'none', border: '1px solid var(--border-mid)' }}>
                {tag}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Prose styles injected globally */}
      <style>{`
        .article-prose h1, .article-prose h2, .article-prose h3, .article-prose h4 {
          font-family: Georgia, "Times New Roman", serif;
          color: var(--text);
          line-height: 1.3;
          margin: 2em 0 0.75em;
          letter-spacing: -0.02em;
        }
        .article-prose h2 { font-size: 1.5em; }
        .article-prose h3 { font-size: 1.2em; }
        .article-prose p { margin: 0 0 1.4em; }
        .article-prose a { color: var(--accent); text-decoration: underline; text-decoration-color: var(--accent-dim); }
        .article-prose a:hover { text-decoration-color: var(--accent); }
        .article-prose blockquote {
          margin: 2em 0;
          padding: 16px 24px;
          border-left: 3px solid var(--accent);
          background: var(--accent-dim);
          border-radius: 0 8px 8px 0;
          font-style: italic;
          color: var(--text-soft);
        }
        .article-prose pre {
          background: var(--bg-surface);
          border: 1px solid var(--border-mid);
          border-radius: 8px;
          padding: 20px 24px;
          overflow-x: auto;
          font-size: 14px;
          line-height: 1.6;
          font-family: var(--font-code);
          margin: 1.5em 0;
        }
        .article-prose code {
          font-family: var(--font-code);
          font-size: 0.875em;
          background: var(--bg-card);
          border: 1px solid var(--border-dim);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--accent);
        }
        .article-prose pre code {
          background: none; border: none; padding: 0; color: var(--text-soft);
        }
        .article-prose img {
          max-width: 100%; border-radius: 8px; margin: 1.5em 0;
          border: 1px solid var(--border-mid);
        }
        .article-prose ul, .article-prose ol {
          padding-left: 1.5em; margin: 0 0 1.4em;
        }
        .article-prose li { margin-bottom: 0.4em; }
        .article-prose hr {
          border: none; border-top: 1px solid var(--border-mid); margin: 3em 0;
        }
      `}</style>
    </>
  );
}
