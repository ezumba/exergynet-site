#!/usr/bin/env python3
"""
Modern-RAG retrieval backends for the LNES58 Modern-RAG-vs-xLMP benchmark
(BLK-007/BLK-008, Phase 2). Drop-in alternatives to rag_common.retrieve_top_k
-- same chunk universe per query (controlled context-assembly track: both
systems work within the same gold document set), different scoring/fusion.

CPU-only per BLK-007 Resolution B. Uses the 0.6B fallback model tier.
"""
import os
import math
from collections import Counter

import rag_common as rc

TOP_K = rc.TOP_K

_dense_model = None
_reranker_model = None

DENSE_MODEL_NAME = os.environ.get("DENSE_MODEL_NAME", "Qwen/Qwen3-Embedding-0.6B")
RERANKER_MODEL_NAME = os.environ.get("RERANKER_MODEL_NAME", "Qwen/Qwen3-Reranker-0.6B")


def _get_dense_model():
    global _dense_model
    if _dense_model is None:
        from sentence_transformers import SentenceTransformer
        _dense_model = SentenceTransformer(DENSE_MODEL_NAME, device="cpu")
    return _dense_model


def _dense_scores(query, chunks):
    model = _get_dense_model()
    doc_emb = model.encode(chunks, convert_to_numpy=True, normalize_embeddings=True)
    q_emb = model.encode([query], convert_to_numpy=True, normalize_embeddings=True,
                          prompt_name="query" if "query" in getattr(model, "prompts", {}) else None)
    scores = (doc_emb @ q_emb[0])
    return scores.tolist()


# ---- R1: pure dense retrieval ----
def retrieve_dense(query, chunks, k=TOP_K):
    scores = _dense_scores(query, chunks)
    order = sorted(range(len(chunks)), key=lambda i: -scores[i])
    top_idx = sorted(order[:k])
    retrieved = [chunks[i] for i in top_idx]
    out_scores = [scores[i] for i in top_idx]
    return retrieved, out_scores, top_idx


def _rrf_fuse(rank_lists, k_const=60):
    """Reciprocal-rank fusion across multiple ranked index lists. Returns
    fused scores dict {idx: fused_score}."""
    fused = {}
    for ranks in rank_lists:
        for rank, idx in enumerate(ranks):
            fused[idx] = fused.get(idx, 0.0) + 1.0 / (k_const + rank + 1)
    return fused


def _bm25_ranking(query, chunks):
    from rank_bm25 import BM25Okapi
    tokenized_corpus = [rc.tokenize(c) for c in chunks]
    bm25 = BM25Okapi(tokenized_corpus)
    q_tokens = rc.tokenize(query)
    scores = bm25.get_scores(q_tokens)
    return sorted(range(len(chunks)), key=lambda i: -scores[i])


def _dense_ranking(query, chunks):
    scores = _dense_scores(query, chunks)
    return sorted(range(len(chunks)), key=lambda i: -scores[i])


# ---- R2: BM25 + dense, RRF fusion ----
def retrieve_hybrid_rrf(query, chunks, k=TOP_K):
    bm25_rank = _bm25_ranking(query, chunks)
    dense_rank = _dense_ranking(query, chunks)
    fused = _rrf_fuse([bm25_rank, dense_rank])
    order = sorted(fused.keys(), key=lambda i: -fused[i])
    top_idx = sorted(order[:k])
    retrieved = [chunks[i] for i in top_idx]
    scores = [fused[i] for i in top_idx]
    return retrieved, scores, top_idx


def _get_reranker():
    global _reranker_model
    if _reranker_model is None:
        from sentence_transformers import CrossEncoder
        _reranker_model = CrossEncoder(RERANKER_MODEL_NAME, device="cpu", trust_remote_code=True)
    return _reranker_model


def _rerank(query, candidate_chunks):
    """Returns (scores) aligned to candidate_chunks, using a cross-encoder.
    Falls back to dense cosine if the reranker model can't be loaded --
    failure is logged, not silently substituted with a fabricated result."""
    try:
        model = _get_reranker()
        pairs = [[query, c] for c in candidate_chunks]
        scores = model.predict(pairs)
        return list(scores), None
    except Exception as e:
        return None, str(e)


