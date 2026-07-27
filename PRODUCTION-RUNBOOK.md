# Nakhwa Store — Production Release Runbook (Phase 3.0)

Operations document for launching **Nakhwa Store** to production on Cloudflare
Pages + Functions with a Neon PostgreSQL database. Target release: **v2.0**.

> **Status of this document:** planning only. Nothing here has been executed.
> No deploy, no production migration, no production secret access has been
> performed. Steps marked **[operator]** are to be run by a human with production
> credentials. Steps marked **[needs change]** require a small, separately
> approved code/config change (this runbook does not modify application code).

**System of record**
- Repo: `nakhwa-storee` · default branch `main` · latest tag `v1.9-marketing-campaigns`
- Cloudflare Pages project: **`nakhwa-store`** (`wrangler.toml`, `pages_build_output_dir = "dist"`, `compatibility_flags = ["nodejs_compat"]`)
- Production DB: **Neon PostgreSQL** (serverless driver on the edge; `directUrl` unpooled for migrations)
- Static site: `dist/` (landing page, committed) · API: `functions/` (Pages Functions) · Admin SPA: `admin/` (Vite, **not yet in the deploy** — see BLOCKER-1)

---

## 0. Release blockers & risks (from codebase review)

Resolve **all P0 blockers** before Go-Live. P1 should be resolved or explicitly
risk-accepted by the release owner.

