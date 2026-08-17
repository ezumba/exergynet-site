# Evidence Directory

This directory holds source records for claims made in `AI_MEMORY_CONTROL_PLANE.md`.

Each evidence record carries:
- Evidence ID (referenced in CLAIM_LEDGER.md)
- Source document / artifact
- Date verified
- Access classification
- Verifier

## Index

| Evidence ID | Claim | Source | Date | Classification |
|-------------|-------|--------|------|----------------|
| EVD-001 | xLMP H200 benchmark results (prompt tokens, accuracy, token efficiency) | `ExergyNet_H200_Performance_Benchmarks_v2.zip` SHA-256: 7005fa0766ee66a40fa6bce3268efeac069a8fb75c21ad9b1bb535db8a1e2204 | 2026-07-13 to 2026-07-14 | INTERNAL — benchmark package |
| EVD-002 | xLMP H200 benchmark addendum (saturation test, Useful-Answer-per-Token, erratum) | `ExergyNet_xLMP_Benchmark_Addendum_v2_2026-07-14.zip` SHA-256: 97559fb4bea7a571614f1cd851a9efa794027e680c297635744fde76e3a1534f | 2026-07-14 | INTERNAL — benchmark addendum |
| EVD-003 | NEURO-LOCK / Bolt FAA Exemption No. 26214 | FAA Regulatory Docket FAA-2025-5731 | Per docket | PUBLIC — FAA regulatory record |
| EVD-004 | LNES-22 deployment state (Ed25519 signing, tunnel break, policy gate staged) | `LNES22_AUDIT_LOOP_SECURITY_ARCHITECTURE.md` (repo, 2026-08-05 update) | 2026-08-05 | INTERNAL — architecture doc |
| EVD-005 | LNES-06 Edge Witness Android app deployment (v2.22.8 versionCode 247) | `EXERGYNET_EDGE_WITNESS_ARCHITECTURE.md` §1 | 2026-07-03 | INTERNAL — architecture doc |
| EVD-006 | LNES-11 = bilateral consensus (vanguard-ultra) in biological_proxy | `deployed-snapshots/README.md` | 2026-07-09 | INTERNAL — deployed snapshot record |
| EVD-007 | LNES-12 = LiveKit/coturn deployed calling layer | `LNES12_CHANGE_LOG.md` | 2026-07-20 | INTERNAL — change log |
| EVD-008 | Omega Carrier Tools 1–5 REAL on SSE port 8765, Tool 6 STAGED | `EXERGYNET_CONVERGENCE_ARCHITECTURE.md` §I; `outbox_2026-08-01_omega_carrier_response.md` | 2026-08-01 | INTERNAL — architecture + outbox |
| EVD-009 | xLMP ZK query = SHA-256 labeled Groth16 (not real ZK) | `EXERGYNET_CONVERGENCE_ARCHITECTURE.md` §I xLMP-DS row | 2026-07-04 | INTERNAL — convergence architecture |
| EVD-010 | Veena saturation test co-authorship | `HANDOFF_TO_VEENA_NVIDIA_MEETING.md` | 2026-07-14 | INTERNAL — handoff doc |
| EVD-011 | Async Groth16 proof path (`/api/xlmp/prove`) verified: real, non-placeholder 256-byte seal produced for a minimal Vault object on deployed CPU infrastructure in ~13.5 minutes. Single minimal-object test, not a production-scale or reliability result. | `LNES82E1_VAULT_ASYNC_GROTH16_PROOF_PATH_REPORT.md` + `..._MANIFEST.json` + `..._RAW_RESULTS.json` | 2026-08-16 | INTERNAL — deployment-path verification report |
| EVD-012 | A100/TPU v6e R6 cross-accelerator scaling | LNES82C6_ASYMPTOTIC_SCALING_SUMMARY.md; LNES82C7B_TPU_MIRROR_SUCCESS_SUMMARY.md | 2026-08-17 | INTERNAL - sealed benchmark summaries |
| EVD-013 | LNES-84 Compact/Deterministic Index workload-dependent verdict | LNES84_3_FINAL_VERDICT.md; LNES84_3_PHASE4_7_ANALYSIS_REPORT.md | 2026-08-17 | INTERNAL - sealed benchmark reports |
| EVD-014 | LNES-86 adaptive workload-aware retrieval routing | LNES86_6_VALIDATION_REPORT.md | 2026-08-17 | INTERNAL - sealed validation report |
| EVD-015 | VMN v2.0.0 npm publication and GitHub source synchronization | npm registry @lnes/vanguard-memory-node@2.0.0; GitHub tag/release provenance | 2026-08-17 | PUBLIC/INTERNAL - registry plus source provenance |
