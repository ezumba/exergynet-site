# LNES-60 Physical Truth — Master Evidence Index

**Date:** 2026-08-09  
**Covers:** Phase 1 (deterministic simulator), Phase 1.5 (real model), Phase 2 (software ready)

This index is the single reference for all sealed artifacts in the LNES-60 project.
It does not contain source-of-truth status claims — see `EXERGYNET_CURRENT_STATE_2026-08-08.md` for current system state.

---

## Phase 1 — Deterministic Simulator Validation

| Artifact | Description | Location |
|---|---|---|
| P1-0.1.0 package | Frozen architecture (commit 784c55f) | `lnes60/` |
| Phase 1 holdout set | 20-class synthetic holdout, locked before evaluation | `holdout_cases.json` |
| Phase 1 results | Simulator evaluation across M0/M1/M2 arms | `phase1_*/` |
| Architecture freeze commit | `784c55f` | git history |

**Key findings:**
- M0 false-release rate: 30%
- M1 false-release rate: 34%
- M2 authorized false-release rate: 0%
- Simulator failed on: `known_damage_limited_scope_good`, `record_bad_witnesses_good`

---

## Phase 1.5 — Real Model Validation

### Primary Output Documents

| Artifact | SHA-256 (canonical) | Location |
|---|---|---|
| `LNES60_PHASE1.5_FINAL_VALIDATION_REPORT.md` | `af246d1ab3ab170c381bc69a704092c932e3e26e8e3f96c3bb1cf6586b14c2a3` | `LNES60_Physical_Truth/` |
| `LNES60_PHASE1.5_FINAL_RESULTS_MANIFEST.json` | `c7faa40f084dfcc68005aa71de04c3a1f8b5f5bd1a262192f5681ef55d674aba` | `LNES60_Physical_Truth/` |
| `LNES60_PHASE1_VS_PHASE1.5_COMPARISON.md` | `493eee4ac4a00ec5ee0da31c6ceb5ee6999f08b0a0b3613bebb51bf635e0ea6a` | `LNES60_Physical_Truth/` |
| `LNES60_PHASE1.5_FAILURE_AUTOPSY.md` | `713c66a0426cc23e72f5728e2cab8f9ed69538fe9cd4883ccab7edf085a9f1ba` | `LNES60_Physical_Truth/` |
| `LNES60_PHASE1.5_SHA256SUMS.txt` | (self) | `LNES60_Physical_Truth/` |
| `LNES60_PHASE1.5_EXECUTION_LEDGER.json` | — | `LNES60_Physical_Truth/` |

### Evaluation Corpus

| Artifact | SHA-256 | Location |
|---|---|---|
| Evaluator output (150 files) | `81236f55830418a40c5a46fdc5276af087f605589261a6358767bea00a8e4bea` | `phase1_5/LNES60_PHASE1.5_evaluator_output.json` |
| Generation responses corpus | `2807c1d9d230e39d17a6fef29163d82f475fa7e1026c2790f9e296213a4d86d1` | `phase1_5/generation_responses/` (150 files) |
| Raw results corpus | `7f2a1b3f9f75d882ad77b528bb48b65dc1e10f212500f0a6df5700112707eb70` | `phase1_5/raw_results/` (150 files) |

### Key Metrics (Phase 1.5)

| Metric | M0 | M1 | M2 |
|---|---|---|---|
| False-release rate | 0.08 (4/50) | 0.20 (10/50) | 0.00 (0/50) |
| Release accuracy | 0.84 (42/50) | 0.72 (36/50) | 0.84 (42/50) |
| False hold rate | 0.02 (1/50) | 0.08 (4/50) | 0.02 (1/50) |
| Gate: candidates prevented | — | — | 2/2 (100%) |
| Gate: false holds introduced | — | — | 0 |

**Canonical finding:** Raw telemetry is not authoritative physical state. Increasing sensor visibility can improve general reasoning while simultaneously worsening safety-critical release behavior when identity, freshness, scope, configuration, and authority are not governed.

**Execution commits:**
- Checkpoint: `67acd3f` (29/50 complete)
- Final (all 50): `3b04539`

---

## Phase 2 — Software Readiness Artifacts

### Schema Artifacts

| Artifact | Location |
|---|---|
| `LNES60_PHASE2_WITNESS_PACKET_SCHEMA.json` | `LNES60_Physical_Truth/` |
| `LNES60_PHASE2_STATE_OBJECT_SCHEMA.json` | `LNES60_Physical_Truth/` |
| `LNES60_PHASE2_ACTION_AUTHORITY_SCHEMA.json` | `LNES60_Physical_Truth/` |
| `LNES60_PHASE2_ATTACK_EXPECTATIONS.json` | `LNES60_Physical_Truth/` |

### Design and Interface Documents

| Artifact | Location |
|---|---|
| `LNES60_PHASE2_SOFTWARE_ARCHITECTURE.md` | `LNES60_Physical_Truth/` |
| `LNES60_PHASE2_INTERFACE_CONTROL_DOCUMENT.md` | `LNES60_Physical_Truth/` |
| `LNES60_PHASE2_ACCEPTANCE_CRITERIA.md` | `LNES60_Physical_Truth/` |
| `LNES60_TENSILE_TEAM_PHASE2_HANDOFF.md` | `LNES60_Physical_Truth/` |
| `LNES60_MASTER_EVIDENCE_INDEX.md` (this file) | `LNES60_Physical_Truth/` |

### Implementation

| Artifact | Location | Status |
|---|---|---|
| `lnes60_phase2/__init__.py` | `LNES60_Physical_Truth/lnes60_phase2/` | Complete |
| `lnes60_phase2/packet_types.py` | — | Complete |
| `lnes60_phase2/canonicalize.py` | — | Complete |
| `lnes60_phase2/key_registry.py` | — | Complete |
| `lnes60_phase2/replay_guard.py` | — | Complete |
| `lnes60_phase2/calibration_validator.py` | — | Complete |
| `lnes60_phase2/scope_validator.py` | — | Complete |
| `lnes60_phase2/epoch_validator.py` | — | Complete |
| `lnes60_phase2/crypto_verifier.py` | — | Complete |
| `lnes60_phase2/witness_admissibility.py` | — | Complete |
| `lnes60_phase2/physical_state_adapter.py` | — | Complete |
| `lnes60_phase2/lnes22_adapter.py` | — | Complete |
| `lnes60_phase2/bench_receiver.py` | — | Complete |
| `lnes60_phase2/test_vectors/generate_vectors.py` | — | Complete |
| `lnes60_phase2/tests/conftest.py` | — | Complete |
| `lnes60_phase2/tests/test_attacks.py` | — | Complete (13 attacks + security + regression) |

### Phase 2 Status

**SOFTWARE READY / HARDWARE EXECUTION PENDING**

The bench receiver is implemented. All 13 attack test vectors are defined. All acceptance criteria are specified. Hardware bench execution by the Tensile team is required to complete Phase 2.

---

## Patent Disclosure Note

`PATENT_AI_MEMORY_CONTROL_PLANE_2026/LNES60_PATENT_DISCLOSURE_NOTE.md` — local only, gitignored.

Contains:
- Phase 1.5 addendum (2026-08-09) — real-model confirmations of Items 1-9
- Items 11-15: new conception items from Phase 1.5 (physical/mission separation, raw-telemetry finding, witness packet chaining, secure-element-backed identity, information-minimizing handshake)

---

## Phase 3 — Not Started

- Hardware bench execution (Tensile team deliverable)
- HARDWARE_WITNESS support in convergence engine
- Production key management
- NEURO-LOCK actuation protocol
- FAA pre-submission documentation
