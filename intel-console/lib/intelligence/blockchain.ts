// lib/intelligence/blockchain.ts
// On-chain signal detection via Etherscan HTTP API (no WebSocket)
// Uses free tier — no auth needed for basic endpoints
// With ETHERSCAN_API_KEY env var → higher rate limits

import type { NormalizedSignal } from "./types";

// Known exchange deposit addresses (Ethereum mainnet)
const EXCHANGE_ADDRESSES: Record<string, string> = {
  "0x71660c4005ba85c37ccec55d0c4493e66fe775d3": "Coinbase",
  "0x503828976d22510aad0201ac7ec88293211d23da": "Coinbase 2",
  "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740": "Coinbase 3",
  "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be": "Binance",
  "0xd551234ae421e3bcba99a0da6d736074f22192ff": "Binance 2",
  "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0": "Kraken",
  "0xe5924bc0db2a78c2a1b6b8e5f51d27e41b7b8b85": "Uniswap Router",
};

const WHALE_THRESHOLD_ETH = 10; // 100 ETH+ = whale move
const GAS_SPIKE_GWEI = 50;

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string; // Wei as string
  gasPrice: string;
  gasUsed: string;
  isError: string;
  input: string;
  timeStamp: string;
}

export async function fetchBlockchainSignals(): Promise<NormalizedSignal[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY ?? "YourApiKeyToken";
  const signals: NormalizedSignal[] = [];

  try {
    // Fetch recent large ETH transfers from top exchange addresses
    for (const [address, name] of Object.entries(EXCHANGE_ADDRESSES).slice(0, 3)) {
      const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc&apikey=${apiKey}`;

      let txs: EtherscanTx[] = [];
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) continue;
        const data = await res.json() as { status: string; result: EtherscanTx[] };
        if (data.status !== "1" || !Array.isArray(data.result)) continue;
        txs = data.result;
      } catch {
        continue;
      }

      const now = Date.now();
      const cutoff = now - 86_400_000; // 24 hours

      for (const tx of txs) {
        const ts = parseInt(tx.timeStamp) * 1000;
        if (ts < cutoff) continue;
        if (tx.isError === "1") continue;

        const valueEth = parseInt(tx.value) / 1e18;
        if (valueEth < WHALE_THRESHOLD_ETH) continue; // skip dust

        const gasPriceGwei = parseInt(tx.gasPrice) / 1e9;
        const toLower = (tx.to ?? "").toLowerCase();
        const toExchange = EXCHANGE_ADDRESSES[toLower];

        if (toExchange) {
          // Large deposit TO exchange = potential sell signal
          signals.push({
            id: `blockchain_deposit_${tx.hash}`,
            source: "blockchain",
            type: "exchange_deposit",
            timestamp: ts,
            confidence: Math.min(0.5 + valueEth / 2000, 0.95),
            severity: valueEth > 1000 ? "critical" : "warning",
            entities: [tx.from.slice(0, 10), toExchange, tx.hash.slice(0, 10)],
            locations: [],
            sectors: ["crypto", "exchange"],
            raw: { from: tx.from, to: tx.to, valueEth, toExchange, gasPriceGwei, hash: tx.hash },
          });
        }

        if (gasPriceGwei > GAS_SPIKE_GWEI) {
          signals.push({
            id: `blockchain_gas_${tx.hash}`,
            source: "blockchain",
            type: "gas_spike",
            timestamp: ts,
            confidence: Math.min(gasPriceGwei / 500, 0.8),
            severity: gasPriceGwei > 300 ? "critical" : "warning",
            entities: [tx.from.slice(0, 10), tx.hash.slice(0, 10)],
            locations: [],
            sectors: ["crypto"],
            raw: { gasPriceGwei, from: tx.from, hash: tx.hash, valueEth },
          });
        }
      }
    }

    // Fetch latest ETH gas price for baseline
    try {
      const gasUrl = `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${apiKey}`;
      const gasRes = await fetch(gasUrl, { signal: AbortSignal.timeout(5_000) });
      if (gasRes.ok) {
        const gasData = await gasRes.json() as { status: string; result: { FastGasPrice: string; ProposeGasPrice: string } };
        if (gasData.status === "1") {
          const fast = parseFloat(gasData.result.FastGasPrice);
          const propose = parseFloat(gasData.result.ProposeGasPrice);
          if (fast > propose * 3) {
            signals.push({
              id: `blockchain_gas_oracle_${Date.now()}`,
              source: "blockchain",
              type: "gas_spike",
              timestamp: Date.now(),
              confidence: Math.min(fast / 500, 0.85),
              severity: fast > 300 ? "critical" : "warning",
              entities: ["ethereum-mainnet"],
              locations: [],
              sectors: ["crypto"],
              raw: { fastGasGwei: fast, proposeGasGwei: propose, multiplier: fast / propose },
            });
          }
        }
      }
    } catch { /* skip gas oracle if fails */ }

  } catch { /* top-level guard */ }

  return signals;
}
