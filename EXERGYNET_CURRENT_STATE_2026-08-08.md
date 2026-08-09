# ExergyNet Current State — 2026-08-08

**Prepared:** Phase 6 of the post-LNES-59 consolidation directive; updated
same day per the continuity directive's maturity-separation requirement.
Single index answering the questions below; each answer links to the
document that actually supports it — this file summarizes, it is not the
source of truth for any individual claim.

**Maturity levels, never mixed:**

| Level | Meaning | What's currently at this level |
|---|---|---|
| **LIVE PRODUCTION** | Actually verified running and serving | xLMP data plane (ingest/recall/roots) — Portal app, L0 Apex Router, storage surface confirmed HEALTHY this session |
| **VALIDATED / NOT DEPLOYED** | Real holdout/benchmark evidence exists; not in the live route surface | LNES-59 V7 deterministic state-governance gate (8%→0% false-authoritative-state, 84%=84% candidate accuracy, sealed 50-case holdout); LNES-60 Phase 1 physical-truth convergence engine (30%→34%→0% false-release rate across P0→P1→P2, sealed 50-case holdout, `MODEL_SIMULATOR: RULE_BASED_REFERENCE` not a real LLM — see `LNES60_Physical_Truth/LNES60_PHASE1_FINAL_VALIDATION_REPORT.md`) |
| **DESIGNED / R&D** | Architecture and protocol exist; no implementation run yet | The V7 production insertion plan (design only, not deployed); LNES-60 Phase 2 (real sensor hardware, not yet built or authorized) |
| **DEGRADED / UNKNOWN** | Live-tested this session, result was not HEALTHY, or could not be reached to test | Vanguard reasoning gateway (DEGRADED — up, backend not answering); Vanguard Proposer, `mcp.exergynet.org`'s real endpoint, `biological_proxy` legacy xLMP routes (UNKNOWN — unreachable from this session, not confirmed down) |

---

**WHAT IS EXERGYNET NOW?** A persistent-state infrastructure project
building the AI Memory Control Plane (xLMP) plus a companion agent-action
authority layer (LNES-22) and a physical-AI/actuation research track, per
the Living White Paper (below). Production today is a Next.js portal with
a live, filesystem-backed xLMP data plane; the deterministic
state-governance mechanism validated by LNES-58/LNES-59 is benchmark-only
in production as of this date.

**WHAT IS xLMP NOW?** Persistent memory objects, discovery/recall with
completeness guarantees, and content-addressed roots — live in production
(§ below). The three-axis epistemic state model, deterministic
consistency gate, and policy-tier authority evaluation validated by
LNES-58/LNES-59 are implemented and benchmark-verified, not yet part of
the live route surface.

**WHAT IS ACTUALLY DEPLOYED?** See `EXERGYNET_SYSTEM_HEALTH_FINAL.md` for
the full matrix. Confirmed HEALTHY this session: Portal app, L0 Apex
Router, storage/demo surface. Confirmed DEGRADED: the Vanguard reasoning
gateway (up, but its backend model is not answering through it). UNKNOWN
(network access, not confirmed down): Vanguard Proposer raw endpoint,
`mcp.exergynet.org`'s real SSE path, `biological_proxy`'s legacy xLMP
routes.

**WHAT IS BENCHMARK-ONLY?** The LNES-59 8-arm comparator result in full
(`LNES59_Procurement_Bench/LNES59_FINAL_VALIDATION_REPORT.md`); the
deterministic state-governance gate (Part N / X2) as a production-deployed
mechanism — it exists in the benchmark harness and the frozen architecture
files, confirmed absent from the live `/api/xlmp/*` route surface by
Phase 3 code recon.

**WHAT MODELS ARE RUNNING?** See `EXERGYNET_MODEL_RUNTIME_INVENTORY.md`.
Full SSH-level process confirmation was not possible this session — see
`PROJECT_BLOCKERS.md` BLK-010.

**WHAT APIs ARE LIVE?** See `EXERGYNET_XLMP_INTEGRATION_REGISTRY.md` /
`.json` — 8 canonical xLMP routes on the Next.js portal, plus a
separate legacy/duplicate set on `biological_proxy` (live status
unconfirmed).

