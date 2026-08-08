"""
LNES-59.2B B3 hybrid + reranker (comparator spec section 8). Same hybrid
candidate generator as B2, widened to a larger pool (default 40), then
Qwen3-Reranker-0.6B rescoring, then final top-k. The full pool is
reranked -- not just an already-narrowed top-5 -- so reranking can
correct first-stage retrieval mistakes.
"""

from rag_hybrid import hybrid_search

_reranker = None


def _get_reranker():
    global _reranker
    if _reranker is None:
        from sentence_transformers import CrossEncoder
        _reranker = CrossEncoder("Qwen/Qwen3-Reranker-0.6B")
    return _reranker


def rerank(query, candidates, k):
    model = _get_reranker()
    pairs = [(query, c["text"]) for c in candidates]
    scores = model.predict(pairs)
    ranked = sorted(zip(candidates, scores), key=lambda cs: cs[1], reverse=True)
    return [{**c, "rerank_score": float(s)} for c, s in ranked[:k]]


def hybrid_rerank_search(query, dense_index, bm25_index, chunks, candidate_pool_depth, final_k):
    pool = hybrid_search(query, dense_index, bm25_index, chunks, candidate_pool_depth, candidate_pool_depth)
    return rerank(query, pool, final_k)
