"""
LNES-59.2B B4 -- structured fact memory (comparator spec section 9,
mandatory arm). Named B4_STRUCTURED_FACT_MEMORY, not "Mem0" (real Mem0
is not installed or used anywhere in this project).

Pipeline: source documents -> structured candidate fact extraction ->
normalized fact objects (subject/predicate/value/source/time) ->
persistent fact store -> query-dependent fact retrieval -> model.

Deliberately does NOT receive xLMP's deterministic post-generation
authority/consistency gate. Its central test: does giving the model
typed, source/time-tagged facts (structure, but no deterministic
governance) solve the state-correctness problem on its own? The model
must do its own temporal/conflict/authority reasoning from the raw fact
set -- nothing here resolves supersession, conflicts, or authority for
it. This is what makes it "a strong competitor" rather than a strawman:
more structure than raw RAG text, same governance-free reasoning burden
as X1.
"""


def extract_facts(documents_by_id):
    """One fact object per document that carries a predicate -- this is
    deliberately much simpler than deterministic_extraction.py's
    classify_document(): no temporal-status resolution, no authority
    classification, no scope derivation. Just the raw (subject,
    predicate, value, source, time) tuple every document already states
    about itself. B4's competitive claim rests on the MODEL reasoning
    well over these raw facts, not on this extraction step doing the
    gate's job in disguise."""
    facts = []
    for doc in documents_by_id.values():
        predicate = doc.get("predicate")
        if predicate is None:
            continue
        subject = predicate.split(".", 1)[0] if "." in predicate else predicate
        facts.append({
            "subject": subject,
            "predicate": predicate,
            "value": doc.get("value"),
            "source": doc["id"],
            "source_class": doc.get("source_class", doc.get("type", "unknown")),
            "time": doc.get("effective_from") or doc.get("issued"),
            "effective_until": doc.get("effective_until"),
            "amends": doc.get("amends"),
            "revokes": doc.get("revokes"),
            "raw_content": doc["content"],
        })
    return facts


def build_fact_store(documents_by_id):
    """Persistent fact store, built ONCE over the FULL corpus (not a
    per-case grounding subset -- B0/B1-B3/B4 all see the full document
    set and must find the relevant facts themselves, exactly like a real
    structured-memory system would; only X0-X2 get xLMP's own
    grounding_document_ids structural bound). A flat list is sufficient
    at this corpus scale; retrieval below is by free-text match against
    query content, not gold-predicate lookup (B4 never sees the case's
    target predicate -- that's evaluator-only)."""
    return extract_facts(documents_by_id)


def retrieve_facts(fact_store, query_hint=None):
    """Query-dependent retrieval. query_hint is optional free text (e.g.
    entity names mentioned in the query) -- when absent or when nothing
    matches, falls back to returning the full fact store for this case's
    grounding set (small enough at this scale that 'return everything
    relevant to the grounding set' is itself a legitimate, non-oracle
    retrieval policy, distinct from X0-X2's predicate-scoped bound)."""
    if not query_hint:
        return list(fact_store)
    hint_lower = query_hint.lower()
    matched = [f for f in fact_store if any(
        tok in f["raw_content"].lower() or tok in f["subject"].lower()
        for tok in hint_lower.split()
        if len(tok) > 3
    )]
    return matched if matched else list(fact_store)
