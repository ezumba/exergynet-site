# Vanguard Runtime Capability Model

Status as of 2026-08-10. Covers `runtime_profile` authorization design,
the `@mymonitor.ai` legacy shim, output-format independence, and the fixes
made to close the mode-leak and biotech-JSON bugs — including one finding
more severe than what was originally scoped.

## Critical finding: the earlier gating fix never touched the real prompt

The account-gating fix deployed earlier today (`isMyMonitorAccount`,
documented in `VANGUARD_MODE_ROUTING_RECON.md`) computed a correctly-gated
`inferenceMode` in every request handler — but `buildPrompt()`, the function
that actually assembles the text sent to the model, **ignored that value
entirely** and always re-derived its own system-prompt choice via an
internal, ungated `detectMode(messages)` call. Every caller's gated
`inferenceMode` was, until today, used only for response metadata (the
`mode` field, the `X-Vanguard-Mode` header, token counting) — never for the
actual prompt.

Fixed by adding a `modeOverride` parameter to `buildPrompt()`; every call
site that had already computed a gated mode now passes it through instead of
letting `buildPrompt` recompute it from raw content. Six call sites updated:
the realtime `/v1/chat/completions` handler (both the initial build and the
temporal-context rebuild), `processBatchJob`, `executeChainJob`, and
`runExtraction` (which now passes the already-selected `domain` instead of
re-deriving — this also finally honors that function's own pre-existing
"bypass detectMode entirely" comment, which was previously not actually
true).

This is the real reason `X-Vanguard-Mode` reporting `physics` was not
sufficient evidence the leak was closed — the header and the prompt could
diverge. See `VANGUARD_RUNTIME_ISOLATION_TESTS.js`, test 10, for a
regression test specifically targeting this class of bug (an in-content
prompt-injection attempt must not be able to change which system prompt
`buildPrompt` selects once a caller has already supplied a gated mode).

## Fixed this pass

- **General-JSON → biotech bug (item 9).** `inferenceMode` was
  unconditionally `'biotech'` whenever `response_format: {type:
  'json_object'}` was set, regardless of content — e.g. a JSON request to
  list programming languages got the biomedical-JSON-API system prompt.
  Response encoding (`isJsonMode`) and system-prompt selection
  (`inferenceMode`) are now independent; JSON formatting is still forced via
  `jsonAddendum` without touching prompt selection.
- **`/v1/batch` mode-leak (item 10).** `processBatchJob` called
  `detectMode()` directly with no account gate — a second, ungated route
  into `'clinical'` mode by keyword content alone, for any account. Now
  applies the same `isMyMonitorAccount` gate as the realtime path, keyed off
  a new `developer_email` field captured at job-creation time.
- **`/v1/batch/chain` mode-leak (found during the item-10 audit, same bug
  class).** `executeChainJob` had the identical gap — flagged and fixed
  even though the literal ask named only `/v1/batch`, since it's the same
  vulnerability and the same "no alternate route should bypass the repaired
  realtime path" principle applies.
- **Interim authorization tightening (2026-08-10, after explicit operator
  authorization for the full model below).** Explicit `mode='clinical_runtime'`
  previously worked for *any* account, completely ungated, across all three
  request paths. Now denied outright (`403`) for non-MyMonitor accounts at
  the realtime handler and at `/v1/batch/chain` submission time (rejected
  before any job runs, not mid-execution). This uses the same
  email-domain signal as the keyword-fallback gate — explicitly an interim
  measure, not the long-term mechanism, and not extended to any other
  domain. See the authorization-model section below for why this isn't the
  final state.

## Observed, not modified: `/v1/extract`

