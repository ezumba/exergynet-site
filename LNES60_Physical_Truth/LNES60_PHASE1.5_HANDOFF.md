# LNES-60 Phase 1.5 — Handoff to a Fresh Session

**Why this file exists:** Phase 1's synthetic result
(`LNES60_PHASE1_FINAL_VALIDATION_REPORT.md`) was produced with
`MODEL_SIMULATOR: RULE_BASED_REFERENCE, NOT AN LLM` because the prior
session's Agent-tool subagent-dispatch budget (200/200) was exhausted.
Phase 1.5 replaces that simulator with a real model for the same
M0/M1/M2 comparison and needs a fresh subagent budget — hence a new
session. This file is a deliberate, accurate cold-start pointer, written
by the session that just finished Phase 1, to avoid the fresh session
re-deriving everything from the repo or (as happened once already this
project) colliding with another concurrent session's own reconstruction.

## What is already done and frozen — do not rebuild

- **Architecture P1-0.1.0**, frozen at commit `784c55f`. The 7
  decision-logic files (`lnes60/state_types.py` through
  `lnes60/release_policy.py`) are confirmed byte-identical to that
  commit as of the last check this session — **do not modify them for
  Phase 1.5.** The directive that produced Phase 1
  (`@workspace.txt` at the time) was explicit: "Do not change P1-0.1.0.
  Freeze it exactly where it is."
- **The 50-case sealed holdout** (`LNES60_RUNNER_HOLDOUT.json` /
  `LNES60_EVALUATOR_HOLDOUT.json` / `LNES60_HOLDOUT_MANIFEST.json` /
  `LNES60_GROUND_TRUTH_MANIFEST.json`) — reusable as-is for Phase 1.5's
  M0/M1/M2 cases, since the underlying evidence (documentary/command/
  witness/event records) is the same; only the *arm logic* consuming it
  changes (a real model instead of `lnes60/model_simulator.py`).
- **Phase 1 final results**, sealed:
  `LNES60_PHASE1_FINAL_VALIDATION_REPORT.md` +
  `LNES60_PHASE1_FINAL_RESULTS_MANIFEST.json`. Headline: P0 18%/30%
  false-release, P1 64-66%/34% false-release (worse than P0 on the
  safety metric, and actively regressed below P0 on 2 KTX classes —
  see report §15), P2 100%/0%.
- **Patent disclosure addendum** already added:
  `PATENT_AI_MEMORY_CONTROL_PLANE_2026/LNES60_PATENT_DISCLOSURE_NOTE.md`
  (gitignored, confidential, not filed).

## What Phase 1.5 needs to build

Per the operator's own design (see the message that requested Phase 1.5
— it contains the full M0/M1/M2 arm spec in detail; read it before
building rather than re-deriving from this summary):

- **M0** — documents only (maintenance/configuration/history), real
  model decides release. Same evidence shape as Phase 1's P0.
- **M1** — documents + raw telemetry (sensor readings, calibration
  records, timestamps, hardware IDs), **no deterministic convergence**,
  real model decides release. This is "the dangerous arm" — the specific
  question is whether a real LLM reproduces P1's regression (a
  plausible-looking GOOD reading overriding a known documented defect).
- **M2** — same evidence, but routed through the frozen P1-0.1.0
  convergence engine first, then the model interprets the *converged*
  state (not raw evidence), then the simulated LNES-22 gate
  (`lnes60/release_policy.py`, also frozen) produces the authorized
  decision. Preserve candidate vs. authorized separately, same as
  Phase 1's P2.

## Generation mechanism for Phase 1.5

Use real Agent-tool subagent dispatch (fresh session = fresh budget) for
M0/M1/M2's model-facing steps, following the exact dispatch pattern
already proven in this project for LNES-59 (subagent reads a
prompt file, writes a JSON verdict, no case_id/ground-truth in the
prompt — see `LNES59_Procurement_Bench/`'s `explode_prompts.py` /
generation dispatch pattern for the template). **Do not fabricate
model output** if dispatch is ever exhausted again — fall back
explicitly and disclose it, exactly as Phase 1's own manifest did,
rather than silently reusing the rule-based simulator and calling it
Phase 1.5.

## Ground rules carried forward, unchanged

No aircraft actuation, no live propulsion commands, no destructive
hardware interaction. No architecture changes to the frozen P1-0.1.0
engine based on any Phase 1.5 result. Same corpus-first, ground-truth-
before-model, no-holdout-leakage discipline as Phase 1
(`lnes60/tests/test_leakage.py` should be re-run, not just assumed
clean, before any blind M0/M1/M2 execution).

## If you find another concurrent session already working on this

It has happened once already this project (see git history around
commit `c854500` and `EXERGYNET_CURRENT_STATE_2026-08-08.md`'s
reconciliation note). If you find evidence of a second session (stray
files you didn't write, an unfamiliar commit), stop and surface it to
the operator rather than silently overwriting or silently merging.
