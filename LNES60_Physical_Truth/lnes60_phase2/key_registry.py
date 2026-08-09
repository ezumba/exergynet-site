"""
LNES-60 Phase 2 — In-memory key registry for bench testing.

This registry is a LOCAL BENCH TOOL ONLY. It holds Ed25519 public keys,
firmware hashes, sensor-to-device bindings, and aircraft-to-component bindings.

PRODUCTION NOTE: A production key registry would be backed by a hardware
security module or a signed, auditable device certificate store. This
implementation is for bench validation only.

TEST KEY DISCLAIMER: All keys registered via register_test_key() are labeled
TEST_KEY_ONLY. Private keys must never appear in this registry or in any log.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Optional, Set, Tuple


@dataclass
class DeviceRegistration:
    """Single registered witness device."""
    witness_device_id: str
    sensor_id: str
    aircraft_id: str
    component_id: str
    public_key_bytes: bytes         # Ed25519 public key (32 bytes)
    key_label: str                  # TEST_KEY_ONLY for bench keys
    registered_firmware_hash: str   # SHA-256 hex of authorized firmware
    is_revoked: bool = False


class KeyRegistry:
    """
    In-memory key registry. Thread-unsafe — bench use only.

    Lookup hierarchy: witness_device_id → DeviceRegistration.
    Scope validation (aircraft/component binding) is also handled here.
    """

    def __init__(self) -> None:
        self._devices: Dict[str, DeviceRegistration] = {}

    def register_device(self, registration: DeviceRegistration) -> None:
        self._devices[registration.witness_device_id] = registration

    def register_test_key(
        self,
        witness_device_id: str,
        sensor_id: str,
        aircraft_id: str,
        component_id: str,
        public_key_bytes: bytes,
        firmware_hash: str,
    ) -> None:
        """Register an ephemeral TEST_KEY_ONLY device. Never use production keys."""
        self.register_device(DeviceRegistration(
            witness_device_id=witness_device_id,
            sensor_id=sensor_id,
            aircraft_id=aircraft_id,
            component_id=component_id,
            public_key_bytes=public_key_bytes,
            key_label="TEST_KEY_ONLY",
            registered_firmware_hash=firmware_hash,
        ))

    def get_public_key(self, witness_device_id: str) -> Optional[bytes]:
        """Return the registered Ed25519 public key bytes, or None if unknown/revoked."""
        reg = self._devices.get(witness_device_id)
        if reg is None or reg.is_revoked:
            return None
        return reg.public_key_bytes

    def get_registration(self, witness_device_id: str) -> Optional[DeviceRegistration]:
        reg = self._devices.get(witness_device_id)
        if reg is None or reg.is_revoked:
            return None
        return reg

    def revoke_device(self, witness_device_id: str) -> None:
        if witness_device_id in self._devices:
            self._devices[witness_device_id].is_revoked = True

    def is_known(self, witness_device_id: str) -> bool:
        return witness_device_id in self._devices

    def get_registered_firmware_hash(self, witness_device_id: str) -> Optional[str]:
        reg = self.get_registration(witness_device_id)
        return reg.registered_firmware_hash if reg else None
