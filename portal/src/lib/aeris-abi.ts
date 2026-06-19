export const MEMBRANE_ABI = [
  {
    name: 'pools',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'appCreator',        type: 'address'  },
      { name: 'specHash',          type: 'bytes32'  },
      { name: 'totalOptionA',      type: 'uint256'  },
      { name: 'totalOptionB',      type: 'uint256'  },
      { name: 'isResolved',        type: 'bool'     },
      { name: 'isVoid',            type: 'bool'     },
      { name: 'winningOutcomeIsA', type: 'bool'     },
      { name: 'netPool',           type: 'uint256'  },
      { name: 'winningPoolMass',   type: 'uint256'  },
    ],
  },
  {
    name: 'wagers',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'poolId',    type: 'bytes32' },
      { name: 'user',      type: 'address' },
      { name: 'isOptionA', type: 'bool'    },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'injectCapital',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'poolId',    type: 'bytes32' },
      { name: 'isOptionA', type: 'bool'    },
      { name: 'amount',    type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'claimYield',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'PoolCreated',
    type: 'event',
    inputs: [
      { name: 'poolId',     type: 'bytes32', indexed: true  },
      { name: 'appCreator', type: 'address', indexed: true  },
      { name: 'specHash',   type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'WagerInjected',
    type: 'event',
    inputs: [
      { name: 'poolId',    type: 'bytes32', indexed: true  },
      { name: 'user',      type: 'address', indexed: true  },
      { name: 'isOptionA', type: 'bool',    indexed: false },
      { name: 'amount',    type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PoolResolved',
    type: 'event',
    inputs: [
      { name: 'poolId',          type: 'bytes32', indexed: true  },
      { name: 'winningOutcomeIsA', type: 'bool',  indexed: false },
    ],
  },
  {
    name: 'YieldClaimed',
    type: 'event',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true  },
      { name: 'user',   type: 'address', indexed: true  },
      { name: 'yield',  type: 'uint256', indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Base Sepolia test USDC
export const USDC_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
// Base Mainnet USDC
export const USDC_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
