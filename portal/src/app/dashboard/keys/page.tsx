'use client';

import { useState, useEffect } from 'react';
import { auth, developer, Developer } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function CopyButton({ text }: { text: string }) {
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
      style={{ padding: '4px 10px', fontSize: 10 }}
      onClick={copy}
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  );
}

export default function KeysPage() {
  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState<{ api_key: string; note: string } | null>(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [dev, setDev] = useState<Developer | null>(null);

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

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#334155', letterSpacing: '0.08em', marginBottom: 6 }}>
          <span style={{ color: '#0D9488' }}>■</span> API KEYS
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: '#F8FAFC' }}>key management</div>
      </div>

      {/* New key reveal */}
      {newKey && (
        <div
          className="en-card"
          style={{ borderColor: '#0D9488', marginBottom: 16 }}
        >
          <div style={{ fontSize: 10, color: '#0D9488', letterSpacing: '0.08em', marginBottom: 8 }}>
            ■ NEW KEY GENERATED — COPY NOW
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12, lineHeight: 1.7 }}>
            {newKey.note}
          </div>
          <div style={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '12px 14px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            color: '#0D9488',
            wordBreak: 'break-all',
            marginBottom: 12,
          }}>
            {newKey.api_key}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <CopyButton text={newKey.api_key} />
            <button
              className="en-btn en-btn-ghost"
              style={{ fontSize: 10, padding: '4px 10px', color: '#EF4444', borderColor: '#991B1B' }}
              onClick={() => setNewKey(null)}
            >
              dismiss (key will not be shown again)
            </button>
          </div>
        </div>
      )}

      {/* Current key preview + rotation, combined so the rotate action sits right where
          the key it affects is shown, instead of a separate card further down the page. */}
      <div className="en-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.08em', marginBottom: 14 }}>
          CURRENT KEY
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            background: '#0F172A',
            borderRadius: 6,
            border: '1px solid #1E293B',
            marginBottom: 14,
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 12,
              color: '#0D9488',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.04em',
            }}
          >
            {dev?.api_key_preview ?? 'sk-exergy-••••••••••••••••'}
          </span>
          <span style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>
            preview · full key never stored
          </span>
        </div>

        <div style={{ fontSize: 11, color: '#475569', marginBottom: 14, lineHeight: 1.7 }}>
          Rotating immediately invalidates this key and generates a new one, shown exactly
          once — store it securely before dismissing.
        </div>

        {error && (
          <div style={{ background: '#2D0808', border: '1px solid #991B1B', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#EF4444', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {confirmed && !rotating && (
          <div style={{ background: '#2D1D06', border: '1px solid #92400E', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#D97706', marginBottom: 12 }}>
            ⚠ This will invalidate your current API key immediately. Click rotate again to confirm.
          </div>
        )}

        <button
          className="en-btn"
          style={{
            background: confirmed ? '#EF4444' : '#1E293B',
            color: confirmed ? 'white' : '#94A3B8',
            border: `1px solid ${confirmed ? '#991B1B' : '#334155'}`,
          }}
          onClick={handleRotate}
          disabled={rotating}
        >
          {rotating ? 'rotating…' : confirmed ? '⚠ confirm rotate key' : 'rotate api key'}
        </button>
      </div>

      {/* Integration examples */}
      <div className="en-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.08em', marginBottom: 14 }}>
          INTEGRATION — OPENAI-COMPATIBLE
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>Python / openai SDK</div>
          <pre className="en-code" style={{ fontSize: 11 }}>{`from openai import OpenAI

client = OpenAI(
    api_key="sk-exergy-••••••••••••••••",
    base_url="${API}/v1"
)

response = client.chat.completions.create(
    model="vanguard-engine",
    messages=[{"role": "user", "content": "..."}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")`}
          </pre>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>cURL</div>
          <pre className="en-code" style={{ fontSize: 11 }}>{`curl ${API}/v1/chat/completions \\
  -H "Authorization: Bearer sk-exergy-••••••••••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "vanguard-engine",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'`}
          </pre>
        </div>

        <div>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>JavaScript (streaming)</div>
          <pre className="en-code" style={{ fontSize: 11 }}>{`const res = await fetch("${API}/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-exergy-••••••••••••••••",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "vanguard-engine",
    messages: [{ role: "user", content: "Hello" }],
    stream: true
  })
});

const reader = res.body.getReader();
// ... read SSE stream`}
          </pre>
        </div>
      </div>

      {/* Environment variable reference */}
      <div className="en-card">
        <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.08em', marginBottom: 14 }}>
          ENVIRONMENT VARIABLES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { key: 'EXERGYNET_API_KEY', value: dev?.api_key_preview ?? 'sk-exergy-••••••••••••••••', note: 'your API key' },
            { key: 'EXERGYNET_BASE_URL', value: `${API}/v1`, note: 'inference endpoint' },
            { key: 'OPENAI_BASE_URL', value: `${API}/v1`, note: 'if using openai SDK' },
          ].map(({ key, value, note }) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                background: '#0F172A',
                borderRadius: 6,
                border: '1px solid #1E293B',
              }}
            >
              <span style={{ fontSize: 11, color: '#0D9488', flexShrink: 0 }}>{key}</span>
              <span style={{ fontSize: 11, color: '#334155', margin: '0 4px' }}>=</span>
              <span style={{ fontSize: 11, color: '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
              </span>
              <span style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>{note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
