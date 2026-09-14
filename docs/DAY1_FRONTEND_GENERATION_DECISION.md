# Day-1 Frontend Generation Decision (§1)

**Generated:** 2026-09-13. Operator decision (this directive): Day-1 production frontend
is the **existing static portal generation**, not the incomplete Next.js app.

## Classification (frozen)
| Generation | Location | Classification |
|---|---|---|
| **Static portal** (HTML + `main.js` + `style.css` + `assets/`) | repo root (working tree) / `ec2/main` @ `1153d40` (`portal-deploy.git`) | **DAY1_PRODUCTION_FRONTEND** |
| **Next.js app** (`portal/src/**`) | working tree, added 2026-05-29 (`71acdc0`) | **DEFERRED / SOURCE_INCOMPLETE / NON-PRODUCTION** |

## Basis
- `git merge-base HEAD ec2/main` = `1153d40` (= `ec2/main` itself) → **the deployed static
  generation is an ancestor of the current HEAD**. The static site therefore already lives in
  the working tree at repo root (`index.html`, `apps.html`, `main.js`, `style.css`, `assets/`, …),
  evolved forward, alongside the integrated `portal/biological_proxy`.
- The Next.js `portal/src` has **no build definition in any ref/object/tag or the deploy remote**
  (no `package.json`/`next.config`/`tsconfig`/lockfile ever) — unbuildable here. See
  `docs/FRONTEND_SOURCE_RECOVERY.md`.

## Rules for the Day-1 release
- **No code from `portal/src`** enters the Day-1 release. It is excluded from the release artifact.
- The Day-1 deposit UI is implemented **directly in the static generation** as new static files
  (`deposit.html`, `deposit.js`, `deposit.config.js`) — **no Next.js, no build system**.
- `STATIC_FRONTEND_SOURCE = COMPLETE`, `BUILD_SYSTEM = NOT_REQUIRED / STATIC`.
- The static deposit UI is **watch-only on the client**: it holds only the PUBLIC receiving
  address and the user's own wallet signs their own USDC transfer. All crediting is done by the
  already-integrated, authoritative `biological_proxy` backend.
