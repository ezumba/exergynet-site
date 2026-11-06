'use strict';

/* ─── Search index ──────────────────────────────────────────────────────────── */
const SEARCH_INDEX = [
  {
    title: 'Platform overview',
    description: 'Persistent state, bounded context, independent authority — ExergyNet platform.',
    url: 'index.html#platform',
    keywords: 'platform overview architecture persistent state bounded context',
  },
  {
    title: 'How ExergyNet works',
    description: 'Four-layer architecture: persistent state → context delivery → model reasoning → authority gate.',
    url: 'index.html#workflow',
    keywords: 'architecture workflow layers N K ratio persistent state context delivery authority gate',
  },
  {
    title: 'Vanguard Memory Node',
    description: 'Local, open-source persistent memory node for MCP agents.',
    url: 'index.html#capabilities',
    keywords: 'VMN vanguard memory node local open source MCP capabilities',
  },
  {
    title: 'V5 research paper',
    description: 'Memory Grows. Context Does Not Have To. — ExergyNet at the 100M-token development operating point.',
    url: 'whitepaper.html',
    keywords: 'white paper research V5 101M 220.5x retrieval speedup authority',
  },
  {
    title: 'Local memory quickstart',
    description: 'Install Vanguard Memory Node and connect to Claude Desktop or any MCP client.',
    url: 'docs.html',
    keywords: 'quickstart install docs documentation local memory MCP Claude Desktop',
  },
  {
    title: 'Install the memory node',
    description: 'npm install -g vanguard-memory-node — get running in one command.',
    url: 'docs.html#install',
    keywords: 'install npm vanguard memory node setup',
  },
  {
    title: 'Connect to your MCP client',
    description: 'Configure the memory node for Claude Desktop on macOS, Windows, or Windows+WSL2.',
    url: 'docs.html#connect',
    keywords: 'connect MCP client config Claude Desktop macOS Windows WSL2 JSON',
  },
  {
    title: 'Tools reference',
    description: 'vmn_ingest, vmn_search, vmn_recall, vmn_inspect, vmn_list, vmn_stats.',
    url: 'docs.html#tools-reference',
    keywords: 'vmn tools reference ingest search recall inspect list stats delete',
  },
  {
    title: 'V5 key results',
    description: '101M state tokens, 800 median K, 220.5× speedup, 11.3× H200 throughput.',
    url: 'whitepaper.html#results',
    keywords: 'V5 results 101M 800 220.5 11.3 H200 retrieval speedup accuracy',
  },
  {
    title: 'Authority layer — live result',
    description: 'Model accepted adversarial instruction; authority gate rejected the action.',
    url: 'whitepaper.html#authority',
    keywords: 'authority gate adversarial live result independent control proposal execution',
  },
  {
    title: 'Citation and verification',
    description: 'BibTeX citation, PDF SHA-256 checksum, and download links.',
    url: 'whitepaper.html#citation',
    keywords: 'citation bibtex SHA256 checksum download verify PDF',
  },
];

/* ─── Search ──────────────────────────────────────────────────────────────── */
function score(item, query) {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const haystack = (item.title + ' ' + item.description + ' ' + item.keywords).toLowerCase();
  const words = q.split(/\s+/);
  let s = 0;
  for (const w of words) {
    if (item.title.toLowerCase().includes(w)) s += 3;
    else if (item.description.toLowerCase().includes(w)) s += 2;
    else if (haystack.includes(w)) s += 1;
  }
  return s;
}

