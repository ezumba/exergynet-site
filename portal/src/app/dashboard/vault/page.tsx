"use client";
import { useState, useRef } from "react";

interface HollowObject {
  xlmp_root: string;
  byte_size: number;
  shard_count: number;
  timestamp: string;
}

interface JournalResult {
  result: string | null;
  confidence: number;
  citations: string[];
  zk_sealed: boolean;
  groth16_receipt?: string;
  synthesis_model?: string;
  status?: string;
}

interface ZKResult {
  query_id?: string;
  proof_size_bytes?: number;
  latency_ms?: number;
  journal: JournalResult;
  error?: string;
}

const IMAGE_ID = "0xb226f60a6a3406e5cd3792b4bbe86ed996e2e2cc8dd31ddbe7989a20a897092d";

const S = {
  root:    { padding: "28px 32px", color: "var(--text)", maxWidth: 1100, margin: "0 auto" },
  header:  { borderBottom: "1px solid var(--border-mid)", paddingBottom: 18, marginBottom: 24 },
  tag:     { fontSize: 10, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-faint)", textTransform: "uppercase" as const },
  h1:      { fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: "var(--text)", margin: "6px 0 4px" },
  sub:     { fontSize: 13, color: "var(--text-faint)", margin: 0 },
  card:    { background: "var(--bg-surface)", border: "1px solid var(--border-mid)", borderRadius: 12, padding: "18px 22px" },
  label:   { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-faint)", textTransform: "uppercase" as const, marginBottom: 8, display: "block" as const },
  btn:     (active?: boolean) => ({
    padding: "9px 20px", borderRadius: 8, cursor: "pointer" as const,
    border: `1px solid ${active ? "var(--accent)" : "var(--border-mid)"}`,
    background: active ? "var(--accent)" : "var(--bg-surface)",
    color: active ? "#fff" : "var(--text-soft)",
    fontSize: 12, fontFamily: "monospace", fontWeight: 600, letterSpacing: "0.04em",
  }),
};

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "var(--accent)" : pct >= 60 ? "#F59E0B" : "#ef4444";
  return (
    <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color, padding: "2px 8px", borderRadius: 6, background: color + "18", border: `1px solid ${color}44` }}>
      {pct}% confidence
    </span>
  );
}

