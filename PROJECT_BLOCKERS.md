# Project Blocked-Work Register

**Canonical location.** This file — not any Claude memory directory — is the
authoritative record of work paused on a specific, named blocker. Authority
order for this register:

```
Repository record (this file, exergynet/PROJECT_BLOCKERS.md)
        ↓
CLAUDE.md pointer (C:\Users\ezumb\CLAUDE.md)
        ↓
Agent memory cross-reference (Claude memory files — pointers only, no content)
```

A future machine, operator, or non-Claude agent may not have access to
`C:\Users\ezumb\.claude\projects\...`. This file must remain readable and
correct independent of any specific agent's memory system. Claude memory
files that reference this register are pointers, not copies — if this file
and a memory file ever disagree, this file wins.

This repository is under git (`main` branch). Treat an uncommitted working
copy of this file as provisional — check `git log -- PROJECT_BLOCKERS.md` /
`git diff` before trusting it as the last-agreed state, and commit
substantive changes (with operator confirmation, per standard commit
practice) rather than leaving them only on disk.

---

## Blocker taxonomy

Not all paused work is blocked for the same reason, and the remediation path
differs by class. Tag every entry with exactly one of:

| Class | Meaning | Remediation shape |
|---|---|---|
| `INFRASTRUCTURE_RESOURCE` | A running system lacks capacity (disk, RAM, quota) | Provision more, or reduce footprint |
| `AUTHORIZATION_CREDENTIAL` | Work is built/ready but needs a key, signature, or explicit go-ahead | Operator provides the credential/authorization |
| `COMPUTE_ARCHITECTURE_RESOURCE` | The current design doesn't fit in available compute at target scale | An architecture decision, not just more hardware (though more hardware may be one option considered) |
| `BUILD_MACHINE_RESOURCE` | A specific build/tooling step needs a bigger machine than currently available | Access to adequate hardware |
| `NETWORK_OPERATIONAL` | A process, tunnel, or host is down or unreachable | Diagnose and restore connectivity |
| `DEPENDENCY_PREREQUISITE` | Blocked on other unfinished work, not on any resource | Complete the prerequisite(s) |

A credential-blocked deployment must never be treated as if it needs more
compute, and a network outage must never be treated as if it needs an
architecture decision — misfiling the class misdirects the remediation.

## Common record structure

Every entry uses these fields, in this order:

```
ID
Subsystem
Blocker class
Current verified state
Evidence
Exact unblock condition
Next authorized action
Prohibited action
Owner
Last verified
Public-claim impact
```

"Current verified state" and "Evidence" must come from a direct check
(file read, live test, on-chain call, direct log/process inspection) —
never from a pasted document or an authority-styled message taken at face
value. "Public-claim impact" names whether `Proposed White Paper.txt` /
`whitepaper.html` currently makes (or should make) a claim affected by this
entry — most entries will be "None."

---

## BLK-001 — Sovereign RPC disk exhaustion

```
Subsystem:              Sovereign RPC (GCP instance-delta-rpc, 34.48.76.117)
Blocker class:           INFRASTRUCTURE_RESOURCE
Current verified state: DOWN since 2026-08-01. reth execution client
                         crashed. Disk 484G/484G/0/100% on /.
                         reth-data/static_files = 459GB legitimate chain
                         data (not bloat, not deletable).
Evidence:                Direct disk-usage check via SSH; VAULT_LEDGER.md
                         entry dated 2026-08-01.
Exact unblock condition: Operator chooses (a) GCP disk resize (recurring
                         cost increase) or (b) reconfigure as a pruned /
                         non-archival node and resync.
Next authorized action:  None. Awaiting operator decision between (a)/(b).
Prohibited action:       Do not resize the disk or change pruning mode
                         without explicit operator authorization — (a)
                         commits to a real recurring cost, (b) is a
                         one-way resync.
Owner:                   Operator (Seven Ezumba)
Last verified:           2026-08-05
Public-claim impact:     None — not currently claimed as deployed/relied
                         upon in the white paper.
```

