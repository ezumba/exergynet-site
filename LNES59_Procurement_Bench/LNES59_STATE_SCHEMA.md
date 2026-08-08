# LNES-59 State Schema

R&D / benchmark only. Nothing in this document describes production
behavior — see `xLMP_v2_ARCHITECTURE_PROPOSAL.md` for what's actually
deployed.

## Why a schema, not just "facts"

LNES-58's Entity Graph had exactly one epistemic category: a relation
either exists in the frozen graph or it doesn't (MATCH/NO_MATCH/
INCOMPLETE). That was correct for its domain — drug-interaction relations
in a closed, authored corpus are genuinely binary. Procurement information
is not: "I think Legal approved this" and "Legal approved this" are
different claims with different downstream consequences, and collapsing
both into one boolean `approved: true/false` is exactly the failure mode
LNES-59 exists to test whether xLMP avoids.

## The state envelope

Every piece of extracted information becomes a state envelope, never a
bare fact:

```
{
  "state_id": "<content-addressed id, sha256 of canonical envelope minus state_id itself>",
  "subject": "<entity or record the state is about>",
  "predicate": "<what's being claimed about the subject>",
  "value": "<the claimed value>",
  "source": "<human-readable source identifier>",
  "source_root": "<content root of the source document, if applicable>",
  "provenance": "<span/offset or extraction method within the source>",
  "effective_from": "<ISO date or null>",
  "effective_until": "<ISO date or null>",
  "supersedes": "<state_id of a prior state this replaces, or null>",
  "scope": "<the declared boundary this state is valid within>",
  "claim_type": "<one of the 11 types below>",
  "authority_status": "<UNVERIFIED | AUTHORIZED | POLICY_LIMITED | REVOKED | EXPIRED>",
  "confidence": "<CONFIRMED | PROVISIONAL | null — only meaningful for extraction-uncertain claim types>",
  "state_version": "<monotonic integer per state_id lineage>"
}
```

`state_id` is content-addressed (SHA-256 over the canonical JSON of every
other field) — the same discipline LNES-58's frozen Entity Graph and
`NegativeResolutionReceipt` already established: state that claims to be
evidence needs to be independently re-derivable, not just asserted by
whatever process produced it.

## Claim types (11, not collapsible)

| Type | Meaning | Example |
|---|---|---|
| `CONFIRMED_FACT` | Directly stated by an authoritative source within its declared scope | Payment ledger: invoice #4471 paid 2026-07-02 |
| `SOURCE_ASSERTION` | Stated by a non-authoritative source (email, chat, meeting note) | Email: "I think Legal approved this vendor" |
| `PROVISIONAL_CLAIM` | Stated as tentative even by its own source | Draft amendment, not yet signed |
| `HYPOTHESIS` | An inference or suspicion, not a claim of observed fact | "Vendor may be experiencing cash-flow problems" |
| `RECOMMENDATION` | A proposed action, not a claim about current state | "Purchasing should pause until certificate renewed" |
| `POLICY` | A standing rule that governs other claims, not itself a fact about a specific transaction | Manager approval limit = $10,000 |
| `AUTHORIZATION` | A specific, scoped grant of authority, distinct from a policy or an assertion that one exists | Signed approval for PO-2044, up to $38,000 |
| `DENIAL` | An explicit negative determination | "Contract amendment rejected by Legal" |
| `SUPERSEDED_STATE` | A former CONFIRMED_FACT or AUTHORIZATION whose validity window has closed because a newer state replaced it | Net 30 terms, superseded 2026-08-01 by Net 60 |
| `CONFLICTING_EVIDENCE` | Two or more CONFIRMED_FACT-eligible sources disagree and no authority hierarchy resolves it | Invoice says $42,000; PO says $38,000 |
| `UNKNOWN` | No state exists yet — distinct from a state that was looked for and found absent (that's a resolution state, see below) | Nothing has been extracted about this subject/predicate pair |

Note the difference between `SUPERSEDED_STATE` (a claim-type outcome —
this specific envelope's own lifecycle ended) and the resolution state
`SUPERSEDED` used at query time in the temporal model (§ below) — related
but not the same axis; kept distinct deliberately, matching the directive's
instruction not to overload resolution states with claim semantics.

## Resolution states (carried forward from LNES-58, kept orthogonal)

`MATCH` / `NO_MATCH` / `INCOMPLETE` remain resolution states only — they
describe whether the state-lookup process found something, not what kind
of thing it found. The architecture is a product of three independent
axes, not a single enum:

```
Resolution State  ×  Claim Type  ×  Authority Status
```

Example pair the directive itself gives, preserved here as the canonical
illustration:

```
resolution = MATCH, claim_type = SOURCE_ASSERTION, authority = UNVERIFIED
   ≠
resolution = MATCH, claim_type = AUTHORIZATION,     authority = VALID
```

Both are "found something" (MATCH). What was found is entirely different.
A gate or downstream consumer that only checks resolution state and
ignores claim_type/authority_status would collapse this exact distinction
— which is the whole point of building this schema instead of reusing
LNES-58's Entity Graph as-is.

## Temporal state (distinct from claim_type's SUPERSEDED_STATE)

A committed state's temporal standing, evaluated at query time against
`effective_from`/`effective_until`/`supersedes`:

| Temporal status | Meaning |
|---|---|
| `CURRENT` | Effective now, not superseded, not expired, not revoked |
| `SUPERSEDED` | A newer state with the same subject/predicate/scope now takes precedence, but this state remains historically true for its own effective window |
| `EXPIRED` | `effective_until` has passed with no superseding state |
| `REVOKED` | Explicitly invalidated by a later DENIAL or revocation record, distinct from ordinary supersession |
| `FUTURE_EFFECTIVE` | `effective_from` is in the future relative to the query time |

Historical (superseded/expired/revoked) states are never deleted — only
their temporal status changes. This mirrors the frozen-evidence discipline
already established for LNES-58's benchmark artifacts: history isn't
rewritten, it's marked.

## Model output types (distinct from claim types — this is what the
## *model* produces, not what a *source document* asserts)

| Type | Gate treatment |
|---|---|
| `ASSERTION` | Must be backed by a CONFIRMED_FACT or valid AUTHORIZATION in scope, or it's a violation |
| `HYPOTHESIS` | Permitted even against INCOMPLETE/UNKNOWN state, provided it's labeled as a hypothesis, not stated as fact |
| `RECOMMENDATION` | Permitted even against INCOMPLETE state or absent AUTHORIZATION — a recommendation is not itself a claim about current state |
| `PROPOSAL` | Like RECOMMENDATION, but specifically proposing a new state be created (e.g., "this should be approved") — never itself a committed state |
| `ACTION_REQUEST` | Requests a consequential action; must be checked against `authority_status`, not just `claim_type`, since even a true fact doesn't imply authorization to act on it |
| `SUMMARY` | Restates existing committed state; gate checks it doesn't silently upgrade claim_type in the restatement (e.g., summarizing a SOURCE_ASSERTION as if it were CONFIRMED_FACT) |

This is the schema referenced throughout the rest of the LNES-59
artifacts (`LNES59_AUTHORITY_MODEL.md`, `LNES59_DATASET_SPEC.md`, and the
state-consistency gate V2 design once built). Nothing here is wired to
any code yet — this is the schema the dataset and gate will be built
against, not a claim that either exists yet.
