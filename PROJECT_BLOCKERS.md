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

## BLK-010 — Model-health verification session — network access, recurrence of BLK-009 pattern

```
Subsystem:               A read-only, zero-write model/service health
                          verification pass (post-benchmark consolidation
                          work) needed SSH-level access to two production
                          hosts and a direct application port on one of
                          them; a separate, unauthenticated HTTPS path to
                          the same hosts' public-facing domains worked
                          normally throughout.
Blocker class:            NETWORK_OPERATIONAL
Status:                   OPEN. Same symptom shape as BLK-009 (connections
                          silently time out rather than refuse, consistent
                          with an IP-allowlist boundary rather than a host
                          outage) but not yet confirmed as the identical
                          root cause — the operator's egress address for
                          this specific session was not independently
                          checked against the allowlist before this entry
                          was recorded, so "expired temporary entry from
                          BLK-009" is the leading hypothesis, not a
                          confirmed finding.
Current state:            HTTPS access to public application domains
                          confirmed healthy throughout (app serving, one
                          API layer confirmed live). One dependent
                          service's HTTP gateway responded successfully
                          but returned its own built-in degraded-fallback
                          message rather than a real completion, meaning
                          at least one backend reasoning service is not
                          currently reachable by its own gateway either —
                          a separate, real finding from the SSH-access
                          question, not explained by it alone.
Exact unblock condition:  Operator adds a temporary, narrowly-scoped
                          inbound allowlist entry for the current session's
                          egress address (same remediation shape as
                          BLK-009), or confirms an alternate access path
                          (e.g., a session-manager-style path referenced
                          as available for one of the two hosts) is usable
                          instead of direct SSH.
Re-check performed:       Re-tested same-session per a follow-up directive
                          instruction not to assume the timeout permanent.
                          Direct SSH still times out identically; a
                          session-manager-style alternate path could not be
                          exercised from this environment because its
                          required client tooling is not installed here (a
                          local-environment gap, not evidence the path
                          itself is unavailable). Recorded as UNKNOWN, not
                          DOWN, per that instruction — no production host
                          confirmed offline, only unreachable from this
                          specific session.
Owner:                    Operator
Last verified:            2026-08-08 (re-checked same day)
Public-claim impact:      None — blocks a verification step, not a
                          deployed capability. The degraded backend
                          reasoning service noted above is not separately
                          claimed as fully healthy anywhere public-facing.
```

## BLK-011 — Exposed credential in a local CLI tool's help text

```
Subsystem:               A locally-run deployment/diagnostic CLI tool used
                          for authorized production-host operations prints
                          a configuration-example block when invoked with
                          a standard help flag; that block was found to
                          contain what appears to be a real, current
                          credential value in plaintext, alongside other
                          real (non-placeholder) configuration values, not
                          a placeholder.
Blocker class:            AUTHORIZATION_CREDENTIAL
Status:                   OPEN, ESCALATED. Root-caused to a specific commit
                          that added the literal credential to the CLI
                          tool's help text; that commit was found to be an
                          ancestor of the public remote's default branch
                          and present on multiple pushed branches — this
                          credential has been in public, not merely
                          locally, exposure. Flagged to the operator with
                          the escalated severity; operator's decision:
                          rotate through their own account/hosting flow
                          now, outside this tool's own commands.
Current state:            The CLI tool's help text has been corrected to
                          placeholders (source of the exposure closed —
                          this cannot recur on a future invocation).
                          Rotation itself is in progress on the operator's
                          own side; not independently verified complete as
                          of this entry. Git history has NOT been rewritten
                          — the exposed value remains readable in past
                          commits/branches on the public remote unless and
                          until the operator separately decides to pursue
                          a history rewrite, which was raised as a distinct,
                          more invasive follow-up option and not yet
                          authorized.
Exact unblock condition:  Operator confirms the credential has been
                          rotated and the old value no longer authenticates
                          (verification not yet performed in this pass —
                          see Priority 1's other unblock note below).
                          Separately, and independently of rotation: a
                          decision on whether to pursue a git-history
                          rewrite to remove the old value from public
                          history, given the exposure already occurred and
                          a rewrite requiring a force-push carries its own
                          real risk.
Owner:                    Operator
Last verified:            2026-08-08 (escalated same day as initial
                          discovery, after tracing the commit history)
Public-claim impact:      None directly public-facing, but the underlying
                          exposure itself was public (repository history)
                          — noted for completeness, not because any
                          external claim about ExergyNet's security posture
                          needs correcting as a result.
```

