"""
The convergence engine: reconciles the four truth planes into exactly one
OperationalState per (aircraft, component, predicate, as_of) query,
per LNES60_PHYSICAL_TRUTH_ARCHITECTURE.md Section 3's governing principle:

    Verified physical evidence may invalidate a document-derived
    operational conclusion when the witness's identity, calibration,
    freshness, integrity, scope, and applicability are established.

Never SENSOR_ALWAYS_WINS. Never DOCUMENT_ALWAYS_WINS. This module is the
single place that principle is enforced -- every other module answers a
narrower question (is this one witness admissible, does this one field
match) and this one combines those answers.
"""

from dataclasses import dataclass
from typing import List, Optional

from .state_types import OperationalState, ConvergenceResult, DocumentaryRecord, CommandState
from .witness_types import PhysicalWitness, InvalidatingEvent
from .witness_validator import check_admissibility
from .temporal_resolver import resolve_documentary_chain, resolve_configuration_epoch
from .configuration_resolver import check_configuration


@dataclass
class ConvergenceQuery:
    aircraft_id: str
    component_id: Optional[str]
    predicate: str            # e.g. "tether.condition", "motor.identity", "pawl.geometry"
    claim_scope: str          # what witness scope would cover this predicate
    as_of: str
    documentary_record_ids: List[str]   # candidate documentary records for this predicate
    command_state_field: Optional[str]  # if this predicate is a config-checkable field
    witness_ids: List[str]              # candidate physical witnesses for this predicate


