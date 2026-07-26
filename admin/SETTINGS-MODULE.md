# Settings & System Administration (Phase 2.8)

The control center of the platform: store & system settings, DB-backed admin
management with roles/permissions, shipping companies, cities, an activity audit
log, and an improved profile. Built on the existing auth, API client, and design
system. **Landing page untouched, public order flow preserved, existing APIs
intact, nothing deployed.**

---

## 1. Architecture

```
Settings page (tabs) ─────────────▶  GET/PATCH /api/admin/settings
  ├─ AdminsSection ────────────────▶  /api/admin/admins[/:id[/password]]
  ├─ CompaniesSection ─────────────▶  /api/admin/shipping-companies[/:id]
  ├─ CitiesSection ────────────────▶  /api/admin/cities[/:id]
  └─ AuditSection ─────────────────▶  GET /api/admin/audit
Profile page ─────────────────────▶  PATCH /api/admin/profile · POST /api/admin/profile/password
Auth (DB-backed) ─────────────────▶  /api/admin/auth/{login,logout,session}
```

- **Auth is now DB-backed.** Login verifies against the `Admin` table. On the
  first ever login the env owner (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`) is seeded
  into `Admin` as `OWNER`, so the original credentials keep working with zero
  lockout risk; everything is DB-driven thereafter. Sessions/CSRF/cookies are
  unchanged (stateless HS256 JWT). See admin/SECURITY.md for the base scheme.
- **Permissions** (`functions/api/admin/_lib/permissions.ts`, mirrored in
  `admin/src/features/settings/permissions.ts`) map roles → permissions. The
  server enforces; the UI hides controls the user can't use.
- **Audit is centralized** in `functions/api/admin/_middleware.ts`: after any
  successful `POST/PATCH/PUT/DELETE` under `/api/admin/*`, one `AuditLog` row is
  written (actor, method, entity, path, ip) — so product/order/shipping/settings/
  admin changes are all captured without touching those endpoints. Login/logout/
  failed-login write their own explicit entries.
- **Reuse:** `Card`, `Input`, `Select`, `Button`, `Badge`, `Skeleton`,
  `Pagination`, `Avatar`, `PageHeader`, `apiGet/apiPatch/apiPost/apiDelete`,
  `useDebouncedValue`, `formatDate/formatMoney`.

---

## 2. Permissions

| Permission | Owner | Admin | Staff |
| --- | :-: | :-: | :-: |
| manage_admins | ✅ | — | — |
| manage_settings | ✅ | ✅ | — |
| manage_shipping_settings | ✅ | ✅ | — |
| manage_cities | ✅ | ✅ | — |
| view_audit | ✅ | ✅ | — |
| manage_products / manage_orders / manage_shipping | ✅ | ✅ | orders + shipping |

Roles: **Owner** (all), **Admin** (runs the store, can't manage other admins),
**Staff** (day-to-day fulfillment only). Extensible: add a `Permission` to the
list and grant it in `ROLE_MATRIX` (both copies). Endpoints call
`roleCan(role, permission)` and return `403` when denied (verified: staff → 403
on settings/admins).

---

## 3. API

All under `/api/admin/*` — auth + CSRF enforced by the middleware.

| Method & path | Purpose | Guard |
| --- | --- | --- |
| `GET/PATCH /settings` | store + system key-value settings | read: any · write: manage_settings |
| `GET/POST /admins` · `PATCH /admins/:id` · `POST /admins/:id/password` | list/add/edit(role,active)/reset password (last-owner protected) | manage_admins |
| `GET/POST /shipping-companies` · `PATCH/DELETE /shipping-companies/:id` | company CRUD + enable/disable | write: manage_shipping_settings |
| `GET/POST /cities` · `PATCH/DELETE /cities/:id` | city CRUD + enable/disable | write: manage_cities |
| `GET /audit` | paginated activity log (filters: actor, action, entity, date) | view_audit |
| `PATCH /profile` · `POST /profile/password` | own name/avatar · change own password (verifies current) | any admin |
| `POST /auth/login` · `POST /auth/logout` · `GET /auth/session` | DB-backed auth (session enriched with name/avatar/lastLogin) | public / self |

Settings are a key-value store; the allowlist in `settings/index.ts` is the
extension point (add a key there and a field in `Settings.tsx`). Prices/costs are
integer centimes.

---

## 4. Database

One reversible, **fully additive** migration:
`prisma/migrations/20260727003025_settings_administration/` — five new tables +
one enum, **no existing table/column changed**.

| Table / enum | Why |
| --- | --- |
| `Admin` + `AdminRole` enum | DB-backed multi-admin accounts with roles; email seeded from env on first login. |
| `Setting` (key/value) | Store + system settings; extensible without migrations. |
| `ShippingCompany` | Managed shipping-company list (name/phone/website/notes/active). |
| `City` | Managed cities with shipping cost (centimes) + delivery days. |
| `AuditLog` | Append-only activity log (actor/action/entity/details/ip/time). |

**Non-breaking:** the landing page, public `POST /api/orders`, and all prior admin
modules are unaffected (no shared table changed). Auth change is code-only + the
new `Admin` table.

**Safety:** generated with `prisma migrate diff`, applied to the **local**
embedded Postgres only. Production Neon **not** migrated (no deploy).

**Rollback:** documented in the migration file — drop the five tables then the
`AdminRole` type.

> Deploy note: this milestone must run `prisma migrate deploy` against production
> before/at deploy. Because login becomes DB-backed, the migration must be applied
> so the `Admin` table exists; the first login then seeds the env owner.

---

## 5. Verification performed

Local stack: embedded Postgres + `wrangler pages dev` + Vite.

**API (curl/node, 27 checks):** login still works after the DB-backed change
(env owner bootstrapped); session enriched (name + lastLogin); settings GET/PATCH
persist; shipping-company CRUD + enable/disable + duplicate → 409; city CRUD +
duplicate → 409; admin add/list (no password hashes leaked)/edit-role/reset
password; **last-owner demotion blocked → 409**; **staff → 403** on settings &
admins (permissions enforced); audit contains login events + captured
settings/cities/admins mutations with actor+ip; profile update; change password
(wrong current → 401, correct → 200). Regression: orders/products/customers/
analytics 200, **public `POST /api/orders` → 201**.

**Browser (E2E):** Settings shows all six tabs (owner); store name loaded from DB;
tab switching renders admins/companies/cities/audit with real data; store-settings
save persisted (`نخوة ستور`); profile name update saved + refreshed live. Mobile
375px: no horizontal scroll on any tab (tables scroll in-container); RTL
confirmed; **zero console errors**. Type-check + production build pass.

---

## 6. Future extensions

- **Granular per-permission roles** — the matrix already supports it; add a
  role-editor UI to assign custom permission sets.
- **Real active sessions** — move from stateless JWT to a session store (KV /
  Durable Object) to list & revoke device sessions.
- **Logo/avatar upload** — currently URL-based; add an R2/Images upload backend
  (same pattern noted in admin/PRODUCTS-MODULE.md).
- **Richer audit details** — capture request-body diffs / before-after values for
  key entities; add CSV export and a retention policy.
- **Settings-driven behavior** — feed `order_prefix`, currency, timezone into the
  order-number generator and formatters (today they are display config).
- **2FA / login alerts** — build on the audit log's failed-login events.