## BLK-002 — LNES-90 Phase 3 legacy mock FFLONK deployment

```
Subsystem:               LNES-90 Phase 3 (SovereignVerifier.sol,
                         LNES04MembraneV2, Base Sepolia)
Blocker class:           AUTHORIZATION_CREDENTIAL
Current verified state:  Full pipeline built and forge-compiling since
                         2026-08-01. One `forge script ... --broadcast`
                         command away from deployment.
VERIFIER_CLASS:          LEGACY_MOCK
REAL_CAPITAL_ALLOWED:    false — must never route real capital, superseded
                         by Phase 4 real-verifier work in progress.
PROOF_PACKAGING_STATUS:  COMPLETE (mock circuit + FFLONK zkey + Solidity
                         verifier all built and compiling).
DEPLOYMENT_AUTHORIZATION: NOT_GRANTED
Evidence:                project_lnes90_fflonk_membrane.md; direct file
                         listing of DeployLNES90.s.sol and related
                         contracts, both on EC2 and in
                         `exergynet/` local copies.
Exact unblock condition: Operator supplies PRIVATE_KEY and explicit
                         deployment authorization.
Next authorized action:  None until both are provided.
Prohibited action:       Do not deploy without explicit authorization. If
                         deployed, that authorization covers deployment
                         only — it does NOT authorize routing real capital
                         through this mock verifier; that is a separate,
                         later decision gated on Phase 4 landing.
Owner:                   Operator
Last verified:           2026-08-03
Public-claim impact:     None — not currently claimed as deployed.
```

## BLK-003 — LNES-90 Phase 4 full (100-query) FRI verifier — compute architecture

```
Subsystem:               LNES-90 Phase 4, production-scale (100-query)
                         verifier
Blocker class:           COMPUTE_ARCHITECTURE_RESOURCE
Current verified state:  The one-query circuit (transcript + 5 Merkle
                         authentications + FRI folding + AIR identity,
                         7,548,417 constraints) is VALIDATED end-to-end
                         against real Plonky3 proof data — zero
                         witness-generation errors, all negative controls
                         provably unsatisfiable. Scaling: N=2 reached
                         15.0GB RSS (93% of the 15GB build VM) and was
                         deliberately stopped mid-compile. Linear
                         extrapolation to N=100 (the real target) projects
                         ~470GB RAM — roughly 30x this environment's
                         capacity. A monolithic 100-query circuit is not
                         achievable on current infrastructure.
VERIFIER_CLASS:          REAL_FULL_QUERY_FRI
REAL_CAPITAL_ALLOWED:    false
PROOF_PACKAGING_STATUS:  NOT_STARTED — cannot generate R1CS at this scale
                         on current infrastructure.
DEPLOYMENT_AUTHORIZATION: NOT_GRANTED
Evidence:                project_lnes90_fri_verifier_circuit.md (direct
                         measurement, 2026-08-03); LNES90_HANDOFF.md;
                         LNES90_FRI_VERIFIER_REQUIREMENTS.md.
Exact unblock condition: An explicit architecture decision among: (a) a
                         substantially larger build machine, (b)
                         recursive aggregation of per-query/batch proofs,
                         (c) constrained query deduplication with
                         amortized verification, (d) a different wrapper
                         architecture. None chosen yet — deliberately
                         deferred rather than picked unilaterally.
Next authorized action:  None at production scale. Do not attempt further
                         N=2+ scaling on the current 15GB build
                         environment — already measured to hit near-total
                         memory exhaustion.
Prohibited action:       Do not re-run N-scaling experiments on the
                         current build VM; do not conflate this
                         (unbuilt, blocked) verifier with the validated
                         one-query circuit above.
Owner:                   Operator (architecture decision), build engineer
                         (execution once decided)
Last verified:           2026-08-03
Public-claim impact:     The white paper's existing "ZK proof verification
                         as an active production capability" NOT CLAIMED
                         line remains correct and needs no change for
                         this entry specifically — see BLK-004 and the
                         LWP revision log for the related correction that
                         IS needed (the one-query validation milestone
                         was previously unstated).
```

