// Drives the REAL static deposit UI (deposit.html + deposit.js) through its states in jsdom,
// with a mock wallet + mock fetch. No real USDC, no keys. Backend is authoritative (mocked here).
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const ROOT = 'C:/Users/ezumb/Downloads/exergynet';
const HTML = readFileSync(`${ROOT}/deposit.html`, 'utf8');
const DEP_JS = readFileSync(`${ROOT}/deposit.js`, 'utf8');
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const WALLET = '0x2222222222222222222222222222222222222222';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); c ? pass++ : fail++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fire = (el, type) => el.dispatchEvent(new el.ownerDocument.defaultView.Event(type));

function makeDom(cfg, wallet, fetchImpl) {
  const dom = new JSDOM(HTML, { runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window;
  win.EXG_DAY1 = cfg;
  win.ethereum = wallet;
  win.fetch = fetchImpl;
  win.matchMedia = () => ({ matches: false });
  // run deposit.js in the window context
  win.eval(DEP_JS);
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  return { dom, win, $: (id) => win.document.getElementById(id) };
}
const baseCfg = () => ({
  CHAIN_ID: 8453, CHAIN_ID_HEX: '0x2105', CHAIN_NAME: 'Base', RPC_URL: 'https://mainnet.base.org',
  USDC_ADDRESS: USDC, USDC_DECIMALS: 6, DEPOSIT_RECEIVING_WALLET: WALLET,
  DEPOSIT_API_BASE: 'https://portal.exergynet.org', DEPOSIT_CLAIM_PATH: '/api/deposit/claim',
  BASESCAN: 'https://basescan.org', RETIRED_DENYLIST: ['0xbd1e790f6040fa62797671b84a50025a0133109c'],
  ZERO_ADDR: '0x0000000000000000000000000000000000000000'
});
// Mock wallet: scriptable chain + balance + capture of sendTransaction
function mockWallet({ chain = '0x2105', balance = 5000000n } = {}) {
  const w = {
    _chain: chain, _sent: null, _handlers: {},
    on(ev, cb) { this._handlers[ev] = cb; },
    async request({ method, params }) {
      if (method === 'eth_requestAccounts') return ['0x1111111111111111111111111111111111111111'];
      if (method === 'eth_chainId') return this._chain;
      if (method === 'eth_call') return '0x' + balance.toString(16).padStart(64, '0');
      if (method === 'wallet_switchEthereumChain') { this._chain = params[0].chainId; return null; }
      if (method === 'wallet_addEthereumChain') { this._chain = '0x2105'; return null; }
      if (method === 'eth_sendTransaction') { this._sent = params[0]; return '0xdeadbeefcafefeed0000000000000000000000000000000000000000000000ff'; }
      return null;
    }
  };
  return w;
}

async function main() {
  // 1. receiver unset -> unavailable
  {
    const c = baseCfg(); c.DEPOSIT_RECEIVING_WALLET = '';
    const { $ } = makeDom(c, mockWallet(), async () => ({}));
    ok('receiver_unset_unavailable', !$('dep-unavailable').hidden && $('dep-form').hidden);
  }
  // 2. receiver zero -> unavailable
  {
    const c = baseCfg(); c.DEPOSIT_RECEIVING_WALLET = c.ZERO_ADDR;
    const { $ } = makeDom(c, mockWallet(), async () => ({}));
    ok('receiver_zero_unavailable', !$('dep-unavailable').hidden);
  }
  // 3. retired receiver -> unavailable
  {
    const c = baseCfg(); c.DEPOSIT_RECEIVING_WALLET = '0xbd1e790f6040FA62797671B84a50025a0133109C';
    const { $ } = makeDom(c, mockWallet(), async () => ({}));
    ok('receiver_retired_unavailable', !$('dep-unavailable').hidden);
  }
  // 4. valid receiver -> form shown, USDC + receiver rendered
  {
    const { $ } = makeDom(baseCfg(), mockWallet(), async () => ({}));
    ok('valid_receiver_form_shown', !$('dep-form').hidden && $('dep-unavailable').hidden
      && $('dep-receiver').textContent === WALLET && $('dep-usdc').textContent === USDC);
  }
  // 5. wrong network -> switch offered; then switch -> ok
  {
    const w = mockWallet({ chain: '0x14a34' }); // 84532
    const { $, win } = makeDom(baseCfg(), w, async () => ({}));
    $('dep-connect').click(); await sleep(30);
    const wrongOffered = !$('dep-switch').hidden && /wrong network/.test($('dep-network').textContent);
    $('dep-switch').click(); await sleep(30);
    ok('wrong_network_switch_then_ok', wrongOffered && $('dep-switch').hidden && /8453/.test($('dep-network').textContent));
  }
  // 6. connect on Base -> balance shown, send disabled until amount+key
  {
    const w = mockWallet({ chain: '0x2105', balance: 12000000n });
    const { $ } = makeDom(baseCfg(), w, async () => ({}));
    $('dep-connect').click(); await sleep(30);
    const balOk = /12 USDC/.test($('dep-balance').textContent);
    const disabledInitially = $('dep-send').disabled === true;
    $('dep-apikey').value = 'sk-exergy-testkey'; fire($('dep-apikey'), 'input');
    $('dep-amount').value = '5'; fire($('dep-amount'), 'input');
    const enabledNow = $('dep-send').disabled === false;
    ok('balance_and_enable_gating', balOk && disabledInitially && enabledNow);
  }
  // 7. full deposit -> submitted -> credited; correct transfer encoding + BaseScan link
  {
    const w = mockWallet({ chain: '0x2105', balance: 12000000n });
    let claimCalls = 0;
    const fetchImpl = async (url, opts) => {
      claimCalls++;
      return { status: 200, json: async () => ({ ok: true, credited_micro: '5000000', credited_usd: '5.000000' }) };
    };
    const { $ } = makeDom(baseCfg(), w, fetchImpl);
    $('dep-connect').click(); await sleep(30);
    $('dep-apikey').value = 'sk-exergy-testkey'; $('dep-amount').value = '5';
    fire($('dep-amount'), 'input');
    $('dep-send').click(); await sleep(60);
    const sent = w._sent;
    const encOk = sent && sent.to.toLowerCase() === USDC.toLowerCase()
      && sent.data.startsWith('0xa9059cbb')
      && sent.data.toLowerCase().includes(WALLET.slice(2).toLowerCase())
      && sent.data.endsWith((5000000).toString(16).padStart(64, '0'));
    const credited = /Credited/.test($('dep-status').textContent) && $('dep-status').className.includes('dep-ok');
    const linkOk = /basescan\.org\/tx\//.test($('dep-txlink').innerHTML);
    ok('deposit_submit_credit_flow', encOk && credited && linkOk && claimCalls === 1, `claims=${claimCalls}`);
  }
  // 8. backend rejection -> error state, no credited implication
  {
    const w = mockWallet({ chain: '0x2105' });
    const { $ } = makeDom(baseCfg(), w, async () => ({ status: 400, json: async () => ({ error: 'wrong_recipient' }) }));
    $('dep-connect').click(); await sleep(30);
    $('dep-apikey').value = 'sk-exergy-x'; $('dep-amount').value = '5';
    fire($('dep-amount'), 'input');
    $('dep-send').click(); await sleep(60);
    ok('backend_rejection_error_state', /not credited/.test($('dep-status').textContent) && $('dep-status').className.includes('dep-err'));
  }
  // 9. duplicate claim (409/already_credited) -> UI does not imply a second credit
  {
    const w = mockWallet({ chain: '0x2105' });
    const { $ } = makeDom(baseCfg(), w, async () => ({ status: 409, json: async () => ({ error: 'already_credited' }) }));
    $('dep-connect').click(); await sleep(30);
    $('dep-apikey').value = 'sk-exergy-x'; $('dep-amount').value = '5';
    fire($('dep-amount'), 'input');
    $('dep-send').click(); await sleep(60);
    ok('duplicate_no_second_credit', /already credited/i.test($('dep-status').textContent) && /No second credit/i.test($('dep-status').textContent));
  }
  // 10. pending (202) -> confirming state
  {
    const w = mockWallet({ chain: '0x2105' });
    const { $ } = makeDom(baseCfg(), w, async () => ({ status: 202, json: async () => ({ ok: false, status: 'pending', confirmations: 2, required: 12 }) }));
    $('dep-connect').click(); await sleep(30);
    $('dep-apikey').value = 'sk-exergy-x'; $('dep-amount').value = '5';
    fire($('dep-amount'), 'input');
    $('dep-send').click(); await sleep(60);
    ok('pending_confirming_state', /[Cc]onfirming/.test($('dep-status').textContent) && $('dep-status').className.includes('dep-pending'));
  }

  console.log(`\nFRONTEND_TESTS: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('FE_HARNESS_ERROR', e.stack || e.message); process.exit(3); });
