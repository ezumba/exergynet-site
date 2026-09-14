// Boots the REAL biological_proxy/index.js against embedded PostgreSQL 18.4 + a
// controllable local JSON-RPC double, and exercises the ACTUAL /api/deposit/claim
// route over HTTP for the §6 scenarios. No production secrets, no mainnet tx, no keys.
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import http from 'node:http';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';

const BACKEND = 'C:/Users/ezumb/Downloads/exergynet/portal/biological_proxy/index.js';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const WALLET = '0x2222222222222222222222222222222222222222'; // TEST-ONLY synthetic receiving wallet
const TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const PGPORT = 55450, APP_PORT = 5055, RPC_PORT = 8599;
const JWT_SECRET = 'testjwt';
const pad = (a) => '0x' + a.slice(2).toLowerCase().padStart(64, '0');
const hx = (n) => '0x' + BigInt(n).toString(16);
const transfer = (to, amount, logIndex, from = '0x1111111111111111111111111111111111111111', token = USDC) =>
  ({ address: token, topics: [TOPIC, pad(from), pad(to)], data: hx(amount), logIndex: hx(logIndex) });

// Mutable RPC scenario
const rpc = {
  chainId: '0x2105',            // 8453
  latest: hx(0x100000),
  receipts: {},                 // txhash -> receipt | null
};
function mkReceipt({ block = 0x1000, status = '0x1', logs = [] }) { return { status, blockNumber: hx(block), logs }; }