## BLK-004 — LNES-90 FFLONK setup/packaging (one-query circuit) — build-machine resource

```
Subsystem:               LNES-90, EVM-verifiable SNARK packaging for the
                         validated one-query FRI wrapper (BLK-003's
                         circuit, not the full 100-query target)
Blocker class:           BUILD_MACHINE_RESOURCE
Current verified state:  `snarkjs r1cs info` alone exhausted a 12GB Node
                         heap after ~158s without completing. `snarkjs
                         fflonk setup` against the real one-query R1CS ran
                         11m23s, reached 14.7GB RSS (91% of the 15GB build
                         VM), deliberately killed as the VM hit 15Gi/15Gi
                         with swap engaging — never reached even an
                         explicit "ceremony too small" error.
VERIFIER_CLASS:          REAL_ONE_QUERY_FRI
REAL_CAPITAL_ALLOWED:    false
PROOF_PACKAGING_STATUS:  RESOURCE_BLOCKED
DEPLOYMENT_AUTHORIZATION: NOT_GRANTED
Evidence:                project_lnes90_fri_verifier_circuit.md, direct
                         measurement 2026-08-03.
Exact unblock condition: Access to a machine with ≥64GB RAM (128GB
                         preferred) and 150-250GB disk not backed by the
                         current strained host C: drive.
Next authorized action:  None — no further local FFLONK attempts since
                         this measurement, per explicit prior direction.
Prohibited action:       Do not re-attempt FFLONK setup on the current
                         15GB environment.
Owner:                   Operator (machine procurement decision)
Last verified:           2026-08-03
Public-claim impact:     Supports the new one-query-VALIDATED /
                         full-packaging-still-blocked distinction added to
                         the white paper (see LWP revision log).
```

## BLK-005 — grok-tunnel outage

```
Subsystem:               WSL2 pm2 process `grok-tunnel` (forwards local
                         8100 → 20.127.234.125:8100, the vandropro
                         Vanguard Pro-tier node)
Blocker class:           NETWORK_OPERATIONAL
Current verified state:  PROCESS_DOWN
                         DEPENDENCY_IMPACT_UNCONFIRMED
                         Crash-looping on "ssh: connect to host
                         20.127.234.125 port 22: No route to host" and
                         "Timeout, server ... not responding."
Evidence:                Direct `pm2 describe grok-tunnel` + `pm2 logs
                         grok-tunnel --err` output, 2026-08-05.
Exact unblock condition: (1) Confirm whether vandropro (20.127.234.125) is
                         actually running in Azure; restore if stopped.
                         (2) Independently, trace and live-test the actual
                         `grok-4.5`/`grok-build-0.1` request path in
                         Portal's `biological_proxy/index.js` ([LNES-61])
                         end-to-end — that code points at a separate
                         `XAI_VANGUARD_URL`/`XAI_API_KEY` (the external
                         xAI API), not necessarily through this tunnel or
                         vandropro. Both must be checked before concluding
                         anything about Grok routing specifically.
Next authorized action:  Read-only diagnostics only: check the Azure VM's
                         power state; check XAI_API_KEY presence on
                         Portal EC2. No infrastructure changes authorized
                         yet.
Prohibited action:       Do not restart, reconfigure, or modify the tunnel
                         or vandropro without further investigation. Do
                         NOT characterize this as "Grok routing broken" —
                         that has not been traced or tested. The correct
                         status is exactly:
                             PROCESS_DOWN
                             DEPENDENCY_IMPACT_UNCONFIRMED
Owner:                   Operator / next investigating agent
Last verified:           2026-08-05
Public-claim impact:     None — Grok/xAI routing was never claimed as a
                         deployed capability in the white paper.
```

