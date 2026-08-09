"""
LNES-60 Phase 2 — Ed25519 signature verifier.

Uses the `cryptography` library (PyCA). Do NOT invent custom signature algorithms.
Requires: pip install cryptography

For bench testing, all keys are TEST KEY / SIMULATED SIGNER.
Private keys must never appear in this module, test fixtures, or any committed file.

Signature verification inputs:
  - message: canonical JSON bytes over all packet fields EXCEPT 'signature'
  - signature: base64url-decoded bytes from packet.signature
  - public_key: bytes from the key registry for packet.witness_device_id
"""

from __future__ import annotations
import base64
import dataclasses
from dataclasses import dataclass
from typing import Optional

from .canonicalize import packet_signing_bytes
from .key_registry import KeyRegistry
from .packet_types import WitnessPacket

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    from cryptography.exceptions import InvalidSignature
    _CRYPTO_AVAILABLE = True
except ImportError:
    _CRYPTO_AVAILABLE = False


@dataclass
class CryptoResult:
    passed: bool
    failure_code: Optional[str]
    detail: Optional[str]


def verify_packet_signature(
    packet: WitnessPacket,
    key_registry: KeyRegistry,
) -> CryptoResult:
    """
    Verify the Ed25519 signature on a witness packet.

    Steps:
      1. Reject unknown signature algorithms
      2. Look up public key from registry
      3. Decode base64url signature
      4. Compute canonical signing bytes (all fields except 'signature')
      5. Verify Ed25519 signature
    """
    if not _CRYPTO_AVAILABLE:
        return CryptoResult(
            passed=False,
            failure_code="CRYPTO_LIBRARY_UNAVAILABLE",
            detail="cryptography library not installed — run: pip install cryptography",
        )

    # 1. Algorithm check
    if packet.signature_algorithm != "Ed25519":
        return CryptoResult(
            passed=False,
            failure_code="UNKNOWN_ALGORITHM",
            detail=f"signature_algorithm {packet.signature_algorithm!r} is not supported (only Ed25519)",
        )

    # 2. Key lookup
    pub_key_bytes = key_registry.get_public_key(packet.witness_device_id)
    if pub_key_bytes is None:
        return CryptoResult(
            passed=False,
            failure_code="UNKNOWN_KEY",
            detail=(
                f"witness_device_id {packet.witness_device_id!r} not found in key registry "
                f"(or device is revoked)"
            ),
        )

    # 3. Decode signature
    try:
        sig_bytes = base64.urlsafe_b64decode(packet.signature + "==")
    except Exception as exc:
        return CryptoResult(
            passed=False,
            failure_code="SIGNATURE_DECODE_ERROR",
            detail=f"base64url decode failed: {exc}",
        )

    # 4. Canonical signing bytes
    packet_dict = dataclasses.asdict(packet)
    message = packet_signing_bytes(packet_dict)

    # 5. Verify
    try:
        pub_key = Ed25519PublicKey.from_public_bytes(pub_key_bytes)
        pub_key.verify(sig_bytes, message)
    except InvalidSignature:
        return CryptoResult(
            passed=False,
            failure_code="INVALID_SIGNATURE",
            detail="Ed25519 signature verification failed",
        )
    except Exception as exc:
        return CryptoResult(
            passed=False,
            failure_code="CRYPTO_ERROR",
            detail=f"Unexpected crypto error: {exc}",
        )

    return CryptoResult(passed=True, failure_code=None, detail=None)


def generate_test_keypair():
    """
    Generate an ephemeral Ed25519 test keypair for bench use.
    Returns (private_key, public_key_bytes_32).

    LABEL: TEST KEY / SIMULATED SIGNER
    The private key object is returned directly — callers must not serialize
    it, log it, commit it, or use it outside local bench test scope.
    """
    if not _CRYPTO_AVAILABLE:
        raise ImportError("cryptography library not installed — run: pip install cryptography")

    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    public_key_bytes = public_key.public_bytes(Encoding.Raw, PublicFormat.Raw)
    return private_key, public_key_bytes


def sign_packet_dict(packet_dict: dict, private_key) -> str:
    """
    Sign a packet dict with a private key and return the base64url-encoded signature.

    LABEL: TEST KEY / SIMULATED SIGNER
    Call only during test vector generation. Never use production keys.
    """
    message = packet_signing_bytes(packet_dict)
    sig_bytes = private_key.sign(message)
    return base64.urlsafe_b64encode(sig_bytes).rstrip(b"=").decode("ascii")