**WHICH APPLICATIONS USE xLMP?** Confirmed by code: Omega Carrier
(`vault_commit_state`/`vault_recall_state`). Dashboard/keys pages consume
the public API docs manifest for display only. See the registry for the
full consumer list and its limits (static-recon-only, not exhaustive).

**WHICH PATHS USE THE STATE-GOVERNANCE GATE?** None, in production, as of
this date. Only the LNES-59 benchmark harness.

**WHICH PATHS USE LNES-22?** Not independently re-verified in this
session; per prior `VAULT_LEDGER.md`/white-paper record, LNES-22's
delegation-receipt and policy-engine infrastructure is deployed for
Ed25519 signing and review, with the full authority-loop closure still
incomplete (tunnel/policy-gate wiring) — see Appendix D of the white
paper for the exact current claim language, unchanged by this session's
work beyond Section 35.4's new state-governance material, which is
explicitly scoped as not testing LNES-22's action-authority layer.

**WHAT IS PATENT-PENDING / DRAFT / NEW MATTER?** One confirmed-filed
provisional (App 64/111,103, July 2026) plus a second referenced but not
re-verified in this pass (August 2025). A substantial draft/disclosure
package (`PATENT_AI_MEMORY_CONTROL_PLANE_2026/`) exists and is **not
filed** — see `CURRENT_PATENT_ARCHITECTURE_MAP.md` for the full inventory
and `CLAIM_CANDIDATE_DELTA_LNES59.md` for what LNES-59 adds as candidate
new matter (strongest candidate: deterministic policy-tier authority
evaluation, §2.4).

**WHAT DID LNES-59 ESTABLISH?** On a 50-case sealed synthetic procurement
holdout: adding the frozen deterministic state-governance gate to an
otherwise-identical pipeline reduced observed false-authoritative-state
commitments from 8% (4/50) to 0% (0/50), with identical candidate-state
correctness (84%=84%) between gated and ungated configurations. Full
detail: `LNES59_Procurement_Bench/LNES59_FINAL_VALIDATION_REPORT.md`.

**WHAT REMAINS UNVALIDATED?** Independent third-party validation of the
LNES-59 holdout (it is sealed but self-authored, per its own disclosure);
generalization beyond two domains (healthcare, procurement); the
gate's false-block rate as architecturally minimal (2 genuine cases found
on manual inspection); the gate's underclaiming blind spot (unfixed,
disclosed); production deployment of any LNES-59 mechanism; full
SSH-level confirmation of the model runtime stack (blocked this session,
`PROJECT_BLOCKERS.md` BLK-010); whether `biological_proxy`'s legacy xLMP
surface is still live.

---

## LNES-60 status (added this session)

LNES-60 Physical Truth architecture has been fully designed and documented
in `LNES60_Physical_Truth/`. Nine deliverables produced:

- `LNES60_PHYSICAL_TRUTH_ARCHITECTURE.md` — four-plane truth model,
  governing principle, layer separation
- `LNES60_TRUTH_STATE_SCHEMA.json` — state and resolution state definitions
- `LNES60_WITNESS_TRUST_MODEL.md` — nine trust properties, admissibility
  logic, explicit non-claims
- `LNES60_KTX_TEST_MATRIX.md` — 15 adversarial test classes (≥30 synthetic
  instances), stratification requirement
- `LNES60_EDGE_WITNESS_INTEGRATION_MAP.md` — xLMP object-type mapping,
  commit-time vs. resolution-time separation, open dependencies
- `LNES60_XLMP_LNES22_HANDSHAKE.md` — handshake payload spec, LNES-22
  boundary constraints, fail-closed rule
- `LNES60_FAILURE_TAXONOMY.md` — 11 pre-registered failure categories
- `LNES60_EXPERIMENT_PROTOCOL.md` — synthetic-harness protocol (software
  only; real sensor/hardware integration explicitly out of scope, deferred)
- `PATENT_AI_MEMORY_CONTROL_PLANE_2026/LNES60_PATENT_DISCLOSURE_NOTE.md`
  — ten candidate new-matter items, DRAFT, not filed