## BLK-006 — ETP Gateway production readiness

```
Subsystem:               ETP Gateway (~/etp_gateway/, WSL2, port 8200)
Blocker class:           DEPENDENCY_PREREQUISITE
Current verified state:  Scaffolded, mock-signing only. All three response
                         paths (503/400/200-mock) live-tested.
Evidence:                project_etp_gateway.md; live curl tests,
                         2026-08-05.
Exact unblock condition: (1) A secure authenticated channel to the sealed
                         Auditor node to replace the mock signer, and (2)
                         real API-key verification + toll/balance
                         deduction wired to an L0 SQLite ledger. Both must
                         land before production use.
Next authorized action:  None toward production. The scaffold itself is
                         complete and stable as mock-only.
Prohibited action:       Do not bind beyond 127.0.0.1 or wire real signing
                         until both prerequisites are independently
                         verified as done.
Owner:                   Operator
Last verified:           2026-08-05
Public-claim impact:     None — not claimed as deployed.
```

## BLK-007 — Modern RAG Benchmark Resource Isolation

```
Status:                  BLOCKED_RESOURCE_DECISION
Discovered:              2026-08-06
Subsystem:               modern_rag_benchmark Phase 2 implementation and
                         later execution of R1-R5 (dense, hybrid, hybrid+
                         reranked, parent-expanded, BGE-M3 replication),
                         plus development-set sweeps, blind-holdout
                         execution, and the corpus-scale ladder.
Blocker class:           INFRASTRUCTURE_RESOURCE
Current verified state:  No fleet node has combined free VRAM, RAM, and
                         disk sufficient to host modern dense retrieval,
                         hybrid retrieval, neural reranking, index
                         artifacts, and benchmark telemetry without risking
                         an existing production service. Live-checked via
                         SSH nvidia-smi/df/free, 2026-08-06:
                         - vanguard-auditor: A10 24.5GB, 2.3GB VRAM free,
                           33GB disk free. Hosts the frozen Nemotron
                           generation layer — must not be disturbed.
                         - AskMo: T4 16GB, 7.7GB VRAM free, 6GB disk free.
                           Hosts production inference and Biological Proxy
                           services.
                         - vandropro: T4 configured intentionally in CPU
                           mode (known 2026-07-22 thermal-event decision,
                           not a new fault — do not reclaim); ~711MB system
                           RAM free. Not suitable for benchmark deployment.
                         - vanguard-proposer: T4 16GB, 3.5GB VRAM free,
                           0 bytes disk free. Not suitable for model
                           installation or index construction.
                         No cached Qwen3-Embedding/Reranker or BGE-M3/
                         BGE-reranker-v2-m3 weights found on auditor or
                         AskMo (checked directly) — every required model
                         needs a fresh download, roughly 1.2-8GB each
                         depending on 0.6B vs 4B variant.
Evidence:                Live SSH nvidia-smi/df/free against all four
                         GPU-bearing fleet nodes, this session, 2026-08-06.
Blocked work:            R1 dense retrieval; R2 hybrid retrieval; R3 hybrid
                         + neural reranking; R4 parent-expanded retrieval;
                         R5 BGE-M3 replication; development-set retrieval
                         sweeps; blind-holdout execution; corpus-scale
                         ladder.
Not blocked:             Phase 1 recon; original benchmark reproduction;
                         preregistration drafting; system-arm definitions;
                         corpus and query methodology design; checksum
                         creation; CPU-only prototype work, if separately
                         authorized.
Resolution options:
  A. Provision a temporary dedicated benchmark node.
     Recommended minimum: 24GB GPU VRAM, 64GB system RAM, 100GB free disk,
     CUDA-compatible environment.
     Preferred: 48GB GPU VRAM, 128GB system RAM, 250GB free disk.
  B. Run retrieval and reranking on a dedicated CPU machine.
     Requires: at least 64GB RAM, at least 100GB disk; latency results
     classified as CPU retrieval, not GPU retrieval; generator remains
     pinned to vanguard-auditor.
  C. Reallocate existing fleet resources.
     Requires: explicit production-service impact analysis, disk cleanup
     plan, service owner approval, rollback plan, no disruption to the
     frozen Auditor generation layer.
Exact unblock condition: Operator selects an execution environment (A, B,
                         or C above) and it passes all of: model-weight
                         storage check, index-storage check, RAM headroom
                         check, VRAM headroom check, production-isolation
                         check, endpoint connectivity check, benchmark
                         telemetry check.
Next authorized action:  None. Phase 2 implementation of R1-R5 cannot
                         proceed until the operator selects A/B/C and the
                         chosen environment passes the exit-criteria checks
                         above.
Prohibited action:       Do not free disk space on vanguard-proposer,
                         AskMo, or vandropro by deleting files without
                         explicit operator review — all four nodes carry
                         live production workloads (Auditor, LNES-11
                         Proposer, bio-proxy/std inference, swarm harness).
                         Do not download any 4B-class model to a node
                         without first confirming it fits in actual free
                         disk.
Owner:                   Operator (Seven Ezumba)
Last verified:           2026-08-06
Public-claim impact:     None — this benchmark is not claimed anywhere as
                         run or complete. Does not affect the existing,
                         already-reproduced LNES-58 Head-to-Head report
                         (S0/legacy sparse baseline), which is unaffected
                         by this blocker.
```

