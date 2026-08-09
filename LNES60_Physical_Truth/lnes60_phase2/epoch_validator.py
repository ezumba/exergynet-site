"""
LNES-60 Phase 2 — Configuration epoch validator.

The configuration epoch identifies a specific hardware/software configuration
version for an aircraft/component pair. A packet from EPOCH_0 is inadmissible
when the commanded state is EPOCH_1 — even if all other trust properties pass.

This validator checks that the packet's configuration_epoch matches the current
commanded configuration epoch for the aircraft/component under evaluation.

Epoch management is an ENGINEERING_ENVELOPE responsibility. No epoch strings
are hardcoded in this module.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from .packet_types import WitnessPacket


@dataclass
class EpochResult:
    passed: bool
    failure_code: Optional[str]
    detail: Optional[str]


class EpochRegistry:
    """
    Tracks the current commanded configuration epoch per (aircraft_id, component_id).
    Bench use only — not persistent.
    """

    def __init__(self) -> None:
        self._epochs: Dict[Tuple[str, str], str] = {}

    def set_epoch(self, aircraft_id: str, component_id: str, epoch: str) -> None:
        self._epochs[(aircraft_id, component_id)] = epoch

    def get_epoch(self, aircraft_id: str, component_id: str) -> Optional[str]:
        return self._epochs.get((aircraft_id, component_id))


def validate_epoch(
    packet: WitnessPacket,
    epoch_registry: EpochRegistry,
) -> EpochResult:
    """
    Validate that the packet's configuration_epoch matches the commanded epoch
    for this aircraft/component pair.
    """
    commanded = epoch_registry.get_epoch(packet.aircraft_id, packet.component_id)

    if commanded is None:
        return EpochResult(
            passed=False,
            failure_code="EPOCH_UNKNOWN",
            detail=(
                f"No commanded epoch registered for aircraft {packet.aircraft_id!r} "
                f"component {packet.component_id!r}"
            ),
        )

    if packet.configuration_epoch != commanded:
        return EpochResult(
            passed=False,
            failure_code="EPOCH_MISMATCH",
            detail=(
                f"Packet configuration_epoch {packet.configuration_epoch!r} does not "
                f"match commanded epoch {commanded!r} for aircraft "
                f"{packet.aircraft_id!r} component {packet.component_id!r}"
            ),
        )

    return EpochResult(passed=True, failure_code=None, detail=None)
