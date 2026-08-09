"""Reconstructs typed engine objects from the JSON runner-holdout / dev
case dict format, for arms that need to call the deterministic engine
(P2 only -- P0/P1 work directly off the dict, deliberately, since they
represent an ungoverned reader that never gets structured objects, only
whatever evidence would be shown to a model)."""

from .state_types import DocumentaryRecord, CommandState
from .witness_types import PhysicalWitness, WitnessTrustRecord, InvalidatingEvent, SensorHealth


def load_documentary(case_dict) -> list:
    return [DocumentaryRecord(**d) for d in case_dict.get("documentary", [])]


def load_command(case_dict) -> list:
    return [CommandState(**c) for c in case_dict.get("command", [])]


def load_events(case_dict) -> list:
    out = []
    for e in case_dict.get("events", []):
        e = dict(e)
        out.append(InvalidatingEvent(**e))
    return out


def load_witnesses(case_dict) -> list:
    out = []
    for w in case_dict.get("witnesses", []):
        w = dict(w)
        t = dict(w["trust"])
        t["sensor_health"] = SensorHealth(t["sensor_health"])
        t.pop("envelope_type", None)
        trust = WitnessTrustRecord(**t)
        w2 = {k: v for k, v in w.items() if k != "trust"}
        w2.pop("envelope_type", None)
        witness = PhysicalWitness(trust=trust, **w2)
        out.append(witness)
    return out