## BLK-008 — Exposed Vanguard Auditor Benchmark Credential

```
Status:                  SECURITY_ROTATION_REQUIRED
Discovered:              2026-07-20 (prior session; re-verified and scope
                         expanded 2026-08-06)
Subsystem:               LNES58_Multihop_Bench RAG harness
                         (`rag_common.py`) and its planned reuse as the
                         generator client for modern_rag_benchmark
                         (S0/R1-R5 arms all call the same Auditor
                         endpoint via this pattern).
Blocker class:           AUTHORIZATION_CREDENTIAL
Current verified state:  `rag_common.py` line 17 hardcodes a fallback
                         bearer token via environment variable
                         `VANGUARD_KEY` (`os.environ.get("VANGUARD_KEY",
                         "<REDACTED>")`) — confirmed by direct file read,
                         2026-08-06. Truncated identifier:
                         `sk-vangu***REDACTED***-v1` (28 chars total; full
                         value withheld from this register per operator
                         instruction — see Credential fingerprint below
                         for independent verification). This exact token
                         string was NOT found in the distributed
                         `ExergyNet_xLMP_RAG_Internal_Review` package sent
                         to reviewers (checked
                         `xlmp_benchmark_adapter_contract.py` directly —
                         no match), so that specific package is not an
                         additional exposure vector.
                         SCOPE EXPANDED BEYOND THE BENCHMARK: the identical
                         `sk-vangu***REDACTED***-v1` fallback also appears,
                         hardcoded the same way, in
                         `portal/biological_proxy/index.js`,
                         `portal/src/app/api/voice/lyrics/route.ts`, and
                         `portal/src/lib/xlmp_ds_core.ts`, across commits
                         f904e71, 227a3c7, 45587de, ab2efa8
                         (biological_proxy/index.js), 1153d40
                         (voice/lyrics/route.ts), and 5b96285
                         (xlmp_ds_core.ts) — confirmed via `git log --all
                         -S "apex-internal" --name-only`, 2026-08-06.
                         Those commits are reachable from `origin/main`
                         (`github.com/ezumba/exergynet-site.git`) —
                         confirmed via `git log origin/main -S
                         "apex-internal"` after `git fetch origin`,
                         2026-08-06 — meaning this token has been pushed
                         to that remote, not just present in an untracked
                         local file.
                         WHETHER THE TOKEN IS/WAS EVER A VALID BEARER
                         TOKEN ON THE PRODUCTION A10 ENDPOINT IS STILL
                         UNVERIFIED — this was flagged pending in
                         2026-07-20 and remains unresolved; no live
                         auth-acceptance test has been run against
                         `40.124.170.30` this session (none authorized).
Evidence:                Direct read of `LNES58_Multihop_Bench/
                         rag_common.py`; direct read of
                         `ExergyNet_xLMP_RAG_Internal_Review/xlmp/
                         xlmp_benchmark_adapter_contract.py` (no match);
                         `git log --all -S "apex-internal" --name-only`;
                         `git log origin/main -S "apex-internal"`
                         post-fetch. All 2026-08-06, this session.
Credential fingerprint:  SHA-256 of the full literal value:
                         7a40e2c85da2a011c7f72dc270b51288f43c90573c7db08
                         ee5294e1ecf1e413f — for independent verification
                         against the plaintext without reproducing it in
                         this register. Full value withheld from this
                         file per operator instruction, 2026-08-06.
Exact unblock condition: Operator verifies whether
                         `sk-vangu***REDACTED***-v1` (env var
                         `VANGUARD_KEY`) is/was a live, accepted bearer
                         token on the Auditor endpoint. If
                         valid: rotate it, update the production server to
                         reject the old value, and replace every
                         hardcoded fallback occurrence (harness and Portal
                         routes) with a required environment variable
                         (no silent fallback). If never valid: still
                         replace the hardcoded-fallback pattern before any
                         wider benchmark run increases traffic through it,
                         since the pattern itself (silent fallback to a
                         literal secret-shaped string, now in public git
                         history) is the underlying defect regardless of
                         current validity.
Next authorized action:  None beyond continued read-only verification.
                         Explicitly NOT authorized this session: rotating
                         the credential, editing `rag_common.py` or any
                         Portal route file, or live-testing the token
                         against the production endpoint.
Prohibited action:       Do not rotate, invalidate, or test the credential
                         without explicit operator authorization. Do not
                         edit any file to remove/replace the hardcoded
                         fallback as part of this blocker registration —
                         that is remediation work, not recon, and is out
                         of scope for this entry.
Owner:                   Operator (Seven Ezumba)
Last verified:           2026-08-06
Public-claim impact:     None claimed in the white paper. Flag for
                         `LWP_MAINTENANCE_POLICY.md` review only if/when
                         this benchmark's results are cited publicly —
                         not before.
```

