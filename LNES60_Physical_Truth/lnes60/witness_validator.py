"""
Deterministic witness admissibility check. Implements
LNES60_WITNESS_TRUST_MODEL.md Section 3's resolution logic exactly: a
reading is admissible only when every trust property holds, and when it
is NOT admissible, the SPECIFIC failing property determines which
resolution state is returned -- never a generic "not trusted" catch-all
(failure taxonomy category 1).

This module does not decide RELEASE_ELIGIBLE/HOLD -- see release_policy.py.
It answers a narrower question: is this specific reading usable as
evidence for a specific claim, and if not, why not.
"""

from dataclasses import dataclass
from typing import List, Optional

from .state_types import OperationalState
from .witness_types import PhysicalWitness, SensorHealth
from .temporal_resolver import is_stale


@dataclass
class AdmissibilityResult:
    admissible: bool
    reason_state: Optional[OperationalState]  # populated only when not admissible
    reason_codes: List[str]
    weight: float  # 0.0-1.0, meaningful only when admissible; a CONTINUOUS
                    # confidence score derived from uncertainty + health, used
                    # only to pick among multiple admissible witnesses.
                    # DELIBERATELY NOT used to decide SENSOR_DEGRADED -- see
                    # health_degraded below. (Dev-phase defect #1: any nonzero
                    # measurement_uncertainty, even well within nominal, was
                    # originally enough to push weight below 1.0 and get
                    # misclassified as SENSOR_DEGRADED, making VERIFIED_MATCH
                    # nearly unreachable for any realistically-uncertain
                    # sensor. Structural fix: weight and the DEGRADED
                    # classification are now independent.)
    health_degraded: bool = False  # True only when sensor_health == DEGRADED


def check_admissibility(
    witness: PhysicalWitness,
    claim_scope: str,
    claim_aircraft_id: str,
    claim_component_id: Optional[str],
    now: str,
    events: list,
    seen_anti_replay_tokens: set,
) -> AdmissibilityResult:
    """Evaluate one witness reading's admissibility for one specific claim.
    Checks properties in a fixed, documented order so the returned reason
    is deterministic and traceable -- not "whichever check happened to
    run first" by accident of code structure."""
    t = witness.trust
    codes: List[str] = []

    # 2.2 aircraft/component binding -- checked first, since a reading
    # bound to the wrong entity is inadmissible regardless of every other
    # property (KTX test class J/K).
    if t.aircraft_id != claim_aircraft_id:
        codes.append(f"WRONG_AIRCRAFT: witness bound to {t.aircraft_id}, claim is about {claim_aircraft_id}")
        return AdmissibilityResult(False, OperationalState.WITNESS_SCOPE_ERROR, codes, 0.0)
    if claim_component_id is not None and t.component_id != claim_component_id:
        codes.append(f"WRONG_COMPONENT: witness bound to {t.component_id}, claim is about {claim_component_id}")
        return AdmissibilityResult(False, OperationalState.WITNESS_SCOPE_ERROR, codes, 0.0)

    # 2.9 measurement scope -- does this reading actually cover the claim?
    if not _scope_covers(t.measurement_scope, claim_scope):
        codes.append(f"SCOPE_MISMATCH: witness scope '{t.measurement_scope}' does not cover claim '{claim_scope}'")
        return AdmissibilityResult(False, OperationalState.WITNESS_SCOPE_ERROR, codes, 0.0)

    # 2.5 hardware signature / integrity
    if not t.hardware_signature_valid:
        codes.append("INVALID_SIGNATURE: hardware signature/integrity check failed")
        return AdmissibilityResult(False, OperationalState.UNVERIFIED, codes, 0.0)

    # 2.6 anti-replay
    if t.anti_replay_token in seen_anti_replay_tokens or witness.replayed_from is not None:
        codes.append(f"REPLAY_DETECTED: anti_replay_token {t.anti_replay_token} already seen or reading flagged as replay")
        return AdmissibilityResult(False, OperationalState.STALE_WITNESS, codes, 0.0)

    # 2.3 calibration
    if not t.calibration_current:
        codes.append("CALIBRATION_EXPIRED: reading's calibration record is not current")
        return AdmissibilityResult(False, OperationalState.UNVERIFIED, codes, 0.0)

    # 2.4 freshness -- both clock-based and event-based (temporal_resolver)
    stale, stale_reason = is_stale(witness, now, events)
    if stale:
        codes.append(f"STALE: {stale_reason}")
        return AdmissibilityResult(False, OperationalState.STALE_WITNESS, codes, 0.0)

    # 2.8 sensor health -- failed sensors are never admissible; degraded
    # sensors are admissible but at reduced weight (SENSOR_DEGRADED is a
    # possible OUTCOME of convergence, not itself a rejection here).
    if t.sensor_health == SensorHealth.FAILED:
        codes.append("SENSOR_FAILED: sensor health status is FAILED")
        return AdmissibilityResult(False, OperationalState.UNVERIFIED, codes, 0.0)

    # Admissible. `weight` is a continuous confidence score (uncertainty-
    # derived) used ONLY to pick among multiple admissible witnesses when
    # more than one is available -- it never by itself determines
    # SENSOR_DEGRADED. `health_degraded` is the sole, discrete signal for
    # that classification, set only from sensor_health itself. A NOMINAL
    # sensor with realistic nonzero measurement_uncertainty (the normal
    # case) is admissible at less than weight=1.0 without being
    # misclassified as degraded.
    health_degraded = t.sensor_health == SensorHealth.DEGRADED
    if health_degraded:
        codes.append("SENSOR_DEGRADED: sensor_health is DEGRADED, still admissible")
    weight = max(0.0, 1.0 - min(1.0, t.measurement_uncertainty))

    return AdmissibilityResult(True, None, codes, weight, health_degraded)


def _scope_covers(witness_scope: str, claim_scope: str) -> bool:
    """A witness scope covers a claim scope if they're identical, or the
    witness scope is a dotted-prefix ancestor of the claim scope (e.g.
    'tether' covers 'tether.elongation') -- but NEVER the reverse: a
    narrow witness scope does not cover a broader claim (KTX test class 8,
    "known damage contradicted by a limited-scope GOOD sensor reading" --
    the narrow reading must not be treated as covering the broad claim)."""
    if witness_scope == claim_scope:
        return True
    return claim_scope.startswith(witness_scope + ".")
