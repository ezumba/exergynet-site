# Project Blocked-Work Register

**Canonical location.** This file — not any Claude memory directory — is the
authoritative record of work paused on a specific, named blocker.

A future machine, operator, or non-Claude agent may not have access to any
specific agent's memory system. This file must remain readable and correct
independent of any specific agent's memory system.

This repository is under git (`main` branch) and is **public**. This
version of the register is deliberately sanitized: it contains no IP
addresses, private file paths, service topology, secret fingerprints, or
incident-response commands. A separate, unsanitized working copy with full
operational detail exists outside this repository for operator and
authorized-agent use; it is not reproduced here. If the two ever disagree,
the private copy is authoritative for operational decisions, but this file
is authoritative for what may be safely published.

---

## Blocker taxonomy

Not all paused work is blocked for the same reason, and the remediation path
differs by class. Tag every entry with exactly one of:

| Class | Meaning | Remediation shape |
|---|---|---|
| `INFRASTRUCTURE_RESOURCE` | A running system lacks capacity (disk, RAM, quota) | Provision more, or reduce footprint |
| `AUTHORIZATION_CREDENTIAL` | Work is built/ready but needs a key, signature, or explicit go-ahead | Operator provides the credential/authorization |
| `COMPUTE_ARCHITECTURE_RESOURCE` | The current design doesn't fit in available compute at target scale | An architecture decision, not just more hardware |
| `BUILD_MACHINE_RESOURCE` | A specific build/tooling step needs a bigger machine than currently available | Access to adequate hardware |
| `NETWORK_OPERATIONAL` | A process, tunnel, or host is down or unreachable | Diagnose and restore connectivity |
| `DEPENDENCY_PREREQUISITE` | Blocked on other unfinished work, not on any resource | Complete the prerequisite(s) |

## Common record structure

```
ID
Subsystem (generic description only)
Blocker class
Status
Current state (high level, no infrastructure specifics)
Exact unblock condition
Owner
Last verified
Public-claim impact
```

---

## BLK-001 — Sovereign RPC node disk exhaustion

```
Subsystem:               A blockchain RPC node used by this project.
Blocker class:            INFRASTRUCTURE_RESOURCE
Status:                   DOWN — disk full on legitimate, non-deletable
                          chain data.
Exact unblock condition:  Operator chooses between resizing storage
                          (recurring cost) or reconfiguring as a pruned
                          node and resyncing (one-way operation).
Owner:                    Operator
Last verified:            2026-08-05
Public-claim impact:      None — not currently claimed as deployed/relied
                          upon in the white paper.
```

## BLK-002 — Secondary settlement contract, legacy mock verifier

```
Subsystem:               A secondary on-chain settlement contract pathway
                          using a mock (non-production-grade) verifier.
Blocker class:            AUTHORIZATION_CREDENTIAL
Status:                   Built and compiling, not deployed. Explicitly
                          must never route real capital — superseded by a
                          real-verifier effort in progress.
Exact unblock condition:  Operator supplies a deployment key and explicit
                          deployment authorization; that authorization
                          covers deployment only, not routing real capital.
Owner:                    Operator
Last verified:            2026-08-03
Public-claim impact:      None — not currently claimed as deployed.
```

## BLK-003 — Production-scale ZK verifier — compute architecture

```
Subsystem:               A production-scale zero-knowledge proof verifier
                          circuit.
Blocker class:            COMPUTE_ARCHITECTURE_RESOURCE
Status:                   A smaller-scale version of the circuit is
                          validated end-to-end against real proof data.
                          Scaling tests show memory requirements grow
                          faster than linearly; the full production target
                          is estimated at roughly 30x current build
                          capacity.
Exact unblock condition:  An architecture decision among: a substantially
                          larger build environment, recursive proof
                          aggregation, constrained query deduplication, or
                          a different wrapper architecture. Not yet chosen.
Owner:                    Operator (architecture decision)
Last verified:            2026-08-03
Public-claim impact:      The relevant public claim already correctly
                          states this capability as not yet an active
                          production feature; no change needed for this
                          entry specifically.
```

## BLK-004 — ZK proof packaging for the smaller-scale circuit — build-machine resource

