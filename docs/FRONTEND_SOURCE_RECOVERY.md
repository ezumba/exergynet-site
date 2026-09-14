# Frontend Source Recovery + Deployed Portal Generation (§1–§2)

**Generated:** 2026-09-13. Evidence-only. No fabrication.

## §1 — FRONTEND_SOURCE_STATUS = SOURCE_INCOMPLETE

The Next.js portal **source** (`portal/src/app/**`) exists and is a full App Router
tree (route handlers, `[...nextauth]`, layouts, dashboard/billing/voice/xlmp pages).
It was added in commit **`71acdc0` (2026-05-29) "Add ExergyNet developer portal (Next.js 14)"**.

But its **build definition has never existed in this repository**. Exhaustive search:
- `git rev-list --all --objects` across **every ref, tag, and object**: the only
  `package.json` files ever committed are `intel-console/package.json` and
  `portal/biological_proxy/package.json`. **No `portal/package.json` ever.**
- The only `next.config.*` / `next-env.d.ts` / `tsconfig.json` / lockfiles ever
  committed belong to **`intel-console`** — never `portal/`.
- The `ec2` deploy remote (`portal-deploy.git`, `remotes/ec2/main`) has the same
  two package.json files and **no portal build root** either.
- Working tree (incl. untracked, full depth): no `portal/package.json`, no
  `next.config.*`, no portal lockfile.

**Conclusion:** `portal/src` was copied in as source without its build definition
(package.json, next.config, tsconfig, lockfile). It is recoverable as *source* but
**not as a buildable generation** from this repo, its history, its tags, or the
deploy remote. Per directive §7, we STOP and classify **FRONTEND_SOURCE_INCOMPLETE**
rather than fabricate a new Next project to force a green build.

- `intel-console` IS a buildable Next.js 14.2.35 app (`next dev/build/start/lint`),
  but it is a **separate tool**, not the developer portal.

## §2 — DEPLOYED_PORTAL_GENERATION (best evidence; host confirmation still required)

The `ec2` deploy remote `ssh://ubuntu@…/home/ubuntu/portal-deploy.git` (`ec2/main`)
is a **static HTML site**: `index.html`, `apps.html`, `developers.html`,
`explorer.html`, `main.js`, `assets/`, `CNAME`, `.nojekyll`, plus `portal/` (the
same unbuilt `src/`) and `biological_proxy/`.

Most-consistent reading of the evidence: **portal.exergynet.org is served as a
static HTML/JS site fronting the `biological_proxy` Express API** (port 5000 behind
Caddy). There is **no committed Next.js SSR build** for the portal anywhere in reach.

Two possibilities remain, distinguishable only by inspecting the host:
- **(a)** Production serves the static HTML site + biological_proxy API (no Next SSR).
- **(b)** The Next app is built on the host from a `package.json` that exists only
  on the host filesystem and was never committed.

**REPO** = `github.com/ezumba/exergynet-site` · **committed frontend build root** =
NONE · **backend** = `portal/biological_proxy` (Express, port 5000) · **build cmd** =
(static site: none / Next: not recoverable here) · **deploy remote** =
`portal-deploy.git`.

To resolve (a) vs (b), the operator runs the read-only host commands already
delivered in `docs/PRODUCTION_HOST_CONFIRMATION_RUNBOOK.md`, plus:

```bash
# On the host serving portal.exergynet.org:
ls -la /home/ubuntu/portal* /var/www/* 2>/dev/null
# Is there a Next build/package.json on the host (not in git)?
find /home/ubuntu -maxdepth 3 -name next.config.* -o -maxdepth 3 -path '*portal*/package.json' 2>/dev/null
cat /etc/caddy/Caddyfile 2>/dev/null | sed -n '1,80p'   # does it serve static files or reverse-proxy a Next server?
pm2 list; systemctl list-units --type=service --state=running | grep -iE 'next|portal|node'
```

`FRONTEND_BUILD_ROOT = NOT_IN_REPO` · `DEPLOYED_PORTAL_GENERATION = STATIC_HTML+EXPRESS_API (host confirmation pending for Next-vs-static)`.

## Impact on Day-1

The **backend** deposit path is fully integrated, boots, and passes HTTP integration
tests (see integration-test-results.json). The **frontend deposit UI** cannot be
built or implemented from recoverable source, so the exact release candidate cannot
reach a green production frontend build. Therefore **READY_FOR_WALLET_INJECTION = NO**,
blocked solely by `FRONTEND_SOURCE_INCOMPLETE`. Unblock requires the operator to
provide the portal's real build definition (from the host or the origin repo it was
copied from), or a decision that the deposit UI ships on the static site.
