# xLMP White Paper — Claim Ledger

**Canonical location:** `exergynet/docs/whitepaper/CLAIM_LEDGER.md`
**Governs:** `AI_MEMORY_CONTROL_PLANE.md` (same directory)
**Policy:** `exergynet/LWP_MAINTENANCE_POLICY.md`
**Last updated:** 2026-08-17

Each claim is keyed to an evidence record in `evidence/README.md`.

---

## DEMONSTRATED
*(Reproducible in described test environments; evidence record exists)*

| Claim | Evidence ID | Notes |
|-------|-------------|-------|
| VMN local ingest and BM25 retrieval | EVD-001 | H200 benchmark |
| Root-bound recall, segment-level integrity | EVD-001 | H200 benchmark |
| SHA-256 content root derivation and independent verification | EVD-001 | |
| xLMP prompt tokens ~660–820 flat as corpus grew 8k → 285k tokens | EVD-001 | H200 environment |
| Full-context tokens grew 11k–67k, rejected past 262k | EVD-001 | H200 environment |
| xLMP +24.4 accuracy points over tested RAG implementation | EVD-001 | At equal evidence budget |
| xLMP ~11.3× correct-task throughput vs full-context | EVD-001 | Best sustainable operating point |
| xLMP ~1.7× correct-task throughput vs RAG | EVD-001 | Best sustainable operating point |
| xLMP ~42.7× token efficiency vs full-context (Useful Answer per Token) | EVD-002 | Common-support, apples-to-apples |
| xLMP ~4.0× token efficiency vs RAG (Useful Answer per Token) | EVD-002 | |
| Chunk-boundary fragmentation correction in VMN | EVD-001 | Documented root cause, per-row evidence |
| Morphological normalization improvement in VMN | EVD-001 | |
| 64k accuracy dip has confirmed root cause (chunk-boundary record fragmentation) | EVD-002 | Not vague scale decline |
| Async Groth16 proof path (`/api/xlmp/prove`) completes a real proof for a minimal Vault object | EVD-011 | Verified end-to-end on the deployed Portal CPU host: real 256-byte non-placeholder Groth16 seal, ~13.5 minutes, for one minimal test object. Validates the dual-path split (SHA-256 hot path / async Groth16 cold path); does not validate production-scale reliability, GPU/Bonsai-accelerated proving, or on-chain settlement. |
| A100/TPU v6e R6 cross-accelerator scaling observed under tested methodology | EVD-012 | A100: 1.41x / 1.92x / 2.63x at 8k/16k/24k tokens. TPU v6e: 0.945x / 1.118x / 1.375x at same scales, with runtime-shim and non-monotonic TPU full-context accuracy caveats preserved. Separate benchmark family from H200. |
| LNES-84 Compact/Deterministic Index correctness and robustness checks | EVD-013 | Sealed suite reports zero observed failures across tested concurrency, mutation, restart/recovery, corruption-detection, and authority-boundary checks. Performance is workload-dependent: 52,753.8x median in the narrow 1GB/100-query pass, but 0.72x aggregate median in the later realistic mixed-vault pass. No universal O(1) or universal speedup claim. |
| LNES-86 adaptive workload-aware retrieval routing within tested workload | EVD-014 | Sealed holdout reports approximately 1.92x vs legacy always-full-scan and approximately 1.13x vs static compact-index-only within the tested workload. Mechanism remains trade-secret controlled; no general-purpose multiplier claimed. |

## DEPLOYED
*(Operationally active; independently verified)*

