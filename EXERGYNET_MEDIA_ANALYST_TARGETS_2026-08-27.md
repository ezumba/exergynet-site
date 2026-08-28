# ExergyNet — Media/Analyst Target Research List

**Directive:** VP Sales Directive 005, §21
**Status: research list only. No outreach has been sent or drafted for sending. Outreach requires separate, explicit authorization.**

This session did not have live web-search capacity remaining to build a fully populated, named list of specific journalists with verified recent bylines without risking fabrication. Per this session's own discipline (do not invent relationships, do not guess at names/publications), the table below is intentionally structured but only partially populated — it identifies the **beats and publication types** worth targeting, with placeholders marked `TBD — requires dedicated research pass` rather than invented names. Directive 006 (or a dedicated follow-up) should complete this with real bylines before any outreach is considered.

| Name | Publication | Beat | Recent relevant article | Why ExergyNet is relevant | Angle | Evidence required before contact | Priority |
|---|---|---|---|---|---|---|---|
| TBD — requires dedicated research pass | Publications covering AI infrastructure economics (e.g. The Information, SemiAnalysis-adjacent independents) | AI infrastructure economics | TBD | Falling inference prices vs. rising state/coordination overhead is a live economics story | Story A (Useful Work Economics) | Confirm the writer has published cost-per-task or infra-economics analysis, not just funding-round coverage | High |
| TBD — requires dedicated research pass | Publications covering inference systems / MLOps | Inference systems, serving infrastructure | TBD | Correct-task throughput vs. full-context replay is a systems-benchmarking story | Story A | Confirm technical benchmarking background, not generalist tech news | High |
| TBD — requires dedicated research pass | Publications covering agent infrastructure / multi-agent systems | Agent infrastructure | TBD | Model-substitutability and state-continuity is a direct agent-infra concern | Story B (Models Can Change, State Must Persist) | Confirm prior coverage of agent memory/state, not just "AI agents" trend pieces | High |
| TBD — requires dedicated research pass | Publications covering AI memory/state specifically (a narrower niche than general agent-infra) | AI memory/state | TBD | VMN and the model-independent state architecture are directly on-beat | Story B | Confirm they've covered RAG/memory-layer products critically, not just announced them | High |
| TBD — requires dedicated research pass | Publications covering distributed systems | Distributed systems | TBD | The Solana/Base dual-settlement architecture and LNES protocol family is a distributed-systems design story | Story A or B | Confirm systems-design depth (would ask about consensus/consistency tradeoffs, not just "is it decentralized") | Medium |
| TBD — requires dedicated research pass | Publications/newsletters specifically about MCP (Model Context Protocol) | MCP ecosystem | TBD | ExergyNet's MCP server is listed in the official registry; MCP-specific coverage is a narrow, high-relevance niche | Story B | Confirm they cover MCP servers technically (tool design, security posture), since the MCP Vouch finding would come up | Medium — but see security caveat below |
| TBD — requires dedicated research pass | Publications covering AI security | AI security | TBD | The LNES-22 prompt-injection/deterministic-boundary result is a genuine, reproducible AI-security finding | Story C (AI Can Propose, It Should Not Authorize Itself) | Confirm the MCP Vouch score and the retired-contract finding (see MCP_EXTERNAL_SECURITY_REMEDIATION) are resolved or disclosed proactively before pitching a security-focused writer, who would likely find both independently | High, but gated — see note below |
| TBD — requires dedicated research pass | Publications covering AI hardware efficiency | AI hardware efficiency | TBD | The H200 benchmark methodology (baseline, envelope, correct-task definition) is a hardware-efficiency story | Story A | Confirm they engage with methodology/envelope caveats rather than headline multipliers only | Medium |

## Gating note

Do not pitch any AI-security-beat writer, or any MCP-specific writer, before the `exergynet_open_job` / retired-contract finding in `MCP_EXTERNAL_SECURITY_REMEDIATION_2026-08-27.md` is resolved. A security-literate reviewer would very likely find it independently (it is confirmable in under 10 minutes via `npm pack` and public registry data), and finding it themselves after being pitched would be far more damaging than disclosing it first. This is a **hard gate**, not a scheduling preference.

## Outreach sent this pass

**Zero.** No journalist or analyst was contacted. This list exists to be completed and reviewed, not acted on, without separate authorization.
