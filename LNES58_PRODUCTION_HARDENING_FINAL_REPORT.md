# LNES-58 Production Hardening — Final Report

Executed from `Status Review.txt` (LNES-58.10/58.11 production-hardening
directive). Production deployment, security-group changes, and the
post-deploy healing loop were explicitly held for live Trustee
confirmation rather than run under the document's own standing
authorization — see "What was NOT done" below for why.

## 1. Starting state

Frozen benchmark evidence: commit `1a69c6c`, tag `lnes58-frozen-evidence-v1`
(LNES-58 through 58.9 complete). LNES-58.10 patch: local commit `305586f`,
audited but not deployed. LNES-58.11: 50/50 sampled production
compatibility PASS already obtained in a prior session turn.

## 2. Frozen evidence commit/tag

`1a69c6c` / `lnes58-frozen-evidence-v1` — confirmed unchanged throughout
this pass (`git diff 1a69c6c -- LNES58_Multihop_Bench/` empty;
`git diff 1a69c6c lnes58-frozen-evidence-v1` empty).

## 3. Compatibility evidence

50/50 sampled objects PASS (N=72 eligible, 2 multi-shard, largest
~262,144,042 bytes / 501 shards). Unchanged from the prior LNES-58.11C
run — not re-executed, per Phase L's own instruction not to reinterpret
historical results after fixing the sampler.

## 4. Sampler limitation

Confirmed: `floor(N/50)=1` for N in (50,100) degenerated to "first 50
sorted objects only" — this specific run (N=72) never touched the last 22
objects. Real, not hypothetical.

## 5. Sampler repair

`verify_production_roots.js`'s `selectSample()` replaced with an
evenly-spaced index method (`round(i·(N-1)/(K-1))`), always including
first and last sorted object, provably duplicate-free for K≤N with K>1.
Regression-tested at N=1,10,49,50,51,72,99,100,137, including a direct
assertion the N=72 case no longer collapses to the old behavior. All 5
local test groups pass (25 assertions across
`probe_local_test.js`/`xlmp_ds_core.integrity.test.ts`/
`xlmp_ds_core.resolver.test.ts` combined). Historical 50/50 result not
reinterpreted.

Also fixed, found while validating the zero-write invocation form from a
prior turn: `resolve_env_var.js` and `verify_production_roots.js` both had
latent bugs specific to the `node -` (stdin-as-source) invocation —
`process.stdin` listeners never firing, and `require.main === module`
being unconditionally false. Both fixed and re-verified end-to-end.

## 6. Exact 305586f audit

`git show 305586f` inspected directly (not taken on narrative). Confirmed:
3 files changed (`xlmp_ds_core.ts`, `xlmp_ds_core.integrity.test.ts` new,
`api/v1/vault/content/route.ts`), +275/-19. `computeXlmpRoot` genuinely
shared between `xlmp_shatter_payload` (ingest) and `xlmp_get_content`
(retrieval) — one implementation, not two kept in sync by convention.
`applyDeterministicSchemaMask` does **not** appear anywhere in this diff —
confirmed absent, not merely assumed absent, per the directive's explicit
warning not to conflate it with this patch.

## 7. Actual production files that would be deployed

`portal/src/lib/xlmp_ds_core.ts`, `portal/src/app/api/v1/vault/content/route.ts`
(both from commit `305586f`; test file is dev-only, not deployed).

## 8. OTET records

None — no OTET apply was run. Deployment (Phase C/D) was not executed
this pass; see "What was NOT done."

## 9. Build/restart results

Not applicable — no deployment attempted.

## 10. Smoke-test results

Not applicable — no deployment attempted. Local test gate results are
item 11.

## 11. Bugs discovered, and each repair

1. **Sampler stride-collapse bug** (item 4/5 above) — fixed, regression-tested.
2. **`resolve_env_var.js` stdin-consumption bug** under the zero-write
   `node -` invocation — fixed by having the script call `pm2 jlist`
   itself via `child_process.execSync` instead of expecting piped stdin.
   Verified end-to-end against a fake `pm2` binary through the real
   invocation form.
3. **`verify_production_roots.js` `require.main` bug** under the same
   invocation — `require.main` is `undefined` when a script's source
   comes from stdin, confirmed directly, so `main()` never ran. Fixed by
   also checking `module.id === '[stdin]'`. Re-verified against the full
   existing test suite (no regression) plus the actual invocation form.
4. **Two Merkle-tree terminology mislabels** found and corrected:
   `xlmp_ds_core.ts`'s stale section comment, and `apiServicesManifest.ts`'s
   public API-doc description of the vault-ingest endpoint. A third
   instance (`vault/page.tsx` UI text) was corrected in the working tree
   but *not* committed separately — see item 16.
