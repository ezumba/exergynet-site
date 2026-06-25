"use client";
import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Anomaly = {
  entity: string; metric: string; signal: string; summary: string;
  zScore?: number; direction?: "up" | "down";
};
type Mover      = { entity: string; direction: "up" | "down"; magnitude: string };
type CrossDomain = { insight: string; entities: string[] };
type Compound    = {
  id: string; name: string; confidence: number; severity: string;
  description: string; narrative: string; recommendedAction: string;
  sources: string[]; componentCount: number;
  components: { source: string; type: string; confidence: number; severity: string; entities: string[] }[];
};
type Brief = {
  id: string; status: string; narrative: string;
  topAnomalies: Anomaly[]; topMovers: Mover[]; crossDomain: CrossDomain[];
  costUsdc?: string; createdAt: string;
};
type CompoundResult = {
  status: string; totalSignals: number; totalCompounds: number;
  totalCostUsdc: string; elapsedMs: number;
  sources: { intel_db: number; github: number; blockchain: number };
  compounds: Compound[];
};

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  green:  "#10b981",
  red:    "#ef4444",
  amber:  "#f59e0b",
  blue:   "#3b82f6",
  purple: "#8b5cf6",
};

const SRC_COLOR: Record<string, string> = {
  intel_db: C.blue, github: C.purple, blockchain: C.amber, satellite: C.green, maritime: "#06b6d4",
};
const SRC_LABEL: Record<string, string> = {
  intel_db: "Intel DB", github: "GitHub", blockchain: "Mempool", satellite: "Satellite", maritime: "Maritime",
};

// ── Sub-components ────────────────────────────────────────────────────────────
function Dot({ color }: { color: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}
function SrcBadge({ src }: { src: string }) {
  const c = SRC_COLOR[src] ?? "#6b7280";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
      background: c + "1a", color: c, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
      {SRC_LABEL[src] ?? src}
    </span>
  );
}
function ConfBadge({ val, severity }: { val: number; severity?: string }) {
  const c = severity === "critical" ? C.red : severity === "warning" ? C.amber : C.green;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
      background: c + "1a", color: c }}>
      {Math.round(val * 100)}%
    </span>
  );
}
function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface-raised)", borderRadius: 10, padding: "14px 16px",
      border: "0.5px solid var(--border-faint)" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.07em", color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1, color: color ?? "var(--text)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
function SectionLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11,
      letterSpacing: "0.07em", color: "var(--text-faint)", textTransform: "uppercase",
      marginBottom: 12, marginTop: 28 }}>
      <Dot color={color} />
      {children}
    </div>
  );
}

