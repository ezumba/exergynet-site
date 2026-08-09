"""
LNES-60 Phase 2 — Witness admissibility engine.

Implements the four-plane admissibility check for a witness packet. All checks
must pass before a packet contributes to physical-truth convergence.

Check order (fail-fast):
  1. Schema and sanity validation (measurement_value finite, algorithm known, etc.)
  2. Cryptographic verification (Ed25519 signature)
  3. Key registry checks (known device, firmware hash)
  4. Replay guard (nonce, sequence, chain)
  5. Calibration validation (hash match, expiry)
  6. Epoch validation (configuration epoch)
  7. Scope validation (aircraft, component, measurement type vs predicate)

A packet that fails check 2 (crypto) is REJECTED — it never reaches check 3+.
A packet that fails checks 3-7 is INADMISSIBLE — it has a valid signature but
cannot contribute to convergence for semantic reasons.

This is not the same as FORGERY. The attack semantics note in the attack
expectations JSON explains why calling non-crypto rejections "forged" is wrong.
"""

from __future__ import annotations
import dataclasses
import math
from dataclasses import dataclass
from typing import List, Optional, Tuple

from .calibration_validator import CalibrationRegistry, validate_calibration
from .crypto_verifier import KeyRegistry, verify_packet_signature
from .epoch_validator import EpochRegistry, validate_epoch
from .packet_types import AdmissibilityVerdict, WitnessPacket
from .replay_guard import ReplayGuard
from .scope_validator import PredicateMeasurementRegistry, validate_scope


@dataclass
class AdmissibilityContext:
    """All registries and state needed to evaluate one witness packet."""
    key_registry: KeyRegistry
    replay_guard: ReplayGuard
    calibration_registry: CalibrationRegistry
    epoch_registry: EpochRegistry
    predicate_registry: PredicateMeasurementRegistry
    claim_aircraft_id: str
    claim_component_id: str
    predicate: str


def evaluate_admissibility(
    packet: WitnessPacket,
    ctx: AdmissibilityContext,
) -> AdmissibilityVerdict:
    """
    Run all admissibility checks and return a verdict.
    Checks are ordered; first failure short-circuits the rest.
    """
    failed_checks: List[str] = []
    rejection_reason: Optional[str] = None

    def fail(code: str, detail: Optional[str] = None) -> AdmissibilityVerdict:
        reason = detail or code
        return AdmissibilityVerdict(
            witness_device_id=packet.witness_device_id,
            packet_nonce=packet.nonce,
            admitted=False,
            failed_checks=tuple([code]),
            rejection_reason=reason,
        )

    # 1. Schema and sanity
    if packet.signature_algorithm != "Ed25519":
        return fail("UNKNOWN_ALGORITHM", f"Unsupported algorithm: {packet.signature_algorithm!r}")

    if not math.isfinite(packet.measurement_value):
        return fail("INVALID_MEASUREMENT_VALUE", "measurement_value is NaN or Infinity")

    if not math.isfinite(packet.measurement_uncertainty) or packet.measurement_uncertainty < 0:
        return fail("INVALID_MEASUREMENT_UNCERTAINTY", "measurement_uncertainty must be >= 0 and finite")

    if packet.sequence_number < 0:
        return fail("INVALID_SEQUENCE_NUMBER", "sequence_number must be >= 0")

    # 2. Cryptographic verification
    crypto = verify_packet_signature(packet, ctx.key_registry)
    if not crypto.passed:
        return fail(crypto.failure_code or "CRYPTO_FAILURE", crypto.detail)

    # 3. Key registry checks (firmware)
    registered_fw = ctx.key_registry.get_registered_firmware_hash(packet.witness_device_id)
    if registered_fw is not None and packet.firmware_hash != registered_fw:
        return fail(
            "FIRMWARE_MISMATCH",
            f"firmware_hash {packet.firmware_hash!r} != registered {registered_fw!r}",
        )

    # 4. Replay guard
    replay = ctx.replay_guard.check_and_record(packet)
    if not replay.passed:
        return fail(replay.failure_code or "REPLAY_FAILURE", replay.detail)

    # 5. Calibration
    cal = validate_calibration(packet, ctx.calibration_registry)
    if not cal.passed:
        return fail(cal.failure_code or "CALIBRATION_FAILURE", cal.detail)

    # 6. Epoch
    epoch = validate_epoch(packet, ctx.epoch_registry)
    if not epoch.passed:
        return fail(epoch.failure_code or "EPOCH_FAILURE", epoch.detail)

    # 7. Scope
    scope = validate_scope(
        packet,
        ctx.key_registry,
        ctx.predicate,
        ctx.claim_aircraft_id,
        ctx.claim_component_id,
        ctx.predicate_registry,
    )
    if not scope.passed:
        return fail(scope.failure_code or "SCOPE_FAILURE", scope.detail)

    return AdmissibilityVerdict(
        witness_device_id=packet.witness_device_id,
        packet_nonce=packet.nonce,
        admitted=True,
        failed_checks=(),
        rejection_reason=None,
    )


def evaluate_batch(
    packets: List[WitnessPacket],
    ctx: AdmissibilityContext,
) -> Tuple[List[WitnessPacket], List[Tuple[WitnessPacket, AdmissibilityVerdict]]]:
    """
    Evaluate admissibility for a list of packets.
    Returns (admitted_packets, rejected_with_verdicts).
    """
    admitted = []
    rejected = []
    for pkt in packets:
        verdict = evaluate_admissibility(pkt, ctx)
        if verdict.admitted:
            admitted.append(pkt)
        else:
            rejected.append((pkt, verdict))
    return admitted, rejected
