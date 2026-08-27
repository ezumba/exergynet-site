# Website Claim Audit
**Audit:** Pre-White Paper Website Claim Audit — ExergyNet
**Audit date:** 2026-08-05
**Canonical sources:** `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` (v1.2), VAULT_LEDGER.md, EVD-001 through EVD-009, PROJECT_BLOCKERS.md
**Constraint:** READ-ONLY

Classification:
- VERIFIED — claim matches independently-verified canonical fact
- OVERSTATED — claim implies more than the verified state
- UNDERSTATED — claim is more conservative than verified state (generally acceptable)
- FALSE — claim contradicts verified fact
- UNVERIFIED — no evidence found; requires operator confirmation
- REQUIRES_FULL_READ — identified via grep; full page not yet read

---

## index.html

| CLAIM_ID | EXACT QUOTE | PAGE | CLASSIFICATION | CANONICAL FACT / NOTES |
|---------|-------------|------|----------------|------------------------|
| CL-001 | "11.3× Correct-Task Throughput" | index.html | VERIFIED | EVD-001/EVD-002: ~11.3× xLMP vs full-context at equal evidence budget |
| CL-002 | "660–820 Flat Prompt Tokens" | index.html | VERIFIED | EVD-001: xLMP prompt tokens 660–820 as corpus grew 8k–285k tokens |
| CL-003 | "100% Across T4, A10, H200" | index.html | VERIFIED | EVD-001/EVD-002: hardware-independent accuracy maintained across all three GPUs |
| CL-004 | "Exergy Vault · Deployed · Stateful memory objects..." | index.html | VERIFIED | VMN (Vanguard Memory Node) DEPLOYED per canonical paper |
| CL-005 | "vanguard-ultra · Deployed · Bilateral memory consensus" | index.html | VERIFIED | LNES-11: bilateral consensus deployed on AskMo |
| CL-006 | "Sovereign Verifier · Deployed · LNES-04 Membrane V2" | index.html | OVERSTATED | VAULT_LEDGER: current is V5, not V2; also mock — DO NOT ROUTE REAL CAPITAL |
| CL-007 | "AERIS Witness · Deployed · Zk-sealed weather settlement" | index.html | VERIFIED (testnet) | LNES-04 v5 deployed Base Sepolia; mainnet = MOCK. "Deployed" without testnet qualifier is slightly overstated. |
| CL-008 | "Omega Carrier · Deployed · MCP Bridge for AI Agents" | index.html | VERIFIED | Tools 1–5 DEPLOYED per canonical paper |
| CL-009 | "Edge Witness · Deployed · Android Sensor Platform" | index.html | VERIFIED | LNES-06 Android app v2.22.8 DEPLOYED |
| CL-010 | "H200 Benchmark" headline reference | index.html | VERIFIED | EVD-002 confirms H200 testing |
| CL-011 | Link to "journal.html" for benchmark notes | index.html | FALSE (broken link) | File is journals.html |
| CL-012 | Link to "edge-witness.html" | index.html | FALSE (broken link) | File is lnes06.html |
| CL-013 | Link to "agents.html" | index.html | FALSE (broken link) | File not found in repo |

---

## whitepaper.html

| CLAIM_ID | EXACT QUOTE | PAGE | CLASSIFICATION | CANONICAL FACT / NOTES |
|---------|-------------|------|----------------|------------------------|
| CL-020 | Page title: "Sovereign Memory & Verifiable Compute" | whitepaper.html | FALSE (wrong document) | Canonical paper title: "xLMP: The AI Memory Control Plane" |
| CL-021 | "96.0% xLMP accuracy versus 82.6% for tested sparse top-k RAG" | whitepaper.html | UNVERIFIED | Not in EVD-001/EVD-002. Canonical paper says "+24.4 accuracy points at equal evidence budget." |
| CL-022 | LNES-22, NEURO-LOCK, Atlas, VMN: absent | whitepaper.html | FALSE (material omission) | All four are in canonical v1.2 paper |
| CL-023 | Physical AI / FAA / Bolt / NEURO-LOCK: absent | whitepaper.html | FALSE (material omission) | Canonical paper has full Physical AI section |
| CL-024 | Subsystem status table lacks Physical AI systems | whitepaper.html | FALSE (incomplete) | Canonical paper has all Physical AI statuses |

