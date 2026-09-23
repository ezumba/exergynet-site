'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId, useSwitchChain } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits, formatUnits } from 'viem';

// Base Mainnet invariants — must never be overridden by environment or fallback
const CHAIN_ID      = 8453 as const;
const CHAIN_ID_HEX  = '0x2105' as const;
const USDC_ADDRESS  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;

// Deposit receiver comes from backend health endpoint only — never hardcoded fallback
const API = process.env.NEXT_PUBLIC_API_URL ?? '';

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface HealthConfig {
  chain_id: number;
  usdc_address: string;
  deposit_receiver: string;
  min_confirmations: number;
  status: 'READY' | 'CONFIG_INCOMPLETE';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="en-card" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.08em', marginBottom: 16 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function DepositPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [health, setHealth] = useState<HealthConfig | null>(null);
  const [healthError, setHealthError] = useState('');
  const [amount, setAmount] = useState('5');
  const [status, setStatus] = useState<'idle' | 'pending' | 'confirming' | 'crediting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  // Read live USDC balance for connected wallet
  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_TRANSFER_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && chainId === CHAIN_ID },
  });

  const usdcBalance = usdcBalanceRaw ? parseFloat(formatUnits(usdcBalanceRaw as bigint, 6)) : null;

  // Fetch backend health config on mount — authoritative for deposit receiver
  useEffect(() => {
    if (!API) { setHealthError('API URL not configured'); return; }
    fetch(`${API}/api/deposit/health`)
      .then(r => r.json())
      .then((data: HealthConfig) => {
        if (data.chain_id !== CHAIN_ID) {
          setHealthError(`Backend chain_id mismatch: ${data.chain_id} (expected ${CHAIN_ID})`);
          return;
        }
        if (data.usdc_address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
          setHealthError(`Backend USDC address mismatch`);
          return;
        }
        if (!data.deposit_receiver || data.deposit_receiver === '0x0000000000000000000000000000000000000000') {
          setHealthError('Deposit receiver unavailable — contact support');
          return;
        }
        if (data.status !== 'READY') {
          setHealthError(`Backend not ready: ${data.status}`);
          return;
        }
        setHealth(data);
      })
      .catch(() => setHealthError('Could not reach deposit backend'));
  }, []);

  // After tx confirmed on-chain → notify backend
  useEffect(() => {
    if (!txConfirmed || !txHash || status !== 'confirming' || !health) return;
    setStatus('crediting');

    const usdcMicro = Math.round(parseFloat(amount) * 1_000_000);
    const token = localStorage.getItem('en_token') ?? '';

    fetch(`${API}/api/deposit/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tx_hash: txHash, usdc_amount_micro: usdcMicro }),
    })
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        setStatus('done');
        setTimeout(() => { setStatus('idle'); setTxHash(undefined); }, 5000);
      })
      .catch((e: Error) => {
        setErrorMsg(e.message ?? 'Credit notification failed — contact support with your tx hash');
        setStatus('error');
      });
  }, [txConfirmed, txHash, status, amount, health]);

  async function handleDeposit() {
    if (!isConnected || !address || !health) return;

    // Chain guard — must be Base Mainnet
    if (chainId !== CHAIN_ID) {
      setErrorMsg(`Wrong network. Please switch to Base Mainnet (chain ID ${CHAIN_ID}).`);
      return;
    }

    const usdAmount = parseFloat(amount);
    if (isNaN(usdAmount) || usdAmount < 1) { setErrorMsg('Minimum deposit: $1 USDC'); return; }

    // Reject zero or mismatched receiver
    const receiver = health.deposit_receiver as `0x${string}`;
    if (!receiver || receiver === '0x0000000000000000000000000000000000000000') {
      setErrorMsg('Deposit receiver unavailable — contact support');
      return;
    }

    setStatus('pending');
    setErrorMsg('');

    try {
      const usdcAmount = parseUnits(amount, 6);
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [receiver, usdcAmount],
        chainId: CHAIN_ID,
      });
      setTxHash(hash);
      setStatus('confirming');
    } catch (e: any) {
      setErrorMsg(e?.shortMessage ?? e?.message ?? 'Transaction failed');
      setStatus('error');
    }
  }

  const wrongNetwork = isConnected && chainId !== CHAIN_ID;

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#334155', letterSpacing: '0.08em', marginBottom: 6 }}>
          <span style={{ color: '#0D9488' }}>■</span> USDC DEPOSIT
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: '#F8FAFC' }}>deposit USDC</div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
          Base Mainnet · {health ? 'backend ready' : healthError ? 'backend unavailable' : 'loading…'}
        </div>
      </div>

      {healthError && (
        <div style={{ background: '#2D0808', border: '1px solid #991B1B', borderRadius: 6, padding: '10px 14px', fontSize: 11, color: '#EF4444', marginBottom: 16 }}>
          {healthError}
        </div>
      )}

      <Section title="WALLET">
        <ConnectButton showBalance={false} chainStatus="full" accountStatus="address" />
        {wrongNetwork && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#EF4444' }}>Wrong network — switch to Base Mainnet</span>
            <button
              className="en-btn en-btn-ghost"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => switchChain({ chainId: CHAIN_ID })}
            >
              switch
            </button>
          </div>
        )}
      </Section>

      {isConnected && !wrongNetwork && health && (
        <>
          {usdcBalance !== null && (
            <Section title="YOUR USDC BALANCE">
              <span style={{ fontSize: 18, fontWeight: 500, color: '#0D9488' }}>
                {usdcBalance.toFixed(4)} USDC
              </span>
            </Section>
          )}

          <Section title="AMOUNT">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, color: '#475569', marginBottom: 4, letterSpacing: '0.06em' }}>
                  AMOUNT (USDC)
                </label>
                <input
                  className="en-input"
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="5"
                  disabled={status === 'pending' || status === 'confirming' || status === 'crediting'}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {[5, 10, 25, 50].map(v => (
                  <button
                    key={v}
                    className="en-btn en-btn-ghost"
                    style={{ padding: '6px 10px', fontSize: 11 }}
                    onClick={() => setAmount(String(v))}
                  >
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, lineHeight: 1.7 }}>
              → Receiver: {health.deposit_receiver.slice(0, 10)}…{health.deposit_receiver.slice(-6)}<br />
              → Network: Base Mainnet (chain {CHAIN_ID})<br />
              → USDC: {USDC_ADDRESS.slice(0, 10)}…<br />
              → Confirmations: {health.min_confirmations} blocks
            </div>

            {errorMsg && (
              <div style={{ background: '#2D0808', border: '1px solid #991B1B', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#EF4444', marginBottom: 12 }}>
                {errorMsg}
              </div>
            )}

            {status === 'done' && (
              <div style={{ background: '#042B27', border: '1px solid #0F766E', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#0D9488', marginBottom: 12 }}>
                ✓ Deposit confirmed. Balance will credit after backend verification ({health.min_confirmations} blocks).
                {txHash && (
                  <div style={{ marginTop: 4 }}>
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#0D9488', textDecoration: 'underline' }}
                    >
                      view on BaseScan ↗
                    </a>
                  </div>
                )}
              </div>
            )}

            <button
              className="en-btn en-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={
                status === 'error'
                  ? () => { setStatus('idle'); setErrorMsg(''); setTxHash(undefined); }
                  : handleDeposit
              }
              disabled={status === 'pending' || status === 'confirming' || status === 'crediting' || !health}
            >
              {status === 'pending'    ? 'confirm in wallet…'       :
               status === 'confirming' ? 'waiting for block…'       :
               status === 'crediting'  ? 'notifying backend…'       :
               status === 'done'       ? '✓ deposit complete'       :
               status === 'error'      ? '↺ try again'              :
               `deposit $${amount} USDC`}
            </button>
          </Section>
        </>
      )}

      <div className="en-card" style={{ fontSize: 11, color: '#475569', lineHeight: 1.8 }}>
        <div style={{ fontSize: 10, color: '#334155', letterSpacing: '0.08em', marginBottom: 8 }}>NOTES</div>
        Deposits are verified by the ExergyNet backend after {health?.min_confirmations ?? 12} block confirmations (~15s on Base).
        Backend is authoritative for crediting — the blockchain transaction is the source of truth.
        Minimum: $1 USDC.
      </div>
    </div>
  );
}
