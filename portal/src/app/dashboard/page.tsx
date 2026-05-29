'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { developer, Developer, Stats, Job } from '@/lib/api';

const TEAL = '#0D9488';

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
      <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.08em', marginBottom: 8 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          color: accent ? TEAL : '#F8FAFC',
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#334155' }}>{sub}</div>}
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
  QUEUED:  '#D97706',
  SETTLED: '#0D9488',
  PENDING: '#475569',
  ERROR:   '#EF4444',
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
          color: '#334155',
          fontSize: 11,
          letterSpacing: '0.08em',
        }}
      >
        <span style={{ color: TEAL }}>■</span> loading…
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
            color: '#334155',
            letterSpacing: '0.08em',
            marginBottom: 6,
          }}
        >
          <span style={{ color: TEAL }}>■</span> OVERVIEW
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 500, color: '#F8FAFC' }}>
            {dev?.email ?? 'developer'}
          </div>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 99,
              background: dev?.active ? '#042B27' : '#1E293B',
              color: dev?.active ? TEAL : '#475569',
              border: `1px solid ${dev?.active ? '#0F766E' : '#334155'}`,
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
            color: '#475569',
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
                  <stop offset="10%" stopColor={TEAL} stopOpacity={0.22} />
                  <stop offset="90%" stopColor={TEAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
                labelStyle={{ color: '#94A3B8' }}
                itemStyle={{ color: TEAL }}
                cursor={{ fill: 'rgba(13,148,136,0.06)' }}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke={TEAL}
                strokeWidth={2}
                fill="url(#overviewGrad)"
                dot={{ r: 3, fill: TEAL, strokeWidth: 0 }}
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
              color: '#334155',
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
              color: '#475569',
              letterSpacing: '0.08em',
              borderBottom: '1px solid #1E293B',
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
                color: '#334155',
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
                        color: TEAL,
                        fontSize: 11,
                      }}
                    >
                      {job.job_id.slice(0, 10)}…
                    </td>
                    <td
                      style={{
                        padding: '8px 16px',
                        color: '#F8FAFC',
                        textAlign: 'right',
                      }}
                    >
                      {job.tokens_yielded.toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <span
                        style={{
                          fontSize: 10,
                          color: STATUS_COLOR[job.zk_proof_status] ?? '#475569',
                        }}
                      >
                        {job.zk_proof_status.toLowerCase()}
                      </span>
                    </td>
                    <td style={{ padding: '8px 16px', fontSize: 10, color: '#475569' }}>
                      {timeAgo(job.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ padding: '10px 16px', borderTop: '1px solid #1E293B' }}>
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
              color: '#475569',
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
                background: '#2D1D06',
                border: '1px solid #92400E',
                borderRadius: 6,
                fontSize: 10,
                color: '#D97706',
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
