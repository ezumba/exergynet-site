"use client";
import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Entity = {
  id: string; type: string; name: string; symbol?: string;
  entitySubtype?: string; agentEnabled?: boolean; agentFrequency?: string;
  agentSources?: string[]; lastAgentRun?: string; baselineReady?: boolean;
  profileData?: Record<string, any>; groundTruthUrl?: string; createdAt?: string;
};
type EntityEvent = {
  id: string; eventType: string; severity: string; title: string;
  summary?: string; sourceUrl?: string; sourceName?: string; occurredAt?: string;
};
type Signal = { id: string; signalType: string; value: string; confidence: string; t: string };
type ProfileData = {
  entity: Entity; events: EntityEvent[]; signals: Signal[];
  cost: { total_cost_usdc?: string; cost_24h?: string; total_signals?: string };
  eventBreakdown: { event_type: string; severity: string; count: number }[];
};

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_BADGE: Record<string, string> = {
  equity: "en-badge en-badge-blue",
  crypto: "en-badge en-badge-accent",
  macro:  "en-badge en-badge-purple",
  sensor: "en-badge en-badge-muted",
};
const SEV_COLOR: Record<string, string> = {
  HIGH:   "var(--red)",
  LOW:    "var(--amber)",
  INFO:   "var(--text-soft)",
  MEDIUM: "var(--amber)",
};
const SEV_ICON: Record<string, string> = {
  HIGH: "▲", LOW: "◆", INFO: "●", MEDIUM: "◆",
};
const EVENT_ICON: Record<string, string> = {
  news: "◎", github: "⬡", market: "◈", mempool: "⬟",
};

