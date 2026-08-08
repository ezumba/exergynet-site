"""
LNES-59.2B B2 hybrid retrieval (comparator spec section 7): dense +
BM25 lexical, fused with Reciprocal Rank Fusion (RRF_k=60, the standard
constant -- an explicitly documented deterministic rank-fusion method,
not an ad hoc weighting). Same chunk set as B1 -- no larger/cleaner
documents just because it's hybrid.
"""

import re

from rank_bm25 import BM25Okapi

from rag_dense import dense_search

RRF_K = 60


def _tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def build_bm25_index(chunks):
    tokenized = [_tokenize(c["text"]) for c in chunks]
    return BM25Okapi(tokenized), chunks


def bm25_search(query, bm25_index, chunks, k):
    scores = bm25_index.get_scores(_tokenize(query))
    ranked = sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)[:k]
    return [{**chunks[i], "score": float(scores[i])} for i in ranked]


def reciprocal_rank_fusion(ranked_lists, k=RRF_K):
    """ranked_lists: list of ranked result lists (each a list of chunk
    dicts, already sorted best-first). Returns chunks sorted by fused RRF
    score, deduplicated by chunk_id (keeping the first-seen chunk dict,
    RRF score computed across all lists it appears in)."""
    rrf_scores = {}
    chunk_by_id = {}
    for ranked in ranked_lists:
        for rank, chunk in enumerate(ranked):
            cid = chunk["chunk_id"]
            chunk_by_id.setdefault(cid, chunk)
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(rrf_scores.items(), key=lambda kv: kv[1], reverse=True)
    return [{**chunk_by_id[cid], "rrf_score": score} for cid, score in fused]


def hybrid_search(query, dense_index, bm25_index, chunks, candidate_depth, final_k):
    """Frozen shape: dense top-`candidate_depth` + BM25 top-`candidate_depth`
    -> RRF -> final top-`final_k`."""
    dense_results = dense_search(query, dense_index, chunks, candidate_depth)
    bm25_results = bm25_search(query, bm25_index, chunks, candidate_depth)
    fused = reciprocal_rank_fusion([dense_results, bm25_results])
    return fused[:final_k]
