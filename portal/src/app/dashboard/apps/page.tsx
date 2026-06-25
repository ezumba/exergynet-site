'use client';

import { useState, useEffect } from 'react';
async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? (localStorage.getItem('en_token') ?? '') : '';
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers as Record<string, string> || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data as T;
}

type ReviewStatus = 'pending_review' | 'active' | 'rejected' | 'flagged' | 'vanguard_clean';

interface MyApp {
  app_key: string;
  name: string;
  tier: string;
  price_usd: string;
  usage_price_usd: string;
  description: string;
  app_url: string | null;
  icon: string | null;
  review_status: ReviewStatus;
  active: boolean;
  created_at: string;
}

const STATUS_META: Record<ReviewStatus, { label: string; color: string; bg: string }> = {
  pending_review: { label: 'Under Review',    color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  active:         { label: 'Live',            color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
  vanguard_clean: { label: 'Approved',        color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
  flagged:        { label: 'Flagged',         color: '#EF4444', bg: 'rgba(239,68,68,0.10)'  },
  rejected:       { label: 'Rejected',        color: '#6B7280', bg: 'rgba(107,114,128,0.10)'},
};

const CATEGORIES = ['Analytics', 'AI', 'Markets', 'Proofs', 'Documents', 'Collaboration', 'Oracle', 'Verification', 'Other'];

export default function MyAppsPage() {
  const [apps, setApps] = useState<MyApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    app_key: '', name: '', price_usd: '0', usage_price_usd: '0',
    description: '', app_url: '', icon: '', icon_url: '',
    category: 'Analytics', tags: '',
  });

  useEffect(() => { fetchApps(); }, []);

  async function fetchApps() {
    setLoading(true);
    try {
      const data = await apiFetch<{ apps: MyApp[] }>('/api/apps/mine');
      setApps(data.apps || []);
    } catch { /* handled by apiFetch */ }
    finally { setLoading(false); }
  }

  function field(k: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [k]: val }));
    if (k === 'name' && !form.app_key) {
      setForm(f => ({ ...f, app_key: val.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40) }));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      const body = {
        ...form,
        price_usd: parseFloat(form.price_usd) || 0,
        usage_price_usd: parseFloat(form.usage_price_usd) || 0,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        app_url: form.app_url || undefined,
        icon: form.icon || undefined,
        icon_url: form.icon_url || undefined,
      };
      await apiFetch('/api/apps/submit', { method: 'POST', body: JSON.stringify(body) });
      setSuccess('App submitted! Vanguard will scan it and an admin will review shortly.');
      setShowForm(false);
      setForm({ app_key: '', name: '', price_usd: '0', usage_price_usd: '0',
        description: '', app_url: '', icon: '', icon_url: '', category: 'Analytics', tags: '' });
      fetchApps();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally { setSubmitting(false); }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#F1F5F9', letterSpacing: '-0.02em' }}>My Apps</div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
            Submit apps for Vanguard governance review — approved apps appear in the ExergyNet App Store.
          </div>
        </div>
        <button
          onClick={() => { setShowForm(s => !s); setError(''); setSuccess(''); }}
          style={{ background: '#0D9488', color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.01em' }}>
          {showForm ? '✕ Cancel' : '+ Submit App'}
        </button>
      </div>

      {/* Governance explanation */}
      <div style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.18)',
        borderRadius: 10, padding: '16px 20px', marginBottom: 28, fontSize: 13, color: '#94A3B8', lineHeight: 1.7 }}>
        <strong style={{ color: '#0D9488' }}>Vanguard Governance Flow</strong><br />
        Submit → Vanguard scans for content risk &amp; integrity → Admin reviews score → Approved apps go live in the App Store
      </div>

      {success && (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#10B981' }}>
          ✓ {success}
        </div>
      )}

      {/* Submission Form */}
      {showForm && (
        <form onSubmit={submit} style={{ background: '#0F1923', border: '1px solid #1E293B',
          borderRadius: 12, padding: 28, marginBottom: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#F1F5F9', marginBottom: 24 }}>Submit App for Review</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>App Name *</label>
              <input value={form.name} onChange={e => field('name', e.target.value)}
                placeholder="My Awesome App" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>App Key * <span style={{ color: '#475569', fontWeight: 400 }}>(unique ID)</span></label>
              <input value={form.app_key} onChange={e => field('app_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="my_awesome_app" required style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Description * <span style={{ color: '#475569', fontWeight: 400 }}>(min 10 chars)</span></label>
            <textarea value={form.description} onChange={e => field('description', e.target.value)}
              placeholder="What does your app do? Be specific — Vanguard evaluates this." required rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>App URL <span style={{ color: '#475569', fontWeight: 400 }}>(https://)</span></label>
              <input value={form.app_url} onChange={e => field('app_url', e.target.value)}
                placeholder="https://yourapp.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => field('category', e.target.value)} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Monthly Price (USD)</label>
              <input type="number" min="0" max="9999" step="0.01" value={form.price_usd}
                onChange={e => field('price_usd', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Per-Use Price (USD)</label>
              <input type="number" min="0" max="9999" step="0.001" value={form.usage_price_usd}
                onChange={e => field('usage_price_usd', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Icon Emoji</label>
              <input value={form.icon} onChange={e => field('icon', e.target.value)}
                placeholder="🚀" maxLength={4} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>Icon URL <span style={{ color: '#475569', fontWeight: 400 }}>(https://)</span></label>
              <input value={form.icon_url} onChange={e => field('icon_url', e.target.value)}
                placeholder="https://yourapp.com/icon.png" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tags <span style={{ color: '#475569', fontWeight: 400 }}>(comma-separated, max 4)</span></label>
              <input value={form.tags} onChange={e => field('tags', e.target.value)}
                placeholder="AI, Real-time, Analytics" style={inputStyle} />
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#EF4444' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={submitting}
              style={{ background: submitting ? '#164E63' : '#0D9488', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
            <div style={{ fontSize: 12, color: '#475569' }}>
              Vanguard will scan your app automatically after submission.
            </div>
          </div>
        </form>
      )}

      {/* App List */}
      {loading ? (
        <div style={{ color: '#475569', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>Loading…</div>
      ) : apps.length === 0 ? (
        <div style={{ background: '#0F1923', border: '1px solid #1E293B', borderRadius: 12,
          padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
          <div style={{ fontSize: 15, color: '#CBD5E1', marginBottom: 6 }}>No apps submitted yet</div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            Click "Submit App" to register your app for Vanguard review.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {apps.map(app => {
            const st = STATUS_META[app.review_status] ?? STATUS_META.pending_review;
            return (
              <div key={app.app_key} style={{ background: '#0F1923', border: '1px solid #1E293B',
                borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#1E293B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {app.icon || '◈'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#F1F5F9' }}>{app.name}</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>{app.app_key}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      color: st.color, background: st.bg, fontWeight: 500 }}>{st.label}</span>
                    {app.active && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        color: '#10B981', background: 'rgba(16,185,129,0.10)', fontWeight: 500 }}>LIVE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748B', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                    {app.description}
                  </div>
                  <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>
                    {app.tier} · ${app.price_usd}/mo · ${app.usage_price_usd}/use
                    {app.app_url && (
                      <> · <a href={app.app_url} target="_blank" rel="noreferrer"
                        style={{ color: '#0D9488', textDecoration: 'none' }}>{app.app_url}</a></>
                    )}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  {app.review_status === 'rejected' && (
                    <button onClick={() => { setShowForm(true); setForm(f => ({ ...f, app_key: app.app_key, name: app.name, description: app.description, app_url: app.app_url || '', icon: app.icon || '' })); }}
                      style={{ fontSize: 12, color: '#0D9488', background: 'transparent', border: '1px solid #0D9488',
                        borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
                      Resubmit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#64748B',
  letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0A1220', border: '1px solid #1E293B', borderRadius: 7,
  padding: '9px 12px', fontSize: 13, color: '#CBD5E1', outline: 'none', boxSizing: 'border-box',
};
