# ExergyNet — Analyst & Press Evidence Packet

**Directive:** VP Sales Directive 005, §17
**Purpose:** a factual, citation-pointing briefing an independent analyst or technical journalist can use to evaluate ExergyNet without relying on the homepage. No valuation narrative, no competitor attacks, no "supremacy" language.

---

### 1. What is ExergyNet?

Infrastructure for useful machine work: a model-independent way for AI systems to hold authoritative state, measure the resource cost of a validated task, and interoperate across administrative boundaries. See [exergynet.org](https://exergynet.org) and the [white paper preview](https://exergynet.org/whitepaper.html).

### 2. What problem does it solve?

AI models are getting cheaper and more interchangeable; the cost of everything a persistent, multi-step, multi-agent system does *around* a model call — reconstructing state, re-fetching evidence, coordinating across models and organizations — has not fallen at the same rate. ExergyNet's first question is economic: can a system reduce the resource cost of a validated task, measured against a workload's own optimized baseline, without requiring a different model or cloud?

### 3. What is actually deployed?

- **Live:** LNES-04 on Base L2 (Base Sepolia fully testable today; the Base Mainnet contract is deployed but currently operating in mock-only mode — see `proof.html`).
- **Deployed, under investigation:** LNES-03 on Solana Mainnet-Beta — has settled successfully before, currently under active investigation for transaction failures.
- **Open source, published:** VMN (`vanguard-memory-node` on npm) — local, deterministic memory node for AI agents via MCP.
- **In development:** production-scale on-chain zero-knowledge verification in the evidence-query path.

### 4. What has actually been measured?

On a single NVIDIA H200 with a Nemotron-class model:
- xLMP held staged prompt cost roughly flat (~660–820 tokens) as the underlying corpus grew from 8,000 to 285,000 tokens.
- A 24.4-point accuracy advantage over a tested RAG baseline at equal evidence budget.
- ~11.3× the correct-task throughput of full-context replay, at each method's best sustainable operating point.

All three are bounded to this single tested environment and are not presented as universal savings claims. Full detail: [benchmarks.html](https://exergynet.org/benchmarks.html).

### 5. What is the strongest positive benchmark?

The ~11.3× correct-task-throughput result, because it is a direct, same-model, same-hardware comparison against the most expensive alternative (full-context replay) rather than against a hand-picked weak baseline.

### 6. What is the strongest negative/incomplete result?

Execution-state portability across a fresh process is **not yet achieved** at medium or long context: 0/10 in tested runs at both lengths (same-process restoration and short fresh-process continuity are validated; medium/long fresh-process continuity is not). This is reported on the white paper page as a named research frontier, not smoothed over.

### 7. Why is ExergyNet different from prompt caching?

Prompt caching reduces the cost of re-showing the same context to the same model in the same session. It does not survive a model swap, a session restart, or a change of vendor, and it does not establish what an organization treats as authoritative outside that one inference call.

### 8. Why is ExergyNet different from RAG?

RAG improves retrieval within a session against a document store; it doesn't itself define or govern what a multi-agent system treats as its authoritative state across models and organizations, and standard RAG baselines are among the comparisons the benchmark results above were measured against, not something ExergyNet claims to replace wholesale.

### 9. Why is ExergyNet different from generic agent memory?

Most "agent memory" products are a single model/vendor's session-recall feature. VMN (the openly published local memory node) is explicitly model-independent and runs without a cloud dependency; the broader ExergyNet state architecture is designed to persist across model and vendor changes, not to be a feature of one assistant product.

### 10. Why doesn't it require ExergyNet to control every model?

By design, ExergyNet is meant to sit alongside whatever model or provider an organization already uses — it does not require standardizing on one model vendor, replacing an existing cloud, or routing every internal model operation through one central ExergyNet-controlled service. See "What ExergyNet Does Not Require" on the homepage.

### 11. What can an independent evaluator reproduce today?

- Install and run VMN locally (`npm install -g vanguard-memory-node`) — open source, MIT licensed.
- Read the LNES-04 and LNES-03 contract addresses and current status directly from `proof.html` and verify them on-chain (BaseScan / Solscan links provided).
- Bring a bounded, state-heavy workload for a design-partner benchmark comparison against an organization's own already-optimized baseline (see [design-partner.html](https://exergynet.org/design-partner.html)).

### 12. Which claims remain research frontier?

Named explicitly, not hidden: production-wide authority enforcement across every live route; true cross-process and cross-node execution-state portability; a physical-state observation primitive; production-scale zero-knowledge verification integrated into the evidence-query path.

---

## A note on independent validation status, for transparency

- ExergyNet's MCP server is genuinely listed in the official Model Context Protocol registry (`registry.modelcontextprotocol.io`, namespace `io.github.ezumba/exergynet`, status active) — this reflects namespace ownership, not an Anthropic endorsement or security certification; the registry's own documentation is explicit that it performs no editorial review. As of 2026-08-28 this registry entry's own metadata is stale (an older package version) and is being corrected — see the security/release-history section below.
- An independent MCP security scanner previously scored an ExergyNet MCP package 71/100 (Grade C) against an older build (0.1.10, scanned 2026-07-09). That scanning service's own tooling could not be independently confirmed as still operable as of 2026-08-28; the 71/100 figure should be read as a historical result against a superseded release, not a current score. See the section below for what has changed since.
- An ExergyNet grant request appears in Optimism's Season 9 governance record and was declined by the Grants Council; no specific reason is given in the public record. This is disclosed here rather than omitted.

## Security and release-history note (added 2026-08-28)

Bounded to what is independently verifiable; not a narrative about the company's overall security posture.

- An independent security scan of an earlier MCP package build (0.1.10) identified weaknesses in input validation, audit logging, rate limiting, and supply-chain hygiene.
- A subsequent internal review, prompted by that scan, discovered a separate and more serious issue in a later build: a write-transaction tool that referenced a Base L2 contract ExergyNet's own status page identifies as retired.
- The affected write path was disabled — it now returns a fixed, non-functional response under every configuration and carries no transaction-signing capability at all.
- The affected package releases (0.2.0 through 0.2.2) have been marked deprecated on npm, pointing installers to the fixed release.
- Release provenance for the fixed version was independently reconstructed and verified end to end, from source commit through the exact artifact a real install receives from npm — not assumed from a successful publish alone.
- The dependency vulnerabilities flagged by the original scan have been remediated in a follow-up release (0.2.5), using a targeted fix that does not require downgrading a core dependency.
- No evidence was found of any independent (non-developer) user ever using the affected path; on-chain records show only internal testing activity against the retired contract.
- The V5 write-settlement path referenced elsewhere in ExergyNet's architecture remains disabled pending its own independent verification — this is a separate, deliberate decision, not an emergency measure.

This is not characterized as a breach, and no wallet or account involved is characterized as compromised — neither is established by the evidence found. Nor is this presented as a claim of zero risk: some MCP ecosystem surfaces that describe ExergyNet's software (a directory listing, a registry entry) still reflect older, pre-fix information as of this writing and are in the process of being corrected; an evaluator should check the actual installed package version and its behavior directly rather than relying solely on a third-party listing's description.

This packet is meant to be handed to someone who will check it, not someone being asked to trust it.
