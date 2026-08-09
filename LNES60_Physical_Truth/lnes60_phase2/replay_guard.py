"""
LNES-60 Phase 2 — Replay guard.

Tracks per-device nonces and sequence numbers. Also verifies chain hash
continuity (previous_witness_hash field). All state is in-memory; a production
implementation would persist state to survive restarts.

Three independent anti-replay mechanisms:
  1. Nonce uniqueness (per device)
  2. Sequence number monotonicity (per device)
  3. Chain hash continuity (previous_witness_hash vs stored last hash)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Optional, Set, Tuple

from .canonicalize import packet_chain_hash
from .packet_types import WitnessPacket


@dataclass
class ReplayResult:
    passed: bool
    failure_code: Optional[str]  # None if passed
    detail: Optional[str]


class ReplayGuard:
    """
    Per-device nonce + sequence + chain state tracker.
    Not thread-safe — bench use only.
    """

    def __init__(self) -> None:
        self._seen_nonces: Dict[str, Set[str]] = {}           # device_id → set of nonces
        self._last_sequence: Dict[str, int] = {}              # device_id → last seq
        self._last_chain_hash: Dict[str, Optional[str]] = {}  # device_id → last hash

    def check_and_record(self, packet: WitnessPacket) -> ReplayResult:
        """
        Validate replay properties and update state.
        Checks are ordered: nonce → sequence → chain.
        Fails fast on the first violation.
        State is NOT updated if any check fails.
        """
        device_id = packet.witness_device_id

        # 1. Nonce uniqueness
        seen = self._seen_nonces.get(device_id, set())
        if packet.nonce in seen:
            return ReplayResult(
                passed=False,
                failure_code="REPLAY_DETECTED",
                detail=f"Nonce {packet.nonce!r} already seen for device {device_id!r}",
            )

        # 2. Sequence monotonicity
        last_seq = self._last_sequence.get(device_id)
        if last_seq is not None and packet.sequence_number <= last_seq:
            return ReplayResult(
                passed=False,
                failure_code="SEQUENCE_ROLLBACK",
                detail=(
                    f"sequence_number {packet.sequence_number} <= last seen "
                    f"{last_seq} for device {device_id!r}"
                ),
            )

        # 3. Chain hash continuity
        last_hash = self._last_chain_hash.get(device_id)
        if last_hash is None and packet.previous_witness_hash is not None:
            # First packet seen for this device must have previous_witness_hash=None.
            # If it claims a prior hash, that's suspicious but not strictly a replay —
            # flag it as a chain anomaly, not a hard rejection.
            # SECURITY NOTE: This is a policy choice; stricter implementations reject.
            pass
        elif last_hash is not None and packet.previous_witness_hash != last_hash:
            return ReplayResult(
                passed=False,
                failure_code="CHAIN_BREAK",
                detail=(
                    f"previous_witness_hash {packet.previous_witness_hash!r} does not "
                    f"match last recorded hash {last_hash!r} for device {device_id!r}"
                ),
            )

        # All checks passed — commit state
        import dataclasses
        packet_dict = dataclasses.asdict(packet)
        new_hash = packet_chain_hash(packet_dict)

        self._seen_nonces.setdefault(device_id, set()).add(packet.nonce)
        self._last_sequence[device_id] = packet.sequence_number
        self._last_chain_hash[device_id] = new_hash

        return ReplayResult(passed=True, failure_code=None, detail=None)

    def last_chain_hash(self, device_id: str) -> Optional[str]:
        """Hash to use as previous_witness_hash in the next packet from this device."""
        return self._last_chain_hash.get(device_id)

    def reset_device(self, device_id: str) -> None:
        """Clear state for a device. Only call during authorized re-enrollment."""
        self._seen_nonces.pop(device_id, None)
        self._last_sequence.pop(device_id, None)
        self._last_chain_hash.pop(device_id, None)
