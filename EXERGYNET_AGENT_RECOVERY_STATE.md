# ExergyNet Agent Recovery State

**Prepared:** 2026-08-08, cold-start reconstruction after @workspace.txt directive.
**Status:** This file records what this agent found upon entry — it is a snapshot,
not a truth authority. Canonical current-state source of truth:
`EXERGYNET_CURRENT_STATE_2026-08-08.md`.

---

## Current repo state

Branch: `main`
Latest commit: `170ac8d` — "Master current-state package: EXERGYNET_CURRENT_STATE_2026-08-08.md"

The prior session (same date, 2026-08-08) executed phases 1–9 of the
post-LNES-59 consolidation directive. All deliverables from that directive
are present and committed. LNES-60 deliverables (phases 10–16) are absent
from the repo — that is the work this session begins.

---

## Relevant commits (most recent → oldest)

| Hash | Summary |
|---|---|
| `170ac8d` | Master current-state package (EXERGYNET_CURRENT_STATE_2026-08-08.md) |
| `074ff23` | Model health inventory + PROJECT_BLOCKERS BLK-010/BLK-011 |
| `7e083f9` | xLMP API integration registry and doc/code drift report |
| `508b750` | White paper v1.5: LNES-58/59 state-governance result, pipeline diagram |
| `d75e691` | LNES-59: execution harness, final results, and chronology erratum |
| `b31df36` | LNES-59.2B: freeze the 8-arm comparator experiment |
| `7123437` | LNES-59.2 Stage A: seal the 50-case blind holdout |
| `ab48726` | LNES-59: final pre-holdout development autopsy + architecture freeze |

---

## Frozen artifacts

| Artifact | Hash (from LNES59_FINAL_RESULTS_MANIFEST.json, verified unchanged) |
|---|---|
| `LNES59_FINAL_VALIDATION_REPORT.md` | `cd53290ae9fc388d2a9a4bfb8629e2d423e852f27fadab69427a16f7184cc67f` |
| `evaluator_aggregate_output.json` | `293762abd5e2fc26641d338432ab4e3be68926f45e31395742406e3c9b11fcfb` |
| `LNES59_EXPERIMENT_MANIFEST.json` | `101bf0bcca98d63a92eecd553d3a06fcafbbb2b8e564631f1d21e32055a19ed1` |
| `LNES59_HOLDOUT_MANIFEST.json` | `56a6a8994e9d495568535cd1b3eed82c590ec908649e6db1d52ffdd02535a153` |
| `LNES59_EXECUTION_LEDGER.json` | `0c4162b006e84862ec43e5ab938ce1cce0d72131a97d07f4b3079cbac4d6eff4` |

V7 architecture freeze commit: `651ce500dbc2dfbadafe8e126175325cee86543e`

---

## Current architecture versions

| Component | Version | Status |
|---|---|---|
| White paper | v1.5 | Internal co-author review draft |
| xLMP state-governance gate | V7 (frozen) | Benchmark-only — not production-deployed |
| LNES-06 Edge Witness | v2.29.0 (versionCode 247 in arch doc; latest APK 2.29.0) | DEPLOYED (Android) |
| LNES-22 | Policy engine deployed; authority loop incomplete (tunnel/gate not wired) | STAGED/PARTIAL |
| LNES-90 FRI Verifier | Real Plonky3 FRI in Circom — reached FRI batch alpha checkpoint | Blocked on PRIVATE_KEY |
| Living White Paper | `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` v1.5 | Internal draft |

---

## Known deployed services

Per `EXERGYNET_SYSTEM_HEALTH_FINAL.md` (prior session); full SSH-level
confirmation blocked this session (BLK-010):

| Service | Status |
|---|---|
| Portal (Next.js) | HEALTHY (confirmed) |
| L0 Apex Router | HEALTHY (confirmed) |
| Storage/demo surface | HEALTHY (confirmed) |
| Vanguard reasoning gateway | DEGRADED (process up, backend model not answering) |
| Vanguard Proposer raw endpoint | UNKNOWN |
| mcp.exergynet.org SSE | UNKNOWN |
| biological_proxy legacy xLMP routes | UNKNOWN |

---

## Known benchmark-only systems

- LNES-59 V7 state-governance gate (X2) — exists in benchmark harness only
- Full 8-arm comparator stack — no production route surface
- All of LNES-58/59's authority-evaluation and state-governance logic

---

## In-session work (not yet committed at agent entry)

- `LNES59_Procurement_Bench/X2_REAL_RUN_2026-08-08.md` — first real model run
  through X2 gate (27 dev cases). Found and fixed bugs #15 (INCOMPLETE
  evidence carve-out) and #16 (natural-language vs. coded-token value comparison).
  Result: 18/27 CONSISTENT (67%) after fixes. Files not committed.

---

## Unfinished tasks at agent entry

1. **LNES-60 Physical Truth architecture and deliverables** (phases 10–16 of
   the @workspace.txt directive) — all 9 required files absent from repo.
2. **White paper** — no LNES-60 section; should add at minimum a Section 35.5
   "LNES-60: Physical State Truth" (DESIGNED status).
3. **Commit X2 real run results** — not yet committed.

---

## Known inconsistencies

- `EXERGYNET_AGENT_RECOVERY_STATE.md` (this file) overlaps with
  `EXERGYNET_CURRENT_STATE_2026-08-08.md` — that file is the canonical summary;
  this file is the agent's cold-start snapshot and is not kept current.

---

## Known blockers

See `PROJECT_BLOCKERS.md` for the full register. Relevant to this session:

- **BLK-010**: SSH-level process confirmation of model runtimes blocked (no
  direct SSH access available to the agent in this session).
- **BLK-011**: `biological_proxy` legacy xLMP surface — live status unconfirmed.
- **LNES-90**: Awaiting PRIVATE_KEY to deploy the FRI verifier circuit.
