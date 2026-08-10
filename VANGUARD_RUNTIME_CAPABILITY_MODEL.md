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
