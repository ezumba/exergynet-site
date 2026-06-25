import type { Metadata } from "next";
import "./globals.css";
import IntelShell from "./IntelShell";

export const metadata: Metadata = { title: "ExergyNet Intel" };

// Runs synchronously before first paint.
// Priority: 1) URL param (set by portal), 2) saved localStorage, 3) default dark
const themeScript = `(function(){
  try {
    var p = new URLSearchParams(window.location.search);
    var urlTheme = p.get('theme');
    var saved = localStorage.getItem('intel_theme');
    var theme = urlTheme || saved || 'dark';
    if (urlTheme) localStorage.setItem('intel_theme', urlTheme);
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  } catch(e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
        <IntelShell>{children}</IntelShell>
      </body>
    </html>
  );
}