function renderResults(query) {
  const results = SEARCH_INDEX
    .map(item => ({ item, s: score(item, query) }))
    .filter(r => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 7)
    .map(r => r.item);

  const box = document.querySelector('.search-results');
  if (!box) return;

  if (!results.length) {
    box.innerHTML = '<div class="search-empty">No results for <strong>' + esc(query) + '</strong></div>';
    return;
  }

  box.innerHTML = results.map((item, i) =>
    '<a class="search-result" role="option" href="' + item.url + '" tabindex="0"' +
    (i === 0 ? ' aria-selected="true"' : '') + '>' +
    '<strong>' + esc(item.title) + '</strong>' +
    '<span>' + esc(item.description) + '</span>' +
    '</a>'
  ).join('');
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Search dialog ──────────────────────────────────────────────────────── */
function initSearch() {
  const dialog = document.getElementById('search-dialog');
  const btn = document.getElementById('search-btn');
  const input = document.getElementById('site-search');
  const escBtn = dialog ? dialog.querySelector('.search-esc') : null;

  if (!dialog || !btn || !input) return;

  function open() {
    dialog.showModal();
    input.value = '';
    document.querySelector('.search-results').innerHTML = '';
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    dialog.close();
  }

  btn.addEventListener('click', open);

  if (escBtn) escBtn.addEventListener('click', close);

  dialog.addEventListener('click', e => {
    if (e.target === dialog) close();
  });

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length > 1) renderResults(q);
    else document.querySelector('.search-results').innerHTML = '';
  });

  /* keyboard nav */
  dialog.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...dialog.querySelectorAll('.search-result')];
      if (!items.length) return;
      const current = items.findIndex(el => el.getAttribute('aria-selected') === 'true');
      items.forEach(el => el.removeAttribute('aria-selected'));
      const next = e.key === 'ArrowDown'
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
      items[next].setAttribute('aria-selected', 'true');
      items[next].focus();
      e.preventDefault();
    }
  });

  /* ⌘K / Ctrl+K */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (dialog.open) close(); else open();
    }
  });
}

/* ─── OS tab switching ──────────────────────────────────────────────────── */
function initOsTabs() {
  document.querySelectorAll('.os-tabs').forEach(group => {
    const tabs = group.querySelectorAll('.os-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const os = tab.dataset.os;
        tabs.forEach(t => {
          t.classList.toggle('active', t.dataset.os === os);
          t.setAttribute('aria-selected', t.dataset.os === os ? 'true' : 'false');
        });
        const container = group.closest('.doc-section') || document;
        container.querySelectorAll('.tab-pane').forEach(pane => {
          pane.hidden = pane.id !== ('tab-' + os);
        });
      });
    });
  });
}

/* ─── Copy buttons ──────────────────────────────────────────────────────── */
function initCopy() {
  document.querySelectorAll('.copy-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy
        || btn.closest('.code-panel')?.querySelector('code')?.textContent
        || '';
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        const prev = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = prev; }, 1500);
        showToast('Copied to clipboard');
      }).catch(() => {
        showToast('Copy failed — select and copy manually');
      });
    });
  });
}

/* ─── Toast ─────────────────────────────────────────────────────────────── */
function showToast(msg) {
  const el = document.querySelector('.toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.classList.remove('visible');
    el.hidden = true;
  }, 2200);
}

/* ─── ToC active observer ───────────────────────────────────────────────── */
function initTocObserver() {
  const toc = document.querySelector('.on-this-page');
  if (!toc) return;
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  if (!links.length) return;

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === '#' + id);
        });
        break;
      }
    }
  }, { rootMargin: '-10% 0px -80% 0px', threshold: 0 });

  links.forEach(a => {
    const id = a.getAttribute('href').replace('#', '');
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

/* ─── Mobile nav toggle ─────────────────────────────────────────────────── */
function initMobileNav() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('main-nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  });
}

/* ─── Docs sidebar mobile toggle ────────────────────────────────────────── */
function initDocsMobile() {
  const btn = document.querySelector('.docs-mobile-btn');
  const sidebar = document.getElementById('docs-sidebar');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    sidebar.classList.toggle('open', !open);
  });
}

/* ─── Smooth active sidebar link ────────────────────────────────────────── */
function initSidebarObserver() {
  const nav = document.querySelector('.doc-subnav');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  if (!links.length) return;

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === '#' + id);
        });
        break;
      }
    }
  }, { rootMargin: '-10% 0px -80% 0px', threshold: 0 });

  links.forEach(a => {
    const id = a.getAttribute('href').replace('#', '');
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

/* ─── Init ──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSearch();
  initOsTabs();
  initCopy();
  initTocObserver();
  initMobileNav();
  initDocsMobile();
  initSidebarObserver();
});
