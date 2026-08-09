"""
Configuration mismatch detection: command/digital state (what the
aircraft was told/configured to be) vs. physical witness (what it
actually is), and configuration-epoch binding (a witness taken under an
old epoch does not prove state for the current epoch -- architecture doc
Section 7).
"""

from dataclasses import dataclass
from typing import List, Optional

from .state_types import CommandState
from .witness_types import PhysicalWitness
from .temporal_resolver import resolve_configuration_epoch


@dataclass
class ConfigurationCheckResult:
    match: bool
    reason: str = ""


def check_configuration(
    command_states: List[CommandState],
    field_name: str,
    witness: Optional[PhysicalWitness],
    witness_measured_value: Optional[str],
    current_epoch: str,
) -> ConfigurationCheckResult:
    """Compare an expected command/digital field against a physical
    witness's actual measured value. Returns a mismatch if either the
    values disagree OR the witness's own configuration_epoch predates
    the current epoch (KTX test class L / architecture doc Section 7 --
    a cryptographically valid OLD-epoch witness does not prove
    current-epoch state, even if the measured value happens to still
    match)."""
    relevant = [cs for cs in command_states if cs.field == field_name]
    if not relevant:
        return ConfigurationCheckResult(True, "no command-state expectation for this field -- nothing to compare")
    expected = relevant[-1]  # latest command-state entry for this field

    if witness is None or witness_measured_value is None:
        return ConfigurationCheckResult(True, "no physical witness available for this field -- deferred to UNVERIFIED/INCOMPLETE by the convergence engine, not a configuration mismatch by itself")

    if witness.trust.configuration_epoch != current_epoch:
        return ConfigurationCheckResult(
            False,
            f"witness for '{field_name}' was taken under configuration epoch "
            f"{witness.trust.configuration_epoch}, but the current epoch is "
            f"{current_epoch} -- a valid old-epoch reading does not establish "
            f"current-epoch configuration state, regardless of the measured value"
        )

    if str(witness_measured_value) != str(expected.value):
        return ConfigurationCheckResult(
            False,
            f"expected {field_name}={expected.value} (command state, epoch "
            f"{expected.configuration_epoch}) but witness reports "
            f"{field_name}={witness_measured_value}"
        )

    return ConfigurationCheckResult(True, f"{field_name} matches expected value under the current epoch")
