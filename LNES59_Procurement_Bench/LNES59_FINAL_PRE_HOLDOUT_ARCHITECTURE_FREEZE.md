# LNES-59 — Final Pre-Holdout Development Autopsy & Architecture Freeze

**2026-08-08.** R&D / benchmark only. No production code touched.

This document is the terminal artifact for the development phase: it
declares the development case count complete at exactly 100, confirms the
architecture is frozen at V7 with zero further changes across the entire
63→100 scaling stretch, and records the development autopsy required
before any holdout work may begin. It supersedes nothing on disk —
`LNES59_PRE_HOLDOUT_CODE_MANIFEST_V7.json` and V1–V6 remain unmodified,
per the lineage-preservation discipline. This document layers a
dataset-completion declaration on top of that unchanged architecture.

## 1. Development case count: 100/100

Reached via Phase 5 tranches (packets A–U), most recently packets Q
through U (LNES59-B22-001 through LNES59-B26-007), taking the development
set from 63 → 100 cases without any interim checkpoint, per the standing
instruction. Holdout: 0/50 — not yet authored, not yet executed.

## 2. Architecture freeze status: V7, unchanged

`state_consistency_gate_v2.py` (v2.3) and `deterministic_extraction.py`
(v1.6) are byte-identical to the V7 freeze (git commit `651ce50`,
`LNES59_PRE_HOLDOUT_CODE_MANIFEST_V7.json`). **Zero architecture changes**
were made anywhere in the 63→100 scaling stretch — packets Q, R, S, T, U
all passed real-extraction verification and the full regression suite
against the V7 codebase as-is, on the first correctly-authored attempt in
every case (see §3 for the self-caught authoring mistakes that preceded
those correct attempts).

## 3. Development autopsy: issues found while scaling 63→100

Every issue encountered while authoring packets Q–U was evaluated against
the raised post-V5 architecture-change threshold (violation of a declared
invariant; reproducible failure across ≥2 independently authored cases
from the same mechanism; materially wrong deterministic state; the gate
permitting false authoritative commitment or systematically blocking
valid reasoning; or a benchmark-adapter failure revealing missing
structured information that can't remain an adapter concern). **None of
the issues below met that threshold.** All were self-caught during the
mandatory pre-write verification step (direct Python extraction + gate
evaluation, before any case JSON was written) and corrected before they
could ever reach the regression suite as a false failure:

- **B22-001** (packet Q): initial fixture used a bare `ASSERTION` against
  an EMAIL-sourced (`SOURCE_ASSERTION`) claim to test the MANAGER-tier
  exactly-at-limit boundary. Corrected to use the `ACTION_REQUEST`/
  `policy_tiers` mechanism (the same pattern as `LNES59-B4-003`), which is
  the correct way to test a real tier-limit comparison. Case-design
  choice, not an architecture defect.
- **B23-001/002/003/005** (packet R): initial "honest hedge" fixtures used
  `ModelOutput(ASSERTION, None, ...)`. A bare `ASSERTION` with
  `asserted_value=None` is *unconditionally* `INDETERMINATE` at the gate's
  structural-completeness check (by design — see
  `state_consistency_gate_v2.py` lines 254–255) and never reaches the
  INCOMPLETE/temporal `None`-carve-out branches added by taxonomy #15/#23;
  those carve-outs are reached via `SUMMARY`, per the existing
  `LNES59-B21-003`/`LNES59-B7-001` convention. Corrected by using `SUMMARY`
  for all four honest-hedge fixtures. A fixture-authoring mistake on my
  part (using the wrong `ModelOutputType` for the intended test), not a
  gate defect — the gate's actual behavior is exactly as documented and as
  every prior honest-hedge fixture already demonstrated.
- **B24-003** (packet S): initial ungoverned-scope fixture used the phrase
  "has no compliance standing in any system," which does not contain any
  of `_SCOPE_BROADENING_CUES`'s literal cue phrases ("anywhere", "at all",
  "in all systems", etc.). Reworded to "...anywhere" — a real, disclosed
  demonstration of the cue-list's narrows-false-positives-without-hiding-
  real-ones design working exactly as intended (see taxonomy discussion of
  `_claims_beyond_scope()`), not a gap requiring a code change.

No other issues arose across packets T and U (10 of the 15 packet-Q-
through-U cases required no correction at all — first verified attempt
matched the case as authored).

## 4. Real architecture fix count since V4 (bookkeeping correction)

