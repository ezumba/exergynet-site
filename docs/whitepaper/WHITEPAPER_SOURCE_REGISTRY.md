# WHITEPAPER SOURCE REGISTRY (VNext-Final, 2026-08-27)

Full source list for `EXERGYNET_WHITEPAPER_VNEXT.md`. Per the publication-closure directive §21:
**primary ExergyNet sources outrank old narrative documents; primary external sources outrank
secondary summaries.** Every entry below states what was actually consulted and how it was verified —
not merely cited by inheritance from an earlier document.

---

## A. Primary ExergyNet sources (internal)

These are carried forward from the Phase-1 evidence-closure and Phase-1C quantitative-audit passes
(`LNES116_EVIDENCE_CLOSURE_2026-08-25.md`, `SEI_1C_QUANTITATIVE_BENCHMARK_AUDIT.md`), re-verified in
those sessions by independent re-hashing and raw-artifact recomputation, not re-verified again in this
pass except where noted.

| Source | Used for | Verification method | Status |
|---|---|---|---|
| EVD-001 (H200 memory-efficiency package) | WP-C001, C002, C003a | SHA-256 independently recomputed and matched (`7005fa07…`), Phase 1C | VERIFIED |
| EVD-002 addendum | WP-C003b | Artifact re-hash **not** performed this pass or in Phase 1C (addendum artifact absent) | *[declared]*, HOLD_FOR_EVIDENCE |
| LNES-59 raw case data | WP-C004 | Phase 1C: figures cross-checked against source description; not independently re-run this pass | T1, carried forward |
| EVD-013 (LNES-84 compact index) | WP-C005 | Phase 1C: 52,753.8× and 0.72× independently verified from source artifact | VERIFIED |
| EVD-014 (LNES-86 routing) | WP-C006 | Phase 1C: 1.919×/1.129× verified against source | VERIFIED |
| LNES-22 architecture + unit test scripts (23+20+21 assertions) | WP-C007, C008 | Matches this session's own memory of independently-verified prior work (2026-08-05 session); re-confirmed no status change via `PROJECT_BLOCKERS.md` (dated through 2026-08-20) | VERIFIED (cross-session) |
| `docs/security/PUBLIC_SECURITY_CLAIM_MATRIX.md`, `SECURITY_PAGE_DEVELOPMENT_LEDGER.md` | WP-C007–C010, C020, LNES-22 status generally | Read in full this session (also the basis of the `security.html` release earlier in this session) | VERIFIED — primary-source-read basis confirmed |
| `PROJECT_BLOCKERS.md` BLK-022/023/024 | WP-C009, C010 | Read in full this session; confirms `AUTHORITATIVE_ACTIVATION_READY=NO` as of 2026-08-20, no later change found | VERIFIED |
| VAULT_LEDGER MMS entries; LNES-118 adversarial results | WP-C011 | Carried from Phase 1C verification (on-chain tx re-verify flagged as a still-pending deeper-pass item, not required to block this claim's stated tier) | T1 (testnet), one sub-item pending |
| LNES116D evidence closure (genesis/cost-equivalent hashes) | WP-C012 | Phase 1A: source hashes recorded (genesis `5325971c…`, cost-equivalents `c397ae67…`); raw campaign dataset hash remains `UNVERIFIED_OTET_GATED` | VERIFIED except one explicitly-flagged item |
| LNES119A5/A5.1/A4B raw jsonl | WP-C013, C014, C015 | Phase 1C: recomputed directly from raw files (30/30 aggregate corrected from a prior "30/30 each" misstatement; 9/9 byte round-trip) | VERIFIED |
| Temporal Authority source (journal/anchor/checkpoint) | WP-C016 | Carried from architecture recon; not re-read this pass | T2, carried forward |
| VAULT_LEDGER AERIS entries | WP-C017 | Carried from architecture recon | T2, carried forward |
| EVD-009/EVD-011 | WP-C018 | Carried from architecture recon and the earlier `security.html` claim-matrix read this session | VERIFIED (cross-session) |
| VMN v2.0.0 npm publication | WP-C019 | Carried from architecture recon | T1, carried forward |
| `ARCHITECTURE_RECON.md` §8 | WP-C020 | Read this session (`docs/whitepaper_vnext_recon/`) | VERIFIED — primary-source-read basis confirmed |
| FAA Exemption No. 26214 document; `docs/whitepaper/audit/FAA_NEUROLOCK_WEB_AUDIT.md` | WP-C021 | Full-text FAA document read (per audit trail: zero occurrences of "NEURO-LOCK," "cryptographic," "AI," or "autonomous" as technology descriptors) — carried from the 2026-08-05 and 2026-08-23 sessions' primary-source reads, re-confirmed present in this session's earlier `security.html` work | VERIFIED (cross-session) |
| **`docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md:1664–1689`** (frozen v1.9 baseline) | **WP-C024 (new)** | Read directly this session; benchmark table (P0/M0, P1/M1, P2/M2 rows) transcribed verbatim, arithmetic spot-checked (15/50=30%, 4/50=8%, 17/50=34%, 10/50=20%, 0/50=0% — all consistent with the stated percentages) | VERIFIED this pass |

## B. External primary sources (industry evidence, §1.1 / §2.5 only)

Every figure below was checked live against primary or close-to-primary sources this session, via web
search, **before** being written into the manuscript — none was taken from the directive's text on the
directive's authority alone.

| Citation key | Claim used | Primary source | Verification |
|---|---|---|---|
| `[NVIDIA-Q2FY27]` | Total revenue $96.221B; Data Center $89.023B +117% YoY; AI Clouds/Industrial & Enterprise $40.313B +138% YoY; Edge Computing $7.198B +27% YoY | NVIDIA Corp., "NVIDIA Announces Financial Results for Second Quarter Fiscal 2027," press release, 2026-08-26 ([globenewswire.com](https://www.globenewswire.com/news-release/2026/08/26/3351702/0/en/nvidia-announces-financial-results-for-second-quarter-fiscal-2027.html), also filed as SEC Form 8-K) | Total revenue, Data Center revenue, and both sub-segment figures independently corroborated across three financial/technical press sources (CNBC, 24/7 Wall St., search-aggregated results); direct SEC/press-release fetch returned 403/timeout — figures accepted on multi-source press corroboration, not on a single unverified source |
| `[NVIDIA-Q2FY27-CFO]` | Supply/capacity commitments $119B → $279B, "primarily related to the procurement of memory" | NVIDIA Corp., CFO Commentary, Q2 FY2027, Colette Kress, 2026-08-26 (`s201.q4cdn.com` PDF; SEC Form 8-K `q2fy27cfocommentary.htm`) | Direct PDF fetch failed (binary/undecoded); figure corroborated via two independent press sources reporting the same $119B→$279B figure and "primarily related to the procurement of memory" language attributed to Kress's prepared remarks; the $160B "memory commitments" headline figure in one source was reconciled as the delta ($279B−$119B=$160B), not a conflicting total |
| `[NVIDIA-Q2FY27-CALL]` | Jensen Huang: "AI has reached its inflection point. It's doing useful work. Its tokens are productive and profitable. Now, compute is revenue." Plus: multiple frontier labs scaling in parallel, thriving open-model ecosystem, physical AI coming online. | NVIDIA Q2 FY2027 earnings call, 2026-08-26 | Quote found verbatim, independently, in web search results summarizing the call; matches deploy.txt's directive text exactly — treated as corroborated, not merely trusted from the directive |
| `[NVIDIA-LPS]` | Land, power, and shell ("LPS") characterized as the next critical resource for AI factories | Jensen Huang, public remarks, on or around 2026-08-18–20 (pre-dates the Q2 earnings call; a separate public statement) | Corroborated via search results (officechai.com headline "Jensen Huang Says 'LPS' Is Next Critical Resource For AI Factories"; aninews.in, Forbes coverage of the same framing); exact wording paraphrased in the manuscript rather than quoted verbatim, since the precise sentence in deploy.txt ("next critical phase in the AI infrastructure buildout") was not found verbatim in any source — the verified framing ("next critical resource for AI factories") is used instead |
| `[MICRON-HC2026]` | Compute ~3×/2yr vs HBM bandwidth <2×/2yr; HBM ~90% of semiconductor area in a typical multi-stack GPU package; HBM thermal constraints from stacked geometry | Raghu Sreeramaneni (Micron, HBM Design Architecture Fellow), "Evolving Memory Architectures for AI," Hot Chips 2026, Stanford University, 2026-08-23 | Corroborated across multiple independent technical-press sources covering the presentation directly (ServeTheHome, WCCFTech, Borecraft, BigGo Finance, TechTimes, Forbes) — all report the same 3×/2yr vs <2×/2yr figures and ~90% semiconductor-area figure independently |

## C. Explicitly not sourced / not used

- **Original deploy.txt figures not independently found and therefore not used verbatim:** the exact
  phrase "Securing land, power and shell for data centers has become the next critical phase in the AI
  infrastructure buildout" was not located verbatim in any source consulted; the manuscript uses the
  independently-verified framing instead (see `[NVIDIA-LPS]` above) rather than presenting an unverified
  quotation as a direct quote.
- **`NVIDIA_RELEVANCE_NOT_FOR_WHITEPAPER.md`'s pre-earnings market-context figures** (~$92B consensus
  estimate, Reuters/Bloomberg >15% AI-server price-increase report, Micron's up-to-$3B investment
  announcement) — **not used** in this manuscript; they remain quarantined to the strategy memo per
  `WHITEPAPER_REBASE_DECISION_LOG.md` D-68. The manuscript uses only the post-earnings, primary-sourced
  Q2 FY27 actuals and the Hot Chips presentation, which are distinct facts from a distinct, later date.
- **Commercial/valuation material** ($5B/$8B/$15B, Poolside comparisons, licensing-demand framing) —
  categorically excluded per directive §16 and pre-existing WP-X04; not sourced because not permitted
  regardless of sourcing quality.

## D. Source-count summary (for the completion report, directive §24)
- **Primary ExergyNet sources used:** 18 distinct source artifacts/documents (Section A table).
- **External primary sources used:** 5 distinct citations, each independently corroborated across 2–6
  press sources (Section B table); none accepted on single-source or directive-text authority alone.
