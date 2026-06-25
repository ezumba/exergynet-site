"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// ── Nav structure ─────────────────────────────────────────────────────────────
const NAV = [
  {
    section: "Analytics",
    items: [
      { href: "/",             label: "App Store",     icon: "▦" },
      { href: "/origin",        label: "Origin Index",  icon: "◎" },
      { href: "/entities",      label: "Entities",      icon: "◉" },
      { href: "/briefs",        label: "Intel Briefs",  icon: "≡" },
      { href: "/signals",       label: "Signal Feed",   icon: "◈" },
      { href: "/polsignal",     label: "PolSignal",     icon: "⬠" },
      { href: "/proofs",        label: "I Saw It First", icon: "🎯" },
      { href: "/ghost-witness", label: "Ghost-Witness",  icon: "👁" },
    ],
  },
];

// ── Theme helpers ─────────────────────────────────────────────────────────────
function applyTheme(theme: string) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try { localStorage.setItem("intel_theme", theme); } catch {}
}

function getTheme(): string {
  if (typeof window === "undefined") return "dark";
  try { return localStorage.getItem("intel_theme") || "dark"; } catch { return "dark"; }
}

function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try { return new URLSearchParams(window.location.search).get("embed") === "1"; } catch { return false; }
}

function getSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;
  if (isEmbedded()) return false;
  try { return localStorage.getItem("intel_nav_open") !== "false"; } catch { return true; }
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ usage, theme, onThemeToggle }: {
  usage: any;
  theme: string;
  onThemeToggle: () => void;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(true);

  const [embedded, setEmbedded] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const embed = isEmbedded();
    setEmbedded(embed);
    setOpen(embed ? false : getSidebarOpen());
  }, []);

  // Keep --sidebar-w in sync with the real sidebar width so .intel-main
  // margin-left tracks collapse (220 open / 48 collapsed / 0 embed) and the
  // app canvas fills the void when the nav collapses.
  useEffect(() => {
    try {
      document.documentElement.style.setProperty(
        "--sidebar-w", embedded ? "0px" : (open ? "220px" : "48px")
      );
    } catch {}
  }, [open, embedded]);

  // When embedded, return null to hide the entire sidebar
  if (embedded) return null;

  const toggle = () => {
    setOpen(prev => {
      try { localStorage.setItem("intel_nav_open", String(!prev)); } catch {}
      return !prev;
    });
  };

  return (
    <aside
      className="intel-sidebar"
      style={{
        width: open ? 220 : 48,
        transition: "width 0.2s ease",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Logo + hamburger collapse toggle (top, discoverable) */}
      <div className="sidebar-logo" style={{ display: "flex", alignItems: "center", justifyContent: open ? "space-between" : "center", padding: open ? undefined : "16px 0" }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: open ? undefined : "pointer" }}
          onClick={open ? undefined : toggle}
          title={open ? undefined : "Expand nav"}
        >
          <div className="sidebar-logo-mark">EX</div>
          {open && (
            <div>
              <div className="sidebar-logo-text">
                EXERGY<span style={{ color: "var(--accent)" }}>NET</span>
              </div>
              <div className="sidebar-logo-sub">Intel Console</div>
            </div>
          )}
        </div>
        {open && (
          <button
            onClick={toggle}
            title="Collapse nav"
            aria-label="Collapse nav"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 17, lineHeight: 1, padding: 4, flexShrink: 0 }}
          >
            ☰
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {NAV.map(group => (
          <div key={group.section}>
            {open && <div className="sidebar-section-label">{group.section}</div>}
            {group.items.map(item => {
              const active = item.href === "/"
                ? path === "/"
                : path.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-nav-link${active ? " active" : ""}`}
                  title={!open ? item.label : undefined}
                  style={{ justifyContent: open ? undefined : "center", gap: open ? undefined : 0 }}
                >
                  <span style={{ fontSize: 13, lineHeight: 1, minWidth: 14, textAlign: "center", flexShrink: 0 }}>
                    {item.icon}
                  </span>
                  {open && item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div style={{ padding: "8px", borderTop: "1px solid var(--border-dim)" }}>
        <button
          onClick={toggle}
          style={{
            width: "100%", background: "none", border: "none", cursor: "pointer",
            color: "var(--text-faint)", fontSize: 16, padding: "4px 0",
            display: "flex", alignItems: "center", justifyContent: open ? "flex-end" : "center",
          }}
          title={open ? "Collapse nav" : "Expand nav"}
        >
          {open ? "‹" : "›"}
        </button>
      </div>

      {/* Footer: usage + theme toggle — only when open */}
      {open && (
        <div className="sidebar-footer">
          {usage && (
            <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>MTD cost</span>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                  ${usage.costUsdc?.toFixed(4)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Operations</span>
                <span style={{ color: "var(--text-soft)" }}>{usage.operations}</span>
              </div>
            </div>
          )}

          {/* Theme toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
              {theme === "light" ? "Light" : "Dark"} mode
            </span>
            <button
              onClick={onThemeToggle}
              className="theme-toggle"
              title="Toggle theme"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <div
                style={{
                  width: 32, height: 18, borderRadius: 99, position: "relative",
                  background: theme === "light" ? "var(--accent)" : "var(--border-mid)",
                  border: "1px solid var(--border-mid)",
                  display: "flex", alignItems: "center", padding: "2px",
                  transition: "background 0.2s ease",
                }}
              >
                <div style={{
                  width: 12, height: 12, borderRadius: "50%", background: "#fff",
                  transform: theme === "light" ? "translateX(14px)" : "none",
                  transition: "transform 0.2s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }} />
              </div>
            </button>
          </div>

          <div style={{ marginTop: 10, color: "var(--text-faint)", fontSize: 9 }}>
            v2.0 · SEI Vanguard
          </div>
        </div>
      )}
    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ theme, onThemeToggle }: { theme: string; onThemeToggle: () => void }) {
  const path = usePathname();
  const label = (() => {
    if (path === "/")                return "App Store";
    if (path.startsWith("/signals")) return "Signals";
    if (path.startsWith("/entities"))return "Entities";
    if (path.startsWith("/briefs"))  return "Intel Briefs";
    if (path.startsWith("/polsignal")) return "PolSignal";
    if (path.startsWith("/origin"))       return "Origin Index";
    if (path.startsWith("/ghost-witness")) return "Ghost-Witness";
    return "Intel Console";
  })();

  return (
    <div className="intel-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="en-pulse-dot" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", letterSpacing: "0.02em" }}>
          {label}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <a
          href="https://portal.exergynet.org/dashboard"
          target="_parent"
          className="en-btn en-btn-ghost"
          style={{ fontSize: 11, padding: "4px 10px" }}
        >
          ← Portal
        </a>
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
export default function IntelShell({ children }: { children: React.ReactNode }) {
  const [usage, setUsage] = useState<any>(null);
  const [theme, setTheme] = useState<string>("dark");
  const [isEmbed, setIsEmbed] = useState(false);

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const urlTheme = params.get("theme");
    const initial  = urlTheme || getTheme();
    setTheme(initial);
    applyTheme(initial);
    setIsEmbed(params.get("embed") === "1");

    const handler = (e: MessageEvent) => {
      if (e.data?.type === "en_theme" && e.data.theme) {
        setTheme(e.data.theme);
        applyTheme(e.data.theme);
      }
    };
    window.addEventListener("message", handler);
    window.parent?.postMessage({ type: "en_theme_request" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    fetch("/intel/api/usage/current")
      .then(r => r.json())
      .then(setUsage)
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    window.parent?.postMessage({ type: "en_theme", theme: next }, "*");
  };

  return (
    <div className={`intel-shell${isEmbed ? " intel-embed" : ""}`}>
      <Sidebar usage={usage} theme={theme} onThemeToggle={toggleTheme} />
      <div className="intel-main">
        <Topbar theme={theme} onThemeToggle={toggleTheme} />
        <div className="intel-content">
          {children}
        </div>
      </div>
    </div>
  );
}
