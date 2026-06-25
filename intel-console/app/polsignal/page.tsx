"use client";
// app/polsignal/page.tsx — PolSignal v3: reputation model, guide tab, enriched market view

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface IntelSignal {
  id: string; entityId: string; entityName: string;
  metric: string; signalType: string; value: number;
  confidence: "HIGH" | "LOW" | "UNVERIFIED"; t: string;
}
interface ChannelVote { vote: 'UP' | 'FLAT' | 'DOWN'; confidence: number; raw_value: number; metadata: Record<string, unknown>; }
interface OracleData { confidence: number; channelVotes: Record<string, ChannelVote>; isfTriggered: boolean; proofHash: string; rawProb: number; }
interface SystemPrediction { direction: "UP" | "DOWN" | "FLAT"; probability: number; rationale: string; domainRule: string | null; oracleData?: OracleData; }
interface DomainRule { id: string; domain: string; premise: string; signal: string; summary: string; clarity: number; weight: number; confidence: number; }
interface MarketCard {
  id: string; question: string; source: "polymarket" | "kalshi";
  category: string; endDate: string; volume: number; liquidity: number;
  yesPrice: number; noPrice: number; primaryTokenId: string | null;
  signal: IntelSignal | null; systemPrediction: SystemPrediction; divergence: number;
  sourceUrl?: string;
}
interface UserState {
  score: number; scoreTier: string; scoreTierColor: string;
  tier: string; predictionCount: number; correctCount: number;
  accuracy: number; dailyUsed: number;
  remaining: number | "unlimited"; canPredict: boolean;
  resetIn: string; predictions: PastPrediction[]; loading: boolean;
}
interface PastPrediction {
  id: string; prediction: string; polymarket_market_id: string;
  polymarket_question: string; resolved: boolean; resolved_correct: boolean | null;
  score_delta: number; created_at: string;
}
type PredictionChoice = "UP" | "DOWN" | "FLAT";
type SortKey = "divergence" | "volume" | "closing";
type SourceFilter = "all" | "polymarket" | "kalshi";
type CatFilter = "ALL" | "crypto" | "politics" | "economics" | "sports" | "other";
type ActiveTab = "markets" | "signals" | "rules" | "history" | "upgrade" | "guide";

