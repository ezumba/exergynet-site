'use client';

import { useState, useEffect } from 'react';

interface ArticleEditorProps {
  articleId?: string;  // undefined = new
}

interface FormState {
  title: string;
  subtitle: string;
  content: string;
  excerpt: string;
  tags: string;
  author_name: string;
  status: 'draft' | 'published';
  featured: boolean;
  cover_url: string;
}

const EMPTY: FormState = {
  title: '', subtitle: '', content: '', excerpt: '',
  tags: '', author_name: 'ExergyNet',
  status: 'draft', featured: false, cover_url: '',
};

function authHeader() {
  const tok = typeof window !== 'undefined' ? localStorage.getItem('en_token') : null;
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

// Simple markdown → HTML renderer for preview
function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|b|p|u|o|l|h|c|a|e|i|s])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

export default function ArticleEditor({ articleId }: ArticleEditorProps) {
  const [form, setForm]       = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(!!articleId);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');
  const [view, setView]       = useState<'split' | 'write' | 'preview'>('split');
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (!articleId) return;
    fetch(`/api/admin/blog/articles`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => {
        const a = (d.articles ?? []).find((x: { id: string }) => x.id === articleId);
        if (a) {
          setForm({
            title:       a.title ?? '',
            subtitle:    a.subtitle ?? '',
            content:     a.content ?? '',
            excerpt:     a.excerpt ?? '',
            tags:        (a.tags ?? []).join(', '),
            author_name: a.author_name ?? 'ExergyNet',
            status:      a.status ?? 'draft',
            featured:    a.featured ?? false,
            cover_url:   a.cover_url ?? '',
          });
        }
        setLoading(false);
      });
  }, [articleId]);

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  async function save(publish = false) {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    const payload = {
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      status: publish ? 'published' : form.status,
      published_at: publish ? new Date().toISOString() : undefined,
    };

    const url    = articleId ? `/api/admin/blog/articles/${articleId}` : '/api/admin/blog/articles';
    const method = articleId ? 'PUT' : 'POST';

    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(payload),
    });
    const body = await r.json();
    if (!r.ok) {
      setError(body.error ?? 'Save failed');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (!articleId && body.article?.id) {
        window.location.href = `/dashboard/blog/${body.article.id}`;
      }
    }
    setSaving(false);
  }

  async function uploadCover(file: File) {
    setUploadingCover(true);
    const fd = new FormData();
    fd.append('cover', file);
    const r = await fetch('/api/admin/blog/upload-cover', {
      method: 'POST',
      headers: authHeader(),
      body: fd,
    });
    const d = await r.json();
    if (d.url) set('cover_url', d.url);
    setUploadingCover(false);
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-faint)', fontFamily: 'var(--font-code)', fontSize: 12 }}>loading…</div>;
  }

  const previewHtml = markdownToHtml(form.content);

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    background: 'var(--bg-input)', border: '1px solid var(--border-mid)',
    borderRadius: 6, padding: '8px 12px', fontSize: 13,
    color: 'var(--text)', outline: 'none',
    transition: 'border-color 0.15s ease',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--topbar-h))', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-mid)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', flexShrink: 0, background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/dashboard/blog" style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none' }}>
            ← Articles
          </a>
          <span style={{ color: 'var(--border-mid)' }}>/</span>
          <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
            {articleId ? 'Edit Article' : 'New Article'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border-mid)', borderRadius: 6, overflow: 'hidden' }}>
            {(['write', 'split', 'preview'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  fontSize: 11, padding: '5px 10px', border: 'none', cursor: 'pointer',
                  background: view === v ? 'var(--accent-dim)' : 'transparent',
                  color: view === v ? 'var(--accent)' : 'var(--text-faint)',
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {saved && <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-code)' }}>Saved</span>}
          {error && <span style={{ fontSize: 11, color: 'var(--red)' }}>{error}</span>}

          <button onClick={() => save(false)} disabled={saving} className="en-btn en-btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }}>
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={() => save(true)} disabled={saving} className="en-btn en-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }}>
            {form.status === 'published' ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Main: metadata sidebar + editor */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Metadata sidebar */}
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border-mid)', padding: '16px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>STATUS</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['draft', 'published'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => set('status', s)}
                  style={{
                    flex: 1, fontSize: 11, padding: '5px 0', borderRadius: 5, border: '1px solid', cursor: 'pointer', textTransform: 'capitalize',
                    borderColor: form.status === s ? 'var(--accent)' : 'var(--border-mid)',
                    background: form.status === s ? 'var(--accent-dim)' : 'transparent',
                    color: form.status === s ? 'var(--accent)' : 'var(--text-faint)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>FEATURED</label>
            <button
              onClick={() => set('featured', !form.featured)}
              style={{
                width: '100%', fontSize: 11, padding: '5px 0', borderRadius: 5, border: '1px solid', cursor: 'pointer',
                borderColor: form.featured ? 'var(--accent)' : 'var(--border-mid)',
                background: form.featured ? 'var(--accent-dim)' : 'transparent',
                color: form.featured ? 'var(--accent)' : 'var(--text-faint)',
              }}
            >
              {form.featured ? '★ Featured' : '☆ Not Featured'}
            </button>
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>AUTHOR</label>
            <input style={inputStyle} value={form.author_name} onChange={e => set('author_name', e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>TAGS (comma-separated)</label>
            <input style={inputStyle} placeholder="zk, ai, infra" value={form.tags} onChange={e => set('tags', e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>SUBTITLE</label>
            <input style={inputStyle} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>EXCERPT</label>
            <textarea
              style={{ ...inputStyle, height: 72, resize: 'vertical', fontFamily: 'inherit' }}
              value={form.excerpt}
              onChange={e => set('excerpt', e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>COVER IMAGE</label>
            {form.cover_url && (
              <img src={form.cover_url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border-mid)' }} />
            )}
            <input
              type="text"
              style={inputStyle}
              placeholder="https://… or upload below"
              value={form.cover_url}
              onChange={e => set('cover_url', e.target.value)}
            />
            <label style={{ display: 'block', marginTop: 6, cursor: 'pointer' }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', border: '1px dashed var(--border-mid)', borderRadius: 5, padding: '7px 0', textAlign: 'center' }}>
                {uploadingCover ? 'Uploading…' : 'Upload file'}
              </div>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} />
            </label>
          </div>
        </div>

        {/* Editor + preview panes */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: 'column' }}>

          {/* Title field */}
          <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
            <textarea
              placeholder="Article title…"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'none', overflow: 'hidden',
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3,
                fontFamily: 'Georgia, serif', letterSpacing: '-0.02em',
                padding: 0, minHeight: 38,
              }}
              rows={1}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
            />
            <div style={{ height: 1, background: 'var(--border-dim)', margin: '12px 0' }} />
          </div>

          {/* Write / preview area */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {(view === 'write' || view === 'split') && (
              <textarea
                value={form.content}
                onChange={e => set('content', e.target.value)}
                placeholder="Write in markdown…"
                style={{
                  flex: 1, resize: 'none', border: 'none', outline: 'none',
                  background: 'transparent', padding: '0 20px 20px',
                  fontSize: 14, lineHeight: 1.75, color: 'var(--text-soft)',
                  fontFamily: 'var(--font-code)', overflowY: 'auto',
                  borderRight: view === 'split' ? '1px solid var(--border-dim)' : 'none',
                }}
                spellCheck
              />
            )}
            {(view === 'preview' || view === 'split') && (
              <div
                className="article-prose"
                style={{
                  flex: 1, overflowY: 'auto', padding: '0 32px 32px',
                  fontSize: 16, lineHeight: 1.85, color: 'var(--text-soft)',
                  fontFamily: 'Georgia, serif',
                }}
                dangerouslySetInnerHTML={{ __html: previewHtml || '<p style="color:var(--text-faint);font-family:var(--font-code);font-size:13px">Preview will appear here…</p>' }}
              />
            )}
          </div>
        </div>
      </div>

      <style>{`
        .article-prose h1,.article-prose h2,.article-prose h3{color:var(--text);margin:1.8em 0 0.6em;font-family:Georgia,serif;}
        .article-prose h2{font-size:1.4em;}.article-prose h3{font-size:1.15em;}
        .article-prose p{margin:0 0 1.3em;}
        .article-prose code{font-family:var(--font-code);font-size:0.85em;background:var(--bg-card);border:1px solid var(--border-dim);padding:2px 5px;border-radius:4px;color:var(--accent);}
        .article-prose blockquote{margin:1.5em 0;padding:12px 20px;border-left:3px solid var(--accent);background:var(--accent-dim);border-radius:0 6px 6px 0;font-style:italic;}
        .article-prose a{color:var(--accent);}
        .article-prose strong{color:var(--text);}
      `}</style>
    </div>
  );
}
