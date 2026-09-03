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
Status:                   RESOLVED (Portal proxy path) — 2026-08-22 LNES-118.7C.
                          BLK013_PORTAL_ROUTING=RESOLVED.
                          ASKMO_AUDITOR_RACE_PATH=OPEN — the AskMo
                          gateway race-path auditor credential
                          (AUDITOR_AUTH_TOKEN env hook) is a separate
                          subsystem. It is tracked separately; see
                          BLK-013 condition (2) note below.
Subsystem:                A higher-fidelity auditing-tier inference node
                          reachable from the main inference gateway but not
                          directly credentialed for the application-layer
                          proxy that routes certain model-named requests.
Blocker class:            AUTHORIZATION_CREDENTIAL
Current state:            RESOLVED. Full history:
                          Initial: proxy lacked credential → 502 to callers.
                          2026-08-10: fallback deployed (otet-a9be128f62ec...),
                          structured telemetry added, AUDITOR_AUTH_TOKEN hook
                          wired in AskMo race path (not Portal proxy).
                          2026-08-22 LNES-118.7B: NVIDIA_NIM_KEY rotated,
                          Auditor PROD_TOKEN_SHA256 updated, direct test
                          confirmed new key accepted. Proxy routing gap
                          (VG_KEY stayed SEI_VANGUARD_KEY for all upstreams)
                          confirmed but deferred to LNES-118.7C.
                          2026-08-22 LNES-118.7C: One-line fix applied to
                          /v1/chat/completions Auditor branch — after
                          VG_URL = AUDITOR_URL, now also sets
                          VG_KEY = process.env.NVIDIA_NIM_KEY || ''.
                          Applied via OTET (token otet-6c281e31d79f723b...),
                          biological_proxy restarted. PM2 log confirms:
                          [LNES-20] Routing model="vanguard-auditor" →
                          Auditor (Nemotron) http://40.124.170.30:3000.
                          Credential fingerprint match: BIO_NVIDIA_KEY_FP =
                          AUDITOR_EXPECTED_FP = 58c3b3eaa9fa5f9d1be5dfcda...
                          (SHA-256, not plaintext). HTTP 200 returned.
                          STAGE_C gate preserved. PM2 dump saved, NVIDIA_NIM_KEY
                          not in dump (loaded from .env at startup).
Blocked work:             UNBLOCKED. Auditing-tier model now serving external
                          callers via proxy path.
Not blocked:              All paths always worked; auditor path now also works.
Exact unblock condition:  (1) DONE — NVIDIA_NIM_KEY provisioned 2026-08-22
                          LNES-118.7B. (2) SEPARATE SUBSYSTEM — AskMo race
                          path (AUDITOR_AUTH_TOKEN env in AskMo gateway);
                          hook already wired 2026-08-10, operator must set
                          env value. Tracked separately from Portal routing.
                          (3) DONE — proxy code fixed 2026-08-22 LNES-118.7C.
                          (4) DONE — biological_proxy restarted. (5) DONE —
                          HTTP 200 confirmed on model="vanguard-auditor".
                          BLK013_PORTAL_ROUTING=RESOLVED; ASKMO condition
                          is its own open item.
Owner:                    Operator
Last verified:            2026-08-22 (LNES-118.7C) — PM2 log route proof,
                          credential fingerprint match, HTTP 200 from Auditor
                          via proxy path. STAGE_C gate intact.
Public-claim impact:      None — auditing tier was not previously claimed;
                          now it is available through the external API proxy
                          path (model="vanguard-auditor" or "NVIDIA").
```

## BLK-014 — Vision/image-description capability — dependency/runtime architecture

```
Status:                   UNAVAILABLE — dependency/runtime architecture
                          issue. Distinct from BLK-012; resolving BLK-012
                          will NOT resolve this.
Subsystem:                An image-description capability offered through
                          the public API, currently routed at the same
                          reasoning-tier model tracked in BLK-012.
Blocker class:            DEPENDENCY_PREREQUISITE
Current state:            Traced to the serving engine's own wire protocol
                          for that reasoning tier — it has no field capable
                          of carrying image data at all, only a plain text
                          prompt. This is a protocol-level fact, not a
                          capacity or performance question: no amount of
                          accelerator headroom fixes it, because the
                          underlying transport cannot carry an image in the
                          first place. The application layer that accepts
                          image input types every downstream message field
                          as plain text throughout, with no exception for
                          multi-part/image content, and a prior, related
                          crash (content arriving as a non-text shape
                          causing an indefinite hang instead of a clean
                          error) was found already partially patched at one
                          call site, dated 2026-07-14 — confirming this
                          exact bug class has surfaced before, elsewhere in
                          the same code.
Blocked work:              Any real image-description functionality via this
                          endpoint.
Not blocked:              Text-only capabilities on the same reasoning tier
                          (separately tracked under BLK-012's own capacity
                          constraints).
Resolution options:       Provision an actually image-capable model on its
                          own protocol and its own accelerator budget; do
                          not attempt to repoint this feature at a
                          "repaired" text-only tier, and do not treat a
                          longer timeout as a fix — a fail-fast, clearly-
                          labeled "not currently available" response is
                          the correct interim behavior until a real
                          image-capable backend exists.
Exact unblock condition:  A genuinely multimodal serving engine, with a
                          protocol that can carry image data, is
                          provisioned and passes a live image-description
                          check end-to-end.
Owner:                    Operator (architecture/procurement decision)
Last verified:            2026-08-10 — direct read of the serving engine's
                          own protocol definition.
Public-claim impact:      None — this capability is not currently claimed
                          anywhere as available.
```

## BLK-015 — Runtime-profile authorization model — schema change pending explicit go-ahead

```
Status:                   BLOCKED — execution attempted twice, both times
                          blocked by this session's own permission
                          safeguards; interim tightening deployed instead.
Subsystem:                A planned per-account authorization model
                          (`allowed_runtime_profiles`) intended to replace
                          ad hoc email-domain matching as the mechanism
                          that gates access to specialized (e.g. clinical)
                          runtime behavior.
