# Admin — Orders Module (Phase 2.1)

Connects the Admin Dashboard's **Orders** section to the existing backend +
database. Reads real orders and updates order status. **No landing page, no DB
schema, no production changes; not deployed.**

## Backend (added — reads/updates only, schema untouched)
Two Pages Functions under the same API, covered by the existing `_middleware`
(request id, logging, security headers, error boundary):

| Endpoint | Method | Purpose |
|---|---|---|
| `functions/api/admin/orders/index.ts` | `GET /api/admin/orders` | List orders |
| `functions/api/admin/orders/[id].ts` | `PATCH /api/admin/orders/:id` | Change `status` |

**GET query params:** `page`, `pageSize` (≤50), `q` (orderNumber / customer name /
phone), `status`, `city`, `dateFrom`, `dateTo`, `sort` (`createdAt`\|`totalPrice`\|
`status`), `order` (`asc`\|`desc`). Returns `{ ok, data[], total, page, pageSize,
totalPages }`. **PATCH body:** `{ status }` (validated against the enum).

They use the same `getPrisma(resolveDatabaseUrl(env))` as the rest of the API —
so locally they hit the embedded Postgres, and in production they'd hit Neon,
with no code change.

## ⚠️ Security — required before ANY deploy
`GET/PATCH /api/admin/orders*` expose and mutate customer PII (phone, address).
They are currently **unauthenticated** and were built/verified **locally only**.
Before deploying, they MUST be protected by real admin authentication +
authorization (session/JWT, server-side `requirePermission`). Do not deploy the
admin API until this is in place.

## Frontend
```
admin/src/
  lib/            api.ts (fetch wrapper) · format.ts (money/date/wa) · useDebounce.ts
  components/ui/  Spinner · Select · Drawer · Pagination  (added; reusable)
  features/orders/
    types.ts  status.ts (labels+tones)  api.ts  useOrders.ts (fetch + optimistic)
    components/ OrdersToolbar · OrdersTable · OrderDrawer · OrderActions
  pages/Orders.tsx   (composition)
```

**Features:** pagination · debounced search · sortable columns (date/total/status) ·
filters (status/city/date range) · loading / error (retry) / empty states · status
badges · order-details drawer · copy phone · WhatsApp + call actions · refresh ·
change status with **optimistic UI** (list + drawer update instantly, revert +
toast on failure, persisted via PATCH). Arabic RTL throughout, mobile-first
(toolbar stacks, table scrolls in its container).

**Same-origin API:** `admin/vite.config.ts` proxies `/api` → `http://localhost:8788`
in dev, mirroring production where the admin is served from the same origin as the
Functions. No CORS.

## Run the local stack (3 terminals)
```bash
# 1 — database
npm run db:local                         # embedded Postgres :5434  (repo root)
node scripts/seed-orders-dev.mjs         # LOCAL-only test orders (guarded vs Neon)

# 2 — API (+ static)
npx wrangler pages dev --port 8788       # repo root; reads .dev.vars (local DB)

# 3 — admin
cd admin && npm run dev                  # http://localhost:5173  (proxies /api → 8788)
```
> The local `wrangler pages dev` emulator cannot reach a remote DB (Neon), so
> local dev uses the embedded Postgres. Production uses Neon (already configured).

`scripts/seed-orders-dev.mjs` is **dev-only**: it uses an explicit local URL and
hard-refuses any Neon/remote host, so it can never touch production data.

## Verified
List/pagination/search/sort/status+city+date filters (API + UI), loading/error/
empty states, drawer, copy/WhatsApp/call, refresh, and status change persisted to
the DB (optimistic + revert). Type-check clean, zero console errors, responsive at
375px.

## Not in scope (untouched)
Customers, Products, Analytics — still placeholder pages.