| # | Sev | Finding | Required action |
|---|-----|---------|-----------------|
| B1 | **P0** | **Admin dashboard is not wired into the deploy.** `dist/` has no `/admin`. The admin SPA uses relative `/api` calls and `SameSite=Strict; Secure` cookies, so it **must be served same-origin** as the Functions (i.e. under `https://<site>/admin`). The router has **no `basename`** and its routes are root-relative (`/login`, `/orders`, …). | **[needs change]** (a) build admin (`cd admin && npm ci && npm run build`); (b) set React Router `basename="/admin"` in `admin/src/App.tsx`; (c) copy `admin/dist/*` → `dist/admin/`; (d) add SPA fallback `dist/_redirects`: `/admin/* /admin/index.html 200`. Then deploy. |
| B2 | **P0** | **4 pending Neon migrations.** Prod Neon is at `init` only. New code (esp. Phase 2.8 **DB-backed login**) breaks without the `Admin`/`Setting`/`AuditLog`/`Campaign` tables + `Order.campaignId`. | **[operator]** Run `prisma migrate deploy` against Neon **before / together with** the Functions deploy (see §2). |
| B3 | **P0** | **Production admin secrets** must exist for first-login bootstrap. | **[operator]** Set Pages secrets `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (+ `DATABASE_URL`) before deploy (see §1). |
| B4 | **P0** | **SEO placeholders**: `dist/robots.txt` and `dist/sitemap.xml` contain literal `REPLACE-WITH-YOUR-DOMAIN`. | **[needs change]** Replace with the canonical production domain; also make the OG/Twitter image an absolute URL. |
| B5 | P1 | **Security headers incomplete.** `dist/_headers` sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy but **no HSTS and no CSP**. API middleware adds no HSTS/X-Frame. | **[needs change]** Add `Strict-Transport-Security` (and ideally a CSP) in `dist/_headers`; see §9. |
| B6 | P1 | **Login rate-limit is in-memory per Worker isolate** (not shared across edge PoPs) — weak against distributed brute force. | **[operator]** Add a **Cloudflare WAF Rate-Limiting rule** on `/api/admin/auth/login` (and optionally move to KV/Durable Object later). |
| B7 | P2 | The Function→Neon path **cannot be verified locally** (wrangler local mode can't reach Neon). | Verify only **post-deploy** via `/api/health` (see §4). |
| B8 | P2 | Doc drift: `admin/SECURITY.md` says "no user table"; `functions/api/admin/orders/index.ts` has a stale `⚠️ AUTH … local dev only` comment. Harmless (auth is enforced by middleware). | Tidy in a docs pass (no runtime impact). |
| B9 | P2 | Large committed media (`video-web.mp4` ≈ 22 MB). `0722.mp4` (149 MB) and `dist.zip` are correctly gitignored. | Acceptable; consider CDN/compression later. |

---

## 1. Production deployment checklist (pre-flight)

**Accounts & access [operator]**
- [ ] Cloudflare account access to the `nakhwa-store` Pages project.
- [ ] Neon project access (connection strings: pooled + unpooled/direct).
- [ ] `wrangler` authenticated (`npx wrangler whoami`).
- [ ] Custom domain decided (e.g. `nakhwa.ma`) and DNS delegated to Cloudflare.

**Secrets & config [operator]** — never commit; set as Pages **secrets** (encrypted):
- [ ] `DATABASE_URL` — Neon **pooled** connection string (`…-pooler…neon.tech`).
- [ ] `AUTH_SECRET` — 32-byte random: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- [ ] `ADMIN_EMAIL` — the owner login email.
- [ ] `ADMIN_PASSWORD_HASH` — `node scripts/hash-admin-password.mjs "<strong-password>"`.
- [ ] (optional) Hyperdrive binding instead of `DATABASE_URL` (see `wrangler.toml` notes).
```bash
# [operator]
wrangler pages secret put DATABASE_URL        --project-name nakhwa-store
wrangler pages secret put AUTH_SECRET         --project-name nakhwa-store
wrangler pages secret put ADMIN_EMAIL         --project-name nakhwa-store
wrangler pages secret put ADMIN_PASSWORD_HASH --project-name nakhwa-store
```

**Build gates (CI or local) — must all pass**
- [ ] `npm ci` (root) and `cd admin && npm ci`.
- [ ] `cd admin && npm run typecheck` → clean.
- [ ] `cd admin && npm run build` → succeeds.
- [ ] `npx prisma validate` → schema valid; `npx prisma migrate status` (against Neon, read-only) shows the 4 pending migrations.
- [ ] B1 remediation applied (admin in `dist/admin`, `basename`, `_redirects`).
- [ ] B4 remediation applied (robots/sitemap domain).

**Change control**
- [ ] Release owner + on-call identified. Maintenance window agreed (low-traffic).
- [ ] Rollback owner briefed (§6). Neon backup taken (§8).

---

## 2. Prisma migration plan (Neon)

**Order is mandatory** — apply migrations **before** deploying the new Functions,
so the code never runs against a schema it expects but that doesn't exist.

Pending (all **additive**, none rewrite history):
1. `20260726161051_products_manager` — Product fields (sku/offerPrice/category/status), Color.isActive, `ProductMedia`.
2. `20260726165657_shipping_workflow` — OrderStatus += 5 values, `OrderEvent`, `Shipment`.
3. `20260727003025_settings_administration` — `Admin`+`AdminRole`, `Setting`, `ShippingCompany`, `City`, `AuditLog`.
4. `20260727014157_marketing_campaigns` — `Campaign`, `CampaignEvent`, enums, `Order.campaignId`.

**Procedure [operator]** (run from a trusted machine with `.env` holding the Neon
`DATABASE_URL` + `DATABASE_URL_UNPOOLED`; migrations use the **direct/unpooled** URL):
```bash
# 1. SAFETY: snapshot first (see §8) — pg_dump or a Neon branch.
# 2. Dry-run status (read-only, applies nothing):
npx prisma migrate status
# 3. Apply pending migrations (NEVER `migrate reset` — it drops data):
npx prisma migrate deploy
# 4. Regenerate client if seeding from Node:
npx prisma generate
```
- **Idempotent**: `migrate deploy` applies only unapplied migrations, in order.
- **No production seed required** — the catalog product already exists from
  `init`; the admin owner is **bootstrapped on first login** from the env secrets
  (Phase 2.8). Do **not** run `db:seed` against a live store unless intentionally
  re-seeding the catalog.
- **Enum caveat (shipping)**: adding several enum values is fine on Neon
  (PostgreSQL ≥ 12); the new values aren't used as data in the same transaction.

**Abort criteria**: if `migrate deploy` errors mid-way, STOP, do not deploy code,
restore from the snapshot (§6/§8), and investigate.

---

## 3. Cloudflare Pages deployment procedure

Deploy publishes `dist/` (static + `dist/admin`) and compiles `./functions`.

```bash
# [operator] — after §1 gates + §2 migrations are green:
npx wrangler pages deploy dist --project-name nakhwa-store --branch main
```
- `nodejs_compat`, `[vars] ENVIRONMENT=production`, and `[observability]` come from `wrangler.toml`.
- Note the returned **preview URL** (`https://<hash>.nakhwa-store.pages.dev`) and the **production URL**.
- **Promotion strategy**: deploy to a **preview** first, run §4/§11/§12 against it,
  then promote/alias to production (Pages “Deployments → Promote to production”, or
  redeploy to the production branch). Keep the previous production deployment for
  instant rollback (§6).
