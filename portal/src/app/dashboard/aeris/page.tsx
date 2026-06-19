'use client';

import { useState, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';
import { formatUnits, parseUnits, keccak256, encodePacked } from 'viem';
import { MEMBRANE_ABI, ERC20_ABI, USDC_SEPOLIA } from '@/lib/aeris-abi';

const CONTRACT = (process.env.NEXT_PUBLIC_AERIS_CONTRACT ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;

// ── Known pools ───────────────────────────────────────────────────────────────
const POOL_DEFS = [
  {
    slug:      'AERIS_NYC_PRECIP_2026_06_10',
    name:      'AERIS_NYC_PRECIP_2026_06_10',
    desc:      'Will precipitation exceed 10mm in NYC by Jun 10?',
    metric:    'PRECIP',
    closes:    '2026-06-10',
    condition: 'properties.precipitationLast24Hours.value > 10.0',
    labelA:    'Yes > 10mm',
    labelB:    'No ≤ 10mm',
  },
  {
    slug:      'AERIS_KANSAS_TEMP_PEAK_2026_07_15',
    name:      'AERIS_KANSAS_TEMP_PEAK_2026_07_15',
    desc:      'Will peak temperature exceed 35°C in Kansas by Jul 15?',
    metric:    'TEMP',
    closes:    '2026-07-15',
    condition: 'properties.temperature.value > 35.0',
    labelA:    'Yes > 35°C',
    labelB:    'No ≤ 35°C',
  },
  {
    slug:      'AERIS_MIAMI_WIND_GUST_2026_08_01',
    name:      'AERIS_MIAMI_WIND_GUST_2026_08_01',
    desc:      'Will peak wind gust exceed 25 m/s in Miami by Aug 1?',
    metric:    'WIND',
    closes:    '2026-08-01',
    condition: 'properties.windGust.value > 25.0',
    labelA:    'Yes > 25 m/s',
    labelB:    'No ≤ 25 m/s',
  },
] as const;

function poolId(slug: string): `0x${string}` {
  return keccak256(encodePacked(['string'], [slug]));
}

function fmt6(wei: bigint | undefined): string {
  if (!wei) return '$0.00';
  return '$' + Number(formatUnits(wei, 6)).toFixed(2);
}

// ── Stake Modal ───────────────────────────────────────────────────────────────
function StakeModal({
  pool, onClose,
}: {
  pool: (typeof POOL_DEFS)[number];
  onClose: () => void;
}) {
  const { address } = useAccount();
  const [side, setSide]   = useState<'A' | 'B'>('A');
  const [usdcAmt, setAmt] = useState('');
  const [phase, setPhase] = useState<'idle' | 'approving' | 'staking' | 'done' | 'err'>('idle');
  const [errMsg, setErr]  = useState('');

  const pid = poolId(pool.slug);
  const rawAmt = usdcAmt ? parseUnits(usdcAmt, 6) : BigInt(0);

  const { data: allowance } = useReadContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT] : undefined,
    query: { enabled: !!address },
  });

  const { writeContractAsync } = useWriteContract();

  const submit = useCallback(async () => {
    if (!rawAmt || !address) return;
    setPhase('idle'); setErr('');
    try {
      if ((allowance ?? BigInt(0)) < rawAmt) {
        setPhase('approving');
        await writeContractAsync({
          address: USDC_SEPOLIA,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT, rawAmt],
          chainId: baseSepolia.id,
        });
      }
      setPhase('staking');
      await writeContractAsync({
        address: CONTRACT,
        abi: MEMBRANE_ABI,
        functionName: 'injectCapital',
        args: [pid, side === 'A', rawAmt],
        chainId: baseSepolia.id,
      });
      setPhase('done');
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? 'Transaction failed');
      setPhase('err');
    }
  }, [rawAmt, address, allowance, pid, side, writeContractAsync]);

  const sideBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border-mid)',
    background: active ? 'rgba(13,148,136,0.18)' : 'transparent',
    color: active ? '#2dd4bf' : 'var(--text-faint)',
    fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: 13,
  });

  const s: Record<string, React.CSSProperties> = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal:   { background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 12, padding: '24px 24px', width: 380, maxWidth: '92vw' },
    title:   { fontSize: 15, fontWeight: 700, marginBottom: 4 },
    label:   { fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-faint)', marginBottom: 6, display: 'block', marginTop: 16 },
    input:   { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-mid)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, marginTop: 4 },
    submit:  { width: '100%', marginTop: 20, padding: '10px 0', borderRadius: 8, background: '#00D4AA', color: '#000', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' },
    cancel:  { width: '100%', marginTop: 8, padding: '8px 0', borderRadius: 8, background: 'transparent', color: 'var(--text-faint)', fontSize: 13, border: '1px solid var(--border-mid)', cursor: 'pointer' },
  };

  if (phase === 'done') return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal}>
        <div style={{ ...s.title, color: '#00D4AA' }}>✓ Stake confirmed</div>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 8 }}>Your position is on-chain. Good luck.</p>
        <button style={s.cancel} onClick={onClose}>Close</button>
      </div>
    </div>
  );

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.title}>Stake on {pool.slug.split('_').slice(1, 3).join(' ')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4 }}>{pool.desc}</div>

        <span style={s.label}>Choose side</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={sideBtn(side === 'A')} onClick={() => setSide('A')}>A · {pool.labelA}</button>
          <button style={sideBtn(side === 'B')} onClick={() => setSide('B')}>B · {pool.labelB}</button>
        </div>

        <span style={s.label}>Amount (USDC)</span>
        <input
          style={s.input}
          type="number" min="0.01" step="0.01" placeholder="0.00"
          value={usdcAmt} onChange={e => setAmt(e.target.value)}
        />

        {phase === 'err' && <div style={{ fontSize: 12, color: '#F85149', marginTop: 12 }}>{errMsg}</div>}

        <button
          style={{ ...s.submit, opacity: (!rawAmt || phase === 'approving' || phase === 'staking') ? 0.6 : 1 }}
          disabled={!rawAmt || phase === 'approving' || phase === 'staking'}
          onClick={submit}
        >
          {phase === 'approving' ? 'Approving USDC…' : phase === 'staking' ? 'Staking…' : 'Confirm Stake'}
        </button>
        <button style={s.cancel} onClick={onClose}>Cancel</button>

        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 14, lineHeight: 1.6 }}>
          Base Sepolia testnet · 5% toll on settlement · 95% to winners
        </div>
      </div>
    </div>
  );
}