White paper is at **v1.6** — Section 35.5 ("LNES-60: The Third Domain:
Physical Truth — Architecture Defined, Not Yet Executed") added, with
explicit DESIGNED status and an explicit no-regulatory-substitution
claim, consistent with this document's own framing above. See the note
below on the concurrent session for how that section reached the repo.

**Status: DESIGNED — no physical experiment conducted, no synthetic harness
executed, no real sensor data processed.**

**Note on a concurrent session, reconciled:** a second, separately-started
Claude Code session was found to be operating on this same repository
during this work, cold-started from the same continuity directive and
independently producing (or, more likely given the byte-for-byte matching
line counts across all nine `LNES60_Physical_Truth/` files, capturing via
a shared working directory) the same LNES-60 deliverables, plus its own
Section 35.5 addition to the white paper and its own edit to this file.
Its commit (`c854500`) landed cleanly on top of this session's prior work
with no divergence. Per the operator's direction, that commit's content
was kept as the base (white paper v1.6/§35.5 included) and this session's
additional, non-overlapping work — security closure, `PROJECT_BLOCKERS.md`
updates, and the V7 production insertion plan — was added on top, rather
than the two being reconciled file-by-file from scratch. The other
session's own `EXERGYNET_AGENT_RECOVERY_STATE.md` cold-start snapshot has
been removed as redundant with this document, which is the maintained
canonical summary. Separately, that stray file also referenced a real,
pre-existing (not concurrent-session-fabricated) file,
`LNES59_Procurement_Bench/X2_REAL_RUN_2026-08-08.md` — an earlier dev-phase
X2 real-model-run experiment, timestamped mid-day, predating this
session's work. Its claimed bug fixes are not present in the current
frozen `state_consistency_gate_v2.py` (confirmed byte-identical to the V7
freeze commit) — most likely because any real fixes it found were already
incorporated before the V7 freeze,
consistent with the documented V1→V7 development chronology, but this
was not independently re-traced in this pass. Recorded here rather than
silently reconciled, since it originated from a different agent session's
uncoordinated work, not this session's own.

---

## Artifact index

| Area | File |
|---|---|
| Living White Paper (v1.5) | `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` |
| LNES-59 Final Validation Report | `LNES59_Procurement_Bench/LNES59_FINAL_VALIDATION_REPORT.md` |
| LNES-59 final results manifest | `LNES59_Procurement_Bench/LNES59_FINAL_RESULTS_MANIFEST.json` |
| LNES-59 chronology erratum | `LNES59_Procurement_Bench/LNES59_EXECUTION_CHRONOLOGY_ERRATUM.md` |
| xLMP API integration registry | `EXERGYNET_XLMP_INTEGRATION_REGISTRY.md` / `.json` |
| API/code drift report | `EXERGYNET_XLMP_DOC_CODE_DRIFT_REPORT.md` |
| Model runtime inventory | `EXERGYNET_MODEL_RUNTIME_INVENTORY.md` |
| System health final report | `EXERGYNET_SYSTEM_HEALTH_FINAL.md` |
| Patent architecture map | `PATENT_AI_MEMORY_CONTROL_PLANE_2026/CURRENT_PATENT_ARCHITECTURE_MAP.md` |
| Patent disclosure note (LNES-59) | `PATENT_AI_MEMORY_CONTROL_PLANE_2026/LNES59_PATENT_DISCLOSURE_NOTE.md` |
| Claim candidate delta | `PATENT_AI_MEMORY_CONTROL_PLANE_2026/CLAIM_CANDIDATE_DELTA_LNES59.md` |
| Specification delta | `PATENT_AI_MEMORY_CONTROL_PLANE_2026/SPECIFICATION_DELTA_LNES59.md` |
| Figure delta | `PATENT_AI_MEMORY_CONTROL_PLANE_2026/FIGURE_DELTA_LNES59.md` |
| Invention chronology | `PATENT_AI_MEMORY_CONTROL_PLANE_2026/INVENTION_CHRONOLOGY.md` |
| Blocked-work register (BLK-010 re-evaluated, BLK-011 escalated + closure in progress) | `PROJECT_BLOCKERS.md` |
| xLMP V7 production insertion plan (design only) | `XLMP_V7_PRODUCTION_INSERTION_PLAN.md` |
| LNES-60 Physical Truth foundation (9 artifacts) | `LNES60_Physical_Truth/` |
| LNES-60 patent disclosure note | `PATENT_AI_MEMORY_CONTROL_PLANE_2026/LNES60_PATENT_DISCLOSURE_NOTE.md` |

---

*This index summarizes; it does not supersede any linked document's own
detail or hedges. Where this summary and a linked document disagree, the
linked document is authoritative.*