Per the explicit correction required before this report: **three** real
architecture fixes have landed since V4: taxonomy **#21** (V4→V5),
**#23** (V5→V6), **#24** (V6→V7). Taxonomy **#22** was found in the same
investigative window as #21 but is explicitly disclosed-and-not-fixed
(`BENCHMARK_ADAPTER_LIMIT_REACHED`) — it is evidence for the future
`CandidateClaim` boundary, not a counted "fix." Zero further architecture
fixes occurred between V7 and this freeze (packets Q–U, 63→100).

## 5. Corpus integrity (verified this session, programmatically)

- **164** total documents across all committed document-set tranches.
- **100** total development cases, **0** holdout cases.
- Every case's `grounding_document_ids` resolves to a real corpus
  document — 0 missing references.
- Every case has both `predicate` and `category` populated — 0 gaps.
- Category distribution across the 100 development cases:

  | Count | Category |
  |---|---|
  | 19 | ordinary_factual |
  | 18 | policy_authority |
  | 12 | recommendation_vs_fact |
  | 12 | negative_state_control |
  | 11 | temporal_supersession |
  | 10 | conflicting_source |
  | 7 | ambiguous_source |
  | 3 | temporal_validity |
  | 2 | multi_hop_no_current_state |
  | 1 each | hypothesis_under_incompleteness, authority_wrong_business_unit, authority_wrong_vendor, supersession_revocation_reinstatement, multi_domain_authority, authority_wrong_purpose |

  19% of the dataset is deliberate, non-adversarial factual controls —
  the dataset is not purely a set of adversarial traps, per the standing
  instruction. The single-count categories are packet-Q-through-U "fresh
  instance" cases that intentionally reuse an already-established
  underlying primitive (e.g. `authority_wrong_vendor` reuses the same
  predicate-scoped-extraction mechanism as `authority_wrong_business_unit`
  and the base `policy_authority`/`negative_state_control` categories) —
  attacking combinations of existing primitives with fresh corpus content,
  per the explicit instruction to stop discovering new features.

## 6. Final regression suite (DETERMINISTIC REGRESSION SUITE — not benchmark or blind-holdout accuracy)

| Suite | Result |
|---|---|
| `test_state_consistency_gate_v2.py` | 28/28 |
| `test_gate_v2_batch2.py` | 19/19 |
| `test_values_match.py` | 17/17 |
| `test_scope_and_history.py` | 8/8 |
| `test_no_match_stress.py` | 5/5 |
| `test_open_world_claim_types.py` | 3/3 |
| `test_leakage.py` | 203/203 |
| `test_unavailability_detection.py` | 13/13 |
| `validate_extraction_against_cases.py` | 100/100 |
| `run_case.py` (real extraction → gate, end-to-end) | 187/187 |
| **Total** | **583/583, all green** |

This is a deterministic regression result against hand-authored expected
outcomes and real (non-mocked) extraction — it is explicitly NOT a
measurement of benchmark accuracy or blind holdout performance, which
require B0–B4/X0–X2 model execution not yet authorized.

## 7. Declaration

**This is the final pre-holdout architecture freeze for LNES-59.**

- Architecture: **V7** (git commit `651ce50`, `state_consistency_gate_v2.py`
  v2.3, `deterministic_extraction.py` v1.6) — unchanged, no V8 needed.
- Development dataset: **complete at exactly 100 cases** (`LNES59-B1-*`
  through `LNES59-B26-*` inclusive, per `LNES59_DATASET_MANIFEST.json`).
- Holdout: **0/50** — not authored, not executed, ground truth not yet
  written.

Per the standing holdout-blindness discipline, no holdout case may be
authored or run through the gate until this freeze is in effect. This
document is that freeze declaration, committed alongside the 100th
development case.

## 8. Known remaining, disclosed limitations at freeze (carried over unchanged from V7)

- Taxonomy #17/#22: sparse/subset-word-collision risk in
  `values_match()`'s compound-word fallback —
  `BENCHMARK_ADAPTER_LIMIT_REACHED`, disclosed, deliberately not
  patched further. No new instance surfaced during packets Q–U.
- `CandidateClaim` architecture remains design-only.
- `PREDICATE_ALIAS` category remains unused in the corpus.
- "Required approval classes" (dual sign-off) confirmed NOT a real
  architecture gap — fully expressible via existing predicate-scoping
  (`LNES59-B8-001`).
- No B0–B4 baseline or full X0–X1 sweep has been run — X2 remains the
  only arm with real empirical data.
