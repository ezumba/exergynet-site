/* ExergyNet Day-1 Base Mainnet deposit — single static configuration object.
 * The ONLY place production deposit config lives. No secrets. Public values only.
 * DEPOSIT_RECEIVING_WALLET stays blank until the operator supplies ONE public address;
 * the deposit UI shows "Deposits temporarily unavailable" until then and NEVER falls back
 * to any old/test address. */
window.EXG_DAY1 = {
  CHAIN_ID: 8453,
  CHAIN_ID_HEX: '0x2105',
  CHAIN_NAME: 'Base',
  RPC_URL: 'https://mainnet.base.org',            // used only for the add-network prompt
  USDC_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // canonical Circle Base USDC (6 decimals)
  USDC_DECIMALS: 6,
  DEPOSIT_RECEIVING_WALLET: '',                    // OPERATOR_INPUT_REQUIRED — leave blank
  DEPOSIT_API_BASE: 'https://portal.exergynet.org',
  DEPOSIT_CLAIM_PATH: '/api/deposit/claim',
  BASESCAN: 'https://basescan.org',
  // Addresses that must NEVER be accepted as a receiver (defense-in-depth; backend also enforces).
  RETIRED_DENYLIST: ['0xbd1e790f6040fa62797671b84a50025a0133109c'],
  ZERO_ADDR: '0x0000000000000000000000000000000000000000'
};
