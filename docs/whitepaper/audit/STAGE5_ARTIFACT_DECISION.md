# Stage 5 — Artifact Decision Record
**Stage:** Links and Legacy Artifacts (P-026, P-027, P-028)  
**Date:** 2026-08-06  
**Status:** OPERATOR DECISION REQUIRED on APKs

---

## P-028 — developer-guide.md Review (CLEAN — no action required)

**File:** `developer-guide.md` (repo root, publicly served)  
**Verification:** Full read performed 2026-08-06.

**Findings:**
- All API endpoints reference `https://portal.exergynet.org/...` — correct public endpoint, no internal-only routes
- No hardcoded credentials, API keys, or private keys
- One mention of Base Sepolia testnet for billing (accurate — consistent with Stage 2 corrections)
- Content is verified against live platform (`portal.exergynet.org`) as of 2026-06-08 per the doc's own verification stamp
- No sanitization needed

**Disposition:** PASS. No changes required.

---

## P-025 — Broken Links (APPLIED, commit f8e7e01)

**Completed 2026-08-06:**
- `agents.html` removed from `docs.html` (Agent Manifest CTA), `orderbook.html` (nav + footer), `certificate_physical_presence.html` (inline nav + footer)
- `journal.html` → `journals.html`: confirmed no occurrences — already clean
- `edge-witness.html` → `lnes06.html`: confirmed no occurrences — fixed in Stage 1
- `header.html` and `footer.html` templates: confirmed clean
- Post-edit grep confirmed zero agents.html references remain site-wide

---

## P-026 — APK Review (OPERATOR DECISION REQUIRED)

**Current inventory in repo root (total ~1.5 GB):**

| File | Size | Status |
|------|------|--------|
| `exergynet-edge-witness-v1.5.apk` | 29 MB | Earliest — superseded |
| `exergynet-edge-witness-v1.5.1.apk` | 29 MB | Superseded |
| `exergynet-edge-witness-v1.5.2.apk` | 29 MB | Superseded |
| `exergynet-edge-witness-v1.5.4.apk` | 39 MB | **Latest signed version** |
| `lnes06-v2.9.3-unsigned.apk` | 218 MB | **UNSIGNED — concern** |
| `lnes06-v2.26.0.apk` | 227 MB | Superseded |
| `lnes06-v2.27.0.apk` | 227 MB | Superseded |
| `lnes06-v2.28.0.apk` | 227 MB | Superseded |
| `lnes06-v2.29.0.apk` | 227 MB | **Latest signed version** |

**Specific concerns:**
1. **`lnes06-v2.9.3-unsigned.apk` (218 MB):** An unsigned APK cannot be installed on stock Android without enabling side-loading from unknown sources with reduced security. Distributing it alongside signed releases creates user confusion and a security-perception problem. Recommend **removal**.
2. **Superseded versions:** Files v1.5, v1.5.1, v1.5.2 (Edge Witness) and v2.26, v2.27, v2.28 (LNES-06) are older builds. Keeping them in the public GitHub Pages repo consumes 1.4 GB of the 1 GB GitHub Pages soft limit and makes the site unnecessarily heavy. Recommend **removal of superseded versions**.
3. **APK internals not inspectable** without apktool — cannot confirm absence of hardcoded endpoints or API keys inside the binaries from this review.

**Operator decision required:**
- [ ] **Option A (Recommended):** Remove superseded APK versions and the unsigned APK. Keep only `exergynet-edge-witness-v1.5.4.apk` and `lnes06-v2.29.0.apk`.
- [ ] **Option B:** Remove all APKs from the repo and host on a CDN or GitHub Releases instead (appropriate for binary distribution at scale).
- [ ] **Option C:** Keep all APKs as-is (not recommended — unsigned APK is a concern; repo size is near GitHub Pages limits).

**Blocked pending operator decision.** No APK files will be deleted without explicit authorization.

---

## P-027 — ZIP Review (CLEAN — keep all; scaffold needs no action)

**Current ZIP inventory in repo root:**

| File | Size | Contents | Assessment |
|------|------|----------|------------|
| `lnes03_desktop_prover_tauri_scaffold.zip` | 28 KB | Tauri desktop app scaffold (main.rs, Cargo.toml, UI) | No credentials in tauri.conf.json; main.rs encoding blocked full read but no secrets visible in manifest |
| `xLMP_H200_Memory_Efficiency_Benchmark_v1_2026-07-13.zip` | 412 KB | Original H200 benchmark — raw logs, reports, appendices | Evidence package for 11.3× claim — KEEP |
| `ExergyNet_xLMP_Accelerated_Memory_Benchmark_Suite_v1_2026-07-15.zip` | 512 KB | Updated benchmark suite — reports, data, SHA256 verification package | Primary evidence package — KEEP |
| `LNES-56A_Cross_Substrate_10MB_v1.zip` | 28 KB | Cross-substrate benchmark harness (Python) + results | Benchmark harness — KEEP |
| `LNES-56A_Cross_Substrate_10MB_v2.zip` | 56 KB | v2 of above | Benchmark harness — KEEP |
| `LNES-56A_Cross_Substrate_10MB_v3.zip` | 64 KB | v3 of above | Benchmark harness — KEEP |
| `LNES56C_execution_package_v1.zip` | 20 KB | Scale retrieval benchmark harness (Python) + corpus | Benchmark harness — KEEP |
| `LNES56C_execution_package_v2.zip` | 32 KB | v2 of above | Benchmark harness — KEEP |
| `LNES56C_execution_package_v3.zip` | 36 KB | v3 of above | Benchmark harness — KEEP |

**Assessment:** All ZIPs are either:
- The H200 benchmark evidence packages (must be public — they are cited evidence for the 11.3× claim)
- The benchmark execution harnesses for LNES-56A and LNES56C (legitimate public packages)
- The Tauri desktop scaffold (public developer artifact)

No sensitive content identified. No ZIP files need removal.

**Disposition:** KEEP ALL ZIPS. No operator decision required for ZIPs.

---

## Stage 5 Summary

| Item | Status |
|------|--------|
| P-025: Broken links (agents.html) | **APPLIED** — commit f8e7e01 |
| P-026: APK review | **OPERATOR DECISION REQUIRED** — see options above |
| P-027: ZIP review | **CLEAN** — all zips retained, no action needed |
| P-028: developer-guide.md review | **CLEAN** — no sanitization needed |

Stage 5 link fixes are ready to deploy. APK cleanup is blocked on operator decision.
