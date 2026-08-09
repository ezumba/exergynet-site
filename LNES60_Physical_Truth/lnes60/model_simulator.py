"""
MODEL_SIMULATOR: RULE_BASED_REFERENCE, NOT AN LLM.

This module stands in for "a model" in the P0/P1/P2 arms, per the
directive's explicit fallback instruction: "If the existing generation
mechanism cannot support the full experiment: use deterministic
simulator-only testing for state-engine components AND clearly separate
DETERMINISTIC HARNESS RESULT from MODEL-IN-THE-LOOP RESULT. Do not
fabricate model results."

Why this exists: the Agent-tool subagent-dispatch mechanism used for
LNES-59's real-model generation was already exhausted (200/200 spawned)
earlier in this same session, and running 150 holdout cases x 2-3 arms
of real self-generated reasoning (the fallback used for LNES-59's tail)
was judged impractical at this scale within one continuous session. Every
result produced via this module is labeled DETERMINISTIC HARNESS RESULT
throughout raw output, the evaluator, and the final report -- it is never
presented as, or scored alongside, a claim of real-model performance.

Design intent: NOT adversarially bad, NOT the frozen convergence engine
in disguise. It is a plausible, good-faith, IMPERFECT interpreter --
representative of an ungoverned reader that takes evidence at
face value without systematically tracking every trust property (P1) or
without recognizing that a document alone cannot confirm physical state
(P0). Its specific blind spots are documented below, not hidden.
"""

from .state_types import ReleaseRecommendation


SIMULATOR_LABEL = "MODEL_SIMULATOR: RULE_BASED_REFERENCE, NOT AN LLM"


def p0_candidate(case_dict: dict) -> dict:
    """P0: documentary + command state only, NO physical witnesses.
    Blind spot (by design, representative of naive document-trust): if a
    documentary record states a positive claim (SERVICEABLE) and nothing
    contradicts it *within the documents themselves*, recommend RELEASE
    -- it does NOT recognize "no physical confirmation exists" as a
    reason to withhold release. This is the P0 hypothesis under test:
    does reliance on records without physical evidence produce unsafe
    releases."""
    docs = case_dict.get("documentary", [])
    if not docs:
        return _out("INCOMPLETE", ReleaseRecommendation.INCOMPLETE, ["no documentary record available"])
    latest = max(docs, key=lambda d: d["event_time"])
    claim = latest["claim"].upper()
    if claim in ("DEFECT_CONFIRMED", "BAD", "OUT_OF_ENVELOPE", "UNSERVICEABLE"):
        return _out("DOCUMENT_PHYSICAL_CONFLICT", ReleaseRecommendation.HOLD,
                    [f"documentary record states {claim}"])
    return _out("VERIFIED_MATCH", ReleaseRecommendation.RELEASE_ELIGIBLE,
                [f"documentary record states {claim}; no physical evidence was provided to this arm to check against"])


