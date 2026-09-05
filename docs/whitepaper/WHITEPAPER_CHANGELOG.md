# WHITEPAPER CHANGELOG (VNext-Final, Phase-3 Publication Pass)

Append-only. Ground source of truth for what changed in `EXERGYNET_WHITEPAPER_VNEXT.md` relative to
`docs/whitepaper_vnext_recon/EXERGYNET_VNEXT_DRAFT_v2.md`, why, and on what evidence. Prior-phase history
(D1→D2 restructure, evidence closure, red-team passes) is recorded in
`docs/whitepaper_vnext_recon/WHITEPAPER_REBASE_DECISION_LOG.md` D-01–D-65 and is not repeated here.

---

## 2026-08-27 — Phase-3 publication pass

| Timestamp | File | Section changed | Reason | Evidence source | Claim-strength change |
|---|---|---|---|---|---|
| 2026-08-27 | `EXERGYNET_WHITEPAPER_VNEXT.md` | New §1.1 "The industry signal: from model scaling to infrastructure scaling" | Publication-closure directive §2 requires a current-industry-context section; D-05/D-64/D-65's pre-earnings exclusion superseded per D-66–D-68 (post-earnings, bounded, non-commercial) | `[NVIDIA-Q2FY27]`, `[NVIDIA-Q2FY27-CALL]` — independently web-verified, see `WHITEPAPER_SOURCE_REGISTRY.md` §B | N/A — new external citation, not an ExergyNet claim; explicitly disclaimed as non-validating |
| 2026-08-27 | `EXERGYNET_WHITEPAPER_VNEXT.md` | §2.5 extended (new paragraphs after the existing "Persistent Memory → ... → Machine Economy" progression) | Directive §3/§4/§6 (memory-supply signal, Hot Chips/Micron context, NVIDIA "compute is revenue" bridge to RHO/Omega/MMS); replaces the D2 sentence "(the market evidence... is kept in the separate strategy record, not asserted here as ExergyNet evidence)" | `[NVIDIA-Q2FY27-CFO]`, `[NVIDIA-LPS]`, `[MICRON-HC2026]` — independently web-verified | N/A — external citation; RHO/Omega/MMS connection reuses already-evidenced WP-C011/C012, no strength change to those claims |
| 2026-08-27 | `EXERGYNET_WHITEPAPER_VNEXT.md` | New §3.4 "When software becomes structural" | Directive §8 — requested as one of the paper's strongest conceptual sections, with the formal `∀t ∈ ActiveConsequenceState` expression | Derived from A3 (§2.1, pre-existing) and the existing Part IV/V/VI component descriptions (Temporal Authority, xISA, LNES-22, AERIS) — no new empirical claim | N/A — framing/motivation only; explicitly defers current-state status to Part V/VI, no boundary altered |
| 2026-08-27 | `EXERGYNET_WHITEPAPER_VNEXT.md` | New §5.9, restructured Part VIII (Tensile-Lift now leads, ahead of MyMonitor) | Directive §11 — "Do not lead with MyMonitor... Tensile Lift is the best first consequence-active example"; promotes an existing, already-vetted but unintegrated result | `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md:1664–1689` (frozen v1.9 baseline — verbatim benchmark table, arithmetic spot-checked) | **New claim WP-C024, T2.** Not a strengthening of any prior claim — this result was entirely absent from D2; its addition is bounded immediately by the `SIMULATED_WITNESS`/synthetic-holdout caveat in the same sentence |
| 2026-08-27 | `EXERGYNET_WHITEPAPER_VNEXT.md` | Part VIII — removed standalone "Regulatory fact" paragraph, folded into the new Tensile-Lift paragraph; reordered "Other domains" list | Avoids duplicating the FAA/KTX regulatory-fact statement now that it is contextually attached to the Tensile-Lift discussion it actually describes; directive §11's suggested vertical order (robotics, scientific agents, industrial automation, enterprise, financial, secure comms) applied to the existing bounded sentence | WP-C021 (unchanged); no new fact | EQUIVALENT — same fact, relocated for clarity, no wording change to the prohibition language |
| 2026-08-27 | `EXERGYNET_WHITEPAPER_VNEXT.md` | Part IX — one clause added naming "the infrastructure pressure hypothesis" explicitly | Directive §13 requests this be presented as a named architecture hypothesis; substance was already present in §2.4/A4 (O(N²) framing) but not labeled | §2.4 (unchanged) | EQUIVALENT — labeling only, no new claim |
| 2026-08-27 | `EXERGYNET_WHITEPAPER_VNEXT.md` | Part X — vehicles/roads framing and the more-technical closing sentence added before the existing conclusion paragraph | Directive §19's exact target text ("The AI industry is building the vehicles...", "ExergyNet's objective is a common machine infrastructure...") | Directive text used near-verbatim as instructed ("improve this, but preserve the architecture" — §18 applies the same instruction to the abstract, extended here to the conclusion since §19 supplies exact target sentences) | N/A — thesis-level framing, no factual claim |
| 2026-08-27 | `docs/whitepaper/WHITEPAPER_CLAIM_LEDGER.md` | New file (finalizes recon `CLAIM_LEDGER.md`) | Directive §20 deliverable 3 | Carries WP-C001–C023 forward unchanged; adds WP-C024 and WP-X05 (NVIDIA/Micron discipline) | New: WP-C024 (T2), WP-X05 (new prohibition) |
| 2026-08-27 | `docs/whitepaper/WHITEPAPER_POSTURE_AUDIT.md` | New file (finalizes recon `WHITEPAPER_POSTURE_AUDIT.md`) | Directive §20 deliverable 4 | Self-audits P-10–P-14 against the achievement-first rule | 4 STRENGTHENED_TO_EVIDENCE, 1 EQUIVALENT, 0 WEAKENED |
| 2026-08-27 | `docs/whitepaper/WHITEPAPER_SOURCE_REGISTRY.md` | New file | Directive §20 deliverable 5; directive §21 source-priority rule | — | — |
| 2026-08-27 | `docs/whitepaper_vnext_recon/WHITEPAPER_REBASE_DECISION_LOG.md` | D-66–D-69 appended | Records the NVIDIA-content supersession reasoning and Phase-3 authorization, append-only per project convention | This changelog; `NVIDIA_RELEVANCE_NOT_FOR_WHITEPAPER.md` | — |

