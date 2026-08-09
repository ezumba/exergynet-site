"""
LNES-60 Phase 2 — Scope validator.

Checks that the witness packet's aircraft_id, component_id, and measurement_type
are consistent with the registered bindings for this device and the predicate
under evaluation.

Key distinction: a valid signature does NOT imply correct scope. A packet signed
by TETHER-2's key that claims to cover TETHER-1 has a valid signature but invalid
scope. These are separate checks.

Predicate-to-measurement-type mapping is an ENGINEERING_ENVELOPE configuration.
No hardcoded predicate values.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional, Set

from .key_registry import KeyRegistry
from .packet_types import WitnessPacket


@dataclass
class ScopeResult:
    passed: bool
    failure_code: Optional[str]
    detail: Optional[str]


class PredicateMeasurementRegistry:
    """
    Maps evaluation predicates to the set of measurement_types that satisfy them.
    Configuration is ENGINEERING_ENVELOPE / SYNTHETIC_TEST_VALUE — no hardcoded values.

    Example: predicate "tether.elongation" requires measurement_type in
    {"tether.elongation", "tether.strain"} (policy-defined set).
    """

    def __init__(self) -> None:
        self._mappings: Dict[str, Set[str]] = {}

    def register(self, predicate: str, measurement_types: Set[str]) -> None:
        self._mappings[predicate] = set(measurement_types)

    def covers(self, predicate: str, measurement_type: str) -> bool:
        """True if measurement_type is admitted for this predicate."""
        allowed = self._mappings.get(predicate)
        if allowed is None:
            return False
        return measurement_type in allowed

    def is_predicate_known(self, predicate: str) -> bool:
        return predicate in self._mappings


def validate_scope(
    packet: WitnessPacket,
    key_registry: KeyRegistry,
    predicate: str,
    claim_aircraft_id: str,
    claim_component_id: str,
    predicate_registry: PredicateMeasurementRegistry,
) -> ScopeResult:
    """
    Validate that this packet's scope covers the claim under evaluation.

    Three sub-checks:
      1. Aircraft binding: packet.aircraft_id == claim_aircraft_id
      2. Component binding: packet.component_id == claim_component_id
      3. Measurement scope: measurement_type covers the predicate
    """
    # 1. Aircraft binding
    if packet.aircraft_id != claim_aircraft_id:
        return ScopeResult(
            passed=False,
            failure_code="WRONG_AIRCRAFT",
            detail=(
                f"Packet aircraft_id {packet.aircraft_id!r} does not match "
                f"claim target {claim_aircraft_id!r}"
            ),
        )

    # 2. Component binding
    if packet.component_id != claim_component_id:
        return ScopeResult(
            passed=False,
            failure_code="WRONG_COMPONENT",
            detail=(
                f"Packet component_id {packet.component_id!r} does not match "
                f"claim component {claim_component_id!r}"
            ),
        )

    # Cross-check: device registered binding vs packet claims
    reg = key_registry.get_registration(packet.witness_device_id)
    if reg is not None:
        if reg.aircraft_id != packet.aircraft_id:
            return ScopeResult(
                passed=False,
                failure_code="DEVICE_AIRCRAFT_BINDING_MISMATCH",
                detail=(
                    f"Device {packet.witness_device_id!r} is registered to aircraft "
                    f"{reg.aircraft_id!r} but packet claims {packet.aircraft_id!r}"
                ),
            )
        if reg.component_id != packet.component_id:
            return ScopeResult(
                passed=False,
                failure_code="DEVICE_COMPONENT_BINDING_MISMATCH",
                detail=(
                    f"Device {packet.witness_device_id!r} is registered to component "
                    f"{reg.component_id!r} but packet claims {packet.component_id!r}"
                ),
            )

    # 3. Measurement scope vs predicate
    if not predicate_registry.is_predicate_known(predicate):
        return ScopeResult(
            passed=False,
            failure_code="UNKNOWN_PREDICATE",
            detail=f"Predicate {predicate!r} is not registered in predicate_measurement_registry",
        )

    if not predicate_registry.covers(predicate, packet.measurement_type):
        return ScopeResult(
            passed=False,
            failure_code="SCOPE_MISMATCH",
            detail=(
                f"measurement_type {packet.measurement_type!r} does not cover "
                f"predicate {predicate!r}"
            ),
        )

    return ScopeResult(passed=True, failure_code=None, detail=None)