---

## vanguard.html

| CLAIM_ID | EXACT QUOTE | PAGE | CLASSIFICATION | CANONICAL FACT / NOTES |
|---------|-------------|------|----------------|------------------------|
| CL-030 | "5× Faster TTFT vs legacy cloud" | vanguard.html | UNVERIFIED | No evidence in EVD-001/EVD-002 or any evidence file reviewed |
| CL-031 | "~40ms avg TTFT" | vanguard.html | UNVERIFIED | No evidence in any source reviewed |
| CL-032 | "97% lower overhead vs frontier API" | vanguard.html | UNVERIFIED | No evidence in any source reviewed |
| CL-033 | "$0.40 per 1K tokens" pricing vs competitors | vanguard.html | UNVERIFIED | No pricing evidence reviewed; pricing claim requires confirmation |
| CL-034 | "Built on Proprietary Silicon Geometry" | vanguard.html | UNVERIFIED | No custom silicon mentioned in any project record |
| CL-035 | "Zero-Retention Hardware Enclave" | vanguard.html | UNVERIFIED | No TEE/SGX deployment found in any project record |
| CL-036 | "Now in production." | vanguard.html | UNVERIFIED (partially) | Vanguard inference API appears operational but without verified benchmark backing |

---

## omega-carrier.html

| CLAIM_ID | EXACT QUOTE | PAGE | CLASSIFICATION | CANONICAL FACT / NOTES |
|---------|-------------|------|----------------|------------------------|
| CL-040 | "Tools: 5" status | omega-carrier.html | VERIFIED | Canonical paper: Omega Carrier Tools 1–5 DEPLOYED |
| CL-041 | "AERIS: Active" in status card | omega-carrier.html | VERIFIED (testnet) | AERIS WITNESS deployed Base Sepolia |
| CL-042 | "Vault: Active" in status card | omega-carrier.html | VERIFIED | VMN/Vault operational |
| CL-043 | "Autonomous capital routing is staged" | omega-carrier.html | VERIFIED | Canonical paper: full cross-device xLMP transport DESIGNED; ETP Gateway explicitly not connected |
| CL-044 | "vault_recall_state: Returns sealed content with ZK provenance metadata" | omega-carrier.html | OVERSTATED | SHA-256 receipt, not real ZK proof (EVD-009) |

---

## proof.html

| CLAIM_ID | EXACT QUOTE | PAGE | CLASSIFICATION | CANONICAL FACT / NOTES |
|---------|-------------|------|----------------|------------------------|
| CL-050 | LNES-04 contract address = 0x5CFE075149776f4b3cca07a27D4fd85A60BA5e3f | proof.html | FALSE | VAULT_LEDGER: this is the pre-existing mainnet membrane from compromised wallet, access-control unknown. Current LNES-04 v5 mainnet = 0xbb14956a88BaD822Ef38e96fF337a088b41c72be |
| CL-051 | "immutable, independently verifiable proofs" | proof.html | FALSE (given wrong address) | Users are pointed to a contract of unknown access-control state |
| CL-052 | "full sovereign settlement loop" | proof.html | OVERSTATED | VAULT_LEDGER: current v5 mainnet = MOCK — DO NOT ROUTE REAL CAPITAL |

---

## footer.html

| CLAIM_ID | EXACT QUOTE | PAGE | CLASSIFICATION | CANONICAL FACT / NOTES |
|---------|-------------|------|----------------|------------------------|
| CL-060 | "LNES-03 · Solana Mainnet · Live" | footer.html | FALSE | VAULT_LEDGER: Solana program 7BCPpUMBxQMPomsgTaJsQdLEfycNwPWqkQD1Cea4CcCL had 10 consecutive FAILED txs as of 2026-07-28 |
| CL-061 | "LNES-05 · Ghost-Witness · Live" | footer.html | UNVERIFIED | LNES-05 not in canonical claim ledger or white paper LNES table; no deployment evidence found |
| CL-062 | Link to "edge-witness.html" in footer | footer.html | FALSE (broken link) | File is lnes06.html |

