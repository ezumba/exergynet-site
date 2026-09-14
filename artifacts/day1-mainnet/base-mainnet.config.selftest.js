'use strict';
// Fail-closed config self-test (8 cases). No network unless getChainId supplied.
const assert = require('assert');
const { loadConfig, assertProductionConfig, BASE_MAINNET_USDC } = require('./base-mainnet.config.js');

const BASE = {
  BASE_CHAIN_ID: '8453',
  BASE_RPC_URL: 'https://mainnet.base.org',
  BASE_USDC_CONTRACT: BASE_MAINNET_USDC,
  DEPOSIT_RECEIVING_WALLET: '0x1111111111111111111111111111111111111111', // TEST-ONLY synthetic
  DEPOSIT_MIN_CONFIRMATIONS: '12',
};
const env = (over) => ({ ...BASE, ...over });
const rejects = async (o, opts) => {
  try { await assertProductionConfig(loadConfig(env(o)), opts); return false; }
  catch { return true; }
};

(async () => {
  let p = 0, f = 0;
  const t = async (n, fn) => { try { assert.ok(await fn()); console.log('PASS', n); p++; }
    catch (e) { console.log('FAIL', n, e.message); f++; } };

  await t('reject empty/missing everything', () => rejects({ BASE_CHAIN_ID: '', BASE_RPC_URL: '', BASE_USDC_CONTRACT: '', DEPOSIT_RECEIVING_WALLET: '' }));
  await t('reject chain 84532 (Sepolia)', () => rejects({ BASE_CHAIN_ID: '84532' }));
  await t('reject test USDC', () => rejects({ BASE_USDC_CONTRACT: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' }));
  await t('reject retired wallet 0xbd1e...109C', () => rejects({ DEPOSIT_RECEIVING_WALLET: '0xbd1e790f6040FA62797671B84a50025a0133109C' }));
  await t('reject zero wallet', () => rejects({ DEPOSIT_RECEIVING_WALLET: '0x0000000000000000000000000000000000000000' }));
  await t('reject missing wallet', () => rejects({ DEPOSIT_RECEIVING_WALLET: '' }));
  await t('reject RPC chainId disagreement', () => rejects({}, { getChainId: async () => 84532 }));
  await t('accept valid mainnet config', async () => {
    const cfg = await assertProductionConfig(loadConfig(env({})), { getChainId: async () => 8453 });
    return cfg.chainId === 8453;
  });

  console.log(`\nCONFIG_SELFTEST: ${p} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
})();
