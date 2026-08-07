# Modern RAG vs xLMP -- Summary Table

Run: `run1_20260806_134906` | All arms complete: **True**

> In a 601-query controlled benchmark, modern hybrid RAG achieved the highest
> raw accuracy, while xLMP's bounded-evidence architecture achieved the
> strongest measured accuracy-to-latency efficiency. The benchmark also
> identified a deterministic evidence-construction defect affecting
> approximately 11 percent of queries, establishing the exact engineering
> target for xLMP v2.0.

| Arm | Label | n (ok/total) | Accuracy | Schema-Valid % | Retrieval (mean ms) | Inference (mean ms) | Total (mean ms) | Acc/Latency (%/s) |
|---|---|---|---|---|---|---|---|---|
| S0 | TF-IDF sparse baseline | 598/601 | 87.1% | 99.0% | 1 | 7885 | 7886 | 11.05 |
| R1 | Dense (Qwen3-Embedding) | 598/601 | 93.3% | 99.0% | 5478 | 7976 | 13453 | 6.94 |
| R2 | Hybrid RRF (BM25+dense) | 601/601 | 92.5% | 99.0% | 4135 | 8047 | 12182 | 7.59 |
| R3 | Hybrid + Reranker | 601/601 | 93.3% | 99.2% | 11896 | 7653 | 19548 | 4.78 |
| R4 | Hybrid + Reranker + Parent-Document Expansion | 601/601 | 93.2% | 98.8% | 7042 | 7982 | 15024 | 6.20 |
| X1 | xLMP Complete-Object | 596/601 | 91.4% | 98.3% | 0 | 8494 | 8494 | 10.77 |
| X2 | xLMP Bounded-Evidence-Resolver | 598/601 | 90.6% | 98.7% | 0 | 7575 | 7575 | 11.97 |
| O1 | Gold-Evidence Oracle | 601/601 | 90.7% | 98.7% | 0 | 7756 | 7756 | 11.69 |

## Efficiency Frontier Ranking (Accuracy% / Total E2E Latency in seconds, highest first)

1. **X2** (xLMP Bounded-Evidence-Resolver) — 11.97
2. **O1** (Gold-Evidence Oracle) — 11.69
3. **S0** (TF-IDF sparse baseline) — 11.05
4. **X1** (xLMP Complete-Object) — 10.77
5. **R2** (Hybrid RRF (BM25+dense)) — 7.59
6. **R1** (Dense (Qwen3-Embedding)) — 6.94
7. **R4** (Hybrid + Reranker + Parent-Document Expansion) — 6.20
8. **R3** (Hybrid + Reranker) — 4.78

*Retrieval latency for X1/X2/O1 reflects context assembly (full-text or gold-context lookup), not an embedding/rerank pipeline -- not directly comparable to R1-R4's retrieval cost in kind, only in wall-clock terms.*