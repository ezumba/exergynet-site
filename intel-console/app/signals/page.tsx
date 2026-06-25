"use client";
import { useEffect, useState, useCallback } from "react";

type Signal = {
  id: string; entityName: string; metric: string;
  signalType: string; value: string; confidence: string; t: string; params?: any;
};

const BADGE: Record<string, string> = {
  HIGH:       "en-badge en-badge-green",
  LOW:        "en-badge en-badge-amber",
  UNVERIFIED: "en-badge en-badge-muted",
};

function timeAgo(t: string) {
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1)    return "just now";
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function MetricBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    z_score: "en-badge en-badge-blue",
    iqr_fence: "en-badge en-badge-purple",
    pct_change: "en-badge en-badge-accent",
    rolling_std: "en-badge en-badge-muted",
  };
  return (
    <span className={map[type] ?? "en-badge en-badge-muted"}
      style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
      {type}
    </span>
  );
}

export default function Signals() {
  const [rows,    setRows]    = useState<Signal[]>([]);
  const [conf,    setConf]    = useState("HIGH");
  const [loading, setLoading] = useState(true);
  const [total,   setTotal]   = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, allRes] = await Promise.all([
        fetch(`/intel/api/signals/anomalies?confidence=${conf}`),
        fetch("/intel/api/signals/anomalies?confidence=ALL"),
      ]);
      const data    = await res.json();
      const allData = allRes.ok ? await allRes.json() : [];
      setRows(Array.isArray(data) ? data : []);
      setTotal(Array.isArray(allData) ? allData.length : 0);
    } finally {
      setLoading(false);
    }
  }, [conf]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="en-label" style={{ marginBottom: 6 }}>
            <span style={{ color: "var(--accent)" }}>◈</span>&nbsp; Signals
          </div>
          <h1 className="en-page-title">Signal feed</h1>
          <p className="en-page-subtitle">
            Filtered anomalies by confidence tier — {total} total signals across all entities
          </p>
        </div>
        <button className="en-btn en-btn-ghost" onClick={load} style={{ alignSelf: "flex-start" }}>
          ↻ Refresh
        </button>
      </div>

      {/* Filter + table */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="en-label">
            <span style={{ color: "var(--accent)" }}>■</span>&nbsp;
            {loading ? "Loading…" : `${rows.length} ${conf}-confidence anomalies`}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["HIGH", "LOW", "UNVERIFIED"].map(c => (
              <button
                key={c}
                onClick={() => setConf(c)}
                className={conf === c ? "en-btn en-btn-primary" : "en-btn en-btn-ghost"}
                style={{ fontSize: 11, padding: "4px 10px" }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="en-card-flush">
          {loading ? (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} className="en-skeleton" style={{ height: 18, borderRadius: 4,
                  width: i % 3 === 0 ? "90%" : i % 2 === 0 ? "75%" : "60%" }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="en-empty">
              <div className="en-empty-icon">◈</div>
              <div className="en-empty-title">No {conf}-confidence signals</div>
              <div className="en-empty-sub">Signals accumulate automatically every 15 min via ingest cron</div>
            </div>
          ) : (
            <table className="en-table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Metric</th>
                  <th>Operator</th>
                  <th style={{ textAlign: "right" }}>Value</th>
                  <th>Confidence</th>
                  <th>Params</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: "var(--text)", fontWeight: 600 }}>{s.entityName ?? "—"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-soft)", fontSize: 12 }}>
                      {s.metric}
                    </td>
                    <td><MetricBadge type={s.signalType} /></td>
                    <td style={{ textAlign: "right", color: "var(--accent)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                      {parseFloat(s.value).toFixed(4)}
                    </td>
                    <td>
                      <span className={BADGE[s.confidence] ?? BADGE.UNVERIFIED}>{s.confidence}</span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)", maxWidth: 180 }}>
                      {s.params
                        ? Object.entries(s.params).slice(0, 2).map(([k, v]) =>
                            `${k}=${typeof v === "number" ? (v as number).toFixed(2) : v}`
                          ).join("  ")
                        : "—"}
                    </td>
                    <td style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      {timeAgo(s.t)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
