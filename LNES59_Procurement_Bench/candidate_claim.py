"""
LNES-59.2B shared CandidateClaim format (comparator spec section 13). All
8 arms produce this SAME structured shape so the evaluator doesn't have
to infer different semantics from eight unrelated response formats. Raw
prose is always preserved alongside the structured fields.

For X1/X2 specifically, `to_model_output()` deterministically maps a
CandidateClaim to state_consistency_gate_v2.ModelOutput -- a pure,
frozen, post-hoc code transformation. This file is NEW, written after
the V7 freeze; it does not modify state_consistency_gate_v2.py or
deterministic_extraction.py in any way, and the frozen gate's evaluate()
signature/behavior is completely unchanged -- it never sees a
CandidateClaim, only ever a ModelOutput, exactly as before.
"""

CLAIM_TYPES = ("FACT", "HYPOTHESIS", "RECOMMENDATION", "ACTION_REQUEST", "SUMMARY_OF_UNCERTAINTY")

CANDIDATE_CLAIM_SCHEMA_INSTRUCTIONS = """You will be given source material and a question. Respond with ONLY a single JSON object (no other text, no markdown fences) with these fields:

{
  "subject": short string naming what entity/record this is about (e.g. a vendor or PO id), or null,
  "predicate": short string naming what specific fact/attribute is being asked about, or null,
  "canonical_value": a short, machine-normalized value string for your answer (e.g. "21500", "ACTIVE", "NOT_IN_REGISTRY"), or null if you are not asserting a specific settled value,
  "displayed_value": a short human-readable version of your answer/explanation,
  "claim_type": one of "FACT", "HYPOTHESIS", "RECOMMENDATION", "ACTION_REQUEST", "SUMMARY_OF_UNCERTAINTY",
  "scope": short string naming the source/system your answer is scoped to, or null,
  "effective_time": short string describing when your claimed value is/was in force (e.g. "current", "historical", "future", "unknown"), or null,
  "confidence_or_uncertainty": short string describing your confidence (e.g. "confirmed by an authoritative record", "unconfirmed rumor", "system was unavailable", "conflicting sources found"),
  "requested_authority_level": for ACTION_REQUEST only -- the authority tier being evaluated (e.g. "MANAGER", "DIRECTOR", "VP"), else null,
  "requested_amount": for ACTION_REQUEST only -- the numeric amount involved, else null,
  "raw_prose": your full free-text answer, in your own words
}

Definitions, so you choose claim_type correctly:
- FACT: you are stating something as a settled, currently-true fact (this also covers a scoped negative finding, e.g. "not in the registry" -- that IS a fact about the registry).
- HYPOTHESIS: you are stating a suspicion or inference, explicitly not confirmed.
- RECOMMENDATION: you are suggesting an action or next step, not claiming a current fact.
- ACTION_REQUEST: you are evaluating whether a specific request/action is within someone's authority.
- SUMMARY_OF_UNCERTAINTY: you are accurately reporting that the evidence is incomplete, conflicting, or only weakly sourced, without asserting a specific value as settled.

Do not state something as FACT unless the material directly and currently supports it. If sources conflict, are unavailable, or only weakly/unconfirmed source a claim, use SUMMARY_OF_UNCERTAINTY (or HYPOTHESIS/RECOMMENDATION as appropriate) instead of FACT."""


class CandidateClaimParseError(Exception):
    pass


def parse_candidate_claim(raw_text):
    import json
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise CandidateClaimParseError(f"response is not valid JSON: {e}. Raw: {raw_text[:200]!r}")
    claim_type = data.get("claim_type")
    if claim_type not in CLAIM_TYPES:
        raise CandidateClaimParseError(f"claim_type {claim_type!r} is not one of {CLAIM_TYPES}")
    requested_amount = data.get("requested_amount")
    if isinstance(requested_amount, str):
        # Infrastructure robustness fix (LNES-59.2B execution, H15::X2): a model
        # sometimes emits a numeric-looking string ("50001") instead of a JSON
        # number for this field. The frozen gate's ACTION_REQUEST comparison
        # (requested_amount > limit) requires a real number -- this coercion
        # happens here, before the gate, and never touches
        # state_consistency_gate_v2.py or changes what value is being compared,
        # only its Python type. Semantically neutral: same value, correct type.
        try:
            requested_amount = int(requested_amount)
        except ValueError:
            try:
                requested_amount = float(requested_amount)
            except ValueError:
                pass  # leave as-is; the gate's own None-check will surface it as INDETERMINATE
    return {
        "subject": data.get("subject"),
        "predicate": data.get("predicate"),
        "canonical_value": data.get("canonical_value"),
        "displayed_value": data.get("displayed_value"),
        "claim_type": claim_type,
        "scope": data.get("scope"),
        "effective_time": data.get("effective_time"),
        "confidence_or_uncertainty": data.get("confidence_or_uncertainty"),
        "requested_authority_level": data.get("requested_authority_level"),
        "requested_amount": requested_amount,
        "raw_prose": data.get("raw_prose"),
    }


def to_model_output(claim):
    """Deterministic CandidateClaim -> ModelOutput mapping, used only by
    X1/X2 (the only arms that feed the frozen V7 gate). Pure code, no
    model call -- the model already produced the CandidateClaim; this
    just reshapes it for evaluate()'s existing, unchanged interface."""
    from state_consistency_gate_v2 import ModelOutput, ModelOutputType

    mapping = {
        "FACT": ModelOutputType.ASSERTION,
        "HYPOTHESIS": ModelOutputType.HYPOTHESIS,
        "RECOMMENDATION": ModelOutputType.RECOMMENDATION,
        "ACTION_REQUEST": ModelOutputType.ACTION_REQUEST,
        "SUMMARY_OF_UNCERTAINTY": ModelOutputType.SUMMARY,
    }
    output_type = mapping[claim["claim_type"]]
    asserted_value = claim["canonical_value"] if output_type in (ModelOutputType.ASSERTION,) else None
    if output_type == ModelOutputType.SUMMARY:
        asserted_value = None  # SUMMARY is always an honest hedge in this mapping, per claim_type's own definition
    return ModelOutput(
        output_type=output_type,
        asserted_value=asserted_value,
        claimed_scope=claim.get("scope") or claim.get("predicate"),
        requested_authority_level=claim.get("requested_authority_level"),
        requested_amount=claim.get("requested_amount"),
    )
