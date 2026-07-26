# Shipping Workflow (Phase 2.7)

Manages the full order fulfillment lifecycle — from a new order through delivery,
return, or cancellation — with a validated state machine, a chronological
timeline, shipment tracking, and a dedicated dashboard. Built on the existing
auth, API client, design system, notifications, and analytics. **Landing page
untouched, existing APIs and the public order flow preserved, nothing deployed.**

---

## 1. Architecture

```
Shipping page ─useShipping──▶ GET  /api/admin/orders        (list + statusCounts + companies)
  KPIs · toolbar · table       │
  └─ ShippingDrawer ─useOrderDetail─▶ GET /api/admin/orders/:id   (customer, items, shipment, timeline)
        ├─ WorkflowActions ──▶ PATCH /api/admin/orders/:id       (validated transition + event)
        ├─ ShipmentForm ─────▶ PUT   /api/admin/orders/:id/shipment
        └─ note box ─────────▶ POST  /api/admin/orders/:id/events
```

- Every endpoint is under `/api/admin/*`, so the existing
  `functions/api/admin/_middleware.ts` enforces **auth (401)** and **CSRF (403)**.
- The **state machine** (`functions/api/admin/_lib/orderWorkflow.ts`) is the single
  source of truth for valid transitions; the server rejects invalid ones with
  `409`. The frontend mirrors it (`features/orders/status.ts`) so the UI only
  offers valid actions.
- Reuses the Orders module (status metadata, `OrderActions`, drawer patterns),
  `Card`/`Badge`/`Skeleton`/`Pagination`/`Select`/`Input`, and the notifications
  context (a fulfillment change calls `refreshNow()`).

---

## 2. Workflow

Statuses (the DB `OrderStatus` enum): `PENDING` (the initial "new" state),
`CONFIRMED`, `PREPARING`, `READY_TO_SHIP`, `SHIPPED`, `IN_TRANSIT`, `DELIVERED`,
`RETURNED`, `CANCELLED`, `REJECTED`.

Allowed transitions (invalid ones return `409 invalid_transition`):

| From | → allowed |
| --- | --- |
| PENDING | CONFIRMED · CANCELLED · REJECTED |
| CONFIRMED | PREPARING · CANCELLED · REJECTED |
| PREPARING | READY_TO_SHIP · CANCELLED |
| READY_TO_SHIP | SHIPPED · CANCELLED |
| SHIPPED | IN_TRANSIT · DELIVERED · RETURNED |
| IN_TRANSIT | DELIVERED · RETURNED |
| DELIVERED | RETURNED |
| RETURNED / CANCELLED / REJECTED | (terminal) |

Workflow actions map to these targets: Confirm→CONFIRMED, Mark Preparing→PREPARING,
Ready to Ship→READY_TO_SHIP, Ship→SHIPPED, Mark Delivered→DELIVERED, Mark
Returned→RETURNED, Cancel→CANCELLED, Reject→REJECTED.

**Every transition** writes an append-only `OrderEvent` (status + optional note +
admin actor + timestamp) — this is the customer/order **timeline**. Marking
`DELIVERED` stamps the shipment's `deliveredAt` (when a shipment record exists).

### Cross-module effects of a status change
- **Timeline** — updated directly (new `OrderEvent`).
- **Notifications** — the shipping page calls the notifications `refreshNow()` so
  the badge/poller re-syncs.
- **Analytics** — computed live from orders, so the change appears on the next
  analytics load; `byStatus` now covers all 10 statuses.
- **KPIs** — the shipping dashboard refetches `statusCounts` after each change.

---

## 3. API

