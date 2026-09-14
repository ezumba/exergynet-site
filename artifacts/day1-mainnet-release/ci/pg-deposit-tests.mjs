// Real-Postgres integration tests for the Day-1 Base Mainnet deposit ledger.
// Runs the ACTUAL repo migration SQL (up/down/reapply), then exercises the
// documented atomic-credit pattern and concurrent-replay guard against a live DB.
//
// Requires: env DATABASE_URL pointing at a real Postgres.
// Zero secrets, zero mainnet, zero funds. Pure DB semantics.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const REPO = process.env.CANDIDATE_ROOT || process.cwd(); // CI: repo checkout root
// Sanitize to ASCII: cluster encoding may be non-UTF8 (Windows WIN1252); non-ASCII lives only in comments.
const ascii = (s) => s.replace(/[^\x00-\x7F]/g, '-');
const UP_SQL   = ascii(readFileSync(`${REPO}/db/migrations/20260913_day1_deposit_idempotency.sql`, 'utf8'));
const DOWN_SQL = ascii(readFileSync(`${REPO}/db/migrations/20260913_day1_deposit_idempotency.rollback.sql`, 'utf8'));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('FATAL: DATABASE_URL not set'); process.exit(2); }

const results = { migration_up: null, schema_assertions: null, migration_down: null,
  migration_reapply: null, atomicity: null, concurrency: null, concurrency_after_restart: null,
  partial_credit_states: null, concurrent_replay_credits: null };
let failures = 0;
const ok = (name, cond) => { results[name] = cond ? 'PASS' : 'FAIL'; if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// Minimal TEST-ONLY balances fixture (production balance table is biological_developers).
const FIXTURE = `CREATE TABLE IF NOT EXISTS biological_developers (
  id TEXT PRIMARY KEY, usdc_micro_balance NUMERIC(78,0) NOT NULL DEFAULT 0);`;

// The documented atomic credit pattern, in ONE transaction (both-or-neither).
// injectFailAfterInsert=true forces an error after the deposit insert to prove rollback.
async function connect(url) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query("SET client_encoding TO 'UTF8'"); // Windows default is WIN1252; migration has non-ASCII comments
  return c;
}

async function creditAtomic(client, ev, devId, { injectFailAfterInsert = false } = {}) {
  await client.query('BEGIN');
  try {
    const ins = await client.query(
      `INSERT INTO usdc_deposits
         (chain_id, tx_hash, log_index, block_number, token_address, from_address,
          to_address, amount_base_units, confirmation_count, status, developer_id, credited_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'credited',$10, now())
       ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING
       RETURNING id`,
      [ev.chain_id, ev.tx_hash, ev.log_index, ev.block_number, ev.token, ev.from,
       ev.to, ev.amount, ev.confirmations, devId]);
    if (ins.rowCount === 0) { await client.query('COMMIT'); return { credited: false, reason: 'already_credited' }; }
    if (injectFailAfterInsert) throw new Error('INJECTED_FAILURE_BETWEEN_INSERT_AND_BALANCE');
    await client.query(
      `UPDATE biological_developers SET usdc_micro_balance = usdc_micro_balance + $1 WHERE id = $2`,
      [ev.amount, devId]);
    await client.query('COMMIT');
    return { credited: true };
  } catch (e) {
    await client.query('ROLLBACK');
    return { credited: false, reason: 'atomic_credit_failed_no_mutation', err: e.message };
  }
}

const EV = (over = {}) => ({
  chain_id: 8453, tx_hash: '0xabc123', log_index: 0, block_number: 20000000,
  token: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  amount: '1000000', confirmations: 12, ...over });