- Custom domain: attach in Pages → Custom domains; confirm TLS is active before
  cutover.

---

## 4. Cloudflare Functions verification (post-deploy)

Run against the deployed URL (`$URL`). Expect JSON, correct status codes, security
headers, and DB connectivity.
```bash
URL=https://<deployment>.nakhwa-store.pages.dev

# Health (DB connectivity on the edge → Neon):
curl -s $URL/api/health | jq            # expect { ok:true, database:"connected", environment:"production" }

# Security headers present on API:
curl -sI $URL/api/health | grep -iE 'x-request-id|x-content-type-options|referrer-policy|cache-control'

# Admin API is protected (no cookie → 401):
curl -s -o /dev/null -w "%{http_code}\n" $URL/api/admin/orders      # expect 401

# Public checkout is reachable (method guard):
curl -s -o /dev/null -w "%{http_code}\n" $URL/api/orders            # expect 405 (GET not allowed)
```
- [ ] `/api/health` → `200` + `database:"connected"` (proves B7 path works on the edge).
- [ ] Every `/api/admin/*` without a session → `401`.
- [ ] `wrangler pages deployment tail --project-name nakhwa-store` shows structured JSON logs with `reqId`.

---

## 5. Neon migration verification (post-deploy, read-only)

```bash
# [operator] — confirm the 5 migrations are recorded and tables exist:
npx prisma migrate status         # → "Database schema is up to date"
```
Spot-check (read-only SQL): `_prisma_migrations` lists all 5 rows; tables
`Admin`, `Setting`, `AuditLog`, `Campaign`, `Shipment`, `OrderEvent`,
`ProductMedia` exist; `Order.campaignId` column exists; `OrderStatus` enum has 10
values. Confirm **`/api/health` = connected** and a real admin login succeeds
(bootstraps the owner row) before declaring the DB verified.

---

## 6. Rollback procedures

**Fast path (app only, no schema issue)** — Cloudflare Pages keeps every
deployment:
1. Pages → Deployments → select the **last known-good** deployment → **Rollback**
   (or “Promote to production”). Propagates in seconds. No rebuild needed.

**Config/secret rollback**: re-`wrangler pages secret put` the previous value;
redeploy if a secret was consumed at build time (none are here).

**Schema rollback** (only if a migration caused breakage — all four are additive,
so this is unlikely):
- Migrations are **forward-only** in Prisma. Each migration file documents the
  exact reverse SQL (drop the new tables/columns/enums). Apply the documented
  rollback SQL manually against Neon **only if** the additive change is proven to
  be the fault, **and** first restore data from the §8 snapshot if any data loss
  occurred. Prefer **PITR / branch restore** over hand-rolled DROPs.
- **Never** `prisma migrate reset` on production.

**Decision matrix**
| Symptom | Action |
|---|---|
| Bad UI / JS error, DB fine | Pages rollback to prior deployment |
| API 500s, `/api/health` connected | Pages rollback; inspect logs (`deployment tail`) |
| `/api/health` unreachable/`not_configured` | Check `DATABASE_URL` secret / Neon status; do **not** rollback schema |
| Login fails after deploy | Verify migrations applied (§5) + admin secrets set (§1); check `Admin` table exists |
| Data corruption suspected | Freeze writes → Neon PITR/branch restore (§8) → then redeploy |

