"""
LNES-60 Phase 2 — Calibration validator.

Checks:
  1. Calibration hash matches the registered calibration record for this sensor
  2. Calibration is not expired relative to the measurement timestamp

All calibration expiry windows are ENGINEERING_ENVELOPE parameters configured
per sensor type in the registry — no numeric thresholds are hardcoded here.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional

from .packet_types import WitnessPacket


@dataclass
class CalibrationRecord:
    """Registered calibration record for a sensor."""
    sensor_id: str
    calibration_hash: str       # SHA-256 hex
    calibration_valid_until: str  # ISO 8601 UTC
    label: str = "ENGINEERING_ENVELOPE / SYNTHETIC_TEST_VALUE"


@dataclass
class CalibrationResult:
    passed: bool
    failure_code: Optional[str]
    detail: Optional[str]


class CalibrationRegistry:
    """In-memory calibration record store. Bench use only."""

    def __init__(self) -> None:
        self._records: Dict[str, CalibrationRecord] = {}  # sensor_id → record

    def register(self, record: CalibrationRecord) -> None:
        self._records[record.sensor_id] = record

    def get(self, sensor_id: str) -> Optional[CalibrationRecord]:
        return self._records.get(sensor_id)


def validate_calibration(
    packet: WitnessPacket,
    registry: CalibrationRegistry,
) -> CalibrationResult:
    """
    Validate calibration hash and expiry for a witness packet.

    Uses the measurement_timestamp from the packet to determine if the
    calibration_valid_until window was still open at measurement time.
    """
    record = registry.get(packet.sensor_id)
    if record is None:
        return CalibrationResult(
            passed=False,
            failure_code="CALIBRATION_UNKNOWN",
            detail=f"No calibration record registered for sensor_id {packet.sensor_id!r}",
        )

    if packet.calibration_record_hash != record.calibration_hash:
        return CalibrationResult(
            passed=False,
            failure_code="CALIBRATION_HASH_MISMATCH",
            detail=(
                f"Packet calibration_record_hash {packet.calibration_record_hash!r} "
                f"does not match registered hash {record.calibration_hash!r} "
                f"for sensor {packet.sensor_id!r}"
            ),
        )

    # Expiry check: calibration_valid_until (from packet) must be >= measurement_timestamp.
    # We use ISO 8601 string comparison — valid because both are UTC and zero-padded.
    if packet.calibration_valid_until < packet.measurement_timestamp:
        return CalibrationResult(
            passed=False,
            failure_code="CALIBRATION_EXPIRED",
            detail=(
                f"Calibration expired at {packet.calibration_valid_until!r}; "
                f"measurement taken at {packet.measurement_timestamp!r}"
            ),
        )

    # Cross-check: packet's calibration_valid_until must also match registry record.
    if packet.calibration_valid_until != record.calibration_valid_until:
        return CalibrationResult(
            passed=False,
            failure_code="CALIBRATION_VALIDITY_MISMATCH",
            detail=(
                f"Packet calibration_valid_until {packet.calibration_valid_until!r} "
                f"does not match registered value {record.calibration_valid_until!r}"
            ),
        )

    return CalibrationResult(passed=True, failure_code=None, detail=None)
