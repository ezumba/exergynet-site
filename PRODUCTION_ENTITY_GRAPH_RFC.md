# Production Entity Graph — RFC

**Status: analysis/design only. No deployment. No implementation authorized
by this document.**

## Why this exists

The LNES-58.5–58.9 Deterministic Entity Graph (see
`xLMP_v2_ARCHITECTURE_PROPOSAL.md` §4) was validated on a synthetic
benchmark class — patient-record trios with a known, hand-authored
relation shape. Direct reconnaissance of the real Portal production call
chain (`xlmp_zk_query` → `xlmp_get_content` → `resolveIntent` →
`synthesizeFromDocument` → `vanguardRace`) confirmed a real, persistent
content store exists, but **no production entity/relation data model
exists to attach that benchmark architecture to.** Building one is not a
"port the benchmark code" task — it requires deciding things the benchmark
never had to decide, because the benchmark's documents, entities, and
relations were all authored in advance by the person writing the test.
Production documents are not authored in advance. This RFC exists to name
the unanswered questions before any of them get answered by default,
silently, inside implementation code.

## Critical principle

**A probabilistic model MAY propose an entity or relation. A probabilistic
model MUST NOT silently convert that proposal into authoritative
persistent state.**

This is the one hard constraint this RFC is not negotiable on. Everything
else below is genuinely open. The reason this one isn't: LNES-58.7–58.9
spent real effort establishing that a model asserting something with
confidence is not evidence that the thing is true (the whole point of
`NegativeResolutionReceipt` / `MemoryIntegrityViolation` / the X6B gate is
"verification means retrieved-matches-requested, not true, authorized, or
provenance-verified" — the same discipline has to hold for graph writes,
not just graph reads).

## Candidate pipeline (illustrative, not a final design)

```
raw document
    → deterministic normalization
    → candidate extraction
    → validation
    → provenance binding
    → authoritative graph commit
```

Two things this shape is trying to keep separate, deliberately:

- **candidate extraction** — where a model (or a deterministic parser) is
  allowed to *propose* structure — is architecturally distinct from
  **authoritative graph commit** — where something becomes true-for-query-
  purposes. The benchmark's `freeze_entity_graph.py` pattern (graph frozen,
  SHA-256'd, *before* any query text is read) is one real precedent for
  keeping "what the graph knows" separate from "what's currently being
  asked" — the production version needs an equivalent separation between
  "what was proposed" and "what was committed."
- **provenance binding** happens before commit, not after — so a graph
  entry is never authoritative without a traceable source, the same
  discipline `NegativeResolutionReceipt` applied to negative results.

This is a candidate shape to react to, not a decision. Everything below is
open.

## Open decision space

**What constitutes an entity?** The benchmark's entities were whatever the
hand-authored document trio's regex parser (`build_reference_graph`)
recognized (`"- A + B: C"` patterns). Production documents have no such
guaranteed structure. Does "entity" mean a normalized string, a
canonicalized identifier resolved against some existing registry, or
something else? Unanswered.

**What constitutes a relation?** Same problem, one level up — a relation
needs two resolved entities and a typed edge. Where does the type
vocabulary come from, and who's allowed to add to it?

**Deterministic vs. probabilistic extraction.** The benchmark used a
deterministic regex specifically so ingestion could stay query-independent
and provenance-clean. Production documents are unstructured prose most of
the time — a purely deterministic parser will miss most real content. A
model-assisted extractor will catch more but reintroduces exactly the
uncertainty the Critical Principle above is trying to fence off. Not
resolved: how much of the pipeline is allowed to be probabilistic before
the fencing stops meaning anything.

**Ontology ownership.** Who decides what relation types exist — a fixed
schema shipped with the system, a per-tenant configurable schema, or
something extractors can propose additions to (and if so, through what
gate)?

**Schema versioning.** If the ontology changes, what happens to graph
entries committed under the old schema? Silent reinterpretation under the
new schema is a correctness risk; a hard migration is an operational cost.
Not resolved.

**Provenance.** What, minimally, must be recorded for a graph entry to be
traceable back to its source document/span? The benchmark had this for
free (everything traced to one of three known documents). Production needs
an actual answer — likely at minimum: source root, byte/character span,
extraction method, extraction timestamp, extractor version.

