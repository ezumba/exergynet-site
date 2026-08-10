# Vanguard Vision Runtime Recon

**Investigated:** 2026-08-10. Read-only — no production changes made as part of
this document; the repair recommendation below is a plan, not yet implemented.

## Current path

`portal/src/app/api/vision/describe/route.ts` → `POST {AskMo}/v1/chat/completions`
with `model: 'vanguard-pro'` and OpenAI multi-part message content:
`[{type:'image_url', image_url:{url: 'data:...;base64,...'}}, {type:'text', text: FILTER_PROMPT}]`.

## Actual image-capable backend: none

Traced `vanguard-pro`'s serving engine to its source on the `vandropro` host.
Its gRPC protocol (`vanguard_engine/proto/*.proto`) is:

```proto
message PromptRequest {
    string prompt = 1;
    string developer_id = 2;
}
```

A plain string field. No image, no binary payload, no multimodal field of any
kind exists in this wire protocol. **This engine was never built to accept
images** — this is a protocol-level fact, not a capacity or performance
question. No amount of GPU headroom fixes this; the wire format itself has no
way to carry an image.

## What actually happens to the image today

AskMo's TypeScript layer (`biological_proxy/src/index.ts`) types every
message's `content` field as `{ role: string; content: string }[]` throughout
— `detectMode`, `truncateMessages`, `buildPrompt`, `processBatchJob`,
`runExtraction`, all of them. There is no type anywhere in this codebase that
accounts for OpenAI's multi-part content array. TypeScript's type erasure
means this was never actually enforced at runtime — the real HTTP request
body can be (and, for vision calls, is) shaped differently than the type
claims, and every downstream function silently operates on the wrong
assumption.

This is not hypothetical. A code comment at `index.ts:~610`, dated
**2026-07-14**, documents the exact same failure mode already having
occurred and been partially patched:

> "Guard: content can arrive as an array (OpenAI multi-part message format,
> e.g. image_url + text blocks) rather than a plain string.
> `query.toLowerCase()` on a non-string threw an unhandled promise rejection
> here — the request just hung with no response at all, worse than a 502.
> Confirmed live 2026-07-14 (5x in the error log before this fix)."

That specific crash site (`detectResponseType`) was patched with a
`typeof query !== 'string'` guard. **The underlying type-level gap was not
fixed — only that one downstream symptom was.** `detectMode()` runs earlier
in the same request handler and has no equivalent guard. A live test this
session reproduced the identical symptom (indefinite hang, zero response,
eventual connection failure after several minutes) via a real vision call —
consistent with the same bug class resurfacing at a different, still-
unpatched point in the pipeline, compounded by whatever the underlying
engine does when it receives a stringified/garbled version of image data it
was never built to interpret in the first place.

## Historical path

No evidence found that this endpoint ever worked correctly end-to-end. No
git history is available on the AskMo host (not a repo — confirmed earlier
this session), and no earlier backup snapshot of `vision/describe/route.ts`
exists locally to compare against. The Portal-side route comment
(`route.ts:4-8`) states it uses "the same Vanguard vision backend
`xlmp_ingest_core.ts` uses for scanned-PDF/image OCR" — worth checking
whether *that* consumer has ever actually succeeded, as a second data point,
before assuming this endpoint once worked and regressed. Not checked in this
pass — flagged as a next step, not asserted either way.

## Resource requirements

Not applicable in the sense originally asked — this isn't a capacity
question. A genuinely vision-capable model needs: a multimodal-trained model
(the fleet has none — `vanguard-standard`/`pro`/`ultra` are all text-only
LLMs per their proto definitions and observed behavior), a serving stack
whose protocol actually carries image tensors/embeddings, and real GPU memory
budgeted for vision preprocessing (typically smaller than the LLM itself, but
non-zero and currently entirely unbudgeted anywhere in this fleet).

## Minimal repair

Two independent layers, both required, neither sufficient alone:

1. **Fail fast and honestly, immediately.** Add the same `typeof content !==
   'string'` (or `Array.isArray`) guard to `detectMode()` and any other
   function in the request path that assumes string content, returning a
   clean `400`/`501` ("multimodal content not supported by this model") the
   moment array content is detected — before it reaches the point that hangs.
   This alone doesn't make vision work, but it turns "hang for several
   minutes, fail silently" into "fail instantly, with a real error" — a
   correctness fix independent of whether vision ever gets built.
2. **Route vision requests to an actually vision-capable model, or don't
   claim to support vision at all.** There is currently no vision-capable
   engine anywhere in this fleet. Either (a) provision one (a genuinely
   multimodal model, on its own accelerator budget, with a protocol that
   carries image data), or (b) mark `vision-describe` as not supported and
   remove/gate the client-facing feature until (a) is real. Continuing to
   route vision calls at `vanguard-pro` is not a capacity problem to wait
   out — it will never work regardless of GPU headroom, because the wire
   protocol cannot carry the image.

## Fallback policy (recommended)

If a vision request is received and no vision-capable engine is configured:
respond immediately with a clear, structured error (`503`, `{"error":
"vision runtime not currently available"}`) — never silently degrade to a
text-only model attempting to describe an image it never received, and never
let the request hang past the immediate-fail guard in step 1 above.

## Timeout policy (recommended)

Per Section 4 of the directive this recon responds to: **do not simply raise
the current 25-second timeout.** Once step 1's guard is in place, an
unsupported-content request fails in well under a second — no timeout
increase is needed for that case. If a real vision-capable backend is later
provisioned, set its timeout from that backend's own measured latency
(unknown until it exists), not from a guess.

## Classification

**UNAVAILABLE — dependency/runtime architecture issue**, not a transient
capacity problem. Distinct from `vanguard-pro`'s own text-completion
degradation (BLK-012, capacity-related, expected to resolve with new
hardware) — this is a "this was never built" gap, and BLK-012 resolving
will not fix it.