```
Subsystem:               EVM-verifiable packaging of the validated
                          smaller-scale proof circuit referenced in
                          BLK-003.
Blocker class:            BUILD_MACHINE_RESOURCE
Status:                   Packaging tooling exhausts available memory on
                          the current build environment before completing,
                          even for the smaller-scale case.
Exact unblock condition:  Access to a build machine with substantially
                          more RAM and disk than currently available.
Owner:                    Operator (machine procurement decision)
Last verified:            2026-08-03
Public-claim impact:      Supports an already-made public distinction
                          between "smaller-scale circuit validated" and
                          "full packaging still blocked."
```

## BLK-005 — An internal relay/tunnel process — network outage

```
Subsystem:               An internal process that forwards traffic to one
                          fleet node.
Blocker class:            NETWORK_OPERATIONAL
Status:                   Process down, crash-looping on a connection
                          failure to its target host. Whether any
                          user-facing feature actually depends on this
                          specific path has not been confirmed — a
                          separate request path may exist for the same
                          feature.
Exact unblock condition:  (1) Confirm whether the target host is running;
                          restore if stopped. (2) Independently trace
                          whether the feature this was assumed to support
                          actually depends on it, before concluding
                          anything about that feature's health.
Owner:                    Operator / next investigating agent
Last verified:            2026-08-05
Public-claim impact:      None — the dependent capability was never
                          claimed as deployed in the white paper.
```

## BLK-006 — Internal gateway service — production readiness

```
Subsystem:               An internal API gateway service, currently
                          running in a mock-only mode.
Blocker class:            DEPENDENCY_PREREQUISITE
Status:                   Scaffolded and stable in mock mode; not
                          production-ready.
Exact unblock condition:  (1) A secure authenticated channel to replace
                          the mock signer, and (2) real credential
                          verification wired to a real ledger. Both
                          required before production use.
Owner:                    Operator
Last verified:            2026-08-05
Public-claim impact:      None — not claimed as deployed.
```

## BLK-007 — Modern-RAG-vs-xLMP benchmark — fleet resource isolation

```
Status:                   BLOCKED_RESOURCE_DECISION
Subsystem:               A planned benchmark comparing this project's
                          memory architecture against modern retrieval-
                          augmented-generation approaches, requiring
                          several dense-retrieval/reranking models running
                          alongside an existing production inference
                          service.
Blocker class:            INFRASTRUCTURE_RESOURCE
Current state:            No node in the current compute fleet has both
                          sufficient free accelerator memory and free disk
                          to run the additional retrieval/reranking
                          workload without risking an existing production
                          service. Verified directly across the fleet.
Blocked work:             The retrieval and reranking arms of the planned
                          benchmark, plus its larger-scale test phases.
Not blocked:              Design/methodology work, and any component that
                          can run on ordinary CPU resources if separately
                          authorized.
Resolution options:       (A) a temporary dedicated GPU node; (B) a
                          dedicated CPU-only node with results labeled
                          accordingly; (C) reallocating existing fleet
                          capacity, which requires an explicit production-
                          impact analysis and rollback plan first.
Exact unblock condition:  Operator selects one of the above and the chosen
                          environment passes standard readiness checks
                          (storage, memory headroom, production isolation,
                          connectivity).
Owner:                    Operator
Last verified:            2026-08-06
Public-claim impact:      None — this benchmark is not claimed anywhere as
                          run or complete.
```

## BLK-008 — Exposed inference-service credential — remediation in progress