def converge(
    query: ConvergenceQuery,
    all_documentary: List[DocumentaryRecord],
    all_command: List[CommandState],
    all_witnesses: List[PhysicalWitness],
    all_events: List[InvalidatingEvent],
    seen_anti_replay_tokens: set,
) -> ConvergenceResult:
    contributing_planes: List[str] = []
    reason_codes: List[str] = []
    evidence_refs: List[str] = []

    # --- Documentary plane ---
    doc_record = resolve_documentary_chain(all_documentary, query.documentary_record_ids, query.as_of)
    if doc_record is not None:
        contributing_planes.append("documentary_state")
        evidence_refs.append(doc_record.record_id)

    # --- Configuration epoch (for command/digital comparisons) ---
    current_epoch = resolve_configuration_epoch(query.aircraft_id, query.component_id, query.as_of, all_events)

    # --- Physical witness plane: admissibility per candidate ---
    candidate_witnesses = [w for w in all_witnesses if w.reading_id in query.witness_ids]
    admissible: List[tuple] = []   # (witness, weight, health_degraded)
    inadmissible_states: List[OperationalState] = []

    for w in candidate_witnesses:
        result = check_admissibility(
            w, query.claim_scope, query.aircraft_id, query.component_id,
            query.as_of, all_events, seen_anti_replay_tokens,
        )
        reason_codes.extend(result.reason_codes)
        if result.admissible:
            admissible.append((w, result.weight, result.health_degraded))
            evidence_refs.append(w.reading_id)
        else:
            inadmissible_states.append(result.reason_state)

    if admissible:
        contributing_planes.append("physical_witness_state")
        contributing_planes.append("witness_trust_state")

    # --- Command/digital plane: configuration check, if applicable ---
    config_mismatch = False
    if query.command_state_field is not None:
        # Use the highest-weight admissible witness's measured value, if any.
        witness_value = None
        witness_for_config = None
        if admissible:
            witness_for_config = max(admissible, key=lambda t: t[1])[0]  # highest-weight
            witness_value = str(witness_for_config.value)
        config_result = check_configuration(
            all_command, query.command_state_field, witness_for_config, witness_value, current_epoch,
        )
        if not config_result.match:
            config_mismatch = True
            reason_codes.append(config_result.reason)
        contributing_planes.append("command_digital_state")

    # ============================================================
    # Reconciliation -- the governing principle applied.
    # Priority order below is deliberate and documented, not arbitrary:
    # configuration mismatches and admissible-sensor conflicts are
    # surfaced before falling back to "no evidence at all," because a
    # positive conflict is more informative than a completeness gap, and
    # the two are structurally distinguishable (INCOMPLETE means we never
    # got usable evidence; a conflict means we got usable evidence that
    # disagrees).
    # ============================================================

    if config_mismatch:
        return ConvergenceResult(
            OperationalState.CONFIGURATION_MISMATCH, query.aircraft_id, query.predicate,
            contributing_planes, {"type": "configuration"}, reason_codes, evidence_refs,
        )

    if len(admissible) >= 2:
        values = {str(w.value) for w, _wt, _hd in admissible}
        if len(values) > 1:
            # Two-or-more ADMISSIBLE, currently-trusted witnesses disagree.
            # Preserved as SENSOR_CONFLICT, never auto-resolved by picking
            # one (KTX test class H / failure taxonomy category 7).
            return ConvergenceResult(
                OperationalState.SENSOR_CONFLICT, query.aircraft_id, query.predicate,
                contributing_planes, {"type": "sensor_conflict", "values": sorted(values)}, reason_codes, evidence_refs,
            )

    if admissible:
        best_witness, best_weight, best_health_degraded = max(admissible, key=lambda t: t[1])
        witness_value = str(best_witness.value)

        if doc_record is not None:
            doc_says_bad = _documentary_indicates_defect(doc_record)
            witness_says_bad = _witness_indicates_defect(query.predicate, witness_value)
            if doc_says_bad != witness_says_bad:
                # Trusted physical evidence disagrees with the current
                # documentary conclusion. The documentary RECORD itself is
                # untouched (architecture doc Section 4) -- only the
                # current-state CONCLUSION is marked in conflict.
                return ConvergenceResult(
                    OperationalState.DOCUMENT_PHYSICAL_CONFLICT, query.aircraft_id, query.predicate,
                    contributing_planes,
                    {"type": "document_physical", "documentary_claim": doc_record.claim, "witness_value": witness_value},
                    reason_codes, evidence_refs,
                )

        if best_health_degraded:
            return ConvergenceResult(
                OperationalState.SENSOR_DEGRADED, query.aircraft_id, query.predicate,
                contributing_planes, {"type": "degraded", "weight": best_weight}, reason_codes, evidence_refs,
            )

        return ConvergenceResult(
            OperationalState.VERIFIED_MATCH, query.aircraft_id, query.predicate,
            contributing_planes, None, reason_codes, evidence_refs,
        )

    # No admissible physical evidence reached this point.
    if inadmissible_states:
        # We had candidate witnesses, but none were admissible -- surface
        # the SPECIFIC reason (failure taxonomy category 1: never a
        # generic catch-all), preferring the most specific/severe reason
        # when multiple candidates failed for different reasons.
        priority = [
            OperationalState.WITNESS_SCOPE_ERROR,
            OperationalState.STALE_WITNESS,
            OperationalState.UNVERIFIED,
        ]
        for state in priority:
            if state in inadmissible_states:
                return ConvergenceResult(
                    state, query.aircraft_id, query.predicate,
                    contributing_planes, {"type": "inadmissible_witness"}, reason_codes, evidence_refs,
                )

    if doc_record is not None:
        # Documentary-only: no physical evidence at all (admissible or
        # not) exists for this predicate. This is NOT automatically
        # VERIFIED_MATCH -- a document alone never converges to a
        # positive physical conclusion by itself (governing principle's
        # symmetric half: DOCUMENT_ALWAYS_WINS is equally forbidden).
        return ConvergenceResult(
            OperationalState.INCOMPLETE, query.aircraft_id, query.predicate,
            contributing_planes, {"type": "documentary_only", "documentary_claim": doc_record.claim},
            reason_codes, evidence_refs,
        )

    return ConvergenceResult(
        OperationalState.INCOMPLETE, query.aircraft_id, query.predicate,
        contributing_planes, {"type": "no_evidence"}, reason_codes, evidence_refs,
    )


def _documentary_indicates_defect(record: DocumentaryRecord) -> bool:
    return record.claim.upper() in ("DEFECT_CONFIRMED", "BAD", "OUT_OF_ENVELOPE", "UNSERVICEABLE")


def _witness_indicates_defect(predicate: str, value: str) -> bool:
    return value.upper() in ("BAD", "OUT_OF_ENVELOPE", "DEFECT", "FAIL")
