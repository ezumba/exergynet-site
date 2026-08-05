# Operator Decisions Required
**Document type:** Decision register — items only the operator can resolve
**Audit date:** 2026-08-05
**Constraint:** No work proceeds on blocked items until decision is recorded here

Each item has: a decision ID, what specifically must be decided, the impact on blocked work, and whether it blocks Stage 1 (immediate) or a later stage.

---

## OD-001 — Vanguard benchmark approach: Remove vs. Evidence

**Decision:** Choose one approach for the unsubstantiated Vanguard performance claims:

**Option A — Remove pending evidence (safe, immediate):**
Remove "5× Faster TTFT," "~40ms avg TTFT," "97% lower overhead vs frontier API," "$0.40 per 1K tokens" from vanguard.html. Replace with general capability descriptions without specific numbers. These can be added back once evidence is produced.

**Option B — Provide evidence:**
Provide the following for each claim before publication:
- "5× Faster TTFT": baseline system, test date, hardware, sample size, methodology
- "~40ms avg TTFT": same + P50/P99 distribution
- "97% lower overhead": definition of "overhead," definition of "frontier API" baseline
- "$0.40 per 1K tokens": confirm this is the actual billed rate and it matches current API pricing

**Blocking:** Stage 2 (Commit Group 2) cannot be finalized until Option A or Option B is chosen.
**Recommendation:** Option A immediately; Option B in a future commit once evidence is produced. Do not delay Stage 1 security fixes waiting for Option B evidence.

**Decision:** [ ] Option A (remove)  [ ] Option B (provide evidence by: ________)
**Decided by:** ____________  **Date:** ____________

---

## OD-002 — Vanguard "Zero-Retention Hardware Enclave" — TEE or retention policy?

**Decision:** Choose one:

**Option A — No TEE deployed:** Remove "Zero-Retention Hardware Enclave." Replace with: "Stateless inference sessions — no input retention by default." Document the actual data-handling policy.

**Option B — TEE deployed:** Provide: specific TEE hardware (SGX enclave, AMD SEV, TrustZone), attestation mechanism, configuration. Add as evidence, reference on page.

**Security note (SEX-008):** If any Vanguard customers made trust decisions based on this claim, a proactive correction should be considered.

**Decision:** [ ] Option A  [ ] Option B (TEE hardware: ____________)
**Decided by:** ____________  **Date:** ____________

---

## OD-003 — Vanguard "Proprietary Silicon Geometry" — real or remove?

**Decision:** Choose one:

**Option A — Marketing language, no specific referent:** Remove the phrase. The GPU hardware in use (H200 and others) is NVIDIA, not proprietary silicon.

**Option B — Refers to a real hardware feature:** Describe what this refers to (custom kernel, custom ASIC, specific NPU configuration, etc.) and add technical documentation.

**Decision:** [ ] Option A (remove)  [ ] Option B (describe: ____________)
**Decided by:** ____________  **Date:** ____________

---

## OD-004 — Vanguard per-token pricing — confirm or remove

**Decision:** Confirm the current billing rate for the Vanguard API:

- If billing is live and "$0.40 per 1K tokens" is accurate: retain the claim.
- If billing rate is different: update to the correct rate.
- If no billing is active yet: remove the pricing claim.
- If pricing is confidential or negotiated per customer: remove public pricing and replace with "Contact for pricing."

**Decision:** [ ] $0.40/1K is correct  [ ] Correct rate is: $____  [ ] Remove pricing claim  [ ] Replace with "Contact for pricing"
**Decided by:** ____________  **Date:** ____________

---

## OD-005 — LNES-05 Ghost-Witness deployment status

**Decision:** What is the current status of LNES-05?

- **If deployed:** Provide on-chain address or test confirmation. Add to canonical claim ledger. Change footer "Live" claim to "Deployed" with appropriate qualifier.
- **If staged/built but not deployed:** Change footer "Live" → "Staged." Add LNES-05 to the canonical claim ledger with Staged status.
- **If not built or highly uncertain:** Remove from footer until status is confirmed.

**Blocking:** CP-004 (footer HIGH-003 fix) cannot be finalized until this is answered.

**Decision:** [ ] Deployed at: ____________  [ ] Staged  [ ] Remove from footer
**Decided by:** ____________  **Date:** ____________

---

## OD-006 — LNES-03 Solana current operational status

**Decision:** What is the current Solana program status?

VAULT_LEDGER shows: `7BCPpUMBxQMPomsgTaJsQdLEfycNwPWqkQD1Cea4CcCL` — 10 consecutive failed transactions as of 2026-07-28.

- **If the failure has been investigated and resolved:** Provide resolution evidence. Footer label to what? ("Live" requires current operational confirmation.)
- **If still failing / cause unknown:** Keep footer at "Investigating" or "Testnet." Document in PROJECT_BLOCKERS.md.
- **If testnet-only:** Change footer to "Testnet."

**Blocking:** CP-003 (footer HIGH-002 fix) final label depends on this.

**Decision:** [ ] Still failing — use "Investigating"  [ ] Resolved — confirmed by: ____  [ ] Testnet-only — use "Testnet"
**Decided by:** ____________  **Date:** ____________

---

## OD-007 — Legal entity name for all public surfaces

**Decision:** What is the confirmed public-facing legal entity name?

Context: The operator's prior session instruction noted: "EDT 100% owns EDT INC as its holding company and has assigned Exergynet Technology to Exergynet Corp. I want to shield the Trust and the holding company is also out of reach, so the company is Exergynet Corp."

