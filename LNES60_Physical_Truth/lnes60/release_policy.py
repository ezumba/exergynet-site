"""
Simulated LNES-22 release-policy gate. Phase 1 software simulation only --
per LNES60_XLMP_LNES22_HANDSHAKE.md, this consumes RESOLVED convergence
state, never raw evidence, and never model reasoning. No ignition, no
ESC commands, no NEURO-LOCK actuation, no aircraft control anywhere in
this module or its callers.
"""

from dataclasses import dataclass
from typing import List, Optional

from .state_types import OperationalState, ConvergenceResult, ReleaseRecommendation, ReleasePolicyResult

# Priority order used when aggregating multiple predicates' convergence
# results into one release decision: the first state in this list that
# appears among the results determines the release recommendation's
# governing reason. Documented, not arbitrary -- a positive conflict
# outranks a mere completeness gap, and different conflict types are
# reported in a fixed, auditable order.
_HOLD_PRIORITY = [
    OperationalState.CONFIGURATION_MISMATCH,
    OperationalState.DOCUMENT_PHYSICAL_CONFLICT,
    OperationalState.SENSOR_CONFLICT,
    OperationalState.WITNESS_SCOPE_ERROR,
    OperationalState.STALE_WITNESS,
    OperationalState.UNVERIFIED,
    OperationalState.SENSOR_DEGRADED,
]


@dataclass
class MissionEnvelopeCheck:
    within_approved_configuration: bool
    reason: str = ""


def evaluate_release(
    convergence_results: List[ConvergenceResult],
    mission_envelope: Optional[MissionEnvelopeCheck] = None,
) -> ReleasePolicyResult:
    """Aggregate per-predicate convergence results into one release
    decision. LNES-22 must not upgrade a HOLD/INCOMPLETE by applying its
    own separate physical-state judgment (handshake doc Section 3) --
    this function performs no re-interpretation of evidence, only a
    documented priority reduction over already-resolved states."""
    reason_codes: List[str] = []

    if mission_envelope is not None and not mission_envelope.within_approved_configuration:
        reason_codes.append(f"MISSION_ENVELOPE_VIOLATION: {mission_envelope.reason}")
        return ReleasePolicyResult(
            ReleaseRecommendation.HOLD, reason_codes,
            "Mission profile exceeds validated aircraft configuration -- hardware "
            "may be individually healthy, but the requested mission is not "
            "authorized for this configuration.",
        )

    states_present = {r.operational_state for r in convergence_results}

    for hold_state in _HOLD_PRIORITY:
        if hold_state in states_present:
            offending = [r for r in convergence_results if r.operational_state == hold_state]
            reason_codes.extend(
                f"{hold_state.value} on predicate '{r.predicate}'" for r in offending
            )
            return ReleasePolicyResult(
                ReleaseRecommendation.HOLD, reason_codes,
                f"At least one predicate resolved to {hold_state.value}, which per "
                f"the frozen priority order requires HOLD pending resolution -- the "
                f"conflict is not silently overridden by other predicates' good state.",
            )

    if OperationalState.INCOMPLETE in states_present:
        offending = [r for r in convergence_results if r.operational_state == OperationalState.INCOMPLETE]
        reason_codes.extend(f"INCOMPLETE on predicate '{r.predicate}'" for r in offending)
        return ReleasePolicyResult(
            ReleaseRecommendation.INCOMPLETE, reason_codes,
            "At least one required predicate has no admissible evidence -- "
            "release eligibility cannot be determined, distinct from an "
            "active HOLD-worthy conflict.",
        )

    if states_present and states_present <= {OperationalState.VERIFIED_MATCH}:
        return ReleasePolicyResult(
            ReleaseRecommendation.RELEASE_ELIGIBLE, reason_codes,
            "All evaluated predicates converged to VERIFIED_MATCH and the mission "
            "envelope check (if provided) passed. This is an ENGINEERING "
            "authorization output only -- it is not autonomous regulatory "
            "return-to-service and does not substitute for any legally "
            "required inspection or human signoff.",
        )

    # No predicates were evaluated at all.
    return ReleasePolicyResult(
        ReleaseRecommendation.INCOMPLETE, ["NO_PREDICATES_EVALUATED"],
        "No predicates were submitted for evaluation.",
    )