async function main() {
  const admin = await connect(DATABASE_URL);

  // 1. MIGRATION UP (real repo SQL)
  await admin.query(UP_SQL);
  const t = await admin.query(`SELECT to_regclass('public.usdc_deposits') AS t`);
  ok('migration_up', t.rows[0].t === 'usdc_deposits');

  // 2. SCHEMA ASSERTIONS: required columns + UNIQUE(chain_id,tx_hash,log_index)
  const cols = (await admin.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='usdc_deposits'`)).rows.map(r => r.column_name);
  const required = ['chain_id','tx_hash','log_index','block_number','token_address','from_address',
    'to_address','amount_base_units','confirmation_count','status','developer_id','created_at','credited_at'];
  const hasCols = required.every(c => cols.includes(c));
  const uq = (await admin.query(
    `SELECT array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS k
       FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.conrelid='usdc_deposits'::regclass AND c.contype='u' GROUP BY c.oid`)).rows;
  const normKey = (k) => (Array.isArray(k) ? k : String(k).replace(/[{}]/g, '').split(',')).join(',');
  const uniqueOk = uq.some(r => normKey(r.k) === 'chain_id,tx_hash,log_index');
  ok('schema_assertions', hasCols && uniqueOk);

  // 3. MIGRATION DOWN
  await admin.query(DOWN_SQL);
  const gone = await admin.query(`SELECT to_regclass('public.usdc_deposits') AS t`);
  ok('migration_down', gone.rows[0].t === null);

  // 4. MIGRATION REAPPLY
  await admin.query(UP_SQL);
  const back = await admin.query(`SELECT to_regclass('public.usdc_deposits') AS t`);
  ok('migration_reapply', back.rows[0].t === 'usdc_deposits');

  await admin.query(FIXTURE);
  await admin.query(`TRUNCATE usdc_deposits; INSERT INTO biological_developers (id, usdc_micro_balance)
    VALUES ('dev-1', 0) ON CONFLICT (id) DO UPDATE SET usdc_micro_balance = 0;`);

  // 5. ATOMICITY with failure injection: insert then forced error → rollback → no partial state
  const c = await connect(DATABASE_URL);
  const failRes = await creditAtomic(c, EV({ tx_hash: '0xfail' }), 'dev-1', { injectFailAfterInsert: true });
  const depAfterFail = (await c.query(`SELECT count(*)::int n FROM usdc_deposits WHERE tx_hash='0xfail'`)).rows[0].n;
  const balAfterFail = (await c.query(`SELECT usdc_micro_balance FROM biological_developers WHERE id='dev-1'`)).rows[0].usdc_micro_balance;
  const partialStates = (depAfterFail !== 0 || balAfterFail !== '0') ? 1 : 0;
  results.partial_credit_states = partialStates;
  ok('atomicity', !failRes.credited && depAfterFail === 0 && balAfterFail === '0');

  // happy credit once, then replay → no second credit
  const okRes = await creditAtomic(c, EV(), 'dev-1');
  const replay = await creditAtomic(c, EV(), 'dev-1');
  const balOnce = (await c.query(`SELECT usdc_micro_balance FROM biological_developers WHERE id='dev-1'`)).rows[0].usdc_micro_balance;
  ok('atomicity_credit_once', okRes.credited && !replay.credited && balOnce === '1000000');
  await c.end();

  // 6. CONCURRENCY: N parallel clients, SAME identity → exactly 1 economic credit
  async function concurrentReplay(tag) {
    await admin.query(`TRUNCATE usdc_deposits; UPDATE biological_developers SET usdc_micro_balance=0 WHERE id='dev-1';`);
    const N = 16;
    const txh = '0xrace_' + tag;
    const clients = await Promise.all(Array.from({ length: N }, () => connect(DATABASE_URL)));
    const outcomes = await Promise.all(clients.map(cl => creditAtomic(cl, EV({ tx_hash: txh }), 'dev-1')));
    await Promise.all(clients.map(cl => cl.end()));
    const credited = outcomes.filter(o => o.credited).length;
    const bal = (await admin.query(`SELECT usdc_micro_balance FROM biological_developers WHERE id='dev-1'`)).rows[0].usdc_micro_balance;
    const rows = (await admin.query(`SELECT count(*)::int n FROM usdc_deposits WHERE tx_hash=$1`, [txh])).rows[0].n;
    return { credited, bal, rows };
  }
  const r1 = await concurrentReplay('a');
  ok('concurrency', r1.credited === 1 && r1.bal === '1000000' && r1.rows === 1);
  results.concurrent_replay_credits = r1.credited;

  // 7. CONCURRENCY AFTER RECONNECT (fresh connections simulate service restart)
  const r2 = await concurrentReplay('b');
  ok('concurrency_after_restart', r2.credited === 1 && r2.bal === '1000000');

  // same tx / different logIndex → independent events
  await admin.query(`TRUNCATE usdc_deposits; UPDATE biological_developers SET usdc_micro_balance=0 WHERE id='dev-1';`);
  const c2 = await connect(DATABASE_URL);
  await creditAtomic(c2, EV({ tx_hash: '0xmulti', log_index: 0 }), 'dev-1');
  await creditAtomic(c2, EV({ tx_hash: '0xmulti', log_index: 1 }), 'dev-1');
  const multiBal = (await c2.query(`SELECT usdc_micro_balance FROM biological_developers WHERE id='dev-1'`)).rows[0].usdc_micro_balance;
  ok('same_tx_diff_logindex_independent', multiBal === '2000000');
  await c2.end();

  await admin.end();

  console.log('\nRESULT_JSON ' + JSON.stringify({ ...results, failures }));
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(e => { console.error('HARNESS_ERROR', e.message); process.exit(3); });
