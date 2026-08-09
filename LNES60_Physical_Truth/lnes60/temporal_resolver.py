"""
Temporal resolution: event-aware freshness for physical witnesses
(architecture doc Section 6 / witness trust model Section 2.4), and
multi-hop supersession resolution for documentary records, reusing the
same per-document local-check pattern validated in LNES-59
(deterministic_extraction.py's _resolve_temporal_status): each document
in a chain only answers a question about itself, not about the whole
chain -- correctness falls out of applying the same local rule everywhere.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from .witness_types import PhysicalWitness, InvalidatingEvent
from .state_types import DocumentaryRecord

# Fixed clock-based freshness window. A SYNTHETIC_TEST_VALUE, not a real
# engineering limit -- see LNES60_TRUTH_STATE_SCHEMA.json's engineering
# envelope discipline. Exposed as a module constant so the synthetic
# generator and tests reference the same value rather than duplicating it.
DEFAULT_FRESHNESS_WINDOW = timedelta(hours=24)  # SYNTHETIC_TEST_VALUE


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts)


def is_stale(witness: PhysicalWitness, now: str, events: List[InvalidatingEvent]) -> Tuple[bool, str]:
    """Returns (is_stale, reason). Checks BOTH mechanisms independently --
    a reading failing either one is stale, per architecture doc Section 6."""
    reading_time = _parse(witness.trust.measurement_time)
    now_dt = _parse(now)

    # Clock-based staleness.
    if now_dt - reading_time > DEFAULT_FRESHNESS_WINDOW:
        return True, f"clock-based: reading at {witness.trust.measurement_time} exceeds the {DEFAULT_FRESHNESS_WINDOW} freshness window as of {now}"

    # Event-based invalidation: any event for the same aircraft (and, if
    # the event is component-scoped, the same component) that occurred
    # AFTER the reading was taken invalidates it, regardless of clock
    # freshness (KTX test class G: stale-good-witness-after-hard-landing;
    # class L: replay after configuration change).
    for ev in events:
        if ev.aircraft_id != witness.aircraft_id:
            continue
        if ev.component_id is not None and ev.component_id != witness.component_id:
            continue
        ev_time = _parse(ev.event_time)
        if ev_time > reading_time:
            return True, (
                f"event-based: {ev.event_type} (event {ev.event_id}) occurred at "
                f"{ev.event_time}, after this reading was taken at "
                f"{witness.trust.measurement_time} -- the reading cannot establish "
                f"post-event state"
            )

    return False, ""


def resolve_configuration_epoch(
    aircraft_id: str,
    component_id: Optional[str],
    at_time: str,
    events: List[InvalidatingEvent],
) -> str:
    """The configuration epoch in force for an aircraft/component at a
    given time -- the most recent epoch-changing event at or before that
    time, or 'EPOCH_0' if none. See configuration_resolver.py for how
    this is used to detect CONFIGURATION_MISMATCH."""
    at_dt = _parse(at_time)
    relevant = [
        ev for ev in events
        if ev.aircraft_id == aircraft_id
        and (ev.component_id is None or ev.component_id == component_id)
        and ev.new_configuration_epoch is not None
        and _parse(ev.event_time) <= at_dt
    ]
    if not relevant:
        return "EPOCH_0"
    relevant.sort(key=lambda ev: _parse(ev.event_time))
    return relevant[-1].new_configuration_epoch


def resolve_documentary_chain(records: List[DocumentaryRecord], predicate_record_ids: List[str], as_of: str) -> Optional[DocumentaryRecord]:
    """Resolve the current documentary record among a set that share a
    supersession chain (or a single record with no chain). Same local-check
    pattern as LNES-59: for each candidate, check whether some OTHER
    candidate declares it superseded, and whether that superseding record
    is itself currently effective. The record with no currently-effective
    successor, and the latest event_time among those, is current.

    Historical records are never deleted or mutated by this resolution --
    it only selects which one is CURRENT as of `as_of`; every record
    remains queryable as history (architecture doc Section 4)."""
    as_of_dt = _parse(as_of)
    candidates = [r for r in records if r.record_id in predicate_record_ids]
    if not candidates:
        return None

    by_id = {r.record_id: r for r in candidates}
    superseded_ids = set()
    for r in candidates:
        if r.supersedes and r.supersedes in by_id:
            superseded_ids.add(r.supersedes)

    def currently_effective(r: DocumentaryRecord) -> bool:
        if _parse(r.event_time) > as_of_dt:
            return False  # future-effective, not yet in force
        if r.effective_until and _parse(r.effective_until) <= as_of_dt:
            return False  # expired
        return True

    live = [r for r in candidates if r.record_id not in superseded_ids and currently_effective(r)]
    if not live:
        # Every candidate is either superseded-but-its-successor-not-yet-
        # effective, or expired -- fall back to the latest by event_time
        # among all candidates so callers still see the most recent
        # documentary position, correctly labeled non-current by the
        # convergence engine's own interpretation, not silently dropped.
        return max(candidates, key=lambda r: _parse(r.event_time))
    return max(live, key=lambda r: _parse(r.event_time))