## BLK-012 — "Pro" tier reasoning model — GPU capacity

```
Status:                   BLOCKED_RESOURCE_DECISION
Subsystem:                A higher-reasoning-tier model alongside this
                          project's existing coding-focused and auditing
                          inference tiers, intended to run on a GPU node
                          that already hosts one other production workload.
Blocker class:            INFRASTRUCTURE_RESOURCE
Current state:            Live verification (direct access to the node)
                          confirmed the previously-deployed model for this
                          tier was failing to allocate accelerator memory
                          and silently falling back to CPU execution —
                          technically running, but far too slow to be
                          usable. Root cause: the node's accelerator memory
                          is already split with an existing production
                          workload, leaving materially less headroom than
                          the accelerator's full rated capacity. Separately
                          confirmed across the fleet: no GPU-equipped node
                          anywhere in the current compute inventory is idle
                          — all are already serving at least one production
                          workload, so none can absorb this tier without
                          contending against something already live.
Blocked work:             Standing up a working, adequately-fast model for
                          this reasoning tier.
Not blocked:              The existing coding-focused and auditing tiers,
                          which run on their own separate, uncontended
                          accelerators and were independently confirmed
                          healthy during this same verification pass.
Update 2026-08-10 (later same day): Confirmed this same constrained
                          tier is reached by a second, independent
                          application (a separate chat product's
                          "deep research" feature, via its own gateway
                          routing) — a lightweight request to that tier
                          succeeds, but a heavier one (larger context +
                          larger output budget) reproduces a real,
                          user-facing failure with the exact accelerator
                          out-of-memory signature already found on the
                          node directly. Confirms this isn't
                          borderline — it fails under realistic load, not
                          just heavy synthetic load. Interim mitigation
                          deployed in that second application only:
                          its heaviest call to this tier temporarily
                          uses the healthy coding-focused tier instead,
                          disclosed in-code as temporary and reversible.
                          Does not change anything below — still blocked
                          on new hardware, no capacity was added.
Resolution options:       (A) provision a new GPU-equipped node dedicated
                          to this tier (operator's stated direction —
                          real cost and lead time, not a config change);
                          (B) reduce the co-located workload's accelerator
                          footprint on the existing node to free enough
                          headroom for a smaller model in this tier; (C)
                          accept a smaller model sized to the currently
                          free headroom on the existing shared node as an
                          interim step.
Exact unblock condition:  Operator provisions and confirms a new GPU node
                          (option A, chosen); this tier's model is deployed
                          there and passes a live load-and-inference check
                          without falling back to CPU or contending with
                          another workload's memory.
Owner:                    Operator (hardware procurement)
Last verified:            2026-08-10 — live SSH verification of the node's
                          accelerator memory, running processes, and the
                          previously-deployed model's own logs.
Public-claim impact:      None — this tier is not currently claimed
                          anywhere as deployed or production-ready.
```

## BLK-013 — Auditing-tier inference node — credential not provisioned for proxy path

```
Status:                   PARTIAL_MITIGATION
Subsystem:                A higher-fidelity auditing-tier inference node
                          reachable from the main inference gateway but not
                          directly credentialed for the application-layer
                          proxy that routes certain model-named requests.
Blocker class:            AUTHORIZATION_CREDENTIAL
Current state:            The auditing node requires bearer credentials. The
                          main gateway calls it as part of a multi-engine race
                          without a credential — calls fail 401 silently and
                          the race is won by another engine. A separate
                          application-layer proxy that routes external requests
                          directly to this node also lacked a valid credential,
                          producing 502 "Vanguard unavailable" errors to
                          callers using the auditor-named model. A code-level
                          fallback has been deployed (2026-08-10, OTET
                          otet-a9be128f62ecb2a215a032c0a0d93b2f992900b55777f459)
                          on the proxy: 401/403 from the auditor now routes
                          transparently to the primary proposer instead of
                          502ing the caller.
                          Additional work 2026-08-10 (this session): structured
                          telemetry added to both the race path (event:
                          auditor_attempted, auditor_status, auditor_latency_ms,
                          auditor_failure_class fields logged on every race call)
                          and the proxy fallback path (event: vanguard_routing_fallback
                          with requested_model, served_backend, fallback_used,
                          fallback_reason). A code hook (AUDITOR_AUTH_TOKEN env
                          var) was wired into the race path so that when the
                          operator provisions the credential, no further code
                          change is needed.
                          The Nemotron-tier model is therefore not serving any
                          external traffic through either path, but external
                          callers no longer receive errors and all fallback events
                          are now visible in structured logs.
Blocked work:             Actually serving the auditing-tier model to external
                          callers via the proxy path; completing the multi-engine
                          race in the main gateway.
Not blocked:              All primary proposer paths; standard inference routes;
                          the fallback now in place for the proxy path;
                          structured log observability for fallback events.
Exact unblock condition:  (1) Provision the auditing node with a bearer
                          credential. (2) Set AUDITOR_AUTH_TOKEN in the main
                          inference gateway env (race path — hook already wired).
                          (3) Set the same credential in the proxy-layer env
                          (NVIDIA_NIM_KEY or equivalent). (4) Confirm 200
                          responses on the auditor-routed model path.
Owner:                    Operator
Last verified:            2026-08-10
Public-claim impact:      None — the auditing tier is not currently claimed
                          anywhere as available through the external API.
```