`inferExtractDomain()` has no account gate and **defaults to `'clinical'`**
for any non-biotech-keyword content — a stronger version of the same
pattern. Not changed in this pass: `/v1/extract` is explicitly documented as
a MyMonitor-purpose-built structured-extraction endpoint (its own comment:
`POST /v1/extract ... (MyMonitor /v1/extract)`), so a clinical-biased default
may be intentional route-level design rather than a leak — unlike the
general-purpose chat/batch/chain endpoints, every caller of this specific
route is presumably already doing domain-specific extraction. Flagging for a
deliberate decision rather than silently changing behavior on a route this
document isn't confident is actually general-purpose.

## `allowed_runtime_profiles` authorization model (item 6) — designed, not yet live

**Design (not yet deployed — see blocker below):**

- New column `biological_developers.allowed_runtime_profiles TEXT[] NOT
  NULL DEFAULT '{general}'`.
- `authenticate` middleware's three `SELECT ... FROM biological_developers`
  queries extend to select this column; `AuthedRequest.developer` type gains
  `allowed_runtime_profiles?: string[]`.
- New independent request field `runtime_profile` (distinct from `mode` and
  from `response_format`). Server checks membership: a request for a
  `runtime_profile` not in the caller's `allowed_runtime_profiles` is
  rejected (`403`), not silently downgraded.
- `@mymonitor.ai` accounts get `allowed_runtime_profiles = {clinical,
  general}` via a one-time backfill, explicitly logged as
  `LEGACY_COMPATIBILITY_SHIM` (item 7) — their existing client, which sends
  `mode='clinical_runtime'` and never the new `runtime_profile` field,
  continues to work unchanged. Not extended to any other domain.
- `runtime_profile` stays fully independent of `response_format` (item 8) —
  the same matrix already holds for `inferenceMode`/`isJsonMode` today: any
  combination of `{general, clinical, research, physics, code} ×
  {text, json_object, json_schema, audio, binary, sse}` is valid; JSON
  formatting is applied via `jsonAddendum` without touching which system
  prompt is selected.

