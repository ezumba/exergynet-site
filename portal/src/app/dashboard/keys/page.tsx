'use client';

import { useState, useEffect } from 'react';
import { auth, developer, Developer } from '@/lib/api';
import { API_SERVICES as SERVICES } from '@/lib/apiServicesManifest';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://explorer-api.exergynet.org';

// ── Shared helpers ───────────────────────────────────────────────────────────

function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      className="en-btn en-btn-ghost"
      style={{ padding: small ? '3px 8px' : '4px 10px', fontSize: 10 }}
      onClick={copy}
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  );
}

type CodeTab = 'curl' | 'ts' | 'py';

function ServiceCodeBlock({ curl, ts, py }: { curl: string; ts: string; py: string }) {
  const [tab, setTab] = useState<CodeTab>('curl');
  const code = tab === 'curl' ? curl : tab === 'ts' ? ts : py;
  return (
    <div style={{ border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-mid)', background: 'var(--bg)' }}>
        {(['curl', 'ts', 'py'] as CodeTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '5px 14px', fontSize: 10, letterSpacing: '0.08em', border: 'none',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-faint)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {t === 'curl' ? 'cURL' : t === 'ts' ? 'TypeScript' : 'Python'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <CopyButton text={code} small />
      </div>
      <pre style={{
        padding: '14px 16px', fontSize: 11, color: 'var(--text-soft)', overflowX: 'auto',
        lineHeight: 1.7, margin: 0, fontFamily: 'inherit', whiteSpace: 'pre',
      }}>{code}</pre>
    </div>
  );
}

// ── Service definitions now live in @/lib/apiServicesManifest ───────────────
// (single source of truth shared with the public api-integration.html page —
// see that file for why this was extracted)

// ── Main component ───────────────────────────────────────────────────────────

export default function KeysPage() {
  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState<{ api_key: string; note: string } | null>(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [dev, setDev] = useState<Developer | null>(null);
  const [activeService, setActiveService] = useState('standard');

  useEffect(() => {
    developer.me().then(setDev).catch(() => {});
  }, []);

  async function handleRotate() {
    if (!confirmed) { setConfirmed(true); return; }
    setRotating(true);
    setError('');
    try {
      const res = await auth.rotateKey();
      setNewKey({ api_key: res.api_key, note: res.note });
      setConfirmed(false);
    } catch (e: any) {
      setError(e.message);
      setConfirmed(false);
    } finally {
      setRotating(false);
    }
  }

  const svc = SERVICES.find(s => s.id === activeService) ?? SERVICES[0];

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>
          <span style={{ color: 'var(--accent)' }}>■</span> API KEYS & SERVICES
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>key management</div>
      </div>

      {/* ── New key reveal ─────────────────────────────────────────────── */}
      {newKey && (
        <div className="en-card" style={{ borderColor: 'var(--accent)', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 8 }}>
            ■ NEW KEY GENERATED — COPY NOW
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', marginBottom: 12, lineHeight: 1.7 }}>{newKey.note}</div>
          <div style={{
            background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '12px 14px', fontFamily: 'inherit', fontSize: 12,
            color: 'var(--accent)', wordBreak: 'break-all', marginBottom: 12,
          }}>{newKey.api_key}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <CopyButton text={newKey.api_key} />
            <button
              className="en-btn en-btn-ghost"
              style={{ fontSize: 10, padding: '4px 10px', color: 'var(--red)', borderColor: 'var(--error-border)' }}
              onClick={() => setNewKey(null)}
            >
              dismiss (key will not be shown again)
            </button>
          </div>
        </div>
      )}

      {/* ── Current key + rotation ─────────────────────────────────────── */}
      <div className="en-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
            {dev?.api_key_preview ? 'CURRENT KEY' : 'API KEY'}
          </div>
          {dev?.created_at && (
            <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
              account created {new Date(dev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
        {dev === null ? (
          <div style={{ height: 38, background: 'var(--bg-input)', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 14, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            background: 'var(--bg-input)', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 14,
          }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--accent)', fontFamily: 'inherit', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {dev.api_key_preview || 'no key yet — generate one below'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>preview · full key never stored</span>
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14, lineHeight: 1.7 }}>
          {dev?.api_key_preview
            ? 'Rotating immediately invalidates this key and generates a new one, shown exactly once — store it securely before dismissing.'
            : 'Generate your API key to start using ExergyNet services. The full key is shown once — copy it immediately.'}
        </div>
        {error && (
          <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--red)', marginBottom: 12 }}>{error}</div>
        )}
        {confirmed && !rotating && (
          <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--amber)', marginBottom: 12 }}>
            ⚠ This will invalidate your current API key immediately. Click rotate again to confirm.
          </div>
        )}
        <button
          className="en-btn"
          style={{
            background: confirmed ? 'var(--red)' : 'var(--bg-card)',
            color: confirmed ? 'white' : 'var(--text-soft)',
            border: `1px solid ${confirmed ? 'var(--error-border)' : 'var(--border)'}`,
          }}
          onClick={handleRotate}
          disabled={rotating}
        >
          {rotating
            ? 'generating…'
            : confirmed
              ? '⚠ confirm — generate new key'
              : dev?.api_key_preview
                ? 'rotate api key'
                : '+ generate api key'}
        </button>
      </div>

      {/* ── Active Sovereign API Services ─────────────────────────────── */}
      <div className="en-card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 4 }}>
            ■ ACTIVE SOVEREIGN API SERVICES
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{SERVICES.length} services · portal.exergynet.org + explorer-api.exergynet.org</div>
        </div>

        {/* Service tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-mid)', overflowX: 'auto', background: 'var(--bg)' }}>
          {SERVICES.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveService(s.id)}
              style={{
                padding: '8px 16px',
                fontSize: 10,
                letterSpacing: '0.06em',
                border: 'none',
                borderBottom: activeService === s.id ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color: activeService === s.id ? 'var(--accent)' : 'var(--text-faint)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Service detail */}
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>{svc.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{svc.sub}</div>
          </div>

          {/* Endpoint row */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6 }}>ENDPOINT</div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 12px',
            }}>
              <code style={{ flex: 1, fontSize: 11, color: 'var(--accent)', wordBreak: 'break-all', fontFamily: 'inherit' }}>
                {svc.endpoint}
              </code>
              <CopyButton text={svc.endpoint} small />
            </div>
          </div>

          {/* Routing + headers row */}
          <div className="en-stat-grid-2" style={{ gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6 }}>ROUTING</div>
              <div style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px',
                fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.6,
              }}>
                {svc.routing}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6 }}>REQUIRED HEADERS</div>
              <pre style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px',
                fontSize: 10, color: 'var(--text-soft)', lineHeight: 1.7, margin: 0,
                fontFamily: 'inherit',
              }}>{svc.headers}</pre>
            </div>
          </div>

          {/* Code block */}
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 8 }}>LIVE CODE SNIPPET</div>
            <ServiceCodeBlock curl={svc.curl} ts={svc.ts} py={svc.py} />
          </div>
        </div>
      </div>

      {/* ── Environment variables ──────────────────────────────────────── */}
      <div className="en-card">
        <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 14 }}>
          ENVIRONMENT VARIABLES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { key: 'EXERGYNET_API_KEY',        value: dev?.api_key_preview ?? 'sk-exergy-••••••••••••••••',                          note: 'your API key' },
            { key: 'EXERGYNET_BASE_URL',        value: `${API}/v1`,                                                                   note: 'inference endpoint' },
            { key: 'OPENAI_BASE_URL',           value: `${API}/v1`,                                                                   note: 'openai-compatible' },
            { key: 'EXERGYNET_MCP_SSE',         value: 'https://mcp.exergynet.org/sse',                                               note: 'Omega Carrier MCP' },
            { key: 'EXERGYNET_VAULT_IMAGE_ID',  value: '0xb226f60a6a3406e5cd3792b4bbe86ed996e2e2cc8dd31ddbe7989a20a897092d',         note: 'Vault ZK image ID' },
          ].map(({ key, value, note }) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', background: 'var(--bg-input)',
              borderRadius: 6, border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>{key}</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', margin: '0 4px' }}>=</span>
              <span style={{ fontSize: 11, color: 'var(--text-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {value}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>{note}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