| Claim | Evidence ID | Notes |
|-------|-------------|-------|
| Biological Proxy multi-model inference routing | EVD-006 | AskMo TypeScript 3500+ lines |
| LNES-11 bilateral consensus (vanguard-ultra) in biological_proxy | EVD-006 | Deployed on AskMo |
| OTET API-only write gate with shell gate enforcement | — | CLAUDE.md / portal EC2 |
| LNES-22 Ed25519 signing and portal-side verification restored | EVD-004 | Sensory trigger + review endpoint |
| LNES-22 replay/expiry enforcement and schema validation | EVD-004 | §IV of architecture doc |
| LNES-06 Edge Witness Android platform (v2.22.8 versionCode 247) | EVD-005 | GPS, NFC, BLE, acoustic, optical, LiveKit |
| LNES-12 LiveKit/coturn WebRTC calling layer (Carrier EC2) | EVD-007 | Cross-network video confirmed |
| Omega Carrier Tools 1–5 (SSE MCP toolset, port 8765) | EVD-008 | Tools 1–5 REAL |
| On-chain settlement contracts (Base mainnet, August 2026) | — | VAULT_LEDGER.md |
| NEURO-LOCK: disclosed in FAA operating documentation for Bolt | EVD-003 | Exemption No. 26214 |
| VSG HL 01 Bolt: FAA Exemption No. 26214, MTOW 275 lbs | EVD-003 | Docket FAA-2025-5731 |
| VMN v2.0.0 npm publication and source synchronization | EVD-015 | `@lnes/vanguard-memory-node@2.0.0` published 2026-08-17 and source-synchronized to GitHub; adaptive deterministic retrieval is enabled, with internal decision mechanics withheld. |

## STAGED
*(Implemented and tested in isolation; not yet connected to production path)*

| Claim | Evidence ID | Notes |
|-------|-------------|-------|
| LNES-22 deterministic policy gate module | EVD-004 | Implemented; not wired to execution |
| Omega Carrier Tool 6 strike_rho_recursion HITL gate | EVD-008 | Math correct; siphon swap signal not wired |
| Delegation receipt specification | — | Spec complete; implementation pending |
| Procurement deterministic graph/entity/policy-state resolver (LNES-82D.4–D.5) | — | Offline-only, real, zero-regression improvement: full evidence recall 46%→60% across 4 arms (100 real LNES-59 cases). Remains below the 85% cloud gate (`LNES82D5_HALT_BELOW_CLOUD_GATE`) — not cloud-validated, no LLM in the loop yet. Remaining failure classes: naive-retrieval misses on transactional documents, content-equivalent policy records under distinct IDs (an evaluation-methodology question, not yet resolved). |
| Async Groth16 proof path — connection to synchronous query hot path / production-scale operation | EVD-011 | The proof path itself is verified (see DEMONSTRATED); it is not wired into the synchronous query response, has been run exactly once against one minimal object, and has not been tested under concurrent load, larger documents, or repeated runs. |

## DESIGNED
*(Architecture documented; implementation not yet complete)*

| Claim | Evidence ID | Notes |
|-------|-------------|-------|
| Atlas geospatial routing layer | — | No deployed engine found in project record |
| GPS-independent positioning layer [LNES number TBD] | — | Not yet assigned; LNES-11 is occupied (bilateral consensus) |
| NEURO-LOCK full cryptographic authorization chain | EVD-003 | Architecture described; production actuation NOT CLAIMED |
| Omega Carrier cross-device xLMP memory transport | EVD-008 | Distinct from deployed Tools 1–5 MCP toolset |

## PLANNED
*(On technical roadmap; not yet designed in detail)*

| Claim | Evidence ID | Notes |
|-------|-------------|-------|
| Production-scale ZK proof verification (Groth16 integrated into the synchronous query path, or run reliably at volume) | EVD-009, EVD-011 | The synchronous ZK query still returns a SHA-256-labeled Groth16 receipt, not a real proof (EVD-009). The separate async Groth16 path is now verified for one minimal object (EVD-011, see STAGED/DEMONSTRATED) — this row covers what remains: production-scale reliability, concurrent-load behavior, and any synchronous integration, none of which is claimed. |
| Durable replay protection for authority gate | — | Currently in-memory |
| Enterprise memory namespaces | — | |
| Independent benchmark replication | — | Companion publication in preparation |
| Open memory interface standard contribution | — | |
| VMN v1.2 sharded incremental index | — | Superseded by VMN v2.0.0 public status; historical row retained for provenance. |

## NOT CLAIMED
*(Explicitly excluded from current capability set)*