---

## 7. Disaster recovery (DR)

**Objectives**: **RTO ≤ 30 min**, **RPO ≤ 5 min** (bounded by Neon history
retention). Nakhwa is COD/WhatsApp-native, so a brief admin outage does **not**
stop customers ordering — the public checkout degrades gracefully (below).

| Scenario | Response |
|---|---|
| Cloudflare Pages/edge outage | Cloudflare status page; nothing to do but wait — deployments are immutable and auto-restore. Communicate via WhatsApp/social. |
| Neon outage / DB unreachable | `/api/health` → `unreachable`. **Customer impact is limited**: the order form still opens WhatsApp (the DB write is a background `keepalive` call and failure is swallowed). Orders arrive via WhatsApp and can be back-entered. Restore/verify Neon; monitor health. |
| Corrupt/erroneous data | Neon **PITR** / branch restore to a pre-incident timestamp (§8); reconcile any orders received during the gap from WhatsApp. |
| Compromised admin credential | Rotate `AUTH_SECRET` (invalidates all sessions) + reset the admin password (`ADMIN_PASSWORD_HASH` or via Profile) + review `AuditLog` for the actor/IP. |
| Accidental campaign/product deletion | Restore from PITR/branch; order history is protected (`Order.campaignId` uses `SET NULL`, order rows are never cascade-deleted by campaign/product deletes). |

**DR contacts**: release owner, Cloudflare account admin, Neon account admin,
WhatsApp business operator. Keep this list current out-of-band.

---

## 8. Backup strategy

- **Neon native**: enable/confirm **history retention** (PITR window) and use
  **branching** for safe restores. Before every production migration, create a
  **Neon branch** (instant, copy-on-write) as an immediate rollback point.
- **Logical backup [operator]** before each migration or weekly:
  ```bash
  pg_dump "$DATABASE_URL_UNPOOLED" --no-owner --format=custom -f nakhwa_$(date +%F).dump
  ```
  Store off-Cloudflare (e.g. encrypted object storage), retain ≥ 30 days.
- **Restore drill**: quarterly, restore the latest dump into a Neon branch and run
  `scripts/verify-db.mjs` to prove recoverability.
- **Code/config**: the Git repo (tagged milestones `v1.0`→`v1.9`) is the source of
  truth; `dist/` is committed. Secrets are **not** in Git — keep a sealed copy of
  the production secret values in the team password manager.
- **Media**: originals (`0722.mp4`, images) live outside Git; keep a separate
  archived copy.

---

## 9. Security checklist

- [ ] **Secrets** only via Pages secrets / env — never committed (`.gitignore`
      covers `.env*`, `.dev.vars`). Confirmed no secrets in the repo.
- [ ] **HTTPS everywhere** (Pages default) + **HSTS** header **[B5, needs change]**:
      add to `dist/_headers`:
      ```
      /*
        Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
      ```
- [ ] **CSP** (recommended) — start report-only, then enforce, for the landing +
      admin origin.
- [ ] Existing static headers kept: `X-Content-Type-Options: nosniff`,
      `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`.
- [ ] **Admin auth**: session cookie is `HttpOnly; Secure; SameSite=Strict; Path=/`;
      CSRF double-submit on all mutations; 8 h session TTL. Verified.
- [ ] **RBAC** enforced server-side (owner/admin/staff via `roleCan`); UI gating is
      cosmetic only. Verified (staff → 403 on privileged endpoints).
- [ ] **Audit log** records every admin mutation (actor, action, entity, ip) +
      login/logout/failed-login. Verified.
- [ ] **Login brute-force [B6]**: add a Cloudflare **WAF Rate-Limiting** rule on
      `POST /api/admin/auth/login` (the in-app limiter is per-isolate).
- [ ] **Input validation**: all write endpoints use zod; money is integer centimes;
      errors never leak internals (global boundary returns JSON `500`).