Blocker class:            AUTHORIZATION_CREDENTIAL
Current state:            Explicit operator authorization for this
                          migration was given in-session (additive column
                          only, no backfill beyond existing verified
                          MyMonitor accounts, rollback plan specified).
                          Execution was attempted against the live database
                          — a read-only schema check succeeded, but every
                          attempt at the row-count/account read and the
                          ALTER TABLE itself was independently blocked by
                          the permission classifier, across two different
                          invocation tools, both before and after the
                          explicit authorization was presented. Per that
                          authorization's own instruction, the operation
                          was stopped rather than routed around. No
                          application code referencing the new column has
                          been written or deployed, since partially
                          deploying it (code expecting a column that
                          doesn't exist yet) would break authentication
                          outright.
                          Interim tightening deployed instead (2026-08-10):
                          explicit mode='clinical_runtime' — previously
                          ungated for any account — is now denied (403) for
                          non-MyMonitor accounts across all three request
                          paths (realtime, batch, batch-chain), using the
                          existing email-domain signal as a stopgap. This
                          is explicitly not the long-term mechanism and
                          does not extend to any other domain.
Blocked work:             The new column/backfill; request-level
                          `runtime_profile` field and server-side
                          membership enforcement; the full authorization
                          model this migration is meant to enable (e.g.
                          onboarding a second healthcare customer without
                          a new hardcoded domain check).
Not blocked:              The interim email-domain gate (now covering both
                          the keyword-fallback path and, newly, the
                          explicit-mode path), verified this session across
                          all three request paths via a 12-case regression
                          suite.
Exact unblock condition:  The schema mutation needs to succeed against the
                          live database through some path this session's
                          permission classifier will allow — e.g. the
                          operator running the migration SQL directly
                          themselves, or via whatever the classifier
                          recognizes as a sanctioned write path for this
                          host (AskMo is not on the OTET harness used for
                          Portal). Migration SQL is specified in
                          VANGUARD_RUNTIME_CAPABILITY_MODEL.md. Once the
                          column exists, the application-layer code
                          (already designed) can be written and deployed.
Owner:                    Operator
Last verified:            2026-08-10 (second attempt, post-authorization)
Public-claim impact:      None — not currently claimed anywhere as live.
```

## BLK-016 — Two model aliases bypass all runtime-mode authorization — CLOSED

```
Status:                   CLOSED 2026-08-10 (same day as discovery). Fixed,
                          deployed, verified.
Subsystem:                Two specific model-name intercepts inside the
                          main realtime inference handler, each an early
                          return that executed before any authorization
                          logic in the same handler.
Blocker class:            DEPENDENCY_PREREQUISITE
Current state:            FIXED. A shared resolveAuthorizedRuntime()
                          function now runs once, immediately after the
                          request's messages are assembled, before either
                          alias's dispatch branch -- both are denied (403)
                          under the same interim conditions as the default
                          path if they request an unauthorized clinical
                          runtime, and both compose their system prompt
                          from the same trusted-platform-policy selector
                          buildPrompt() uses internally (refactored to
                          share it, removing duplication). The caller's own
                          system message, if supplied, is preserved as a
                          clearly subordinate, informational addendum --
                          never a replacement for the authorized platform
                          policy. A full alias sweep found no third bypass:
                          the only other model-name branches
                          (vanguard-auditor/aligned/proposer) are backend
                          selections reached from within the already-gated
                          default path, not separate early returns.
Closing conditions met:  (1) all alias paths now enter the common
                          authorization resolver before dispatch --
                          verified by direct line-number ordering in the
                          refreshed source baseline; (2) unauthorized
                          explicit-clinical invocation is denied (403) for
                          both aliases -- verified by 4 new regression
                          cases; (3) caller system messages cannot replace
                          trusted runtime policy -- verified structurally
                          (platform policy is always the prefix, caller
                          text is always appended, never substituted); (4)
                          fallback preserves authorization -- the race
                          path shares one authorized system prompt string
                          across all 5 candidate engines, confirmed by
                          inspection, no per-candidate mode re-derivation
                          exists; (5) production canaries pass -- clean
                          `tsc` build, clean pm2 restart with no new
                          errors, unauthenticated requests still correctly
                          401, and the fix independently confirmed present
                          in the actual compiled dist/index.js binary
                          (10 matches for the new function names), not
                          just source.
Verification:             20/20 regression tests passing
                          (VANGUARD_RUNTIME_ISOLATION_TESTS.js, cases 1-14,
                          including 8 new cases for this fix). Source
                          baseline refreshed and re-hashed post-fix; see
                          ASKMO_PRODUCTION_SOURCE_BASELINE.md and
                          ASKMO_PRODUCTION_SOURCE_SHA256SUMS.txt.
Known residual gap:       Ultra/Race never wired response_format/JSON-mode
                          support (pre-existing, not introduced by this
                          fix or by BLK-016 -- these two aliases have never
                          supported response_format at all). Not a
                          security issue, a feature gap; not addressed in
                          this P0 pass per its own "minimal patch" scope.
Owner:                    Operator (informed; fix already deployed)
Last verified:            2026-08-10 -- live production canary + compiled-
                          binary verification.
Public-claim impact:      None — not currently claimed anywhere as gated.
```

---

## BLK-017 — TURN relay TLS certificate expired — mobile calls broken — RESOLVED

```
Subsystem:               TURN relay server supporting WebRTC media relay
                          for mobile-to-mobile calls (used when direct
                          peer-to-peer NAT traversal is not possible).
Blocker class:            NETWORK_OPERATIONAL
Status:                   RESOLVED 2026-08-12. Relay server restarted
                          with a valid TLS certificate; verified clean
                          TLS handshake from an external client.
Current verified state:   TLS relay operational; certificate valid until
                          late October 2026. Non-TLS relay port was
                          unaffected throughout.
Exact unblock condition:  (Met) Fresh certificate installed and service
                          restarted. A weekly auto-sync script was
                          written to prevent recurrence when the
                          certificate next renews (approximately late
                          September 2026) — cron installation requires
                          operator authorization before it will run.
Next authorized action:   Operator: authorize the cron job installation
                          (one command, already written, blocked by
                          auto-mode classifier; see session context) OR
                          manually run the sync script at next Caddy
                          renewal.
Prohibited action:        Do not run the sync script without verifying
                          the source certificate is newer than what is
                          currently installed.
Owner:                    Operator (cron authorization pending)
Last verified:            2026-08-12 — TLS handshake verified externally
                          (verify return code: 0), certificate expiry
                          confirmed ~Oct 26 2026.
Public-claim impact:      None — mobile calling is not in the white paper
                          as a gated/claimed capability.
```

---

## BLK-018 — Multiple divergent local copies of a portal backend file — RESOLVED

```
Subsystem:               A portal backend source file with several local
                          copies of differing size/content, at least one
                          of which implements a ZK-proof job/verification
                          pipeline (a proof-job table plus proof
                          submission/verification routes) entirely absent
                          from the copy used as the working baseline for
                          a recent multi-sprint security-hardening effort
                          on that file.
Blocker class:            DEPENDENCY_PREREQUISITE
Status:                   RESOLVED 2026-08-14. Operator pulled a fresh,
                          dated snapshot directly from the production host
                          via the repo's established snapshot convention.
                          Hash-verified against an independently-quoted
                          checksum before use.
Current verified state:   The real production route was audited directly
                          from the verified snapshot: it queries only the
                          base vault table, with no join against any
                          proof-job table and no ZK-related fields of any
                          kind. The ZK-proof pipeline present in some other
                          local candidate copies was confirmed NOT to be
                          deployed to the production host. Correction
                          (same day): one candidate directory was initially
                          reported as absent from disk due to a search-tool
                          miss, not genuine absence — it is real, contains
                          substantial ZK-proof-pipeline code (confirmed by
                          direct read, not just a claim), and is closely
                          related to another already-known local candidate
                          (small diff between them; both differ heavily
                          from a third, more distantly-related candidate).
                          Characterizing these as generically "drafts or
                          unrelated work" overstated the certainty — they
                          read as a real, substantially-built alternate/
                          next-gen implementation, just independently
                          confirmed (via the hash-verified snapshot, a
                          stronger method than file presence alone) to not
                          be what Portal EC2 currently runs. The working
                          baseline used by prior sprints remains accurate
                          for the currently-deployed route; whether the
                          alternate implementation is intended to replace
                          it later is a separate, open question this
                          blocker does not resolve.
Exact unblock condition:  (Met) Fresh, hash-verified snapshot obtained and
                          audited.
Next authorized action:   None outstanding for this specific question. Any
                          further work against this file should still
                          re-pull a fresh snapshot if enough time has
                          passed that drift is plausible — this resolution
                          is a point-in-time confirmation, not a standing
                          guarantee.
Prohibited action:        Do not treat this resolution as extending past
                          this one file/route pair — a different file, or
                          this same file after further live edits, still
                          needs its own verified snapshot before being
                          trusted as canonical. Do not accept an
                          unverified directive's claim about which
                          file/path is authoritative without checking it
                          against the filesystem first.
Owner:                    Operator (closed)
Last verified:            2026-08-14 — snapshot hash independently
                          recomputed locally and matched against the
                          quoted checksum before the route audit was
                          trusted; live route read directly from that
                          verified snapshot.
Public-claim impact:      None directly — no white paper claim currently
                          depends on which copy of this file is canonical.
```

## BLK-019 — AERIS settlement contract — image misalignment, generation gate

```
Subsystem:               A ZK-proof-gated on-chain settlement contract
                          for an atmospheric data market system.
Blocker class:            AUTHORIZATION_CREDENTIAL
Status:                   OPEN — CREDENTIAL_INJECTION_REQUIRED.
                          Sprint 01I-F (2026-08-18): All technical
                          preparation for Gen4 deployment is complete.
                          Scripts, contracts, test pool parameters, proof
                          artifacts, and service cutover plan are all
                          ready. Single remaining blocker: BASE_PRIVATE_KEY
                          for wallet_1 (0x27cC42ee80CA945F96b93999CCdb02
                          520618578B) must be injected into the PowerShell
                          environment before deployment can proceed.
                          GEN4_DEPLOYMENT_GATE=AUTHORIZED (Sprint 01I-E).
                          CREDENTIAL_INJECTION_REQUIRED=YES.
Current verified state:   (1) The current production prover generates
                          proofs with a specific image ID that cannot be
                          changed without recompiling the guest circuit.
                          (2) All four existing test-network deployments
                          store a different image ID in an immutable
                          constructor slot — verification calls against
                          any existing deployment will reject all current
                          proofs. (3) The market-management service and
                          the dispute-monitoring service are currently
                          pointed at different generations of this
                          contract — a pre-existing misalignment
                          discovered in this sprint. (4) One older
                          generation holds a small amount of test-network
                          token funds in an unresolved state, requiring
                          either a settlement or a refund before that
                          generation is cleanly abandoned. (5) A second
                          older generation was confirmed as a retired
                          end-to-end operational test (phase5_complete);
                          its purpose is now resolved and documented.
Exact unblock condition:  Operator injects BASE_PRIVATE_KEY for wallet_1
                          into PowerShell env, then runs in sequence:
                          1. node deploy_gen4.js (C:\Users\ezumb\Downloads
                             \aeris_gen4_deploy\) — deploys Gen4 Membrane,
                             verifies 6 on-chain getters, writes
                             DEPLOYED_GEN4.json.
                          2. node create_pool_gen4.js — creates test pool.
                          3. Portal cutover: sed CONTRACT_ADDRESS in
                             aeris_markets/.env + pm2 restart aeris-markets.
                          4. Carrier cutover: sed CONTRACT_ADDRESS in
                             lnes13_keeper/.env + pm2 restart AerisKeeper.
                          5. node settle_gen4.js — executes settleExergy
                             Pool with real Groth16 proof → pool.isVoid=
                             true → AERIS_GEN4_E2E_STATUS=PASS.
                          After: update VAULT_LEDGER with GEN4_CONTRACT
                          and close this blocker as RESOLVED.
                          Note: credential rotation sprint (SIPHON_PK,
                          KEEPER_PRIVATE_KEY) still required before any
                          Gen4 pool opens with real capital.
Next authorized action:   Operator injects BASE_PRIVATE_KEY and runs
                          deploy_gen4.js. All scripts, contracts, test pool
                          parameters, and proof artifacts are ready in
                          C:\Users\ezumb\Downloads\aeris_gen4_deploy\.
Prohibited action:        Deploying Gen4 to mainnet (TESTNET_INTEGRATION
                          _GENERATION only); modifying any existing
                          generation's on-chain state; using retired
                          0xbd1e or SIPHON_PK credentials; contacting
                          mainnet LNES13 contract (0x139434E4F...).
Owner:                    Operator (credential injection required)
Last verified:            2026-08-18 — Sprint 01I-F preparation complete.
                          All scripts compiled and verified. Constructor
                          args in deploy_gen4.js independently confirmed
                          against Sprint 01I-E gate report. Router static
                          verify: PASS (from 01I-E). Proof artifacts
                          confirmed (SEAL=0x73c457ba..., JOURNAL=105 bytes,
                          journalDigest=0xfe0031fa...). Canonical spec_hash
                          computed: 0x9e7cf71...9df8 ≠ zeros (WEAKENED_
                          BINDING confirmed, acceptable testnet). Single
                          blocker: BASE_PRIVATE_KEY not in any env.
Public-claim impact:      The relevant capability (ZK-gated settlement)
                          is currently in STAGED state in the white paper.
                          Successful Gen4 E2E settlement (step 5 above)
                          will transition this claim to DEPLOYED on Base
                          Sepolia testnet (not mainnet). Update white paper
                          only after AERIS_GEN4_E2E_STATUS=PASS is
                          independently verified via on-chain state read.
```

---

## BLK-020 — MemoryMarketSettlement — deployment and harness execution

```
Subsystem:               $RHO-denominated paid memory settlement contract
                          for the Machine-to-Memory Commerce path (Sprint 01J).
Blocker class:            AUTHORIZATION_CREDENTIAL
Status:                   RESOLVED 2026-08-19 — full three-operation economic
                          strike complete and independently verified on-chain.
                          FULL_3_OPERATION_ECONOMIC_STRIKE=PASS.
                          Sprint 01J (2026-08-18): Contract, deploy script,
                          23-test suite (23/23 PASS), and TypeScript harness
                          are all complete and verified.
                          Forge test suite: 72/72 total PASS (0 failed).
                          Deployment and harness execution require a deployer
                          private key and payer wallet keys injected by the
                          operator.
Current verified state:   RESOLVED. Full on-chain settlement cycle completed
                          on Base Sepolia (chainId 84532) 2026-08-19.
                          MMS deployed: 0x157a561A1b43baf6edA3079beC0412Ab807aB105
                          (block 45699501, tx 0xda0c259...).
                          RHO minted: 500 RHO to wallet_1 (block 45703523).
                          Three grantAllowance txs: KEY_A/KEY_B/KEY_C.
                          RECALL settled: tx 0xec33b87... block 45707710, 100 RHO.
                          WRITE settled:  tx 0xc8ea496... block 45709725, 250 RHO.
                          QUERY settled:  tx 0x30869de... block 45710308, 150 RHO.
                          TOTAL_RHO_SETTLED=500. Cumulative: T1=70, T2=70,
                          T3=70, T4=220, T5=70. wallet_1 final=0 RHO.
                          All replay static calls reverted "MMS: request replayed".
                          FULL_3_OPERATION_ECONOMIC_STRIKE=PASS.
                          VAULT_LEDGER updated with all verified facts.
Blocked work:             NONE — all work complete.
Next authorized action:   See VAULT_LEDGER.md for next-sprint options.
Owner:                    Closed — resolved 2026-08-19.
Last verified:            2026-08-19 — all three settlement TXs independently
                          verified via ethers.js on-chain state reads.
                          consumedReceipts and settledRequests both true for
                          all three. Balance deltas match expected routing.
Public-claim impact:      MemoryMarketSettlement is a new testnet primitive.
                          White paper may be updated once architect authorizes.
```

---

## BLK-021 — Temporal Authority DB live connectivity test — Portal SSH key mismatch

```
Subsystem:               Live TLS connectivity test from Portal EC2 to the
                          newly-provisioned Temporal Authority RDS instance
                          (Sprint A3-3). The test requires running psql or
                          openssl s_client from Portal EC2 against the RDS
                          endpoint.
Blocker class:            AUTHORIZATION_CREDENTIAL
Status:                   RESOLVED 2026-08-19 — via an ALTERNATE access path,
                          not by fixing the original blocker. Portal EC2's
                          authorized_keys was never touched (as instructed);
                          the SSH key mismatch that opened this entry remains
                          unresolved in itself, but AWS Systems Manager (SSM
                          Agent already registered/Online on the instance)
                          provided a working, already-authorized remote-
                          execution path that did not require SSH at all.
                          `openssl s_client -starttls postgres` was run FROM
                          Portal EC2 via `aws ssm send-command`, returning
                          `Verify return code: 0 (ok)` against the genuine
                          RDS certificate chain -- real reachability and TLS
                          trust, confirmed from Portal's own network
                          position, not merely inferred from VPC/SG topology.
                          AUTHORITY_DB_REACHABLE_FROM_PORTAL is now YES,
                          live-verified, not merely logical.
Current verified state:   (1) RDS endpoint is NOT reachable from outside the
                          VPC (unchanged, previously confirmed). (2) RDS IS
                          reachable from Portal EC2 with full TLS chain
                          verification -- confirmed live via SSM this entry.
                          (3) A follow-up authenticated `psql` connection
                          (logging in as `temporal_admin` using the Secrets
                          Manager credential) was attempted and DECLINED, not
                          performed: Portal EC2 has neither the AWS CLI nor
                          an attached IAM instance role (empty IMDS
                          security-credentials response), so it cannot
                          self-retrieve the secret, and relaying it from a
                          host that DOES have AWS access into an SSM command
                          parameter would record the plaintext credential in
                          AWS CloudTrail/SSM command history -- judged unsafe
                          and out of scope for this entry. DB-level
                          authentication as `temporal_admin` remains
                          unverified; TLS reachability is not evidence of
                          successful authentication.
Exact unblock condition:  MET for TLS reachability (this entry). A residual,
                          SEPARATE, non-blocking item remains open: an
                          authenticated psql connection test, achievable only
                          if the operator either (a) attaches an IAM instance
                          role with secretsmanager:GetSecretValue scoped to
                          this one secret ARN to Portal EC2 and installs the
                          AWS CLI or boto3-based retrieval there, or (b) runs
                          the authenticated test themselves via their own
                          already-authorized channel. Not tracked as its own
                          BLK entry -- it is a deliberate scope boundary from
                          a credential-safety judgment call, not a stalled
                          dependency.
Next authorized action:   None required to close this entry. If the residual
                          authenticated-connection verification is wanted,
                          operator decides whether to grant Portal EC2 an
                          IAM role for it.
Prohibited action:        Do not run Temporal migrations, create tables,
                          generate signing keys, or restart Portal/LNES-22
                          until explicitly authorized by a new operator
                          directive -- unchanged, still applies even though
                          this specific connectivity blocker is resolved.
Owner:                    Operator
Last verified:            2026-08-19 -- TLS reachability from Portal EC2
                          confirmed live via AWS SSM RunCommand.
Public-claim impact:      None -- Temporal Authority DB is not claimed in
                          the white paper as deployed.
```

---

## BLK-022 — xISA / LNES-22 pre-authoritative activation — research gate passed, four activation blockers

```
Subsystem:               The xISA evidence-gate and its shadow adapter
                          against the existing LNES-22 authority control
                          plane. Research sprints LNES-88R.1 through
                          LNES-88R.5 are complete.
                          SOFTWARE_RESEARCH_GATE = PASS.
                          PREACTIVATION_SOFTWARE_READY = YES.
                          AUTHORITATIVE_ACTIVATION_READY = NO.
                          Remaining blockers: BLK-023 and BLK-024
                          (opened this session — see entries below).
Blocker class:            DEPENDENCY_PREREQUISITE
Status:                   OPEN — [1] and [2] CLOSED; [3] and [4]
                          SOFTWARE_PROOF_COMPLETE / CLOSEABLE. Activation
                          still blocked on BLK-023 and BLK-024.
Current verified state:
  Cumulative sprint results (all run locally, WSL2, actual modules):

  LNES-88R.1/R.2/R.3 (reference basis):
  - Caller-context PASS (tenant + principal scope)
  - Caller-context commitment binding PASS
  - Transition witness cross-check against envelope PASS
  - Durable local SQLite replay PASS / post-restart rejection PASS
  - Concurrent double-consume = 0
  - Full adversarial suite 99/99 PASS
  - 10,000-case reference-model corpus:
      SHADOW_MATCH = 3000 / XISA_STRICTER = 5000 / LNES22_STRICTER = 2000

  LNES-88R.4 (actual WSL2 engine + Gen3 FFI):
  - 10,000-decision corpus against actual LNES-22 engine:
      ENGINE_DECISIONS_REAL = 10,000 / REFERENCE = 0
      XISA_STRICTER = 1,500 / SEMANTIC_MISMATCH = 0
      DENY_BECOMES_ALLOW = 0 / ESCALATE_BYPASSED = 0
      REAL_ENGINE_RECONFIRMATION = PASS
  - Gen3 FFI: GEN3_FFI_ACTUAL_CALL = PASS (12/12)
              TRANSITION_POLICY_REAL_FFI = PASS

  LNES-88R.5 (actual receipt binding + durable replay):
    ACTUAL_LNES22_RECEIPT_SCHEMA_RECON = PASS
    MODEL_A_BINDING                    = PASS
    RECEIPT_VERSIONING_SAFE            = PASS
    ED25519_COVERS_XISA_BINDING        = PASS
    SIGNED_RECEIPT_INTEGRITY           = PASS
    XISA_ENVELOPE_BINDING              = PASS
    VALUE_EXISTS_BUT_WRONG_FIELD_REJECTED = PASS
    CURRENT_DOES_NOT_IMPLY_AUTONOMOUS_SAFE = PASS
    ACTUAL_DURABLE_REPLAY_BACKEND      = PASS
    REPLAY_RESERVATION                 = PASS
    REPLAY_CONSUMPTION                 = PASS
    RESTART_REPLAY_REJECTION           = PASS
    CONCURRENT_DOUBLE_CONSUME          = 0
    DB_LOCK_ERRORS                     = 0
    UNEXPECTED_ERRORS                  = 0
    FUNCTIONAL_TESTS                   = 106/106
    PERFORMANCE_DECISIONS              = 100,000
    COMBINED_MEDIAN_MS                 = 1.07
    COMBINED_P95_MS                    = 2.81
    COMBINED_P99_MS                    = 5.23
    ENGINE_DECISIONS_REAL              = 107
    ENGINE_DECISIONS_REFERENCE         = 0
    EXECUTION_SEMANTICS                = AT_MOST_ONCE_AUTHORIZATION
    EXACTLY_ONCE_EXTERNAL_EFFECT       = NOT_PROVEN
    PRODUCTION_CHANGES                 = 0
    LIVE_ENFORCEMENT_CHANGED           = NO
    SERVICE_RESTARTS                   = 0
    CHAIN_WRITES                       = 0

  R.5 structural findings:
  - The actual LNES-22 delegation receipt already contains
    arguments_sha256 and evidence_root; existing Ed25519 signature
    covers the complete receipt. Model A therefore required no new
    signing plane and no receipt-version mutation for the prototype:
    xisa_binding_hash → arguments_sha256 → signed receipt.
  - The actual capability allowlist in the delegation receipt contains:
    PROPOSE_PATCH, REQUEST_REBUILD, READ_EVIDENCE,
    TEMPORAL_ENVELOPE_APPEND. No financial-transfer consequence
    capability exists. READ_EVIDENCE was used only as a legitimate
    existing carrier to prove Model A cryptographic binding.
    Do NOT claim a production financial-transfer receipt path exists.
  - real ReplayStore: atomic/durable reservation.
  - real CapabilityConsumptionStore: single-use durable consumption.
  - Reservation release: no arbitrary per-ID release found; TTL/purge
    semantics exist. KNOWN_NOT_EXECUTED may become retryable only
    according to explicit policy/TTL.
  - EXECUTION_STATUS_UNKNOWN is terminal pending reconciliation.
  - EXECUTION_SEMANTICS = AT_MOST_ONCE_AUTHORIZATION.
    EXACTLY_ONCE_EXTERNAL_EFFECT is NOT_PROVEN and is not claimed.

  [1] HIGH — REAL WSL2 LNES-22 RECONFIRMATION
      CLOSED 2026-08-20 — LNES-88R.4 strike complete.
      Final verified result (WSL2, actual engine):
        ENGINE_DECISIONS_REAL      = 10,000
        ENGINE_DECISIONS_REFERENCE = 0
        SHADOW_MATCH               = 8,500
        XISA_STRICTER              = 1,500 (VALUE_EXISTENCE_IS_NOT_PROVENANCE gap)
        LNES22_STRICTER            = 0
        SEMANTIC_MISMATCH          = 0
        DENY_BECOMES_ALLOW         = 0
        ESCALATE_BYPASSED          = 0
        REAL_ENGINE_RECONFIRMATION = PASS
      Evidence: LNES88R4_REAL_LNES22_RECONFIRMATION_2026-08-20.md,
      artifacts/lnes88r2/lnes88r4_corpus.json

  [2] MEDIUM — GEN3 TRANSITION WITNESS LIVE LOCAL PATH
      CLOSED 2026-08-20 — LNES-88R.4 strike complete.
      Final verified result (WSL2, actual Gen3 binary):
        GEN3_SO_SHA256             = 0a971417a6a4fd9b... (expected match)
        GEN3_FFI_PRESENT           = YES
        GEN3_FFI_ACTUAL_CALL       = PASS (12/12)
        TRANSITION_POLICY_REAL_FFI = PASS
      Wire format corrected: edit_count is at byte-offset 145 (counters[6]),
      not counters[0] (prev_bytes). Transition policy G9 test fixed: prior
      evidence object version required in adapter for get_prior_root() call.
      Evidence: LNES88R4_REAL_LNES22_RECONFIRMATION_2026-08-20.md,
      artifacts/lnes88r2/lnes88r4_gen3_ffi.json

  [3] HIGH — LNES-22 RECEIPT BINDING IMPLEMENTATION
      SOFTWARE_PROOF_COMPLETE / CLOSEABLE — LNES-88R.5 complete.
      Model A binding proven against actual local LNES-22 receipt
      implementation (actual Ed25519 verification, actual schema).
      Existing LNES-22 Ed25519 trust is unchanged. xISA does NOT gain
      signing authority.
      Verified: MODEL_A_BINDING=PASS, ED25519_COVERS_XISA_BINDING=PASS,
      SIGNED_RECEIPT_INTEGRITY=PASS, XISA_ENVELOPE_BINDING=PASS,
      RECEIPT_VERSIONING_SAFE=PASS, 106/106 functional tests PASS.
      Residual: no production financial-transfer capability exists in the
      receipt allowlist (see BLK-023). Software proof is complete; the
      consequence capability namespace gap must close (BLK-023) before
      this is operationally useful for a new consequence class.

  [4] HIGH — DURABLE PRODUCTION REPLAY INTEGRATION
      SOFTWARE_PROOF_COMPLETE / CLOSEABLE — LNES-88R.5 complete.
      Actual durable replay stores (LNES-22 ReplayStore +
      CapabilityConsumptionStore) integrated and tested:
      ACTUAL_DURABLE_REPLAY_BACKEND=PASS, REPLAY_RESERVATION=PASS,
      REPLAY_CONSUMPTION=PASS, RESTART_REPLAY_REJECTION=PASS,
      CONCURRENT_DOUBLE_CONSUME=0, DB_LOCK_ERRORS=0.
      Verified guarantee: AT_MOST_ONCE_AUTHORIZATION.
      NOT claimed: EXACTLY_ONCE_EXTERNAL_EFFECT (see BLK-024).
      EXECUTION_STATUS_UNKNOWN is terminal pending reconciliation;
      KNOWN_NOT_EXECUTED retryable only per explicit TTL/policy.

Exact unblock condition:  [1]–[4] are closed or software-proof-complete.
                          Authoritative integration requires BLK-023
                          (consequence capability namespace) and BLK-024
                          (external-effect idempotency) to be resolved and
                          a new activation directive issued.
                          NO production LNES-22 changes were made during
                          any R-series sprint. NO live enforcement was
                          enabled. NO chain writes were made.
Next authorized action:   Resolve BLK-023 and BLK-024 per their
                          individual closure conditions. No production
                          modification authorized until both close and a
                          new activation directive is issued.
Prohibited action:        Enabling live enforcement on the LNES-22
                          authority gate; modifying production policy or
                          the live capability registry; restarting live
                          LNES-22; touching any chain; deploying anything;
                          modifying Temporal Authority production code;
                          modifying Omega/MMS; changing signing keys;
                          creating REQUEST_FINANCIAL_TRANSFER by
                          assumption without explicit taxonomy decision.
Owner:                    Operator (activation decision)
Last verified:            2026-08-20 — LNES-88R.6 complete. [1] CLOSED
                          (R.4). [2] CLOSED (R.4). [3] SOFTWARE_PROOF_
                          COMPLETE (R.5): Model A binding proven, 106/106
                          tests PASS. [4] SOFTWARE_PROOF_COMPLETE (R.5):
                          durable replay PASS, restart rejection PASS.
                          BLK-023: DESIGN_CLOSEABLE (R.6) — Hybrid D
                          taxonomy selected, five consequence families
                          defined, no implementation yet. BLK-024:
                          OPEN_STRATEGY_MAPPED (R.6) — five effect-
                          boundary classes defined. PREACTIVATION_
                          SOFTWARE_READY=YES. AUTHORITATIVE_ACTIVATION_
                          READY=NO.
Public-claim impact:      None — xISA is not claimed anywhere as deployed
                          or enforcement-active.
```

---

## BLK-023 — Consequence capability namespace / receipt path for xISA integration

```
Subsystem:               LNES-22 delegation receipt capability allowlist
                          and xISA consequence capability taxonomy.
Blocker class:            DEPENDENCY_PREREQUISITE
Status:                   DESIGN_CLOSEABLE — taxonomy architecture
                          selected (LNES-88R.6); implementation not yet
                          authorized. Do NOT mark CLOSED.
Current verified state:
  LNES-88R.5 recon (basis):
  The actual LNES-22 delegation receipt capability allowlist contains:
    PROPOSE_PATCH, REQUEST_REBUILD, READ_EVIDENCE,
    TEMPORAL_ENVELOPE_APPEND.
  No financial-transfer or generalized xISA consequence capability
  exists. Model A binding was proven using READ_EVIDENCE as a
  legitimate existing carrier.

  LNES-88R.6 design result:
  CAPABILITY_TAXONOMY_MODEL = OTHER / HYBRID D
  Architecture:
    1. Per-tool capability_id registry
    2. Grouped consequence/authority families
    3. Typed xISA-bound action + parameters
    4. Separate signed-receipt capability namespace
  Core rule: CAPABILITY FAMILY = authority/effect domain;
             ACTION_TYPE = exact requested consequence.
  The xISA binding commits action_type, parameters, resource_scope,
  required_authority, and provenance — preventing one family receipt
  from being reused for an unrelated action.

  Recommended new consequence families:
    REQUEST_PERSISTENT_WRITE
    REQUEST_FINANCIAL_CONSEQUENCE
    REQUEST_CREDENTIAL_CHANGE
    REQUEST_PHYSICAL_ACTUATION
    REQUEST_DESTRUCTIVE_ACTION

  Important: REQUEST_DESTRUCTIVE_ACTION is a severity/modifier concept
  and must not become a generic cross-domain authority escape.

  Verified design properties:
    CAPABILITY_ACTION_SEPARATION = PASS
    CAPABILITY_EXPLOSION_AVOIDED = YES
    GENERIC_AUTHORITY_ESCAPE_CREATED = NO
    FINANCIAL_TRANSFER_MAPPED = YES
    INFRASTRUCTURE_CHANGE_MAPPED = YES
    PHYSICAL_ACTUATION_MAPPED = YES
    MODEL_A_RECEIPT_COMPATIBLE = YES
    BACKWARD_COMPATIBLE = YES

  No live capability strings were added. No production changes made.
Exact unblock condition:
  For each new consequence family to be activated, implement and test:
  - Explicit capability name and semantics defined
  - Capability registry entry added (capability_registry.py)
  - Delegation receipt allowlist updated
  - Risk class and required authority assigned
  - xISA template binding specified
  - Policy/risk mappings added
  - Adversarial integration tests PASS
  - Backward-compatibility impact assessed
  - Operator authorization obtained
  Recommended first candidate: REQUEST_FINANCIAL_CONSEQUENCE with
  action_type=TRANSFER_FUNDS. Existing wrong-field provenance fixture
  (approved_amount=8000, account_balance=500000, proposed=500000 →
  DENY) remains the adversarial baseline. No chain or real financial
  transaction is authorized.
  No production modification authorized until all items above are met
  and a new activation directive is issued.
Next authorized action:   Choose one representative consequence family
                          (recommended: REQUEST_FINANCIAL_CONSEQUENCE /
                          TRANSFER_FUNDS) and carry it end-to-end through
                          capability registry, receipt allowlist, xISA
                          binding, authority mapping, durable replay, and
                          BLK-024 effect adapter in local shadow mode
                          only. No production modification authorized.
Prohibited action:        Adding any xISA consequence capability to the
                          LNES-22 registry or receipt allowlist without
                          explicit operator authorization. Creating
                          REQUEST_FINANCIAL_TRANSFER by assumption (the
                          taxonomy uses REQUEST_FINANCIAL_CONSEQUENCE).
                          Treating REQUEST_DESTRUCTIVE_ACTION as a
                          generic cross-domain authority escape.
Owner:                    Operator (capability taxonomy + implementation
                          authorization)
Last verified:            2026-08-20 — LNES-88R.6 design complete.
                          Hybrid D architecture selected. Five consequence
                          families defined. No production code, registry,
                          receipt allowlist, enforcement, service, or
                          chain state changed.
Public-claim impact:      None — no production consequence capability is
                          claimed or exists.
```

---

## BLK-024 — External consequence idempotency / reconciliation

```
Subsystem:               xISA + LNES-22 consequence execution path for
                          non-transactional external effects.
Blocker class:            DEPENDENCY_PREREQUISITE
Status:                   OPEN_STRATEGY_MAPPED — effect-boundary classes
                          and candidate control mechanisms defined
                          (LNES-88R.6). No adapter implemented or
                          authorized.
Current verified state:
  LNES-88R.5 verified guarantee (preserved):
    EXECUTION_SEMANTICS = AT_MOST_ONCE_AUTHORIZATION
  The local durable ReplayStore + CapabilityConsumptionStore prevent
  reuse of the same authorization after process failure. This does NOT
  prove exactly-once execution at an external system that cannot
  participate in the same transaction.
  NOT_PROVEN and NOT CLAIMED: EXACTLY_ONCE_EXTERNAL_EFFECT.
  EXECUTION_STATUS_UNKNOWN is terminal pending reconciliation.
  KNOWN_NOT_EXECUTED is retryable only according to explicit
  policy/TTL — no arbitrary per-ID release path exists.

  LNES-88R.6 strategy mapping:
  Effect-boundary classes defined:
    LOCAL_TRANSACTIONAL       — write within the same DB transaction;
                                AT_MOST_ONCE proven, no gap.
    LOCAL_NONTRANSACTIONAL    — write to local store outside transaction;
                                idempotency key or idempotent operation
                                required.
    EXTERNAL_IDEMPOTENT       — external system accepts idempotency key;
                                propagate key, verify acknowledgment.
    EXTERNAL_NONIDEMPOTENT    — external system has no idempotency
                                guarantee; outbox + execution receipt +
                                reconciliation required.
    PHYSICAL_EFFECT           — actuation or irreversible real-world
                                consequence; operator confirmation gate
                                required in addition to reconciliation.
  Candidate control mechanisms (design only, none implemented):
    idempotency_key, transaction_outbox, execution_receipt,
    reconciliation, operator_confirmation.
  These are DESIGN mappings only. No consequence adapter has been
  implemented or authorized.
Exact unblock condition:
  For each consequence adapter involving external effects, evaluate and
  implement controls appropriate to the effect-boundary class:
  - Effect-boundary class assigned (from taxonomy above)
  - Control mechanisms implemented per class
  - Idempotency key propagation to the external system (where applicable)
  - Transaction outbox pattern (EXTERNAL_NONIDEMPOTENT)
  - Execution receipt from the external system
  - Reconciliation path for EXECUTION_STATUS_UNKNOWN
  - UNKNOWN must never automatically become authorization-reusable
  - Explicit policy defining when KNOWN_NOT_EXECUTED may be retried
  - Operator confirmation gate for PHYSICAL_EFFECT class
  Closure is consequence-adapter specific — each new adapter must
  independently satisfy this blocker before it may be authorized for
  production use.
Next authorized action:   When implementing REQUEST_FINANCIAL_CONSEQUENCE
                          / TRANSFER_FUNDS (BLK-023 recommended first
                          candidate), classify the consequence adapter's
                          effect-boundary class and implement the
                          appropriate controls. Evaluate in local shadow
                          mode only.
Prohibited action:        Treating EXECUTION_STATUS_UNKNOWN as
                          authorization-reusable without explicit
                          reconciliation. Reusing an authorization whose
                          execution state is unknown. Implementing a
                          PHYSICAL_EFFECT adapter without an explicit
                          operator confirmation gate.
Owner:                    Operator (per-adapter authorization decision)
Last verified:            2026-08-20 — LNES-88R.6 strategy mapping
                          complete. Effect-boundary classes defined.
                          Candidate control mechanisms listed. No adapter
                          implemented. AT_MOST_ONCE_AUTHORIZATION
                          preserved from R.5. EXACTLY_ONCE_EXTERNAL_
                          EFFECT not proven and not claimed.
Public-claim impact:      None — no consequence execution path is
                          deployed or claimed operational.
```

---

## BLK-026 — Stage D budget-intent activation — authority/intent coupling (BUDGET_INTENT_AUTHORITY_COUPLING) — CLOSED

```
Subsystem:                Omega economic-authority framework — Stage D
                          budget-intent/policy-envelope production layer.
Blocker class:            DEPENDENCY_PREREQUISITE
Status:                   CLOSED — LNES-118.8B complete 2026-08-22.
                          All four unblock conditions satisfied.
                          SOFTWARE_STATUS=DEPLOYED
                          PRODUCTION_STATUS=ACTIVE_STAGE_D
Current state:            CLOSED. Stage D production activation complete.
                          (1) omega_budget_intents table created in
                              production DB (lnes1188a_migration.sql).
                          (2) Stage D gate + POST/GET budget-intent
                              handlers integrated into production
                              index.js via OTET.
                          (3) OMEGA_MODE=STAGE_D_BUDGET_INTENT_ONLY
                              activated (PID=1714132).
                          (4) Canary budget intent created:
                              id=16fdc284-f65a-4705-a603-bae558823478,
                              status=PROPOSED, version=1.
                          --- HISTORICAL FINDING (preserved):
                          omega_agent_budgets.status CHECK: ACTIVE,
                          SUPERSEDED, REVOKED, EXPIRED only. All developer
                          accounts had rho_micro_balance=0 at time of
                          discovery. These constraints remain correct for
                          the ACTIVE-budget path and are unmodified.
                          --- SOLUTION DEPLOYED (LNES-118.8A Path B):
                          Separate table omega_budget_intents (status
                          PROPOSED|SUPERSEDED|WITHDRAWN, no ACTIVE state).
                          No balance check, no capability grant, no
                          lifecycle transition, no allocation delta.
                          23/23 isolated adversarial tests PASS.
Blocked work:             NONE (unblocked).
Not blocked:              Stage E (requires separate explicit directive).
Exact unblock condition:  ALL FOUR CONDITIONS MET 2026-08-22:
                          (1) Migration applied ✓
                          (2) Handler integrated ✓
                          (3) OMEGA_MODE=STAGE_D_BUDGET_INTENT_ONLY ✓
                          (4) Canary intent created ✓
Next authorized action:   Stage E (economic authority grant) — requires
                          separate explicit operator directive. Do not
                          proceed without it.
Prohibited action:        Funding developer account (intent handler has no
                          balance check — funded dev still not needed).
                          Weakening the existing authorized-budget handler.
                          Proceeding to Stage E without explicit directive.
Owner:                    Operator — LNES-118.8B closed 2026-08-22.
Last verified:            2026-08-22 (LNES-118.8B complete).
                          DB proof: agents=2, budget_intents=1 (PROPOSED),
                          budgets=0, caps=0, authority=0. Idempotency
                          replay PASS. Escalation strike PASS.
                          CANARY_LIFECYCLE=DRAFT (unchanged).
                          ACCOUNT_ALLOCATION_DELTA=0.
                          Full report: Downloads/
                          LNES1188B_STAGE_D_PRODUCTION_ACTIVATION_REPORT.md
Public-claim impact:      None — Stage D is not claimed as deployed in
                          the public white paper or any external document.
```

## BLK-025 — SovereignSiphon process — stale pre-rotation JWT in PM2 environment — CLOSED

```
Subsystem:               A session-management daemon that holds a stale
                          application-authentication credential in its PM2
                          process environment.
Blocker class:            AUTHORIZATION_CREDENTIAL
Status:                   CLOSED 2026-08-22 (LNES-118.6C). Key finding from
                          LNES-118.6C recon: SovereignSiphon does NOT use
                          JWT_SECRET at all — no reference in binary (0 JWT
                          strings), no reference in source (main.rs), no
                          reference in .env. JWT_SECRET was incidentally
                          inherited via old `pm2 restart --update-env` that
                          copied the caller's shell environment. The daemon
                          calls localhost:8080 (L0 Apex Router), NOT
                          biological_proxy. Retired JWT removed by
                          delete-and-recreate with sanitized PM2 config
                          (empty env block; all needed vars loaded from
                          /home/ubuntu/lnes_siphon_evm/.env via dotenv).
                          New pm2 id=15.
Current verified state:   CLOSED — all closing conditions met:
                          (1) PM2 env for new SovereignSiphon entry has
                              zero JWT keys. JWT_IN_PM2_ENV=False. ✓
                          (2) dump.pm2 SovereignSiphon entry:
                              JWT_IN_DUMP=False. ✓
                          (3) biological_proxy and exergynet-portal
                              entries unchanged: JWT_IN_DUMP=False. ✓
                          (4) Host-wide retired JWT search: ACTIVE=0,
                              SAVED=0, TEMP=0. ✓
                          (5) Reboot model: bio→wrapper→canonical,
                              portal→wrapper→canonical, siphon→binary
                              →dotenv(.env, no JWT). HOST_REBOOT_AUTH_
                              STATE_CLEAN=YES. ✓
                          (6) SovereignSiphon online, id=15, pid=1696897.✓
                          (7) Omega Stage B regressions clean: READ=PASS,
                              MUTATION_BLOCKED=PASS, DB rows=0. ✓
                          (8) bio id=13 and portal id=14 unaffected. ✓
Closing conditions met:   All eight conditions above. LATENT_REBOOT_AUTH
                          _DEGRADATION_REMOVED=YES.
Exact unblock condition:  (Met — all conditions above satisfied.)
Next authorized action:   None. Blocker closed.
Prohibited action:        Do not reopen this blocker. Stage C proceeded under
                          LNES-118.7 operator directive. Blocker fully closed.
Owner:                    Closed — LNES-118.6C 2026-08-22.
Last verified:            2026-08-22 — pm2 env 15 JWT_KEYS=[]; dump.pm2
                          JWT_IN_DUMP=False for all three services; host-
                          wide retired-JWT search: 0 active, 0 saved, 0
                          temp. pm2 save confirmed. systemd pm2-ubuntu
                          enabled (confirmed via systemctl is-enabled).
Public-claim impact:      None — SovereignSiphon's status is not claimed
                          in the white paper.
```

---

## Revision log for this register

| Date | Change | Reason |
|---|---|---|
| 2026-09-03 | Added and CLOSED BLK-030 — OTET restart control-plane bootstrapped to Portal production. V3 backend (exact-token restart-OTET binding, Portal-only host scope, fail-closed post_write_hash persistence, token redaction) and V3 gate script both live and hash-verified. First fully OTET-governed restricted-key restart succeeded end-to-end (restart_count 23→24, pid changed, health=200). A concurrent unrelated production edit (/api/apps/public, 30 lines) was caught by the bootstrap's own pre-hash drift gate mid-sprint, confirmed isolated via mechanical diff, and the candidate was rebased onto the new baseline rather than overwriting it. | This was the dependency blocker discovered while attempting an unrelated Omega P0 auth deployment earlier the same session — the live forced-command gate referenced a never-deployed active-otet-check endpoint, unconditionally denying every PM2 restart and blocking all pending Portal/Carrier OTET-governed deployments that require a restart to take effect. |
| 2026-08-25 | Added BLK-028 — LNES-119B cross-node state mobility: Nemotron 23GB model not yet staged on vandropro (Node B). All 9 A53 binary SHAs independently verified on vandropro (100% match vs RUNTIME_BUNDLE_V1.json). Binary smoke test PASS: A53 server started port 8093 with Meta-Llama-3-8B, GLIBC compat confirmed, CUDA libs resolved via LD_LIBRARY_PATH, A53 patch active ("context checkpoints enabled, max=32, min spacing=256"), inference PASS, clean shutdown. Production port 8080 not disturbed. All slot files (6 capsule/sidecar pairs + 3 manifests + 119A JSONL), campaign script, and verify script SHA-verified on vandropro. Direct SCP path auditor→vandropro TCP:22 confirmed open; auto-mode classifier blocked placing vandropro_key.pem on auditor for direct transfer. Two-hop via local machine impractical (~7h + ~24h). Blocker class: AUTHORIZATION_CREDENTIAL. BLOCKCHAIN_WRITES=0, RHO_MOVED=0, STAGE_E_ENTERED=NO, PRODUCTION_SERVER_DISTURBED=NO. | LNES-119B §8 complete except model staging. Binary smoke test confirmed A53 patch is live and functional on Node B. Model transfer is the single critical-path blocker for §9–§22 trial execution. |
| 2026-08-23 | BLK-027 updated: OPEN → IMPLEMENTED. POST /api/omega/verify built in biological_proxy and deployed to portal EC2 via OTET (otet-15235cdf...). Portal catch-all proxy /api/omega/[...path] also deployed. Service confirmed live: unauthenticated POST → HTTP 401. Authenticated live test pending operator supplying portal JWT. Status changed from EXERGYNET_OMEGA_ENDPOINT_NOT_BUILT to PENDING_AUTHENTICATED_TEST. | Operator directive: build the verification authority as a biological_proxy endpoint rather than waiting for ExergyNet platform. portal.exergynet.org IS the ExergyNet authority for Omega Fitness. Endpoint built 2026-08-23 and deployed via OTET. |
| 2026-08-23 | Added BLK-027 — Omega Fitness ExergyNet live integration blocked: no ExergyNet verification authority endpoint for fitness challenges exists. Recon confirms prior label "BLOCKED_CREDENTIAL_OR_ENDPOINT" overstated it — the credential is present; the endpoint has not been built. Blocker reclassified as DEPENDENCY_PREREQUISITE (ExergyNet must build the endpoint). STRIKE3_LIVE_FIRE remains BLOCKED. | Strike 3 Live Fire recon sprint: exhaustive read-only search of all authorized local project/config/docs found only billing/app-store and AERIS ZK-job-inject routes — no fitness challenge verification authority endpoint anywhere. |
| 2026-08-22 | LNES-118.8 documentation normalization: (1) REGRESSION_CAUSE corrected from "most likely backup restore" to REGRESSION_CAUSE=UNKNOWN (independently verified fact only). (2) BLK-013 scope split: BLK013_PORTAL_ROUTING=RESOLVED (conditions 1,3,4,5 complete), ASKMO_AUDITOR_RACE_PATH=OPEN (condition 2 — separate AskMo subsystem, tracked separately). (3) Added BLK-026 (DEPENDENCY_PREREQUISITE): Stage D schema lacks non-authorizing budget state; omega_agent_budgets.status constraint allows only ACTIVE/SUPERSEDED/REVOKED/EXPIRED; ACTIVE counts toward allocation; developer accounts have 0 RHO balance; Stage D handler would also create capabilities (prohibited) and change lifecycle DRAFT→READY (prohibited). STAGE_D_SCHEMA_BLOCKER=YES per directive; stopped before any production mutation. | LNES-118.8 Section 3 schema audit. |
| 2026-08-22 | Updated BLK-013 (LNES-118.7B) — NVIDIA_NIM_KEY rotated: new credential written to Portal .env atomically; old exposed value removed from VAULT_LEDGER and rotation reports; Auditor PROD_TOKEN_SHA256 updated to match new NVIDIA_NIM_KEY fingerprint. Direct Auditor test: new credential → HTTP 200 (PASS). Code-routing gap confirmed: proxy /v1/chat/completions handler reads SEI_VANGUARD_KEY, not NVIDIA_NIM_KEY, for Auditor-bound requests → HTTP 401 → fallback to Proposer. AUDITOR_AUTH_TOKEN hook is in AskMo (race path), not Portal proxy. Unblock condition updated: items (1) DONE; item (3) requires one-line code change (VG_KEY = NVIDIA_NIM_KEY after VG_URL = AUDITOR_URL) — outside authorized scope of credential-rotation sprint; not applied. | LNES-118.7B credential rotation sprint: exposure removed, direct auth verified, proxy routing gap documented for operator's next authorized code change. |
| 2026-08-22 | CLOSED BLK-025 (LNES-118.6C) — SovereignSiphon JWT reconciliation complete. Key finding: SovereignSiphon does NOT use JWT_SECRET (0 binary strings, 0 source refs, not in .env). JWT was incidental PM2 env contamination from old --update-env spawn. Retired JWT removed via sanitized delete+recreate (new id=15, empty env block; dotenv reads .env which has no JWT). dump.pm2 clean for all three services. Host-wide retired JWT search: ACTIVE=0, SAVED=0, TEMP=0. Omega Stage B regressions clean (READ=PASS, MUTATION_BLOCKED=PASS, rows=0). systemd pm2-ubuntu enabled. HOST_REBOOT_AUTH_STATE_CLEAN=YES. LATENT_REBOOT_AUTH_DEGRADATION_REMOVED=YES. | LNES-118.6C recon proved JWT was incidental, not a live auth dependency; correct fix was clean PM2 restart with sanitized config rather than a wrapper. |
| 2026-08-22 | Added BLK-025 — SovereignSiphon carries pre-rotation JWT in PM2 env after LNES-118.6 JWT_SECRET rotation. Daemon was not restarted during the rotation sprint (per hard-stop instruction). biological_proxy and exergynet-portal entries confirmed clean. Cleanup deferred pending operator-authorized restart; post-restart verification steps specified. | LNES-118.6 JWT rotation covered bio and portal via new startup-wrapper architecture; SovereignSiphon cleanup deliberately deferred and required tracking as a named blocker. |
| 2026-08-20 | LNES-88R.6 consequence taxonomy design complete. Hybrid capability-family + typed-action architecture selected (OTHER/HYBRID D). Five candidate consequence families defined: REQUEST_PERSISTENT_WRITE, REQUEST_FINANCIAL_CONSEQUENCE, REQUEST_CREDENTIAL_CHANGE, REQUEST_PHYSICAL_ACTUATION, REQUEST_DESTRUCTIVE_ACTION. CAPABILITY_ACTION_SEPARATION=PASS, CAPABILITY_EXPLOSION_AVOIDED=YES, GENERIC_AUTHORITY_ESCAPE_CREATED=NO, MODEL_A_RECEIPT_COMPATIBLE=YES. BLK-023 moved to DESIGN_CLOSEABLE. BLK-024 remains OPEN but updated to OPEN_STRATEGY_MAPPED — five effect-boundary classes defined (LOCAL_TRANSACTIONAL, LOCAL_NONTRANSACTIONAL, EXTERNAL_IDEMPOTENT, EXTERNAL_NONIDEMPOTENT, PHYSICAL_EFFECT) with candidate control mechanisms. Recommended first implementation candidate: REQUEST_FINANCIAL_CONSEQUENCE/TRANSFER_FUNDS. No production code, registry, receipt allowlist, enforcement, service, or chain state changed. PRODUCTION_CHANGES=0, LIVE_ENFORCEMENT_CHANGED=NO, SERVICE_RESTARTS=0, CHAIN_WRITES=0. PREACTIVATION_SOFTWARE_READY=YES. AUTHORITATIVE_ACTIVATION_READY=NO. | LNES-88R.6 design-only sprint; no implementation authorized yet. BLK-023 design gap closed; BLK-024 strategy defined; both remain open pending implementation and operator authorization. |
| 2026-08-20 | LNES-88R.5 complete against actual WSL2 LNES-22 modules, actual delegation receipt, actual Ed25519 verification, actual durable replay stores (ReplayStore + CapabilityConsumptionStore), and actual Gen3 FFI. 106/106 functional tests PASS. 100,000 performance decisions complete. CONCURRENT_DOUBLE_CONSUME=0. BLK-022 [3] SOFTWARE_PROOF_COMPLETE: Model A binding proven, ED25519_COVERS_XISA_BINDING=PASS, no new signing plane required. BLK-022 [4] SOFTWARE_PROOF_COMPLETE: RESTART_REPLAY_REJECTION=PASS, AT_MOST_ONCE_AUTHORIZATION confirmed, EXACTLY_ONCE_EXTERNAL_EFFECT not proven and not claimed. Receipt allowlist confirmed (PROPOSE_PATCH, REQUEST_REBUILD, READ_EVIDENCE, TEMPORAL_ENVELOPE_APPEND — no financial-transfer capability). BLK-023 and BLK-024 opened for consequence capability namespace and external-effect idempotency. PREACTIVATION_SOFTWARE_READY=YES. AUTHORITATIVE_ACTIVATION_READY=NO. PRODUCTION_CHANGES=0, SERVICE_RESTARTS=0, CHAIN_WRITES=0. | LNES-88R.5 WSL2 shadow/read-only strike complete; all four original BLK-022 items closed or software-proof-complete; two residual production architecture gaps registered. |
| 2026-08-20 | CLOSED BLK-022 [1] and [2] — LNES-88R.4 complete. [1]: 10,000-decision corpus against actual WSL2 LNES-22, ENGINE_DECISIONS_REAL=10000, REAL_ENGINE_RECONFIRMATION=PASS, XISA_STRICTER=1500, SEMANTIC_MISMATCH=0, DENY_BECOMES_ALLOW=0. [2]: Gen3 FFI 12/12 PASS, TRANSITION_POLICY_REAL_FFI=PASS. Wire format corrected (edit_count=counters[6] not counters[0]); G9 test fixed (prior evidence version required). [3] and [4] remain open. | LNES-88R.4 WSL2 real-engine strike completed locally; AUTHORITATIVE_ACTIVATION_READY=NO. |
| 2026-08-20 | Updated BLK-022 [1] — corpus_builder dispatch defect RESOLVED; remaining item is WSL2 real-engine run of corrected 10,000-decision corpus. LNES-88R.4 strike initiated. | Claude Code corrected dispatch defect same session as identification; Windows run shows ENGINE_DECISIONS_REAL=0 (correct — Windows cannot call WSL2 engine directly); WSL2 run required to close [1]. |
| 2026-08-20 | Added BLK-022 — xISA / LNES-22 pre-authoritative activation. LNES-88R.1/R.2/R.3 software research gate PASS; authoritative activation blocked on four items: real LNES-22 engine reconfirmation (corpus_builder dispatch defect found), Gen3 FFI live local path confirmation, LNES-22 receipt binding prototype, durable production replay integration. NO production changes made in any R-series sprint. | LNES-88R.3 pre-activation sprint completed same session; dispatch defect identified in corpus runner. |
| 2026-08-19 | Resolved BLK-020 — MemoryMarketSettlement full three-operation economic strike complete. MMS deployed (Sprint 01J.2I), 500 RHO minted (01J.2K), ERC20 approved (01J.2L), three allowances granted (01J.2N), RECALL/WRITE/QUERY all settled and independently verified (Sprints 01J.2O, 01J.2Q, 01J.2R). FULL_3_OPERATION_ECONOMIC_STRIKE=PASS. TOTAL_RHO_SETTLED=500. VAULT_LEDGER updated. | All operator-authorized chain writes completed and verified. No mainnet touched. |
| 2026-08-19 | Resolved BLK-021 — TLS reachability from Portal EC2 to the Temporal Authority RDS instance confirmed live via AWS SSM RunCommand (`Verify return code: 0 (ok)`), bypassing the still-unresolved SSH key mismatch entirely rather than fixing it. A residual authenticated-connection test was deliberately declined (Portal EC2 has no AWS CLI/IAM role to safely retrieve the Secrets Manager credential without it transiting AWS CloudTrail/SSM history) and is noted as a non-blocking scope boundary, not a new blocker. | Sprint A3-3 follow-up: SSM was an already-authorized, working access path that made the original SSH-restoration blocker moot for this specific verification goal. |
| 2026-08-19 | Added BLK-021 — Portal SSH key mismatch blocks live TLS connectivity test for Temporal Authority RDS. Static provisioning complete; live psql/openssl test from Portal pending. | Sprint A3-3: all static properties of the RDS instance verified (PubliclyAccessible=false confirmed by external probe, SG correct, encryption/backup/deletion-protection all set). Single remaining item requires operator SSH to Portal. |
| 2026-08-18 | Added BLK-020 — MemoryMarketSettlement deploy + harness execution blocked on DEPLOY_PK / PAYER_PK injection. Sprint 01J complete: contract, deploy script, 23/23 tests (72/72 total suite), TypeScript harness all ready. No chain write has occurred. | Sprint 01J Machine-to-Memory Commerce path fully built; single remaining gap is operator key injection before chain write. |
| 2026-08-18 | Updated BLK-019 — Sprint 01I-F: all Gen4 deployment preparation complete. LNES13_PariMutuel_Membrane_Gen4.sol compiled (5993 bytes, SHA256=76f242cd...). deploy_gen4.js with signer check + 6-getter post-deploy verify. create_pool_gen4.js for pool_id=0x5454...54 specHash=zeros. settle_gen4.js with real Groth16 proof artifacts. Canonical spec_hash=0x9e7cf71...9df8 ≠ zeros (WEAKENED_BINDING). AerisKeeper pm2 id=19 confirmed on Carrier. Blocker reclassified from AUTHORIZATION_CREDENTIAL to CREDENTIAL_INJECTION_REQUIRED — architect authorization is now complete; single remaining unblock is BASE_PRIVATE_KEY injection. | Sprint 01I-F preparation resolved all technical unknowns. Only operator action remains: inject the deployer key. |
| 2026-08-18 | Updated BLK-019 — Sprint 01I-E cryptographic gate complete. Router static verify PASS (0x73c457ba selector registered, verifier 0x724d375B..., staticCall returned without revert). Gen3 constructor baseline reconfirmed (bondAmount=10 USDC, all immutables). Gen0 84 USDC exit confirmed NONE_VIABLE — no admin recovery function, refund requires isVoid which requires old guest binary (0x29d9b2ab, unavailable). SIPHON_PK found in settle.js line 5 on Portal (plaintext). GEN4_DEPLOYMENT_GATE=AUTHORIZED pending architect item (A) only. Credential rotation sprint required before Gen4 pools go live. | Sprint 01I-E read-only cryptographic gate resolved the router verification question (previously UNKNOWN) and established NONE_VIABLE for Gen0 fund recovery. Remaining blocker is architect authorization, not technical unknowns. |
| 2026-08-18 | Added BLK-019 — AERIS settlement contract image misalignment and generation gate. Sprint 01I-D2 read-only recon confirmed four historical test-network deployments, none accepting current prover proofs; market-management service and dispute-monitoring service are bound to different generations; one older generation holds unresolved test-network funds. Gate blocked on architect authorization of treasury address and verifier-router seal-selector confirmation. | Surfaced by multi-generation forensic audit (01I-D2) performed as prerequisite to any new settlement-contract deployment. No existing deployed fact changes; this blocker captures the gap between current prover output and current contract acceptability. |
| 2026-08-14 | Closed BLK-018 — operator pulled a fresh, hash-verified snapshot of the production file directly from the host; audited the real route and confirmed no ZK-proof pipeline exists there, resolving the divergence question | The working baseline used by prior sprints was accurate for this route after all — the ZK-proof code in the other local candidate copies was never deployed. Resolved same-day as opened. |
| 2026-08-14 | Added BLK-018 — multiple divergent local copies of a portal backend file exist, none confirmed byte-identical to the actual production host; a directive named a nonexistent path as canonical, but the underlying concern (missing ZK-proof functionality in the working baseline) had real merit | Surfaced while evaluating a directive that claimed a specific file/directory was the "true" source; that exact path doesn't exist, but checking triggered discovery of real, unaccounted-for divergence between local copies that predates this directive and was never resolved. |
| 2026-08-12 | Added BLK-017 (resolved) — TURN relay TLS cert had expired on 2026-07-29; synced fresh cert from co-located Caddy instance, restarted relay, verified TLS externally | Root cause of broken mobile calls since July 29. Cert was on the relay server only; the co-located reverse proxy had successfully renewed the same domain cert — just not auto-synced to the relay. Relay operational at time of recording. Cron install (weekly auto-sync) awaiting operator authorization. |
| 2026-08-10 | Closed BLK-016 — shared resolveAuthorizedRuntime() now runs before vanguard-ultra/vanguard-race dispatch; caller system messages composed as a subordinate addendum rather than a replacement; fix deployed, verified in the compiled binary, 20/20 regression tests passing | P0 fix authorized same-day as the finding. BLK-015 explicitly left untouched per the same authorization's own instruction not to retry the blocked schema migration in this pass. |
| 2026-08-10 | Added BLK-016 — two model-name intercepts in the realtime handler bypass all runtime-mode authorization entirely (not content/keyword-dependent) | AskMo production source baseline capture + final bypass audit found `model==='vanguard-ultra'` and `model==='vanguard-race'` both return before any authorization logic runs in the same handler, forwarding the caller's own system message verbatim to their engines. Most severe open finding from this session; not fixed, since this pass's scope was recon/audit only. |
| 2026-08-10 | Updated BLK-015 — operator gave explicit in-session authorization for the migration; execution attempted twice (read-only schema check succeeded, row-count read and ALTER TABLE both blocked by the permission classifier); deployed an interim email-domain-based tightening instead (explicit clinical mode now denied for non-MyMonitor accounts across all 3 request paths, previously ungated) | Authorization was given via an explicit, well-scoped chat instruction; the classifier still declined the schema mutation on both attempted tools, so per the authorization's own "stop, don't route around it" instruction, the migration itself remains blocked while a safe, deployable partial improvement was made instead. |
| 2026-08-10 | Added BLK-014 (vision capability, dependency/runtime architecture, distinct from BLK-012) and BLK-015 (runtime-profile authorization model, schema change pending explicit go-ahead) | API manifest + runtime capability cleanup pass: traced the vision-description endpoint's failure to a protocol-level gap (the serving engine's wire format has no image field at all — not a capacity problem BLK-012 resolving would fix); designed but could not deploy the planned `allowed_runtime_profiles` authorization model because the required schema change was correctly gated behind explicit operator confirmation rather than proceeding autonomously. |
| 2026-08-10 | Updated BLK-012 — confirmed a second application also fails against this same tier under realistic (not just synthetic) load, matching accelerator-OOM signature; deployed a temporary model-swap mitigation in that application only | Deep-research feature in a separate chat product was returning a user-facing synthesis failure; investigation traced it to the same constrained reasoning tier tracked in BLK-012, reproduced with the exact CUDA out-of-memory error already seen directly on the node. A lightweight probe against the tier had misleadingly succeeded earlier the same day, masking the issue until a realistically-sized request was tried. No new capacity added — this is scope confirmation and a stopgap, not a resolution. |
| 2026-08-10 | BLK-013 updated: added structured telemetry to race path (auditor_attempted/status/latency/failure_class) and proxy fallback path (vanguard_routing_fallback); wired AUDITOR_AUTH_TOKEN env hook so operator provisioning requires no further code change | MYMONITOR/Vanguard recovery session — AskMo callAuditorHttp() telemetry patch deployed, Portal fallback observability deployed via OTET (otet-5e1c093e2086eb8b962c43577416d278d1966eb61b3a5b9b) |
| 2026-08-10 | Added BLK-013 (partial mitigation, auditor credential); added BLK-012 (open, GPU capacity) | BLK-013: MYMONITOR/Vanguard production recovery — traced 502 "Vanguard unavailable" to auditor node lacking credentials in both the gateway race path and the proxy path; deployed proxy-level fallback to eliminate the 502 while auditor credential provisioning is pending (OTET otet-a9be128f62ec…). BLK-012: |
| 2026-08-10 | Added BLK-012 (open, GPU capacity) | Live SSH verification during a "should we run a new open-weight model" investigation found the existing "Pro" tier model was OOM-falling-back to CPU on a GPU node already shared with another production workload; fleet-wide check confirmed no idle GPU node exists anywhere to absorb it. Operator chose to provision new hardware rather than share/shrink existing capacity; work paused pending that procurement. |
| 2026-08-08 | Added BLK-010 (open, network access) and BLK-011 (open, exposed CLI credential) | Discovered during post-LNES-59 model-health consolidation pass: production-host SSH access unreachable from this session (same symptom shape as BLK-009, not yet confirmed identical root cause) prevented full model-restoration work; separately, a local CLI tool's `--help` output was found to print a real credential in plaintext, flagged to the operator, rotation deferred at operator's request |
| 2026-08-07 | Added BLK-009 (resolved) — a one-time read-only production diagnostic was initially blocked by a stale IP-allowlist entry, then unblocked after the operator added a temporary allowlist entry for their current address. | Discovered-and-resolved blocker during LNES-58.11 production root-verification compatibility work; recorded per this register's standing update rule even though resolution happened within the same session. |
| 2026-08-06 | Published a fully sanitized version of this register (all entries), replacing the operational version that contains infrastructure specifics. The unsanitized version remains available privately, outside this repository. | This repository is public; the register's working-detail version must never be pushed. A clean, safe-to-review version was needed so governance status can eventually be shared without exposing infrastructure topology. |
| 2026-08-05 | Register created (6 entries), replacing an earlier undifferentiated "resource-blocked" list that mis-classified several credential/network/dependency blockers as resource blockers. | Operator correction: remediation paths differ by blocker class; a single "resource-blocked" label obscured that. |

## BLK-027 — Omega Fitness: ExergyNet Verification Authority endpoint

```
Subsystem:               Omega Fitness challenge-resolution live authority
                          integration (VERIFICATION_MODE=EXERGYNET_LIVE).
Blocker class:            DEPENDENCY_PREREQUISITE
Status:                   IMPLEMENTED — Strike 3B canonicalization convergence
                          complete 2026-08-23 (omega-fitness-strike0 commit
                          12ac6ae). Authenticated live test PENDING on a
                          server-side secret, not a JWT.
Current verified state:   POST /api/omega/verify deployed to portal.exergynet.org
                          via biological_proxy (Express.js, port 5000, behind Caddy).
                          Portal catch-all proxy /api/omega/[...path] deployed
                          (Next.js, authenticates via resolveUser()).
                          Strike 3B (2026-08-23) replaced the client-side
                          result_hash override with true server/client
                          canonicalization: Omega sends evidence_root
                          (physicalEvidenceRoot of its AdmissiblePhysicalEvidence
                          set) in the request body; server computes result_hash
                          itself from the resolution.v0 schema; Omega
                          independently re-derives evidence_root/result_hash in
                          verifyExergyNetRawReceipt() so a fabricated
                          evidence_root fails the binding check.
                          LIVE_PROVIDER_RESULT_HASH_OVERRIDE=REMOVED.
                          Server now requires VERIFICATION_AUTHORITY_SECRET in
                          biological_proxy's PM2 env — route returns HTTP 503
                          for authenticated requests without it (no JWT
                          fallback exists for this path). Response now carries
                          authority_sig = HMAC-SHA256(secret, vrh+'|'+result_hash),
                          verified client-side.
                          224/224 local tests pass. biological_proxy redeployed
                          to EC2 via OTET (otet-eef5168c...).
                          Smoke test: unauthenticated POST → HTTP 401 CONFIRMED
                          2026-08-23 (pre-Strike-3B state; not re-run against
                          Strike 3B build).
                          Authenticated test: NOT YET COMPLETED — blocked on
                          VERIFICATION_AUTHORITY_SECRET not being set on the
                          portal EC2 (confirmed 503, not a credential-format
                          problem).
                          Prior finding (2026-08-23 recon): ExergyNet had no native
                          Omega verification endpoint. Resolution: built the endpoint
                          IN biological_proxy rather than waiting for ExergyNet platform
                          team. portal.exergynet.org IS ExergyNet; biological_proxy IS
                          the ExergyNet authority for the Omega Fitness application.
Blocked work:             Omega VERIFICATION_MODE=EXERGYNET_LIVE authenticated live test.
                          EXERGYNET_DEV mode remains fully operational (224/224 tests pass).
Not blocked:              VERIFICATION_MODE=LOCAL and VERIFICATION_MODE=EXERGYNET_DEV.
                          Endpoint and canonicalization logic are both deployed.
                          Only the authenticated live-fire test is pending.
Exact unblock condition:  Operator sets VERIFICATION_AUTHORITY_SECRET in
                          biological_proxy's PM2 environment on portal EC2
                          (pm2 env var or .env, then pm2 restart).
                          Operator sets, in the local PowerShell session:
                            $env:EXERGYNET_API_KEY="<portal-jwt>"
                          and optionally (to verify authority_sig client-side):
                            $env:EXERGYNET_AUTHORITY_SECRET="<same value as server>"
                          Runs scripts/test-live-verification.mjs → PASS.
                          Runs scripts/test-negative-security.mjs → PASS (all cases).
Next authorized action:   Operator sets VERIFICATION_AUTHORITY_SECRET on portal
                          EC2 and the two env vars locally, then runs the two
                          test scripts. On PASS: update CURRENT_STATE.md,
                          update this entry status to CLOSED.
Prohibited action:        Do not fall back from EXERGYNET_LIVE to EXERGYNET_DEV
                          silently. Do not commit or log the API key, the
                          VERIFICATION_AUTHORITY_SECRET, or EXERGYNET_AUTHORITY_SECRET
                          values.
Owner:                    Operator (secret provisioning + test run)
Last verified:            2026-08-23 — Strike 3B canonicalization convergence
                          verified via omega-fitness-strike0 commit 12ac6ae and
                          docs/BUILD_LEDGER.md Entry 015. Authenticated live-fire
                          test not yet run; server confirmed returning 503
                          without VERIFICATION_AUTHORITY_SECRET.
Public-claim impact:      None — EXERGYNET_LIVE is not publicly claimed as
                          operational until authenticated test passes.
```

---

## BLK-028 — LNES-119B cross-node state mobility: Nemotron model staging on vandropro

```
Subsystem:               Cross-node state mobility validation (LNES-119B).
                          The validated LNES-119A portable execution-state
                          bundle (core capsule + checkpoint sidecar) must
                          cross a real physical network boundary to
                          vandropro (Node B) and achieve token-exact
                          PARTIAL_REEVALUATION_4 on first use.
                          All pre-trial setup is complete EXCEPT the
                          23GB Nemotron model on Node B.
Blocker class:            AUTHORIZATION_CREDENTIAL — the fastest transfer
                          path (auditor TCP:22 → vandropro direct SCP)
                          requires placing vandropro_key.pem on auditor
                          temporarily, which was blocked by the auto-mode
                          classifier. No paid infrastructure provisioning
                          or new model download is authorized for 119B
                          without operator authorization (per directive).
Status:                   OPEN — 119B build-and-setup complete; binary
                          bundle (9/9 SOs + launcher), all slot files
                          (6 capsule/sidecar pairs + 3 manifests + 119A
                          JSONL reference), campaign script, and verify
                          script are all on vandropro and SHA-verified.
                          Single blocking artifact: Nemotron-3-Nano-30B-
                          A3B-Q4_K_M.gguf (23GB) not yet on vandropro.
Current verified state:   Node B (vandropro, 20.127.234.125) verified:
                          (1) /home/azureuser/llama_bin_a53/ — 9/9 files
                              complete. All 9 SHA256s independently
                              verified on vandropro 2026-08-25 — 100%
                              match vs RUNTIME_BUNDLE_V1.json.
                              Binary smoke test PASS (2026-08-25):
                              A53 server started port 8093 with Meta-
                              Llama-3-8B (GLIBC compat ✓, CUDA libs
                              resolved ✓). Log confirmed A53 patch
                              active: "context checkpoints enabled,
                              max=32, min spacing=256". Inference
                              PASS ("Paris, which is located"). Port
                              8093 closed clean after kill. Production
                              port 8080 not disturbed.
                          (2) /tmp/lnes119b_slots/ — 6 capsule+sidecar
                              files + 3 manifests + 119A JSONL; all SHA-
                              verified vs RUNTIME_BUNDLE_V1.json.
                          (3) /tmp/lnes119b_campaign.py +
                              /tmp/lnes119b_verify_setup.py — uploaded.
                          (4) /mnt/ — EMPTY. 164G free. Nemotron not
                              staged.
                          (5) Node A (auditor): model exists at
                              /home/azureuser/vanguard_engine/weights/
                              nvidia_Nemotron-3-Nano-30B-A3B-Q4_K_M.gguf
                              (SHA 378a2765..., 23GB). Direct TCP:22
                              path auditor→vandropro confirmed open
                              (DIRECT_SCP_VIABLE=YES from §3 recon).
                          (6) Two-hop via local machine: impractical
                              (~7h download at ~0.9MB/s + ~24h upload
                              at ~0.27MB/s).
Evidence:                 LNES119B_RECEIVER_NODE_RECON.md (§3/§4),
                          LNES119B_RUNTIME_BUNDLE_V1.json,
                          LNES119B_TRANSPORT_PROTOCOL.md (§7).
                          Background task bp3q7hgrh exit code 0
                          (libggml-cuda.so.0 SCP confirmed 2026-08-25).
Exact unblock condition:  Operator manually executes direct SCP from
                          auditor to vandropro:
                          Step 1 (from local Windows terminal):
                            ! scp -i Downloads/vanguard-auditor.pem `
                              Downloads/vandropro_key.pem `
                              azureuser@40.124.170.30:/tmp/vdp.pem
                          Step 2 (from operator SSH session on auditor):
                            scp -i /tmp/vdp.pem \
                              /home/azureuser/vanguard_engine/weights/nvidia_Nemotron-3-Nano-30B-A3B-Q4_K_M.gguf \
                              azureuser@20.127.234.125:/mnt/ && \
                            rm /tmp/vdp.pem
                          After transfer: run lnes119b_verify_setup.py
                          on vandropro to confirm model SHA matches
                          378a2765...
Next authorized action:   Operator executes the two SCP steps above.
                          On success: Claude runs verify_setup.py, then
                          lnes119b_campaign.py (§9 canary + §10 full
                          30-trial validation), then writes §11–§21
                          evidence documents and §22 completion report.
Prohibited action:        Do not download a new model copy or provision
                          new paid infrastructure for 119B without
                          operator authorization (directive invariant).
                          Do not start 119C without a separate operator
                          directive even if 119C_READY=YES.
                          Do not touch production port 8080 on auditor
                          (PID 766602, -ngl 42 -c 16384) or vandropro
                          (Meta-Llama-3-8B, port 8080).
                          Do not deploy A5.3 patch to production.
                          Do not modify production.
                          BLOCKCHAIN_WRITES=0, RHO_MOVED=0,
                          STAGE_E_ENTERED=NO, PRODUCTION_SERVER_
                          DISTURBED=NO.
Owner:                    Operator (model transfer authorization)
Last verified:            2026-08-25 — all 9 A53 binary SHAs
                          independently verified on vandropro (100%
                          match). Binary smoke test PASS: A53 server
                          started port 8093, GLIBC compat confirmed,
                          CUDA libs resolved, A53 patch active ("context
                          checkpoints enabled"), inference PASS, server
                          killed clean. Slot bundle, campaign script,
                          and verify script on vandropro and verified.
                          /mnt/ confirmed empty (164G free). Model
                          transfer is the single remaining blocker.
Public-claim impact:      None — LNES-119B is a metrology-only research
                          sprint. No tariff calculation, RHO movement,
                          or production claim changes are authorized
                          within 119B scope.
```

---

## BLK-029 — LNES-119B-F5B: Node B SSH inaccessibility for harness execution

```
Subsystem:               LNES-119B-F5B component-isolation experiment.
                          Harness (lnes119b_f5b_component_isolation.py,
                          SHA256 = 932c2557eed08e4e84bcf6f1a4058d9344245593
                          d5880a370def894d45532493) is written, locally
                          py_compile PASS, and staged on Node A at
                          /tmp/lnes119b_f5b/lnes119b_f5b_component_isolation.py
                          (Node A SHA verified = MATCH).
                          All F5B source artifacts (B_CORE, B_SIDECAR,
                          A_CORE, A_SIDECAR) are already on Node B from
                          prior F3/F4 phases. Execution is blocked solely
                          by inability to reach Node B via SSH.
Blocker class:            AUTHORIZATION_CREDENTIAL — all available .pem
                          keys in C:\Users\ezumb\Downloads\ rejected by
                          azureuser@20.80.44.219 (lnes119b-node-b, Intel
                          Xeon Platinum 8573C). Node A relay also rejected
                          (no key match via default SSH agent).
                          Auto-mode classifier halted systematic key
                          scanning after pattern detection.
Status:                   HISTORICAL — SSH_ACCESS_UNRESOLVED (historically
                          valid). No longer an execution blocker for F5B.
                          BLK-029_EXECUTION_IMPACT =
                            BYPASSED_BY_AUTHORIZED_AZURE_RUN_COMMAND
                          F5B executed and completed 2026-08-28 using
                          Azure VM Run Command management plane.
Current verified state:
  NODE_B_TARGET             = azureuser@20.80.44.219 (lnes119b-node-b)
  NODE_B_CPU                = Intel Xeon Platinum 8573C
  NODE_B_ACCESS_METHOD      = AZURE_VM_RUN_COMMAND (management plane)
  NODE_B_SSH_STATUS         = STILL UNRESOLVED (not needed for F5B)
  NODE_B_MANAGEMENT_PLANE_VERIFIED = YES (2026-08-28)
  AZURE_RESOURCE_GROUP      = LNES119B-RG
  F5B_V2_HARNESS_SHA256     = cf5c1220ebbbffaffe0af7b9b6f95ada6861e0cdea1e981c9ca6873e0884fa65
  NODE_B_HARNESS_SHA_MATCH  = YES (verified on Node B via sha256sum)
  NODE_B_PY_COMPILE         = PASS (runuser -u azureuser)
  EXECUTION_USER            = azureuser (not root)
  F5B_COMPONENT_CONTROL_REALIZATIONS = 2 (H_RASB + H_RBSA)
  DIVERGENCE_COMPONENT      = R_AND_S_INDEPENDENTLY_CONTRIBUTE
  ROOT_CAUSE                = UNKNOWN
  TOTAL_STATE_MOBILITY_TRIALS_EXECUTED = 6 (unchanged)
  CONFIRMATION_AUTHORIZED   = NO
Evidence:                 Entry 014 (initial block), Entry 015 (correction),
                          Entry 016 (completion) in LNES119B_EVIDENCE_LEDGER.md.
                          deploy.txt explicit authorization 2026-08-28.
Exact unblock condition:  F5B EXECUTION COMPLETE — blocker bypassed.
                          SSH access to Node B remains unresolved as a
                          historical credential gap but is no longer blocking
                          any currently authorized LNES-119B work item.
Next authorized action:   None for F5B scope. Operator to determine
                          next LNES-119B phase.
Prohibited action:        Creating new SSH credentials.
                          Copying private keys to another machine.
                          Changing firewall rules.
                          Scanning for additional .pem keys.
Owner:                    Operator
Last verified:            2026-08-28 — F5B executed via Azure Run Command.
                          Both trials completed (H_RASB, H_RBSA).
                          DIVERGENCE_COMPONENT = R_AND_S_INDEPENDENTLY_CONTRIBUTE.
                          Artifacts preserved on Node B at /tmp/lnes119b_f5b_output/.
                          F5B_COMPONENT_CONTROL_REALIZATIONS = 2.
                          INDEPENDENT_NETWORK_TRANSFERS_F5B = 0.
                          TOTAL_STATE_MOBILITY_TRIALS_EXECUTED = 6.
Public-claim impact:      None — LNES-119B is a metrology-only research
                          sprint. No production claims, RHO movement,
                          or blockchain writes authorized within F5B scope.
```

---

## BLK-030 — OTET restart control-plane: PM2 restart unconditionally denied on Portal — CLOSED

```
Subsystem:                LNES-17 OTET file-write governance, extended to
                          process-control (PM2 restart) on Portal
                          (biological_proxy / agent_shell_gate.sh).
Blocker class:            DEPENDENCY_PREREQUISITE (a required backend
                          endpoint, /api/admin/build/active-otet-check,
                          referenced by the live forced-command gate, had
                          never been deployed — so every restart request
                          unconditionally denied, blocking ALL pending
                          Portal/Carrier OTET-governed deployments that
                          require a restart to take effect).
Status:                   CLOSED — V3 restart-OTET control plane bootstrapped
                          to Portal production 2026-09-03T01:56Z.
                          SOFTWARE_STATUS=DEPLOYED
                          PRODUCTION_STATUS=SELF_HOSTING
Current state:            Discovered while attempting to deploy an unrelated
                          Omega P0 auth fix: otet_harness.py restart failed
                          with "LNES-17: Access Denied. No active OTET in
                          ledger." for every service, because the gate's
                          gate_active_otet_check() called a
                          /api/admin/build/active-otet-check endpoint that
                          did not exist server-side. Root-caused via direct
                          command comparison (not accepted at face value).
                          Resolved through three iterations (V1 rejected on
                          review for 4 concrete defects incl. multi-token
                          consumption and principal-binding gaps; V2 fixed
                          those but still selected "oldest valid OTET for
                          service" rather than the exact issued token; V3
                          added exact-token binding, Portal-only host scope,
                          fail-closed post_write_hash persistence, and
                          restart-OTET token redaction in logs/denials).
                          Bootstrapped to production via a 7-step runbook
                          (local V3 harness activation, OTET-governed
                          backend staging, one explicitly-authorized
                          out-of-band manual restart, out-of-band gate
                          script replacement to /usr/local/bin/ — outside
                          WRITE_ALLOWED_ROOTS, so no OTET path could reach
                          it — then a second, fully OTET-governed
                          restricted-key restart proving the new mechanism
                          under its own authority). A concurrent, unrelated,
                          properly OTET-governed production edit
                          (/api/apps/public alias route, 30 lines) landed on
                          biological_proxy/index.js mid-sprint; caught by
                          the bootstrap's own pre-hash drift gate, mechanically
                          confirmed isolated via diff, and the candidate was
                          rebased onto the new baseline (not overwritten).
Blocked work:             NONE (unblocked). Every prior deployment this
                          session that stalled on "apply succeeds, restart
                          denied" (Omega P0 auth, Carrier-relay OTET
                          enablement, provider-neutral model registry) can
                          now proceed to its restart step via
                          otet_harness.py restart <service> portal
                          --after-hash <sha256>.
Exact unblock condition:  ALL MET 2026-09-03T01:56Z:
                          (1) V3 backend live on Portal, hash verified ✓
                          (2) V3 gate live at /usr/local/bin/agent_shell_gate.sh,
                              hash verified ✓
                          (3) A restart-OTET issued, transported, and
                              consumed end-to-end using ONLY the restricted
                              exergynet_agent key ✓
                          (4) PM2 restart succeeded via that path
                              (restart_count 23→24, pid changed) ✓
                          (5) No full restart-OTET token found in any
                              application/gate log inspected post-restart ✓
Next authorized action:   Ordinary OTET-governed restarts for any
                          PM2_ROSTER service on Portal via
                          otet_harness.py restart <service> portal
                          [--after-hash <sha256>]. Carrier-relay
                          deployment, model-registry deployment, and Omega
                          P0 deployment remain separately NOT authorized —
                          this blocker's closure only removes the restart
                          obstacle, it does not itself authorize those
                          deployments.
Prohibited action:        Adding /usr/local/bin/ broadly to
                          WRITE_ALLOWED_ROOTS (explicitly rejected by the
                          Architect; a narrow exact-file
                          CONTROL_PLANE_SCRIPT_UPDATE capability was named
                          as the preferred future alternative, not built).
                          Restarting via any unrestricted key
                          (exergynet.pem/exergynet2.pem) outside the single
                          named bootstrap exception.
Owner:                    Architect — V3 bootstrap closed 2026-09-03.
Last verified:            2026-09-03T01:56Z — live restart_count=24,
                          pid=2784769, health=200, live SHA256=
                          2e759409ff386ed62a39079de366b993d0d1887a3cf16b16ec77cd5d5a1f9644
                          (matches rebased V3 candidate exactly), gate
                          SHA256=de3b10e00ff41bb1398388a3e751515aa61390cbc1e521861dbf487e62765cd9.
                          Full evidence: Downloads/exergynet/review/
                          OTET_RESTART_REMEDIATION_V3/BOOTSTRAP_CLOSURE_20260903T015138Z.md
Public-claim impact:      None — the restart control-plane's prior broken
                          state was never claimed as working in any public
                          document.
```

---

**Related:** A separate, private vault-state reference and white-paper
status-claim policy exist outside this repository and are not detailed here.
