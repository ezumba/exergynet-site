'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { developer, Job, JobsResponse } from '@/lib/api';

const STATUS_BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  QUEUED:  { bg: 'var(--warn-bg)', color: 'var(--amber)', border: 'var(--warn-border)', label: 'queued'  },
  SETTLED: { bg: 'var(--success-bg)', color: 'var(--accent)', border: 'var(--accent-dark)', label: 'settled' },
  PENDING: { bg: 'var(--bg-card)', color: 'var(--text-faint)', border: 'var(--text-faint)', label: 'pending' },
  ERROR:   { bg: 'var(--error-bg)', color: 'var(--red)', border: 'var(--error-border)', label: 'error'   },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.PENDING;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      fontSize: 10, fontWeight: 500, letterSpacing: '0.05em',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

function truncate(str: string, n: number) {
  return str && str.length > n ? str.slice(0, n) + '…' : str;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const PAGE_SIZE = 20;

export default function SettlementsPage() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    developer.jobs({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      status: statusFilter || undefined,
    })
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>
          <span style={{ color: 'var(--accent)' }}>■</span> SETTLEMENTS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>pending settlements</div>
          {data && (
            <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 8 }}>
              {data.total.toLocaleString()} records
            </span>
          )}
          <button
            className="en-btn en-btn-ghost"
            style={{ marginLeft: 'auto', fontSize: 11, padding: '5px 12px' }}
            onClick={load}
          >
            ↻ refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['', 'QUEUED', 'SETTLED', 'PENDING', 'ERROR'].map(s => (
          <button
            key={s || 'all'}
            className="en-btn"
            onClick={() => { setStatusFilter(s); setPage(0); }}
            style={{
              fontSize: 10,
              padding: '4px 12px',
              background: statusFilter === s ? 'var(--accent)' : 'var(--bg-card)',
              color: statusFilter === s ? 'white' : 'var(--text-faint)',
              border: `1px solid ${statusFilter === s ? 'var(--accent)' : 'var(--text-faint)'}`,
              borderRadius: 4,
            }}
          >
            {s || 'all'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="en-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
            <span style={{ color: 'var(--accent)' }}>■</span> loading…
          </div>
        ) : !data || data.jobs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
            no settlements found
            {statusFilter && ` with status: ${statusFilter}`}
          </div>
        ) : (
          <table className="en-table" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 16px', width: 100 }}>JOB ID</th>
                <th style={{ padding: '10px 16px' }}>PROMPT HASH</th>
                <th style={{ padding: '10px 16px', width: 80 }}>TOKENS</th>
                <th style={{ padding: '10px 16px', width: 90 }}>BYPASSED</th>
                <th style={{ padding: '10px 16px', width: 90 }}>STATUS</th>
                <th style={{ padding: '10px 16px', width: 80 }}>ON-CHAIN</th>
                <th style={{ padding: '10px 16px', width: 80 }}>AGE</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((job: Job) => (
                <React.Fragment key={job.job_id}>
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === job.job_id ? null : job.job_id)}
                  >
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--accent)', fontSize: 11 }}>
                      {job.job_id.slice(0, 8)}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--text-faint)', fontSize: 10 }}>
                      {truncate(job.prompt_hash ?? '—', 20)}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', textAlign: 'right' }}>
                      {job.tokens_yielded.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-soft)', textAlign: 'right' }}>
                      {job.bypassed_layers}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <StatusBadge status={job.zk_proof_status} />
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-faint)', fontSize: 10 }}>
                      {job.on_chain_sig ? (
                        <span style={{ color: 'var(--accent)' }}>
                          {job.on_chain_sig.slice(0, 8)}…
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-faint)', fontSize: 10 }}>
                      {timeAgo(job.created_at)}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === job.job_id && (
                    <tr>
                      <td colSpan={7} style={{ padding: '0 16px 12px' }}>
                        <div style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid #1E293B',
                          borderRadius: 6,
                          padding: '12px 14px',
                          fontSize: 11,
                          fontFamily: 'JetBrains Mono, monospace',
                          color: 'var(--text-faint)',
                          lineHeight: 1.8,
                        }}>
                          <div><span style={{ color: 'var(--text-faint)' }}>job_id:</span> <span style={{ color: 'var(--text-soft)' }}>{job.job_id}</span></div>
                          <div><span style={{ color: 'var(--text-faint)' }}>prompt_hash:</span> <span style={{ color: 'var(--text-soft)' }}>{job.prompt_hash ?? '—'}</span></div>
                          <div><span style={{ color: 'var(--text-faint)' }}>tokens_yielded:</span> <span style={{ color: 'var(--text)' }}>{job.tokens_yielded}</span></div>
                          <div><span style={{ color: 'var(--text-faint)' }}>bypassed_layers:</span> <span style={{ color: 'var(--text)' }}>{job.bypassed_layers}</span></div>
                          <div><span style={{ color: 'var(--text-faint)' }}>zk_proof_status:</span> <span style={{ color: STATUS_BADGE[job.zk_proof_status]?.color ?? 'var(--text-faint)' }}>{job.zk_proof_status}</span></div>
                          <div><span style={{ color: 'var(--text-faint)' }}>on_chain_sig:</span> <span style={{ color: 'var(--text-soft)' }}>{job.on_chain_sig ?? 'pending'}</span></div>
                          <div><span style={{ color: 'var(--text-faint)' }}>created_at:</span> <span style={{ color: 'var(--text-soft)' }}>{new Date(job.created_at).toISOString()}</span></div>
                          <div style={{ marginTop: 8 }}>
                            <span style={{ color: 'var(--text-faint)' }}>cost:</span>{' '}
                            <span style={{ color: 'var(--accent)' }}>${((job.tokens_yielded * 0.4) / 1_000_000).toFixed(6)} USDC</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <button
            className="en-btn en-btn-ghost"
            style={{ fontSize: 11 }}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← prev
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            page {page + 1} of {totalPages} · {data?.total.toLocaleString()} total
          </span>
          <button
            className="en-btn en-btn-ghost"
            style={{ fontSize: 11 }}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}
