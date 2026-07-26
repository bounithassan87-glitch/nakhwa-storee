# Analytics Dashboard (Phase 2.5)

A business-intelligence dashboard for the Admin — KPIs, responsive charts, and
date-range filters over the existing data. **No database schema change, no
landing-page change, nothing deployed.** It reuses the current auth, API client,
design system, and reusable components.

---

## 1. Architecture

```
Analytics page ──useAnalytics(range,from,to)──▶ GET /api/admin/analytics
  (features/analytics)                              (auth-guarded, read-only)
        │                                                   │
        │  one JSON payload                                 │  2 findMany + 1 count
        ▼                                                   ▼
  StatCard KPIs · AreaChart · DonutChart · BarList     Prisma → Postgres/Neon
  (components/ui + components/ui/charts, all SVG/DOM, zero chart deps)
```

- **One endpoint, one round-trip.** `GET /api/admin/analytics` returns every KPI
  group, the chart series, and the resolved range in a single payload — simple to
  consume and easy to cache later.
- **Zero chart dependencies.** Charts are hand-built, theme-aware SVG/DOM
  components (`AreaChart`, `DonutChart`, `BarList`) using the design-token CSS
  variables. Nothing was added to `package.json`; no supply-chain or bundle cost.
- **Reuse.** `StatCard`, `Card`, `Button`, `EmptyState`, `PageHeader`, `Select`
  and the Orders module's `STATUS_META`; the customer tag logic is shared with the
  CRM via `functions/api/admin/_lib/customers.ts` (`statsFromOrders`,
  `computeTag`) — a single source of truth for tags.
- **New reusable components** (available to future modules): `Skeleton`,
  `charts/AreaChart`, `charts/DonutChart`, `charts/BarList`.

---

## 2. Data aggregation

The endpoint runs three queries and aggregates in memory:

1. `order.findMany` (scalar: status, totalPrice, createdAt, customerId) — all orders.
2. `order.findMany` **scoped to the selected range**, including `customer.city`
   and `items` (colour/size/product name).
3. `customer.count()`.

### Metric scoping (deliberate)

| Group | Scope | Notes |
| --- | --- | --- |
| Revenue overview (today / yesterday / last7 / last30 / total) | **Fixed windows** | Always shown regardless of the filter — an at-a-glance snapshot. |
| Orders by status, cancellation rate, range revenue, geography, products, timeseries | **Selected range** | This is what the filter drives. |
| Orders "today" | Fixed (today) | Live daily counter. |
| Customer tags (New/Returning/VIP/High Risk), performance (AOV, rev/customer, repeat rate) | **Lifetime** | Business health, not period-specific. |

### Definitions

- **Revenue excludes `CANCELLED` orders** everywhere in Analytics (booked,
  non-cancelled value). *(The CRM's customer `totalRevenue` is a lifetime booked
  figure that includes all orders — a deliberate, documented difference: a
  revenue KPI should not count cancellations.)*
- **AOV** = non-cancelled revenue ÷ non-cancelled order count (lifetime).
- **Revenue per customer** = total non-cancelled revenue ÷ total customers.
- **Repeat purchase rate** = customers with ≥ 2 orders ÷ total customers.
- **Cancellation rate** = cancelled orders ÷ total orders (in range).
- **Tags** — same thresholds as the CRM (`computeTag`): High Risk > VIP >
  Returning > New. See `admin/CUSTOMERS-MODULE.md §3`.
- **Best-selling** products/colours/sizes count **pieces** (one `OrderItem` row =
  one piece) from non-cancelled orders in range.
- **Timeseries** — one bucket per UTC day across the range; each carries
  `revenue` (non-cancelled) and `orders` (all).

### Date ranges

`?range=today|yesterday|last7|last30|thisMonth|custom` (+ `from`/`to` for custom).
The server resolves boundaries using **UTC** days. `last7`/`last30` are inclusive
of today (7 / 30 day windows). Custom `from`/`to` are treated as full inclusive
days.

---

## 3. API

`GET /api/admin/analytics` — read-only, guarded by
`functions/api/admin/_middleware.ts` (401 when unauthenticated).

Response shape:

```jsonc
{
  "ok": true,
  "range": { "key": "last7", "from": "…ISO", "to": "…ISO" },
  "revenue":  { "today", "yesterday", "last7", "last30", "total" },   // centimes
  "orders":   { "today", "total", "revenue",
                "byStatus": { "PENDING","CONFIRMED","SHIPPED","DELIVERED","CANCELLED" },
                "cancellationRate" },
  "customers":{ "total", "new", "returning", "vip", "highRisk" },
  "performance": { "avgOrderValue", "revenuePerCustomer", "repeatPurchaseRate" },
  "geography":{ "cities": [{ "city","orders","revenue" }], "top": [ …top 5 ] },
  "products": { "products": [{ "name","count" }], "colors": […], "sizes": […] },
  "timeseries": [ { "date": "YYYY-MM-DD", "revenue", "orders" } ]
}
```

Money is centimes (MAD); the UI divides by 100.

### Frontend

```
features/analytics/
  types.ts            payload contracts
  ranges.ts           filter options (Arabic labels)
  api.ts              fetchAnalytics(range, from, to)
  useAnalytics.ts     hook (loading / error / refetch)
  components/AnalyticsToolbar.tsx   range select + custom date inputs + refresh
pages/Analytics.tsx   dashboard composition
components/ui/Skeleton.tsx
components/ui/charts/{AreaChart,DonutChart,BarList}.tsx
```

Charts: **Revenue over Time** & **Orders over Time** (`AreaChart`), **Order Status
Distribution** (`DonutChart` + legend), **Top Cities** (`BarList`). States:
premium **skeletons** while loading, an **error** card with retry, a top-level
**empty** state for a fresh store, and per-section "no data" fallbacks. Arabic
RTL; fully responsive (verified at 375px — no horizontal scroll).

---

## 4. Verification performed

Local stack: embedded Postgres + `wrangler pages dev` + Vite.

**Endpoint (curl/node):** unauthenticated → 401; authenticated → 200. Verified all
KPI groups for `last30` (status counts summed to the order total; tag counts
summed to total customers). Confirmed the filter re-scopes range metrics while the
fixed revenue overview stays constant across `today`, `yesterday`, `thisMonth`,
and `custom`.

**Browser (E2E):** full dashboard renders — revenue strip, both time charts (with
axes), status donut (legend counts + %), customers, performance, geography,
products. Real SVG confirmed (area line paths, donut arcs, bar fills). Range
filter and custom date range both re-scope the dashboard live. Mobile 375px: no
horizontal scroll, charts render. RTL confirmed. **Zero console errors** (before
and after all interactions). Type-check and production build pass. Orders and
Customers modules regression-checked — still working.

---

## 5. Future extension points

- **Timezone-aware windows.** Day boundaries are UTC; add a store timezone (or
  accept a client offset) so "today" matches Morocco local time exactly.
- **Push aggregation into SQL.** As data grows, replace the in-memory aggregation
  with `groupBy`/raw SQL or a nightly summary/materialized table, and add
  server-side caching (the single-payload shape makes this easy).
- **Comparisons & trends.** Period-over-period deltas (▲/▼ vs previous range) on
  the KPI cards.
- **Export.** CSV/PDF export of the current view.
- **More dimensions.** Revenue by status, cohort retention, delivery-time metrics
  — all derivable from existing columns without a schema change.
- **Shared source of truth.** `_lib/customers.ts` already unifies tag logic;
  extract revenue/AOV helpers there too if a third module needs them.