| Method & path | Purpose |
| --- | --- |
| `GET /api/admin/orders` | List (existing, extended): search now also matches **tracking number**; new `company` filter; each row carries `shipment {company, trackingNumber, status}`; response adds `statusCounts` (global KPI snapshot) and `companies` (distinct, for the filter). Existing `status`/`city`/date/sort/pagination unchanged. |
| `GET /api/admin/orders/:id` | **New:** full order — customer, items, `shipment`, and `timeline` (events asc). `404` if unknown. |
| `PATCH /api/admin/orders/:id` | **Extended:** `{status, note?}` — validates the transition, updates status, appends an `OrderEvent`, stamps `deliveredAt` on delivery. `409` on invalid/no-op transitions. (The Orders module's status change flows through this and now records timeline events too.) |
| `PUT/PATCH /api/admin/orders/:id/shipment` | **New:** upsert shipment (company, trackingNumber, shippingCost, codAmount, estimatedDeliveryAt, deliveredAt, carrier status). |
| `POST /api/admin/orders/:id/events` | **New:** add an internal note to the timeline (records the current status). |

Money fields are integer **centimes**; the UI edits in dirhams.

### Frontend

```
features/shipping/
  types.ts · workflow.ts (ACTION_META, KPI_STATUSES, re-exports transitions)
  api.ts · useShipping.ts (list+KPIs) · useOrderDetail.ts
  components/ ShippingKPIs · ShippingToolbar · ShippingTable · ShippingDrawer
              WorkflowActions · ShipmentForm · OrderTimeline
pages/Shipping.tsx        (route /shipping, nav "الشحن والتتبع")
```

The drawer composes: order summary + WhatsApp/call, **workflow actions** (only
valid transitions, with an optional note), **shipment form**, chronological
**timeline**, and an **internal note** box. Arabic RTL, responsive (verified at
375px incl. the drawer), premium; skeleton / loading / error / empty states.

---

## 4. Database

One reversible, **additive** migration:
`prisma/migrations/20260726165657_shipping_workflow/`.

| Change | Why |
| --- | --- |
| `OrderStatus` += `PREPARING, READY_TO_SHIP, IN_TRANSIT, RETURNED, REJECTED` | The fulfillment lifecycle. Existing values (`PENDING`/`CONFIRMED`/`SHIPPED`/`DELIVERED`/`CANCELLED`) are **unchanged**, so Orders/Analytics/Customers/Products and the public flow keep working. `PENDING` is "new". |
| `OrderEvent` table | Append-only timeline (status transitions + notes). |
| `Shipment` table (1-1 with Order) | Company, tracking, costs, dates, carrier status. |

**Non-breaking:** no existing column changed; enum additions are additive. The
public `POST /api/orders` still creates `PENDING` orders. New enum values are only
referenced by column type in the migration (not used as data), so it applies in a
single transaction on PostgreSQL 12+.

**Safety:** generated with `prisma migrate diff` and applied to the **local**
embedded Postgres only (`migrate deploy`). Production Neon was **not** migrated
(no deploy).

**Rollback:** documented in the migration file — drop the FKs and the
`Shipment`/`OrderEvent` tables; enum-value removal (only if no row uses a new
value) via the type-recreate recipe included there.

To deploy later: run `prisma migrate deploy` against production (never
`migrate reset`).

---

## 5. Verification performed

Local stack: embedded Postgres + `wrangler pages dev` + Vite.

**API (curl/node):** unauth → 401. Full lifecycle walk PENDING→…→DELIVERED (each
transition 200 + timeline entry); invalid `PENDING→DELIVERED` and terminal
`DELIVERED→CONFIRMED` → 409; shipment upsert; `deliveredAt` auto-stamped on
DELIVERED when a shipment exists; timeline note (POST events); `statusCounts` +
`companies` returned; **company filter** and **tracking-number search** work.
**Public `POST /api/orders` still 201** (regression).

**Browser (E2E):** shipping dashboard with 8 KPIs, filters (status/company/
city/date) and search; opened a PENDING order — the drawer offered exactly the
valid actions (Confirm/Cancel/Reject); confirming with a note advanced the status,
updated the **timeline**, changed the available actions, and refreshed the **KPIs**
live (مؤكد 6→7, قيد الانتظار 17→16); saved shipment info; searched by tracking
(1 result). Analytics shows the new statuses; Orders/Analytics regression-checked.
Mobile 375px: no horizontal scroll (list + drawer); RTL confirmed; **zero console
errors**. Type-check + build pass.

---

## 6. Future improvements

- **Carrier integrations & webhooks** — auto-update `Shipment.status`/`deliveredAt`
  from Amana/CTM/etc. tracking APIs instead of manual entry.
- **Customer notifications** — send the customer a WhatsApp/SMS on key transitions
  (confirmed/shipped/delivered) using the timeline as the trigger.
- **Bulk actions** — select multiple orders and transition/print labels together.
- **Label printing & manifests** — generate shipping labels and end-of-day
  handover sheets per company.
- **SLA / aging** — flag orders stuck too long in a state; add a "time in status"
  metric to the KPIs.
- **Per-transition permissions** — role-based control over who can cancel/reject.
- **Real-time push** — replace the notifications poll with a Durable Object so the
  shipping board updates without a refetch (see admin/REALTIME-NOTIFICATIONS.md §7).
