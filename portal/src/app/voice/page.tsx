'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://explorer-api.exergynet.org';

const METRICS = [
  { label: 'End-to-End Latency', value: '1.24s', sub: 'Whisper STT → Vanguard → Piper TTS' },
  { label: 'ASR Accuracy', value: '98%', sub: 'Under telephone-band noise (G.711 µ-law)' },
  { label: 'Data Privacy', value: '100%', sub: 'On-premise · Zero third-party API leakage' },
];

const PLANS = [
  { name: 'Vanguard Standard', model: 'Sovereign Inference Engine', price: '$0.40', unit: '/ 1M tokens', teal: false },
  { name: 'Vanguard Pro', model: 'Sovereign Reasoning Engine', price: '$0.80', unit: '/ 1M tokens', teal: true },
  { name: 'Acoustic Voice Stream', model: 'Unidirectional TURN relay', price: '$0.002', unit: '/ minute', teal: false },
];

const CURL_MEDIA = `curl -i -N -H "Connection: Upgrade" \\
  -H "Upgrade: websocket" \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  "wss://explorer-api.exergynet.org/media-stream"`;

const TS_MEDIA = `import WebSocket from 'ws';

const ws = new WebSocket(
  'wss://explorer-api.exergynet.org/media-stream',
  { headers: { Authorization: \`Bearer \${process.env.EXERGYNET_API_KEY}\` } }
);

ws.on('open', () => {
  ws.send(JSON.stringify({
    event: 'start',
    streamSid: 'MZ_your_sid',
    mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
  }));
});

ws.on('message', (data) => {
  const frame = JSON.parse(data.toString());
  if (frame.event === 'media') {
    const audio = Buffer.from(frame.media.payload, 'base64');
    // pipe audio → speaker
  }
});`;

const PY_MEDIA = `import asyncio, websockets, json, base64

async def stream():
    uri = "wss://explorer-api.exergynet.org/media-stream"
    headers = {"Authorization": f"Bearer {API_KEY}"}
    async with websockets.connect(uri, extra_headers=headers) as ws:
        await ws.send(json.dumps({
            "event": "start",
            "streamSid": "MZ_your_sid",
            "mediaFormat": {
                "encoding": "audio/x-mulaw",
                "sampleRate": 8000,
                "channels": 1,
            },
        }))
        async for message in ws:
            frame = json.loads(message)
            if frame["event"] == "media":
                audio = base64.b64decode(frame["media"]["payload"])
                # write audio to output

asyncio.run(stream())`;

const CURL_EXTRACT = `curl -X POST ${API}/v1/extract \\
  -H "Authorization: Bearer $EXERGYNET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Patient denies smoking. BP 150/95.",
    "schema": {
      "smoking_status": "boolean",
      "blood_pressure": "string"
    },
    "domain": "clinical"
  }'`;

const TS_EXTRACT = `const res = await fetch(\`\${process.env.EXERGYNET_BASE_URL}/v1/extract\`, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.EXERGYNET_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Patient denies smoking. BP 150/95.',
    schema: { smoking_status: 'boolean', blood_pressure: 'string' },
    domain: 'clinical',
  }),
});
const { extraction } = await res.json();
// extraction.smoking_status === false
// extraction.blood_pressure === "150/95"`;

const PY_EXTRACT = `import requests

resp = requests.post(
    f"{BASE_URL}/v1/extract",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "text": "Patient denies smoking. BP 150/95.",
        "schema": {"smoking_status": "boolean", "blood_pressure": "string"},
        "domain": "clinical",
    },
)
data = resp.json()
print(data["extraction"])
# {'smoking_status': False, 'blood_pressure': '150/95'}`;

type Tab = 'curl' | 'ts' | 'py';

