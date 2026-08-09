"""
LNES-60 Phase 2 — Canonical JSON serialization.

Canonical form: sorted keys, no whitespace, UTF-8 bytes.
Used for signature verification and hash computation throughout the package.
"""

from __future__ import annotations
import dataclasses
import hashlib
import json
from typing import Any


def canonical_bytes(obj: Any) -> bytes:
    """
    Serialize obj to canonical JSON bytes: sorted keys, no whitespace, UTF-8.
    Handles dataclasses by converting to dict first.
    """
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        obj = dataclasses.asdict(obj)
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def canonical_hash(obj: Any) -> str:
    """Return SHA-256 hex digest of the canonical JSON serialization of obj."""
    return hashlib.sha256(canonical_bytes(obj)).hexdigest()


def packet_signing_bytes(packet_dict: dict) -> bytes:
    """
    Canonical bytes for Ed25519 signature verification.
    Signature field is excluded — covers all other fields only.
    """
    signing_dict = {k: v for k, v in packet_dict.items() if k != "signature"}
    return canonical_bytes(signing_dict)


def packet_chain_hash(packet_dict: dict) -> str:
    """
    SHA-256 hash of the complete canonical packet (including signature).
    Used to populate previous_witness_hash in the next packet in the chain.
    Excludes source_label (receiver-assigned, not part of the signed artifact).
    """
    chain_dict = {k: v for k, v in packet_dict.items() if k != "source_label"}
    return canonical_hash(chain_dict)
