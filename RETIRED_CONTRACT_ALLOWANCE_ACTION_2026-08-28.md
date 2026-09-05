# Retired Contract Allowance — Action Document

**Directive:** VP Sales Directive 007, §12
**Purpose:** lay out the facts and the recommended action clearly enough for the operator to approve or reject knowingly. **This document does not broadcast anything.** No on-chain action was or will be taken from this session.

---

## The facts

| Field | Value |
|---|---|
| Wallet | `0xbd1e790f6040FA62797671B84a50025a0133109C` — operator-controlled; key was exposed in an agent/session environment (already flagged for rotation in `CLAUDE.md`); not compromised by a third party per the operator's direct confirmation |
| Token | USDC (Base Mainnet), contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Spender | `0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f` — the retired, pre-V5 LNES-04 contract (this incident's subject) |
| Current allowance | `115792089237316195423570985008687907853269984665640564039457584007913128939935` — exactly `type(uint256).max` minus 700,000, i.e. minus precisely the 700,000 micro-USDC ($0.70) the retired contract currently holds. This is an exact self-consistency check: `approve(MaxUint256)` was called once, then exactly $0.70 was drawn down via the six historical transfers, leaving this allowance. Effectively unlimited going forward. |
| Chain | Base Mainnet (eip155:8453) |
| Evidence source | `eth_call` against the USDC contract's `allowance(owner, spender)` function, executed read-only during this incident's forensics (2026-08-28); independently re-confirmable by anyone via the same call |

## Does any current application depend on this allowance?

No. The retired contract's real on-chain function selectors do not match `openJob(bytes32)`/`settleExergy(bytes32,bytes,bytes,address)` at all (confirmed in `MCP_P0_CONTRACT_INCIDENT_2026-08-28.md`), so nothing in the current, fixed `exergynet-mcp-server` (0.2.4) or the current site can or does call this contract using this allowance. Revoking it would not disable any working feature.

## Recommended revocation transaction semantics

A standard ERC-20 `approve` call, from the same wallet, setting the allowance for this specific spender back to zero:

```
to:      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   (USDC contract)
from:    0xbd1e790f6040FA62797671B84a50025a0133109C   (the wallet itself — only this wallet's key can do this)
function: approve(address spender, uint256 amount)
args:     spender = 0x5cfE075149776f4b3cca07a27D4fd85A60BA5e3f
          amount  = 0
```

This is the same pattern any wallet/approval-management tool uses (e.g. [revoke.cash](https://revoke.cash/address/0xbd1e790f6040FA62797671B84a50025a0133109C?chainId=8453), which can also be used directly by connecting this wallet).

## Expected effect

- **Gas-only.** No USDC moves — `approve()` changes only the allowance mapping, not any balance. Cost is a single standard ERC-20 approve transaction (typically well under $0.01 in gas on Base at current prices).
- Sets the allowance for this specific spender (the retired contract) to exactly zero. Does not affect any other approval this wallet may have granted to any other contract.
- Irreversible in the sense that it's a normal on-chain state change — but harmless to reverse conceptually, since re-approving later (if ever needed, which is not anticipated) is equally trivial.

## Operational consequences

None identified. This wallet's other 87 historical mainnet transactions (per `VAULT_LEDGER.md`) are unrelated (MetaMask swaps, an unrelated gig-protocol interaction, minor token holdings) — revoking this one allowance does not touch any of that.

## Recommendation

Revoke. The allowance serves no current purpose, costs nothing but gas to remove, and its only function today is as a standing, unnecessary attack surface against a contract this project has already and independently classified as retired.

## Explicit non-action

**This session did not and will not broadcast this or any other transaction.** Per Directive 006 §5 and Directive 007's own authorization boundary, on-chain wallet actions require the operator's explicit, separate authorization and execution — this document exists so that decision can be made with the full facts in one place, not to pre-empt it.