function SignalCard({ a, index }: { a: Anomaly; index: number }) {
  const isUp   = (a.direction ?? "up") === "up";
  const zscore = a.zScore ?? 0;
  const barPct = Math.min(99, Math.max(1, (zscore / 5) * 100));
  const zColor = isUp ? C.green : C.red;
  const barPct2 = isUp ? barPct : 100 - barPct;

  return (
    <div style={{ border: "0.5px solid var(--border-faint)", borderRadius: 10,
      borderLeft: `2.5px solid ${zColor}`, padding: 16,
      background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Entity + badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{a.entity}</div>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
          background: zColor + "1a", color: zColor }}>
          HIGH
        </span>
      </div>

      {/* Z-score */}
      <div style={{ fontSize: 26, fontWeight: 500, color: zColor, lineHeight: 1, marginBottom: 8,
        fontVariantNumeric: "tabular-nums" }}>
        {isUp ? "+" : "−"}{zscore.toFixed(2)}σ
      </div>

      {/* Probability bar */}
      <div style={{ height: 4, background: "var(--surface-raised)", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${barPct2}%`, background: zColor, borderRadius: 2 }} />
      </div>

      {/* Signal rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-faint)" }}>Metric</span>
          <span style={{ color: "var(--text-soft)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            {a.metric} · {a.signal.toLowerCase()}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-faint)" }}>3σ percentile</span>
          <span style={{ color: zColor }}>
            {isUp ? "top" : "bottom"} {zscore >= 3 ? "0.13%" : zscore >= 2.5 ? "0.6%" : "2%"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-faint)" }}>Summary</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-soft)", lineHeight: 1.5, marginTop: 2,
          borderLeft: "2px solid var(--border-mid)", paddingLeft: 8 }}>
          {a.summary}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "var(--accent)", cursor: "pointer" }}>
        Vote on PolSignal ↗
      </div>
    </div>
  );
}

function CompoundCard({ c }: { c: Compound }) {
  const sevColor = c.severity === "critical" ? C.red : c.severity === "warning" ? C.amber : C.green;
  return (
    <div style={{ border: "0.5px solid var(--border-faint)", borderLeft: `2.5px solid ${sevColor}`,
      borderRadius: 10, padding: 16, background: "var(--bg-card)", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", maxWidth: "70%" }}>{c.name}</div>
        <ConfBadge val={c.confidence} severity={c.severity} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {c.sources.map(s => <SrcBadge key={s} src={s} />)}
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20,
          background: "var(--surface-raised)", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
          {c.componentCount} signals
        </span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.65,
        borderLeft: "2px solid var(--border-mid)", paddingLeft: 10, marginBottom: 10 }}>
        {c.narrative || c.description}
      </div>
      {c.recommendedAction && (
        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>
          → {c.recommendedAction}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const PHASE_LABELS: Record<string, string> = {
  querying:     "Pulling HIGH-confidence anomalies…",
  analysing:    "Analysing signals across all entities…",
  correlating:  "Running compound correlation engine…",
  synthesising: "Synthesising with SEI Vanguard Pro…",
};

export default function IntelBriefs() {
  const [brief,    setBrief]    = useState<Brief | null>(null);
  const [compound, setCompound] = useState<CompoundResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [phase,    setPhase]    = useState("idle");
  const [elapsed,  setElapsed]  = useState(0);

  const generate = async () => {
    setLoading(true); setBrief(null); setCompound(null); setElapsed(0); setPhase("querying");
    try {
      const [bRes, cRes] = await Promise.allSettled([
        fetch("/intel/api/intel/daily-brief").then(r => r.json()),
        fetch("/intel/api/intel/compound-brief").then(r => r.json()),
      ]);
      if (bRes.status === "fulfilled") setBrief(bRes.value);
      if (cRes.status === "fulfilled") setCompound(cRes.value);
    } finally {
      setLoading(false); setPhase("idle");
    }
  };

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  useEffect(() => {
    if (!loading) return;
    const steps = ["querying", "analysing", "correlating", "synthesising"];
    let i = 0;
    const iv = setInterval(() => { i = (i + 1) % steps.length; setPhase(steps[i]); }, 3500);
    return () => clearInterval(iv);
  }, [loading]);

  const download = () => {
    if (!brief) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ brief, compound }, null, 2)], { type: "application/json" }));
    a.download = `intel-brief-${brief.id?.slice(0, 8) ?? Date.now()}.json`;
    a.click();
  };
  const copyMd = () => {
    if (!brief) return;
    navigator.clipboard.writeText(brief.narrative ?? "");
  };

  const hasData     = brief?.status === "complete";
  const anomalies   = brief?.topAnomalies ?? [];
  const movers      = brief?.topMovers ?? [];
  const compounds   = compound?.compounds ?? [];
  const totalCostUsd = ((parseFloat(brief?.costUsdc ?? "0")) + parseFloat(compound?.totalCostUsdc ?? "0")).toFixed(6);
  const srcCount    = compound ? Object.values(compound.sources).reduce((a, b) => a + b, 0) : 0;
  const srcNames    = compound ? Object.entries(compound.sources)
    .filter(([, v]) => v > 0).map(([k]) => SRC_LABEL[k] ?? k).join(" · ") : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div className="en-label" style={{ marginBottom: 4 }}>
            <span style={{ color: "var(--accent)" }}>≡</span>&nbsp; Intel Briefs
          </div>
          <h1 className="en-page-title" style={{ marginBottom: 4 }}>Daily intelligence brief</h1>
          <p className="en-page-subtitle">
            {hasData
              ? `Vanguard narrative · multi-source compound signals · ${new Date(brief!.createdAt).toLocaleString()}`
              : "Vanguard narrative · multi-source compound signals"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {hasData && <>
            <button className="en-btn en-btn-ghost" style={{ fontSize: 11 }} onClick={copyMd}>Copy narrative</button>
            <button className="en-btn en-btn-ghost" style={{ fontSize: 11 }} onClick={download}>↓ JSON</button>
          </>}
          <button className="en-btn en-btn-primary" onClick={generate} disabled={loading} style={{ fontSize: 12 }}>
            {loading ? `${phase.charAt(0).toUpperCase() + phase.slice(1)}… ${elapsed}s` : "Generate brief"}
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-faint)",
          borderRadius: 12, padding: "36px 40px", textAlign: "center", marginBottom: 24 }}>
          <span className="en-pulse-dot" style={{ width: 10, height: 10, display: "inline-block", marginBottom: 14 }} />
          <p style={{ fontSize: 14, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>
            {PHASE_LABELS[phase] ?? "Processing…"}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 20 }}>
            Intel DB · GitHub events · On-chain mempool · Vanguard Pro AI
          </p>
          <div style={{ maxWidth: 320, margin: "0 auto", height: 3,
            background: "var(--border-dim)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(94, elapsed * 3.5)}%`,
              background: "var(--accent)", borderRadius: 2, transition: "width 1s linear" }} />
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {brief?.status === "error" && (
        <div style={{ background: C.red + "10", border: `0.5px solid ${C.red}44`, borderRadius: 10,
          padding: "12px 16px", fontSize: 13, color: C.red, marginBottom: 16 }}>
          ✕ {brief.narrative}
        </div>
      )}

      {/* ── No data ── */}
      {brief?.status === "no_data" && (
        <div style={{ background: "var(--surface-raised)", borderRadius: 12, padding: "40px",
          textAlign: "center", border: "0.5px solid var(--border-faint)" }}>
          <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>◈</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>No HIGH-confidence anomalies</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Ingest data across multiple entities to build signal windows</div>
        </div>
      )}

      {/* ── Full report ── */}
      {hasData && !loading && (
        <>
          {/* Metric grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 8 }}>
            <MetricCard label="Anomalies"      value={anomalies.length} sub="HIGH confidence"        color={anomalies.length > 0 ? C.green : undefined} />
            <MetricCard label="Top movers"     value={movers.length}    sub="entities flagged" />
            <MetricCard label="Compound signals" value={compounds.length} sub="cross-source overlap"  color={compounds.length > 0 ? C.amber : undefined} />
            <MetricCard label="Sources"        value={srcCount}         sub={srcNames || "signals ingested"} />
            <MetricCard label="Vanguard cost"  value={`$${totalCostUsd}`} sub="USDC · settled"      color={C.blue} />
          </div>

          {/* Executive narrative */}
          <SectionLabel color={C.green}>Executive narrative</SectionLabel>
          <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-faint)",
            borderRadius: 12, padding: "20px 24px", marginBottom: 0 }}>
            {(brief!.narrative ?? "").split(/\n{2,}/).filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.85,
                marginBottom: i < 2 ? 12 : 0 }}>
                {para.replace(/\*\*/g, "").replace(/\|/g, "").replace(/^\s*[-*]\s*/gm, "").trim()}
              </p>
            ))}
          </div>

          {/* Anomaly signal cards */}
          {anomalies.length > 0 && (
            <>
              <SectionLabel color={C.blue}>
                Anomaly signals
                <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: "auto",
                  fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>
                  click a signal to vote on PolSignal
                </span>
              </SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 0 }}>
                {anomalies.map((a, i) => <SignalCard key={i} a={a} index={i} />)}
              </div>
            </>
          )}

          {/* Compound intelligence */}
          {compound && (
            <>
              <SectionLabel color={C.amber}>
                Compound intelligence
                <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
                  {Object.entries(compound.sources).filter(([, v]) => v > 0).map(([s]) => (
                    <SrcBadge key={s} src={s} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: "auto",
                  fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>
                  {compound.totalSignals} signals · {compound.elapsedMs}ms
                </span>
              </SectionLabel>

              {compounds.length === 0 ? (
                <div style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-faint)",
                  borderRadius: 10, padding: "16px 20px", fontSize: 12, color: "var(--text-faint)" }}>
                  No cross-source compound patterns detected. Signals present but no entity/sector overlap within 1h window.
                </div>
              ) : (
                compounds.map(c => <CompoundCard key={c.id} c={c} />)
              )}
            </>
          )}

          {/* Top movers */}
          {movers.length > 0 && (
            <>
              <SectionLabel color="var(--text-faint)">Top movers</SectionLabel>
              <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-faint)",
                borderRadius: 12, overflow: "hidden" }}>
                {movers.map((m, i) => {
                  const isUp = m.direction === "up";
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 18px", borderBottom: i < movers.length - 1 ? "0.5px solid var(--border-faint)" : "none",
                      fontSize: 13 }}>
                      <span style={{ fontWeight: 500, color: "var(--text)" }}>{m.entity}</span>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                          {m.magnitude}
                        </span>
                        <span style={{ fontSize: 16, color: isUp ? C.green : C.red }}>{isUp ? "↑" : "↓"}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                          background: (isUp ? C.green : C.red) + "1a",
                          color: isUp ? C.green : C.red }}>
                          {isUp ? "UP" : "DOWN"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Cross-domain insights */}
          {(brief!.crossDomain?.length ?? 0) > 0 && (
            <>
              <SectionLabel color={C.purple}>Cross-domain signals</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {brief!.crossDomain?.map((c, i) => (
                  <div key={i} style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-faint)",
                    borderRadius: 10, padding: "14px 16px", borderLeft: `2px solid ${C.purple}` }}>
                    <p style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 8, lineHeight: 1.65 }}>
                      {c.insight}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {c.entities?.map((e, j) => (
                        <span key={j} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4,
                          background: C.purple + "1a", color: C.purple, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Settlement footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            paddingTop: 20, marginTop: 20, borderTop: "0.5px solid var(--border-faint)",
            fontSize: 11, color: "var(--text-faint)", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span>Vanguard cost: <span style={{ color: C.green, fontWeight: 600 }}>${totalCostUsd} USDC</span></span>
              <span>Settled: <span style={{ color: C.green, fontWeight: 600 }}>Base L2</span></span>
              <span style={{ fontFamily: "var(--font-mono)" }}>id: {brief!.id?.slice(0, 8)}…</span>
              <span style={{ opacity: 0.6 }}>SGX enclave · zero retention</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: C.blue + "1a", color: C.blue }}>LNES-04</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                {new Date(brief!.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── Idle ── */}
      {!loading && !brief && (
        <div style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-faint)",
          borderRadius: 14, padding: "52px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 14, opacity: 0.2 }}>≡</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            No brief generated yet
          </div>
          <div style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 24, lineHeight: 1.6 }}>
            Click Generate brief to run Vanguard Pro narrative analysis<br />
            and multi-source compound signal detection
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            {["Intel DB", "GitHub events", "On-chain mempool", "Correlation engine", "Vanguard Pro AI"].map(s => (
              <span key={s} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6,
                background: "var(--bg-card)", color: "var(--text-faint)", border: "0.5px solid var(--border-faint)",
                fontFamily: "var(--font-mono)" }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
