"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ── App catalog ───────────────────────────────────────────────────────────────
type Price = "free" | "subscription" | "metered";
type App = {
  key: string; name: string; icon: string; href: string;
  cat: string; price: Price; tagline: string; chips: string[];
  color: string; statKey?: "origin" | "signals" | "entities" | "clcs"; statLabel?: string; pro?: boolean; subKey?: string; external?: boolean; iconUrl?: string;
};

const APPS: App[] = [
  { key: "origin", name: "Origin Index", icon: "◎", href: "/origin", cat: "Oracle", price: "free",
    tagline: "Planetary entropy oracle — a live composite of market, signal, event and verification stress.",
    chips: ["M2M API", "Real-time", "Public"], color: "#7C6FE4", statKey: "origin", statLabel: "index", pro: true },
  { key: "entities", name: "Entities", icon: "◉", href: "/entities", cat: "Analytics", price: "free",
    tagline: "Track the watchlist — equities, crypto, macro and event entities, all in one console.",
    chips: ["Watchlist", "Multi-asset"], color: "#3B82F6", statKey: "entities", statLabel: "tracked" },
  { key: "briefs", name: "Intel Briefs", icon: "≡", href: "/briefs", cat: "AI", price: "subscription",
    tagline: "Vanguard-synthesized daily intelligence, distilled from HIGH-confidence anomalies.",
    chips: ["Vanguard Pro", "Daily"], color: "#00E5B0", subKey: "intel_briefs" },
  { key: "signals", name: "Signal Feed", icon: "◈", href: "/signals", cat: "Analytics", price: "free",
    tagline: "Live anomaly stream — z-score and pct-change signals across every tracked entity.",
    chips: ["15-min refresh", "Live"], color: "#38BDF8", statKey: "signals", statLabel: "active" },
  { key: "polsignal", name: "PolSignal", icon: "⬠", href: "/polsignal", cat: "Markets", price: "subscription",
    tagline: "Prediction-market divergence — crowd probability versus the SEI system prediction.",
    chips: ["Polymarket", "Kalshi", "Tiered"], color: "#F59E0B", subKey: "polsignal" },
  { key: "isf", name: "I Saw It First", icon: "🎯", href: "/proofs", cat: "Proofs", price: "subscription",
    tagline: "Timestamped early-detection proofs — claim the signal before the crowd, anchored on Base L2.",
    chips: ["ISF", "ZK-anchored"], color: "#EF4444", subKey: "isf" },
  { key: "ghost", name: "Ghost-Witness", icon: "👁", href: "/ghost-witness", cat: "Verification", price: "metered",
    tagline: "Certificate of Logical Consistency for any AI-agent conversation, sealed on-chain.",
    chips: ["LNES-05", "$0.005 / audit"], color: "#A78BFA", statKey: "clcs", statLabel: "issued 24h" },
  { key: "aeris", name: "AERIS", icon: "🌦", href: "/aeris", cat: "Markets", price: "free",
    tagline: "Pari-mutuel weather prediction markets — stake USDC on meteorological outcomes, settled via ZK proof on Base L2.",
    chips: ["Weather", "ZK-proof", "Base L2"], color: "#0D9488" },
  { key: "origin_pro", name: "Origin Index Pro", icon: "◎", href: "/origin-pro", cat: "Oracle", price: "subscription",
    tagline: "Full-resolution entropy oracle with M2M API access, real-time feeds, and public data layer.",
    chips: ["M2M API", "Real-time"], color: "#7C6FE4", pro: true, subKey: "origin_pro" },
  { key: "chaindorse", name: "ChainDorse", icon: "✍", href: "/chaindorse", cat: "Proofs", price: "metered",
    tagline: "E-signature with an on-chain ExergyNet L0 hash anchor + a public verifiable certificate.",
    chips: ["eSign", "On-chain"], color: "#F59E0B", subKey: "chaindorse" },
  { key: "dealroomfree", name: "DealRoom (Free)", icon: "◈", href: "/dealroom", cat: "Documents", price: "free",
    tagline: "Secure deal rooms — 1 room, 30 days. Document workflow, audit trail, 1 eSign/week.",
    chips: ["1 Room", "30 days"], color: "#3B82F6" },
  { key: "dealroombusiness", name: "DealRoom Business", icon: "◈", href: "/dealroom", cat: "Documents", price: "subscription",
    tagline: "Unlimited business document rooms — diligence, contracts, term tracking, on-chain audit.",
    chips: ["Unlimited", "On-chain audit"], color: "#3B82F6", subKey: "dealroombusiness" },
  { key: "dealroomfda", name: "DealRoom FDA Regulatory", icon: "⚕", href: "/dealroom-fda", cat: "Documents", price: "subscription",
    tagline: "IND/eCTD-style dossier workflow — structured document gates, PDF upload checks, e-signatures, and a tamper-evident hash-chained audit trail.",
    chips: ["IND/eCTD", "Audit trail"], color: "#00E5B0", subKey: "dealroomfda" },
  { key: "huddle", name: "Huddle", icon: "👥", href: "/huddle", cat: "Collaboration", price: "free",
    tagline: "A shared calendar for any team — sports clubs or businesses. Admins schedule events, members RSVP.",
    chips: ["Calendar", "KV-backed"], color: "#38BDF8" },
];