- [ ] **PII**: customer phone/address only exposed under authenticated admin
      endpoints (no PII on the public site or in URLs).
- [ ] **Least privilege**: rotate the Neon role/password if it was ever shared;
      the app uses a single pooled connection string.
- [ ] Post-deploy: run an external header/TLS scan (e.g. securityheaders.com,
      SSL Labs) and confirm A-range.

---

## 10. Performance checklist

- [ ] **Static caching** (already in `dist/_headers`): hashed `/assets/*`, CSS, JS,
      images, video → `max-age=31536000, immutable`; `index.html` → `no-cache`.
- [ ] **Admin assets**: after B1, ensure `dist/admin/assets/*` are content-hashed
      (Vite default) and long-cached; `dist/admin/index.html` no-cache.
- [ ] **Images**: hero preloaded (`fetchpriority=high`); verify sizes; consider
      serving via Cloudflare Images/`<picture>` + AVIF/WebP later.
- [ ] **Video** (~22 MB): `preload="none"`/poster; consider Cloudflare Stream for
      scale.
- [ ] **Fonts**: preconnect present; consider `font-display: swap` (already via
      `&display=swap`).
- [ ] **API latency**: Functions are edge-run; Neon **pooled** URL in use; keep
      queries indexed (existing `@@index` on status/createdAt/customerId/campaignId).
      Consider **Hyperdrive** to cut DB round-trip latency.
- [ ] **Bundle**: admin JS ≈ 115 KB gzip — acceptable; lazy-load heavy routes if it
      grows.
- [ ] **Targets**: Lighthouse (mobile) landing ≥ 90 performance; LCP < 2.5 s; CLS
      < 0.1; TTFB (edge) < 200 ms. Record baseline post-deploy.

---

## 11. SEO checklist

- [ ] **Domain** filled in — replace `REPLACE-WITH-YOUR-DOMAIN` in
      `dist/robots.txt` and `dist/sitemap.xml` **[B4, needs change]**.
- [ ] Landing `<head>` present & correct: `<title>`, meta description,
      `og:*`/`twitter:*`, `robots: index,follow`, `lang=ar` `dir=rtl`,
      **JSON-LD Product** schema. (Verified in `index.html`.)
- [ ] Make OG/Twitter **image an absolute URL** (currently relative `DSC03974.jpg`)
      so social scrapers resolve it.
- [ ] Add a `<link rel="canonical">` to the production URL.
- [ ] `sitemap.xml` `lastmod` current; submit to **Google Search Console** +
      **Bing Webmaster** after launch.
- [ ] `site.webmanifest` icons/theme correct; favicon + apple-touch-icon present.
- [ ] Verify no `noindex` leaks to production; admin under `/admin` should be
      `Disallow`ed in `robots.txt` (add `Disallow: /admin`).
- [ ] Post-launch: validate rich results (Google Rich Results Test) for the Product
      schema; check mobile-friendliness.

---

## 12. Smoke tests (post-deploy, production)

Minimal end-to-end proof against the production URL. **Do a single real test order
and delete/mark it** to avoid polluting analytics.
```bash
URL=https://<production-domain>

# 1. Health
curl -s $URL/api/health | jq '.ok, .database'                 # true, "connected"

# 2. Landing page loads (200 + HTML + headers)
curl -sI $URL/ | grep -iE 'HTTP/|x-frame-options|strict-transport-security'

# 3. Public checkout (real order — use a test phone; back it out after)
curl -s -X POST $URL/api/orders -H 'content-type: application/json' \
  -d '{"fullname":"اختبار الإطلاق","phone":"0600000000","city":"الدار البيضاء","address":"اختبار","quantity":1,"items":[{"size":"L","color":"أسود"}]}'
#   → { ok:true, orderNumber:"NK-…" }

# 4. Admin login (owner secrets) → cookies; then an authed read
#    (use a cookie jar; confirm 200 + role)
curl -s -c cj.txt -X POST $URL/api/admin/auth/login -H 'content-type: application/json' \
  -d '{"email":"<ADMIN_EMAIL>","password":"<password>"}' | jq '.user.role'   # "owner"
curl -s -b cj.txt $URL/api/admin/orders?page=1 -o /dev/null -w "%{http_code}\n"  # 200

# 5. Admin SPA served same-origin (after B1)
curl -sI $URL/admin/ | grep -iE 'HTTP/'                        # 200
```
- [ ] Health connected · Landing 200 · Checkout 201 (test order created in Neon) ·
      Admin login 200 (owner bootstrapped) · Admin `/admin` served · deep-link
      `$URL/admin/orders` refresh returns the app (SPA fallback works).

