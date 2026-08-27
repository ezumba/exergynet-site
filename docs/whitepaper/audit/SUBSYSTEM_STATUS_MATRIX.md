# Subsystem Status Matrix
**Audit:** Pre-White Paper Website Claim Audit — ExergyNet
**Audit date:** 2026-08-05
**Source of truth:** `docs/whitepaper/AI_MEMORY_CONTROL_PLANE.md` (v1.2 Internal Co-Author Review Draft)
**Constraint:** READ-ONLY — no status changes made

Status vocabulary:
- DEPLOYED: live, independently verified
- STAGED: complete but not publicly active
- IMPLEMENTED: built, not deployed
- DESIGNED: architecture defined, not built
- BLOCKED: blocker recorded in PROJECT_BLOCKERS.md
- PARTIAL: some components at this status, others at lower status
- MOCK: present but explicitly not production-safe

---

## Core xLMP Subsystems

| LNES | NAME | CANONICAL STATUS | PUBLIC WEBSITE STATUS | DISCREPANCY |
|------|------|-----------------|----------------------|-------------|
| LNES-04 | AERIS WITNESS Membrane | DEPLOYED (Base Sepolia v5) / MOCK (Base Mainnet) | proof.html: implies DEPLOYED mainnet; lists compromised-wallet address | CRITICAL mismatch — see CRITICAL-002 |
| LNES-06 | Edge Witness Android | DEPLOYED (com.exergynet.myapplication v2.22.8 versionCode 247) | index.html: "Deployed · Android Sensor Platform" | VERIFIED |
| LNES-11 | Bilateral Consensus (vanguard-ultra) | DEPLOYED (AskMo EC2; TypeScript biological_proxy) | index.html: "Deployed · Bilateral memory consensus" | VERIFIED |
| LNES-12 | WebRTC Media Layer | DEPLOYED (LiveKit SFU + coturn on Carrier EC2 3.234.120.103) | Not prominently mentioned on public site; voice.html UNREAD | UNDERSTATED on public site |
| LNES-13 | AERIS Guest Circuit (zkTLS Prover) | DESIGNED / PARTIAL implementation in repo | Not prominently claimed as deployed | ACCEPTABLE — not overclaimed |
| LNES-17 | Journal Weld (xLMP Integrity Circuit) | DEPLOYED (0x013a6b72...0b538cb, Base Sepolia) | Not prominently mentioned on public site | ACCEPTABLE — not overclaimed |
| LNES-22 | Authority Control Plane | PARTIAL (see component breakdown below) | whitepaper.html: NOT MENTIONED AT ALL | CRITICAL omission from public paper |
| LNES-90 | FRI Verifier Circuit | PARTIAL (one-query validated; 100-query BLOCKED BLK-003/BLK-004) | ZK-STARK claims on 12+ pages without this nuance | HIGH mismatch — see CRITICAL-004 |

### LNES-22 Component Breakdown (canonical)

| COMPONENT | STATUS |
|-----------|--------|
| Ed25519 signing | DEPLOYED |
| Sensory trigger | DEPLOYED |
| Reverse tunnel (port 3000) | BROKEN |
| Policy gate | STAGED |
| Delegation receipts | DESIGNED |
| Durable replay | NOT YET |

---

## Infrastructure Subsystems

| SUBSYSTEM | CANONICAL STATUS | PUBLIC WEBSITE STATUS | DISCREPANCY |
|-----------|-----------------|----------------------|-------------|
| VMN (Vanguard Memory Node) | DEPLOYED — local open-source xLMP | Listed as "Deployed" on index.html | VERIFIED |
| Omega Carrier Tools 1–5 (SSE MCP port 8765) | DEPLOYED | omega-carrier.html: "Tools: 5" | VERIFIED |
| Omega Carrier full cross-device xLMP transport | DESIGNED | omega-carrier.html: "autonomous capital routing is staged" | ACCEPTABLE (slightly different vocabulary) |
| Vanguard Inference API | DEPLOYED (operational) | vanguard.html: benchmark claims UNVERIFIED | HIGH — benchmarks unsubstantiated |
| ETP Gateway | STAGED (mock signing only, port 8200, not connected to auditor) | Listed on omega-carrier status card | UNDERSTATED on site (appears more complete) |
| LNES-03 (Solana Mainnet) | FAILING (10 consecutive failed txs as of 2026-07-28) | footer.html: "Live" | FALSE — see HIGH-002 |
| LNES-05 (Ghost-Witness) | UNVERIFIED — not in canonical claim ledger | footer.html: "Live" | UNVERIFIED — see HIGH-003 |
| rpc.exergynet.org | DOWN since 2026-08-01 (disk full, BLK-001) | No site disclosure found | MISSING public notice |

---

## Physical AI Subsystems

| SUBSYSTEM | CANONICAL STATUS | PUBLIC WEBSITE STATUS | DISCREPANCY |
|-----------|-----------------|----------------------|-------------|
| NEURO-LOCK (cryptographic actuation chain) | DESIGNED | Absent from all website pages | ACCEPTABLE — not yet publication-ready; absent is correct |
| Atlas (routing engine) | DESIGNED | Absent from all website pages | ACCEPTABLE — not yet publication-ready |
| Bolt (sovereign OS) | DESIGNED | Absent from all website pages | ACCEPTABLE — not yet disclosed |
| FAA Exemption 26214 (Docket FAA-2025-5731) | DEPLOYED (legal/regulatory) | Absent from all website pages | ACCEPTABLE — internal until white paper publishes |

---

## ZK Proof Status (critical category)

| PROOF_COMPONENT | CANONICAL STATUS | PUBLIC WEBSITE STATUS | DISCREPANCY |
|----------------|-----------------|----------------------|-------------|
| AERIS WITNESS Groth16 (LNES-04 v5) | DEPLOYED Base Sepolia | proof.html: implied deployed mainnet | OVERSTATED — testnet only; mainnet MOCK |
| Vault ZK Query | SHA-256 receipt (not real ZK) | ai-plugin.json: "Groth16 proof of execution"; 12+ pages: "ZK-STARK" | FALSE — see CRITICAL-001, CRITICAL-004 |
| LNES-90 FRI verifier | 1-query validated; 100-query BLOCKED | ZK-STARK claimed on 12+ pages | OVERSTATED |
| FFLONK | BLOCKED (BLK-004, needs ≥64GB RAM) | ZK-STARK claimed on 12+ pages | OVERSTATED |
| LNES-17 Journal Weld | DEPLOYED Base Sepolia | Not prominently featured | ACCEPTABLE |