## Final quality pass (directive §22/§23), run against `EXERGYNET_WHITEPAPER_VNEXT.md`

Grep results for the directive's banned-term list:

```
necessarily requires   0
proves universal       0
guarantees              0   (as an unbounded claim; the word "guarantee" appears only negated: 
                              "not a physical-truth guarantee", "does not... guarantee")
sovereign               0
stablecoin              0   (RHO section explicitly negates this — 0 assertions, as required)
USD redeemable          0
market price            1   (used only in negation: "independently of market price" — correct per D-62)
hardware independent    0
cross-model validated   0
cross-node validated    0
thermodynamic            0
60,000x                 0
11.3x (unbounded)        0   ("~11.3×" appears only with its envelope stated in the same sentence, WP-C003a)
NVIDIA                  13   (all reviewed manually — see WHITEPAPER_POSTURE_AUDIT.md verification section; 
                              all bounded/cited/non-validating)
Micron                   3   (all reviewed manually — same verification)
MyMonitor                 —   (present as an illustrative case study, second per directive §11; matches 
                              existing D2 disposition, unchanged)
Tensile                   —   (present as the new primary case study; see WP-C024)
TODO / TBD / VERIFY      0
placeholder / draft note / agent note   0
```

**"PENDING" retained (8 occurrences) — deliberate, not an oversight.** Each instance marks a specific,
claim-ledger-tracked, honestly-disclosed evidence boundary (EVD-002 re-hash, TransitionWitness defining
artifact, OTET-gated dataset hash, patent formal-receipt status) rather than an unresolved draft
placeholder. Removing them would violate directive §14's own instruction not to hide material boundaries,
and D-62's permanent editorial principle. See `WHITEPAPER_REBASE_DECISION_LOG.md` D-69 for the explicit
reasoning.

**Overclaim grep (D-61/D-65 pattern):** universal portability, exabyte, production market active,
mainnet-settlement-live, proven-at-scale, "state is portable" — **0** matches.

**Placeholders remaining: 0.**

---

## 2026-08-27 (later) — Public presentation redesign

