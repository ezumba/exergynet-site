// Static portal smoke + config/fallback scan for the Day-1 deposit UI. No build system.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const ROOT = 'C:/Users/ezumb/Downloads/exergynet';
const FILES = ['deposit.html', 'deposit.js', 'deposit.config.js'];
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); c ? pass++ : fail++; };

// 1. HTML parses + referenced local assets exist
const html = readFileSync(`${ROOT}/deposit.html`, 'utf8');
let dom;
try { dom = new JSDOM(html); ok('html_parses', true); } catch (e) { ok('html_parses', false, e.message); }
const refs = [];
if (dom) {
  dom.window.document.querySelectorAll('link[href],script[src]').forEach(el => {
    const u = el.getAttribute('href') || el.getAttribute('src');
    if (u && !/^https?:|^\/\//.test(u)) refs.push(u.replace(/^\.\//, ''));
  });
  // favicons referenced too
  dom.window.document.querySelectorAll('link[rel*="icon"]').forEach(el => { const u = el.getAttribute('href'); if (u && !/^https?:/.test(u)) refs.push(u); });
}
const missing = [...new Set(refs)].filter(r => !existsSync(`${ROOT}/${r}`));
ok('referenced_assets_exist', missing.length === 0, missing.length ? 'MISSING: ' + missing.join(',') : `checked ${new Set(refs).size}`);

// 2. JS parses (node --check equivalent: construct Function)
for (const f of ['deposit.js', 'deposit.config.js']) {
  try { new Function(readFileSync(`${ROOT}/${f}`, 'utf8')); ok('js_syntax_' + f, true); }
  catch (e) { ok('js_syntax_' + f, false, e.message); }
}

// 3. forbidden-token scan over the 3 deposit files (config/mainnet scan)
const FORBIDDEN = [
  { re: /84532/, name: 'chain_84532' },
  { re: /sepolia/i, name: 'sepolia' },
  { re: /0x036cbd/i, name: 'test_usdc' },
  { re: /localhost|127\.0\.0\.1/i, name: 'localhost_url' },
  { re: /\b(AERIS|MemoryMarketSettlement|\bMMS\b|LNES13|x402)\b/, name: 'nonprod_surface' },
  // secret VALUE assignment only (not prose/comments reassuring the user we don't handle keys)
  { re: /(private[_-]?key|mnemonic|seed[_-]?phrase|secret)\s*[:=]\s*['"][^'"]/i, name: 'secret_material' },
  { re: /0x[a-fA-F0-9]{64}/, name: 'raw_32byte_hex_secret' },
];
let vio = [];
for (const f of FILES) {
  const txt = readFileSync(`${ROOT}/${f}`, 'utf8');
  txt.split(/\r?\n/).forEach((line, i) => {
    for (const r of FORBIDDEN) {
      if (r.re.test(line)) {
        // allow the retired wallet ONLY inside RETIRED_DENYLIST context
        vio.push({ f, line: i + 1, rule: r.name, text: line.trim().slice(0, 90) });
      }
    }
  });
}
// retired wallet as a VALUE (not denylist) check
for (const f of FILES) {
  const txt = readFileSync(`${ROOT}/${f}`, 'utf8');
  txt.split(/\r?\n/).forEach((line, i) => {
    if (/0xbd1e790f6040fa62797671b84a50025a0133109c/i.test(line) && !/DENYLIST|denylist|retired/i.test(line))
      vio.push({ f, line: i + 1, rule: 'retired_wallet_as_value', text: line.trim().slice(0, 90) });
  });
}
ok('forbidden_token_scan_clean', vio.length === 0, vio.length ? JSON.stringify(vio) : 'no 84532/sepolia/testUSDC/localhost/nonprod/secret');

// 4. receiver blank in shipped config (operator input required, no fallback)
const cfgTxt = readFileSync(`${ROOT}/deposit.config.js`, 'utf8');
ok('config_receiver_blank', /DEPOSIT_RECEIVING_WALLET:\s*''/.test(cfgTxt));
ok('config_canonical_usdc', /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/.test(cfgTxt));
ok('config_chainid_8453', /CHAIN_ID:\s*8453/.test(cfgTxt) && /0x2105/.test(cfgTxt));

// 5. real local static HTTP server -> GET the files -> 200
const CT = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = ROOT + decodeURIComponent(req.url.split('?')[0]);
  if (existsSync(p) && statSync(p).isFile()) {
    const ext = p.slice(p.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': CT[ext] || 'application/octet-stream' });
    res.end(readFileSync(p));
  } else { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(8711, '127.0.0.1', r));
let all200 = true, detail = [];
for (const u of ['/deposit.html', '/deposit.js', '/deposit.config.js', '/main.js', '/style.css']) {
  const r = await fetch('http://127.0.0.1:8711' + u);
  const okr = r.status === 200 && (await r.text()).length > 0;
  if (!okr) { all200 = false; detail.push(u + '=' + r.status); }
}
server.close();
ok('static_http_serve_200', all200, detail.join(','));

console.log(`\nSTATIC_SMOKE: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
