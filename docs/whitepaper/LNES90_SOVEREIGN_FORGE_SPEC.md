# LNES-90 Phase 5 — X-Forge: Exergenic Native Prover Architecture

**Status:** BLUEPRINT — not yet implemented  
**Date:** 2026-09-06  
**Replaces:** snarkjs@0.7.6 FFLONK pipeline (Gate-1 result: architecturally incapable)

---

## 1. Motivation

Gate-1 of LNES-90 established a definitive architectural measurement: the
snarkjs@0.7.6 FFLONK setup phase crashes with `std::bad_alloc` (SIGABRT) at
5,000,000 / 7,668,964 R1CS constraints on a 256 GiB host with 248 GiB RAM
available. Peak RSS at crash: 20.1 GiB. Wall time: 2m34s.

This failure is not a resource problem. It is a design ceiling: snarkjs's
`ffjavascript` native layer uses WebAssembly with 32-bit linear memory
addressing. No single WASM instance can address more than 4 GiB regardless
of host memory. At approximately 5M constraints the WASM heap is exhausted
and new allocations fail unconditionally.

**X-Forge** eliminates the WASM dependency entirely. It targets the same
7,668,964-constraint circuit with direct 64-bit OS memory allocation, native
parallelism across 32+ cores, and R1CS/ceremony file formats compatible with
the existing toolchain.

---

## 2. Scope

X-Forge covers the **setup → prove → verify** pipeline for FFLONK on BN-254
(bn128) circuits, replacing the snarkjs CLI for circuits where snarkjs's WASM
layer is the binding constraint.

Out of scope for this blueprint:
- R1CS compilation (Circom toolchain unchanged)
- Witness generation (snarkjs witness generator, or native WASM witness)
- On-chain verifier deployment (EVM-compatible Solidity verifier export is
  an output artifact, not an in-scope component)
- Gate-2 batching (100-query) — separate work item

---

## 3. Language and Dependency Policy

| Layer | Choice | Rationale |
|---|---|---|
| Implementation language | Pure Rust (stable, 2021 edition) | Memory safety, zero-cost abstractions, native 64-bit |
| EC arithmetic | `ark-bn254` (arkworks-rs) | Audited BN-254 implementation, no WASM |
| Polynomial arithmetic | `ark-poly` | NTT-ready polynomial types over `ark-bn254::Fr` |
| KZG commitments | `ark-poly-commit` | Compatible with arkworks EC types |
| Finite field ops | `ark-ff` | Consistent with arkworks dependency tree |
| Parallelism | `rayon` | Work-stealing thread pool; targets 32+ vCPUs |
| Large file I/O | `memmap2` | OS-managed mmap; sidesteps user-space buffer limits |
| Binary I/O | `byteorder` | Endian-correct binary parsing |
| Serialization | `serde` + `serde_json` | Verification key and proof export |
| CLI | `clap` v4 | Subcommand interface (setup / prove / verify) |

**Zero JavaScript. Zero WebAssembly. Zero Node.js.**

Optional C++ path (if required by MSM performance benchmarks): generate
field arithmetic via `ffiasm` and call via `unsafe extern "C"` FFI. This
adds a C toolchain dependency but removes it from the critical hot path.
The pure-Rust arkworks path is the baseline; the ffiasm path is a
performance escape hatch.

---

## 4. Memory Architecture

### 4.1 Addressing model

All allocations use the 64-bit virtual address space of the host OS directly.
There is no intermediate WASM linear memory layer. The binding constraint
becomes physical RAM + swap, not a 4 GiB WASM ceiling.

Target: monolithic R1CS matrix loading for a 7,668,964-constraint, 1.4 GiB
R1CS file with peak working set estimated at 50–100 GiB for setup.

### 4.2 R1CS loading

The R1CS binary is opened via `memmap2::MmapOptions::map()`. The kernel
pages in sections on demand; the process need not allocate the full 1.4 GiB
upfront. Constraint sections are streamed into the in-memory representation
in chunks, allowing the allocator to manage working set size.

### 4.3 ptau (ceremony) file loading

The `pot23_final.ptau` (9.1 GiB) is similarly mmap'd. Sections required for
setup (tauG1, tauG2, alphaTauG1, betaTauG1, betaTauG2) are accessed by
offset rather than fully buffered.

### 4.4 zkey output

The output zkey is streamed to disk section-by-section. No requirement to
hold the full zkey in RAM simultaneously with the R1CS.

---

## 5. Parallelism Model

### 5.1 NTT / FFT

The Number Theoretic Transform (NTT) over `ark-bn254::Fr` is the dominant
cost in both setup and prove phases. Parallelization target: all available
cores via `rayon::iter::ParallelIterator`.

Reference implementation: arkworks `ark-poly::domain::Radix2EvaluationDomain`
already exposes a parallel FFT via rayon. X-Forge uses this directly; manual
NTT is a fallback only if the arkworks implementation proves insufficient.

### 5.2 MSM (Multi-Scalar Multiplication)

The MSM over BN-254 G1 and G2 is the second dominant cost. Strategy:
Pippenger's algorithm with bucket size tuned to the scalar count.

`ark-ec` provides `VariableBaseMSM::msm()` with a parallel Pippenger
implementation. X-Forge targets this path and benchmarks against the
window-NAF baseline.

### 5.3 Thread pool sizing

`rayon::ThreadPoolBuilder::new().num_threads(N)` where N defaults to
`std::thread::available_parallelism()`. On a 32-vCPU host this pins to 32
threads. No manual pinning or NUMA-aware allocation in Phase 1.