5. **`.gitignore` had never been committed** to this repository — its
   protections (including a 2026-07-10 entry protecting internal
   architecture docs) only ever applied to this one local working copy.
   Committed now.
6. **Patent package directory fully untracked, zero gitignore
   protection**, in a public auto-publishing repo. Added protection,
   nothing committed from that directory.
7. **`probe_local_test.js` had a hardcoded personal Windows path**
   (`C:\Users\ezumb\...`) that would have broken for anyone else cloning
   this repo — fixed to a `__dirname`-relative path before committing.

Local test gate (Phase B) run in full: 13 LNES-58.10 integrity tests + 12
resolver regression tests = 25/25 pass. 5 probe-tooling local validation
groups pass. `node --check` clean on all touched `.ts`/`.js` files (`.tsx`
files can't be syntax-checked by bare `node --check` — no local
`tsc`/Next build toolchain exists in this environment, a known,
pre-existing limitation, not something this pass could close). Secret
scan clean on every diff and new file.

## 12. Final production state

**Unchanged from before this pass** — no deployment was executed. Portal's
actual running state was not touched.

## 13. Root algorithm definition (final, corrected terminology)

Ordered aggregate hash over shard digests: `d_i = SHA256(shard_i)`,
`root = SHA256(hex(d_1) || hex(d_2) || ... || hex(d_n))`. Not a Merkle
tree, not usefully called a "hash chain" either (no recursive/incremental
structure — a single aggregate hash over an ordered digest list).

## 14. Verified Membrane Cache definition (final)

"A disk-sourced object is cryptographically verified against its
requested root before admission to the trusted in-memory cache. Once
admitted, the immutable cached payload remains associated with that
verified root. Subsequent mutation of the backing filesystem cannot alter
the cached payload, although such backing-store mutation is not detected
until a later storage read occurs." No claim of continuous disk
monitoring or per-hit re-verification — neither is implemented.

## 15. Architecture roadmap updates

`xLMP_v2_ARCHITECTURE_PROPOSAL.md` extended with Sections 4–7 (Entity
Graph benchmark series X3–X6B, LNES-58.10, LNES-58.11, explicit
production-non-deployment statement). Section 1's original measured
numbers untouched — pure addition, confirmed via diff (148 insertions, 2
deletions, both in the footer note being replaced).

## 16. Production Entity Graph RFC status

Created: `PRODUCTION_ENTITY_GRAPH_RFC.md`. Analysis/design only, no
implementation. Scopes 16 open questions (entity/relation definition,
extraction determinism, ontology ownership, schema versioning, provenance,
confidence, human review, supersession, contradiction handling,
domain schemas, arbitrary-document ingestion, proposal-to-authoritative
promotion, query-independence, root-addressing, migration) plus the one
non-negotiable constraint carried forward from the benchmark work (a
model may propose; it must not silently become authoritative state).

## 17. Patent-package update status