---

## Revision log for this register

| Date | Change | Reason |
|---|---|---|
| 2026-08-06 | Added BLK-008 (exposed Vanguard Auditor benchmark credential, SECURITY_ROTATION_REQUIRED). | No existing entry covered the hardcoded `sk-vangu***REDACTED***-v1` (`VANGUARD_KEY`) fallback token; re-verification found it also pushed to `origin/main` via multiple Portal route files, not just the benchmark harness — scope is broader than originally logged in memory on 2026-07-20. |
| 2026-08-06 | Added BLK-007 (modern RAG benchmark resource isolation), then revised same day with operator-supplied resolution options A/B/C and formal exit criteria. | Phase 1 recon for the modern-RAG-vs-xLMP benchmark directive found, via live SSH checks, that no fleet node has both spare VRAM and spare disk for the R1-R5 arms; registering per this file's own NON-NEGOTIABLE discovery rule before Phase 2 implementation starts. Operator then supplied the resolution-path structure (temporary dedicated node / CPU-only retrieval / fleet reallocation) and the checklist that defines when the blocker is actually resolved. |
| 2026-08-05 | Register created (6 entries: BLK-001..BLK-006), replacing an earlier undifferentiated "resource-blocked" list that mis-classified several credential/network/dependency blockers as resource blockers. | Operator correction: remediation paths differ by blocker class; a single "resource-blocked" label obscured that. |

**Related:** `VAULT_LEDGER.md` (current-state facts), `LWP_MAINTENANCE_POLICY.md`
(white-paper status-claim discipline — several `Public-claim impact` fields
above feed directly into that document's revision log).
