"""
LNES-59.2B B1 dense retrieval (comparator spec section 6). Chunks ->
Qwen3-Embedding-0.6B -> FAISS flat index (cosine via normalized inner
product) -> top-k. Frozen top_k=8 per LNES59_ARM_CONFIGS.json.
"""

import numpy as np

_embedder = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B")
    return _embedder


def embed_texts(texts):
    model = _get_embedder()
    vecs = model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
    return vecs.astype("float32")


def build_dense_index(chunks):
    """chunks: list of chunk dicts from rag_chunking.chunk_documents().
    Returns (faiss_index, chunks) -- chunks kept alongside the index so
    search results can be mapped back to doc_id/source_class/text."""
    import faiss
    vecs = embed_texts([c["text"] for c in chunks])
    dim = vecs.shape[1]
    index = faiss.IndexFlatIP(dim)  # inner product on normalized vectors == cosine
    index.add(vecs)
    return index, chunks


def dense_search(query, index, chunks, k):
    qvec = embed_texts([query])
    scores, idxs = index.search(qvec, min(k, len(chunks)))
    results = []
    for score, i in zip(scores[0], idxs[0]):
        if i < 0:
            continue
        results.append({**chunks[i], "score": float(score)})
    return results
