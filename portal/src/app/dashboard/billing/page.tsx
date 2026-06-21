'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits } from 'viem';
import { developer, Developer } from '@/lib/api';

// Base Sepolia USDC + Operator Wallet
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const OPERATOR_WALLET = '0xbd1e790f6040FA62797671B84a50025a0133109C' as const;

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
] as const;

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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

function BalanceBar({ dev }: { dev: Developer | null }) {
  const balance = dev ? parseFloat(dev.usdc_balance_usd) : 0;
  const cap = 100;
  const pct = Math.min((balance / cap) * 100, 100);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>USDC Balance</span>
        <span style={{ fontSize: 18, fontWeight: 500, color: '#0D9488' }}>
          ${balance.toFixed(4)}
        </span>
      </div>
      <div style={{ height: 4, background: '#1E293B', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg,#0D9488,#14B8A6)',
            borderRadius: 2,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: '#334155' }}>
          {dev?.active ? '● active' : '○ inactive — deposit to activate'}
        </span>
        <span style={{ fontSize: 10, color: '#334155' }}>≈ {Math.floor(balance / 0.0004).toLocaleString()} tokens</span>
      </div>
    </div>
  );
}

// ── Rail A: Web3 Deposit ──────────────────────────────────────────────────────

function Web3DepositRail({ onSuccess }: { onSuccess: () => void }) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('5');
  const [status, setStatus] = useState<'idle' | 'pending' | 'confirming' | 'crediting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  // Once tx confirmed on-chain → credit backend via authenticated claim endpoint
  useEffect(() => {
    if (!txConfirmed || !txHash || status !== 'confirming') return;
    setStatus('crediting');

    const usdcMicro = Math.round(parseFloat(amount) * 1_000_000);
    const token = localStorage.getItem('en_token') ?? '';

    fetch(`${API}/api/deposit/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tx_hash: txHash, usdc_amount_micro: usdcMicro }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        setStatus('done');
        onSuccess();
        setTimeout(() => { setStatus('idle'); setTxHash(undefined); }, 4000);
      })
      .catch((e: Error) => {
        setErrorMsg(e.message ?? 'Credit failed — contact support with your tx hash');
        setStatus('error');
      });
  }, [txConfirmed, txHash, status, amount, onSuccess]);

  async function handleDeposit() {
    if (!isConnected || !address) return;
    const usdAmount = parseFloat(amount);
    if (isNaN(usdAmount) || usdAmount < 1) { setErrorMsg('Minimum deposit: $1 USDC'); return; }

    setStatus('pending');
    setErrorMsg('');

    try {
      const usdcAmount = parseUnits(amount, 6); // USDC has 6 decimals
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [OPERATOR_WALLET, usdcAmount],
      });
      setTxHash(hash);
      setStatus('confirming');
    } catch (e: any) {
      setErrorMsg(e?.shortMessage ?? e?.message ?? 'Transaction failed');
      setStatus('error');
    }
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 12, lineHeight: 1.7 }}>
        Transfer USDC directly from your Base Sepolia wallet. Credited instantly on confirmation.
      </div>

      <div style={{ marginBottom: 12 }}>
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus="address"
        />
      </div>

      {isConnected && (
        <>
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

          <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, lineHeight: 1.6 }}>
            → Destination: Operator Wallet {OPERATOR_WALLET.slice(0, 10)}...
            <br />
            → Network: Base Sepolia · USDC {USDC_ADDRESS.slice(0, 10)}...
            <br />
            → Cost per 1K tokens: ~$0.40 USDC
          </div>

          {errorMsg && (
            <div style={{ background: '#2D0808', border: '1px solid #991B1B', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#EF4444', marginBottom: 12 }}>
              {errorMsg}
            </div>
          )}

          {status === 'done' && (
            <div style={{ background: '#042B27', border: '1px solid #0F766E', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#0D9488', marginBottom: 12 }}>
              ✓ Deposit confirmed. Balance updated.
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
            disabled={status === 'pending' || status === 'confirming' || status === 'crediting'}
          >
            {status === 'pending'    ? 'confirm in wallet…'   :
             status === 'confirming' ? 'waiting for block…'   :
             status === 'crediting'  ? 'crediting account…'   :
             status === 'done'       ? '✓ deposit complete'   :
             status === 'error'      ? '↺ try again'          :
             `deposit $${amount} USDC via Web3`}
          </button>
        </>
      )}
    </div>
  );
}

// ── Rail B: Stripe Fiat ───────────────────────────────────────────────────────

function StripeDepositRail({ onSuccess }: { onSuccess: () => void }) {
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleStripeCheckout() {
    const usd = parseFloat(amount);
    if (isNaN(usd) || usd < 5) { setError('Minimum: $5 USD'); return; }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('en_token') ?? '';
      const res = await fetch(`${API}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount_usd: usd, currency: 'usd' }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 12, lineHeight: 1.7 }}>
        Purchase compute credits via credit card. Processed by Stripe. Credits your USDC balance internally.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 10, color: '#475569', marginBottom: 4, letterSpacing: '0.06em' }}>
            AMOUNT (USD)
          </label>
          <input
            className="en-input"
            type="number"
            min="5"
            step="5"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="10"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          {[10, 25, 50, 100].map(v => (
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

      <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, lineHeight: 1.6 }}>
        → $1 USD = $1 USDC internal credit · ExergyNet absorbs conversion<br />
        → ${amount} ≈ {Math.floor(parseFloat(amount) / 0.0004 || 0).toLocaleString()} tokens<br />
        → Powered by Stripe · PCI-compliant
      </div>

      {error && (
        <div style={{ background: '#2D0808', border: '1px solid #991B1B', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#EF4444', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button
        className="en-btn"
        style={{ width: '100%', justifyContent: 'center', background: '#6366F1', color: 'white' }}
        onClick={handleStripeCheckout}
        disabled={loading}
      >
        {loading ? 'redirecting to Stripe…' : `purchase $${amount} USD via card →`}
      </button>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [dev, setDev] = useState<Developer | null>(null);
  const [activeRail, setActiveRail] = useState<'web3' | 'fiat'>('web3');
  const [authed, setAuthed] = useState<boolean | null>(null);

  function refresh() {
    developer.me().then(d => { setDev(d); setAuthed(true); }).catch(() => { setAuthed(false); });
  }

  useEffect(() => { refresh(); }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (authed === false) {
      window.location.href = '/?next=/dashboard/billing';
    }
  }, [authed]);

  // Check for Stripe success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') === 'success') {
      setTimeout(refresh, 1500); // give webhook time to process
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#334155', letterSpacing: '0.08em', marginBottom: 6 }}>
          <span style={{ color: '#0D9488' }}>■</span> BILLING & DEPOSITS
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: '#F8FAFC' }}>compute credits</div>
      </div>

      {/* Balance */}
      <Section title="USDC BALANCE">
        <BalanceBar dev={dev} />
        <div style={{ marginTop: 12, display: 'flex', gap: 8, fontSize: 11, color: '#475569' }}>
          <div>rate: <span style={{ color: '#94A3B8' }}>0.4 micro-USDC / token</span></div>
          <div style={{ marginLeft: 'auto' }}>
            last updated: <span style={{ color: '#94A3B8' }}>now</span>
          </div>
        </div>
      </Section>

      {/* Rail selector */}
      <div style={{ display: 'flex', background: '#1E293B', borderRadius: 8, padding: 3, marginBottom: 16, border: '1px solid #334155' }}>
        {[
          { key: 'web3' as const, label: '◈ Web3 · Wallet (USDC)' },
          { key: 'fiat' as const, label: '◇ Fiat · Credit Card (Stripe)' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveRail(key)}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: 6,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeRail === key ? '#0D9488' : 'transparent',
              color: activeRail === key ? 'white' : '#475569',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active rail */}
      <Section title={activeRail === 'web3' ? 'RAIL A — WEB3 DEPOSIT' : 'RAIL B — FIAT DEPOSIT'}>
        {activeRail === 'web3'
          ? <Web3DepositRail onSuccess={refresh} />
          : <StripeDepositRail onSuccess={refresh} />}
      </Section>

      {/* Integration note */}
      <div className="en-card" style={{ fontSize: 11, color: '#475569', lineHeight: 1.8 }}>
        <div style={{ fontSize: 10, color: '#334155', letterSpacing: '0.08em', marginBottom: 8 }}>SETTLEMENT NOTES</div>
        Web3 deposits confirm in ~15s on Base Sepolia. Fiat deposits credit within 60s of Stripe confirmation.
        Billing is per-token at 0.4 micro-USDC/token (≈ $0.40 per 1,000 tokens). Balance never expires.
        Minimum activation threshold: $1 USDC.
      </div>
    </div>
  );
}