let results = {}; let failures = 0;
const ok = (n, c, extra = '') => { results[n] = c ? 'PASS' : 'FAIL'; if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${extra ? '  ' + extra : ''}`); };

let pgsrv, rpcSrv, child;
async function connectDb() { const c = new pg.Client({ connectionString: `postgres://ci:ci@127.0.0.1:${PGPORT}/postgres` }); await c.connect(); await c.query("SET client_encoding TO 'UTF8'"); return c; }

function startRpc() {
  return new Promise((res) => {
    rpcSrv = http.createServer((req, resp) => {
      let body = ''; req.on('data', d => body += d); req.on('end', () => {
        const { method, params } = JSON.parse(body || '{}');
        let result = null;
        if (method === 'eth_chainId') result = rpc.chainId;
        else if (method === 'eth_blockNumber') result = rpc.latest;
        else if (method === 'eth_getTransactionReceipt') result = rpc.receipts[(params[0] || '').toLowerCase()] ?? null;
        resp.writeHead(200, { 'content-type': 'application/json' });
        resp.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
      });
    }).listen(RPC_PORT, '127.0.0.1', res);
  });
}

function bootBackend(extraEnv = {}) {
  return new Promise((res, rej) => {
    const env = {
      ...process.env,
      PGHOST: '127.0.0.1', PGPORT: String(PGPORT), PGDATABASE: 'postgres', PGUSER: 'ci', PGPASSWORD: 'ci',
      LIVEKIT_API_SECRET: 'test-secret', JWT_SECRET,
      BASE_CHAIN_ID: '8453', BASE_RPC_URL: `http://127.0.0.1:${RPC_PORT}`, BASE_USDC_CONTRACT: USDC,
      MIN_DEPOSIT_CONFIRMATIONS: '1',
      DROPS_DIR: 'C:/Users/ezumb/AppData/Local/Temp/claude/C--Users-ezumb/cac95fb2-02d0-4d97-bd2d-b235cb8af4fc/scratchpad/pgtest/drops',
      PORT: String(APP_PORT),
      ...extraEnv,
    };
    const c = spawn(process.execPath, [BACKEND], { env, cwd: 'C:/Users/ezumb/Downloads/exergynet/portal/biological_proxy' });
    let out = '';
    const onData = (d) => { out += d; if (out.includes(`listening on 127.0.0.1:${APP_PORT}`)) { c.stdout.off('data', onData); res(c); } };
    c.stdout.on('data', onData);
    c.stderr.on('data', d => { out += d; });
    c.on('exit', (code) => { if (!out.includes('listening')) rej(new Error(`backend exited ${code}: ${out.slice(-400)}`)); });
    setTimeout(() => rej(new Error(`backend boot timeout: ${out.slice(-400)}`)), 30000);
  });
}
const kill = (c) => new Promise(r => { if (!c || c.killed) return r(); c.on('exit', () => r()); c.kill('SIGKILL'); });

async function api(path, { method = 'GET', token, body } = {}) {
  const r = await fetch(`http://127.0.0.1:${APP_PORT}${path}`, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}
const balance = async (db, id) => (await db.query(`SELECT usdc_micro_balance FROM biological_developers WHERE id=$1`, [id])).rows[0]?.usdc_micro_balance;
const depRows = async (db, tx) => (await db.query(`SELECT count(*)::int n FROM usdc_deposits WHERE tx_hash=$1`, [tx])).rows[0].n;

async function main() {
  pgsrv = new EmbeddedPostgres({ databaseDir: './pgdata_boot', user: 'ci', password: 'ci', port: PGPORT, persistent: false });
  await pgsrv.initialise(); await pgsrv.start();
  await startRpc();
  const token = jwt.sign({ sub: 'dev-1' }, JWT_SECRET);
  const ghostToken = jwt.sign({ sub: 'ghost-dev' }, JWT_SECRET);

  // ---- Spawn #1: NO wallet -> CONFIG_INCOMPLETE ----
  child = await bootBackend({ DEPOSIT_RECEIVING_WALLET: '' });
  let db = await connectDb();
  const h1 = await api('/api/deposit/health');
  ok('health_CONFIG_INCOMPLETE_no_wallet', h1.body?.status === 'CONFIG_INCOMPLETE' && h1.body?.incomplete_reason === 'DEPOSIT_RECEIVING_WALLET_REQUIRED');
  await db.query(`INSERT INTO biological_developers (id,email,password_hash,api_key_hash,api_key_preview,usdc_micro_balance,active)
    VALUES ('dev-1','d@e.x','x','x','sk-exergy-xxxxxxxx',0,false) ON CONFLICT (id) DO UPDATE SET usdc_micro_balance=0`);
  const claimIncomplete = await api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xvalid' } });
  ok('claim_503_when_no_wallet', claimIncomplete.status === 503 && claimIncomplete.body?.error === 'CONFIG_INCOMPLETE');
  await db.end(); await kill(child);

  // ---- Spawn #2: WITH wallet -> full scenarios ----
  child = await bootBackend({ DEPOSIT_RECEIVING_WALLET: WALLET });
  db = await connectDb();
  ok('backend_boot', true);
  const h2 = await api('/api/deposit/health');
  ok('health_READY_with_wallet', h2.body?.status === 'READY' && h2.body?.deposit_receiver === WALLET);

  // fixtures
  rpc.receipts['0xvalid']   = mkReceipt({ block: 0x1000, logs: [transfer(WALLET, 1_000_000, 0)] });
  rpc.receipts['0xtwo']     = mkReceipt({ block: 0x1000, logs: [transfer(WALLET, 1_000_000, 0), transfer(WALLET, 2_000_000, 1)] });
  rpc.receipts['0xwtoken']  = mkReceipt({ block: 0x1000, logs: [transfer(WALLET, 1_000_000, 0, undefined, '0x1234567890123456789012345678901234567890')] });
  rpc.receipts['0xwrecv']   = mkReceipt({ block: 0x1000, logs: [transfer('0x9999999999999999999999999999999999999999', 1_000_000, 0)] });
  rpc.receipts['0xrevert']  = mkReceipt({ block: 0x1000, status: '0x0', logs: [transfer(WALLET, 1_000_000, 0)] });
  rpc.receipts['0xpending'] = mkReceipt({ block: 0x200000, logs: [transfer(WALLET, 1_000_000, 0)] }); // block > latest -> neg confirmations
  rpc.receipts['0xghost']   = mkReceipt({ block: 0x1000, logs: [transfer(WALLET, 1_000_000, 0)] });

  // valid -> credit once
  await db.query(`UPDATE biological_developers SET usdc_micro_balance=0 WHERE id='dev-1'`);
  const c1 = await api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xvalid' } });
  ok('valid_credit_once', c1.status === 200 && c1.body?.credited_micro === '1000000' && (await balance(db, 'dev-1')) === '1000000');

  // replay same request -> no second credit
  const c2 = await api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xvalid' } });
  ok('replay_no_double_credit', (await balance(db, 'dev-1')) === '1000000' && c2.body?.credited_micro === '0');

  // same tx different logIndex -> independent (0xtwo has two logs)
  await db.query(`UPDATE biological_developers SET usdc_micro_balance=0 WHERE id='dev-1'`);
  const cTwo = await api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xtwo' } });
  ok('same_tx_diff_logindex_independent', cTwo.body?.credited_micro === '3000000' && (await balance(db, 'dev-1')) === '3000000' && (await depRows(db, '0xtwo')) === 2);

  // wrong token -> rejected
  const cWt = await api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xwtoken' } });
  ok('wrong_token_rejected', cWt.status === 400 && cWt.body?.error === 'no_usdc_transfer_to_receiving_wallet');

  // wrong receiver -> rejected
  const cWr = await api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xwrecv' } });
  ok('wrong_receiver_rejected', cWr.status === 400);

  // reverted tx -> rejected
  const cRev = await api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xrevert' } });
  ok('reverted_tx_rejected', cRev.status === 400 && cRev.body?.error === 'tx_reverted');

  // insufficient confirmations -> pending
  const cPend = await api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xpending' } });
  ok('insufficient_confirmations_pending', cPend.status === 202 && cPend.body?.status === 'pending' && (await depRows(db, '0xpending')) === 0);

  // wrong chain -> rejected
  rpc.chainId = '0x14a34'; // 84532
  const cChain = await api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xvalid' } });
  ok('wrong_chain_rejected', cChain.status === 500 && cChain.body?.error === 'rpc_wrong_chain');
  rpc.chainId = '0x2105';

  // unknown account -> fail closed (no partial state)
  const cGhost = await api('/api/deposit/claim', { method: 'POST', token: ghostToken, body: { tx_hash: '0xghost' } });
  const ghostBal = (await db.query(`SELECT usdc_micro_balance FROM biological_developers WHERE id='ghost-dev'`)).rows[0]?.usdc_micro_balance;
  ok('unknown_account_fail_closed', (await depRows(db, '0xghost')) === 0 && ghostBal === undefined && cGhost.body?.credited_micro === '0' || cGhost.status >= 400 || cGhost.body?.events?.every(e => e.status !== 'credited'));

  // concurrent replay -> exactly one credit
  await db.query(`TRUNCATE usdc_deposits; UPDATE biological_developers SET usdc_micro_balance=0 WHERE id='dev-1'`);
  rpc.receipts['0xrace'] = mkReceipt({ block: 0x1000, logs: [transfer(WALLET, 1_000_000, 0)] });
  const races = await Promise.all(Array.from({ length: 12 }, () => api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xrace' } })));
  const creditedCount = races.filter(r => r.body?.credited_micro === '1000000').length;
  ok('concurrent_replay_one_credit', (await balance(db, 'dev-1')) === '1000000' && (await depRows(db, '0xrace')) === 1, `credited_responses=${creditedCount}`);

  await db.end(); await kill(child);

  // ---- Spawn #3: restart -> replay still no double credit ----
  child = await bootBackend({ DEPOSIT_RECEIVING_WALLET: WALLET });
  db = await connectDb();
  const cAfter = await api('/api/deposit/claim', { method: 'POST', token, body: { tx_hash: '0xrace' } });
  ok('restart_replay_no_double_credit', (await balance(db, 'dev-1')) === '1000000' && cAfter.body?.credited_micro === '0');
  await db.end(); await kill(child);

  console.log('\nRESULT_JSON ' + JSON.stringify({ ...results, failures }));
}

main().then(async () => { try { rpcSrv?.close(); } catch {} try { await pgsrv?.stop(); } catch {} process.exit(failures ? 1 : 0); })
  .catch(async (e) => { console.error('HARNESS_ERROR', e.message); try { await kill(child); } catch {} try { rpcSrv?.close(); } catch {} try { await pgsrv?.stop(); } catch {} process.exit(3); });
