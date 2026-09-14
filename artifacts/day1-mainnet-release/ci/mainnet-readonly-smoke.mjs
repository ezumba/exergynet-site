// Read-only Base Mainnet smoke (§12). NO transaction, NO funds, NO keys.
// Verifies chainId==8453, canonical USDC has code, and USDC name/symbol/decimals.
const RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const USDC = (process.env.BASE_USDC_CONTRACT || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase();

async function rpc(method, params = []) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}
const decStr = (hex) => {
  // ABI-encoded string: [offset][len][bytes]
  const b = hex.slice(2); const len = parseInt(b.slice(64, 128), 16);
  return Buffer.from(b.slice(128, 128 + len * 2), 'hex').toString('utf8');
};

const out = { rpc: RPC, checks: {} };
let failures = 0;
const ck = (name, cond, val) => { out.checks[name] = { pass: !!cond, value: val }; if (!cond) failures++; };

try {
  const chainHex = await rpc('eth_chainId');
  ck('eth_chainId_is_8453', parseInt(chainHex, 16) === 8453, parseInt(chainHex, 16));

  const code = await rpc('eth_getCode', [USDC, 'latest']);
  ck('usdc_has_code', code && code !== '0x' && code.length > 4, `${(code || '').slice(0, 12)}... len=${(code || '').length}`);

  const name = decStr(await rpc('eth_call', [{ to: USDC, data: '0x06fdde03' }, 'latest']));  // name()
  const symbol = decStr(await rpc('eth_call', [{ to: USDC, data: '0x95d89b41' }, 'latest'])); // symbol()
  const decHex = await rpc('eth_call', [{ to: USDC, data: '0x313ce567' }, 'latest']);          // decimals()
  const decimals = parseInt(decHex, 16);
  ck('usdc_name_USD_Coin', name === 'USD Coin', name);
  ck('usdc_symbol_USDC', symbol === 'USDC', symbol);
  ck('usdc_decimals_6', decimals === 6, decimals);

  const blk = await rpc('eth_blockNumber');
  ck('latest_block_ok', parseInt(blk, 16) > 0, parseInt(blk, 16));

  // Transfer log query works (bounded 1-block range; read-only)
  const topic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const from = '0x' + (parseInt(blk, 16) - 1).toString(16);
  const logs = await rpc('eth_getLogs', [{ address: USDC, topics: [topic], fromBlock: from, toBlock: blk }]);
  ck('transfer_log_query_ok', Array.isArray(logs), `logs=${Array.isArray(logs) ? logs.length : 'n/a'}`);
} catch (e) {
  out.error = e.message; failures++;
}
out.MAINNET_READONLY_SMOKE = failures === 0 ? 'PASS' : 'FAIL';
console.log(JSON.stringify(out, null, 2));
process.exit(failures === 0 ? 0 : 1);
