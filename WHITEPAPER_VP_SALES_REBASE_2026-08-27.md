# ExergyNet White Paper — VP Sales Commercial Rebase Diagnosis and Plan

**Directive:** VP Sales Directive 002 — ExergyNet White Paper Commercial Rebase and Publication Audit
**Date:** 2026-08-27
**Scope:** `docs/whitepaper/EXERGYNET_WHITEPAPER_PUBLIC.md` / `.pdf` (the current public paper, built earlier today from `EXERGYNET_WHITEPAPER_VNEXT.md` after a separate evidence-closure and publication-redesign pass — see `WHITEPAPER_CHANGELOG.md`'s existing entries, which this document does not repeat or duplicate).
**Constraint:** Reorder and reframe only. No claim strengthened, no evidence boundary erased, no new empirical result introduced. `WHITEPAPER_CLAIM_LEDGER.md`, `WHITEPAPER_SOURCE_REGISTRY.md`, `WHITEPAPER_POSTURE_AUDIT.md`, and `WHITEPAPER_CHANGELOG.md` are treated as authoritative and unaltered in their existing rows; this pass only appends to them.

---

## 1. Current Commercial Diagnosis

The current public paper (V1) is, on its own evidentiary and editorial terms, **exceptionally well-disciplined** — a separate, rigorous pass already closed most of the integrity problems this kind of document usually has: every quantitative claim carries its tested envelope in the same sentence, negative/incomplete results are stated plainly (fresh-process medium/long continuation: 0/10, not hidden), external industry evidence (NVIDIA, Micron) is cited, dated, and explicitly disclaimed as non-validating, and a full visual-QA pass already caught and fixed a real data bug and an internal-label leak before publication. A grep for "sovereign" across the manuscript returns **zero occurrences** — the self-referential-authority problem that dominates the website recon (`WEBSITE_COMMERCIAL_RECON_2026-08-27.md` §D.1) is **not present in this document.** That finding alone means §9 of this directive requires no corrective action here; it is confirmed clean, not assumed clean.

The problem this directive identifies is real, but it is a **sequencing** problem, not a truth problem: the reader earns the full ontology (identity, authoritative state, authority, interoperability, provenance, transactions, resource accounting, governance) before the commercial question — *does this reduce what it costs me to get a validated task done?* — has been made unavoidable. Concretely:

- The Abstract's second sentence is already "ExergyNet defines a model-independent substrate for these functions" — Layer 2 (Product) — before Layer 1 (economic pressure) has been established as a reader-legible problem in its own terms.
- The headline-results table orders **memory → authority → state-governance → physical-consequence**. Per this directive's §13, authority should not lead over the state-governance result, and the whole table should lead with the efficiency result more forcefully positioned as *the* opening evidence.
- Section 4, "Reasoning, Evidence, and Authority" — home to the paper's single strongest security result (the prompt-injection finding) — sits fourth of nine sections, ahead of State Mobility (Section 5), which splits the state narrative in two and gives Authority more front-loaded weight than this directive's thesis order (`Economic pressure → efficiency → state → model independence → interoperability → authority`) calls for.
- The paper never states, anywhere, the plain reassurance a first-time enterprise reader needs: *you do not have to replace your model or hand over policy authority to read past the abstract.* This is the same gap the website recon found in the primary sales funnel (`WEBSITE_COMMERCIAL_RECON_2026-08-27.md` §C, "ADD" — "an explicit 'keep your models, keep your cloud, keep your data' statement... currently never stated anywhere on the site").
- Figure 1 (`Model → [ExergyNet] → Digital & Physical World`) is architecturally accurate but visually reads exactly as this directive's §10 describes: an unknown company's box sitting between every model and everything it can affect. The three-plane architecture diagram (Figure 2) does not have this problem — it shows internal separation, not external chokepoint — but Figure 1 is the one most readers see first.
- The paper has no formal "useful work" economic measurement layer, no explicit Context/Memory/Authoritative-State distinction, no Model-Substitution section, and no Administrative-Boundaries section — four of this directive's requested additions describe *real, defensible architectural positions the paper already implies* (e.g., Section 2's "memory evidence is not execution authority; model identity is not agent identity" already gestures at Context≠Memory≠State) but never states as a named, reader-facing concept.

**Bottom line:** this is a genuinely strong technical document that opens in the wrong order for the buyer this company is now trying to reach. The fix is structural, not evidentiary.

---

## 2. Proposed New Title/Subtitle Combinations

Current: **"Shared Infrastructure for Autonomous Machine Intelligence"** / **"Model-independent infrastructure for persistent, governed, economically accountable machine intelligence."** Technically accurate; leads with "governed" (authority-adjacent) before the reader has any reason to care, and "Shared Infrastructure" alone doesn't signal useful-work economics or model independence at a glance.

