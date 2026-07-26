'use client';

import { useEffect, useState } from 'react';
import { adminApi, ScribeEntry } from '@/lib/api';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function VanguardScribePage() {
  const [entries, setEntries] = useState<ScribeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError('');
    adminApi.getEvolution()
      .then(setEntries)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>
            <span style={{ color: 'var(--accent)' }}>■</span> VANGUARD SCRIBE
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>build evolution log</div>
            {!loading && (
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{entries.length} entries</span>
            )}
          </div>
        </div>
        <button
          className="en-btn en-btn-ghost"
          style={{ fontSize: 11, padding: '5px 12px' }}
          onClick={load}
        >
          ↻ refresh
        </button>
      </div>

      {error && (
        <div style={{
          background: 'var(--error-bg)', border: '1px solid var(--error-border)',
          borderRadius: 6, padding: '10px 14px', fontSize: 11, color: 'var(--red)', marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
          <span style={{ color: 'var(--accent)' }}>■</span> loading scribe log…
        </div>
      ) : entries.length === 0 ? (
        <div className="en-card" style={{ textAlign: 'center', padding: 48, fontSize: 11, color: 'var(--text-faint)' }}>
          no scribe entries yet — entries are recorded when OTET tokens are spent with post_state data
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map((e, i) => {
            const key = e.otet + i;
            const isOpen = expanded === key;
            const label = e.file_path || e.target_id || e.otet;
            return (
              <div key={key} className="en-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Row header */}
                <div
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                  onClick={() => setExpanded(isOpen ? null : key)}
                >
                  {/* Left: chevron + otet */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)', lineHeight: 1 }}>
                      {isOpen ? '▼' : '▶'}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-code)',
                      fontSize: 10,
                      color: 'var(--accent)',
                      letterSpacing: '0.04em',
                    }}>
                      {e.otet.slice(0, 16)}…
                    </span>
                  </div>

                  {/* Center: service + label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                      {e.service_name ?? 'unknown service'}
                    </div>
                  </div>

                  {/* Right: diff stats + time */}
                  <div style={{ display: 'flex', gap: 12, flexShrink: 0, alignItems: 'center' }}>
                    {(e.lines_added != null || e.lines_removed != null) && (
                      <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
                        {e.lines_added != null && (
                          <span style={{ color: 'var(--accent)' }}>+{e.lines_added}</span>
                        )}
                        {e.lines_removed != null && (
                          <span style={{ color: 'var(--red)' }}>−{e.lines_removed}</span>
                        )}
                      </div>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                      {timeAgo(e.spent_at)}
                    </span>
                  </div>
                </div>

                {/* Expanded: narrative + hashes */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border-mid)', padding: '14px 16px' }}>
                    {e.narrative && (
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-soft)',
                        lineHeight: 1.7,
                        marginBottom: 14,
                      }}>
                        {e.narrative}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {e.pre_hash && (
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em', marginBottom: 4 }}>PRE HASH</div>
                          <code style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-code)' }}>
                            {e.pre_hash.slice(0, 24)}…
                          </code>
                        </div>
                      )}
                      {e.post_hash && (
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em', marginBottom: 4 }}>POST HASH</div>
                          <code style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-code)' }}>
                            {e.post_hash.slice(0, 24)}…
                          </code>
                        </div>
                      )}
                      {e.file_path && (
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em', marginBottom: 4 }}>FILE</div>
                          <code style={{ fontSize: 10, color: 'var(--text-soft)', fontFamily: 'var(--font-code)' }}>
                            {e.file_path}
                          </code>
                        </div>
                      )}
                    </div>
                    {e.content && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em', marginBottom: 6 }}>CONTENT PREVIEW</div>
                        <pre style={{
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '10px 12px',
                          fontSize: 10, color: 'var(--text-soft)', lineHeight: 1.6,
                          margin: 0, fontFamily: 'var(--font-code)', overflowX: 'auto',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        }}>
                          {e.content}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
