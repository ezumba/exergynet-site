"use client";
import { useState } from "react";

interface HollowObject {
  xlmp_root: string;
  byte_size: number;
  shard_count: number;
  timestamp: string;
}

const S = {
  root:    { padding: "32px 36px", color: "var(--text)", maxWidth: 960, margin: "0 auto" },
  header:  { borderBottom: "1px solid var(--border-mid)", paddingBottom: 20, marginBottom: 28 },
  tag:     { fontSize: 10, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-faint)", textTransform: "uppercase" as const },
  h1:      { fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: "var(--text)", margin: "6px 0 4px" },
  sub:     { fontSize: 13, color: "var(--text-faint)", margin: 0 },
  card:    { background: "var(--bg-surface)", border: "1px solid var(--border-mid)", borderRadius: 12, padding: "20px 24px" },
  label:   { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-faint)", textTransform: "uppercase" as const, marginBottom: 8, display: "block" as const },
  btn:     (active?: boolean) => ({
    padding: "9px 20px", borderRadius: 8, border: `1px solid ${active ? "var(--accent)" : "var(--border-mid)"}`,
    background: active ? "var(--accent)" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-soft)",
    fontSize: 12, fontFamily: "monospace", fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em",
  }),
};

export default function xLMPVault() {
  const [hollowObjects, setHollowObjects] = useState<HollowObject[]>([]);
  const [queryResult,   setQueryResult]   = useState<string>("");
  const [ingesting,     setIngesting]     = useState(false);
  const [querying,      setQuerying]      = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIngesting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/xlmp/ingest", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setHollowObjects(prev => [data.hollow_object, ...prev]);
    } finally {
      setIngesting(false);
      e.target.value = "";
    }
  };

  const handleZKQuery = async (xlmp_root: string) => {
    setQuerying(xlmp_root);
    setQueryResult("Awaiting Groth16 Seal from L0 Mesh…");
    try {
      const res  = await fetch("/api/xlmp/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xlmp_root,
          image_id: "0xb226f60a6a3406e5cd3792b4bbe86ed996e2e2cc8dd31ddbe7989a20a897092d",
          query_params: { search: "active_records" },
        }),
      });
      const data = await res.json();
      setQueryResult(data.success ? JSON.stringify(data.data, null, 2) : `ERROR: ${data.error}`);
    } catch (err: unknown) {
      setQueryResult(`MESH FAULT: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setQuerying(null);
    }
  };

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.tag}>LNES-17 · xLMP-DS</div>
        <h1 style={S.h1}>[ xLMP-DS ] DISTRIBUTED SUMP</h1>
        <p style={S.sub}>Hollow Object Architecture &amp; ZK-Compute at Rest.</p>
      </div>

      {/* Ingest panel */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <span style={S.label}>xLMP_Compress (Ingest)</span>
        <label style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
          <div style={{ padding: "8px 18px", background: "var(--bg)", border: "1px solid var(--border-mid)", borderRadius: 8, fontSize: 12, fontFamily: "monospace", color: "var(--text-soft)", cursor: "pointer" }}>
            {ingesting ? "SHATTERING PAYLOAD…" : "SELECT PAYLOAD"}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Any file — shattered into 512KB shards, Merkle-hashed to xLMP_Root</span>
          <input type="file" style={{ display: "none" }} onChange={handleUpload} disabled={ingesting} />
        </label>
      </div>

      {/* Two-column: Hollow Objects + ZK Journal */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <span style={S.label}>Active xLMP_Roots</span>
          {hollowObjects.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-faint)", padding: "20px 0" }}>No hollow objects in active state.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {hollowObjects.map((obj, i) => (
              <div key={i} style={S.card}>
                <div style={{ fontSize: 11, color: "#818CF8", fontFamily: "monospace", marginBottom: 8, wordBreak: "break-all" }}>
                  {obj.xlmp_root}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-faint)", marginBottom: 12 }}>
                  <span>{(obj.byte_size / 1024).toFixed(2)} KB</span>
                  <span>{obj.shard_count} Shards</span>
                  <span>{new Date(obj.timestamp).toLocaleTimeString()}</span>
                </div>
                <button
                  onClick={() => handleZKQuery(obj.xlmp_root)}
                  disabled={querying === obj.xlmp_root}
                  style={{ ...S.btn(querying === obj.xlmp_root), width: "100%", display: "block" }}>
                  {querying === obj.xlmp_root ? "AWAITING GROTH16…" : "EXECUTE ZK-QUERY (IMAGE_ID: CONDENSER)"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span style={S.label}>ZK-Journal Output</span>
          <pre style={{
            background: "var(--bg-surface)", border: "1px solid var(--border-mid)", borderRadius: 12,
            padding: "16px 20px", fontSize: 11, color: "#4ADE80", fontFamily: "monospace",
            height: 300, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0,
          }}>
            {queryResult || "Awaiting ZK Execution…"}
          </pre>
        </div>
      </div>
    </div>
  );
}