| # | Title | Subtitle | Notes |
|---|---|---|---|
| A | ExergyNet | **Infrastructure for Useful Machine Work** — *Model-independent persistent state and accountable authority for autonomous systems that must remember, prove, and act across models and machines.* | Leads with "useful work" (this directive's #1 priority concept). Recommended. |
| B | ExergyNet | **The Infrastructure Behind Useful Machine Work** — *Persistent, model-independent state and measured resource efficiency for autonomous systems that outlast any single model.* | Similar to A, slightly more agentive phrasing ("behind" vs. "for"); "outlast any single model" foregrounds model independence. |
| C | ExergyNet | **Persistent Infrastructure for Autonomous Machine Intelligence** — *Model-independent state, measured efficiency, and accountable authority for systems that must remember, prove, and act across models.* | Closest to the current title (lowest change, easiest to defend to reviewers who liked the original); leads with "Persistent" rather than "Useful Work." |
| D | ExergyNet | **Continuity Infrastructure for Machine Intelligence** — *Persistent state and bounded authority that survive model, vendor, and session change — measured for resource efficiency, not assumed.* | Strongest "continuity across models" framing; slightly more defensive/technical tone. |
| E | ExergyNet | **Shared Infrastructure for Machine Intelligence** — *Model-independent state and measured efficiency for intelligence that must persist, prove, and act across systems it does not own.* | Minimal-change option: keeps "Shared Infrastructure," drops "Autonomous" (slightly over-personifying), adds "systems it does not own" to make the compatibility promise explicit. |

All five avoid every disqualified framing in this directive's §4 list (sits above all models / controls AI / governs the AI ecosystem / owns machine authority / universally required / "sovereign"). None currently in the manuscript needed removal to satisfy that list — the existing title already avoided those errors; the candidates above are reordering the *emphasis*, not fixing a violation.

**Recommendation: Candidate A.** It is the only option that puts "useful work" — this directive's own Layer 1 vocabulary — in the reader's first six words. **Not finalized without this report** — Candidate A was used in the V2 manuscript pending explicit confirmation; C is the safest fallback if a reviewer prefers minimal drift from V1's own title.

> **VP Sales decision (2026-08-27, operator-approved — FROZEN):** Title confirmed as Candidate A: **"ExergyNet — Infrastructure for Useful Machine Work."** The descriptive sub-subtitle is **amended** from Candidate A's original wording ("Model-independent persistent state and accountable authority for autonomous systems that must remember, prove, and act across models and machines") to:
>
> **"Model-independent state and measured efficiency for AI systems that must persist across models, sessions, and organizations."**
>
> Reason given: the original wording put "accountable authority" on the cover — the very piece of Layer-4 vocabulary this directive's own thesis order (`Economic pressure → efficiency → state → model independence → interoperability → authority`) says should be earned later in the reader's journey, not stated on page one. The amended subtitle carries Useful Work → State → Model Independence → Continuity and defers Authority to Section 8, matching the approved reader-journey order exactly. This is a cover-only change: no manuscript section, figure, or claim was altered by this decision. `EXERGYNET_WHITEPAPER_PUBLIC_V2.md` and `.pdf` have been rebuilt with this subtitle and are now **frozen** pending Directive 003/004.

---

## 3. Revised Section Hierarchy

| # | V2 section | Source | Action |
|---|---|---|---|
| — | Cover | V1 cover | REFRAME — new title/subtitle (Candidate A) |
| — | Abstract | V1 Abstract | REFRAME — rebuilt to the 5-paragraph order in this directive's §5 |
| — | Executive Summary | V1 Executive Summary | REFRAME — headline-results table reordered (efficiency → state-governance → authority → physical-consequence) |
| — | **What ExergyNet Does Not Require** | — | **ADD** (new, boxed, placed immediately after the Executive Summary per this directive's §21) |
| 1 | The Economic Problem | V1 §1 (industry-evidence paragraphs only) | REFRAME — the O(N²)/interoperability argument is MOVED OUT to the new §7 (Administrative Boundaries and Interoperability); this section becomes pure economic-pressure framing plus the NVIDIA/Micron evidence, unchanged in substance |
| 2 | **Useful Work: A Measurement Layer for Machine Intelligence** | — | **ADD** (new — C_Q / E_Q / T_p50,p95 formalism, explicitly split into CURRENTLY MEASURED vs. PROPOSED STANDARDIZED EVALUATION FRAMEWORK per this directive's §6) |
| 3 | The ExergyNet Architecture | V1 §2 | REFRAME — Figure 1 replaced with the new Candidate-A topology diagram (§10 below); three-plane structure (Figure 2) and the separation-of-predicates paragraph carried forward unchanged |
| 4 | Persistent State and xLMP | V1 §3 | KEEP (unchanged content; renumbered) |
| — | **Box: Context, Memory, and Authoritative State** | — | **ADD** (new, per this directive's §7, placed immediately after §4 as the pivot to "why efficiency alone is not the product") |
| 5 | State Mobility | V1 §5 | MOVE — relocated to sit immediately after §4/the new box, so all state-continuity content is contiguous; content unchanged. Includes a new short **Architectural Objective vs. Current Measured Portability** callout (this directive's §8) — no new empirical claim, only an explicit restatement of the existing "Validation scope" boundary as a named two-column distinction |
| 6 | **The Model-Substitution Principle** | — | **ADD** (new, per this directive's §19) |
| 7 | **Administrative Boundaries and Interoperability** | V1 §1's O(N²) paragraph (moved here) + new framing | ADD/MOVE — new Administrative-Boundaries scenario (§20) plus the relocated, re-concluded O(N²) argument using this directive's §11 preferred conclusion wording |
| 8 | Reasoning, Evidence, and Authority | V1 §4 | MOVE — relocated from position 4 to position 8, per this directive's §14; content, evidence, and hedging unchanged |
| 9 | Machine Resource Economics | V1 §6 | REFRAME — one clarifying sentence added distinguishing the §2 useful-work denominator (C_Q) from RHO's internal resource-accounting semantics, per this directive's §18; no other change |
| 10 | When Software Becomes Structural | V1 §7 | KEEP (unchanged; stays late per this directive's §17) |
| 11 | Applications | V1 §8 | KEEP (unchanged) |
| 12 | Validation Status and Research Frontier | V1 §9 | REFRAME — adds a **Proposed Comparative Evaluation Program (B₀–B₅)** subsection per this directive's §22; existing maturity table unchanged |
| — | Conclusion | V1 Conclusion | REFRAME — adds the commercial CTA from this directive's §23 as a closing paragraph before the signature line; existing "vehicles and roads" thesis language unchanged |
| — | References | V1 References | KEEP (unchanged) |

**Net structural change:** 9 numbered sections → 12, plus one new boxed callout and one new front-matter box. Four wholly new sections (Useful Work, Context/Memory/State box, Model-Substitution, Administrative Boundaries) and one new front box (Does Not Require) are added. Two sections are reordered (Authority moves from #4 to #8; State Mobility moves from #5 to #5-contiguous-with-§4, net position unchanged but now adjacent to its companion state section instead of separated by Authority). No section is deleted. No evidence table row, tier, or wording is altered from V1.

---

## 4. Diagram Recommendations

Two candidate replacements for Figure 1 were produced (`docs/whitepaper/figures/fig01alt_candidateA_customer_state.png`, `fig01alt_candidateB_sovereignty_bridge.png`), matching the manuscript's existing visual system (navy/grey/green, same typography):

- **Candidate A — Customer-Controlled State Substrate.** Models and the customer's own application connect through small ExergyNet protocol components to state the *customer* owns, inside a dashed "customer-controlled boundary." ExergyNet is drawn as a connector, not a box the customer's data must pass through to reach the outside world in every case.
- **Candidate B — Sovereignty-Boundary Bridge.** Two fully self-contained organizations (each with its own internal models and its own authoritative state) are bridged only at the boundary by a small ExergyNet component. This is the stronger diagram for the multi-institution/interoperability story (§7 of the new manuscript) but a weaker fit for the single-customer architecture overview (§3), where Candidate A reads more naturally.

**Recommendation:** use **Candidate A** as the new Figure 1 in §3 (The ExergyNet Architecture), and use **Candidate B** in the new §7 (Administrative Boundaries and Interoperability), where the multi-organization scenario it depicts is the section's actual subject. This uses both candidates rather than discarding one, and each is placed where its framing is literally true rather than merely defensible. The original Figure 1 image is **not deleted** — it remains in `docs/whitepaper/figures/fig01_thesis.png` for the historical record and is simply no longer the manuscript's lead diagram.

---

## 5. Benchmark Recommendations

This directive's §22 comparative-evaluation-program request (B₀ full-context replay, B₁ provider-native caching, B₂ optimized RAG, B₃ persistent/provider memory, B₄ ExergyNet/xLMP, B₅ native optimization + ExergyNet) is added to §12 (Validation Status and Research Frontier) as an explicitly labeled **proposed** program, not a result. The manuscript already reports B₀ (full-context replay) and an approximation of B₂ (tested RAG baseline) as T1 results (WP-C001–C003a) — those are **not restated as anything more than they already are.** B₁, B₃, and B₅ have no existing artifact in `WHITEPAPER_CLAIM_LEDGER.md` and are presented purely as the next comparison points the program intends to add, with an explicit sentence: *"No result is reported for B₁, B₃, or B₅ until an artifact exists in the claim ledger."*

---

## 6. Exact Claims Requiring No Change

Every row in `WHITEPAPER_CLAIM_LEDGER.md` (WP-C001–WP-C024) is carried into V2 with identical values, tiers, and envelopes. Specifically unchanged, verbatim or near-verbatim (only relocated to a different section number):

- WP-C001/C002/C003a (xLMP token-flatness, +24.4 pts, 11.3×) — §4 (was §3).
- WP-C004 (state-governance 8%→0%, accuracy flat 84%) — §8 (was §4), reframed per this directive's §15 emphasis ("better governance ≠ better model intelligence") but not reworded in substance.
- WP-C007/C008/C009/C010 (prompt-injection result, policy-gate pilot status, no-production-consequence boundary, xISA taxonomy) — §8 (was §4), reframed per this directive's §16 (positioned as evidence that "reasoning and authority must remain separable," not that "ExergyNet should govern every model" — the manuscript already avoided the latter framing in V1).
- WP-C013/C014/C015 (execution-state continuity, same-process 30/30, fresh-process medium/long 0/10, serialized≠live) — §5 (was §5, now relocated to sit next to §4).
- WP-C011/C012 (Omega/MMS testnet settlement, RHO metrology) — §9 (was §6).
- WP-C024 (Tensile-Lift aviation gate, 0/50 both runs, SIMULATED_WITNESS) — §10 (was §7), unchanged per this directive's §17 ("keep it late").
- WP-C016–C023 (Temporal Authority, AERIS, VMN, authority separations, FAA fact, PSO PROPOSED, TransitionWitness HELD) — unchanged, distributed across §3, §9, §11 as in V1.
- The full NVIDIA/Micron industry-evidence block (§1.1/§2.5 equivalents) — carried into the new §1, with its existing "not ExergyNet evidence, not validation" disclaimer unchanged, per this directive's §12.

## 7. Exact Claims Requiring Wording Changes

**None.** No entry in `WHITEPAPER_CLAIM_LEDGER.md` requires a wording change for this pass — this is a reordering and framing directive, not a re-verification pass, and the existing evidence language already meets the "achievement → envelope → frontier" standard this directive asks to preserve (§3). The only textual additions are the four new architectural/framework sections and the "Does Not Require" box, none of which restate an existing WP-C### claim with different wording; each is checked in the crosswalk (`WHITEPAPER_V2_CLAIM_CROSSWALK.md`) to confirm it introduces no new empirical claim.

## 8. Commercial CTA

Per this directive's §23, verbatim intent, added as the Conclusion's closing paragraph:

> *Design partners can provide a bounded, state-heavy workload for comparative measurement against their existing optimized baseline. **Benchmark the workload, not believe the claim.***

No pricing, no valuation, no investor language, no NVIDIA-partnership assumption is included, per this directive's explicit prohibition.

## 9. Unresolved Questions (carried to the operator)

1. **Title finalization** — Candidate A is used in V2 pending confirmation; C is the lowest-drift fallback.
2. **Diagram finalization** — both candidates are built and placed per §4 above; if the operator prefers a single diagram reused in both locations, Candidate A generalizes better than B does to the single-customer case.
3. **The two files this directive names as ground truth (`WHITEPAPER_CLAIM_LEDGER.md`, `WHITEPAPER_SOURCE_REGISTRY.md`, `WHITEPAPER_POSTURE_AUDIT.md`, `WHITEPAPER_CHANGELOG.md`) are, as of this pass, untracked in git** (confirmed via `git ls-files`) — they exist only in the local working tree, alongside `EXERGYNET_WHITEPAPER_PUBLIC.md/.pdf` themselves. None of this whitepaper work is committed. This mirrors the split-brain risk flagged in `WEBSITE_COMMERCIAL_RECON_2026-08-27.md` §0 for the website repo — a future session or machine could lose this entire body of work if the working tree is ever cleaned, reset, or abandoned. Recommend committing the `docs/whitepaper/` directory (and this V2 output) as its own dedicated commit once the operator has reviewed it — not done automatically here, per this directive's §27 "do not deploy yet."
4. **WP-C003b** (the ~42.7×/~4.0× EVD-002-addendum figure) remains `*[declared]*, HOLD_FOR_EVIDENCE` in the source registry — V2 carries it forward with the identical hedge; it is not promoted or removed.
5. Whether the "Applications" section's clinical-decision-support illustrative case study should eventually be joined by a second, equally-illustrative non-clinical example was raised implicitly by this directive's §11 vertical-ordering request but is out of scope for a reordering-only pass — flagged, not actioned.