---

## 13. Production QA checklist (manual, per module)

Browser QA on production (desktop + mobile, Arabic RTL):
- [ ] **Landing / Checkout**: page renders; product/gallery/video; order form →
      WhatsApp opens **and** the order appears in admin Orders (Neon). No console
      errors; layout intact on iPhone.
- [ ] **Auth**: login, wrong password → error, logout, session expiry → redirect to
      `/login`; RBAC (create a staff admin, confirm no Settings/Marketing write).
- [ ] **Orders**: list, filters, search, pagination, detail drawer, status change,
      WhatsApp/call actions; real-time new-order badge/toast on a fresh order.
- [ ] **Products**: list, detail, edit/pricing/status, colors/sizes/media CRUD,
      soft-delete/restore.
- [ ] **Shipping**: KPIs, filters, tracking search; transition a real order through
      the lifecycle; timeline + shipment fields persist.
- [ ] **Customers**: list, search, tags, profile, order history, notes.
- [ ] **Analytics**: KPIs + charts render with live data; date filters; no
      regression from the new order fields.
- [ ] **Marketing**: dashboard KPIs + 6 charts; campaign CRUD; attribute a real
      order; metrics recompute; timeline; notification on status change.
- [ ] **Settings**: store/system settings save; admins/companies/cities CRUD; audit
      log shows the actions just performed.
- [ ] **Cross-cutting**: zero console errors on every page; no horizontal scroll at
      375 px; all copy Arabic/RTL.

**Go / No-Go**: all P0 blockers closed, §12 smoke tests green, this QA green, and
sign-offs (§15) collected → **Go**.

---

## 14. Monitoring & logging plan

- **Function logs**: structured JSON (`reqId`, method, path, status, ms) via the
  API middleware; `[observability] enabled = true`. Tail live during/after deploy:
  `wrangler pages deployment tail --project-name nakhwa-store`. Retain via
  Cloudflare Logs / Logpush to storage for audit.
- **Audit trail**: business-level actions in the `AuditLog` table (queryable in the
  admin Audit view). Review after launch and weekly.
- **Health checks**: external uptime monitor hitting `GET /api/health` every 1–5
  min; alert on `ok:false` or `database != "connected"`.
- **Error alerting**: alert on a spike of `5xx` / `unhandled_error` log lines and
  on `admin.login.failed` bursts (possible attack).
- **DB**: Neon dashboard for connections, CPU, storage, and PITR window health.
- **Web analytics**: enable Cloudflare Web Analytics (privacy-friendly) on the
  landing page for traffic/Core-Web-Vitals.
- **Dashboards/SLO**: track availability (health uptime), checkout success rate
  (orders created vs. attempts), p95 API latency. Suggested SLOs: 99.9% health
  uptime; p95 `/api/orders` < 800 ms.

---

## 15. Release checklist (Go-Live runbook)

**T-1 day**
- [ ] All P0 blockers closed; P1 resolved or risk-accepted.
- [ ] CI green (typecheck, build, `prisma validate`).
- [ ] Neon backup/branch taken (§8). Secrets set (§1). Maintenance window booked.

**T-0 (in order)**
1. [ ] **Migrate Neon** — `prisma migrate deploy`; confirm `migrate status` up to date (§2/§5).
2. [ ] **Deploy** to a **preview** — `wrangler pages deploy dist` (§3).
3. [ ] **Verify on preview** — Functions (§4), smoke tests (§12), QA spot-check (§13).
4. [ ] **Promote** preview → production (or deploy to the production branch).
5. [ ] **Attach/confirm custom domain** + TLS; re-run §12 against the real domain.
6. [ ] **Post-launch SEO** — submit sitemap to Search Console/Bing; validate rich results.
7. [ ] **Turn on monitoring/alerts** (§14); tail logs for the first 30–60 min.
8. [ ] **Back out the test order** from §12/§13.

