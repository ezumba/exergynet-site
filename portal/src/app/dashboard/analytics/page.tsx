'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { developer, Stats } from '@/lib/api';

const TEAL = 'var(--accent)';
const NAVY = 'var(--bg-card)';

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="en-card" style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: accent ? TEAL : 'var(--text)', marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{sub}</div>}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  labelStyle: { color: 'var(--text-soft)' },
  itemStyle: { color: TEAL },
  cursor: { fill: 'rgba(13,148,136,0.08)' },
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    developer.stats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--text-faint)', fontSize: 11, letterSpacing: '0.08em' }}>
        <span style={{ color: TEAL }}>■</span> loading analytics…
      </div>
    );
  }

  const dailyData = (stats?.daily ?? []).map(d => ({
    day: new Date(d.day).toLocaleDateString('en', { weekday: 'short', month: 'numeric', day: 'numeric' }),
    tokens: d.tokens,
    cost: parseFloat(((d.tokens * 0.4) / 1_000_000).toFixed(4)),
  }));

  const statusPie = stats ? [
    { name: 'queued',  value: stats.by_status.queued,  fill: 'var(--amber)' },
    { name: 'settled', value: stats.by_status.settled, fill: TEAL },
    { name: 'pending', value: stats.by_status.pending, fill: 'var(--text-faint)' },
  ].filter(d => d.value > 0) : [];

  const savingsPct = stats
    ? Math.round((parseFloat(stats.avg_bypassed_layers) / 32) * 100)
    : 0;

  const estimatedCostUsd = stats
    ? ((stats.total_tokens * 0.4) / 1_000_000).toFixed(4)
    : '0.0000';

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 6 }}>
          <span style={{ color: TEAL }}>■</span> ANALYTICS
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>usage & performance</div>
      </div>

      {/* Top metrics */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <StatCard
          label="TOTAL TOKENS"
          value={stats?.total_tokens.toLocaleString() ?? '0'}
          sub={`${stats?.total_jobs ?? 0} inference jobs`}
          accent
        />
        <StatCard
          label="TOTAL COST"
          value={`$${estimatedCostUsd}`}
          sub="0.4 micro-USDC/token"
        />
        <StatCard
          label="LAYERS BYPASSED"
          value={stats?.total_bypassed_layers.toLocaleString() ?? '0'}
          sub={`avg ${stats?.avg_bypassed_layers ?? 0} per job`}
        />
        <StatCard
          label="COMPUTE SAVED"
          value={`~${savingsPct}%`}
          sub="vs standard 32-layer"
          accent
        />
      </div>

      {/* Token area chart */}
      <div className="en-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 16 }}>
          TOKEN USAGE — LAST 7 DAYS
        </div>
        {dailyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="10%" stopColor={TEAL} stopOpacity={0.25} />
                  <stop offset="90%" stopColor={TEAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: 'var(--text-faint)', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-faint)', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip {...tooltipStyle} />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke={TEAL}
                strokeWidth={2}
                fill="url(#tokenGrad)"
                dot={{ r: 3, fill: TEAL, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
            no usage data yet — run your first inference job
          </div>
        )}
      </div>

      {/* Cost bar + status pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        <div className="en-card">
          <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 16 }}>
            DAILY COST (USD)
          </div>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9, fill: 'var(--text-faint)', fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'var(--text-faint)', fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `$${v}`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: number) => [`$${v.toFixed(4)}`, 'cost']}
                />
                <Bar dataKey="cost" radius={[2, 2, 0, 0]}>
                  {dailyData.map((_, i) => (
                    <Cell key={i} fill={i === dailyData.length - 1 ? TEAL : 'var(--accent-dim)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
              no data yet
            </div>
          )}
        </div>

        <div className="en-card">
          <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 16 }}>
            SETTLEMENT STATUS DISTRIBUTION
          </div>
          {statusPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={statusPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusPie.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                />
                <Legend
                  formatter={(value) => <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
              no settlements yet
            </div>
          )}
        </div>
      </div>

      {/* Performance panel */}
      <div className="en-card">
        <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', marginBottom: 16 }}>
          ENGINE PERFORMANCE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { label: 'Avg bypassed layers', value: stats?.avg_bypassed_layers ?? '—', unit: 'layers/job' },
            { label: 'Effective depth', value: stats ? `${32 - parseFloat(stats.avg_bypassed_layers)} / 32` : '—', unit: 'layers' },
            { label: 'Token rate', value: '0.4 μUSDC', unit: 'per token' },
          ].map(({ label, value, unit }) => (
            <div key={label} style={{ padding: '12px 0', borderRight: '1px solid #1E293B' }}>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{unit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
