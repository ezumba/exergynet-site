# MyMonitor `/v1/extract` — Semantic Contract

Repair completed 2026-08-11, in response to Veena's external validation
finding 8 failing cases. Covers what changed, why, and the exact contract
`/v1/extract` now implements. Read alongside
`VANGUARD_RUNTIME_CAPABILITY_MODEL.md`'s `/v1/extract` policy section
(access/authorization — unchanged by this repair) for the full picture.

## Root cause

`/v1/extract`'s request contract is `{ text: string, schema: object,
examples?, domain? }` — a single flat `text` blob plus a field→type schema.
There was never a first-class per-field "question" — only whatever a
caller's own `schema[field].description` happens to carry, which the
extraction prompt never explicitly instructed the model to treat as
authoritative context. Combined with that, the prior extraction prompt's
only rule was *"if a field can't be confidently extracted, return null"* —
with no distinction between a resolved negative, an explicit "unknown", and
"not mentioned/unavailable" (all three collapsed to `null`), and the
response had no `needs_clarification` field at all, anywhere. `confidence`
was a crude populated/total-fields ratio, not a judgment about whether the
extracted *state* was correct.

## Exact model-facing context — before repair

```
extractMessages = [
  { role: 'system', content: SEI_STRUCTURED_EXTRACTION_PROMPT + domain context + schema JSON + examples },
  { role: 'user', content: 'Text to extract from:\n\n' + text },
]
buildPrompt(extractMessages, JSON_MODE_ADDENDUM, rawMode=false, modeOverride=domain)
```

Because `rawMode` was `false`, `buildPrompt()` selected its **own**
platform-policy system prompt (`SEI_CLINICAL_PROMPT` — a generic
conversational clinical-chat prompt with directives about SOAP notes, ICD-10
codes, escalation reason codes, none of which apply to extraction) and
prepended it, then *separately* re-emitted `extractMessages[0]` as a
**second** system block (since `buildPrompt`'s non-raw path doesn't special-
case an existing system message in its input array). Every extraction
request carried two competing, redundant system blocks, and the actual
extraction instructions (`SEI_STRUCTURED_EXTRACTION_PROMPT`) had no
explicit negation/context-binding guidance in it at all.

## Exact model-facing context — after repair

```
extractMessages = [
  { role: 'system', content: SEI_STRUCTURED_EXTRACTION_PROMPT (rewritten) + domain context + schema JSON + examples + JSON_MODE_ADDENDUM },
  { role: 'user', content: 'Text to extract from:\n\n' + text },
]
buildPrompt(extractMessages, undefined, rawMode=true, modeOverride=domain)
```

`rawMode=true` uses exactly `extractMessages[0]`'s content as the sole
system block — no overlay, no duplication. `JSON_MODE_ADDENDUM` is now
folded directly into that message (the `rawMode` path ignores the
`toolAddendum` parameter), which also fixed a side issue: the NVIDIA
fallback path (`nvidiaExtractCompletion`, which sends `extractMessages`
directly and never touched `buildPrompt` at all) previously never received
`JSON_MODE_ADDENDUM` either — it now does, automatically.

## Negation/unavailability handling

The model now returns three parallel objects per response, not just a flat
value map:

```json
{
  "extracted": { "<field>": "<value or null>" },
  "field_states": { "<field>": "affirmative | negated | unknown | not_provided" },
  "field_confidence": { "<field>": "0.0-1.0" }
}
```

State definitions (see the prompt itself, `SEI_STRUCTURED_EXTRACTION_PROMPT`,
for the full text the model receives):

| State | Meaning | `extracted` value |
|---|---|---|
| `affirmative` | response establishes the fact/value as present/true | the value |
| `negated` | response explicitly denies the fact (generalized pattern: "denies X", "no X", "without X", "negative for X", "has never X", "not currently X") | `false` (booleans) — never `null` |
| `unknown` | response explicitly states the info isn't known ("I don't know") | `null` |
| `not_provided` | response states the info is unavailable/not on record — an epistemic gap, not evidence of falsity | `null` |

`false` and `null` are never collapsed into each other. A resolved
negative is a fully-determined clinical answer; `not_provided` is a gap in
the record; the two must never be conflated (this was the literal Case 2
failure: "no medication history *available*" is `not_provided`, not
`negated`).

**Server-side invariant enforcement**: live testing during this repair
showed the model doesn't always honor "unknown/not_provided must serialize
`extracted=null`" on its own, especially for fields with no `description`
to anchor the question. `runExtraction()` now enforces this deterministically
in post-processing — if `field_states[field]` is `unknown` or
`not_provided`, `extracted[field]` is forced to `null` regardless of what
the model put there. Never trust the model's raw value over its own state
marker.

## Contextual/elliptical answer handling

The prompt now explicitly instructs: bind `field + description(question) +
response` as one semantic unit, and never require the response to restate
the field/symptom name (`"For about 7 days"` is sufficient on its own once
bound to `cough_duration`'s description). When a field has **no**
`description`, the model is instructed to infer meaning from the field name
itself — verified working live for both cases (see Verification below).
Callers who want maximum contextual accuracy should supply `schema` in the
full JSON-Schema object form with a `description` per field, not the bare
`{"field": "type"}` shorthand — both are supported, but the object form
with `description` is the more reliable binding.

## Boolean normalization

**Decision: normalize to whatever type the *caller's own request schema*
declares for that field**, per-request — not a fixed platform-wide
convention, since `/v1/extract`'s schema is caller-supplied per call. If a
field's declared `type` is `"boolean"`, the value is coerced to JS
`true`/`false` (accepting `1`/`0`/`"true"`/`"false"` from the model and
normalizing them). If a caller declares a boolean-like field as `"integer"`
instead, no boolean coercion is applied — whatever numeric value the model
returns passes through, preserving a `0`/`1` contract if that's what a
specific caller relies on. This is implemented once, generically, for any
scalar type mismatch (`boolean`, `number`/`integer`, `string`), not
hardcoded per field.

## Duration representation

**Decision: no new contract invented.** The declared schema type for a
duration field determines its shape — a `"string"` field gets a string like
`"about 7 days"` (verified: cases 7/8 both pass with `type: "string"`); a
caller could equally declare `"type": "integer"` and rely on the existing
scalar-coercion path above. No dedicated `{value, unit}` object contract
was added in this pass, since neither Veena's cases nor any discoverable
existing MyMonitor convention required one — this can be added later as an
additive schema-declared option if a real caller needs it, without breaking
the string/number paths that already work.

## Confidence semantics

**Confidence means: the model's confidence that the *state* it assigned
(including `unknown` or `not_provided`) is the correct reading of the
response — not confidence limited to non-null values.** `{"value": null,
"confidence": 0.9, "needs_clarification": true}` is a normal, valid,
high-confidence result when the system is sure the response doesn't
establish the value. The model now emits `field_confidence` per field
directly (this is where the judgment belongs — the model doing the
reasoning, not reverse-engineered in post-processing); the response's
top-level `confidence` is the mean of those. Existing clients reading only
`confidence` (a number 0–1, unchanged type) are unaffected by the meaning
change; no client relying on the *old* populated-ratio definition is known
to exist. Falls back to the old ratio-based calculation only if the model's
response doesn't include `field_confidence` at all (e.g. a non-compliant
fallback-model response), so the field is never silently missing.

## `needs_clarification` — new, additive field

```
known affirmative/negative state  -> needs_clarification = false
known measurable value            -> needs_clarification = false
explicit unknown/unavailable      -> needs_clarification = true
insufficient evidence             -> needs_clarification = true
```

A resolved negative (`false`) is **not** a clarification request — it is a
complete, valid clinical answer. This is purely additive to the response
shape; no existing field changed type or was removed.

## Verification

`MYMONITOR_EXTRACTOR_REGRESSION_TESTS.js` — connects directly to the live
gRPC inference engine (no HTTP layer, no API key, run from the AskMo host),
building the exact prompt `runExtraction()` now builds. 17 cases: Veena's
8 frozen cases (verbatim, unmodified), 5 negation-control pairs, 2
context-binding controls (same response text bound to two different
duration fields, proving semantic-frame binding rather than pattern-
matching), and 2 no-description-fallback cases. Confirmed 17/17 passing on
a clean run; across ~6 total live runs during this repair, an occasional
(~1/17) single-case **empty gRPC response** was observed — never a wrong
answer, always empty output, and never the same case twice — consistent
with transient network/channel flakiness in a tight sequential test loop,
not a content/logic defect. Recommend any production client implement
standard retry-on-timeout/empty-response handling, which is reasonable API
client design generally and unrelated to this specific repair.

One live, reproducible bug was found and fixed *during* this repair (not
part of Veena's original 8, found by this repair's own negation-control
testing): a plain unqualified affirmative statement ("Patient smokes") was
being misclassified as `negated` — the original prompt's negation section
had extensive negative-pattern examples but no contrasting affirmative
example, and the model appears to have over-generalized toward "negated" as
a default for sensitive-sounding clinical topics. Fixed by adding an
explicit affirmative/negated contrast pair to the prompt; reproducibly
fixed across repeated runs afterward.

## Known limitation, out of scope for this repair

`/v1/extract`'s access policy (any authenticated key, no capability gate)
was explicitly not touched — see `VANGUARD_RUNTIME_CAPABILITY_MODEL.md`'s
`PUBLIC_SPECIALIZED_API` classification, unchanged by this pass per
instruction.
