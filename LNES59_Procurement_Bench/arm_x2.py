"""
LNES-59 X2 arm: xLMP state envelopes + consistency gate, against a REAL
model. R&D / benchmark only.

Resolves LNES59_BENCHMARK_PLAN.md's open design question: rather than a
separate classification model call (its own error surface, doubles cost)
or a deterministic freeform-text parser (fragile, likely corpus-specific
-- the exact caveat already documented for deterministic_extraction.py),
the model is asked to produce its answer directly as structured JSON
matching state_consistency_gate_v2.ModelOutput's shape in ONE call. This
is simpler to verify (the response either parses into a valid ModelOutput
or it doesn't -- no separate classifier to validate) and doesn't require
inventing a second, unverified mechanism.

This file does NOT call any API by default. `call_model()` is a thin,
swappable client -- `mock_model_call()` (used by this file's own tests)
proves the prompt-construction and response-parsing logic is correct
without spending anything. `anthropic_model_call()` is the real client,
reads ANTHROPIC_API_KEY from the environment (never read, viewed, or
logged by this code -- passed straight to the SDK), and is only invoked
if the caller explicitly asks for it. Running it is the Trustee's own
action with their own key, per this session's standing credential-
handling boundary -- see run_x2_arm.py for the actual invocation script
and exact command.
"""

import json
import os

from deterministic_extraction import load_corpus, extract_case_state
from state_consistency_gate_v2 import (
    evaluate, ModelOutput, ModelOutputType, CommittedState,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

_VALID_OUTPUT_TYPES = {t.value for t in ModelOutputType}


def load_all_cases():
    cases = []
    for fname in ("cases.json", "cases_batch2.json", "cases_batch3.json", "cases_batch4.json"):
        with open(os.path.join(SCRIPT_DIR, fname), encoding="utf-8") as f:
            cases.extend(json.load(f)["cases"])
    return {c["case_id"]: c for c in cases}


def load_documents_by_id(corpus, doc_ids):
    return {did: corpus[did] for did in doc_ids}


RESPONSE_SCHEMA_INSTRUCTIONS = """You will be given source documents and a question about them. Respond with ONLY a single JSON object (no other text, no markdown fences) with these fields:

{
  "output_type": one of "ASSERTION", "HYPOTHESIS", "RECOMMENDATION", "PROPOSAL", "ACTION_REQUEST", "SUMMARY",
  "asserted_value": a short string naming the specific fact/value you are claiming (or null if you are not asserting a specific settled value -- e.g. when reporting that a conflict or unresolved state exists, or when your output_type is HYPOTHESIS/RECOMMENDATION/PROPOSAL),
  "claimed_scope": a short string naming what predicate/subject your answer is about (or null),
  "requested_authority_level": for ACTION_REQUEST only -- the authority tier being evaluated (e.g. "MANAGER", "DIRECTOR", "VP"), else null,
  "requested_amount": for ACTION_REQUEST only -- the numeric amount involved, else null
}

Definitions, so you choose output_type correctly:
- ASSERTION: you are stating something as a settled fact.
- HYPOTHESIS: you are stating a suspicion or inference, explicitly not confirmed.
- RECOMMENDATION or PROPOSAL: you are suggesting an action, not claiming a current fact.
- ACTION_REQUEST: you are evaluating whether a specific request/action is within someone's authority.
- SUMMARY: you are restating existing evidence without adding a new confident claim.

Do not state something as a settled fact (ASSERTION) unless the documents directly and currently support it. If sources conflict, or only weak/unconfirmed sources exist, or a document is unavailable, say so accurately rather than picking a side."""


def build_prompt(case, documents_by_id):
    doc_text = "\n\n".join(
        f"[{doc['id']}] ({doc.get('source_class', doc.get('type', 'unknown'))})\n{doc['content']}"
        for doc in documents_by_id.values()
    )
    return (
        f"{RESPONSE_SCHEMA_INSTRUCTIONS}\n\n"
        f"--- SOURCE DOCUMENTS ---\n{doc_text}\n\n"
        f"--- QUESTION ---\n{case['query']}\n\n"
        f"Respond with only the JSON object."
    )


class ModelResponseParseError(Exception):
    """Raised when a model's raw response can't be turned into a valid
    ModelOutput -- a real, expected failure mode once real models are in
    the loop (they might wrap JSON in prose despite instructions, use an
    invalid output_type, etc.), not swallowed silently."""


def parse_model_response(raw_text: str) -> ModelOutput:
    text = raw_text.strip()
    # Tolerate a model wrapping JSON in a markdown fence despite instructions.
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise ModelResponseParseError(f"response is not valid JSON: {e}. Raw: {raw_text[:200]!r}")

    output_type = data.get("output_type")
    if output_type not in _VALID_OUTPUT_TYPES:
        raise ModelResponseParseError(f"output_type {output_type!r} is not one of {sorted(_VALID_OUTPUT_TYPES)}")

    return ModelOutput(
        output_type=ModelOutputType(output_type),
        asserted_value=data.get("asserted_value"),
        claimed_scope=data.get("claimed_scope"),
        requested_authority_level=data.get("requested_authority_level"),
        requested_amount=data.get("requested_amount"),
    )


def mock_model_call(prompt: str) -> str:
    """No API call -- deterministically echoes back a plausible-shaped
    response for prompt/parsing-logic testing only. NEVER used for real
    results; exists so this file's own tests can verify build_prompt()
    and parse_model_response() without spending anything."""
    return '{"output_type": "ASSERTION", "asserted_value": "MOCK_VALUE", "claimed_scope": "mock scope", "requested_authority_level": null, "requested_amount": null}'


def anthropic_model_call(prompt: str, model: str = "claude-sonnet-5") -> str:
    """Real client. Reads ANTHROPIC_API_KEY from the environment -- this
    code never reads, prints, or logs the key itself, only passes the
    environment through to the SDK, which handles it internally. Not
    called by anything in this file automatically; the Trustee invokes
    this explicitly via run_x2_arm.py with their own key in their own
    environment. Requires `pip install anthropic`."""
    import anthropic  # imported lazily -- only needed for the real path
    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env automatically
    response = client.messages.create(
        model=model,
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


def run_x2_case(case, corpus, call_model_fn):
    """Full X2 arm for one case: real extraction (X1) + a real model call,
    classified directly into ModelOutput + the real gate (X6B-descended)."""
    documents_by_id = load_documents_by_id(corpus, case["grounding_document_ids"])
    prompt = build_prompt(case, documents_by_id)
    raw_response = call_model_fn(prompt)
    model_output = parse_model_response(raw_response)  # raises ModelResponseParseError, not swallowed
    extracted = extract_case_state(
        case["grounding_document_ids"], case["predicate"], corpus,
        compare_against_predicate=case.get("compare_against_predicate"),
    )
    decision = evaluate(extracted, model_output)
    return {
        "case_id": case["case_id"],
        "prompt_chars": len(prompt),
        "raw_response": raw_response,
        "parsed_output_type": model_output.output_type.value,
        "extracted_resolution": extracted.resolution.value,
        "extracted_claim_type": extracted.claim_type.value,
        "gate_outcome": decision.outcome.value,
        "gate_reason": decision.reason,
    }