Operator review of the rendered PDF (not just extracted text) found the previous pass's own
`EXERGYNET_WHITEPAPER_VNEXT.md`/`.pdf` unfit for external distribution: internal process material
(`Phase-3`, `D-66–D-69`, local file paths, `WP-C###` IDs, `pending re-hash`, `UNVERIFIED_OTET_GATED`)
was visible directly on the page, the document was continuous text with almost no visualization of its
own quantitative results, and pagination had at least one accidental near-empty page.

| Timestamp | File | Change | Reason | Evidence source |
|---|---|---|---|---|
| 2026-08-27 | `EXERGYNET_WHITEPAPER_PUBLIC.md` (new) | Full public-facing rewrite of `EXERGYNET_WHITEPAPER_VNEXT.md`: 9-section structure, achievement-first prose, zero internal process/filename/ID references, all measured results restated with identical values/tiers/envelopes | Public-presentation redesign; internal governance material must not appear in the external document | Content sourced from `EXERGYNET_WHITEPAPER_VNEXT.md` and `WHITEPAPER_CLAIM_LEDGER.md` — no new claims |
| 2026-08-27 | `docs/whitepaper/figures/fig01–fig12*.png` (new, 13 files) | 12 original figures built (thesis diagram, three-plane architecture, N² vs. substrate, xLMP context-scaling, memory dashboard, state-governance bars, authority pipeline, aviation-gate bars, NVIDIA/Micron industry charts, state-mobility pipeline, Omega lifecycle, Tensile-Lift flow) | Directive requirement: every major measured result gets a chart/diagram, not buried in prose | Built from the same WP-C### values as the text; verified by direct visual inspection, not assumed correct after generation |
| 2026-08-27 | `fig04_context_scaling.png` | Corrected a real data-scaling bug found during visual QA: the full-context line had been divided by 1,000 twice, making it appear (incorrectly) that xLMP used *more* tokens than full-context — the opposite of the actual finding | Visual QA caught this before publication; not caught by the earlier text-only verification pass | Recomputed directly from WP-C001's corpus/token pairs |
| 2026-08-27 | `fig06_state_governance.png` | Removed a baked-in `(LNES-59)` internal test-campaign label from the chart title (the prose already correctly omitted it — the image was the one place it leaked) | Internal identifier leak found during visual QA | — |
| 2026-08-27 | `EXERGYNET_WHITEPAPER_PUBLIC.pdf`, `.docx` (new) | Built with page numbers, running footer, embedded figures, proper bullet/numbered-list rendering (an earlier PDF build silently flattened both into run-on paragraphs — found and fixed during visual QA), and natural page flow instead of a forced page-break before every section (which had produced five-plus pages that were 50–70% blank) | Directive requirement: professional visual system, no orphan/near-empty pages | Every one of the 14 final PDF pages was rendered to an image and individually inspected before this pass was called complete |

**On the claim that Section 5.7 / WP-C014's medium/long fresh-process result is superseded by newer "A5.3"
evidence:** searched the full repository for an A5.3 LNES-119 evidence artifact. Found only two
unrelated hits — this session's own prior decision-log entry (which had itself copied the "A5.3" label
from directive text without independently verifying an artifact existed) and an unrelated production-patch
blocker in `PROJECT_BLOCKERS.md` about a different system. **No LNES-119 A5.3 evidence artifact was
located.** WP-C014's value (fresh-process MEDIUM 0/10, LONG 0/10) is therefore **carried forward
unchanged** in the public document — not because the claim of newer evidence is necessarily false, but
because it could not be independently verified, and this project's standing rule is that no claim-ledger
value changes without a locatable source artifact. If genuine A5.3 evidence exists in a location this
session could not reach, it should be supplied directly so WP-C014 can be re-audited on its merits.

**Public-document internal-leakage grep (final, post-fix):** `WHITEPAPER_`, `SEI_`, `D-6\d`, `WP-C\d`,
`Phase-`, `VNext`, `.md`, `UNVERIFIED_OTET`, `LNES-59` — **0** occurrences in the extracted PDF and DOCX
text. `LNES-22` retained (1 body occurrence, 3 figure-label occurrences) as a public component identifier,
consistent with the existing exergynet.org site's own public use of `LNES-03`/`LNES-04` status labels.