const PRICE_META: Record<Price, { label: string; cls: string }> = {
  free:         { label: "Free",        cls: "as-badge as-badge-free" },
  subscription: { label: "Subscription", cls: "as-badge as-badge-sub" },
  metered:      { label: "Pay-per-use", cls: "as-badge as-badge-meter" },
};

const FILTERS = ["All", "Free", "Subscription", "Pay-per-use"] as const;

export default function AppStore() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [stats, setStats] = useState<Record<string, string | number>>({});
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [catApps, setCatApps] = useState<App[]>([]);
  const [busyKey, setBusyKey] = useState<string>("");
  const [subToast, setSubToast] = useState<string>("");

  const token = () => { try { return localStorage.getItem("en_token") || ""; } catch { return ""; } };

  const loadSubs = useCallback(async () => {
    const t = token(); if (!t) return;
    try {
      const r = await fetch("/api/apps", { headers: { Authorization: "Bearer " + t } });
      if (!r.ok) return;
      const d = await r.json();
      const set = new Set<string>();
      const builtin = new Set(["origin","origin_pro","entities","signals","intel_briefs","polsignal","isf","ghost_witness"]);
      const cat: App[] = [];
      for (const a of d.apps || []) {
        if (a.subscribed) set.add(a.app_key);
        if (builtin.has(a.app_key) || !a.app_url) continue;
        const price: Price = a.tier === "subscription" ? "subscription" : a.tier === "metered" ? "metered" : "free";
        cat.push({
          key: a.app_key, name: a.name, icon: a.icon || "\u25A6", iconUrl: a.icon_url || undefined, href: "/app/" + a.app_key + "?embed=1",
          cat: a.category || "Published", price, tagline: a.description || "",
          chips: (Array.isArray(a.tags) && a.tags.length) ? a.tags.slice(0, 4) : ["In ExergyNet", price === "subscription" ? `$${a.price_usd}/mo` : price === "metered" ? "Pay-per-use" : "Free"],
          color: "#0D9488", subKey: price === "subscription" ? a.app_key : undefined, external: false,
        });
      }
      setSubscribed(set);
      setCatApps(cat);
    } catch {}
  }, []);
  useEffect(() => { loadSubs(); }, [loadSubs]);

  const subscribe = useCallback(async (subKey: string, name: string) => {
    const t = token();
    if (!t) { setSubToast("Sign in to the portal to subscribe."); setTimeout(() => setSubToast(""), 4000); return; }
    setBusyKey(subKey); setSubToast("");
    try {
      const r = await fetch("/api/apps/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
        body: JSON.stringify({ app_key: subKey }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && (d.status === "subscribed" || d.status === "already_subscribed")) {
        setSubscribed(prev => new Set(prev).add(subKey));
        setSubToast(`${name} activated${d.new_balance_usd ? ` · balance $${d.new_balance_usd}` : ""}`);
      } else if (r.status === 402) {
        setSubToast("Not enough USDC — add funds in the Billing tab.");
      } else {
        setSubToast(d.message || d.error || "Subscription failed.");
      }
    } catch { setSubToast("Network error."); }
    finally { setBusyKey(""); setTimeout(() => setSubToast(""), 5000); }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [s, o] = await Promise.allSettled([
        fetch("/intel/api/signals/stats").then(r => r.json()),
        fetch("/intel/api/origin").then(r => r.json()),
      ]);
      const next: Record<string, string | number> = {};
      if (s.status === "fulfilled") {
        next.signals = s.value.high ?? 0;
        next.entities = s.value.entities ?? 0;
      }
      if (o.status === "fulfilled") {
        next.origin = Math.round(o.value.origin_index ?? 0);
        next.clcs = o.value.network?.clcs_24h ?? 0;
      }
      setStats(next);
    } catch { /* cards still render without stats */ }
  }, []);

  useEffect(() => { loadStats(); const id = setInterval(loadStats, 60_000); return () => clearInterval(id); }, [loadStats]);

  const allApps = [...APPS, ...catApps];
  const visible = allApps.filter(a =>
    filter === "All" ? true :
    filter === "Free" ? a.price === "free" :
    filter === "Subscription" ? a.price === "subscription" :
    a.price === "metered"
  );

  const freeCount = allApps.filter(a => a.price === "free").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {/* Hero */}
      <div>
        <div className="en-label" style={{ marginBottom: 8 }}>
          <span style={{ color: "var(--accent)" }}>▦</span>&nbsp; Agent Store
        </div>
        <h1 className="en-page-title" style={{ fontSize: 30, letterSpacing: "-0.02em" }}>
          Intelligence apps, on tap
        </h1>
        <p className="en-page-subtitle" style={{ maxWidth: 560 }}>
          Every Intel module is an app. Launch the free ones instantly, subscribe to the premium feeds,
          or pay only for what you verify. All powered by the SEI Vanguard engine.
        </p>
        <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
          <span className="as-stat"><b>{allApps.length}</b> apps</span>
          <span className="as-stat"><b style={{ color: "var(--green)" }}>{freeCount}</b> free</span>
          <span className="as-stat"><b style={{ color: "var(--accent)" }}>{allApps.length - freeCount}</b> premium</span>
          <span className="as-stat"><span className="en-pulse-dot" style={{ marginRight: 6 }} />live</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={filter === f ? "en-btn en-btn-primary" : "en-btn en-btn-ghost"}
            style={{ fontSize: 12, padding: "5px 14px" }}>
            {f}
          </button>
        ))}
      </div>

      {/* App grid */}
      <div className="as-grid">
        {visible.map(app => {
          const pm = PRICE_META[app.price];
          const stat = app.statKey ? stats[app.statKey] : undefined;
          return (
            <Link key={app.key} href={app.href} target={app.external ? "_blank" : undefined} rel={app.external ? "noopener noreferrer" : undefined} className="as-card" style={{ ["--app-color" as any]: app.color }}>
              <div className="as-card-top">
                <div className="as-icon" style={{ background: `${app.color}1A`, color: app.color, borderColor: `${app.color}40`, overflow: "hidden" }}>
                  {app.iconUrl ? <img src={app.iconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : app.icon}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                  <span className={pm.cls}>{pm.label}</span>
                  {app.pro && (
                    <span className="as-pro">✦ PRO</span>
                  )}
                </div>
              </div>
              <div className="as-card-name">{app.name}</div>
              <div className="as-card-cat">{app.cat}</div>
              <p className="as-card-tagline">{app.tagline}</p>
              <div className="as-chips">
                {app.chips.map(ch => <span key={ch} className="as-chip">{ch}</span>)}
              </div>
              <div className="as-card-foot" onClick={app.subKey ? (e) => { e.preventDefault(); } : undefined}>
                {app.subKey ? (
                  subscribed.has(app.subKey) ? (
                    <span className="as-launch" style={{ color: "#00E5B0" }}>✓ Active · Open <span className="as-arrow">→</span></span>
                  ) : (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); subscribe(app.subKey!, app.name); }}
                      disabled={busyKey === app.subKey}
                      style={{ fontSize: 12, fontWeight: 700, color: "#05060A", background: app.color, border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>
                      {busyKey === app.subKey ? "…" : `Subscribe`}
                    </button>
                  )
                ) : (
                  <span className="as-launch">{app.pro ? "Open · upgrade inside" : "Launch"} <span className="as-arrow">→</span></span>
                )}
                {stat !== undefined && (
                  <span className="as-livestat">
                    <b style={{ color: app.color }}>{stat}</b> {app.statLabel}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Build with us CTA */}
      <Link href="https://portal.exergynet.org/dashboard/playground" target="_parent" className="as-build">
        <div className="as-build-glow" />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="en-label" style={{ marginBottom: 8 }}>
            <span style={{ color: "var(--accent)" }}>⬡</span>&nbsp; For developers
          </div>
          <div className="as-build-title">Build apps with us</div>
          <p className="as-build-sub">
            Ship your own intelligence app on the ExergyNet substrate. Tap the Vanguard inference API,
            the M2M Origin oracle, LNES settlement and Ghost-Witness verification — all from one SDK.
          </p>
        </div>
        <div className="as-build-cta" style={{ position: "relative", zIndex: 1 }}>
          Start building <span className="as-arrow">→</span>
        </div>
      </Link>

      {subToast && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 2000,
          background: "var(--bg-card, #0F1320)", border: "1px solid var(--border-mid, #252840)", color: "var(--text, #E8EAF0)",
          fontSize: 12, padding: "10px 18px", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
          {subToast}
        </div>
      )}

      {/* Styles */}
      <style>{`
        .as-stat { font-size: 12px; color: var(--text-faint); display: inline-flex; align-items: center; }
        .as-stat b { color: var(--text); font-weight: 700; margin-right: 4px; }

        .as-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .as-card {
          position: relative; display: flex; flex-direction: column;
          background: var(--bg-card, #0F1320); border: 1px solid var(--border-dim, #1E2030);
          border-radius: 14px; padding: 18px; text-decoration: none;
          transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
          overflow: hidden;
        }
        .as-card::before {
          content: ""; position: absolute; inset: 0 0 auto 0; height: 2px;
          background: var(--app-color); opacity: 0; transition: opacity 0.18s ease;
        }
        .as-card:hover {
          transform: translateY(-3px);
          border-color: color-mix(in srgb, var(--app-color) 50%, transparent);
          box-shadow: 0 10px 30px -12px color-mix(in srgb, var(--app-color) 45%, transparent);
        }
        .as-card:hover::before { opacity: 1; }
        .as-card:hover .as-arrow { transform: translateX(3px); }

        .as-card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
        .as-icon {
          width: 46px; height: 46px; border-radius: 12px; border: 1px solid;
          display: flex; align-items: center; justify-content: center; font-size: 22px;
        }
        .as-card-name { font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
        .as-card-cat { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); margin-top: 2px; }
        .as-card-tagline { font-size: 12.5px; line-height: 1.6; color: var(--text-soft); margin: 10px 0 14px; flex: 1; }

        .as-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 16px; }
        .as-chip {
          font-size: 10px; font-family: var(--font-mono, monospace); color: var(--text-faint);
          background: var(--bg, #0A0C14); border: 1px solid var(--border-dim, #1E2030);
          border-radius: 5px; padding: 2px 7px;
        }
        .as-card-foot { display: flex; align-items: center; justify-content: space-between; }
        .as-launch { font-size: 12.5px; font-weight: 600; color: var(--app-color); display: inline-flex; align-items: center; gap: 5px; }
        .as-arrow { display: inline-block; transition: transform 0.18s ease; }
        .as-livestat { font-size: 11px; color: var(--text-faint); }
        .as-livestat b { font-weight: 700; }

        .as-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; padding: 3px 9px; border-radius: 20px; text-transform: uppercase; }
        .as-badge-free  { color: var(--green, #00E5B0); background: rgba(0,229,176,0.10); border: 1px solid rgba(0,229,176,0.28); }
        .as-badge-sub   { color: var(--accent, #7C6FE4); background: rgba(124,111,228,0.12); border: 1px solid rgba(124,111,228,0.30); }
        .as-badge-meter { color: var(--amber, #F59E0B); background: rgba(245,158,11,0.10); border: 1px solid rgba(245,158,11,0.28); }
        .as-pro { font-size: 9px; font-weight: 800; letter-spacing: 0.06em; color: #F59E0B; background: rgba(245,158,11,0.10); border: 1px solid rgba(245,158,11,0.32); border-radius: 5px; padding: 2px 7px; }

        .as-build {
          position: relative; display: flex; align-items: center; justify-content: space-between;
          gap: 24px; flex-wrap: wrap; overflow: hidden; text-decoration: none;
          border-radius: 16px; padding: 26px 28px;
          border: 1px solid rgba(124,111,228,0.30);
          background: linear-gradient(120deg, rgba(124,111,228,0.06), rgba(0,229,176,0.04));
        }
        .as-build-glow {
          position: absolute; width: 300px; height: 300px; right: -60px; top: -120px;
          background: radial-gradient(circle, rgba(124,111,228,0.20), transparent 70%);
          pointer-events: none;
        }
        .as-build-title { font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
        .as-build-sub { font-size: 13px; line-height: 1.6; color: var(--text-soft); margin-top: 6px; max-width: 560px; }
        .as-build-cta {
          flex-shrink: 0; font-size: 14px; font-weight: 700; color: #fff;
          background: var(--accent, #7C6FE4); border-radius: 10px; padding: 12px 22px;
          display: inline-flex; align-items: center; gap: 8px;
          box-shadow: 0 8px 24px -8px rgba(124,111,228,0.6);
          transition: transform 0.18s ease;
        }
        .as-build:hover .as-build-cta { transform: translateY(-2px); }
        .as-build:hover .as-arrow { transform: translateX(3px); }
      `}</style>
    </div>
  );
}