// ─── User key ──────────────────────────────────────────────────────────────────
function getUserKey(): string {
  if (typeof window === "undefined") return "default";
  let k = localStorage.getItem("polsignal_user_key");
  if (!k) { k = `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`; localStorage.setItem("polsignal_user_key", k); }
  return k;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtPct(n: number) { return `${Math.round(n * 1000) / 10}%`; }
function fmtDiv(n: number) { return `${Math.round(n * 100)} pts`; }
function fmtVol(n: number) { return n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${Math.round(n)}`; }
function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s/60)}m`;
  if (s < 86400) return `${Math.round(s/3600)}h`;
  return `${Math.round(s/86400)}d`;
}
function closingIn(endDate: string) {
  if (!endDate) return "—";
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms < 0) return "closed";
  const d = Math.floor(ms/86400000); const h = Math.floor((ms%86400000)/3600000);
  return d > 0 ? `${d}d` : `${h}h`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SourceBadge({ src }: { src: string }) {
  const s = { background: src === "polymarket" ? "#6d28d9" : "#059669", color: "#fff", fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.06em" };
  return <span style={s}>{src === "polymarket" ? "POLY" : "KALSHI"}</span>;
}
function CatBadge({ cat }: { cat: string }) {
  const colors: Record<string,string> = { crypto: "#f59e0b", politics: "#3b82f6", economics: "#14b8a6", sports: "#ef4444", other: "#6b7280" };
  const s = { background: (colors[cat] ?? "#6b7280") + "22", color: colors[cat] ?? "#6b7280", fontSize: "9px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.05em", textTransform: "uppercase" as const };
  return <span style={s}>{cat}</span>;
}
function ConfBadge({ conf }: { conf: string }) {
  const s = { HIGH: { bg: "var(--bg-success, #d1fae5)", color: "var(--text-success, #065f46)" }, LOW: { bg: "#fef3c722", color: "#d97706" }, UNVERIFIED: { bg: "var(--bg-card)", color: "var(--text-dim)" } }[conf] ?? { bg: "var(--bg-card)", color: "var(--text-dim)" };
  return <span style={{ fontSize: "9px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: s.bg, color: s.color, letterSpacing: "0.05em" }}>{conf}</span>;
}
function DivTag({ div }: { div: number }) {
  const pts = Math.round(div * 100);
  if (pts < 20) return <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>{pts} pts</span>;
  const c = pts >= 35 ? "#f59e0b" : "#94a3b8";
  return <span style={{ fontSize: "12px", fontWeight: 600, color: c }}>{pts >= 35 ? "⚠ " : ""}{pts} pts</span>;
}

// Crowd Probability Bar — prominent, with system marker
function ProbBar({ yesPrice, sysProbability, direction }: { yesPrice: number; sysProbability: number; direction: string }) {
  const crowdPct = Math.round(yesPrice * 100);
  const sysPct   = Math.round(sysProbability * 100);
  const dirColor = direction === "UP" ? "#10b981" : direction === "DOWN" ? "#ef4444" : "#94a3b8";
  return (
    <div style={{ width: "100%" }}>
      {/* Crowd probability — large and obvious */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
        <span style={{ fontSize: "20px", fontWeight: 700, color: crowdPct >= 60 ? "#10b981" : crowdPct <= 40 ? "#ef4444" : "var(--text)" }}>
          {crowdPct}%
          <span style={{ fontSize: "10px", fontWeight: 400, color: "var(--text-dim)", marginLeft: "4px" }}>crowd YES</span>
        </span>
        <span style={{ fontSize: "12px", color: dirColor, fontWeight: 600 }}>
          SEI: {sysPct}% {direction === "UP" ? "↑" : direction === "DOWN" ? "↓" : "→"}
        </span>
      </div>
      {/* Bar: crowd fill + system marker */}
      <div style={{ position: "relative", height: "8px", borderRadius: "4px", background: "var(--border-mid, #334155)", overflow: "visible" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${crowdPct}%`, borderRadius: "4px", background: crowdPct >= 60 ? "#10b981" : crowdPct <= 40 ? "#ef4444" : "#64748b", transition: "width 0.3s" }} />
        {/* System probability marker */}
        <div style={{ position: "absolute", top: "-3px", left: `${sysPct}%`, transform: "translateX(-50%)", width: "3px", height: "14px", background: "#f59e0b", borderRadius: "2px", zIndex: 2 }} title={`SEI system: ${sysPct}%`} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px", fontSize: "9px", color: "var(--text-dim)" }}>
        <span>NO {Math.round((1-yesPrice)*100)}%</span>
        <span style={{ color: "#f59e0b" }}>▲ SEI {sysPct}%</span>
        <span>YES {crowdPct}%</span>
      </div>
    </div>
  );
}

// ─── Market Row ────────────────────────────────────────────────────────────────
function MarketRow({ market, expanded, onToggle, vote, onVote, submitting, canVote }: {
  market: MarketCard; expanded: boolean; onToggle: () => void;
  vote: PredictionChoice | null; onVote: (c: PredictionChoice) => void;
  submitting: boolean; canVote: boolean;
}) {
  const div = Math.round(market.divergence * 100);
  const sp  = market.systemPrediction;
  const sig = market.signal;

  return (
    <div style={{ borderBottom: "0.5px solid var(--border-mid)", background: expanded ? "var(--bg-card)" : "transparent", transition: "background 0.15s" }}>
      {/* Collapsed row */}
      <div onClick={onToggle} style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px 90px 120px", gap: "12px", alignItems: "center", padding: "10px 16px", cursor: "pointer", userSelect: "none" }}>
        {/* Source + Category */}
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          <SourceBadge src={market.source} />
          <CatBadge cat={market.category} />
        </div>
        {/* Question + source link */}
        <div style={{ overflow: "hidden" }}>
          <div style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{market.question}</div>
          {market.sourceUrl && (
            <a
              href={market.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: "10px", color: "var(--text-dim)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "2px", marginTop: "2px", opacity: 0.7 }}
            >
              ↗ {market.source === "polymarket" ? "polymarket.com" : "kalshi.com"}
            </a>
          )}
        </div>
        {/* Crowd probability — prominent in collapsed view */}
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "18px", fontWeight: 700, color: market.yesPrice >= 0.6 ? "#10b981" : market.yesPrice <= 0.4 ? "#ef4444" : "var(--text)" }}>{Math.round(market.yesPrice * 100)}%</span>
          <span style={{ fontSize: "10px", color: "var(--text-dim)", marginLeft: "3px" }}>YES</span>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "1px" }}>SEI: {Math.round(sp.probability * 100)}%</div>
        </div>
        {/* Divergence */}
        <div style={{ textAlign: "center" }}><DivTag div={market.divergence} /></div>
        {/* Signal entity */}
        <div style={{ fontSize: "11px", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sig ? <span style={{ color: "var(--text)" }}>{sig.entityName}</span> : "no signal"}
          {sig && <ConfBadge conf={sig.confidence} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "20px", alignItems: "start" }}>
          {/* Probability display */}
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "8px", letterSpacing: "0.06em" }}>CROWD vs SEI SYSTEM</div>
            <ProbBar yesPrice={market.yesPrice} sysProbability={sp.probability} direction={sp.direction} />
          </div>

          {/* System prediction */}
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "8px", letterSpacing: "0.06em" }}>SEI ANALYSIS</div>
            <div style={{ fontSize: "11px", color: "var(--text-dim)", lineHeight: 1.6 }}>{sp.rationale}</div>
            {sp.domainRule && <div style={{ fontSize: "10px", marginTop: "6px", color: "var(--text-dim)", fontStyle: "italic" }}>Rule: {sp.domainRule}</div>}
            {sp.oracleData?.isfTriggered && (
              <div style={{ marginTop: "8px", padding: "6px 10px", border: "0.5px solid #10b981", borderRadius: "6px", background: "rgba(16,185,129,0.08)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 500 }}>Early detection — divergence exceeds threshold</span>
                <button onClick={() => navigator.clipboard?.writeText("https://exergynet.org/proof/" + sp.oracleData?.proofHash)} style={{ fontSize: "10px", padding: "2px 8px", border: "0.5px solid #10b981", borderRadius: "4px", background: "transparent", cursor: "pointer", color: "#10b981", flexShrink: 0 }}>Copy proof</button>
              </div>
            )}
            {sp.oracleData?.channelVotes && (
              <div style={{ marginTop: "8px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "4px", letterSpacing: "0.06em" }}>ORACLE CHANNELS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px" }}>
                  {Object.entries(sp.oracleData.channelVotes).map(([name, v]) => (
                    <div key={name} style={{ padding: "4px", borderRadius: "4px", background: "var(--bg-card)", border: "0.5px solid var(--border-mid)", textAlign: "center" }}>
                      <div style={{ fontSize: "9px", color: "var(--text-dim)", textTransform: "uppercase" }}>{name.replace("_"," ")}</div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: v.vote === "UP" ? "#10b981" : v.vote === "DOWN" ? "#ef4444" : "var(--text-dim)" }}>{v.vote}</div>
                      <div style={{ fontSize: "9px", color: "var(--text-dim)" }}>{(v.confidence * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-dim)" }}>
              {market.volume > 0 && <span>Vol: {fmtVol(market.volume)} · </span>}
              Closes in {closingIn(market.endDate)}
            </div>
          </div>

          {/* Intel signal */}
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "8px", letterSpacing: "0.06em" }}>INTEL SIGNAL</div>
            {sig ? (
              <>
                <div style={{ fontSize: "13px", fontWeight: 600 }}>{sig.entityName}</div>
                <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{sig.metric} · {sig.signalType}</div>
                <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px", color: sig.value > 1.5 ? "#10b981" : sig.value < -1.5 ? "#ef4444" : "var(--text)" }}>
                  {sig.value >= 0 ? "+" : ""}{sig.value.toFixed(2)} z
                </div>
                <div style={{ marginTop: "4px" }}><ConfBadge conf={sig.confidence} /></div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>{timeAgo(sig.t)} ago</div>
              </>
            ) : (
              <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>No matching Intel signal.<br/>System defaults to FLAT 50%.</div>
            )}
          </div>

          {/* Vote buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "90px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", letterSpacing: "0.06em", marginBottom: "4px" }}>YOUR CALL</div>
            {(["UP", "DOWN", "FLAT"] as PredictionChoice[]).map(c => {
              const isVoted = vote === c;
              const bg = isVoted ? (c === "UP" ? "#10b981" : c === "DOWN" ? "#ef4444" : "#6b7280") : "var(--bg-card)";
              const col = isVoted ? "#fff" : "var(--text-dim)";
              return (
                <button key={c} disabled={!!vote || submitting || !canVote} onClick={() => onVote(c)}
                  style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, background: bg, color: col, border: `1px solid ${isVoted ? bg : "var(--border-mid)"}`, borderRadius: "6px", cursor: vote || !canVote ? "default" : "pointer", opacity: (vote && !isVoted) || (!canVote && !isVoted) ? 0.4 : 1, transition: "all 0.15s" }}>
                  {c}
                </button>
              );
            })}
            {vote && <div style={{ fontSize: "9px", color: "var(--text-dim)", marginTop: "2px", textAlign: "center" }}>Locked ✓</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Guide Tab ─────────────────────────────────────────────────────────────────
function GuideTab() {
  const [guideTab, setGuideTab] = useState<"how" | "simulator" | "signals" | "tiers" | "faq">("how");
  const [simState, setSimState] = useState({ score: 100, total: 0, correct: 0, remaining: 5, idx: 0, voted: null as string | null, resolved: false });
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [zVal, setZVal] = useState(3);
  const [divCrowd, setDivCrowd] = useState(70);
  const [divSys, setDivSys] = useState(35);

  const SIM_MARKETS = [
    { q: "Will Bitcoin exceed $150,000 by Q3 2026?", src: "Polymarket · Crypto · closes Sep 30", crowd: 62, sys: 31, dir: "DOWN", outcome: "NO" },
    { q: "Will the Fed cut rates in July 2026?", src: "Kalshi · Economics · closes Jul 31", crowd: 44, sys: 68, dir: "UP", outcome: "YES" },
    { q: "Will S&P 500 close above 6,000 by end of June?", src: "Polymarket · Macro · closes Jun 30", crowd: 71, sys: 58, dir: "UP", outcome: "YES" },
    { q: "Will Ethereum reach $5,000 by September 2026?", src: "Kalshi · Crypto · closes Sep 30", crowd: 38, sys: 65, dir: "UP", outcome: "YES" },
    { q: "Will US CPI be below 3% in the next reading?", src: "Polymarket · Economics · closes Jul 15", crowd: 55, sys: 42, dir: "DOWN", outcome: "NO" },
  ];

  const FAQS = [
    { q: "What is CPTX?", a: "CPTX is your prediction reputation score. It starts at 0 and grows when you make accurate predictions. It is not money — you cannot withdraw it or spend it. It measures how good you are at calling prediction market outcomes." },
    { q: "Can I run out of CPTX?", a: "No. CPTX is a score, not a currency. It can go negative if you make many wrong predictions, but it never locks you out. What limits your daily activity is the prediction count (5/day on free tier), which resets every midnight UTC." },
    { q: "How does scoring work?", a: "Correct prediction: +10 CPTX (accuracy) +1 CPTX (participation) = +11 total. Wrong prediction: -3 CPTX (accuracy) +1 CPTX (participation) = -2 total. You need to be correct more than 38% of the time to grow your score." },
    { q: "What is divergence?", a: "Divergence = |crowd probability − SEI system probability|. High divergence means the crowd and the Intel signal strongly disagree. Those markets appear at the top because they represent the greatest potential information edge." },
    { q: "What is the Intel Console signal?", a: "The Intel Console ingests prices every 15 minutes, computes z-scores (how many standard deviations from the recent mean), and classifies signals as HIGH, LOW, or UNVERIFIED. PolSignal matches those z-scores to prediction market questions and computes system probability." },
    { q: "Is CPTX real money?", a: "No. CPTX has no monetary value. It cannot be bought, sold, or withdrawn. It is purely an internal calibration score, keeping PolSignal outside gambling regulations." },
  ];

  const m = SIM_MARKETS[simState.idx % SIM_MARKETS.length];
  const simDiv = Math.abs(m.crowd - m.sys);
  const zDir = zVal > 1.5 ? "UP" : zVal < -1.5 ? "DOWN" : "FLAT";
  const zProb = Math.min(95, Math.max(5, Math.round(50 + Math.atan(zVal * 0.4) / Math.PI * 100)));
  const zConf = Math.abs(zVal) >= 3 ? "HIGH" : Math.abs(zVal) >= 1.5 ? "LOW" : "UNVERIFIED";
  const divAbs = Math.abs(divCrowd - divSys);
  const scoreTier = (s: number) => s >= 1000 ? "Oracle" : s >= 500 ? "Expert" : s >= 200 ? "Strategist" : s >= 50 ? "Analyst" : "Novice";
  const acc = simState.total > 0 ? Math.round(simState.correct / simState.total * 100) : null;

  function simVote(dir: string) {
    if (simState.voted || simState.remaining <= 0) return;
    setSimState(s => ({ ...s, voted: dir, remaining: s.remaining - 1 }));
  }
  function simResolve() {
    if (!simState.voted || simState.resolved) return;
    const winning = m.outcome === "YES" ? "UP" : "DOWN";
    const correct = simState.voted === winning;
    setSimState(s => ({
      ...s, resolved: true, total: s.total + 1,
      correct: correct ? s.correct + 1 : s.correct,
      score: Math.max(0, s.score + (correct ? 11 : -2)),
    }));
  }
  function simNext() {
    setSimState(s => ({ ...s, idx: s.idx + 1, voted: null, resolved: false }));
  }

  const cardStyle = { background: "var(--bg-card)", border: "0.5px solid var(--border-mid)", borderRadius: "var(--radius, 8px)", padding: "14px 16px" };
  const labelStyle = { fontSize: "10px", color: "var(--text-dim)", letterSpacing: "0.06em", marginBottom: "6px" };
  const bigStyle = { fontSize: "28px", fontWeight: 600 as const, lineHeight: 1 };

  const TABS: { id: typeof guideTab; label: string }[] = [
    { id: "how", label: "How it works" }, { id: "simulator", label: "Try it live" },
    { id: "signals", label: "The Intel signal" }, { id: "tiers", label: "Plans" }, { id: "faq", label: "FAQ" },
  ];

  return (
    <div>
      {/* Guide nav */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "0.5px solid var(--border-mid)", marginBottom: "24px", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setGuideTab(t.id)} style={{ padding: "8px 16px", fontSize: "13px", background: "transparent", border: "none", borderBottom: guideTab === t.id ? "2px solid var(--accent)" : "2px solid transparent", color: guideTab === t.id ? "var(--text)" : "var(--text-dim)", cursor: "pointer", marginBottom: "-1px", fontWeight: guideTab === t.id ? 500 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* HOW IT WORKS */}
      {guideTab === "how" && (
        <div>
          <p style={{ fontSize: "14px", color: "var(--text-dim)", marginBottom: "24px", lineHeight: 1.7 }}>
            PolSignal is a prediction calibration layer. Browse live markets from Polymarket and Kalshi, see what the Intel Console signal says about the underlying asset, and cast your prediction. Your CPTX score rises when you are right and falls slightly when you are wrong. It never runs out.
          </p>

          <div style={{ fontSize: "10px", color: "var(--text-dim)", letterSpacing: "0.06em", marginBottom: "16px" }}>HOW A PREDICTION WORKS</div>
          {[
            { n: 1, title: "Browse markets", desc: "PolSignal pulls live markets from Polymarket and Kalshi. Each shows the crowd YES% and how much it diverges from the Intel Console signal. Markets are sorted by divergence — highest disagreement between crowd and machine first." },
            { n: 2, title: "See the full picture", desc: "Click any market to expand it. You see four data layers: crowd probability (the YES bar), SEI system probability (the amber marker), the Intel z-score for the linked asset, and the divergence. When crowd says 70% YES and the system says 35%, that 35-point gap is the edge." },
            { n: 3, title: "Cast your prediction: UP, DOWN, or FLAT", desc: "You pick a direction. No money changes hands. One prediction per market per day. Free users get 5 predictions per day. Pro users are unlimited. Locked in once you vote." },
            { n: 4, title: "Wait for resolution", desc: "When the market closes on-chain (Polymarket UMA oracle or Kalshi settlement), the system checks your prediction. Correct: +11 CPTX. Wrong: -2 CPTX. You always earn 1 point for participating." },
            { n: 5, title: "Watch your score grow", desc: "Your CPTX score and accuracy % are your calibration credentials. 500+ means you consistently outperform random. At 1,000 you reach Oracle tier." },
          ].map(step => (
            <div key={step.n} style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 500, flexShrink: 0, border: "0.5px solid var(--border-mid)", background: "var(--bg-card)", color: "var(--text)" }}>{step.n}</div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}>{step.title}</div>
                <div style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            </div>
          ))}

          <div style={{ fontSize: "10px", color: "var(--text-dim)", letterSpacing: "0.06em", marginBottom: "12px" }}>CPTX SCORING AT A GLANCE</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
            {[
              { label: "Correct", val: "+11", sub: "+10 accuracy · +1 participation", color: "#10b981" },
              { label: "Wrong", val: "−2", sub: "−3 accuracy · +1 participation", color: "#ef4444" },
              { label: "Break-even", val: "38%", sub: "correct rate to grow score", color: "var(--text)" },
              { label: "Daily limit", val: "5 / ∞", sub: "free / pro · resets midnight UTC", color: "var(--text)" },
            ].map(item => (
              <div key={item.label} style={{ ...cardStyle, textAlign: "center" }}>
                <div style={labelStyle}>{item.label.toUpperCase()}</div>
                <div style={{ ...bigStyle, color: item.color }}>{item.val}</div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>{item.sub}</div>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>REPUTATION TIERS</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
              {[{ l: "Novice · 0+", bg: "#f1f5f9", c: "#6b7280" }, { l: "Analyst · 50+", bg: "#dbeafe", c: "#1e40af" }, { l: "Strategist · 200+", bg: "#ede9fe", c: "#5b21b6" }, { l: "Expert · 500+", bg: "#fef3c7", c: "#92400e" }, { l: "Oracle · 1000+", bg: "#d1fae5", c: "#065f46" }].map(t => (
                <span key={t.l} style={{ background: t.bg, color: t.c, fontSize: "11px", fontWeight: 500, padding: "3px 10px", borderRadius: "20px" }}>{t.l}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SIMULATOR */}
      {guideTab === "simulator" && (
        <div>
          <p style={{ fontSize: "14px", color: "var(--text-dim)", marginBottom: "20px", lineHeight: 1.7 }}>Try the prediction loop. Pick UP, DOWN, or FLAT, lock in your vote, resolve the market, and watch your simulated score move. Five markets are queued.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
            {[
              { label: "CPTX score", val: simState.score, sub: `${scoreTier(simState.score)}`, color: simState.score >= 1000 ? "#10b981" : simState.score >= 500 ? "#f59e0b" : simState.score >= 200 ? "#8b5cf6" : simState.score >= 50 ? "#3b82f6" : "#6b7280" },
              { label: "Accuracy", val: acc !== null ? `${acc}%` : "—", sub: acc !== null ? `${simState.correct} of ${simState.total} correct` : "no predictions yet", color: "var(--text)" },
              { label: "Today remaining", val: Math.max(0, simState.remaining), sub: "free tier", color: "var(--text)" },
              { label: "Predictions", val: simState.total, sub: `${simState.correct} correct`, color: "var(--text)" },
            ].map(item => (
              <div key={item.label} style={{ ...cardStyle, textAlign: "center" }}>
                <div style={labelStyle}>{item.label.toUpperCase()}</div>
                <div style={{ ...bigStyle, color: item.color }}>{item.val}</div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>{item.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, marginBottom: "2px" }}>{m.q}</div>
                <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{m.src}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>divergence</div>
                <div style={{ fontSize: "18px", fontWeight: 600, color: simDiv >= 35 ? "#f59e0b" : "var(--text)" }}>+{simDiv} pts</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "14px" }}>
              <div>
                <div style={labelStyle}>CROWD (Polymarket)</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: m.crowd >= 60 ? "#10b981" : m.crowd <= 40 ? "#ef4444" : "var(--text)" }}>{m.crowd}% YES</div>
                <div style={{ height: "6px", borderRadius: "3px", background: "var(--border-mid)", marginTop: "6px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${m.crowd}%`, background: m.crowd >= 60 ? "#10b981" : "#ef4444", borderRadius: "3px" }} />
                </div>
              </div>
              <div>
                <div style={labelStyle}>INTEL SIGNAL</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: m.dir === "UP" ? "#10b981" : "#ef4444" }}>{m.sys}% — {m.dir}</div>
                <div style={{ height: "6px", borderRadius: "3px", background: "var(--border-mid)", marginTop: "6px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${m.sys}%`, background: m.dir === "UP" ? "#10b981" : "#ef4444", borderRadius: "3px" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Your prediction:</span>
              {(["UP", "DOWN", "FLAT"] as const).map(d => (
                <button key={d} disabled={!!simState.voted || simState.remaining <= 0} onClick={() => simVote(d)}
                  style={{ padding: "6px 18px", fontSize: "13px", fontWeight: 500, background: simState.voted === d ? (d === "UP" ? "#10b981" : d === "DOWN" ? "#ef4444" : "#6b7280") : "transparent", color: simState.voted === d ? "#fff" : "var(--text-dim)", border: "0.5px solid var(--border-mid)", borderRadius: "6px", cursor: "pointer", opacity: simState.voted && simState.voted !== d ? 0.4 : 1 }}>
                  {d}
                </button>
              ))}
              {simState.voted && !simState.resolved && (
                <button onClick={simResolve} style={{ marginLeft: "auto", padding: "6px 14px", fontSize: "12px", border: "0.5px solid var(--border-mid)", borderRadius: "6px", background: "transparent", cursor: "pointer", color: "var(--text)" }}>Resolve market ↗</button>
              )}
              {simState.resolved && (
                <button onClick={simNext} style={{ marginLeft: "auto", padding: "6px 14px", fontSize: "12px", border: "0.5px solid var(--border-mid)", borderRadius: "6px", background: "transparent", cursor: "pointer", color: "var(--text)" }}>Next market →</button>
              )}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "8px" }}>
              {simState.remaining <= 0 ? "Daily limit reached (5/day on free tier). Upgrade to Pro for unlimited." :
               simState.voted && !simState.resolved ? "Vote locked. Click 'Resolve market' to see the outcome." :
               simState.resolved ? "Market resolved. Click 'Next market' to continue." :
               "Pick UP, DOWN, or FLAT based on the signal and crowd data above."}
            </div>
          </div>
        </div>
      )}

      {/* INTEL SIGNAL */}
      {guideTab === "signals" && (
        <div>
          <p style={{ fontSize: "14px", color: "var(--text-dim)", marginBottom: "20px", lineHeight: 1.7 }}>The Intel Console signal is what makes PolSignal different from just looking at Polymarket or Kalshi prices. It is a statistical anomaly score derived from live market data — independent of the crowd.</p>

          <div style={{ marginBottom: "24px" }}>
            <div style={labelStyle}>WHAT IS THE Z-SCORE?</div>
            <div style={{ ...cardStyle, marginTop: "10px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.7, marginBottom: "16px" }}>The z-score measures how many standard deviations a price is from its recent mean. z=+3 means 3 standard deviations above the 20-period average — a strong upward anomaly.</p>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", color: "var(--text-dim)" }}>Try a z-score: <strong style={{ color: "var(--text)" }}>{zVal >= 0 ? "+" : ""}{zVal.toFixed(1)}</strong></label>
                <input type="range" min={-4} max={4} step={0.5} value={zVal} onChange={e => setZVal(parseFloat(e.target.value))} style={{ width: "100%", marginTop: "8px" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div style={cardStyle}>
                  <div style={labelStyle}>DIRECTION</div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: zDir === "UP" ? "#10b981" : zDir === "DOWN" ? "#ef4444" : "var(--text-dim)" }}>{zDir}</div>
                </div>
                <div style={cardStyle}>
                  <div style={labelStyle}>SYSTEM PROB</div>
                  <div style={{ fontSize: "18px", fontWeight: 600 }}>{zProb}%</div>
                </div>
                <div style={cardStyle}>
                  <div style={labelStyle}>CONFIDENCE</div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: zConf === "HIGH" ? "#10b981" : zConf === "LOW" ? "#f59e0b" : "var(--text-dim)" }}>{zConf}</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={labelStyle}>WHAT IS DIVERGENCE?</div>
            <div style={{ ...cardStyle, marginTop: "10px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.7, marginBottom: "16px" }}>Divergence = |crowd probability − system probability|. High divergence is where the information edge lives.</p>
              <div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-dim)" }}>
                <span>Crowd: <strong>{divCrowd}%</strong> YES</span>
                <span>SEI: <strong>{divSys}%</strong> YES</span>
                <span style={{ color: divAbs >= 30 ? "#f59e0b" : "var(--text-dim)" }}>Divergence: <strong>{divAbs} pts</strong></span>
              </div>
              <input type="range" min={0} max={100} value={divCrowd} onChange={e => setDivCrowd(parseInt(e.target.value))} style={{ width: "100%", marginBottom: "8px" }} />
              <input type="range" min={0} max={100} value={divSys} onChange={e => setDivSys(parseInt(e.target.value))} style={{ width: "100%" }} />
              <div style={{ marginTop: "10px", fontSize: "12px", padding: "8px 12px", borderRadius: "6px", background: "var(--bg-surface, var(--bg-card))", color: "var(--text-dim)" }}>
                {divAbs >= 30 ? "Strong divergence. The signal and crowd disagree significantly — this market appears at the top of PolSignal." :
                 divAbs >= 15 ? "Moderate divergence. Worth examining but not a clear edge." :
                 "Low divergence. Signal and crowd largely agree — no strong edge visible."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIERS */}
      {guideTab === "tiers" && (
        <div>
          <p style={{ fontSize: "14px", color: "var(--text-dim)", marginBottom: "20px", lineHeight: 1.7 }}>PolSignal is free to start. Upgrade when you need more predictions per day, deeper signal data, or API access.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
            {[
              { name: "Free", price: "$0", sub: "always free · no card needed", features: ["5 predictions per day", "Basic divergence score", "CPTX reputation score", "Polymarket + Kalshi browser", "Intel signal match"], featured: false },
              { name: "Pro", price: "$29/mo", sub: "billed in USDC · cancel anytime", features: ["Unlimited predictions", "Full signal history (30 days)", "Divergence alerts", "5 Vanguard briefs/day", "Kalshi candlestick charts", "Everything in Free"], featured: true },
              { name: "API", price: "$199/mo", sub: "+ $0.01/call above 1,000/day", features: ["Everything in Pro", "1,000 API calls/day", "/divergence/top endpoint", "/signal/{marketId}", "/history/{entityId}", "10 Vanguard briefs/day"], featured: false },
            ].map(tier => (
              <div key={tier.name} style={{ border: tier.featured ? "1.5px solid var(--accent)" : "0.5px solid var(--border-mid)", borderRadius: "var(--radius, 8px)", padding: "20px", background: "var(--bg-card)" }}>
                {tier.featured && <div style={{ display: "inline-block", fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: "#dbeafe", color: "#1e40af", marginBottom: "8px" }}>Most popular</div>}
                <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>{tier.name}</div>
                <div style={{ fontSize: "24px", fontWeight: 700, marginBottom: "2px" }}>{tier.price}</div>
                <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "14px" }}>{tier.sub}</div>
                {tier.features.map(f => (
                  <div key={f} style={{ fontSize: "12px", color: "var(--text-dim)", padding: "4px 0", display: "flex", gap: "8px" }}>
                    <span style={{ color: "#10b981" }}>✓</span><span>{f}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>SCORE GROWS WITH YOU — NO LOCKOUT EVER</div>
            <p style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.7, marginTop: "8px" }}>CPTX is a reputation score, not a currency. You never spend it and it never runs out. Your daily prediction limit resets at midnight UTC regardless of your score.</p>
          </div>
        </div>
      )}

      {/* FAQ */}
      {guideTab === "faq" && (
        <div>
          {FAQS.map((f, i) => (
            <div key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ borderBottom: "0.5px solid var(--border-mid)", padding: "14px 0", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", fontWeight: 500 }}>
                <span>{f.q}</span>
                <span style={{ color: "var(--text-dim)", fontSize: "16px", transform: openFaq === i ? "rotate(180deg)" : "", transition: "transform 0.2s" }}>⌄</span>
              </div>
              {openFaq === i && <div style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.7, marginTop: "10px" }}>{f.a}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PolSignalPage() {
  const [markets, setMarkets]         = useState<MarketCard[]>([]);
  const [signals, setSignals]         = useState<IntelSignal[]>([]);
  const [rules, setRules]             = useState<DomainRule[]>([]);
  const [user, setUser]               = useState<UserState>({
    score: 0, scoreTier: "Novice", scoreTierColor: "#6b7280",
    tier: "free", predictionCount: 0, correctCount: 0,
    accuracy: 0, dailyUsed: 0, remaining: 5, canPredict: true,
    resetIn: "24h 0m", predictions: [], loading: true,
  });
  const [meta, setMeta]               = useState({ polyCount: 0, kalshiCount: 0, signalCount: 0 });
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<ActiveTab>("markets");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [catFilter, setCatFilter]     = useState<CatFilter>("ALL");
  const [sortKey, setSortKey]         = useState<SortKey>("divergence");
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [votes, setVotes]             = useState<Record<string, PredictionChoice>>({});
  const [submitting, setSubmitting]   = useState<string | null>(null);
  const [voteError, setVoteError]     = useState<string | null>(null);
  const userKeyRef                    = useRef<string>("default");

  // Theme sync from parent embed
  useEffect(() => {
    if (typeof window !== "undefined") userKeyRef.current = getUserKey();
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "SET_THEME") document.documentElement.setAttribute("data-theme", e.data.theme);
    };
    window.addEventListener("message", handler);
    const p = new URLSearchParams(window.location.search);
    if (p.get("theme") === "light") document.documentElement.setAttribute("data-theme", "light");
    return () => window.removeEventListener("message", handler);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const r = await fetch("/intel/api/user", { headers: { "x-user-key": userKeyRef.current } });
      const d = await r.json();
      setUser({ ...d, loading: false });
    } catch { setUser(u => ({ ...u, loading: false })); }
  }, []);

  const refreshMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/intel/api/polsignal");
      const d = await r.json();
      setMarkets(d.markets ?? []);
      setSignals(d.signals ?? []);
      setRules(d.rules ?? []);
      setMeta(d.meta ?? {});
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { refreshMarkets(); refreshUser(); }, [refreshMarkets, refreshUser]);

  // Filter + sort
  const filtered = markets
    .filter(m => sourceFilter === "all" || m.source === sourceFilter)
    .filter(m => catFilter === "ALL" || m.category === catFilter)
    .sort((a, b) =>
      sortKey === "divergence" ? b.divergence - a.divergence :
      sortKey === "volume"     ? b.volume - a.volume :
      new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    );

  const strongEdges    = markets.filter(m => m.divergence >= 0.35).length;
  const signalMatches  = markets.filter(m => m.signal !== null).length;

  const castVote = async (market: MarketCard, choice: PredictionChoice) => {
    const key = market.id;
    if (votes[key] || submitting) return;

    if (!user.canPredict) {
      setVoteError(
        user.tier === "free"
          ? `Daily limit reached (5/day on free tier). Resets in ${user.resetIn}. Upgrade to Pro for unlimited predictions.`
          : `Daily limit reached. Resets in ${user.resetIn}.`
      );
      return;
    }

    setSubmitting(key);
    setVoteError(null);

    const res = await fetch("/intel/api/polsignal", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-key": userKeyRef.current },
      body: JSON.stringify({
        marketId: market.id, source: market.source, question: market.question,
        prediction: choice, yesPrice: market.yesPrice,
        systemProbability: market.systemPrediction.probability,
        divergence: market.divergence,
        signalId: market.signal?.id ?? null,
        entityId: market.signal?.entityId ?? null,
        metric:   market.signal?.metric ?? null,
        zScoreAtVote: market.signal?.value ?? null,
        userKey: userKeyRef.current,
      }),
    });

    const data = await res.json();
    if (res.status === 429) {
      setVoteError(data.error + (data.upgrade ? ` ${data.upgrade}` : ""));
    } else if (res.status === 409) {
      setVotes(prev => ({ ...prev, [key]: choice }));
    } else if (!res.ok) {
      setVoteError(data.error ?? "Vote failed.");
    } else {
      setVotes(prev => ({ ...prev, [key]: choice }));
      await refreshUser();
    }
    setSubmitting(null);
  };

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "markets",  label: `Markets (${filtered.length})` },
    { id: "signals",  label: `Intel Signals (${signals.length})` },
    { id: "rules",    label: `Domain Rules (${rules.length})` },
    { id: "history",  label: `History (${user.predictions.length})` },
    { id: "upgrade",  label: "⬆ Upgrade" },
    { id: "guide",    label: "? Guide" },
  ];

  const CATS: CatFilter[] = ["ALL", "crypto", "politics", "economics", "sports", "other"];

  return (
    <div style={{ fontFamily: "var(--font-sans, system-ui)", color: "var(--text)", padding: "24px", maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600, margin: 0 }}>PolSignal</h1>
          <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "4px 0 0" }}>Prediction calibration · Polymarket + Kalshi · Intel Console enrichment</p>
        </div>
        <button onClick={() => { refreshMarkets(); refreshUser(); }} style={{ fontSize: "12px", color: "var(--text-dim)", background: "var(--bg-card)", border: "0.5px solid var(--border-mid)", borderRadius: "6px", padding: "6px 12px", cursor: "pointer" }}>↺ Refresh</button>
      </div>

      {/* Stat cards — new reputation model */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "16px" }}>
        {/* CPTX Score */}
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius, 8px)", padding: "14px 16px", border: "0.5px solid var(--border-mid)" }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: "6px" }}>CPTX SCORE</div>
          <div style={{ fontSize: "28px", fontWeight: 600, color: user.scoreTierColor, lineHeight: 1 }}>{user.loading ? "…" : user.score}</div>
          <div style={{ fontSize: "11px", color: user.scoreTierColor, marginTop: "2px" }}>{user.scoreTier}</div>
        </div>
        {/* Daily remaining */}
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius, 8px)", padding: "14px 16px", border: "0.5px solid var(--border-mid)" }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: "6px" }}>TODAY</div>
          <div style={{ fontSize: "28px", fontWeight: 600, lineHeight: 1 }}>{user.remaining === "unlimited" ? "∞" : user.remaining}</div>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>{user.remaining === "unlimited" ? "unlimited remaining" : `of ${user.dailyUsed + Number(user.remaining)} used ${user.dailyUsed}`}</div>
        </div>
        {/* Accuracy */}
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius, 8px)", padding: "14px 16px", border: "0.5px solid var(--border-mid)" }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: "6px" }}>ACCURACY</div>
          <div style={{ fontSize: "28px", fontWeight: 600, lineHeight: 1 }}>{user.accuracy}%</div>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>{user.correctCount} of {user.predictionCount} correct</div>
        </div>
        {/* Markets */}
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius, 8px)", padding: "14px 16px", border: "0.5px solid var(--border-mid)" }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: "6px" }}>MARKETS</div>
          <div style={{ fontSize: "28px", fontWeight: 600, lineHeight: 1 }}>{markets.length}</div>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>{meta.polyCount}P + {meta.kalshiCount}K · {strongEdges} edges</div>
        </div>
        {/* Tier */}
        <div onClick={() => setActiveTab("upgrade")} style={{ background: "var(--bg-card)", borderRadius: "var(--radius, 8px)", padding: "14px 16px", border: "0.5px solid var(--border-mid)", cursor: "pointer" }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: "6px" }}>TIER</div>
          <div style={{ fontSize: "18px", fontWeight: 600, textTransform: "capitalize", lineHeight: 1 }}>{user.tier}</div>
          {user.tier === "free" && <div style={{ fontSize: "11px", color: "var(--accent)", marginTop: "4px" }}>Upgrade → Pro</div>}
        </div>
      </div>

      {/* Scoring rules bar */}
      <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius, 8px)", padding: "10px 16px", marginBottom: "20px", fontSize: "12px", color: "var(--text-dim)", display: "flex", gap: "20px", flexWrap: "wrap", border: "0.5px solid var(--border-mid)", alignItems: "center" }}>
        <span>✅ Correct: <strong style={{ color: "var(--text)" }}>+11 CPTX</strong></span>
        <span>❌ Wrong: <strong style={{ color: "var(--text)" }}>−2 CPTX</strong></span>
        <span>🎯 Participate: <strong style={{ color: "var(--text)" }}>+1 CPTX</strong></span>
        <span style={{ marginLeft: "auto" }}>Resets in <strong style={{ color: "var(--text)" }}>{user.resetIn}</strong></span>
        <span>Divergence = |crowd% − system%| · ≥35pts edge</span>
      </div>

      {/* Vote error */}
      {voteError && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#991b1b", display: "flex", justifyContent: "space-between" }}>
          <span>{voteError}</span>
          <button onClick={() => setVoteError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b" }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", borderBottom: "0.5px solid var(--border-mid)", marginBottom: "16px", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "8px 16px", fontSize: "13px", background: "transparent", border: "none", borderBottom: activeTab === t.id ? "2px solid var(--accent)" : "2px solid transparent", color: activeTab === t.id ? "var(--text)" : "var(--text-dim)", cursor: "pointer", whiteSpace: "nowrap", fontWeight: activeTab === t.id ? 500 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Markets tab ── */}
      {activeTab === "markets" && (
        <div>
          {/* Filters */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              {(["all", "polymarket", "kalshi"] as SourceFilter[]).map(s => (
                <button key={s} onClick={() => setSourceFilter(s)} style={{ padding: "5px 10px", fontSize: "11px", fontWeight: 600, background: sourceFilter === s ? "var(--accent)" : "var(--bg-card)", color: sourceFilter === s ? "#fff" : "var(--text-dim)", border: "0.5px solid var(--border-mid)", borderRadius: "6px", cursor: "pointer", textTransform: "capitalize" }}>
                  {s === "all" ? "All Sources" : s === "polymarket" ? `Polymarket (${meta.polyCount})` : `Kalshi (${meta.kalshiCount})`}
                </button>
              ))}
            </div>
            <div style={{ width: "1px", height: "20px", background: "var(--border-mid)" }} />
            <div style={{ display: "flex", gap: "4px" }}>
              {CATS.map(c => (
                <button key={c} onClick={() => setCatFilter(c)} style={{ padding: "5px 10px", fontSize: "11px", background: catFilter === c ? "var(--bg-surface, var(--bg-card))" : "transparent", color: catFilter === c ? "var(--text)" : "var(--text-dim)", border: `0.5px solid ${catFilter === c ? "var(--accent)" : "var(--border-mid)"}`, borderRadius: "20px", cursor: "pointer" }}>
                  {c}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
              {(["divergence", "volume", "closing"] as SortKey[]).map(s => (
                <button key={s} onClick={() => setSortKey(s)} style={{ padding: "5px 10px", fontSize: "11px", background: sortKey === s ? "var(--bg-card)" : "transparent", color: sortKey === s ? "var(--text)" : "var(--text-dim)", border: `0.5px solid ${sortKey === s ? "var(--accent)" : "var(--border-mid)"}`, borderRadius: "6px", cursor: "pointer" }}>
                  {s === "divergence" ? "Divergence ↓" : s === "volume" ? "Volume ↓" : "Closing ↑"}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px 90px 120px", gap: "12px", padding: "6px 16px", fontSize: "10px", color: "var(--text-dim)", letterSpacing: "0.06em", borderBottom: "0.5px solid var(--border-mid)" }}>
            <span>SOURCE</span><span>QUESTION</span><span style={{ textAlign: "center" }}>CROWD PROB</span><span style={{ textAlign: "center" }}>DIVERGENCE</span><span>INTEL SIGNAL</span>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>Loading markets…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>No markets match the current filter.</div>
          ) : (
            filtered.map(m => (
              <MarketRow key={m.id} market={m} expanded={expandedId === m.id}
                onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                vote={votes[m.id] ?? null}
                onVote={c => castVote(m, c)}
                submitting={submitting === m.id}
                canVote={user.canPredict} />
            ))
          )}
        </div>
      )}

      {/* ── Intel Signals tab ── */}
      {activeTab === "signals" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
            {signals.map(s => (
              <div key={s.id} style={{ background: "var(--bg-card)", borderRadius: "var(--radius, 8px)", padding: "14px 16px", border: "0.5px solid var(--border-mid)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{s.entityName}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{s.metric} · {s.signalType}</div>
                  </div>
                  <ConfBadge conf={s.confidence} />
                </div>
                <div style={{ fontSize: "26px", fontWeight: 700, color: s.value > 1.5 ? "#10b981" : s.value < -1.5 ? "#ef4444" : "var(--text)" }}>
                  {s.value >= 0 ? "+" : ""}{s.value.toFixed(3)}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>{timeAgo(s.t)} ago · z-score</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Domain Rules tab ── */}
      {activeTab === "rules" && (
        <div>
          {rules.length === 0 ? <div style={{ color: "var(--text-dim)", padding: "40px", textAlign: "center" }}>No domain rules loaded.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {rules.map(r => (
                <div key={r.id} style={{ background: "var(--bg-card)", borderRadius: "var(--radius, 8px)", padding: "14px 16px", border: "0.5px solid var(--border-mid)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-dim)" }}>{r.domain}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>clarity {Math.round(r.clarity * 100)}% · weight {Math.round(r.weight * 100)}%</span>
                  </div>
                  <div style={{ fontSize: "13px", marginBottom: "4px" }}>{r.premise}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>{r.summary}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {activeTab === "history" && (
        <div>
          {user.predictions.length === 0 ? <div style={{ color: "var(--text-dim)", padding: "40px", textAlign: "center" }}>No predictions yet. Cast your first vote in the Markets tab.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {user.predictions.map(p => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 70px 80px 60px", gap: "12px", alignItems: "center", padding: "10px 14px", background: "var(--bg-card)", borderRadius: "6px", border: "0.5px solid var(--border-mid)", fontSize: "12px" }}>
                  <span style={{ fontWeight: 600, color: p.prediction === "UP" ? "#10b981" : p.prediction === "DOWN" ? "#ef4444" : "var(--text-dim)" }}>{p.prediction}</span>
                  <span style={{ color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.polymarket_question ?? p.polymarket_market_id?.slice(0, 30) ?? "—"}</span>
                  <span style={{ color: "var(--text-dim)" }}>{timeAgo(p.created_at)}</span>
                  <span style={{ textAlign: "center" }}>
                    {!p.resolved ? <span style={{ color: "var(--text-dim)" }}>pending</span> : p.resolved_correct ? <span style={{ color: "#10b981" }}>✓ correct</span> : <span style={{ color: "#ef4444" }}>✗ wrong</span>}
                  </span>
                  <span style={{ textAlign: "right", fontWeight: 600, color: (p.score_delta ?? 0) > 0 ? "#10b981" : (p.score_delta ?? 0) < 0 ? "#ef4444" : "var(--text-dim)" }}>
                    {!p.resolved ? <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· pending</span> : <>{(p.score_delta ?? 0) > 0 ? "+" : ""}{p.score_delta ?? 0} pts</>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Upgrade tab ── */}
      {activeTab === "upgrade" && (
        <div style={{ maxWidth: "800px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 500, marginBottom: "6px" }}>Choose your plan</h2>
          <p style={{ fontSize: "13px", color: "var(--text-dim)", marginBottom: "24px" }}>Current plan: <strong style={{ textTransform: "capitalize" }}>{user.tier}</strong></p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
            {[
              { id: "free", name: "Free", price: "$0", sub: "always free", featured: false, features: ["5 predictions/day", "Basic divergence score", "CPTX reputation score", "Polymarket + Kalshi browser", "Intel signal match"], cta: null },
              { id: "pro", name: "Pro", price: "$29", sub: "/mo · billed in USDC", featured: true, features: ["Unlimited predictions", "Full signal history (30 days)", "Divergence alerts", "5 Vanguard briefs/day", "Kalshi candlestick charts", "Price history overlays"], cta: "Upgrade to Pro" },
              { id: "api", name: "API", price: "$199", sub: "/mo · + $0.01/call above 1k/day", featured: false, features: ["Everything in Pro", "1,000 API calls/day", "/divergence/top endpoint", "/signal/{marketId}", "/history/{entityId}", "10 Vanguard briefs/day"], cta: "Get API Access" },
            ].map(plan => (
              <div key={plan.id} style={{ border: user.tier === plan.id ? "1px solid var(--accent)" : plan.featured ? "1.5px solid var(--border-info, #3b82f6)" : "0.5px solid var(--border-mid)", borderRadius: "var(--radius, 8px)", padding: "20px", background: "var(--bg-card)" }}>
                {plan.featured && <div style={{ fontSize: "11px", padding: "2px 8px", display: "inline-block", background: "#dbeafe", color: "#1e40af", borderRadius: "20px", marginBottom: "8px" }}>Most popular</div>}
                <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>{plan.name}</div>
                <div style={{ fontSize: "24px", fontWeight: 700, marginBottom: "2px" }}>{plan.price}<span style={{ fontSize: "14px", fontWeight: 400 }}>{plan.sub}</span></div>
                <div style={{ margin: "14px 0" }}>
                  {plan.features.map(f => <div key={f} style={{ fontSize: "12px", color: "var(--text-dim)", padding: "4px 0", display: "flex", gap: "8px" }}><span style={{ color: "#10b981" }}>✓</span><span>{f}</span></div>)}
                </div>
                {user.tier === plan.id ? (
                  <div style={{ fontSize: "12px", color: "var(--accent)" }}>Current plan</div>
                ) : plan.cta && (
                  <button onClick={() => alert(`Contact: intel@exergynet.org for ${plan.name} access`)}
                    style={{ width: "100%", padding: "8px", background: plan.featured ? "var(--accent)" : "transparent", color: plan.featured ? "#fff" : "var(--text)", border: `0.5px solid ${plan.featured ? "var(--accent)" : "var(--border-mid)"}`, borderRadius: "6px", fontSize: "13px", cursor: "pointer", fontWeight: 500 }}>
                    {plan.cta}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: "16px 20px", border: "0.5px solid var(--border-mid)", borderRadius: "var(--radius, 8px)", background: "var(--bg-card)" }}>
            <div style={{ fontSize: "13px", fontWeight: 500, marginBottom: "6px" }}>📊 Weekly Divergence Index</div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: 1.6 }}>Every week PolSignal publishes the top 10 markets where crowd probability and Intel Console signal diverge most. Free to read. Full dataset (top 50 + signal detail) is available via API tier.</div>
            <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--accent)" }}>Subscribe to the weekly report → intel@exergynet.org</div>
          </div>
        </div>
      )}

      {/* ── Guide tab ── */}
      {activeTab === "guide" && <GuideTab />}
    </div>
  );
}