**Visual QA record:** all 14 PDF pages rendered via PyMuPDF and inspected individually (not assumed
correct from a successful build). Issues found and fixed before this changelog entry was written:
one data-scaling bug (fig04), one baked-in internal label (fig06), two markdown-list rendering failures
(bullets and numbered references), and five-plus pages of forced-pagebreak-induced blank space. Final
pass: 0 remaining near-empty pages, 0 clipped/overlapping elements, 0 internal-file references, 0 raw
internal status variables, 0 placeholders.

---

## 2026-08-27 (later still) — VP Sales Directive 002: commercial rebase to V2

**Scope:** Reorder and reframe `EXERGYNET_WHITEPAPER_PUBLIC.md`/`.pdf` for commercial sequencing per
`WHITEPAPER_VP_SALES_REBASE_2026-08-27.md`. **Not a re-verification pass** — `WHITEPAPER_CLAIM_LEDGER.md`,
`WHITEPAPER_SOURCE_REGISTRY.md`, and this changelog's own prior entries are treated as authoritative and
unaltered; this entry only appends. V1 (`EXERGYNET_WHITEPAPER_PUBLIC.md`/`.pdf`) is preserved unmodified
alongside the new V2 files, per the governing directive's explicit "do not replace or delete V1 yet."

| Timestamp | File | Change | Reason | Evidence source |
|---|---|---|---|---|
| 2026-08-27 | `EXERGYNET_WHITEPAPER_PUBLIC_V2.md` (new) | Full manuscript reorder: title/subtitle changed (Candidate A of 5 — "Infrastructure for Useful Machine Work"); Abstract rebuilt to 5-paragraph economic-first order; headline-results table reordered (efficiency &rarr; state-governance &rarr; authority &rarr; physical-consequence); 4 new sections added (Useful-Work measurement layer, Context/Memory/Authoritative-State box, Model-Substitution Principle, Administrative Boundaries and Interoperability) and 1 new front-matter box ("What ExergyNet Does Not Require"); Authority section moved from position 4 to position 8; State Mobility relocated adjacent to Persistent State; a Proposed Comparative Evaluation Program (B&#8320;&ndash;B&#8325;) subsection added to the Research Frontier section; commercial CTA added to the Conclusion | VP Sales Directive 002 &sect;&sect;1, 4&ndash;23 | No new empirical claim introduced &mdash; every WP-C### value, tier, and envelope from `WHITEPAPER_CLAIM_LEDGER.md` carried forward unchanged; see `WHITEPAPER_V2_CLAIM_CROSSWALK.md` |
| 2026-08-27 | `docs/whitepaper/figures/fig01alt_candidateA_customer_state.png` (new) | New Figure 1: models connect through ExergyNet protocol components to customer-owned state, inside a customer-controlled boundary | Directive &sect;10 &mdash; original Figure 1 topology (Model &rarr; [ExergyNet] &rarr; World) read as an unavoidable central chokepoint | Diagram only; no empirical claim |
| 2026-08-27 | `docs/whitepaper/figures/fig01alt_candidateB_sovereignty_bridge.png` (new) | New Figure 3B: two organizations retain their own internal systems; ExergyNet coordinates only the boundary interaction | Directive &sect;10, used in the new Administrative Boundaries section (&sect;7 of V2) | Diagram only; no empirical claim |
| 2026-08-27 | `WHITEPAPER_VP_SALES_REBASE_2026-08-27.md` (new, repo root) | Diagnosis, 5 title/subtitle candidates, full section-hierarchy KEEP/MOVE/REFRAME/ADD table, diagram recommendations, benchmark recommendations, exact claims requiring no change, commercial CTA, unresolved questions | Directive &sect;25 deliverable 1 | &mdash; |
| 2026-08-27 | `WHITEPAPER_POSTURE_AUDIT.md` | New items appended (this pass) auditing V2 for claim strengthening/weakening, sales language exceeding evidence, authority centralization, unsupported portability/hardware independence, self-referential sovereignty | Directive &sect;25 deliverable 5 | See posture audit's new section below |
| 2026-08-27 | `WHITEPAPER_V2_CLAIM_CROSSWALK.md` (new) | Maps every WP-C### claim ledger entry to its V2 section number | Directive &sect;25 deliverable 6 | &mdash; |
| 2026-08-27 | `EXERGYNET_WHITEPAPER_PUBLIC_V2.pdf` (new) | Built via a dedicated reportlab script (no reused build tooling was found in the repo from the prior PUBLIC.pdf pass); 21 pages | Directive &sect;25 deliverable 3 | &mdash; |

**Sovereignty grep (directive &sect;9), run against V1 before starting this pass:** `sovereign` &mdash; **0**
occurrences in `EXERGYNET_WHITEPAPER_PUBLIC.md` and in `EXERGYNET_WHITEPAPER_VNEXT.md`. This item required
no corrective action; confirmed clean rather than assumed clean, and re-confirmed zero occurrences in the
final V2 PDF text extraction below.

**Final overclaim/leakage grep (directive &sect;26), run against extracted V2 PDF text (all 21 pages):**
```
sovereign               0
WHITEPAPER_ / WP-C\d / Phase-\d / VNext / D-6\d / UNVERIFIED_OTET / SEI- / LNES-59   0  (no internal IDs leaked)
necessarily requires    0
proves universal        0
hardware independent    0
cross-model validated   0
cross-node validated    0
thermodynamic           0
60,000x                 0
stablecoin              0
Groth16 / ZK-STARK      0  (V2 does not discuss on-chain proof mechanics; out of scope for a reordering pass)
market price            3  (all three in negation — "not by market price," "independently of any market
                            price" — matches the V1 posture audit's own precedent exactly)
TODO / TBD / placeholder / draft note / agent note   0
```

**Visual QA record (this pass):** all 21 PDF pages rendered via PyMuPDF and inspected individually.
One defect found and fixed before this changelog entry was written: an orphan heading ("What ExergyNet
Does Not Require") separated from its own boxed content across a page break on the first build attempt
&mdash; fixed by explicitly grouping the heading with its box in a single non-splitting block. Final pass:
0 remaining orphan headings, 0 near-empty pages, 0 clipped/overlapping elements, 0 flattened lists (bullets
and the B&#8320;&ndash;B&#8325; list render correctly), 0 table overflow, 0 internal file references, 0
internal codenames, 0 placeholders.

**Page count:** V1 = 14 pages. V2 = 21 pages (+7, from 4 new sections, 1 new front-matter box, and one
relocated section's expanded framing table — not from padding; each new page carries either a new
architectural-framework section explicitly required by the directive or a diagram).

**Not done in this pass, per directive &sect;27:** `EXERGYNET_WHITEPAPER_PUBLIC.pdf` (V1) was not replaced
or deleted. `whitepaper.html` (the separate Living White Paper artifact governed by
`LWP_MAINTENANCE_POLICY.md`) was not touched — that artifact has its own, different publication gate and
is out of scope for this directive. Nothing was deployed or pushed.

---

## 2026-08-27 (final) — VP Sales operator approval: V2 title/subtitle frozen

**Decision:** VP Sales reviewed `WHITEPAPER_VP_SALES_REBASE_2026-08-27.md` and approved the Directive-002
rebase in full ("the rebase did the correct thing: it changed sequencing without changing evidence"),
with one amendment before freezing V2.

| Timestamp | File | Change | Reason | Evidence source |
|---|---|---|---|---|
| 2026-08-27 | `EXERGYNET_WHITEPAPER_PUBLIC_V2.md` (cover only) | Sub-subtitle changed from "Model-independent persistent state and accountable authority for autonomous systems that must remember, prove, and act across models and machines" to "Model-independent state and measured efficiency for AI systems that must persist across models, sessions, and organizations" | VP Sales: the original wording put "accountable authority" on the cover, partially reintroducing the Layer-4-too-early problem Directive 002 exists to fix. Title itself ("Infrastructure for Useful Machine Work," Candidate A) was approved unchanged. | Operator decision, recorded verbatim in `WHITEPAPER_VP_SALES_REBASE_2026-08-27.md`'s new addendum |
| 2026-08-27 | `EXERGYNET_WHITEPAPER_PUBLIC_V2.pdf` | Rebuilt with the new cover subtitle; cover meta line changed from "Version 2.0 — VP Sales Commercial Rebase" to "Version 2.0 — Frozen, VP Sales Approved" | Same as above | &mdash; |

**Scope of this change:** cover only. No section, figure, table, or claim in the manuscript body was
touched. Re-ran the full visual QA pass on the rebuilt PDF (21 pages, unchanged page count) and the
overclaim/leakage grep against the newly extracted PDF text &mdash; both **unchanged from the prior
pass's clean result** (0 leakage terms, "sovereign" 0 occurrences, "market price" 3 occurrences, all in
negation).

**Status: V2 is now FROZEN pending Directive 003 (P0 Trust Integrity Remediation + Repository
Reconciliation) and Directive 004 (Commercial Website Rebuild).** No further edits to
`EXERGYNET_WHITEPAPER_PUBLIC_V2.md`/`.pdf` should be made outside a new numbered directive or an explicit
operator instruction, per the same discipline `LWP_MAINTENANCE_POLICY.md` applies to the separate Living
White Paper artifact.

**Whitepaper ground truth committed to git this pass** (VP Sales-directed, sequencing step 2 of 4): see
`git log` for the commit covering `docs/whitepaper/**` and `WHITEPAPER_VP_SALES_REBASE_2026-08-27.md`.
**Explicitly excluded from that commit:** `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` and
`docs/whitepaper/CLAIM_LEDGER.md` — both show large pre-existing uncommitted modifications (921 and 4
changed lines respectively) that predate this session's work and were not authored or reviewed as part
of the VP Sales whitepaper pipeline. Committing them alongside this pass's output would have attributed
unreviewed, unrelated prior-session changes to this commit. They remain uncommitted and are flagged to
the operator as a separate, pre-existing decision pending its own review — not lost, not part of this
pass's scope.

---

## 2026-08-28 — V3 evidence rebase: execution-state mobility, Portable Intelligence Packaging

**Why V2 §5 was superseded, and why the prior pass was not wrong.** V2's Section 5 correctly reported,
as of 2026-08-27, that fresh-process execution-state restoration was validated for short contexts (10/10)
and not yet achieved for medium or long contexts (0/10 each), with cross-node portability not yet
reported. **That prior publication pass was the right call at the time it was made** — the corrected
evidence this pass relies on (the LNES-119A5.2 checkpoint-contamination audit, the F1–F6D cross-host
causal-isolation campaign) did not exist yet when V2 was frozen, and no earlier source artifact was being
overlooked. This pass does not treat the earlier 0/10 report as an error; it treats it as an accurate
report of the state of the evidence on 2026-08-27, now superseded because new, independently-verifiable
evidence became available on 2026-08-28. `WHITEPAPER_CLAIM_LEDGER_V3.md` marks WP-C014/WP-C015 SUPERSEDED
rather than deleting or silently rewriting them, for exactly this reason.

| Timestamp | File | Section changed | Reason | Evidence source | Claim-strength change |
|---|---|---|---|---|---|
| 2026-08-28 | `EXERGYNET_WHITEPAPER_PUBLIC_V3.md` (new) | Full manuscript; substantively rewritten: Abstract, Executive Summary, §5 (State Mobility → Execution-State Mobility, full rewrite), §6 (Model-Substitution, updated), new §7 (Portable Intelligence Packaging), §13 maturity table and research frontier, title/subtitle. §1–§4, §8–§12 (old §7–§11) carried forward from V2 unchanged except renumbering and cross-references. | This directive's evidence-rebase mandate; the underlying LNES-119B experimental program (Entries 001–024) completed its causal-isolation campaign (F1 through F6D) between 2026-08-26 and 2026-08-28, after V2 was frozen | `LNES119B_EVIDENCE_LEDGER.md` (append-only, SHA-256-hashed per artifact, protocol-manifest version-controlled, adversarial-mutation-tested harness) — independently read and spot-verified entry-by-entry before any claim was copied into the manuscript, not taken from directive text | New claims WP-C025–WP-C032 (all T1, bounded); WP-C014/WP-C015 superseded (not deleted, not silently edited) |
| 2026-08-28 | `EXERGYNET_WHITEPAPER_PUBLIC_V3.md` | §12 Applications, new MCP paragraph | This paper had never mentioned ExergyNet's MCP interface; a security incident affecting an earlier version of the published package is a matter of public record, and the interface itself is now a real, currently-safe, independently-auditable artifact worth naming accurately rather than continuing to omit | Independently verified against live npm/registry state at time of writing (not copied from any directive's assumed version number — a factual discrepancy was found and corrected: the currently published version is 0.2.5, not 0.2.6, which exists only as unpublished source) | New — no prior WP-C### entry covered this; see `WHITEPAPER_CLAIM_LEDGER_V3.md`'s operational note |
| 2026-08-28 | `docs/whitepaper/WHITEPAPER_CLAIM_LEDGER_V3.md` (new) | New file (finalizes `WHITEPAPER_CLAIM_LEDGER.md`) | This directive's deliverable | Carries WP-C001–C013, WP-C016–C024 forward unchanged; marks WP-C014/C015 superseded with pointers; adds WP-C025–C032; adds WP-X06 (cross-architecture prohibition) and WP-X07 (vulnerability-free prohibition) | New: WP-C025–C032 (8 new, all T1 bounded); 2 superseded |
| 2026-08-28 | `docs/whitepaper/WHITEPAPER_V3_CLAIM_CROSSWALK.md` (new) | New file (finalizes `WHITEPAPER_V2_CLAIM_CROSSWALK.md`) | This directive's deliverable | Maps every WP-C### ID to its V3 section; confirms WP-C014/C015 appear nowhere as a current-state conclusion in the V3 body | — |
| 2026-08-28 | `docs/whitepaper/WHITEPAPER_POSTURE_AUDIT_V3.md` (new) | New file (finalizes `WHITEPAPER_POSTURE_AUDIT.md`) | This directive's deliverable | Self-audits P-15–P-22 against the achievement-first rule; runs the full nine-category prohibited-pattern search against the actual V3 manuscript text | 5 STRENGTHENED_TO_EVIDENCE, 3 EQUIVALENT, 0 WEAKENED; 0 unbounded occurrences across all 9 required prohibited-pattern categories |

## PDF/DOCX generation and rendered visual QA — BLOCKED, not attempted

No PDF/DOCX build tooling (pandoc, a LaTeX toolchain, or an equivalent) was found available in this
session's environment, and no build script for the existing `EXERGYNET_WHITEPAPER_PUBLIC_V2.pdf`/`.docx`
artifacts was located to reuse. Per this directive's own instruction ("pause only the affected stream if
a source cannot be resolved"), PDF and DOCX generation for V3 were not attempted rather than faked or
produced with a different, unreviewed tool. `EXERGYNET_WHITEPAPER_PUBLIC_V3.md` is the complete,
publication-ready manuscript; rendering it to PDF/DOCX and the page-by-page rendered visual QA that
depends on having that PDF are both flagged as pending an operator-available build environment, not
claimed as done.

---

## 2026-08-28 (later) — PDF/DOCX build tooling installed; visual QA completed for real

At the operator's explicit request, build tooling was installed rather than left blocked: pandoc 3.10.2
(via winget) and MiKTeX 25.12 (via winget, configured for unattended package auto-install).
`EXERGYNET_WHITEPAPER_PUBLIC_V3.pdf` (16 pages) was generated via a two-step pandoc-to-tex-then-pdflatex
pipeline — pandoc's own `--pdf-engine=pdflatex` invocation refused to run behind a first-run "MiKTeX
updates" pre-flight check that `pdflatex` itself does not actually require; invoking `pdflatex` directly
on pandoc's `.tex` output bypasses that check without bypassing any real verification.

Real visual QA was performed: all 16 pages individually rendered to PNG and visually inspected, not
assumed clean because the build succeeded. Result: one genuine defect found and fixed. The maturity
table's "Authority validator (identity/capability/freshness/integrity)" row overflowed its column and
broke the table's layout, because LaTeX had nowhere to break the line inside a slash-separated compound
with no spaces. Fixed by changing the separator to comma-plus-space, which lets the line wrap normally;
confirmed by re-rendering that page and comparing before/after. No other page showed any defect from the
full checklist: no other clipped text, no other broken tables, no orphan headings, no blank pages, no
malformed equations, no internal material leakage, no duplicated version labels, no encoding corruption,
no broken bullets. Figures throughout this paper (V1, V2, and V3 alike) are referenced narratively in
text rather than embedded as images in the markdown-to-PDF pipeline; this is consistent across all three
versions and is not a V3-specific gap.

A separate, real DOCX-specific defect was also found and fixed. This pandoc build's DOCX math converter
could not convert any LaTeX expression using `\frac` or `\boxed` — including the paper's cost-decomposition
formulas and both boxed invariants — and was silently rendering raw TeX source text in their place, which
would have shipped as visibly broken equations in the Word document. This is a limitation of this
specific pandoc build's math converter, not an error in the equations themselves — the identical LaTeX
renders perfectly through the PDF's real pdflatex path. Fixed by rendering exactly those four equations
as standalone, tightly-cropped PNG images and substituting them into a docx-specific build source,
`EXERGYNET_WHITEPAPER_PUBLIC_V3_docxsrc.md` (identical to the main manuscript except for these four
substitutions) — confirmed via the DOCX's internal media folder that all four images embedded correctly,
and confirmed zero remaining math-conversion warnings from pandoc. The canonical manuscript file used for
the PDF and for the written record is unchanged by this; only the separate DOCX-build copy substitutes
images, and it exists solely as a build input for the DOCX target.

Final state: `EXERGYNET_WHITEPAPER_PUBLIC_V3.pdf` (16 pages, visually clean) and
`EXERGYNET_WHITEPAPER_PUBLIC_V3.docx` (zero conversion warnings, four equations embedded as images) are
both complete. Visual QA is complete, not blocked.

---

## 2026-08-29 — Publication closure: figure rebuild, canonical-state cleanup, claim-ledger fix

**Scope:** No changes to the V3 manuscript body, PDF, or DOCX. This pass covers figure assets, the
internal canonical-state document, the claim ledger's operational note, and the agent handoff test.

| Timestamp | File | Change | Reason | Evidence source |
|---|---|---|---|---|
| 2026-08-29 | `docs/whitepaper/figures/fig10_state_mobility.png` (rebuilt) | Full rebuild showing V3 results: left panel = component isolation (R_CONV alone→MATCH, S_SSM alone→MATCH, ROOT_CAUSE=UNKNOWN), right panel = structural decomposition (R pair ordinals {2,9}/blocks {4,21}, PAIR required; S ordinals {4,5}/blocks {9,11}, alternative sufficient) | Prior fig10 was from V1/V2 era; V3 §5 has substantially different structural results from F6C and F6D | `LNES119B_EVIDENCE_LEDGER.md` Entries 022–024; WP-C028–C031 |
| 2026-08-29 | `docs/whitepaper/figures/fig13_state_types_authority.png` (new) | New figure: two-type state architecture — PERSISTENT PROJECT STATE (VMN/xLMP, model-independent, survives session boundary) vs. MODEL-NATIVE EXECUTION STATE (PIP, same-model same-runtime), with AUTHORITY always requiring independent revalidation at destination; governing invariant STATE_REALIZED ≠ AUTHORIZED | Directive §15: "This distinction is important enough for a figure"; §7 (PIP) and §4 (VMN) are described as architecturally complementary but not yet integrated | WP-C032 (PIP specification); WP-C019 (VMN); §7 boxed invariant |
| 2026-08-29 | `docs/whitepaper/WHITEPAPER_CLAIM_LEDGER_V3.md` | Operational note on MCP version updated: 0.2.6 is now confirmed ACTIVE_LATEST (was recorded as 0.2.5 at prior authorship); 0 npm-audit findings confirmed | MCP 0.2.6 release confirmed by MCP_0_2_6_RELEASE_EVIDENCE.md; prior note was accurate at first writing | NPM_AUDIT=0, CONSUMER_INSTALL=PASS, NPM_TEST_10X=10/10 PASS |
| 2026-08-29 | `EXERGYNET_CURRENT_RESEARCH_STATE.md` | Full reconstruction with exactly 10 required sections, no duplicates; maturity entries corrected (NEURO-LOCK: IMPLEMENTED, not DEPLOYED from FAA exemption; RHO: PILOT, no "static tariff PRODUCTION"; xLMP/VMN: local vs. handoff vs. deployed distinguished; PIP-V0: SPECIFICATION_COMPLETE + REFERENCE_IMPLEMENTATION_COMPLETE); canonical public paper set to V3 | Internal state document had accumulated duplicate/extra sections and contradictory maturity rows from incremental rewriting | Reconciled against V3 §13 maturity table and component boundary evidence |

**Visual QA:** fig10 and fig13 individually rendered and inspected. 0 clipped, 0 overlapping,
0 internal labels, 0 encoding corruption. Both figures correspond to active WP-C### claims (WP-C027–031 for fig10; WP-C019/032 and §7 invariant for fig13).

**V3 manuscript, PDF, and DOCX unchanged from the prior pass.**
