'use client';

import { useState, useRef, useEffect } from 'react';
import { streamCompletion } from '@/lib/api';

const PRESETS = [
  { label: 'biotech summary', prompt: 'Summarize the mechanism of action of gallium-based anticancer compounds in 3 sentences.' },
  { label: 'protein folding', prompt: 'Explain how alpha-synuclein misfolding contributes to Parkinson\'s disease pathogenesis.' },
  { label: 'fdc design', prompt: 'Propose a metal-based FDC targeting tumour hypoxia. Include metal choice, trigger type, and selectivity logic.' },
  { label: 'entropy audit', prompt: 'What is an entropy class 2 compound? List the validation gaps that would need to be resolved before Tier 3 promotion.' },
];

type LogEntry = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: string;
  tokenCount?: number;
};

export default function PlaygroundPage() {
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [currentBuffer, setCurrentBuffer] = useState('');
  const [tokenCount, setTokenCount] = useState(0);
  const [useSessionAuth, setUseSessionAuth] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [log, currentBuffer]);

  async function handleRun() {
    const q = prompt.trim();
    if (!q) return;
    if (!useSessionAuth && !apiKey.trim()) { alert('Enter an API key or enable session auth'); return; }

    const key = useSessionAuth
      ? (localStorage.getItem('en_token') ?? '')
      : apiKey.trim();

    const userEntry: LogEntry = {
      id: crypto.randomUUID(),
      role: 'user',
      content: q,
      ts: new Date().toLocaleTimeString(),
    };
    setLog(prev => [...prev, userEntry]);
    setPrompt('');
    setStreaming(true);
    setCurrentBuffer('');
    setTokenCount(0);

    let buffer = '';
    let tokens = 0;

    await streamCompletion(
      key,
      q,
      (token) => {
        buffer += token;
        tokens++;
        setCurrentBuffer(buffer);
        setTokenCount(tokens);
      },
      () => {
        const assistantEntry: LogEntry = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: buffer,
          ts: new Date().toLocaleTimeString(),
          tokenCount: tokens,
        };
        setLog(prev => [...prev, assistantEntry]);
        setCurrentBuffer('');
        setTokenCount(0);
        setStreaming(false);
      },
      (err) => {
        const errEntry: LogEntry = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠ Error: ${err}`,
          ts: new Date().toLocaleTimeString(),
        };
        setLog(prev => [...prev, errEntry]);
        setCurrentBuffer('');
        setStreaming(false);
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !streaming) {
      handleRun();
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>

      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>
          <span style={{ color: 'var(--accent)' }}>■</span> INFERENCE PLAYGROUND
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>vanguard engine</div>
      </div>

      {/* Auth config */}
      <div className="en-card" style={{ marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text-faint)' }}>
            <input
              type="checkbox"
              checked={useSessionAuth}
              onChange={e => setUseSessionAuth(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            use session token
          </label>
          {!useSessionAuth && (
            <input
              className="en-input"
              type="password"
              placeholder="sk-exergy-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ flex: 1, fontSize: 11 }}
            />
          )}
          <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-faint)', display: 'flex', gap: 12 }}>
            <span>model: <span style={{ color: 'var(--accent)' }}>vanguard-engine</span></span>
            <span>streaming: <span style={{ color: 'var(--accent)' }}>SSE</span></span>
          </div>
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        {PRESETS.map(p => (
          <button
            key={p.label}
            className="en-btn en-btn-ghost"
            style={{ fontSize: 10, padding: '4px 10px' }}
            onClick={() => setPrompt(p.prompt)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Output log */}
      <div
        ref={outputRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid #1E293B',
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          lineHeight: 1.8,
        }}
      >
        {log.length === 0 && !streaming && (
          <div style={{ color: 'var(--text-faint)', textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>▷</div>
            <div>send a prompt to start streaming from vanguard engine</div>
            <div style={{ marginTop: 6, fontSize: 10 }}>ctrl+enter to run · or click run</div>
          </div>
        )}

        {log.map(entry => (
          <div key={entry.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 10,
                color: entry.role === 'user' ? 'var(--amber)' : 'var(--accent)',
                letterSpacing: '0.08em',
              }}>
                {entry.role === 'user' ? '◇ USER' : '■ VANGUARD'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{entry.ts}</span>
              {entry.tokenCount && (
                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>· {entry.tokenCount} tokens</span>
              )}
            </div>
            <div style={{
              color: entry.content.startsWith('⚠')
                ? 'var(--red)'
                : entry.role === 'user'
                  ? 'var(--text-soft)'
                  : 'var(--text-soft)',
              paddingLeft: 12,
              borderLeft: `2px solid ${entry.role === 'user' ? 'var(--amber)' : 'var(--accent)'}20`,
            }}>
              {entry.content}
            </div>
          </div>
        ))}

        {/* Live streaming buffer */}
        {streaming && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em' }}>■ VANGUARD</span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{tokenCount} tokens</span>
              <span style={{ fontSize: 10, color: 'var(--accent)', animation: 'pulse 1s infinite' }}>streaming…</span>
            </div>
            <div style={{ color: 'var(--text-soft)', paddingLeft: 12, borderLeft: '2px solid var(--accent-dim)' }}>
              {currentBuffer}
              <span style={{
                display: 'inline-block',
                width: 7,
                height: 14,
                background: 'var(--accent)',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                animation: 'blink 0.8s step-end infinite',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            className="en-input"
            placeholder="Enter your prompt… (Ctrl+Enter to run)"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            rows={3}
            style={{ flex: 1, resize: 'none', lineHeight: 1.6 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              className="en-btn en-btn-primary"
              style={{ height: '100%', minWidth: 80, justifyContent: 'center', fontSize: 12 }}
              onClick={handleRun}
              disabled={streaming || !prompt.trim()}
            >
              {streaming ? '…' : 'run ▷'}
            </button>
            {log.length > 0 && !streaming && (
              <button
                className="en-btn en-btn-ghost"
                style={{ fontSize: 10, padding: '4px 8px' }}
                onClick={() => setLog([])}
              >
                clear
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