```
Status:                   PARTIALLY_REMEDIATED
Subsystem:               A bearer credential used by several internal
                          services to call this project's internal
                          inference endpoint. The credential was found
                          hardcoded as a fallback default in multiple
                          places, including in a form reachable from this
                          repository's own public history.
Blocker class:            AUTHORIZATION_CREDENTIAL
Current state:            A real, enforced authorization boundary has been
                          deployed in front of the inference endpoint
                          (previously, no such enforcement existed at all
                          — this is itself a significant finding, not
                          merely "a credential leaked"). It fails closed on
                          missing or invalid credentials, exempts only a
                          minimal health-check route, and applies
                          independent rate limits per credential identity.
                          One of two production clients has been migrated
                          to a dedicated new credential, had its hardcoded
                          fallback removed, and been verified healthy
                          end-to-end. The second client's credential
                          delivery is blocked by a legitimate application-
                          level control on that service refusing to accept
                          secret-shaped files through its normal deployment
                          path — not yet resolved, and that client's source
                          has deliberately not been touched, since removing
                          its fallback before it has a working credential
                          would break it. A temporary, narrowly source- and
                          route-scoped continuity measure is in place for
                          that second client while its permanent delivery
                          path is completed, with a hard expiry.
                          Separately, real infrastructure (an access-
                          control role scoped to reading exactly one
                          secret) has been created for the second client's
                          permanent credential delivery, but cannot yet be
                          confirmed working end-to-end pending a host-level
                          check outside currently available access.
Former value status:      Confirmed rejected by the new authorization
                          boundary.
Identity separation:      A distinct credential exists for production
                          traffic and a separate one for future benchmark
                          traffic; the benchmark identity is additionally
                          restricted to inference-only routes. Verified.
Managed-secret migration: An interim, file-based secret storage approach
                          is explicitly temporary. A move to a proper
                          managed secret store is required within 14 days
                          of this entry's last-verified date.
Historical exposure
review:                   Access-log review completed for the full
                          retained window; retention does not reach back
                          to the original exposure date — roughly the
                          first 8-9 days after exposure are permanently
                          unobservable. No anomalies found in what is
                          retained; this is not the same as ruling out
                          compromise in the unobservable period. Local
                          historical-record remediation is substantially
                          complete, with a small number of items requiring
                          further operator decision, tracked privately.
Exact unblock condition:  (1) Resolve the second client's credential-
                          delivery path. (2) Complete the managed-secret
                          migration before its deadline. (3) Resolve the
                          remaining privately-tracked historical-record
                          items.
Owner:                    Operator
Last verified:            2026-08-06
Public-claim impact:      None claimed in the white paper. Review only if
                          this work is ever cited publicly.
```

## BLK-009 — Production-host read-only diagnostic — network access, resolved

```
Subsystem:               A read-only, zero-write diagnostic (a production
                          content-commitment compatibility sweep) needed to
                          run once against one production host.
Blocker class:            NETWORK_OPERATIONAL
Status:                   RESOLVED. The diagnostic's required inbound access
                          was blocked by a stale IP-allowlist entry — the
                          operator's current egress address had changed
                          since the allowlist was last updated, so
                          connections were silently dropped rather than
                          refused (this looks identical to a host-down
                          outage from the client side; it was not one).
                          The diagnostic completed successfully after the
                          allowlist was updated to include the operator's
                          then-current address, and produced a clean
                          compatibility result across a sampled subset of
                          eligible production objects.
Exact unblock condition:  (met) Operator added a temporary, narrowly-scoped
                          inbound allowlist entry for their then-current
                          address. That entry is itself time-boxed and
                          should be cleaned up by the operator once no
                          longer needed, same as the prior temporary entry
                          it sits alongside.
Owner:                    Operator
Last verified:            2026-08-07
Public-claim impact:      None — this blocked a one-time verification step,
                          not a deployed capability; nothing changed about
                          what's live.
```

---

## Revision log for this register

| Date | Change | Reason |
|---|---|---|
| 2026-08-07 | Added BLK-009 (resolved) — a one-time read-only production diagnostic was initially blocked by a stale IP-allowlist entry, then unblocked after the operator added a temporary allowlist entry for their current address. | Discovered-and-resolved blocker during LNES-58.11 production root-verification compatibility work; recorded per this register's standing update rule even though resolution happened within the same session. |
| 2026-08-06 | Published a fully sanitized version of this register (all entries), replacing the operational version that contains infrastructure specifics. The unsanitized version remains available privately, outside this repository. | This repository is public; the register's working-detail version must never be pushed. A clean, safe-to-review version was needed so governance status can eventually be shared without exposing infrastructure topology. |
| 2026-08-05 | Register created (6 entries), replacing an earlier undifferentiated "resource-blocked" list that mis-classified several credential/network/dependency blockers as resource blockers. | Operator correction: remediation paths differ by blocker class; a single "resource-blocked" label obscured that. |

**Related:** A separate, private vault-state reference and white-paper
status-claim policy exist outside this repository and are not detailed here.
