'use client';

// Embedded app launcher — runs a published app INSIDE ExergyNet.
// ExergyNet owns identity, entitlement and payments; the app talks to the
// parent over postMessage (the exergynet-app SDK). External/own-domain hosting
// is a premium option — by default apps render here, in our OS.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

export default function AppLauncher() {
  const params = useParams();
  const appKey = String((params as any)?.appKey || '');
  const [app, setApp] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [entitled, setEntitled] = useState<boolean>(false);
  const [status, setStatus] = useState<'loading' | 'signin' | 'notfound' | 'subscribe' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [msg, setMsg] = useState('');
  // agent-bridge A1 (HMAC-JWT relay): short-lived signed identity token for
  // embedded apps that verify it themselves (e.g. MetalDrug's dealroom.html).
  // Optional by design — apps that don't read mdc_token are unaffected, and
  // a fetch failure here must never block the app from launching.
  const [mdcToken, setMdcToken] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const token = () => { try { return localStorage.getItem('en_token') || ''; } catch { return ''; } };

  const init = useCallback(async () => {
    const t = token();
    if (!t) { setStatus('signin'); return; }
    try {
      const [appsR, meR, entR] = await Promise.all([
        fetch('/api/apps', { headers: { Authorization: 'Bearer ' + t } }),
        fetch('/developer/me', { headers: { Authorization: 'Bearer ' + t } }),
        fetch('/api/apps/entitlement?app_key=' + encodeURIComponent(appKey), { headers: { Authorization: 'Bearer ' + t } }),
      ]);
      const apps = (await appsR.json()).apps || [];
      const a = apps.find((x: any) => x.app_key === appKey);
      if (!a) { setStatus('notfound'); return; }
      setApp(a);
      try { setMe(await meR.json()); } catch { /* */ }
      const ent = await entR.json().catch(() => ({ entitled: false }));
      setEntitled(!!ent.entitled);
      if (a.tier === 'subscription' && !ent.entitled) setStatus('subscribe');
      else setStatus('ready');
      fetch('/api/apps/mdc-token?app_key=' + encodeURIComponent(appKey), { headers: { Authorization: 'Bearer ' + t } })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.mdc_token) setMdcToken(d.mdc_token); })
        .catch(() => { /* embed falls back to body-trust */ });
    } catch { setStatus('error'); }
  }, [appKey]);
  useEffect(() => { init(); }, [init]);

  // ── SDK broker: app (iframe) RPCs -> authed ExergyNet calls ──
  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d: any = e.data || {};
      if (d.type !== 'exergynet_rpc') return;
      const reply = (result: any, error?: string) =>
        iframeRef.current?.contentWindow?.postMessage({ type: 'exergynet_rpc_result', id: d.id, result, error }, '*');
      const t = token();
      try {
        if (d.method === 'me') {
          reply({ id: me?.id, email: me?.email });
        } else if (d.method === 'entitlement') {
          const r = await fetch('/api/apps/entitlement?app_key=' + encodeURIComponent(appKey), { headers: { Authorization: 'Bearer ' + t } });
          reply(await r.json());
        } else if (d.method === 'charge') {
          const r = await fetch('/api/apps/usage', {
            method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + t },
            body: JSON.stringify({ app_key: appKey, units: d.args?.units || 1, idempotency_key: d.args?.idempotency_key || ('u' + Date.now() + Math.random().toString(36).slice(2)), meta: d.args?.meta }),
          });
          reply(await r.json());
        } else if (d.method === 'subscribe') {
          const r = await fetch('/api/apps/subscribe', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ app_key: appKey }) });
          const j = await r.json(); if (r.ok) setEntitled(true); reply(j);
        } else if (d.method === 'email') {
          const r = await fetch('/api/apps/email', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ app_key: appKey, ...(d.args || {}) }) });
          reply(await r.json());
        } else reply(null, 'unknown method: ' + d.method);
      } catch (err: any) { reply(null, err?.message || 'rpc failed'); }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [me, appKey]);

  const onIframeLoad = () => {
    const theme = (typeof document !== 'undefined' ? document.documentElement.dataset.theme : '') || 'dark';
    iframeRef.current?.contentWindow?.postMessage({ type: 'exergynet_init', app_key: appKey, user: { id: me?.id, email: me?.email }, entitled, theme }, '*');
  };

  // Forward ExergyNet theme changes (light/dark toggle) into the embedded app
  useEffect(() => {
    const fwd = () => {
      const theme = (typeof document !== 'undefined' ? document.documentElement.dataset.theme : '') || 'dark';
      iframeRef.current?.contentWindow?.postMessage({ type: 'exergynet_theme', theme }, '*');
    };
    const obs = new MutationObserver(fwd);
    if (typeof document !== 'undefined') obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, [status]);

  const subscribe = async () => {
    setBusy(true); setMsg('');
    try {
      const t = token();
      const r = await fetch('/api/apps/subscribe', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ app_key: appKey }) });
      const d = await r.json();
      if (r.ok) { setEntitled(true); setStatus('ready'); }
      else setMsg(d.message || d.error || 'Subscribe failed — fund your balance in Billing.');
    } catch { setMsg('Network error'); }
    setBusy(false);
  };

  const Center = (c: React.ReactNode) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #05060A)', color: 'var(--text, #E8EAF0)', fontFamily: 'system-ui,sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>{c}</div>
    </div>
  );

  if (status === 'loading') return Center(<div style={{ color: 'var(--text-faint,#6B7094)' }}>Opening app…</div>);
  if (status === 'signin') return Center(<div><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Sign in required</div><div style={{ color: 'var(--text-faint,#6B7094)', fontSize: 13 }}>Open this app from the ExergyNet portal while signed in.</div></div>);
  if (status === 'notfound') return Center(<div><div style={{ fontSize: 16, fontWeight: 700 }}>App not available</div><div style={{ color: 'var(--text-faint,#6B7094)', fontSize: 13, marginTop: 6 }}>“{appKey}” is not live in the store yet.</div></div>);
  if (status === 'error') return Center(<div><div style={{ fontSize: 16, fontWeight: 700 }}>Could not load</div><button onClick={init} style={btn}>Retry</button></div>);
  if (status === 'subscribe') return Center(
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{app?.name}</div>
      <div style={{ color: 'var(--text-faint,#6B7094)', fontSize: 13, marginBottom: 18 }}>{app?.description || 'Subscribe to access this app.'}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent,#00E5B0)' }}>${app?.price_usd}<span style={{ fontSize: 13, color: 'var(--text-faint,#6B7094)' }}>/mo</span></div>
      <button onClick={subscribe} disabled={busy} style={{ ...btn, background: 'var(--accent,#00E5B0)', color: '#04140f', marginTop: 16, padding: '11px 22px', fontWeight: 700 }}>
        {busy ? 'Subscribing…' : 'Subscribe & open'}
      </button>
      <div style={{ fontSize: 11, color: 'var(--text-faint,#6B7094)', marginTop: 10 }}>Billed from your ExergyNet balance · 80% to the publisher</div>
      {msg && <div style={{ color: '#ff6b8a', fontSize: 12, marginTop: 10 }}>{msg}</div>}
    </div>
  );

  // ready — show the app's OWN detail page; launch into the iframe on click
  const theme = (typeof document !== 'undefined' ? document.documentElement.dataset.theme : '') || 'dark';
  const url = app.app_url + (app.app_url.includes('?') ? '&' : '?') + 'exergynet=1&app_key=' + encodeURIComponent(appKey) + '&theme=' + theme +
    (mdcToken ? '&mdc_token=' + encodeURIComponent(mdcToken) : '');
  const tierLabel = app.tier === 'subscription' ? ('$' + app.price_usd + '/mo') : app.tier === 'metered' ? 'Pay-per-use' : 'Free';
  const docsBase = String(app.app_url || '').split('?')[0].replace(/\/$/, '');

  if (!launched) {
    return (
      <div style={{ minHeight: '100vh', overflowY: 'auto', background: 'var(--bg,#05060A)', color: 'var(--text,#E8EAF0)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 22 }}>
            {app.icon_url
              ? <img src={app.icon_url} alt='' width={64} height={64} style={{ borderRadius: 14, flexShrink: 0 }} />
              : <div style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--accent,#00E5B0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#04140f', fontWeight: 800, fontSize: 24 }}>{String(app.name || '?').charAt(0)}</div>}
            <div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{app.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-faint,#6B7094)', marginTop: 4 }}>{(app.category || 'App') + ' · ' + tierLabel + (entitled ? ' · subscribed' : '')}</div>
            </div>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 18 }}>{app.description || ''}</p>
          {Array.isArray(app.tags) && app.tags.length > 0 &&
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
              {app.tags.map((t: string) => <span key={t} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border-mid,#23304a)', color: 'var(--text-faint,#6B7094)' }}>{t}</span>)}
            </div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setLaunched(true)} style={{ cursor: 'pointer', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, padding: '12px 26px', background: 'var(--accent,#00E5B0)', color: '#04140f' }}>Launch app &rarr;</button>
            {appKey === 'aeris' && <a href={docsBase + '/how-it-works.html'} target='_blank' rel='noopener noreferrer' style={{ ...btn, textDecoration: 'none', padding: '12px 18px' }}>How it works</a>}
            {appKey === 'aeris' && <a href={docsBase + '/how-it-works-technical.html'} target='_blank' rel='noopener noreferrer' style={{ ...btn, textDecoration: 'none', padding: '12px 18px' }}>Technical docs</a>}
          </div>
          {appKey === 'aeris' &&
            <div style={{ marginTop: 22, padding: '14px 16px', border: '1px solid #b8860b', background: 'rgba(255,214,0,0.06)', borderRadius: 10, fontSize: 13, color: '#ffd600', lineHeight: 1.6 }}>
              <strong>Testnet &mdash; play money.</strong> Runs on Base Sepolia with test USDC. Settlement is operator-trusted while the zkTLS oracle (N1) is still in development &mdash; do not rely on it for value.
            </div>}
        </div>
      </div>
    );
  }

  // launched — render the embedded app
  return (
    <iframe ref={iframeRef} src={url} onLoad={onIframeLoad} title={app.name}
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      style={{ width: '100%', height: '100vh', border: 'none', display: 'block', background: 'var(--bg,#05060A)' }} />
  );
}

const btn: any = { cursor: 'pointer', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '8px 16px', background: 'var(--bg-surface,#12131C)', color: 'var(--text,#E8EAF0)' };
