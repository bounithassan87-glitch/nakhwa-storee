# Nakhwa Store — Backend (Phase 1)

The static landing page is now a **full-stack app**. The frontend is unchanged
(same design, UI, styling, images, video, animations); only order persistence
was added.

## Stack
- **PostgreSQL** — local dev via a zero-install embedded Postgres (`embedded-postgres`), port **5434**, database `nakhwa`. Production later points `DATABASE_URL` at a managed Postgres.
- **Prisma ORM** — schema in [`prisma/schema.prisma`](prisma/schema.prisma), using the `@prisma/adapter-pg` driver adapter (runs in both Node and the Cloudflare Workers runtime).
- **API** — Cloudflare **Pages Functions** (same project, same origin as the site): [`functions/api/orders.ts`](functions/api/orders.ts).

## Data models
`Product`, `Color`, `Size`, `Customer`, `Order`, `OrderItem` (+ `OrderStatus` enum).
Money is stored as integer centimes. Customers are deduplicated by phone. Each
order has 1–2 `OrderItem` rows (one per piece) with colour/size snapshotted.

## API
`POST /api/orders` — validates input (Zod: Moroccan phone, allowed colours/sizes,
quantity 1–2, items length must equal quantity), upserts the customer, creates the
order + items, returns `{ ok, orderNumber, quantity, total, currency }`. Any other
method returns `405`. Errors never leak internals.

The order form calls this in the background (`keepalive`) on submit — the WhatsApp
flow is untouched and still works even if the API is unreachable.

## Run locally
```bash
npm install                 # once (approve install scripts if prompted)
npm run db:local            # terminal 1 — starts Postgres on :5434 (leave running)
npm run db:migrate          # once — create tables
npm run db:seed             # once — seed product / 8 colours / 4 sizes
npm run dev                 # terminal 2 — site + API at http://localhost:8788
```

Helpers: `npm run verify:db` (end-to-end DB check), `npm run db:studio` (browse data).

## Not done yet (by request)
- No admin dashboard.

---

# Phase 2 — Production readiness

## Configuration (`wrangler.toml`)
- `compatibility_date` + `compatibility_flags = ["nodejs_compat"]` — required for Prisma/pg in the Workers runtime.
- `[vars] ENVIRONMENT = "production"` — non-secret runtime marker.
- `[observability] enabled = true` — structured Function logs in the dashboard / `wrangler pages deployment tail`.

## Database (Neon PostgreSQL in production)
- **Production DB:** Neon. The runtime uses the **Neon serverless driver**
  (`@prisma/adapter-neon`, WebSocket) — the driver that works on the Cloudflare
  Workers runtime for a remote database. `functions/_lib/db.ts` picks the adapter
  by host: `*.neon.tech` → Neon serverless; anything else → `pg` (local embedded).
- **Prisma datasource:** `url` = pooled (`DATABASE_URL`), `directUrl` = unpooled
  (`DATABASE_URL_UNPOOLED`, used for migrations). Both live in `.env` (gitignored).
- **Migrations/seed to Neon (from your machine):**
  ```bash
  npx prisma migrate deploy     # applies migrations to Neon (via directUrl)
  node --env-file=.env prisma/seed.mjs
  ```
- **Cloudflare production secret** (already set): the pooled Neon URL is stored as
  the Pages secret `DATABASE_URL` (production env). Re-set with:
  ```bash
  wrangler pages secret put DATABASE_URL --project-name nakhwa-store
  ```

## Local development vs. Neon
- **Local dev uses the embedded Postgres** (`npm run db:local`), because the local
  `wrangler pages dev` emulator **cannot open outbound connections to a remote DB
  like Neon** (the request just hangs). This is a wrangler local-mode limitation,
  not a code issue.
- **The live Function → Neon path is therefore verified only on deployed
  Cloudflare** (the edge can reach Neon). The Neon database itself is verified
  from Node: migrations applied, catalog seeded, and real orders
  created/read/deleted against Neon (`node --env-file=.env scripts/verify-db.mjs`).

## Secrets (never committed)
- **Local:** `.dev.vars` (embedded Postgres URL). Templates: `.env.example`, `.dev.vars.example`.
- **Production:** the `DATABASE_URL` Pages secret (Neon pooled). `resolveDatabaseUrl()`
  also supports a Hyperdrive binding if you add one later.

## Logging & error handling
- `functions/api/_middleware.ts` wraps every `/api/*` request: assigns a request id, logs `{method, path, status, ms}` as JSON, adds security headers (`x-request-id`, `x-content-type-options`, `referrer-policy`, `cache-control`), and is a global error boundary (returns JSON `500`, never an HTML/stack leak).
- Handlers emit structured `log()` events (`order_created`, `order_validation_failed`, …).

## API endpoints
- `POST /api/orders` — create an order (validated). Non-POST → `405`.
- `GET  /api/health` — readiness probe; pings the DB, returns `{ ok, environment, database, time, reqId }`.

## Deploy to Cloudflare Pages (existing `nakhwa-store` project)
```bash
# 1. provision the production DB secret (Hyperdrive or DATABASE_URL) as above
# 2. deploy static + functions together:
npx wrangler pages deploy dist --project-name nakhwa-store --branch main
```
`wrangler` compiles `./functions` and ships it with `dist/`. `nodejs_compat` + vars come from `wrangler.toml`.

> Live production order persistence requires a **managed Postgres reachable from Cloudflare's edge** — the local embedded Postgres (127.0.0.1) is not. Set the secret/Hyperdrive first, then `/api/health` will report `database: "connected"` in production.
