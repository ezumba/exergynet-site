"use client";
// app/proofs/page.tsx — "I Saw It First" early detection proof dashboard

import { useState, useEffect } from "react";

interface Proof {
  id: string; entity_name: string; entity_type: string; symbol: string | null;
  event_title: string; event_type: string;
  agent_detected_at: string; first_news_at: string | null;
  lead_time_seconds: number | null; lead_time_label: string | null;
  proof_hash: string; verified: boolean; shared: boolean;
}
interface Category { event_type: string; count: number; avg_lead: number | null; }
interface Reputation {
  totalDetections: number; withLeadTime: number;
  avgLeadSeconds: number; maxLeadSeconds: number;
  detectionScore: number; categories: Category[];
}

function formatLead(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 3600)  return `${Math.round(seconds / 60)}m ahead`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h ahead`;
  return `${(seconds / 86400).toFixed(1)} days ahead`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
         d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function ProofCard({ proof, expanded, onToggle }: { proof: Proof; expanded: boolean; onToggle: () => void }) {
  const hasLead  = proof.lead_time_seconds && proof.lead_time_seconds > 0;
  const leadSecs = proof.lead_time_seconds ?? 0;

  function copyProofLink() {
    navigator.clipboard.writeText(`${window.location.origin}/intel/proofs/${proof.id}`);
  }
  function shareX() {
    const text = hasLead
      ? `My agent detected "${proof.event_title}" ${formatLead(proof.lead_time_seconds)} of first news.\nProof: ${window.location.origin}/intel/proofs/${proof.id}`
      : `My agent is monitoring "${proof.entity_name}" on ExergyNet Intel.`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div onClick={onToggle} style={{
      border: `1px solid ${expanded ? "var(--accent)" : "var(--border-mid)"}`,
      borderRadius: 12, padding: 20, cursor: "pointer",
      background: expanded ? "var(--bg-card)" : "transparent",
      transition: "all 0.15s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
              {proof.entity_name}
            </span>
            {proof.symbol && (
              <span style={{ fontSize: 10, padding: "1px 6px", background: "var(--surface-raised)", borderRadius: 4, color: "var(--text-faint)" }}>
                {proof.symbol}
              </span>
            )}
            {proof.verified && (
              <span style={{ fontSize: 10, padding: "1px 7px", background: "#10b98120", color: "#10b981", borderRadius: 10, fontWeight: 600 }}>
                Verified
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
            {proof.event_title}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
            Detected {formatDate(proof.agent_detected_at)} · via {proof.event_type.replace("_", " ")}
          </div>
        </div>
        {hasLead && (
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>
              {formatLead(proof.lead_time_seconds)}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-faint)" }}>of first news</div>
          </div>
        )}
      </div>

      {/* Expanded timeline */}
      {expanded && (
        <div onClick={e => e.stopPropagation()}>
          <div style={{ margin: "16px 0", padding: 16, background: "var(--surface-raised)", borderRadius: 10 }}>
            {/* Timeline */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {[
                { dot: "#10b981", label: "Your agent detected", time: proof.agent_detected_at },
                { dot: "#f59e0b", label: "First news appeared", time: proof.first_news_at },
              ].map((row, i) => row.time ? (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: row.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--text-soft)", flex: 1 }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: row.dot }}>{formatDate(row.time)}</span>
                </div>
              ) : null)}
            </div>

            {hasLead && (
              <div style={{ textAlign: "center", padding: "12px 0", borderTop: "0.5px solid var(--border-faint)" }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#10b981" }}>
                  {formatLead(proof.lead_time_seconds)}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>ahead of first public news</div>
              </div>
            )}
          </div>

          {/* Proof hash */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 11, color: "var(--text-faint)" }}>
            <span>🔒</span>
            <span>SHA-256 proof · 0x{proof.proof_hash.slice(0, 8)}...{proof.proof_hash.slice(-4)}</span>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={shareX} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border-mid)", background: "transparent", color: "var(--text)", fontSize: 12, cursor: "pointer" }}>
              𝕏 Share on X
            </button>
            <button onClick={copyProofLink} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border-mid)", background: "transparent", color: "var(--text)", fontSize: 12, cursor: "pointer" }}>
              🔗 Copy proof link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProofsPage() {
  const [data, setData]         = useState<{ proofs: Proof[]; reputation: Reputation } | null>(null);
  const [loading, setLoading]   = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/intel/api/intel/proofs")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const rep = data?.reputation;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>I Saw It First</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0 }}>
          Timestamped proof that your agent detected signals before they became public.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-faint)", padding: 40 }}>Loading proofs…</div>
      ) : (
        <>
          {/* Reputation stats */}
          {rep && (
            <div style={{ border: "1px solid var(--border-mid)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.08em", marginBottom: 14 }}>YOUR EARLY DETECTION RECORD</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                {[
                  { value: rep.totalDetections, label: "TOTAL DETECTIONS" },
                  { value: Math.round(rep.detectionScore), label: "DETECTION SCORE" },
                  { value: rep.avgLeadSeconds > 0 ? formatLead(rep.avgLeadSeconds) : "—", label: "AVG LEAD TIME" },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: "center", padding: 14, background: "var(--surface-raised)", borderRadius: 8 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: i === 1 ? "var(--accent)" : "var(--text)" }}>{s.value}</div>
                    <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.06em", marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {rep.categories.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.06em", marginBottom: 8 }}>BY CATEGORY</div>
                  {rep.categories.map((c, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "0.5px solid var(--border-faint)", fontSize: 12 }}>
                      <span style={{ color: "var(--text-soft)", textTransform: "capitalize" }}>{c.event_type.replace(/_/g, " ")}</span>
                      <span style={{ color: "var(--text-faint)" }}>{c.count} detections {c.avg_lead ? `· ${formatLead(c.avg_lead)} avg` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Proof cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(data?.proofs ?? []).length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-faint)", border: "1px dashed var(--border-mid)", borderRadius: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No detections yet</div>
                <div style={{ fontSize: 12 }}>Run your watchlist agent to start collecting early detection proofs.</div>
              </div>
            ) : (
              (data?.proofs ?? []).map(p => (
                <ProofCard
                  key={p.id}
                  proof={p}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
