'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi, OtetEntry } from '@/lib/api';

const SERVICES = ['All', 'biological_proxy', 'exergynet-portal', 'carrier-exergynet_api'];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  UNSPENT: { bg: 'var(--success-bg)',  color: 'var(--accent)',      border: 'var(--accent-dark)' },
  SPENT:   { bg: 'var(--bg-card)',     color: 'var(--text-faint)', border: 'var(--border)' },
  EXPIRED: { bg: 'var(--warn-bg)',     color: 'var(--amber)',       border: 'var(--warn-border)' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.SPENT;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      fontSize: 10, fontWeight: 500, letterSpacing: '0.05em',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {status.toLowerCase()}
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const PAGE_SIZE = 50;

export default function OtetLedgerPage() {
  const [entries, setEntries]   = useState<OtetEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [service, setService]   = useState('All');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Issue Token modal state
  const [showIssue, setShowIssue]       = useState(false);
  const [issueService, setIssueService] = useState('biological_proxy');
  const [issueTarget, setIssueTarget]   = useState('');
  const [issueHash, setIssueHash]       = useState('');
  const [issuing, setIssuing]           = useState(false);
  const [issuedToken, setIssuedToken]   = useState<string | null>(null);
  const [issueError, setIssueError]     = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminApi.getLedger({
      service: service === 'All' ? undefined : service,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then(r => { setEntries(r.entries); setTotal(r.total); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [service, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setIssuing(true);
    setIssueError('');
    setIssuedToken(null);
    try {
      const res = await adminApi.issueOtet({
        service_name: issueService,
        target_id:    issueTarget.trim(),
        state_hash:   issueHash.trim() || undefined,
      });
      setIssuedToken(res.otet);
      setIssueTarget('');
      setIssueHash('');
      load();
    } catch (err: any) {
      setIssueError(err.message);
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>
            <span style={{ color: 'var(--accent)' }}>■</span> OTET LEDGER
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>build audit ledger</div>
            {!loading && (
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{total.toLocaleString()} records</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="en-btn en-btn-ghost"
            style={{ fontSize: 11, padding: '5px 12px' }}
            onClick={load}
          >
            ↻ refresh
          </button>
          <button
            className="en-btn en-btn-primary"
            style={{ fontSize: 11, padding: '5px 14px' }}
            onClick={() => { setShowIssue(v => !v); setIssuedToken(null); setIssueError(''); }}
          >
            ＋ Issue Token
          </button>
        </div>
      </div>

      {/* Issue Token panel */}
      {showIssue && (
        <div className="en-card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 14 }}>
            ■ ISSUE OTET
          </div>
          {issuedToken ? (
            <div>
              <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 8 }}>■ TOKEN ISSUED — COPY NOW</div>
              <div style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '10px 14px',
                fontSize: 11, color: 'var(--accent)', wordBreak: 'break-all', marginBottom: 10,
                fontFamily: 'var(--font-code)',
              }}>
                {issuedToken}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="en-btn en-btn-ghost"
                  style={{ fontSize: 10 }}
                  onClick={() => navigator.clipboard.writeText(issuedToken)}
                >
                  copy token
                </button>
                <button
                  className="en-btn en-btn-ghost"
                  style={{ fontSize: 10 }}
                  onClick={() => setIssuedToken(null)}
                >
                  issue another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleIssue} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                <label style={{ fontSize: 10, color: 'var(--text-faint)' }}>SERVICE</label>
                <select
                  value={issueService}
                  onChange={e => setIssueService(e.target.value)}
                  className="en-input"
                  style={{ fontSize: 11 }}
                >
                  {SERVICES.filter(s => s !== 'All').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 10, color: 'var(--text-faint)' }}>TARGET ID</label>
                <input
                  type="text"
                  placeholder="developer_credit:abc123"
                  value={issueTarget}
                  onChange={e => setIssueTarget(e.target.value)}
                  className="en-input"
                  style={{ fontSize: 11 }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                <label style={{ fontSize: 10, color: 'var(--text-faint)' }}>STATE HASH (optional)</label>
                <input
                  type="text"
                  placeholder="auto-generated if empty"
                  value={issueHash}
                  onChange={e => setIssueHash(e.target.value)}
                  className="en-input"
                  style={{ fontSize: 11 }}
                />
              </div>
              <button
                type="submit"
                className="en-btn en-btn-primary"
                style={{ fontSize: 11, alignSelf: 'flex-end' }}
                disabled={issuing}
              >
                {issuing ? 'issuing…' : 'issue'}
              </button>
            </form>
          )}
          {issueError && (
            <div style={{
              marginTop: 10, background: 'var(--error-bg)', border: '1px solid var(--error-border)',
              borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--red)',
            }}>
              {issueError}
            </div>
          )}
        </div>
      )}

      {/* Service filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {SERVICES.map(s => (
          <button
            key={s}
            className="en-btn"
            onClick={() => { setService(s); setPage(0); }}
            style={{
              fontSize: 10,
              padding: '4px 12px',
              background: service === s ? 'var(--accent)' : 'var(--bg-card)',
              color: service === s ? '#000' : 'var(--text-faint)',
              border: `1px solid ${service === s ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 4,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      {error && (
        <div style={{
          background: 'var(--error-bg)', border: '1px solid var(--error-border)',
          borderRadius: 6, padding: '10px 14px', fontSize: 11, color: 'var(--red)', marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      <div className="en-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
            <span style={{ color: 'var(--accent)' }}>■</span> loading…
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
            no entries found{service !== 'All' ? ` for service: ${service}` : ''}
          </div>
        ) : (
          <table className="en-table" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 16px', width: 140 }}>TOKEN</th>
                <th style={{ padding: '10px 16px', width: 160 }}>SERVICE</th>
                <th style={{ padding: '10px 16px' }}>TARGET ID</th>
                <th style={{ padding: '10px 16px', width: 90 }}>STATUS</th>
                <th style={{ padding: '10px 16px', width: 90 }}>ISSUED</th>
                <th style={{ padding: '10px 16px', width: 90 }}>SPENT</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.otet}>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-code)', color: 'var(--accent)', fontSize: 10 }}>
                    {e.otet.slice(0, 16)}…
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-soft)', fontSize: 10 }}>
                    {e.service_name}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-faint)', fontSize: 10, fontFamily: 'var(--font-code)' }}>
                    {e.target_id}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <StatusBadge status={e.status} />
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-faint)', fontSize: 10 }}>
                    {timeAgo(e.issued_at)}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-faint)', fontSize: 10 }}>
                    {e.spent_at ? timeAgo(e.spent_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-mid)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="en-btn en-btn-ghost"
              style={{ fontSize: 10, padding: '4px 10px' }}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              ← prev
            </button>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
              page {page + 1} of {totalPages}
            </span>
            <button
              className="en-btn en-btn-ghost"
              style={{ fontSize: 10, padding: '4px 10px' }}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
