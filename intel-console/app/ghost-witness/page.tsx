"use client";
import { useEffect, useState } from "react";

interface AuditRow {
  audit_id: string; conversation_id: string | null; platform: string;
  claim_count: number; consistent: boolean | null; confidence: string | null;
  flags: unknown[]; settlement_cost: string; clc_url: string | null;
  tx_hash: string | null; status: string; created_at: string;
}
interface CLC { verified: boolean; certificate: Record<string, unknown>; message: string; }

const severityColor = (s: string) => {
  if (s === "critical") return "#ef4444";
  if (s === "high") return "#f97316";
  if (s === "low") return "#eab308";
  return "var(--text-faint)";
};

export default function GhostWitnessPage() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hashInput, setHashInput] = useState("");
  const [clcResult, setClcResult] = useState<CLC | null>(null);
  const [clcError, setClcError] = useState<string | null>(null);
  const [clcLoading, setClcLoading] = useState(false);

  useEffect(() => {
    fetch("/intel/api/ghost-witness/audits")
      .then(r => r.json()).then(d => setAudits(d.audits ?? []))
      .catch(() => setAudits([])).finally(() => setLoading(false));
  }, []);

  async function lookupCLC() {
    if (!hashInput.trim()) return;
    setClcLoading(true); setClcResult(null); setClcError(null);
    try {
      const res = await fetch("/intel/api/ghost-witness/clc/" + hashInput.trim());
      const data = await res.json();
      if (!res.ok) setClcError(data.error ?? "Not found.");
      else setClcResult(data as CLC);
    } catch { setClcError("Network error."); }
    finally { setClcLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", padding: "1.5rem 0" }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Ghost-Witness</h1>
        <p style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>
          LNES-05 · Certificate of Logical Consistency · Base L2
        </p>
      </div>

      {/* SECTION A - Audit Log */}
      <section>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Audit Log</div>
        {loading ? (
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Loading...</div>
        ) : audits.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
            No audits yet. POST to /api/ghost-witness/audit to begin.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ color: "var(--text-faint)", textAlign: "left" }}>
                  {["Conv ID","Platform","Claims","Consistent","Score","Flags","Cost","Receipt","Time"].map(h => (
                    <th key={h} style={{ padding: "4px 8px", borderBottom: "1px solid var(--border-dim)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audits.map(a => (
                  <tr key={a.audit_id} style={{ borderBottom: "1px solid var(--border-dim)" }}>
                    <td style={{ padding: "6px 8px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.conversation_id ?? a.audit_id.slice(0, 12) + "..."}
                    </td>
                    <td style={{ padding: "6px 8px" }}>{a.platform}</td>
                    <td style={{ padding: "6px 8px" }}>{a.claim_count}</td>
                    <td style={{ padding: "6px 8px" }}>
                      {a.consistent === null ? "-" : a.consistent
                        ? <span style={{ color: "#22c55e" }}>Y</span>
                        : <span style={{ color: "#ef4444" }}>N</span>}
                    </td>
                    <td style={{ padding: "6px 8px" }}>{a.confidence ? Number(a.confidence).toFixed(2) : "-"}</td>
                    <td style={{ padding: "6px 8px" }}>{Array.isArray(a.flags) ? a.flags.length : 0}</td>
                    <td style={{ padding: "6px 8px" }}>${Number(a.settlement_cost).toFixed(3)}</td>
                    <td style={{ padding: "6px 8px" }}>
                      {a.clc_url ? <a href={a.clc_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 10 }}>CLC</a> : "-"}
                    </td>
                    <td style={{ padding: "6px 8px", color: "var(--text-faint)" }}>{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION B - SDK Snippet */}
      <section style={{ background: "var(--bg)", border: "1px solid var(--border-dim)", borderRadius: 8, padding: "1.25rem" }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Integrate Ghost-Witness</div>
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 12, lineHeight: 1.6 }}>
          Send any AI agent conversation to Ghost-Witness. Receive a Certificate of Logical Consistency anchored on Base L2 in under 10 seconds.
        </div>
        <pre style={{ fontFamily: "monospace", fontSize: 11, background: "var(--bg)", padding: 12, borderRadius: 6, overflowX: "auto", color: "var(--text)", border: "1px solid var(--border-dim)", margin: 0 }}>
{`curl -X POST https://dt.portal.exergynet.org/intel/api/ghost-witness/audit \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_GW_API_KEY" \\
  -d '{
    "conversation_id": "whatsapp-session-abc123",
    "platform": "whatsapp",
    "strip_pii": true,
    "conversation": [
      {"role": "agent", "content": "Our product costs $49.99 and ships in 2 days."},
      {"role": "user",  "content": "How long does shipping take?"},
      {"role": "agent", "content": "Shipping takes 5-7 business days."}
    ]
  }'`}
        </pre>
        <div style={{ fontSize: 11, color: "#f97316", marginTop: 8 }}>
          Warning: the conversation above contains a logical inconsistency (2 days vs 5-7 days). Ghost-Witness will flag this as HIGH severity.
        </div>
      </section>

      {/* SECTION C - CLC Lookup */}
      <section>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Verify a Certificate</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Enter audit hash (SHA-256)..."
            value={hashInput}
            onChange={e => setHashInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && lookupCLC()}
            style={{ flex: 1, minWidth: 260, maxWidth: 480, background: "var(--bg)", border: "1px solid var(--border-dim)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--text)", outline: "none" }}
          />
          <button onClick={lookupCLC} disabled={clcLoading}
            style={{ background: "var(--accent, #6366f1)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, cursor: "pointer", opacity: clcLoading ? 0.6 : 1 }}>
            {clcLoading ? "Verifying..." : "Verify"}
          </button>
        </div>

        {clcError && <div style={{ marginTop: 12, fontSize: 12, color: "#ef4444" }}>{clcError}</div>}

        {clcResult && (
          <div style={{ marginTop: 12, background: "var(--bg)", border: "1px solid " + (clcResult.certificate.consistent ? "#22c55e" : "#ef4444"), borderRadius: 8, padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {clcResult.certificate.consistent ? "Logically Consistent" : "Inconsistencies Detected"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                  Score: {clcResult.certificate.score != null ? Number(clcResult.certificate.score).toFixed(2) : "-"} · Claims: {String(clcResult.certificate.claim_count ?? "-")} · Platform: {String(clcResult.certificate.platform ?? "-")}
                </div>
              </div>
            </div>
            {Array.isArray(clcResult.certificate.flags) && clcResult.certificate.flags.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 6 }}>Flags</div>
                {(clcResult.certificate.flags as Record<string, unknown>[]).map((f, i) => (
                  <div key={i} style={{ fontSize: 11, padding: "4px 8px", marginBottom: 4, background: "var(--bg-card, var(--bg))", borderRadius: 4, borderLeft: "3px solid " + severityColor(String(f.severity ?? "info")) }}>
                    <span style={{ color: severityColor(String(f.severity ?? "info")), fontWeight: 600 }}>{String(f.severity ?? "info").toUpperCase()}</span>
                    {" -- "}{String(f.issue ?? f.claimText ?? "")}
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--border-dim)", paddingTop: 8, marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "var(--text-faint)" }}>
                Chain: Base L2 / LNES-05
                {clcResult.certificate.tx_hash ? <span> | TX: {String(clcResult.certificate.tx_hash).slice(0, 20)}...</span> : null}
                <span style={{ color: "#22c55e" }}> | Verified</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