---

## ghost-witness.html (partial — via grep)

| CLAIM_ID | EXACT QUOTE | PAGE | CLASSIFICATION | CANONICAL FACT / NOTES |
|---------|-------------|------|----------------|------------------------|
| CL-070 | "© 2026 Ezumba Dynasty Trust · LNES-05 · Base L2" | ghost-witness.html | OVERSTATED (entity) | Canonical entity is "ExergyNet"; trust entity should not be in public copyright |

---

## .well-known/ai-plugin.json

| CLAIM_ID | EXACT QUOTE | PAGE | CLASSIFICATION | CANONICAL FACT / NOTES |
|---------|-------------|------|----------------|------------------------|
| CL-080 | `"description_for_model": "Returns a Groth16 cryptographic proof of execution."` | ai-plugin.json | FALSE | EVD-009: returns SHA-256 receipt. api-integration.html line 936 confirms this explicitly |
| CL-081 | `"description_for_human": "Trustless, Zero-Knowledge verified off-chain compute for AI agents."` | ai-plugin.json | FALSE | Not zero-knowledge verified — SHA-256 content-addressed |

---

## Claims Identified via Grep (REQUIRES_FULL_READ)

The following claims were identified by searching for ZK/proof-related terms across HTML files. Full page reads are required to provide exact quotes and full context.

| CLAIM_ID | FILE | FOUND TERM | LIKELY CLASSIFICATION | ACTION |
|---------|------|------------|----------------------|--------|
| CL-090 | enterprise.html | "ZK-STARK" | REQUIRES_FULL_READ | Likely OVERSTATED — see CRITICAL-004 |
| CL-091 | explorer.html | "ZK-STARK VERIFIED" | REQUIRES_FULL_READ | Likely OVERSTATED (demo labels?) |
| CL-092 | faq.html | ZK/Groth16 terms | REQUIRES_FULL_READ | Likely OVERSTATED |
| CL-093 | docs.html | ZK/Groth16 terms | REQUIRES_FULL_READ | Likely OVERSTATED |
| CL-094 | api-integration.html | ZK terms + accurate disclaimer (line 936) | MIXED — accurate disclosure present | Confirm disclosure is visible; other ZK claims on page need review |
| CL-095 | nodes.html | ZK/Groth16 terms | REQUIRES_FULL_READ | Likely OVERSTATED |
| CL-096 | protocol.html | ZK/Groth16 terms | REQUIRES_FULL_READ | Likely OVERSTATED |
| CL-097 | roadmap.html | ZK/Groth16 terms | REQUIRES_FULL_READ | Classify by whether "planned" or "live" framing |
| CL-098 | security.html | ZK/Groth16 terms | REQUIRES_FULL_READ | Likely OVERSTATED |
| CL-099 | token.html | ZK/Groth16 terms | REQUIRES_FULL_READ | Likely OVERSTATED |
| CL-100 | mcp.html | ZK/Groth16 terms | REQUIRES_FULL_READ | Likely OVERSTATED |
| CL-101 | orderbook.html | ZK/Groth16 terms | REQUIRES_FULL_READ | Likely OVERSTATED |
| CL-102 | lnes06.html | ZK/Groth16 terms | REQUIRES_FULL_READ | Likely OVERSTATED |

---

## Evidence Cross-Reference

| EVIDENCE_ID | CONTENT SUMMARY | PAGES WHERE VERIFIABLE |
|------------|-----------------|----------------------|
| EVD-001 | H200 xLMP vs RAG vs full-context benchmark | index.html (CL-001 to CL-003) |
| EVD-002 | H200 benchmark replication / hardware independence | index.html (CL-010) |
| EVD-006 | LNES-11 = bilateral consensus; GPS numbering collision | index.html (CL-005) |
| EVD-009 | xLMP-DS ZK query = SHA-256 labeled Groth16, not real ZK | ai-plugin.json (CL-080/081), omega-carrier.html (CL-044), all ZK pages |
| VAULT_LEDGER | Contract addresses, Solana failure, mock status | proof.html (CL-050/051/052), footer.html (CL-060) |
