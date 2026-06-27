'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { developer, Developer, Stats, Job } from '@/lib/api';

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="en-card" style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 8 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          color: accent ? 'var(--accent)' : 'var(--text)',
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{sub}</div>}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_COLOR: Record<string, string> = {
  QUEUED:  'var(--amber)',
  SETTLED: 'var(--accent)',
  PENDING: 'var(--text-faint)',
  ERROR:   'var(--red)',
};

export default function DashboardPage() {
  const router = useRouter();
  const [dev, setDev] = useState<Developer | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      developer.me(),
      developer.stats(),
      developer.jobs({ limit: 5, offset: 0 }),
    ])
      .then(([devData, statsData, jobsData]) => {
        setDev(devData);
        setStats(statsData);
        setRecentJobs(jobsData.jobs);
      })
      .catch(() => {
        // Session may have expired
        router.replace('/');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const dailyData = (stats?.daily ?? []).map((d) => ({
    day: new Date(d.day).toLocaleDateString('en', {
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
    }),
    tokens: d.tokens,
  }));

  const balance = dev ? parseFloat(dev.usdc_balance_usd) : 0;
  const tokenEq = Math.floor(balance / 0.0004);

  if (loading) {
    return (
      <div
        style={{
          padding: 24,
          color: 'var(--text-faint)',
          fontSize: 11,
          letterSpacing: '0.08em',
        }}
      >
        <span style={{ color: 'var(--accent)' }}>■</span> loading…
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            letterSpacing: '0.08em',
            marginBottom: 6,
          }}
        >
          <span style={{ color: 'var(--accent)' }}>■</span> OVERVIEW
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>
            {dev?.email ?? 'developer'}
          </div>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 99,
              background: dev?.active ? 'var(--success-bg)' : 'var(--bg-card)',
              color: dev?.active ? 'var(--accent)' : 'var(--text-faint)',
              border: `1px solid ${dev?.active ? 'var(--success-border)' : 'var(--border)'}`,
            }}
          >
            {dev?.active ? '● active' : '○ inactive'}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <MetricCard
          label="USDC BALANCE"
          value={`$${balance.toFixed(4)}`}
          sub={`≈ ${tokenEq.toLocaleString()} tokens available`}
          accent
        />
        <MetricCard
          label="TOTAL TOKENS"
          value={(stats?.total_tokens ?? 0).toLocaleString()}
          sub={`${stats?.total_jobs ?? 0} inference jobs`}
        />
        <MetricCard
          label="LAYERS BYPASSED"
          value={(stats?.total_bypassed_layers ?? 0).toLocaleString()}
          sub={`avg ${stats?.avg_bypassed_layers ?? 0} per job`}
        />
        <MetricCard
          label="TOTAL SPEND"
          value={`$${((( stats?.total_tokens ?? 0) * 0.4) / 1_000_000).toFixed(4)}`}
          sub="0.4 micro-USDC/token"
        />
      </div>

      {/* 7-day chart */}
      <div className="en-card" style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-faint)',
            letterSpacing: '0.08em',
            marginBottom: 16,
          }}
        >
          TOKEN USAGE — LAST 7 DAYS
        </div>
        {dailyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="overviewGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="10%" stopColor="#0D9488" stopOpacity={0.22} />
                  <stop offset="90%" stopColor="#0D9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: 'var(--text-faint)', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-faint)', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--text)',
                }}
                labelStyle={{ color: 'var(--text-soft)' }}
                cursor={{ fill: 'var(--accent-dim)' }}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#overviewGrad)"
                dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              height: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--text-faint)',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div>no usage yet</div>
            <Link href="/dashboard/playground">
              <button className="en-btn en-btn-ghost" style={{ fontSize: 10 }}>
                try the playground →
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Recent jobs + quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>

        {/* Recent jobs */}
        <div className="en-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 16px',
              fontSize: 10,
              color: 'var(--text-faint)',
              letterSpacing: '0.08em',
              borderBottom: '1px solid var(--border-mid)',
            }}
          >
            RECENT SETTLEMENTS
          </div>

          {recentJobs.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--text-faint)',
              }}
            >
              no jobs yet
            </div>
          ) : (
            <table className="en-table" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 16px' }}>JOB</th>
                  <th style={{ padding: '8px 16px', width: 70 }}>TOKENS</th>
                  <th style={{ padding: '8px 16px', width: 80 }}>STATUS</th>
                  <th style={{ padding: '8px 16px', width: 70 }}>AGE</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.job_id}>
                    <td
                      style={{
                        padding: '8px 16px',
                        fontFamily: 'monospace',
                        color: 'var(--accent)',
                        fontSize: 11,
                      }}
                    >
                      {job.job_id.slice(0, 10)}…
                    </td>
                    <td
                      style={{
                        padding: '8px 16px',
                        color: 'var(--text)',
                        textAlign: 'right',
                      }}
                    >
                      {job.tokens_yielded.toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 16px', color: 'var(--text-soft)' }}>
                      <span
                        style={{
                          fontSize: 10,
                          color: STATUS_COLOR[job.zk_proof_status] ?? 'var(--text-faint)',
                        }}
                      >
                        {job.zk_proof_status.toLowerCase()}
                      </span>
                    </td>
                    <td style={{ padding: '8px 16px', fontSize: 10, color: 'var(--text-faint)' }}>
                      {timeAgo(job.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-mid)' }}>
            <Link href="/dashboard/settlements">
              <button
                className="en-btn en-btn-ghost"
                style={{ fontSize: 10, padding: '4px 10px' }}
              >
                view all settlements →
              </button>
            </Link>
          </div>
        </div>

        {/* Quick actions */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minWidth: 180,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-faint)',
              letterSpacing: '0.08em',
              marginBottom: 4,
            }}
          >
            QUICK ACTIONS
          </div>

          {[
            { href: '/dashboard/playground', label: '▷ run inference', primary: true },
            { href: '/dashboard/billing',    label: '◇ deposit USDC',  primary: false },
            { href: '/dashboard/keys',       label: '⌗ manage keys',   primary: false },
            { href: '/dashboard/analytics',  label: '▦ view analytics',primary: false },
          ].map(({ href, label, primary }) => (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <button
                className={`en-btn ${primary ? 'en-btn-primary' : 'en-btn-ghost'}`}
                style={{ width: '100%', justifyContent: 'flex-start', fontSize: 11 }}
              >
                {label}
              </button>
            </Link>
          ))}

          {/* Balance reminder if inactive */}
          {!dev?.active && (
            <div
              style={{
                marginTop: 8,
                padding: '10px 12px',
                background: 'var(--warn-bg)',
                border: '1px solid var(--warn-border)',
                borderRadius: 6,
                fontSize: 10,
                color: 'var(--amber)',
                lineHeight: 1.7,
              }}
            >
              ⚠ Account inactive.<br />
              Deposit at least $1 USDC<br />
              to enable inference.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