def p1_candidate(case_dict: dict) -> dict:
    """P1: documentary + command + RAW physical witnesses, un-governed.
    Blind spots (by design): reads witness.value at face value without
    systematically checking calibration_current, measurement_scope
    coverage, anti_replay/replayed_from, sensor_health, or
    configuration_epoch currency against command state -- it notices an
    OUTRIGHT aircraft/component ID mismatch (a very salient textual cue)
    but does not reliably catch the subtler trust failures a governed
    pipeline catches deterministically. This is the P1 hypothesis under
    test: does simply exposing raw telemetry to an ungoverned reader
    solve the problem, or do subtler trust failures slip through."""
    docs = case_dict.get("documentary", [])
    witnesses = case_dict.get("witnesses", [])
    command = case_dict.get("command", [])
    aircraft_id = case_dict["aircraft_id"]
    component_id = case_dict["component_id"]

    # Salient cue: aircraft/component ID textually visible and mismatched.
    for w in witnesses:
        t = w["trust"]
        if t["aircraft_id"] != aircraft_id or t["component_id"] != component_id:
            return _out("WITNESS_SCOPE_ERROR", ReleaseRecommendation.HOLD,
                        [f"witness bound to a different aircraft/component ({t['aircraft_id']}/{t['component_id']})"])

    # Command/digital field check -- naive value comparison, does NOT
    # check the witness's configuration_epoch against current epoch.
    if case_dict.get("command_field"):
        field = case_dict["command_field"]
        relevant_cmd = [c for c in command if c["field"] == field]
        relevant_w = [w for w in witnesses if w["measurement_type"] in ("hardware_id", "firmware_version")]
        if relevant_cmd and relevant_w:
            expected = relevant_cmd[-1]["value"]
            actual = str(relevant_w[0]["value"])
            if str(expected) != actual:
                return _out("CONFIGURATION_MISMATCH", ReleaseRecommendation.HOLD,
                            [f"expected {field}={expected}, witness reports {actual}"])
            # naive pass-through: value matches, arm does NOT check epoch currency
            return _out("VERIFIED_MATCH", ReleaseRecommendation.RELEASE_ELIGIBLE,
                        [f"{field} value matches expected (epoch currency not checked by this arm)"])

    # Multiple witnesses with different values for the same reading -> conflict is noticed.
    values = {str(w["value"]) for w in witnesses}
    if len(values) > 1:
        return _out("SENSOR_CONFLICT", ReleaseRecommendation.HOLD,
                    [f"witnesses report conflicting values: {sorted(values)}"])

    if witnesses:
        w = witnesses[0]
        val = str(w["value"]).upper()
        # naive value read -- does not check calibration_current, scope
        # coverage, sensor_health, anti_replay, or freshness.
        if val in ("BAD", "OUT_OF_ENVELOPE", "DEFECT", "FAIL"):
            doc_claim = docs[-1]["claim"].upper() if docs else None
            if doc_claim in ("SERVICEABLE",) or doc_claim is None:
                return _out("DOCUMENT_PHYSICAL_CONFLICT", ReleaseRecommendation.HOLD,
                            [f"witness reports {val}"])
            return _out("DOCUMENT_PHYSICAL_CONFLICT", ReleaseRecommendation.HOLD, [f"witness reports {val}, consistent with document"])
        return _out("VERIFIED_MATCH", ReleaseRecommendation.RELEASE_ELIGIBLE,
                    [f"witness reports {val}, taken at face value"])

    if docs:
        return p0_candidate(case_dict)

    return _out("INCOMPLETE", ReleaseRecommendation.INCOMPLETE, ["no documentary or physical evidence"])


def p2_candidate_from_converged_state(operational_state: str, conflict_detail) -> dict:
    """P2's model-facing step: given the ALREADY-CONVERGED operational
    state (not raw evidence), produce a candidate decision. Because the
    state description is unambiguous and already resolved, this mapping
    is close to deterministic -- which is itself an expected, disclosed
    property of the design (LNES60_XLMP_LNES22_HANDSHAKE.md: the
    handshake payload is a resolved fact, not evidence for a model to
    re-interpret). Recorded as the pre-gate CANDIDATE decision, separate
    from the post-gate AUTHORIZED decision (release_policy.py) -- per the
    directive, these must never be conflated."""
    mapping = {
        "VERIFIED_MATCH": ReleaseRecommendation.RELEASE_ELIGIBLE,
        "DOCUMENT_PHYSICAL_CONFLICT": ReleaseRecommendation.HOLD,
        "CONFIGURATION_MISMATCH": ReleaseRecommendation.HOLD,
        "SENSOR_CONFLICT": ReleaseRecommendation.HOLD,
        "SENSOR_DEGRADED": ReleaseRecommendation.HOLD,
        "STALE_WITNESS": ReleaseRecommendation.HOLD,
        "WITNESS_SCOPE_ERROR": ReleaseRecommendation.HOLD,
        "UNVERIFIED": ReleaseRecommendation.INCOMPLETE,
        "INCOMPLETE": ReleaseRecommendation.INCOMPLETE,
    }
    return _out(operational_state, mapping.get(operational_state, ReleaseRecommendation.INCOMPLETE),
                [f"converged state: {operational_state}"])


def _out(operational_state, release, reason_codes):
    return {
        "model_label": SIMULATOR_LABEL,
        "operational_state": operational_state,
        "release_recommendation": release.value if hasattr(release, "value") else release,
        "reason_codes": reason_codes,
    }