The canonical white paper v1.2 uses "ExergyNet" (without "Corp") because "ExergyNet Corp" was classified as unverified until legal entity confirmation is obtained. This is publication condition #2.

- **Option A:** Confirm legal entity is "ExergyNet Corp" (or "Exergynet Corp"). Update canonical paper, all page copyrights, JSON-LD, and meta descriptions.
- **Option B:** Confirm legal entity is "ExergyNet" (no "Corp"). Keep as-is in canonical paper.
- **Option C:** Pending legal registration — keep "ExergyNet" until registration is confirmed.

**Blocking:** White paper publication (Stage 7); JSON-LD structured data (Stage 4); all copyright notices.

**Decision:** [ ] Option A — "ExergyNet Corp"  [ ] Option B — "ExergyNet"  [ ] Option C — pending until: ____________
**Decided by:** ____________  **Date:** ____________

---

## OD-008 — whitepaper.html interim state during Stage 3

**Decision:** While waiting for the whitepaper.html rebuild (Stage 7), what should happen to the current whitepaper.html?

- **Option A:** Add interim update notice (see CATEGORY_COPY_PACKAGE.md Section H) — keeps existing content, adds honest "update in review" notice.
- **Option B:** Replace the page with a simple "Coming soon" placeholder with the title "xLMP: The AI Memory Control Plane."
- **Option C:** Leave as-is until rebuild — accept the inconsistency temporarily.

**Recommendation:** Option A (additive, does not break links, honest).

**Decision:** [ ] Option A (update notice)  [ ] Option B (placeholder)  [ ] Option C (leave as-is)
**Decided by:** ____________  **Date:** ____________

---

## OD-009 — Category copy: approve CATEGORY_COPY_PACKAGE.md

**Decision:** Review and approve (or revise) the proposed copy in CATEGORY_COPY_PACKAGE.md:

- Section A: Homepage hero
- Section B: Page title tags
- Section C: Meta descriptions
- Section D: OG tags
- Section E: JSON-LD
- Section F: xLMP architecture summary
- Section G: Developer CTA
- Section H: whitepaper.html interim notice

**Decision:** [ ] Approved as-is  [ ] Approved with revisions: [attach marked-up copy]  [ ] Rejected — provide alternative
**Decided by:** ____________  **Date:** ____________

---

## OD-010 — Second independent website claim audit: auditor selection

**Decision:** Who will conduct the second independent website claim audit (GATE-G-010)?

Options:
- A fresh Claude Code session with no prior context of this audit (blind)
- An external human security reviewer
- A designated internal co-author (Veena or Phone) reviewing the public site

**Decision:** [ ] Fresh Claude Code session  [ ] External reviewer: ____________  [ ] Internal: ____________
**Decided by:** ____________  **Date:** ____________

---

## Five White-Paper Publication Conditions (Reference)

These are the 5 conditions from the canonical paper that also gate Stage 6 and 7:

| CONDITION | STATUS | OPERATOR ACTION |
|-----------|--------|----------------|
| Veena co-author acceptance | PENDING | Provide paper to Veena for review |
| Phone co-author acceptance | PENDING | Provide paper to Phone for review |
| FAA docket FAA-2025-5731 NEURO-LOCK language | PENDING | Retrieve docket language |
| GPS-independent positioning LNES number | PENDING | Assign LNES number in architecture meeting |
| LNES-22 port 3000 tunnel decision | PENDING | Engineering + operator decision |

---

## Decision Summary Table

| OD_ID | DESCRIPTION | BLOCKS STAGE | STATUS | RULING | DATE |
|-------|-------------|-------------|--------|--------|------|
| OD-001 | Vanguard benchmark: remove vs evidence | Stage 2 | RESOLVED | Option A — remove pending evidence | 2026-08-05 |
| OD-002 | Vanguard TEE claim | Stage 2 | RESOLVED | Option A — no TEE; use retention-policy language only | 2026-08-05 |
| OD-003 | "Proprietary Silicon Geometry" | Stage 2 | RESOLVED | Option A — remove; NVIDIA hardware is not proprietary ExergyNet silicon | 2026-08-05 |
| OD-004 | Vanguard pricing | Stage 2 | RESOLVED | Replace numerical pricing with "Contact for pricing" | 2026-08-05 |
| OD-005 | LNES-05 Ghost-Witness status | Stage 1 (CP-004) | RESOLVED | Remove from footer pending implementation evidence and claim-ledger entry | 2026-08-05 |
| OD-006 | LNES-03 Solana operational state | Stage 1 (CP-003) | RESOLVED | "Investigating" — 10 failed txs do not support "Live" | 2026-08-05 |
| OD-007 | Legal entity name | Stage 4, Stage 7 | RESOLVED | Option A — ExergyNet Corp; add corporate record to internal legal evidence directory before final publication | 2026-08-05 |
| OD-008 | whitepaper.html interim state | Stage 3 | RESOLVED | Option A — additive update notice; keep current page accessible | 2026-08-05 |
| OD-009 | Category copy approval | Stage 3 | RESOLVED | Approved with revisions — see CATEGORY_COPY_PACKAGE.md updated sections | 2026-08-05 |
| OD-010 | Second audit auditor selection | Stage 7 | RESOLVED | Fresh Claude Code session (blind, no prior audit context); Veena/Phone perform additional author review | 2026-08-05 |

**All ODs resolved as of 2026-08-05. Stage 1 applied. Stages 2–7 await their respective trigger conditions.**