---

## 6. FFLONK Protocol Implementation

FFLONK (Fast Folded Lookup Optimized with Novel Kzg) reduces verifier work
by combining multiple polynomial evaluations into a single KZG opening.
The implementation follows the Polygon Hermez FFLONK paper:

**Setup (key generation):**
1. Parse R1CS into constraint matrices A, B, C.
2. Encode constraints as QAP polynomials over the evaluation domain of
   size ≥ 7,668,964 (next power of 2 = 2^23 = 8,388,608).
3. Compute KZG commitments to A(x), B(x), C(x), and all selector
   polynomials using the ptau's tauG1 / tauG2 series.
4. Serialize proving key (zkey) and verification key to disk.

**Prove:**
1. Load witness (WTNS binary, 234 MB).
2. Compute witness polynomial W(x).
3. Compute quotient polynomial T(x) = (A·B - C) / Z_H(x).
4. Sample random challenges via Fiat-Shamir (Poseidon or Keccak).
5. Open all polynomials at challenge points via KZG.
6. Output proof JSON compatible with snarkjs verification key format.

**Verify:**
1. Load verification key JSON.
2. Reconstruct linearization polynomial commitments.
3. Execute pairing check: e(π₁, G₂) = e(π₂, τ·G₂).
4. Return ACCEPT / REJECT.

**Negative control:** Mutate one public input and assert REJECT. This
mirrors the snarkjs negative control protocol in Gate-1.

---

## 7. Compatibility Contracts

| Artifact | Format | Compatible with |
|---|---|---|
| R1CS input | snarkjs binary R1CS (section-based) | Existing `test_lnes90_fibonacci_wrapper_n256.r1cs` |
| ptau input | snarkjs binary ptau (section-based) | `pot23_final.ptau` (locally generated, SHA verified) |
| Verification key output | `verification_key.json` (snarkjs schema) | EVM verifier template, snarkjs verify |
| Proof output | `proof.json` (snarkjs schema) | snarkjs verify, downstream EVM verifier |
| Solidity verifier | snarkjs-compatible template | EVM deployment |

The goal is drop-in compatibility: a proof produced by X-Forge can be
verified by the `snarkjs fflonk verify` CLI and by an EVM-deployed Solidity
verifier generated from the same verification key.

---

## 8. CLI Interface

```
x-forge setup  --r1cs <path> --ptau <path> --zkey <path>
x-forge prove  --zkey <path> --wtns <path> --proof <path> --public <path>
x-forge verify --vkey <path> --proof <path> --public <path>
x-forge export vkey  --zkey <path> --out <path>
x-forge export solidity --vkey <path> --out <path>
```

All phases emit `/usr/bin/time -v`-compatible instrumentation: wall clock,
peak RSS, CPU utilization. Gate-1 pipeline script (`run_fflonk_gate1.sh`)
can substitute `x-forge` for `snarkjs fflonk` with path changes only.

---

## 9. Development Phases

| Phase | Milestone | Gate condition |
|---|---|---|
| P1 — R1CS loader | Parse snarkjs R1CS binary; dump constraint count | constraint count == 7,668,964 |
| P2 — ptau loader | Parse tauG1/tauG2 sections; spot-check first 10 points | matches snarkjs debug output |
| P3 — NTT smoke test | FFT over BN-254 Fr; round-trip IFFT == identity | test vector from arkworks |
| P4 — MSM smoke test | Pippenger MSM with known scalars/bases | matches reference output |
| P5 — Setup end-to-end | Produce zkey for a 64-constraint test circuit | snarkjs verify accepts proof from test circuit |
| P6 — Full setup | Produce zkey for 7,668,964-constraint circuit | exits 0; wall time and peak RSS recorded |
| P7 — Prove + Verify | Full Gate-1 pipeline: proof + positive verify + negative control | POSITIVE_PROOF_VERIFY=PASS, NEGATIVE_CONTROL=REJECTED |
| P8 — Solidity export | EVM verifier contract | forge test passes against exported verifier |

P5 (small circuit) precedes P6 (production circuit) to allow protocol
correctness validation before committing to multi-hour setup runs.

---

## 10. Known Risks and Open Questions

| Risk | Mitigation |
|---|---|
| arkworks FFLONK protocol coverage | arkworks has Groth16 and PLONK natively; FFLONK is not a first-class citizen. Protocol implementation is from-scratch against the paper. Risk: polynomial encoding differences vs snarkjs. Mitigation: P5 cross-validation with snarkjs on a small circuit before full-scale run. |
| ptau section parsing | snarkjs ptau format is underdocumented. Mitigation: compare section offsets against snarkjs source (cli.js / powersoftau.js). |
| KZG point consistency | snarkjs and arkworks may use different affine/projective conventions or endianness. Mitigation: parse and dump first 10 G1 points from ptau in both tools; compare hex. |
| MSM performance | Pippenger in arkworks may not saturate 32 cores as efficiently as ffiasm-generated code. Mitigation: benchmark P4; introduce ffiasm FFI path if MSM is the bottleneck and wall time is unacceptable. |
| Setup RAM headroom | Estimated 50–100 GiB peak for full setup. A 128 GiB host may be sufficient; a 256 GiB host is safe. Verify against P6 measurement before selecting Gate-2 proving VM spec. |

---

*ExergyNet / LNES-90 / EDT Architecture*  
*Blueprint only — no implementation artifacts exist as of this document.*
