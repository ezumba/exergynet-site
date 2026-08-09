"""
Phase 1.5 pilot case selection. Stratified subset of the sealed 50-case
LNES-60 Phase 1 holdout (reused as-is per the handoff -- same evidence,
only the arm logic changes). Not a random sample: chosen to give full
(both-instance) coverage of every KTX class Phase 1's report identified
as either the P0->P1 regression (known_damage_limited_scope_good,
record_bad_witnesses_good) or a class P1 failed and P2's governance
fixed (config_epoch_stale_witness, detached_sensor,
mission_envelope_violation, record_good_trust_unknown, replay_attack,
stale_after_event -- 1 of 3 instances), plus three baseline controls
(fully_consistent, tether_condition_healthy, sensor_conflict) where P1
already performed correctly, to check the real model doesn't regress
somewhere P1's simulator did not.

18 cases x 3 arms (M0/M1/M2) = 54 dispatches -- a pilot, not the full
50 x 3 = 150 Phase 1 scale, per the operator's explicit choice to
sanity-check the regression with a real model before committing the
full budget.
"""

PILOT_CASE_IDS = [
    "HOLD-014", "HOLD-034",  # known_damage_limited_scope_good (P0->P1 regression)
    "HOLD-016", "HOLD-036",  # record_bad_witnesses_good (P0->P1 regression)
    "HOLD-015", "HOLD-035",  # mission_envelope_violation (P2 candidate->authorized delta)
    "HOLD-019", "HOLD-039",  # config_epoch_stale_witness (P1 fails, P2 fixes)
    "HOLD-013", "HOLD-033",  # detached_sensor (P1 fails, P2 fixes)
    "HOLD-017", "HOLD-037",  # record_good_trust_unknown (P1 fails, P2 fixes)
    "HOLD-012", "HOLD-032",  # replay_attack (P1 fails, P2 fixes)
    "HOLD-007",              # stale_after_event (P1 fails, P2 fixes) -- 1 of 3
    "HOLD-018",              # fully_consistent -- control
    "HOLD-002",              # tether_condition_healthy -- control
    "HOLD-008",              # sensor_conflict -- P1-already-correct control
]

assert len(PILOT_CASE_IDS) == 18
assert len(set(PILOT_CASE_IDS)) == 18