Added `LNES58_SUPPLEMENTAL_DISCLOSURE_NOTE.md` — candidate new-matter
content (11 items) for the August 2026 supplemental provisional, following
the existing package's own note-based convention
(`BENCHMARK_SUPPORT_NOTE.md`). **Did not** draft numbered claims directly
into `04_CLAIMS.md`/`03_SPECIFICATION.md` — that level of legal claim
drafting was judged to need counsel/Trustee review of this note's content
first, unlike the prior LNES-58.9 round which did integrate directly (this
pass's Phase O/P scope was read as "identify and draft candidate
disclosure," not "finalize claims unreviewed"). Preservation snapshot
taken: `PATENT_PRE_LNES58_10_11_SHA256_MANIFEST.txt`.

**Real finding surfaced in that note, not previously flagged anywhere:**
the *already-filed* July 14, 2026 provisional (App 64/111,103) itself
describes the shard-root construction as a "Merkle root" (per
`07_PRIORITY_SUPPORT_NOTES.md` and `PATENT_CLAIM_SUPPORT_MATRIX.md`, both
citing that filing's Claims 1 and 4–5) — but the actual, currently-running
production algorithm confirmed from source is not one. That filing can't
be edited; this is a real disclosure/implementation gap for counsel to
evaluate, not something either this pass or the supplemental note can fix
retroactively.

**Separately, and not requested by the directive:** the entire patent
package directory was found sitting fully untracked in this public,
auto-publishing repository with zero `.gitignore` protection — fixed
(see item 11.6) as a necessary precondition to safely adding any new file
to that directory at all.

## 18. PROJECT_BLOCKERS update

BLK-009 (network-access blocker from the earlier LNES-58.11C session turn)
committed, sanitized per repo convention — no real IPs, security-group
IDs, or CIDRs (verified via grep before committing).

## 19. Security-group cleanup status

**Not attempted.** Per Phase K's own instruction and the standing rule
that modifying security/system settings is not something this agent
performs even under explicit standing authorization — exact commands were
already provided to the Trustee in a prior turn; running them remains the
Trustee's action, not this pass's.

`SECURITY_GROUP_CLEANUP_PENDING_TRUSTEE`

## 20. Local commit list (this pass, newest first)

```
6934009 chore(security): commit .gitignore, add patent-package protection
607a5b6 docs(xlmp): add Production Entity Graph RFC
3a27b08 docs(xlmp): finalize LNES-58 architecture findings through 58.11
cc55806 docs(xlmp): correct Merkle-tree terminology for the ordered-aggregate root
d53ac7d test(probe): fix deterministic population sampling; add production root-compatibility diagnostic
15fa636 docs(security): record BLK-009 resolution
```
(`305586f`, the LNES-58.10 patch itself, predates this pass — included
above in item 6's audit, not re-committed.)

## 21. Push status

Nothing pushed. `main` is 12 commits ahead of `origin/main`. This repo is
public and several commits in that range reference confidential
benchmark/patent-adjacent findings in their messages (though no
confidential file content — the patent package itself was deliberately
never committed). Per Phase T, push requires separate, explicit
authorization and isn't needed for the OTET deployment path even once
deployment is authorized.

## 22. Rollback reference

Not applicable — no deployment occurred, so there is nothing deployed to
roll back. If/when Phase C is separately authorized, the rollback
reference is: the production files' pre-deployment content (obtainable via
OTET's witness-file step, which records a pre-write hash automatically),
plus this local commit history as the source of truth for what changed.

## 23. Remaining blockers

- Security-group cleanup: Trustee action pending (item 19).
- Production deployment of `305586f`: Trustee authorization pending
  (see below).
- `vault/page.tsx`'s Merkle-terminology UI text: fixed locally but
  entangled with unrelated in-progress work in that same file, not
  committed separately.
- Patent supplemental content: needs counsel review before any claims
  drafting; the App 64/111,103 "Merkle root" disclosure gap needs
  independent counsel evaluation.
- Broader repo hygiene (untracked key-shaped files, 47 modified tracked
  files, hundreds of other untracked files) — flagged as a separate,
  out-of-scope background task (`task_f49a7f57`), not investigated or
  touched by this pass beyond the patent-package instance.

## 24. HARD STOP issues

None of the 17 defined hard-stop conditions occurred. No legitimate
production object failed verification, no algorithm migration was needed,
no security control needed disabling, no secret was exposed by this pass's
own actions (the pre-existing exposure risks in items 11.5/11.6 and the
spawned follow-up task were found and partially fixed, not caused, by this
pass).

## 25. Trustee summary

**WHAT CHANGED:** Sampler bug fixed and regression-tested. Two of three
Merkle-terminology mislabels corrected and committed (third fixed in the
working tree, entangled with unrelated work). Architecture roadmap and a
new Production Entity Graph RFC written. Patent supplemental disclosure
note drafted (not integrated as claims). `.gitignore` committed for the
first time ever in this repo's history; patent package and (via a flagged
follow-up) other key-shaped files protected from accidental public
exposure.

**WHAT IS LIVE:** Nothing from this session's LNES-58 work. Production
Portal is unchanged.

**WHAT IS STILL BENCHMARK-ONLY:** The entire Deterministic Entity Graph /
MATCH-NO_MATCH-INCOMPLETE / Negative Resolution Receipt / X6B gate
architecture. No production entity/relation data model exists to attach
it to (`PRODUCTION_ENTITY_GRAPH_RFC.md` scopes that gap).

**WHAT WAS FIXED:** Sampler spanning bug, two stdin-invocation bugs in the
diagnostic tooling, terminology inaccuracies, a real repo-wide gitignore
gap.

**WHAT REMAINS:** Production deployment of `305586f`, security-group
cleanup, counsel review of the patent note, the flagged repo-hygiene
follow-up.

**WHAT REQUIRES TRUSTEE DECISION:**
1. Explicit go-ahead to deploy `305586f` via OTET (Phase C/D/E) — audited,
   tested, and supported by real production compatibility evidence, but
   not deployed under this document's own standing authorization; this
   agent holds production-affecting actions for live confirmation
   regardless of what a directive document says about not asking.
2. Security-group cleanup (item 19) — commands already provided in a
   prior turn.
3. Whether to proceed with the flagged repo-hygiene follow-up
   (`task_f49a7f57`).