function timeAgo(t?: string) {
  if (!t) return "never";
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1)    return "just now";
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function Avatar({ name, type }: { name: string; type: string }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const colors: Record<string, string> = {
    equity: "var(--blue)", crypto: "var(--accent)", macro: "var(--purple)", sensor: "var(--text-soft)",
  };
  return (
    <div style={{
      width: 44, height: 44, borderRadius: "50%",
      background: `color-mix(in srgb, ${colors[type] ?? "var(--accent)"} 20%, transparent)`,
      border: `2px solid ${colors[type] ?? "var(--accent)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
      color: colors[type] ?? "var(--accent)", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ── Agent Status Dot ──────────────────────────────────────────────────────────
function AgentDot({ enabled, lastRun }: { enabled?: boolean; lastRun?: string }) {
  if (!enabled) return <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-faint)", display: "inline-block" }} />;
  const stale = !lastRun || (Date.now() - new Date(lastRun).getTime()) > 60 * 60 * 1000;
  return (
    <span style={{
      width: 8, height: 8, borderRadius: "50%",
      background: stale ? "var(--amber)" : "var(--green)",
      display: "inline-block",
      boxShadow: stale ? "0 0 6px var(--amber)" : "0 0 6px var(--green)",
    }} />
  );
}

// ── Profile Panel ─────────────────────────────────────────────────────────────
function ProfilePanel({ entity, onBack, onRunAgent }: {
  entity: Entity; onBack: () => void; onRunAgent: (id: string) => Promise<void>;
}) {
  const [data, setData]       = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/intel/api/entities/${entity.id}/profile`);
      if (r.ok) setData(await r.json());
    } finally { setLoading(false); }
  }, [entity.id]);

  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    setMsg("");
    try {
      await onRunAgent(entity.id);
      setMsg("Agent cycle triggered successfully");
      setTimeout(() => { setMsg(""); load(); }, 2000);
    } catch {
      setMsg("Failed to trigger agent cycle");
    } finally { setRunning(false); }
  };

  const sources = data?.entity?.agentSources ?? entity.agentSources ?? [];
  const profile = data?.entity?.profileData ?? entity.profileData;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Back button */}
      <button
        className="en-btn"
        onClick={onBack}
        style={{ alignSelf: "flex-start", fontSize: 12 }}
      >
        ← Back to watchlist
      </button>

      {/* Entity header */}
      <div className="en-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <Avatar name={entity.name} type={entity.type} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{entity.name}</span>
              {entity.symbol && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
                  {entity.symbol}
                </span>
              )}
              <span className={TYPE_BADGE[entity.type] ?? "en-badge en-badge-muted"} style={{ textTransform: "uppercase" }}>
                {entity.type}
              </span>
              {entity.entitySubtype && entity.entitySubtype !== "standard" && (
                <span className="en-badge en-badge-muted">{entity.entitySubtype}</span>
              )}
            </div>
            {entity.groundTruthUrl && (
              <a
                href={entity.groundTruthUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-mono)" }}
              >
                ⬡ Ground truth source ↗
              </a>
            )}
            {(data?.entity as any)?.disambiguationScore && Number((data?.entity as any).disambiguationScore) > 0 && (
              <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                Disambiguation: {(Number((data?.entity as any).disambiguationScore) * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              className="en-btn en-btn-primary"
              onClick={runNow}
              disabled={running}
              style={{ fontSize: 12 }}
            >
              {running ? "Running…" : "↻ Run now"}
            </button>
          </div>
        </div>
        {msg && (
          <div className={`en-alert ${msg.includes("Failed") ? "en-alert-error" : "en-alert-success"}`}
            style={{ marginTop: 12, fontSize: 12 }}>
            {msg}
          </div>
        )}
      </div>

      {/* Agent status + cost row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {/* Agent status */}
        <div className="en-card" style={{ padding: 16 }}>
          <div className="en-label" style={{ marginBottom: 12 }}>Agent status</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AgentDot enabled={data?.entity?.agentEnabled ?? entity.agentEnabled} lastRun={data?.entity?.lastAgentRun ?? entity.lastAgentRun} />
            <span style={{ fontSize: 12, color: "var(--text)" }}>
              {(data?.entity?.agentEnabled ?? entity.agentEnabled) ? "Active" : "Paused"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>
            Last run: {timeAgo(data?.entity?.lastAgentRun ?? entity.lastAgentRun)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8 }}>
            Frequency: {data?.entity?.agentFrequency ?? entity.agentFrequency ?? "15min"}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {sources.map((s: string) => (
              <span key={s} className="en-badge en-badge-muted" style={{ fontSize: 9 }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Baseline progress */}
        <div className="en-card" style={{ padding: 16 }}>
          <div className="en-label" style={{ marginBottom: 12 }}>Baseline</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-soft)" }}>Events collected</span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
              color: (data?.entity?.baselineReady ?? entity.baselineReady) ? "var(--green)" : "var(--amber)"
            }}>
              {data?.events?.length ?? 0} / 20 {(data?.entity?.baselineReady ?? entity.baselineReady) ? "✓" : ""}
            </span>
          </div>
          <div className="en-progress-track">
            <div className="en-progress-fill" style={{
              width: `${Math.min(100, ((data?.events?.length ?? 0) / 20) * 100)}%`,
              background: (data?.entity?.baselineReady ?? entity.baselineReady) ? "var(--green)" : "var(--amber)",
            }} />
          </div>
        </div>

        {/* Cost 24h */}
        <div className="en-card" style={{ padding: 16 }}>
          <div className="en-label" style={{ marginBottom: 12 }}>Cost (24h)</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--accent)", marginBottom: 4 }}>
            ${Number(data?.cost?.cost_24h ?? 0).toFixed(6)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
            Total: ${Number(data?.cost?.total_cost_usdc ?? 0).toFixed(6)} USDC
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
            Signals: {data?.cost?.total_signals ?? 0}
          </div>
        </div>

        {/* Event breakdown */}
        {data?.eventBreakdown && data.eventBreakdown.length > 0 && (
          <div className="en-card" style={{ padding: 16 }}>
            <div className="en-label" style={{ marginBottom: 12 }}>Event breakdown</div>
            {data.eventBreakdown.slice(0, 5).map((b, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-soft)" }}>
                  {EVENT_ICON[b.event_type] ?? "●"} {b.event_type}
                  {b.severity !== "INFO" && (
                    <span style={{ color: SEV_COLOR[b.severity], marginLeft: 4 }}>{b.severity}</span>
                  )}
                </span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{b.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vanguard profile summary */}
      {profile && typeof profile === "object" && (profile as any).summary && (
        <div className="en-card" style={{ padding: 16, borderLeft: "3px solid var(--accent)" }}>
          <div className="en-label" style={{ marginBottom: 8 }}>Vanguard Intelligence Summary</div>
          <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, margin: "0 0 8px" }}>
            {(profile as any).summary}
          </p>
          {(profile as any).key_change && (
            <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 4 }}>
              Key change: {(profile as any).key_change}
            </div>
          )}
          {(profile as any).risk_level && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: SEV_COLOR[(profile as any).risk_level] ?? "var(--text-soft)",
            }}>
              Risk: {(profile as any).risk_level}
            </span>
          )}
        </div>
      )}

      {/* ── Structured Profile ── */}
      {(data?.entity?.profileData ?? entity.profileData) && (data?.entity?.profileData as any)?.display_name && (
        <div className="en-card" style={{ padding: 20, marginBottom: 12 }}>
          {(data?.entity?.profileData as any)?.profile_status === "draft" && (
            <div style={{
              background: "#f59e0b20", border: "1px solid #f59e0b40",
              borderRadius: 8, padding: "8px 12px", marginBottom: 14,
              fontSize: 12, color: "#f59e0b", display: "flex", gap: 6, alignItems: "center",
            }}>
              ⚠ Draft profile — generated by agent. Verify key facts before activating monitoring.
            </div>
          )}
          {(data?.entity?.profileData as any)?.description && (
            <p style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.7, marginBottom: 14 }}>
              {(data?.entity?.profileData as any).description}
            </p>
          )}
          {(data?.entity?.profileData as any)?.key_facts && Object.entries((data?.entity?.profileData as any).key_facts).map(([cat, facts]) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div className="en-label" style={{ marginBottom: 6, fontSize: 10 }}>{cat.toUpperCase()}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {(facts as string[]).map((f, i) => (
                  <span key={i} style={{
                    fontSize: 12, padding: "3px 9px",
                    border: "0.5px solid var(--border-faint)",
                    borderRadius: 6, color: "var(--text-soft)",
                    background: "var(--surface-raised)",
                  }}>{f}</span>
                ))}
              </div>
            </div>
          ))}
          {(data?.entity?.profileData as any)?.recent_activity_summary && (
            <div style={{ padding: 12, background: "var(--surface-raised)", borderRadius: 8, marginTop: 12 }}>
              <div className="en-label" style={{ marginBottom: 4, fontSize: 10 }}>VANGUARD SYNTHESIS</div>
              <p style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.6, margin: 0 }}>
                {(data?.entity?.profileData as any).recent_activity_summary}
              </p>
              {(data?.entity?.profileData as any)?.risk_level && (
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 5 }}>
                  Risk: <strong style={{ color: (data?.entity?.profileData as any).risk_level === "HIGH" ? "var(--red)" : (data?.entity?.profileData as any).risk_level === "MEDIUM" ? "#f59e0b" : "var(--green)" }}>
                    {(data?.entity?.profileData as any).risk_level}
                  </strong>
                </div>
              )}
            </div>
          )}
          {((data?.entity?.profileData as any)?.profile_status === "draft" || (data?.entity?.profileData as any)?.profile_status === "approved") && (
            <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid var(--border-faint)" }}>
              <button
                className="en-btn en-btn-primary"
                style={{ fontSize: 12 }}
                onClick={async () => {
                  await fetch(`/intel/api/entities/${entity.id}/approve-profile`, { method: "POST" });
                  load();
                }}
              >
                ✓ Approve profile
              </button>
              <button
                className="en-btn en-btn-ghost"
                style={{ fontSize: 12 }}
                onClick={async () => {
                  await fetch(`/intel/api/entities/${entity.id}/build-profile`, { method: "POST" });
                  alert("Rebuilding profile... check back in 60 seconds");
                }}
              >
                ↺ Rebuild
              </button>
            </div>
          )}
        </div>
      )}

      {/* Activity timeline */}
      <div>
        <div className="en-label" style={{ marginBottom: 12 }}>Activity timeline</div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="en-skeleton" style={{ height: 60, borderRadius: "var(--radius)" }} />
            ))}
          </div>
        ) : !data?.events?.length ? (
          <div className="en-empty" style={{ padding: "32px 0" }}>
            <div className="en-empty-icon">◎</div>
            <div className="en-empty-title">No events yet</div>
            <div className="en-empty-sub">Run the agent to start collecting intelligence</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.events.slice(0, 30).map(ev => (
              <div key={ev.id} className="en-card" style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ color: SEV_COLOR[ev.severity] ?? "var(--text-soft)", fontSize: 12 }}>
                        {SEV_ICON[ev.severity] ?? "●"}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 600, lineHeight: 1.3 }}>
                        {ev.title}
                      </span>
                      {(ev as any).confidence != null && (
                        <span style={{
                          fontSize: 9, padding: "1px 5px", borderRadius: 6, flexShrink: 0, fontWeight: 700,
                          background: Number((ev as any).confidence) > 0.8 ? "#10b98120" : "var(--surface-raised)",
                          color: Number((ev as any).confidence) > 0.8 ? "#10b981" : "var(--text-faint)",
                        }}>{(Number((ev as any).confidence) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                    {ev.summary && (
                      <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "0 0 4px", lineHeight: 1.4 }}>
                        {ev.summary.slice(0, 200)}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="en-badge en-badge-muted" style={{ fontSize: 9 }}>{ev.eventType}</span>
                      {ev.sourceName && (
                        <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{ev.sourceName}</span>
                      )}
                      {ev.sourceUrl && (
                        <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, color: "var(--accent)" }}>
                          ↗ source
                        </a>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                    {timeAgo(ev.occurredAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Form ──────────────────────────────────────────────────────────────────
const ALL_SOURCES = ["market", "news", "github", "mempool", "patent_search", "patent_assignments", "trademark", "peds", "usaspending", "courtlistener", "hackernews", "worldbank", "fred", "opensanctions", "sec_gov", "sec", "acled", "gdelt", "eia", "wayback"];
const SOURCE_LABELS: Record<string, string> = {
  market: "market", news: "news", github: "github", mempool: "mempool",
  patent_search: "Patents", patent_assignments: "IP Transfers",
  trademark: "Trademarks", peds: "Patent Exam",
  usaspending: "Gov Contracts", courtlistener: "Court Cases",
  hackernews: "HackerNews", worldbank: "World Bank",
  fred: "FRED (Fed)", opensanctions: "Sanctions",
  sec_gov: "SEC/Gov",
  sec: "SEC Form 4",
  acled: "Conflict (ACLED)",
  gdelt: "GDELT Events",
  eia: "EIA Energy",
  wayback: "Web History",
};

function AddForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [name,         setName]         = useState("");
  const [symbol,       setSymbol]       = useState("");
  const [type,         setType]         = useState("equity");
  const [subtype,      setSubtype]      = useState("standard");
  const [groundTruth,  setGroundTruth]  = useState("");
  const [sources,      setSources]      = useState<string[]>(["market", "news", "github"]);
  const [frequency,    setFrequency]    = useState("15min");
  const [tags,         setTags]         = useState("");
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState("");
  const [disambigCandidates, setDisambigCandidates] = useState<any[]>([]);
  const [showDisambig, setShowDisambig]             = useState(false);
  const [disambigLoading, setDisambigLoading]       = useState(false);

  const toggleSource = (s: string) => {
    setSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };
  const DEFAULT_ADAPTERS: Record<string, string[]> = {
    equity:  ["market", "sec", "gdelt", "fred"],
    crypto:  ["market", "gdelt", "fred"],
    macro:   ["fred", "eia", "gdelt"],
    person:  ["gdelt", "wayback", "news"],
    company: ["sec", "gdelt", "wayback", "news"],
    event:   ["acled", "gdelt", "news"],
    sensor:  ["eia", "gdelt"],
  };

  useEffect(() => {
    const defaults = DEFAULT_ADAPTERS[type];
    if (defaults) setSources(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);


  const handleNameBlur = async (n: string) => {
    if (!n || n.length < 2) return;
    if (showDisambig) return; // already showing
    setDisambigLoading(true);
    try {
      const res = await fetch(`/intel/api/entities/disambiguate?q=${encodeURIComponent(n)}`);
      const data = await res.json();
      setDisambigLoading(false);
      if (data.candidates?.length > 0) {
        setDisambigCandidates(data.candidates);
        setShowDisambig(true);
      }
    } catch { setDisambigLoading(false); }
  };

  const submit = async () => {
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true); setErr("");
    try {
      const tagsArr = tags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch("/intel/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), symbol: symbol.trim() || undefined,
          type,
          entitySubtype: subtype,
          groundTruthUrl: groundTruth.trim() || undefined,
          agentSources: sources,
          agentFrequency: frequency,
          tags: tagsArr,
          agentEnabled: true,
        }),
      });
      if (!res.ok) { setErr("Failed to add entity"); return; }
      onAdded();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <button className="en-btn" onClick={onCancel} style={{ alignSelf: "flex-start", fontSize: 12 }}>
        ← Back to watchlist
      </button>

      <div>
        <div className="en-label" style={{ marginBottom: 6 }}>
          <span style={{ color: "var(--accent)" }}>+</span>&nbsp; Add entity
        </div>
        <h1 className="en-page-title">Add to watchlist</h1>
        <p className="en-page-subtitle">Configure an entity for continuous intelligence monitoring</p>
      </div>

      <div className="en-card" style={{ padding: 24, maxWidth: 640 }}>
        {/* Name + Symbol row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, marginBottom: 16 }}>
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>Name *</div>
            <input className="en-input" value={name} onChange={e => setName(e.target.value)}
              placeholder="Apple Inc." onKeyDown={e => e.key === "Enter" && submit()}
              onBlur={e => handleNameBlur(e.target.value)} />
            {disambigLoading && (
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>Searching identity anchors…</div>
            )}
            {showDisambig && disambigCandidates.length > 0 && (
              <div style={{
                position: "absolute", zIndex: 100, width: "100%", marginTop: 4,
                background: "var(--bg-card)", border: "1px solid var(--border-mid)",
                borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", overflow: "hidden",
              }}>
                <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--border-faint)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>Which entity did you mean?</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Select the correct match to lock the identity anchor</div>
                </div>
                {disambigCandidates.map((c, i) => (
                  <div
                    key={i}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setGroundTruth(c.url);
                      setShowDisambig(false);
                      setDisambigCandidates([]);
                    }}
                    style={{
                      padding: "10px 14px", cursor: "pointer", borderBottom: "0.5px solid var(--border-faint)",
                      display: "flex", gap: 10, alignItems: "flex-start",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-raised)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                      background: "#EEEDFE", color: "#3C3489",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {c.label.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{c.label}</div>
                        <span style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600,
                          background: c.confidence > 0.85 ? "#10b98120" : "#6b728020",
                          color: c.confidence > 0.85 ? "#10b981" : "#6b7280",
                        }}>
                          {(c.confidence * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{c.description}</div>
                      <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 3 }}>{c.url}</div>
                    </div>
                  </div>
                ))}
                <div style={{ padding: "8px 14px", background: "var(--surface-raised)" }}>
                  <div
                    onClick={() => setShowDisambig(false)}
                    style={{ fontSize: 12, color: "var(--text-faint)", cursor: "pointer" }}
                  >
                    None of these — I&apos;ll provide my own URL ↗
                  </div>
                </div>
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>Symbol</div>
            <input className="en-input" value={symbol} onChange={e => setSymbol(e.target.value)}
              placeholder="AAPL" style={{ fontFamily: "var(--font-mono)" }} />
          </div>
        </div>

        {/* Type + Subtype row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>Type</div>
            <select className="en-input" value={type} onChange={e => setType(e.target.value)}>
              <option value="equity">Equity</option>
              <option value="crypto">Crypto</option>
              <option value="macro">Macro</option>
              <option value="sensor">Sensor</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>Subtype</div>
            <select className="en-input" value={subtype} onChange={e => setSubtype(e.target.value)}>
              <option value="standard">Standard</option>
              <option value="person">Person</option>
              <option value="organization">Organization</option>
              <option value="project">Project</option>
              <option value="protocol">Protocol</option>
            </select>
          </div>
        </div>

        {/* Ground truth URL */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>
            Ground truth URL {subtype === "person" ? "*" : "(optional)"}
          </div>
          <input className="en-input" value={groundTruth} onChange={e => setGroundTruth(e.target.value)}
            placeholder="https://en.wikipedia.org/wiki/..." style={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
        </div>

        {/* Agent sources */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 8 }}>Agent sources</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ALL_SOURCES.map(s => (
              <button
                key={s}
                onClick={() => toggleSource(s)}
                style={{
                  padding: "5px 12px", borderRadius: "var(--radius)",
                  border: `1px solid ${sources.includes(s) ? "var(--accent)" : "var(--border-mid)"}`,
                  background: sources.includes(s) ? "var(--accent-dim)" : "transparent",
                  color: sources.includes(s) ? "var(--accent)" : "var(--text-soft)",
                  fontSize: 12, cursor: "pointer", fontFamily: "var(--font-mono)",
                }}
              >
                {SOURCE_LABELS[s] ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>Agent frequency</div>
          <select className="en-input" value={frequency} onChange={e => setFrequency(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="5min">Every 5 minutes</option>
            <option value="15min">Every 15 minutes</option>
            <option value="1h">Every hour</option>
            <option value="6h">Every 6 hours</option>
            <option value="24h">Daily</option>
          </select>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>Tags (comma-separated)</div>
          <input className="en-input" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="biotech, clinical-stage, watchlist" />
        </div>

        {/* Cost hint */}
        <div className="en-alert en-alert-info" style={{ marginBottom: 16, fontSize: 11 }}>
          Free: market, github, sec, gdelt, eia, wayback, acled, worldbank, fred · Paid: news ($0.001/cycle via SerpAPI), mempool
        </div>

        {err && <div className="en-alert en-alert-error" style={{ marginBottom: 12, fontSize: 12 }}>{err}</div>}

        {/* Estimated cost hint */}
        {(() => {
          const PAID_COSTS: Record<string, number> = { news: 0.001, mempool: 0.0005 }; const hasSerpSources = sources.some(s => ["news","mempool"].includes(s));
          const freqMultiplier = frequency==="5min"?288:frequency==="15min"?96:frequency==="1h"?24:frequency==="6h"?4:1;
          const dailyCostNum = sources.reduce((sum, s) => sum + (PAID_COSTS[s] ?? 0) * freqMultiplier, 0); const dailyCost = dailyCostNum === 0 ? "FREE" : `~$${dailyCostNum.toFixed(4)} USDC/day`;
          return (
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 12,
              padding: "8px 12px", background: "var(--surface-raised)", borderRadius: 8 }}>
              Estimated cost: <strong style={{ color: dailyCostNum === 0 ? "var(--color-ok)" : "var(--text-soft)" }}>
                {dailyCost}
              </strong> with {sources.length} source{sources.length!==1?"s":""} at {frequency}
            </div>
          );
        })()}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="en-btn en-btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Adding…" : "+ Add and start watching"}
          </button>
          <button className="en-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type View = "list" | "add" | "profile";

export default function EntitiesPage() {
  const [view,       setView]       = useState<View>("list");
  const [list,       setList]       = useState<Entity[]>([]);
  const [selected,   setSelected]   = useState<Entity | null>(null);
  const [msg,        setMsg]        = useState("");
  const [stats,      setStats]      = useState<{costs:Record<string,{cost_24h:number;signals_24h:number}>;signals:Record<string,Record<string,number>>;events:Record<string,number>} | null>(null);

  const load = useCallback(async () => {
    const [r, sr] = await Promise.all([
      fetch("/intel/api/entities"),
      fetch("/intel/api/entities/watchlist-stats"),
    ]);
    const d = await r.json();
    setList(Array.isArray(d) ? d : []);
    if (sr.ok) setStats(await sr.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdded = () => {
    setView("list");
    setMsg("Entity added and watching started");
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  const openProfile = (e: Entity) => {
    setSelected(e);
    setView("profile");
  };

  const runAgent = async (id: string) => {
    const res = await fetch(`/intel/api/entities/${id}/run-agent`, { method: "POST" });
    if (!res.ok) throw new Error("Failed");
  };

  if (view === "add") return <AddForm onAdded={handleAdded} onCancel={() => setView("list")} />;

  if (view === "profile" && selected) {
    return (
      <ProfilePanel
        entity={selected}
        onBack={() => setView("list")}
        onRunAgent={runAgent}
      />
    );
  }

  // List view
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="en-label" style={{ marginBottom: 6 }}>
            <span style={{ color: "var(--accent)" }}>◉</span>&nbsp; Entities
          </div>
          <h1 className="en-page-title">Watchlist</h1>
          <p className="en-page-subtitle">
            {list.length} {list.length === 1 ? "entity" : "entities"} under continuous intelligence monitoring
          </p>
        </div>
        <button className="en-btn en-btn-primary" onClick={() => setView("add")} style={{ flexShrink: 0 }}>
          + Add entity
        </button>
      </div>

      {msg && <div className="en-alert en-alert-success" style={{ fontSize: 12 }}>{msg}</div>}

      {/* Entity table */}
      <div className="en-card-flush">
        {list.length === 0 ? (
          <div className="en-empty">
            <div className="en-empty-icon">◉</div>
            <div className="en-empty-title">No entities yet</div>
            <div className="en-empty-sub">Add an equity, crypto, macro indicator, or person to start monitoring</div>
          </div>
        ) : (
          <table className="en-table">
            <thead>
              <tr>
                <th>Name / subtype</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Agent</th>
                <th>Last run</th>
                <th>24h cost</th>
                <th>Signals</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map(e => (
                <tr key={e.id} onClick={() => openProfile(e)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={e.name} type={e.type} />
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 13 }}>{e.name}</div>
                        {e.entitySubtype && e.entitySubtype !== "standard" && (
                          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{e.entitySubtype}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 700 }}>
                    {e.symbol ?? "—"}
                  </td>
                  <td>
                    <span className={TYPE_BADGE[e.type] ?? "en-badge en-badge-muted"}
                      style={{ textTransform: "uppercase", fontSize: 9 }}>
                      {e.type}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <AgentDot enabled={e.agentEnabled} lastRun={e.lastAgentRun} />
                      <span style={{ fontSize: 11, color: "var(--text-soft)" }}>
                        {e.agentEnabled ? "active" : "off"}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                    {timeAgo(e.lastAgentRun)}
                  </td>
                  <td style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-soft)" }}>
                    {stats?.costs?.[e.id] ? `$${stats.costs[e.id].cost_24h.toFixed(6)}` : "$0.000000"}
                  </td>
                  <td>
                    {stats?.signals?.[e.id] ? (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {Object.entries(stats.signals[e.id]).sort(([a],[b])=>a.localeCompare(b)).map(([conf, cnt]) => (
                          <span key={conf} style={{
                            fontSize: 9, padding: "1px 5px", borderRadius: 6, fontWeight: 700,
                            background: conf==="HIGH"?"#ef444420":conf==="LOW"?"#f59e0b20":"var(--surface-raised)",
                            color: conf==="HIGH"?"#ef4444":conf==="LOW"?"#f59e0b":"var(--text-faint)",
                          }}>{cnt} {conf}</span>
                        ))}
                      </div>
                    ) : <span style={{ fontSize: 11, color: "var(--text-faint)" }}>—</span>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "var(--accent)" }}>Open details →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
