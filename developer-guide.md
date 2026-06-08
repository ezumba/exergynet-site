# ExergyNet — External Developer Guide

> The honest, end-to-end guide to shipping an app on the ExergyNet App Store.
> Everything here is verified against the live platform (`portal.exergynet.org`),
> not aspirational. Where the platform does **not** do something, it says so plainly.

---

## 0. The one thing to understand first

**ExergyNet is a distribution + identity + billing layer, not an app host or backend.**

- **You host your own app** at an `https://` URL. ExergyNet embeds it in an iframe.
- ExergyNet provides: **user identity, entitlement (who paid), billing (subscriptions + pay-per-use), transactional email, and webhooks.**
- ExergyNet does **NOT** provide: a database, key-value store, file storage, realtime/websockets, or background jobs. **If your app needs persistence or realtime (e.g. a shared calendar, chat, RSVP), you bring your own backend.** Point `app_url` at it. (This is the #1 thing that surprises new developers — there is no platform KV.)

Think of it like publishing a web app to an app store that also handles sign-in and payments for you, while your app's data and logic live on your own server.

---

## 1. Get an account + token

Self-serve, no provisioning needed.

```bash
# 1) Register (use any email you control)
curl -X POST https://portal.exergynet.org/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@yourco.com","password":"<pick-a-password>"}'
# -> { "api_key": "<KEEP THIS>", "api_key_preview": "...", "note": "..." }
```

Save the `api_key` — it's shown once. Then mint a bearer token (`EN_TOKEN`):

```bash
# 2a) From email + password
curl -X POST https://portal.exergynet.org/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@yourco.com","password":"<password>"}'
# -> { "token": "<EN_TOKEN>" }

# 2b) Or from email + api_key (headless / CI)
curl -X POST https://portal.exergynet.org/auth/api-token \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@yourco.com","api_key":"<api_key>"}'
# -> { "token": "<EN_TOKEN>", "expires_in": ... }
```

`EN_TOKEN` is an **HS256 JWT signed with a server secret** — you **cannot verify it offline** (no JWKS). To check identity/entitlement, call the API (see §5). Tokens expire; re-mint as needed.

**Portal UI:** sign in at `https://portal.exergynet.org` → **API Keys** to view/rotate your key, and **App Store** to manage listings (see §7).

---

## 2. Publish (register your app listing)

One call. Idempotent on `app_key` — re-POST to update any field. Every publish re-enters review.

```bash
curl -X POST https://portal.exergynet.org/api/apps/publish \
  -H "Authorization: Bearer $EN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "app_key": "huddle",
    "name": "Huddle",
    "app_url": "https://huddle.yourco.com",
    "description": "A shared calendar for any team — admins schedule, members RSVP.",
    "category": "Productivity",
    "tags": ["team","calendar","rsvp"],
    "icon_url": "https://yourco.com/huddle-icon.svg",
    "price_usd": 0
  }'
```

### Fields

| Field | Key | Type / limit | Notes |
|---|---|---|---|
| App key | `app_key` | 3–40, `[a-z0-9_]` | **Permanent identity.** Hyphens/invalid chars stripped. Pick once. |
| Name | `name` | string ≤ 80 | **Required.** |
| App URL | `app_url` | `https://` URL ≤ 300 | Where your app is served (loaded embedded). **Only check is `https://`** — no allow-list. |
| Description | `description` | ≤ 300 | One-line tagline on the card. Keep ≥ 10 chars or review flags it. |
| Category | `category` | ≤ 40 | e.g. `Productivity`, `Legal`, `Finance`. |
| Tags | `tags` | string[], **max 4**, each ≤ 24 | Extra tags dropped. |
| Icon | `icon_url` *or* `icon` | image URL ≤ 300 · or glyph ≤ 8 | `icon_url` (image) wins; `icon` is the emoji/glyph fallback. |
| Price (sub) | `price_usd` | 0–9999 | > 0 ⇒ monthly subscription. |
| Price (usage) | `usage_price_usd` | 0–9999 | > 0 ⇒ pay-per-use (metered). |

### Tier is derived from price — there is no `tier` key

| Want | Send | Tier |
|---|---|---|
| Free | `price_usd: 0` | `free` |
| Pay-per-use | `price_usd: 0`, `usage_price_usd: <n>` | `metered` |
| Subscription | `price_usd: <n>` | `subscription` (monthly) |

> **Tiers = separate `app_key`s.** There is no "plans on one key" concept. Model `pro`/`team` as `myapp_pro`, `myapp_team`, each its own listing. One publisher can own unlimited app_keys; each earns independently.

---

## 3. Review & approval — what actually happens (set expectations)

Publishing does **not** make you live. The arc is:

```
publish  ->  review_status = pending_review   (active = FALSE)
         ->  Vanguard content scan (automated, ~seconds–1min)
               • code checks: https app_url, price bounds, description length
               • content check: deceptive/abusive/contradictory claims
         ->  review_status = vanguard_clean  (cleared)  OR  flagged
         ->  an ExergyNet admin approves      (active = TRUE)  -> LIVE in public store
```

- Your app is **invisible in the public store until `active = true`.** This is by design.
- You can watch status anytime: `GET /api/apps/mine` (`review_status`, `active`, `entropy`, `review_reasons`) or the portal **App Store** page.
- A clean scan still needs a human approve. If you're blocked, that's the gate — ping the operator.

---

## 4. How your app is embedded (the runtime contract)

When a user opens your app, ExergyNet loads your `app_url` in an iframe with query params:

```
https://your-app/?exergynet=1&app_key=<key>&theme=<dark|light>
```

- Detect embedding via `?exergynet=1` (hide your own login/nav — ExergyNet owns identity).
- The launcher talks to your iframe over `postMessage` (`exergynet_init` on load, `exergynet_rpc` for calls).

### Use the SDK (don't hand-roll postMessage)

Include the official SDK and use `window.exergynet`:

```html
<script src="https://portal.exergynet.org/sdk/exergynet-app.js"></script>
<script>
  exergynet.onReady((ctx) => {
    // ctx.user (identity), ctx.entitled (bool), ctx.theme
    // Use ctx.user.id as the user's identity — do NOT build your own login.
  });
  exergynet.onTheme((theme) => applyTheme(theme));   // 'dark' | 'light'

  // Billing primitives:
  await exergynet.entitlement();                      // is this user entitled?
  await exergynet.subscribe();                        // start a subscription (paid tiers)
  await exergynet.charge({ units: 1, idempotency_key: 'evt-123', meta: {} }); // metered
</script>
```

Verified live SDK methods: `onReady`, `onTheme`, `entitlement`, `subscribe`, `charge` (over `exergynet_rpc`/`exergynet_init`). Transactional email is server-side via `POST /api/apps/email` (see §5).

---

## 5. Server-side API (the full app-facing surface)

Base `https://portal.exergynet.org`, `Authorization: Bearer <EN_TOKEN>` unless noted.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/apps/public` | Public catalog (no auth) — active apps, safe fields. |
| GET | `/api/apps/mine` | Your listings + `review_status`, `active`, `subscribers`, `earned_usd`. |
| POST | `/api/apps/publish` | Create/update a listing (§2). |
| GET | `/api/apps/entitlement?app_key=` | Is the caller entitled to an app? |
| POST | `/api/apps/subscribe` · `/unsubscribe` | Manage a subscription. |
| POST | `/api/apps/usage` | Idempotent per-use charge (metered). 80/20 split. |
| POST | `/api/apps/email` | Send transactional email **through ExergyNet** (your app has no own mailer). ≤ 20 recipients, logged, rate-limited. |
| GET/POST/DELETE | `/api/apps/webhook` | Register webhooks: `subscription.created`, `subscription.cancelled`, `usage.charged`. HMAC-signed (`X-ExergyNet-Signature: sha256=…`), 3 retries. |

**This is the entire app-facing API.** There is intentionally **no** `/api/apps/data`, `/kv`, `/storage`, or realtime endpoint. Persistence and realtime = your backend.

### Revenue

Publishers keep **80%**; the store fee is **20%** (`fee_bps = 2000`). Paid via the user's ExergyNet USDC balance (Base, currently **Sepolia testnet**). Metered and subscription both split 80/20.

---

## 6. Free / trial / quota reality

The store models **flat $0** or **flat $X/mo** or **flat $Y/use** only. There is **no trial/quota engine**. Do trials, 30-day windows, and usage quotas **in your own app**, and use the store purely for the paid conversion (`subscribe` / `charge`). Free apps produce no subscription row — gate them on `ctx.user.id` + your own logic.

---

## 7. Manage everything in the portal

`https://portal.exergynet.org` → **App Store** (`/dashboard/apps`):

- See all your listings with live status badges (live / pending review / flagged), subscriber counts, and earnings.
- **+ Publish app** form (same fields as §2) and **Edit** to update an existing listing.
- Link out to the public store (`https://exergynet.org/apps.html`).

---

## 8. Going-live checklist

1. `POST /auth/register` → save `api_key`; mint `EN_TOKEN`.
2. Build/host your app at an `https://` URL. Detect `?exergynet=1`, take identity from `ctx.user`, drop your own login.
3. Add the SDK; wire `onReady` / `onTheme`; gate paid features on `entitlement()`; call `charge()`/`subscribe()` for money.
4. `POST /api/apps/publish` with metadata + `app_url`.
5. Watch `GET /api/apps/mine` until `review_status` clears, then **ask the operator to approve** (sets `active`).
6. Verify it appears in `GET /api/apps/public` and on `exergynet.org/apps.html`.
7. (Optional) Register a webhook for `subscription.created` / `usage.charged`.

---

## 9. Gotchas (the stuff that made it "horrible")

- **No platform storage/realtime.** Bring your own backend. (Biggest one.)
- **Publishing ≠ live.** You need `active = true` after an admin approve.
- **Tokens can't be verified offline.** Use `/api/apps/entitlement` or `/developer/me` as truth.
- **One price per `app_key`.** Tiers = separate keys.
- **No sandbox host.** `portal.exergynet.org` is the one environment; Stripe is in test mode and chain is Base **Sepolia**. To test paid flows with no real money, ask the operator to credit your account test USDC.
- **`app_key` is permanent.** Choose carefully; only the listing fields are mutable.

---

*Verified against the live ExergyNet billing proxy + developer portal, 2026-06-08. If a section ever drifts from the running code, the running code wins — check `/api/apps/mine` and the portal App Store page.*