// ── Pool Row ──────────────────────────────────────────────────────────────────
function PoolRow({
  pool, onStake,
}: {
  pool: (typeof POOL_DEFS)[number];
  onStake: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { address } = useAccount();

  const pid = poolId(pool.slug);

  const { data: poolData } = useReadContract({
    address: CONTRACT,
    abi: MEMBRANE_ABI,
    functionName: 'pools',
    args: [pid],
    query: { refetchInterval: 15_000 },
  });

  const { data: wagerA } = useReadContract({
    address: CONTRACT,
    abi: MEMBRANE_ABI,
    functionName: 'wagers',
    args: address ? [pid, address, true] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: wagerB } = useReadContract({
    address: CONTRACT,
    abi: MEMBRANE_ABI,
    functionName: 'wagers',
    args: address ? [pid, address, false] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { writeContractAsync } = useWriteContract();

  const totalA   = poolData?.[2] ?? BigInt(0);
  const totalB   = poolData?.[3] ?? BigInt(0);
  const resolved = poolData?.[4] ?? false;
  const voided   = poolData?.[5] ?? false;
  const total    = totalA + totalB;
  const pctA     = total > BigInt(0) ? Number((totalA * BigInt(100)) / total) : 50;
  const pctB     = 100 - pctA;

  let status = 'OPEN';
  let statusColor = 'var(--live-text, #00D4AA)';
  let statusBg    = 'rgba(0,212,170,0.12)';
  if (voided)   { status = 'VOID';     statusColor = '#D29922'; statusBg = 'rgba(210,153,34,0.12)'; }
  if (resolved) { status = 'SETTLED';  statusColor = '#7D8590'; statusBg = 'rgba(125,133,144,0.12)'; }

  const canClaim = resolved && !voided && ((wagerA ?? BigInt(0)) > BigInt(0) || (wagerB ?? BigInt(0)) > BigInt(0));

  async function claim() {
    try {
      await writeContractAsync({
        address: CONTRACT,
        abi: MEMBRANE_ABI,
        functionName: 'claimYield',
        args: [pid],
        chainId: baseSepolia.id,
      });
    } catch { /* user rejected or already claimed */ }
  }

  const rowStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--border-mid)',
  };

  const cellStyle: React.CSSProperties = {
    padding: '12px 14px', fontSize: 13, verticalAlign: 'middle',
  };

  const metricColors: Record<string, string> = {
    PRECIP: '#58A6FF', TEMP: '#F59E0B', WIND: '#A78BFA', HUMIDITY: '#3FB950',
  };

  return (
    <>
      <tr style={{ ...rowStyle, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <td style={cellStyle}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{pool.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{pool.desc}</div>
        </td>
        <td style={{ ...cellStyle, whiteSpace: 'nowrap' as const }}>
          <span style={{
            display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: `${metricColors[pool.metric]}22`,
            color: metricColors[pool.metric] ?? '#58A6FF',
          }}>
            {pool.metric}
          </span>
        </td>
        <td style={{ ...cellStyle, color: 'var(--text-faint)' }}>{pool.closes}</td>
        <td style={cellStyle}>{fmt6(total)}</td>
        <td style={{ ...cellStyle, minWidth: 130 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-faint)', marginBottom: 3 }}>
            <span>A {pctA}%</span><span>B {pctB}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--border-mid)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pctA}%`, background: '#00D4AA', borderRadius: 2 }} />
          </div>
        </td>
        <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: 11, color: 'var(--text-faint)' }}>api.weather.gov</td>
        <td style={cellStyle}>
          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: statusBg, color: statusColor }}>
            {status}
          </span>
        </td>
        <td style={{ ...cellStyle, whiteSpace: 'nowrap' as const }} onClick={e => e.stopPropagation()}>
          {canClaim ? (
            <button
              onClick={claim}
              style={{ padding: '3px 10px', borderRadius: 6, background: '#F59E0B', color: '#000', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}
            >
              Claim
            </button>
          ) : !resolved && !voided ? (
            <button
              onClick={e => { e.stopPropagation(); onStake(); }}
              style={{ padding: '3px 10px', borderRadius: 6, background: '#00D4AA', color: '#000', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}
            >
              Stake
            </button>
          ) : null}
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid var(--border-mid)' }}>
            <div style={{ padding: '14px 18px', background: 'var(--bg-alt, rgba(0,0,0,0.2))', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 18 }}>

              {/* Condition + oracle chips */}
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-faint)', marginBottom: 4 }}>Condition</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text)' }}>{pool.condition}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {[
                    { label: 'DOMAIN', val: 'FLAT', sub: '0%',     color: 'var(--text-faint)' },
                    { label: 'API.GOV', val: resolved ? 'RESOLVED' : 'PENDING', sub: '—', color: resolved ? '#00D4AA' : '#D29922' },
                    { label: 'PROOF',  val: resolved ? 'ZK-SEALED' : 'PENDING', sub: '—', color: resolved ? '#00D4AA' : '#D29922' },
                  ].map(chip => (
                    <div key={chip.label} style={{
                      padding: '5px 10px', border: '1px solid var(--border-mid)', borderRadius: 6,
                      fontSize: 10, textAlign: 'center', minWidth: 64,
                    }}>
                      <div style={{ color: 'var(--text-faint)' }}>{chip.label}</div>
                      <div style={{ fontWeight: 700, color: chip.color, marginTop: 2 }}>{chip.val}</div>
                      <div style={{ color: 'var(--text-faint)', fontSize: 9 }}>{chip.sub}</div>
                    </div>
                  ))}
                </div>
                {address && (wagerA ?? BigInt(0)) + (wagerB ?? BigInt(0)) > BigInt(0) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-faint)' }}>
                    Your position: A {fmt6(wagerA)} · B {fmt6(wagerB)}
                  </div>
                )}
              </div>

              {/* Option bars */}
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { label: `OPT A · ${pool.labelA}`, val: fmt6(totalA), color: '#00D4AA' },
                  { label: `OPT B · ${pool.labelB}`, val: fmt6(totalB), color: '#F85149' },
                ] as const).map(opt => (
                  <div key={opt.label} style={{
                    flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
                    borderRadius: 8, padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4 }}>{opt.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: opt.color }}>{opt.val}</div>
                  </div>
                ))}
              </div>

              {/* Toll structure */}
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-faint)', marginBottom: 6 }}>Toll Structure</div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.9 }}>
                  5% total · 2.5% app creator<br />
                  2.5% architect treasury<br />
                  95% proportional to winners
                </div>
                <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-faint)', marginBottom: 4, marginTop: 12 }}>Spec Hash</div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-faint)', wordBreak: 'break-all' as const }}>
                  {poolData?.[1] ? (poolData[1] as string).slice(0, 18) + '…' : 'stored at createPool()'}
                </div>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AerisPage() {
  const { isConnected } = useAccount();
  const [stakePool, setStakePool] = useState<(typeof POOL_DEFS)[number] | null>(null);
  const [activeFilter, setFilter] = useState('All Sources');

  const filters = ['All Sources', 'Precipitation', 'Temperature', 'Wind', 'Humidity'];
  const metricMap: Record<string, string> = {
    'Precipitation': 'PRECIP', 'Temperature': 'TEMP', 'Wind': 'WIND', 'Humidity': 'HUMIDITY',
  };

  const visiblePools = POOL_DEFS.filter(p =>
    activeFilter === 'All Sources' || p.metric === metricMap[activeFilter]
  );

  const cellHead: React.CSSProperties = {
    padding: '10px 14px', fontSize: 10, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--text-faint)', textAlign: 'left',
    borderBottom: '1px solid var(--border-mid)',
  };

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '20px 20px' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>
          ExergyNet · LNES-13
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>AERIS Markets</h1>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: 'rgba(0,212,170,0.12)', color: '#00D4AA', letterSpacing: '0.04em' }}>
            ● LIVE
          </span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(210,153,34,0.12)', color: '#D29922' }}>
            TESTNET
          </span>
          <div style={{ marginLeft: 'auto' }}>
            <ConnectButton chainStatus="icon" showBalance={false} />
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-faint)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span>Base Sepolia · chain 84532</span>
          <span style={{ fontFamily: 'monospace' }}>
            CONTRACT: {CONTRACT === '0x0000000000000000000000000000000000000000'
              ? <span style={{ color: '#F85149' }}>not configured</span>
              : `${CONTRACT.slice(0, 6)}…${CONTRACT.slice(-4)}`}
          </span>
          <span>ORACLE: api.weather.gov</span>
          <span>SETTLEMENT: ZK-STARK / Groth16</span>
        </div>
      </div>

      {/* Testnet banner */}
      <div style={{
        background: 'rgba(210,153,34,0.08)', border: '1px solid rgba(210,153,34,0.4)',
        borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#D29922',
        marginBottom: 18, display: 'flex', gap: 8,
      }}>
        <span>⚠</span>
        <span>
          <strong>Testnet — free.</strong> All pools use test USDC on Base Sepolia (chain 84532).
          zkTLS oracle verification (LNES-13 guest circuit) is in development — do not use for value.
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Active Pools',   value: String(visiblePools.length), sub: '↑ 1 opened today', color: '#00D4AA' },
          { label: 'Total Staked',   value: '$0.00',                     sub: 'test USDC locked',  color: 'var(--text)' },
          { label: 'Settled',        value: '0',                          sub: '0 pools resolved', color: '#3FB950' },
          { label: 'Your Position',  value: isConnected ? '$0.00' : '—', sub: isConnected ? 'across all pools' : <span onClick={() => {}} style={{ color: '#00D4AA', cursor: 'pointer' }}>Connect wallet</span>, color: 'var(--text)' },
        ].map(card => (
          <div key={card.label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
            borderRadius: 8, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)', marginBottom: 6 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color, lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-mid)', marginBottom: 14 }}>
        {['Pools (3)', 'Intel Signals (0)', 'Oracle Rules (4)', 'History (0)'].map((tab, i) => (
          <div key={tab} style={{
            padding: '8px 14px', fontSize: 13,
            color: i === 0 ? '#00D4AA' : 'var(--text-faint)',
            borderBottom: i === 0 ? '2px solid #00D4AA' : '2px solid transparent',
            marginBottom: -1, cursor: 'pointer',
          }}>
            {tab}
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 12,
              border: '1px solid var(--border-mid)',
              background: activeFilter === f ? '#00D4AA' : 'var(--bg-surface)',
              color: activeFilter === f ? '#000' : 'var(--text-faint)',
              fontWeight: activeFilter === f ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Pool table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={cellHead}>Pool</th>
              <th style={cellHead}>Metric</th>
              <th style={cellHead}>Closes</th>
              <th style={cellHead}>Staked</th>
              <th style={cellHead}>A / B Split</th>
              <th style={cellHead}>Oracle</th>
              <th style={cellHead}>Status</th>
              <th style={cellHead}></th>
            </tr>
          </thead>
          <tbody>
            {visiblePools.map(pool => (
              <PoolRow
                key={pool.slug}
                pool={pool}
                onStake={() => setStakePool(pool)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Stake modal */}
      {stakePool && (
        <StakeModal pool={stakePool} onClose={() => setStakePool(null)} />
      )}

    </div>
  );
}
