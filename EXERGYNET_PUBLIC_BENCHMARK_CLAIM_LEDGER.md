# ExergyNet Public Benchmark Claim Ledger
# EXERGYNET_PUBLIC_BENCHMARK_CLAIM_LEDGER.md
# Status: ACTIVE -- Updated 2026-09-02
# Rule: No numerical claim goes public unless VERIFIED in this ledger.

| CLAIM_ID | PUBLIC_TEXT | VALUE | UNIT | EXPERIMENT | ENVELOPE | LIMITATION | STATUS |
|----------|-------------|-------|------|------------|----------|------------|--------|
| CLM-001 | ~11.3x correct-task throughput vs. full-context replay | 11.3 | x | H200 campaign | Single NVIDIA H200, Nemotron-class model, tested workload | Single hardware/model/workload; not universal | VERIFIED/PUBLIC |
| CLM-002 | ~660-820 prompt tokens held flat as corpus scaled 8K->285K | 660-820 | tokens (active staged K) | H200 campaign | Single NVIDIA H200, corpus 8K-285K | H200 campaign only; absolute K differs by hardware/model | VERIFIED/PUBLIC |
| CLM-003 | 8%->0% false authoritative commitments at 84% accuracy | 8%->0% | false commitment rate | Authority layer test | 100 procurement-decision cases | Single workload; ungoverned baseline | VERIFIED/PUBLIC |
| CLM-004 | 0/1 -- reasoning model complied with injection, deterministic boundary rejected | 0 vs 1 | compliance events | Prompt-injection red team | Live test, reproduced twice | Two reproductions; single attack type | VERIFIED/PUBLIC |
| CLM-005 | 125x nominal corpus growth across 32K->4M A100 campaign | 125 | x nominal | LNES-82C | 4x A100-SXM4-40GB, TP=4, NVIDIA NIM; adversarial synthetic corpus 32K-4M | A100 campaign only; absolute K differs by hardware/model | VERIFIED/PUBLIC |
| CLM-006 | No detected material positive global scaling of mean K across 32K-4M | b ~7.83e-7 | regression slope | LNES-82C nine-point ladder | 32K-4M adversarial synthetic corpus, A100 | Local upturn exists (1M->4M delta K=+85.18, CI [+74.91,+95.08]); claim is global slope only | VERIFIED/PUBLIC |
| CLM-007 | Mean active staged context approximately 903 at 4M holdout | 902.81 | tokens (mean K) | LNES-82C 4M sealed holdout | 4x A100-SXM4-40GB, 190 queries, 0 mismatches | Sealed holdout only; dev mean 901.65 | VERIFIED/PUBLIC |
| CLM-008 | Local upturn: K trough ~764 at 1M, recovery to ~903 at 4M | trough 763.86, 4M 902.81 | tokens | LNES-82C | 32K-4M A100 campaign | Local upturn does not invalidate global slope; disclosed | VERIFIED/PUBLIC |
| CLM-009 | H200 and A100 are separate campaigns | -- | -- | Separate campaigns | Different hardware, different models | Do not combine absolute K values across campaigns | VERIFIED/PUBLIC |

## Claims NOT Cleared for Publication

- Exact rarity thresholds (Work Compression)
- Prefix construction rules (Work Compression)
- Posting/pruning logic (Work Compression)
- Crossover thresholds for routing decisions (LNES-86)
- Cache topology internals
- LNES-86 adaptive retrieval mechanism (selectivity emergence)
- Security operational mechanics
- Internal scoring coefficients

## Revision History

- 2026-09-02: Initial ledger created, 9 verified public claims populated
- 2026-09-02: Supersedes prior session benchmark summaries; incorporates K_LOCAL_UPTURN_CONTINUES