---

## Revision log for this register

| Date | Change | Reason |
|---|---|---|
| 2026-08-10 | Updated BLK-012 — confirmed a second application also fails against this same tier under realistic (not just synthetic) load, matching accelerator-OOM signature; deployed a temporary model-swap mitigation in that application only | Deep-research feature in a separate chat product was returning a user-facing synthesis failure; investigation traced it to the same constrained reasoning tier tracked in BLK-012, reproduced with the exact CUDA out-of-memory error already seen directly on the node. A lightweight probe against the tier had misleadingly succeeded earlier the same day, masking the issue until a realistically-sized request was tried. No new capacity added — this is scope confirmation and a stopgap, not a resolution. |
| 2026-08-10 | BLK-013 updated: added structured telemetry to race path (auditor_attempted/status/latency/failure_class) and proxy fallback path (vanguard_routing_fallback); wired AUDITOR_AUTH_TOKEN env hook so operator provisioning requires no further code change | MYMONITOR/Vanguard recovery session — AskMo callAuditorHttp() telemetry patch deployed, Portal fallback observability deployed via OTET (otet-5e1c093e2086eb8b962c43577416d278d1966eb61b3a5b9b) |
| 2026-08-10 | Added BLK-013 (partial mitigation, auditor credential); added BLK-012 (open, GPU capacity) | BLK-013: MYMONITOR/Vanguard production recovery — traced 502 "Vanguard unavailable" to auditor node lacking credentials in both the gateway race path and the proxy path; deployed proxy-level fallback to eliminate the 502 while auditor credential provisioning is pending (OTET otet-a9be128f62ec…). BLK-012: |
| 2026-08-10 | Added BLK-012 (open, GPU capacity) | Live SSH verification during a "should we run a new open-weight model" investigation found the existing "Pro" tier model was OOM-falling-back to CPU on a GPU node already shared with another production workload; fleet-wide check confirmed no idle GPU node exists anywhere to absorb it. Operator chose to provision new hardware rather than share/shrink existing capacity; work paused pending that procurement. |
| 2026-08-08 | Added BLK-010 (open, network access) and BLK-011 (open, exposed CLI credential) | Discovered during post-LNES-59 model-health consolidation pass: production-host SSH access unreachable from this session (same symptom shape as BLK-009, not yet confirmed identical root cause) prevented full model-restoration work; separately, a local CLI tool's `--help` output was found to print a real credential in plaintext, flagged to the operator, rotation deferred at operator's request |
| 2026-08-07 | Added BLK-009 (resolved) — a one-time read-only production diagnostic was initially blocked by a stale IP-allowlist entry, then unblocked after the operator added a temporary allowlist entry for their current address. | Discovered-and-resolved blocker during LNES-58.11 production root-verification compatibility work; recorded per this register's standing update rule even though resolution happened within the same session. |
| 2026-08-06 | Published a fully sanitized version of this register (all entries), replacing the operational version that contains infrastructure specifics. The unsanitized version remains available privately, outside this repository. | This repository is public; the register's working-detail version must never be pushed. A clean, safe-to-review version was needed so governance status can eventually be shared without exposing infrastructure topology. |
| 2026-08-05 | Register created (6 entries), replacing an earlier undifferentiated "resource-blocked" list that mis-classified several credential/network/dependency blockers as resource blockers. | Operator correction: remediation paths differ by blocker class; a single "resource-blocked" label obscured that. |

**Related:** A separate, private vault-state reference and white-paper
status-claim policy exist outside this repository and are not detailed here.