function CodeBlock({ curl, ts, py }: { curl: string; ts: string; py: string }) {
  const [tab, setTab] = useState<Tab>('curl');
  const [copied, setCopied] = useState(false);
  const code = tab === 'curl' ? curl : tab === 'ts' ? ts : py;

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div style={{ border: '1px solid #1E293B', borderRadius: 8, overflow: 'hidden', background: '#060814' }}>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1E293B', background: '#0B1120' }}>
        {(['curl', 'ts', 'py'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 16px',
              fontSize: 10,
              letterSpacing: '0.08em',
              border: 'none',
              borderBottom: tab === t ? '2px solid #0D9488' : '2px solid transparent',
              background: 'transparent',
              color: tab === t ? '#0D9488' : '#475569',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t === 'curl' ? 'cURL' : t === 'ts' ? 'TypeScript' : 'Python'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={copy}
          style={{
            padding: '6px 14px',
            fontSize: 10,
            border: 'none',
            background: 'transparent',
            color: copied ? '#0D9488' : '#334155',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <pre style={{
        padding: 16,
        fontSize: 11,
        color: '#94A3B8',
        overflowX: 'auto',
        lineHeight: 1.7,
        margin: 0,
        fontFamily: 'inherit',
        whiteSpace: 'pre',
      }}>{code}</pre>
    </div>
  );
}

export default function VoicePage() {
  return (
    <div style={{ background: '#060814', minHeight: '100vh', color: '#F8FAFC', fontFamily: 'var(--font-mono, JetBrains Mono, monospace)' }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '96px 24px 72px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '4px 14px',
          border: '1px solid #0D9488',
          borderRadius: 100,
          fontSize: 10,
          letterSpacing: '0.14em',
          color: '#0D9488',
          marginBottom: 28,
        }}>
          SOVEREIGN VOICE STACK v2.1.2 · LIVE
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 600,
          lineHeight: 1.15,
          marginBottom: 20,
          letterSpacing: '-0.02em',
        }}>
          Bringing Voice to Life.{' '}
          <span style={{ color: '#0D9488' }}>Sovereign. Private. Local.</span>
        </h1>

        <p style={{
          fontSize: 14,
          color: '#94A3B8',
          maxWidth: 620,
          margin: '0 auto 36px',
          lineHeight: 1.8,
        }}>
          A completely localized, GPU-accelerated acoustic membrane for clinical and enterprise workloads.
          100% HIPAA compliant. Zero external API leakage.
        </p>

        <a
          href="/auth/register"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: '#0D9488',
            color: '#F8FAFC',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.04em',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0F766E')}
          onMouseLeave={e => (e.currentTarget.style.background = '#0D9488')}
        >
          Get Started — Includes $10.00 Free Developer Credit
        </a>
      </section>

      {/* ── METRICS GRID ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 72px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {METRICS.map(m => (
            <div
              key={m.label}
              className="en-card"
              style={{ background: '#0B1120', borderColor: '#1E293B', textAlign: 'center' }}
            >
              <div style={{ fontSize: 36, fontWeight: 600, color: '#0D9488', marginBottom: 6 }}>{m.value}</div>
              <div style={{ fontSize: 12, color: '#F8FAFC', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.6 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 72px' }}>
        <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.12em', marginBottom: 24, textAlign: 'center' }}>
          ■ PRICING
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {PLANS.map(p => (
            <div
              key={p.name}
              className="en-card"
              style={{
                background: '#0B1120',
                borderColor: p.teal ? '#0D9488' : '#1E293B',
                position: 'relative',
              }}
            >
              {p.teal && (
                <div style={{
                  position: 'absolute',
                  top: -1,
                  right: 16,
                  background: '#0D9488',
                  color: '#F8FAFC',
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  padding: '2px 10px',
                  borderRadius: '0 0 6px 6px',
                }}>
                  RECOMMENDED
                </div>
              )}
              <div style={{ fontSize: 11, color: '#0D9488', marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 16 }}>{p.model}</div>
              <div>
                <span style={{ fontSize: 28, fontWeight: 600, color: '#F8FAFC' }}>{p.price}</span>
                <span style={{ fontSize: 11, color: '#475569', marginLeft: 4 }}>{p.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── API DOCUMENTATION ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 96px' }}>
        <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.12em', marginBottom: 28, textAlign: 'center' }}>
          ■ INTERACTIVE API DOCUMENTATION
        </div>

        {/* /media-stream */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40, alignItems: 'start' }}>
          <div className="en-card" style={{ background: '#0B1120', borderColor: '#1E293B' }}>
            <div style={{ fontSize: 10, color: '#0D9488', letterSpacing: '0.1em', marginBottom: 12 }}>
              ■ ACOUSTIC VOICE STREAM
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 12 }}>
              WebSocket · G.711 µ-law · 8kHz mono · 20ms frames
            </div>
            <code style={{ fontSize: 12, color: '#0D9488', display: 'block', marginBottom: 12 }}>
              wss://explorer-api.exergynet.org/media-stream
            </code>
            <p style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.8, marginBottom: 16 }}>
              Establish a bidirectional Twilio{' '}
              <code style={{ color: '#0D9488' }}>&lt;Connect&gt;&lt;Stream&gt;</code>{' '}
              over WebSocket. The server ingests mulaw audio frames, transcribes via CUDA-Whisper,
              routes through Vanguard, synthesizes a TTS reply, and streams mulaw frames back —
              all within a single 1.24s average round-trip.
            </p>
            <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>REQUIRED HEADERS</div>
            <pre style={{ fontSize: 10, color: '#475569', lineHeight: 1.7, margin: 0 }}>{`Authorization: Bearer <key>
Upgrade: websocket
Connection: Upgrade`}</pre>
          </div>
          <CodeBlock curl={CURL_MEDIA} ts={TS_MEDIA} py={PY_MEDIA} />
        </div>

        {/* /v1/extract */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div className="en-card" style={{ background: '#0B1120', borderColor: '#1E293B' }}>
            <div style={{ fontSize: 10, color: '#0D9488', letterSpacing: '0.1em', marginBottom: 12 }}>
              ■ SOVEREIGN CLINICAL EXTRACTOR
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 12 }}>
              REST · POST · JSON · Schema-aware structured extraction
            </div>
            <code style={{ fontSize: 12, color: '#0D9488', display: 'block', marginBottom: 12 }}>
              POST /v1/extract
            </code>
            <p style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.8, marginBottom: 16 }}>
              Pass raw clinical text and a typed schema — the SEI extractor returns
              structured JSON with per-field confidence scores and
              clarification flags, bypassing conversational prose entirely.
            </p>
            <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>REQUIRED HEADERS</div>
            <pre style={{ fontSize: 10, color: '#475569', lineHeight: 1.7, margin: 0 }}>{`Authorization: Bearer <key>
Content-Type: application/json`}</pre>
          </div>
          <CodeBlock curl={CURL_EXTRACT} ts={TS_EXTRACT} py={PY_EXTRACT} />
        </div>
      </section>

    </div>
  );
}