**Why not deployed:** implementing this requires an `ALTER TABLE` +
backfill `UPDATE` against the live `vanguard_db` on the AskMo host. The
operator gave explicit, well-scoped in-session authorization for exactly
this (additive column only, `general`-only default, backfill restricted to
already-verified existing MyMonitor accounts, explicit rollback path). Two
execution attempts followed, across two different invocation tools: a
schema-only read (`\d biological_developers`) succeeded, but both a
row/account-data read and the `ALTER TABLE` itself were independently
blocked by the permission classifier — before *and* after the explicit
authorization was presented. The authorization's own instructions covered
this exact scenario ("if the classifier still blocks it, stop, don't route
around it"), so the migration was not attempted a third way. See BLK-015.

Migration SQL (for whenever a path exists that the classifier will allow —
e.g. the operator running it directly):

```sql
BEGIN;
ALTER TABLE biological_developers
  ADD COLUMN IF NOT EXISTS allowed_runtime_profiles TEXT[] NOT NULL DEFAULT '{general}';
UPDATE biological_developers
  SET allowed_runtime_profiles = ARRAY['general','clinical']
  WHERE email ILIKE '%@mymonitor.ai' AND active = true;
COMMIT;
-- Rollback (additive-only, no data loss elsewhere):
-- ALTER TABLE biological_developers DROP COLUMN allowed_runtime_profiles;
```

The application-layer code for the full model (the new column select, the
`runtime_profile` request field, server-side membership enforcement) has
still not been written, since deploying it against a column that doesn't
exist would break authentication outright.

**Interim state (deployed 2026-08-10):** explicit `mode='clinical_runtime'`
— previously ungated for any account — is now denied (`403`) for
non-MyMonitor accounts, using the same email-domain signal as the existing
keyword-fallback gate. This is a real, if partial, closure of the gap
`allowed_runtime_profiles` is designed to fully close — it uses the
mechanism item 6 explicitly says not to make permanent, kept only as a
stopgap until the migration lands.

## Verification

`VANGUARD_RUNTIME_ISOLATION_TESTS.js` — 12/12 passing (10 categories, 3 and 8
each split into a denied/allowed pair after the interim tightening),
extracted verbatim from the deployed source. Covers: keyword-leak isolation
across all three request paths (realtime, batch, chain) for both gated and
legacy-shim accounts, the JSON/biotech decoupling, the new explicit-mode
denial behavior, and the `buildPrompt` prompt-injection-resistance case.

Live end-to-end HTTP verification through the public
`explorer-api.exergynet.org` gateway was attempted but inconclusive — that
gateway returned `200` with no `Authorization` header and produced no
corresponding log entries on the AskMo host, meaning it did not appear to be
routing through the real `biological_proxy` process for at least some
request shapes. This is a separate, unresolved observation (possibly a
caching/demo layer in front of the real backend) — worth its own follow-up,
not something this pass fixed or fully diagnosed.

## Deployed

Build succeeded clean (`tsc`, zero errors) and `biological-proxy` restarted
online on the AskMo host. One pre-existing runtime error was observed in
logs after restart (`TypeError: prompt.trim is not a function` at
`checkSemanticRoute`) — not introduced by this pass (neither that function
nor its call site were touched); consistent with the array-content-into-
string-typed-function bug class documented in
`VANGUARD_VISION_RUNTIME_RECON.md`, surfacing from live non-text-content
traffic.

---

## Governance closeout addendum (2026-08-10, second pass)

### Critical finding: two model aliases bypass ALL runtime-mode gating

`/v1/chat/completions` contains two early-return intercepts, both **before**
any of the `inferenceMode`/`clinicalAuthorized` logic in the same handler:

```ts
if (req.body.model === 'vanguard-ultra') { ... executeBilateralConsensus(...) ... }
if (req.body.model === 'vanguard-race')  { ... executeVanguardRace(...) ... }
```

Both take the caller's own `system`-role message verbatim
(`messages.find(m => m.role === 'system')?.content || SEI_SYSTEM_PROMPT`)
and forward it directly to the underlying engines. Neither calls
`detectMode()`, neither calls `buildPrompt()`, neither is touched by
`clinicalAuthorized` or any other authorization check — old or new. This is
not a keyword-leak in the sense of everything else fixed this session; it's
a complete bypass of the entire gating apparatus for these two specific
model names. Confirmed by reading `executeBilateralConsensus()` and
`executeVanguardRace()` (~line 1888, ~2068) — both simply pass
`systemPromptBase` straight to `callEngine`/`callEngineTimed`/
`callAuditorHttp` with no further processing.

**Not fixed in this pass** — this session's scope was recon/audit/
documentation, explicitly not further implementation. Tracked as `BLK-016`
in `PROJECT_BLOCKERS.md`. This is very likely the single most important
finding of this entire multi-session effort: every account-gating and
`buildPrompt`-routing fix made earlier only applies to the default code
path, not these two aliases.

### Full bypass-audit sweep result

Enumerated every `detectMode(`, `SEI_CLINICAL_PROMPT`, `clinical_runtime`,
`buildPrompt(`, and route declaration in the captured baseline:

- **Realtime, batch, batch-chain**: gated (fixed this session).
- **`/v1/extract`**: does not use `detectMode()`/`inferenceMode` at all —
  has its own separate `domain` selection, passed directly into
  `buildPrompt()`'s `modeOverride`. Not a `detectMode`-leak, but see its own
  policy classification below — it has no account gate of any kind.
- **`vanguard-ultra` / `vanguard-race` model intercepts**: bypass
  everything, per the critical finding above.
- **`renderSpokenReply()`** (voice-pipeline confirmation-sentence
  generator, internal-only): still calls `buildPrompt(messages, '')` with
  no `modeOverride` — `detectMode()` still runs internally there. Low
  severity: not exposed to differential per-caller/per-account leak (same
  behavior for every caller), doesn't affect the actual extraction result
  returned to the user (only the phrasing of a spoken confirmation), but is
  technically still a raw, unguarded call site. Noted, not fixed.
- **`/v1/models`**: the `clinical_runtime: true` fields found there are
  static descriptive metadata in a models-capability listing, not a gating
  mechanism — confirmed benign.
- **Streaming vs non-streaming**: share the same gated code path (the
  `streamNonStream` branch reuses the same `formattedPrompt`/`inferenceMode`
  computed upstream) — no separate exposure.
- **Tool/agent routes**: function-calling (`tools`) is handled inline within
  `/v1/chat/completions`, not a separate route — no separate exposure.

### `/v1/extract` policy classification

**PUBLIC_SPECIALIZED_API.**

- Any authenticated API key can call it — `authenticate` middleware only,
  no `isMyMonitorAccount`/`clinicalAuthorized`/capability check of any kind.
- It does invoke clinical-flavored inference: `domain` (explicit request
  field, or `inferExtractDomain()`'s content-based guess, which itself
  defaults to `'clinical'` for anything not biotech-flagged) selects
  `SEI_CLINICAL_PROMPT` as part of its system prompt.
- It uses a **separate extraction policy**, not the general chat
  `inferenceMode` pipeline — its own `SEI_STRUCTURED_EXTRACTION_PROMPT` +
  domain context + JSON schema + examples, with its own JSON/schema
  enforcement (`schema_keys`, `confidence`, `validation_warnings` in the
  response). It does not go through `detectMode()`/`inferenceMode` at all.
  This is architecturally isolated from the mode-leak class of bug, not
  vulnerable to it, but has its own, different gap: no account gate at all.
- It is publicly documented already — listed in `apiServicesManifest.ts` as
  `id: 'extract'`, `label: 'Sovereign Clinical Extractor'`, a public,
  described product. Its own code comment explicitly ties it to MyMonitor's
  use case (`POST /v1/extract ... (MyMonitor /v1/extract)`), but nothing in
  the code restricts it to MyMonitor accounts.
- **Conclusion**: this endpoint's current "any authenticated key, always
  clinical-capable" behavior is either a deliberate, already-shipped product
  decision (a public specialized API, open by design, distinct from the
  general-purpose chat endpoints) or an oversight that happens to look like
  one — this document can't tell which from the code alone. Not changed in
  this pass, per instruction. Recommend the operator explicitly confirm one
  way or the other, since if it's unintentional, it's a real gap (any
  developer key can already do full clinical-domain structured extraction
  today, regardless of the `allowed_runtime_profiles` work above).

### Clinical Runtime vs. Clinical Extraction API — two distinct mechanisms

- **A. Clinical Runtime** — general Vanguard inference (`/v1/chat/completions`,
  `/v1/batch`, `/v1/batch/chain`) operating under `SEI_CLINICAL_PROMPT`
  policy, selected via `inferenceMode === 'clinical'`. This is what
  `allowed_runtime_profiles` (designed, migration blocked) is meant to gate.
- **B. Clinical Extraction API** (`/v1/extract`) — a purpose-built,
  schema-driven structured-extraction endpoint. Currently open to any
  authenticated key regardless of runtime-profile authorization.

These are independent capabilities and may reasonably have independent
access policies. Example: Healthcare Startup A might be granted both
(`clinical` runtime + extraction); a different developer might reasonably
be granted extraction only, or neither. Today, (B) is unconditionally open
to everyone, and (A) will be gated by `allowed_runtime_profiles` once the
migration lands — these are not currently symmetric, which is the direct
consequence of the classification above.

### Runtime-profile vs. service-permission — is a second axis needed?

**Not yet, and not proven necessary.** `allowed_runtime_profiles` (item 6's
subject) answers "which *policy* may this request run under" (general vs.
clinical vs. future specializations) — a property of *how inference
behaves*. A hypothetical `allowed_services` would answer "which *endpoints*
may this key call at all" — a property of *API surface access*. The
existing `authenticate` middleware plus each route's own logic already
functions as a coarse version of the second axis today (e.g. `/v1/extract`
is reachable by any authenticated key; there is no per-route allowlist
mechanism beyond that). Introducing a second, fully general `allowed_services`
array now would be solving a problem that doesn't clearly exist yet — no
route currently needs "authenticated but not entitled to call this specific
endpoint" semantics beyond what runtime-profile gating inside the route
itself already provides (once implemented). **Recommendation: implement
`allowed_runtime_profiles` first, ship it, and revisit whether a service
dimension is actually needed once `/v1/extract`'s policy question above is
resolved** — if the answer there is "extraction should require its own
grant separate from clinical runtime," that's the first real signal a
second axis is needed, not a hypothetical one.

### Future healthcare-startup onboarding — target model

```
developer/account provisioned
        |
clinical capability granted (allowed_runtime_profiles includes 'clinical')
        |
API key inherits capability (authenticate middleware reads it)
        |
explicit runtime_profile='clinical' request (and/or /v1/extract call,
per whatever that endpoint's policy is decided to be)
        |
Vanguard
```

No email-domain code change, no new `detectMode()` keyword, no fork, no
customer-specific model required for a second healthcare integration. The
existing `@mymonitor.ai` check remains exactly what it's labeled:
`LEGACY_COMPATIBILITY_SHIM` — not extended to any other domain, not the
mechanism a new customer would be onboarded through.

### Version-control target recommendation

**Option B — a dedicated private AskMo repository**, not the existing
public `exergynet` repo (option A) and not folded into an unrelated
existing private repo (option C, and none was found that fits).

Rationale: `exergynet` is confirmed **public**
(`PROJECT_BLOCKERS.md`'s own header states this explicitly, and this
session's docs were written sanitized specifically because of it).
`biological_proxy`'s source contains real internal system prompts
(`SEI_CLINICAL_PROMPT`, `SEI_BIOTECH_PROMPT`, etc.), real internal routing
logic, and real architectural detail (engine addresses, gRPC contracts)
that has no reason to be public — this is exactly the kind of material this
session redacted *out* of the public manifest. Putting the AskMo source in
`exergynet` would reintroduce, at the source level, precisely what was just
removed at the documentation level.

Proposed layout (private repo, name suggestion `exergynet-askmo` or
similar):

```
askmo/
  src/                  (as captured in this baseline, 1:1)
  inference.proto       (the live one -- proto/inference.proto retired or
                         clearly marked DEAD/UNUSED if kept for reference)
  ecosystem.config.js
  package.json / package-lock.json
  tsconfig.json
  sympy_kernel.py
  .env.example          (template only, real .env stays out of git via
                         .gitignore, injected at deploy time same as today)
  ARCHIVE/               (the ~20 timestamped .bak files, as real git
                         history going forward makes loose .bak files
                         next to live source unnecessary)
```

Principle going forward: production source should be *reproducibly derived*
from version-controlled source — i.e., a fresh `git clone` + `npm install`
+ `npm run build` should produce a `dist/` matching what's actually
running, verifiable against `ASKMO_PRODUCTION_SOURCE_SHA256SUMS.txt`. Not
done in this pass — recommendation only, per instruction not to move
production files yet.

### Precise-language note (per explicit instruction)

Do not describe this session's work as "runtime capability gating
deployed." Accurate framing:

> **Interim runtime isolation deployed; durable, database-backed capability
> authorization remains blocked pending the migration above.**

The only thing genuinely live today is: (1) keyword-fallback clinical
routing gated by email-domain signal, (2) explicit `mode='clinical_runtime'`
now denied for non-MyMonitor accounts, (3) `buildPrompt()` honoring
whatever gated mode its caller computed instead of silently re-deriving
its own. None of that is "capability authorization" in the
`allowed_runtime_profiles` sense — it's a stopgap layered on the same
email-domain mechanism the target design explicitly says not to make
permanent.