**Confidence.** Does a graph entry carry a confidence score at all, and if
so, does anything downstream (retrieval ranking, the contradiction-gate
pattern from X6B) actually consume it, or is it decorative? An unused
confidence field is worse than no field — it invites the appearance of
rigor without the substance.

**Human/policy validation.** Is any tier of extracted relation reviewed by
a human or a policy layer before being committed as authoritative, or is
everything auto-committed subject only to automated gates? If there's a
review tier, what triggers routing into it — extraction confidence below a
threshold, relation type sensitivity, something else?

**Relation supersession.** Documents get corrected, retracted, updated.
When a new extraction contradicts an existing committed relation, what
happens — does the new one win, does it require explicit resolution, does
the old one get marked superseded-but-retained (closer to how the frozen
LNES-58 benchmark evidence itself is never rewritten, only added to)?

**Contradiction handling.** Related to supersession but distinct: what
happens when two *live*, both-currently-authoritative relations
contradict each other, not because one supersedes the other in time but
because two source documents genuinely disagree? The X6B gate pattern
(deterministic comparison, no LLM, no ground-truth inspection) is a
plausible building block for *detecting* this at query time — it says
nothing about what the graph should do about it at write time.

**Domain-specific schemas.** ExergyNet's actual document domains (patient
records, contracts, whatever else xLMP ingests) likely need different
relation vocabularies. Is there one graph with a domain-tagged schema, or
genuinely separate graphs per domain? Not resolved.

**Arbitrary-document ingestion.** The benchmark's ingestion path is a
purpose-built parser for one synthetic document shape. Production
`xlmp_shatter_payload` accepts arbitrary byte payloads with no assumed
structure. What's the actual extraction entry point for an arbitrary,
previously-unseen document type — and what happens when nothing in it is
recognized as an entity or relation at all (does that fail loudly, or
silently produce an empty graph contribution)?

**Whether model-assisted extraction may propose relations.** Given the
Critical Principle above, the answer to "may a model propose" is yes by
construction — proposal is not commitment. The open question is what the
proposal *looks like* structurally (same shape as a committed relation, or
a visibly distinct "candidate" type that can't be queried as if it were
authoritative until it clears validation).

**How proposed relations become authoritative.** The actual gate. Options
on the table, none chosen: automatic promotion after N independent
extractions agree; automatic promotion above a confidence threshold;
mandatory human review; a deterministic structural check (e.g., does the
proposed relation type exist in the ontology, does provenance resolve to a
real stored root) as a necessary-but-not-sufficient gate before any of the
above. Precedent worth reusing: the X6B gate is *pure* (no LLM, no
external state) — whatever the production gate ends up being, keeping it
inspectable and deterministic where possible is a lesson worth carrying
forward from that result, not a foregone conclusion for graph writes
specifically.

**Query-independent graph construction.** The one place this RFC has real
precedent to lean on directly: `freeze_entity_graph.py`'s discipline of
never letting query or answer text influence what gets ingested is
architecturally necessary in production too, for the same reason it
mattered in the benchmark (X3's failure mode — oracle leakage — was
exactly a violation of this). Whatever production ingestion pipeline gets
built, it must not have access to live query traffic while deciding what
counts as a graph entity or relation.

**Root-addressing.** Should graph entries be content-addressed the same
way xLMP objects are (a root derived from the entry's own content), giving
graph state the same tamper-evidence property LNES-58.10 just added to
content retrieval? Not decided, but the asymmetry — content is now
verified on read, the entity graph that might reference that content is
not addressed at all yet — is worth naming explicitly rather than leaving
implicit.

**Graph migration/versioning.** If the graph structure itself changes
(new entity/relation shape, new ontology version), what's the migration
path for already-committed entries? Connects back to Schema versioning
above but is a distinct operational question: not just "what does an old
entry mean under a new schema" but "how does the migration actually run
without a destructive rewrite of committed state."

## What this RFC does not do

It does not choose an answer to any of the above. It does not authorize
building the Production Entity Graph. It does not claim the benchmark
architecture (X4/X5/X6B) is portable to production as-is — several of its
simplifying assumptions (three known documents, hand-authored relations,
no live document stream) are exactly what make the open questions above
open. The benchmark proved a set of *patterns* work on a constrained
class of query (query-independent freezing, explicit negative state,
deterministic post-hoc contradiction gating) — this RFC is where those
patterns get tested against the harder, unconstrained production problem,
not where that test gets skipped.