| Claim | Reason |
|-------|--------|
| ZK proof verification integrated into the synchronous Vault query path | The hot-path xLMP-DS ZK query still returns a SHA-256 hash dressed as Groth16, unchanged by EVD-011 (EVD-009) |
| Every Vault query is ZK-proven | Only the separate, explicit, opt-in async path (`/api/xlmp/prove`) produces a real proof; the default query path does not (EVD-009, EVD-011) |
| Async Groth16 proving verified at production scale, under concurrent load, or as a general reliability guarantee | EVD-011 is a single run against one minimal (98-byte) test object |
| On-chain settlement verified from the EVD-011 proof run | No contract call was made or checked as part of that verification |
| ~13.5 minutes is a universal or hardware-independent lower bound on Groth16 proving time | EVD-011 measured the currently-deployed CPU-only configuration; GPU, Bonsai, or other accelerated proving paths were not evaluated and are not claimed to be unable to improve on it |
| Groth16 proving latency is unoptimizable or solvable only by future hardware | Not evaluated — EVD-011 verified today's deployed CPU path only, not the space of possible optimizations |
| Fully operational cryptographic actuation loop for Bolt | Full NEURO-LOCK authorization chain not production-deployed (EVD-003) |
| FAA certification of NEURO-LOCK | FAA reviewed operating documentation; no technical certification claimed |
| FAA certification of xLMP | Not submitted for FAA certification |
| FAA endorsement of ExergyNet | No endorsement claimed |
| xLMP-DS reviewed by name in FAA submission | Not confirmed from docket; omitted pending docket retrieval |
| Complete corpus coverage in benchmark results | Corpus fit within H200 test window; past 262k full-context rejected |
| Full LNES-22 authority loop closure in production | Reverse tunnel on port 3000 broken; policy gate not wired to execution |
| "vanguard-pro" remote engine (20.127.234.125:50052) operational | Live-verified 2026-08-10: engine is reachable and online (not unreachable), but silently falls back to CPU inference — GPU OOM, T4 shared with a co-located workload leaves insufficient free VRAM for the model. Public API still defaults "vanguard-pro" requests to vanguard-standard. Tracked as BLK-012 in PROJECT_BLOCKERS.md; blocked on new GPU procurement. |
| VMN/BM25-indexed retrieval as an improvement over xLMP's current (`xlmp_ds_core.ts`) linear-scan retrieval | Evaluated locally (LNES-84.2, 2026-08-15): VMN was ~18×–98× slower than the current linear scan at 20–164 document procurement-corpus scale; evidence recall not consistently better (required invariant not met at every scale tested). Remains an open large-scale/crossover research question, not a validated advancement. No historical "LNES-84" advancement was found on record (LNES-84.1); VMN was evaluated only as a new forward-looking candidate, not as that missing artifact. |
| Universal O(1) retrieval or universal Compact Index speedup | EVD-013 verdict is workload-dependent; mixed-vault result is 0.72x aggregate median. |
| LNES-86 as a general-purpose production multiplier or disclosure of routing mechanics | EVD-014 public claim is limited to tested-workload behavior; internal mechanics remain trade-secret controlled. |

---

## Open Items Requiring Owner Action

| Item | Action | Owner |
|------|--------|-------|
| FAA docket FAA-2025-5731 exact NEURO-LOCK language | Retrieve and add source note to Section 30.1 | Seven Ezumba |
| Legal entity name confirmation ("ExergyNet" vs. "ExergyNet Corp" vs. other) | Confirm against public filings | Seven Ezumba |
| Veena co-author acceptance (4 conditions) | Independent confirmation required | Bontu Veena |
| Phone co-author acceptance (4 conditions) | Independent confirmation required | Kyaw Phone |
| Veena QPS 10–45 intermediate saturation results | Needed to pin saturation knee precisely | Bontu Veena |
| GPS-independent positioning LNES number | Assign correct LNES number (LNES-11 is occupied) | Seven Ezumba |
| LNES-22 port 3000 tunnel root cause | Decide: move to 3009 or fix port 3000 | Seven Ezumba |
