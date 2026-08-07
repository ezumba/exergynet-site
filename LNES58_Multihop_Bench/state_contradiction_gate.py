#!/usr/bin/env python3
"""
LNES-58.9 Phase 3: deterministic, non-generative state-contradiction gate.
No LLM call. No ground-truth inspection. Depends exclusively on:
  - resolver_state (MATCH / NO_MATCH / INCOMPLETE), already computed by the
    deterministic entity-graph traversal
  - the model's own structured (parsed JSON) output

Rules, exactly as specified:
  MATCH + model denies the committed relation           -> STATE_CONTRADICTION
  NO_MATCH (traversal_complete=true) + model asserts a
    relation in the same closed-world scope             -> STATE_CONTRADICTION
  INCOMPLETE                                             -> no deterministic
                                                             assertion either way
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class ContradictionDecision:
    consistency_decision: str  # "CONSISTENT" | "STATE_CONTRADICTION" | "NOT_ASSESSABLE"
    authorized_structured_state: Optional[dict]  # the deterministic-authority-corrected answer, or None if not assessable


def evaluate(resolver_state: str, traversal_complete: bool, parsed_model_output: Optional[dict]) -> ContradictionDecision:
    """Pure function. No LLM, no ground truth. `parsed_model_output` is the
    model's own structured JSON (schema: {"interacts": bool, ...}) -- may be
    None if the model's output wasn't schema-valid, in which case this gate
    cannot assess consistency (that's a different failure mode, not this
    gate's job to adjudicate)."""
    if parsed_model_output is None or "interacts" not in parsed_model_output:
        return ContradictionDecision("NOT_ASSESSABLE", None)

    model_asserts_relation = parsed_model_output.get("interacts") is True

    if resolver_state == "MATCH":
        if not model_asserts_relation:
            return ContradictionDecision(
                "STATE_CONTRADICTION",
                {**parsed_model_output, "interacts": True},  # deterministic state is authoritative
            )
        return ContradictionDecision("CONSISTENT", parsed_model_output)

    if resolver_state == "NO_MATCH" and traversal_complete:
        if model_asserts_relation:
            return ContradictionDecision(
                "STATE_CONTRADICTION",
                {**parsed_model_output, "interacts": False, "conflicting_drug": None},
            )
        return ContradictionDecision("CONSISTENT", parsed_model_output)

    # INCOMPLETE (or NO_MATCH with traversal_complete somehow false, which
    # the state machine should never produce, but handled defensively):
    # do not deterministically assert truth in either direction.
    return ContradictionDecision("NOT_ASSESSABLE", None)
