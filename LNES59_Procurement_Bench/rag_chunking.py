"""
LNES-59.2B canonical chunking pipeline (comparator spec section 4).
Shared by B1/B2/B3 -- same chunk set, so no arm gets larger/cleaner
documents "because it is hybrid." Token-based (via the Qwen3-Embedding
tokenizer, not a character/word heuristic) -- the July benchmark's
150-character chunking does not return here.
"""

TARGET_CHUNK_TOKENS = 500   # frozen, midpoint of the directive's 400-600 range
CHUNK_OVERLAP_TOKENS = 75   # frozen, midpoint of the directive's 50-100 range

_tokenizer = None


def _get_tokenizer():
    global _tokenizer
    if _tokenizer is None:
        from transformers import AutoTokenizer
        _tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-Embedding-0.6B")
    return _tokenizer


def chunk_document(doc, target_tokens=TARGET_CHUNK_TOKENS, overlap_tokens=CHUNK_OVERLAP_TOKENS):
    """Split one document's content into overlapping token windows.
    Most LNES-59 documents are short (a paragraph or two) and produce
    exactly one chunk -- that's expected, not a bug; the windowing exists
    for the (rare in this corpus) longer documents."""
    tok = _get_tokenizer()
    text = doc["content"]
    ids = tok.encode(text, add_special_tokens=False)
    if len(ids) <= target_tokens:
        return [{
            "chunk_id": f"{doc['id']}::chunk0",
            "doc_id": doc["id"],
            "source_class": doc.get("source_class", doc.get("type", "unknown")),
            "text": text,
            "token_start": 0,
            "token_end": len(ids),
        }]
    chunks = []
    start = 0
    idx = 0
    stride = target_tokens - overlap_tokens
    while start < len(ids):
        end = min(start + target_tokens, len(ids))
        chunk_text = tok.decode(ids[start:end])
        chunks.append({
            "chunk_id": f"{doc['id']}::chunk{idx}",
            "doc_id": doc["id"],
            "source_class": doc.get("source_class", doc.get("type", "unknown")),
            "text": chunk_text,
            "token_start": start,
            "token_end": end,
        })
        if end == len(ids):
            break
        start += stride
        idx += 1
    return chunks


def chunk_documents(documents_by_id):
    """documents_by_id: {doc_id: doc_dict}. Returns a flat list of chunks
    across all documents, each carrying its source doc_id/source_class
    for provenance."""
    chunks = []
    for doc in documents_by_id.values():
        chunks.extend(chunk_document(doc))
    return chunks
