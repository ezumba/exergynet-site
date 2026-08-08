"""
LNES-59.2B per-arm prompt construction. All arms share
candidate_claim.CANDIDATE_CLAIM_SCHEMA_INSTRUCTIONS as their response
format instructions; they differ only in what EVIDENCE section precedes
the question, matching each arm's design in LNES59_COMPARATOR_SPEC.md.
"""

from candidate_claim import CANDIDATE_CLAIM_SCHEMA_INSTRUCTIONS


def _wrap(evidence_section, query):
    return (
        f"{CANDIDATE_CLAIM_SCHEMA_INSTRUCTIONS}\n\n"
        f"{evidence_section}\n\n"
        f"--- QUESTION ---\n{query}\n\n"
        f"Respond with only the JSON object."
    )


def _format_documents(documents, label="SOURCE DOCUMENTS"):
    doc_text = "\n\n".join(
        f"[{doc['id']}] ({doc.get('source_class', doc.get('type', 'unknown'))})\n{doc['content']}"
        for doc in documents
    )
    return f"--- {label} ---\n{doc_text}"


def build_prompt_b0(case, all_documents, max_docs=None):
    """B0 -- full context: ALL documents in the runner-visible corpus
    (ignores grounding_document_ids entirely -- 'a B0 arm would ignore it
    and use the full corpus', per case_view.py's own docstring), subject
    only to a frozen deterministic truncation rule if max_docs is hit:
    keep the first max_docs documents in corpus iteration order, drop the
    rest. Never selects which documents survive based on ground truth."""
    docs = list(all_documents)
    truncated = False
    if max_docs is not None and len(docs) > max_docs:
        docs = docs[:max_docs]
        truncated = True
    return _wrap(_format_documents(docs, "SOURCE DOCUMENTS (full corpus)"), case["query"]), truncated


def build_prompt_retrieved(case, retrieved_chunks, arm_label):
    """B1/B2/B3 -- same prompt shape, evidence is whatever chunk list the
    arm's retrieval pipeline (rag_dense/rag_hybrid/rag_rerank) selected."""
    chunk_text = "\n\n".join(
        f"[{c['doc_id']}] ({c['source_class']})\n{c['text']}"
        for c in retrieved_chunks
    )
    return _wrap(f"--- RETRIEVED EVIDENCE ({arm_label}) ---\n{chunk_text}", case["query"])


def build_prompt_structured_facts(case, facts):
    """B4 -- structured fact memory: typed fact tuples, not raw prose
    chunks. The model still has to do its own temporal/conflict/authority
    reasoning -- no gate resolves it for them."""
    fact_lines = []
    for f in facts:
        parts = [f"subject={f['subject']!r}", f"predicate={f['predicate']!r}", f"value={f['value']!r}",
                 f"source={f['source']!r} ({f['source_class']})", f"time={f['time']!r}"]
        if f.get("effective_until"):
            parts.append(f"effective_until={f['effective_until']!r}")
        if f.get("amends"):
            parts.append(f"amends={f['amends']!r}")
        if f.get("revokes"):
            parts.append(f"revokes={f['revokes']!r}")
        fact_lines.append("{" + ", ".join(parts) + "}\n  raw: " + f["raw_content"])
    fact_text = "\n\n".join(fact_lines)
    return _wrap(f"--- STRUCTURED FACT MEMORY ---\n{fact_text}", case["query"])


def build_prompt_x0(case, bounded_documents):
    """X0 -- xLMP bounded evidence: restricted to this case's OWN
    grounding_document_ids (the one place a document set is structurally
    known upfront), raw document text, no state envelope/governance."""
    return _wrap(_format_documents(bounded_documents, "BOUNDED EVIDENCE (grounding_document_ids)"), case["query"])


def build_prompt_state_envelope(case, committed_state):
    """X1/X2 -- the model receives the ALREADY deterministically-resolved
    state envelope (V7's extract_case_state() output), not raw documents.
    Both X1 and X2 use this identical prompt/evidence; they diverge only
    AFTER generation, when X2 additionally applies the frozen gate."""
    envelope_lines = [
        f"resolution: {committed_state.resolution.value}",
        f"claim_type: {committed_state.claim_type.value}",
        f"authority_status: {committed_state.authority_status.value}",
        f"temporal_status: {committed_state.temporal_status.value}",
        f"value: {committed_state.value!r}",
    ]
    if committed_state.scope:
        envelope_lines.append(f"scope: {committed_state.scope!r}")
    if committed_state.policy_tiers:
        envelope_lines.append(f"policy_tiers: {committed_state.policy_tiers!r}")
    if committed_state.historical_values:
        envelope_lines.append(f"historical_values (known but not currently in force): {committed_state.historical_values!r}")
    envelope_text = "\n".join(envelope_lines)
    return _wrap(
        "--- xLMP STATE ENVELOPE (already deterministically resolved by V7 extraction) ---\n"
        f"{envelope_text}\n\n"
        "This envelope is the ONLY evidence you should reason from -- it already reflects "
        "temporal validity, authority tiers, and conflict/incompleteness where applicable.",
        case["query"],
    )