**T+1**
- [ ] Review logs + `AuditLog`; confirm no error spikes; confirm first real orders landed in Neon.
- [ ] Record Lighthouse + header/TLS scan baselines.
- [ ] Tag the release **`v2.0`** and publish release notes (§16).

**Sign-off**
| Role | Name | Approve (Y/N) | Date |
|---|---|---|---|
| Release owner | | | |
| Backend/DB | | | |
| Frontend/QA | | | |
| Security | | | |

---

## 16. v2.0 release notes template

```markdown
# Nakhwa Store v2.0 — Production Release (<DATE>)

First full production release of the Nakhwa Store platform: the customer landing
page + COD/WhatsApp checkout, now backed by a complete enterprise Admin Dashboard.

## Highlights
- Secure, DB-backed Admin with roles & permissions (Owner / Admin / Staff).
- Orders, real-time new-order notifications, Customers CRM, Analytics.
- Products Manager (media, colors, sizes, pricing, lifecycle).
- Shipping Workflow (10-status lifecycle, timeline, shipment tracking).
- Settings & System Administration (store/system settings, admins, shipping
  companies, cities, activity audit log, profile).
- Marketing & Campaigns (campaign CRUD, order attribution, derived-metrics
  dashboard with charts).

## Under the hood
- Cloudflare Pages + Pages Functions (edge), Prisma + Neon PostgreSQL.
- Additive database schema across 5 migrations (init → marketing_campaigns).
- Centralized auth, CSRF, audit, structured logging; zero landing-page regressions.

## Included milestones
v1.0 production-ready · v1.1 dashboard · v1.2 secure-admin · v1.3 realtime-
notifications · v1.4 customers-crm · v1.5 analytics · v1.6 products-manager ·
v1.7 shipping-workflow · v1.8 settings-administration · v1.9 marketing-campaigns.

## Operations
- DB migrations applied to Neon via `prisma migrate deploy` (no data reset).
- Secrets managed as Cloudflare Pages secrets.
- Health probe: `GET /api/health`. Rollback: Cloudflare Pages deployment history.

## Known limitations / next
- Login rate-limiting hardening via WAF/KV (tracked).
- Optional: Hyperdrive for DB latency; media upload backend (R2/Images);
  per-day campaign metrics; multi-device session management.

Full changelog: v1.9…v2.0.
```

---

### Appendix A — Production API surface (for smoke/QA)
Public: `GET /api/health`, `POST /api/orders`.
Admin (all require session; mutations require CSRF; audited): `auth/{login,logout,session}`,
`orders[/:id[/events|/shipment]] · orders/stats`, `products[/:id[/colors|/sizes|/media …]]`,
`customers[/:id]`, `analytics`, `shipping-companies[/:id]`, `cities[/:id]`,
`admins[/:id[/password]]`, `settings`, `audit`, `profile[/password]`,
`campaigns[/:id[/events|/orders[/:orderId]]]`.

### Appendix B — Environment variables
| Name | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Pages secret (prod) / `.dev.vars` (local) | Postgres/Neon pooled connection |
| `DATABASE_URL_UNPOOLED` | `.env` (migration machine only) | Direct URL for `migrate deploy` |
| `AUTH_SECRET` | Pages secret | JWT session signing (HS256) |
| `ADMIN_EMAIL` | Pages secret | Bootstrap owner email (first login) |
| `ADMIN_PASSWORD_HASH` | Pages secret | Bootstrap owner password (PBKDF2 hash) |
| `ENVIRONMENT` | `wrangler.toml` `[vars]` | Non-secret runtime marker |
| `HYPERDRIVE` (optional) | Pages binding | Pooled DB via Hyperdrive |