export default function xLMPVault() {
  const [hollowObjects, setHollowObjects] = useState<HollowObject[]>([]);
  const [activeRoot,    setActiveRoot]    = useState<string | null>(null);
  const [intent,        setIntent]        = useState("");
  const [zkResult,      setZkResult]      = useState<ZKResult | null>(null);
  const [ingesting,     setIngesting]     = useState(false);
  const [querying,      setQuerying]      = useState(false);
  const [ingestError,   setIngestError]   = useState("");
  const [queryError,    setQueryError]    = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIngesting(true);
    setIngestError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/xlmp/ingest", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setIngestError(data.error || "Ingest failed");
      } else {
        setHollowObjects(prev => [data.hollow_object, ...prev]);
        setActiveRoot(data.hollow_object.xlmp_root);
        setZkResult(null);
        setIntent("");
      }
    } catch (err: unknown) {
      setIngestError(err instanceof Error ? err.message : "Ingest error");
    } finally {
      setIngesting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleZKQuery = async () => {
    if (!activeRoot || !intent.trim()) return;
    setQuerying(true);
    setQueryError("");
    setZkResult(null);
    try {
      const res = await fetch("/api/xlmp/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xlmp_root: activeRoot,
          image_id: IMAGE_ID,
          query_params: { intent: intent.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setQueryError(data.error || "Query failed");
      } else {
        setZkResult(data);
      }
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : "Query error");
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.tag}>LNES-17 · xLMP-DS</div>
        <h1 style={S.h1}>[ xLMP-DS ] DISTRIBUTED SUMP</h1>
        <p style={S.sub}>Ingest any document. Query it with natural language. Every answer is ZK-sealed.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24, alignItems: "start" }}>

        {/* LEFT: Ingest + root list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={S.card}>
            <span style={S.label}>xLMP Compress — Ingest</span>
            <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "0 0 14px", lineHeight: 1.6 }}>
              Upload any file. Shattered into 512KB Merkle shards and sealed as a Hollow Object.
            </p>
            <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleUpload} disabled={ingesting} />
            <button onClick={() => fileRef.current?.click()} disabled={ingesting}
              style={{ ...S.btn(false), width: "100%", padding: "11px 0", textAlign: "center" as const }}>
              {ingesting ? "SHATTERING PAYLOAD..." : "SELECT PAYLOAD TO INGEST"}
            </button>
            {ingestError && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#ef4444", fontFamily: "monospace", padding: "8px 12px", background: "rgba(239,68,68,0.06)", borderRadius: 6 }}>
                {ingestError}
              </div>
            )}
          </div>

          <div>
            <span style={S.label}>Active Roots ({hollowObjects.length})</span>
            {hollowObjects.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "16px 0", textAlign: "center" as const, fontFamily: "monospace" }}>
                No hollow objects — ingest above.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {hollowObjects.map((obj) => {
                const isActive = obj.xlmp_root === activeRoot;
                return (
                  <button key={obj.xlmp_root}
                    onClick={() => { setActiveRoot(obj.xlmp_root); setZkResult(null); setQueryError(""); }}
                    style={{
                      textAlign: "left" as const, padding: "12px 14px", borderRadius: 10, cursor: "pointer", width: "100%",
                      border: `1px solid ${isActive ? "var(--accent)" : "var(--border-mid)"}`,
                      background: isActive ? "rgba(13,148,136,0.06)" : "var(--bg-surface)",
                    }}>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--accent)", marginBottom: 4, wordBreak: "break-all" as const }}>
                      {obj.xlmp_root.slice(0, 16)}...{obj.xlmp_root.slice(-8)}
                    </div>
                    <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--text-faint)", fontFamily: "monospace" }}>
                      <span>{(obj.byte_size / 1024).toFixed(1)} KB</span>
                      <span>{obj.shard_count} shard{obj.shard_count !== 1 ? "s" : ""}</span>
                      <span>{new Date(obj.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {isActive && <div style={{ marginTop: 5, fontSize: 10, color: "var(--accent)", fontFamily: "monospace", fontWeight: 700 }}>SELECTED</div>}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ ...S.card, background: "rgba(13,148,136,0.03)", border: "1px solid rgba(13,148,136,0.15)" }}>
            <span style={S.label}>Condenser ID</span>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-faint)", wordBreak: "break-all" as const, lineHeight: 1.6 }}>
              {IMAGE_ID}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-faint)" }}>Groth16 verifier — ExergyNet L0 Mesh</div>
          </div>
        </div>

        {/* RIGHT: Query + Journal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={S.card}>
            <span style={S.label}>ZK-Sealed Query</span>
            {!activeRoot ? (
              <div style={{ fontSize: 13, color: "var(--text-faint)", padding: "20px 0", textAlign: "center" as const }}>
                Select a Hollow Object on the left to begin querying.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 10, fontSize: 11, fontFamily: "monospace", color: "var(--text-faint)" }}>
                  Root: <span style={{ color: "var(--accent)" }}>{activeRoot.slice(0, 24)}...</span>
                </div>
                <textarea
                  value={intent}
                  onChange={e => setIntent(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleZKQuery(); }}
                  placeholder="Ask anything — e.g. Summarize the main thesis, What medications are listed?"
                  style={{
                    width: "100%", minHeight: 80, background: "var(--bg)", border: "1px solid var(--border-mid)",
                    borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--text)", outline: "none",
                    resize: "vertical" as const, fontFamily: "inherit", lineHeight: 1.6,
                    boxSizing: "border-box" as const, marginBottom: 12,
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={handleZKQuery} disabled={querying || !intent.trim()}
                    style={{ ...S.btn(!querying && !!intent.trim()), opacity: querying || !intent.trim() ? 0.5 : 1 }}>
                    {querying ? "SEALING PROOF..." : "EXECUTE ZK-QUERY"}
                  </button>
                  <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "monospace" }}>Cmd+Enter to run</span>
                </div>
                {queryError && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#ef4444", fontFamily: "monospace", padding: "8px 12px", background: "rgba(239,68,68,0.06)", borderRadius: 6 }}>
                    {queryError}
                  </div>
                )}
              </>
            )}
          </div>

          {zkResult && (
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={S.label}>ZK-Journal Output</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {zkResult.journal && <ConfidenceBadge value={zkResult.journal.confidence ?? 0} />}
                  {zkResult.journal?.zk_sealed && (
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--accent)", fontWeight: 700 }}>ZK-SEALED</span>
                  )}
                </div>
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--border-mid)", borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap" as const }}>
                  {zkResult.journal?.result ?? "No result returned."}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 16, fontSize: 11, fontFamily: "monospace", color: "var(--text-faint)", marginBottom: 14 }}>
                {zkResult.latency_ms != null && <span>{zkResult.latency_ms}ms</span>}
                {zkResult.proof_size_bytes != null && <span>{zkResult.proof_size_bytes}B proof</span>}
                {zkResult.journal?.synthesis_model && <span>{zkResult.journal.synthesis_model}</span>}
              </div>

              {(zkResult.journal?.citations?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-faint)", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Evidence Trail
                  </div>
                  {zkResult.journal.citations.map((c, i) => (
                    <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-soft)", padding: "4px 10px", background: "rgba(13,148,136,0.04)", borderLeft: "2px solid var(--accent)", borderRadius: "0 4px 4px 0", marginBottom: 4 }}>
                      {c}
                    </div>
                  ))}
                </div>
              )}

              {zkResult.journal?.groth16_receipt && (
                <details style={{ marginTop: 14 }}>
                  <summary style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-faint)", cursor: "pointer", userSelect: "none" as const }}>
                    GROTH16 RECEIPT
                  </summary>
                  <div style={{ marginTop: 6, fontSize: 10, fontFamily: "monospace", color: "var(--text-faint)", wordBreak: "break-all" as const }}>
                    {zkResult.journal.groth16_receipt}
                  </div>
                </details>
              )}
            </div>
          )}

          {!zkResult && activeRoot && !querying && (
            <div style={{ ...S.card, textAlign: "center" as const, padding: "40px 24px" }}>
              <div style={{ fontSize: 28, marginBottom: 12, color: "var(--text-faint)" }}>⬡</div>
              <div style={{ fontSize: 14, color: "var(--text-soft)", marginBottom: 6 }}>ZK-Journal awaiting query</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Type a question above and press EXECUTE ZK-QUERY</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