# ---- R3: hybrid RRF candidates, then cross-encoder rerank ----
def retrieve_hybrid_rerank(query, chunks, k=TOP_K, candidate_k=None):
    candidate_k = candidate_k or min(len(chunks), max(k * 3, 10))
    bm25_rank = _bm25_ranking(query, chunks)
    dense_rank = _dense_ranking(query, chunks)
    fused = _rrf_fuse([bm25_rank, dense_rank])
    candidate_idx = sorted(fused.keys(), key=lambda i: -fused[i])[:candidate_k]
    candidate_chunks = [chunks[i] for i in candidate_idx]
    rerank_scores, err = _rerank(query, candidate_chunks)
    if rerank_scores is None:
        # Reranker unavailable -- fall back to the RRF-fused order for the
        # requested k, flagged via the returned error string (caller logs it).
        top_idx = sorted(candidate_idx[:k])
        return [chunks[i] for i in top_idx], [fused[i] for i in top_idx], top_idx, err
    scored = list(zip(candidate_idx, rerank_scores))
    scored.sort(key=lambda p: -p[1])
    top_idx = sorted([idx for idx, _ in scored[:k]])
    retrieved = [chunks[i] for i in top_idx]
    scores = [s for idx, s in scored if idx in top_idx]
    return retrieved, scores, top_idx, None


# ---- R4: hybrid + rerank + parent-document expansion ----
# "Parent" here = the complete source document (A/B/C) the winning chunk
# belongs to, since the corpus is already document-tagged via the
# "[DOCUMENT X -- ...]" headers baked into chunk text by the tier harnesses.
def retrieve_parent_expanded(query, chunks, doc_map, k=TOP_K, candidate_k=None):
    """doc_map: list parallel to chunks, doc_map[i] = which parent document
    (e.g. 'A','B','C') chunk i belongs to. Returns the union of complete
    parent documents for the reranked top-k chunks, deduplicated."""
    retrieved, scores, top_idx, err = retrieve_hybrid_rerank(query, chunks, k=k, candidate_k=candidate_k)
    winning_docs = sorted(set(doc_map[i] for i in top_idx if i < len(doc_map)))
    return winning_docs, scores, top_idx, err


# ---- R5: BGE-M3 dense + BGE reranker replication ----
_bge_model = None
_bge_reranker = None
BGE_MODEL_NAME = os.environ.get("BGE_MODEL_NAME", "BAAI/bge-m3")
BGE_RERANKER_NAME = os.environ.get("BGE_RERANKER_NAME", "BAAI/bge-reranker-v2-m3")


def _get_bge_model():
    global _bge_model
    if _bge_model is None:
        from sentence_transformers import SentenceTransformer
        _bge_model = SentenceTransformer(BGE_MODEL_NAME, device="cpu")
    return _bge_model


def _get_bge_reranker():
    global _bge_reranker
    if _bge_reranker is None:
        from sentence_transformers import CrossEncoder
        _bge_reranker = CrossEncoder(BGE_RERANKER_NAME, device="cpu")
    return _bge_reranker


def retrieve_bge_hybrid_rerank(query, chunks, k=TOP_K, candidate_k=None):
    candidate_k = candidate_k or min(len(chunks), max(k * 3, 10))
    bm25_rank = _bm25_ranking(query, chunks)
    model = _get_bge_model()
    doc_emb = model.encode(chunks, convert_to_numpy=True, normalize_embeddings=True)
    q_emb = model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
    dense_scores = (doc_emb @ q_emb[0]).tolist()
    dense_rank = sorted(range(len(chunks)), key=lambda i: -dense_scores[i])
    fused = _rrf_fuse([bm25_rank, dense_rank])
    candidate_idx = sorted(fused.keys(), key=lambda i: -fused[i])[:candidate_k]
    candidate_chunks = [chunks[i] for i in candidate_idx]
    try:
        reranker = _get_bge_reranker()
        pairs = [[query, c] for c in candidate_chunks]
        rerank_scores = reranker.predict(pairs)
        scored = list(zip(candidate_idx, rerank_scores))
        scored.sort(key=lambda p: -p[1])
        top_idx = sorted([idx for idx, _ in scored[:k]])
        retrieved = [chunks[i] for i in top_idx]
        scores = [s for idx, s in scored if idx in top_idx]
        return retrieved, scores, top_idx, None
    except Exception as e:
        top_idx = sorted(candidate_idx[:k])
        return [chunks[i] for i in top_idx], [fused[i] for i in top_idx], top_idx, str(e)
