# Customers CRM (Phase 2.4)

A professional Customers CRM for the Admin Dashboard: a searchable, filterable,
paginated customer list and a per-customer profile with lifetime stats, derived
tags, full order history, WhatsApp/call actions, and internal notes — built on
the existing backend with **no database schema change, no landing-page change,
and nothing deployed**.

---

## 1. Design under the "no schema change" constraint

`Customer` has only `fullName, phone, city, address, createdAt`. Two CRM
requirements normally need new columns; here they are solved without any:

- **Stats & tags** → **derived at read time** from the customer's orders. Nothing
  is stored; the numbers are always correct and never drift.
- **Internal notes** → persisted in **`localStorage`** (keyed by customer id),
  behind a `get/save` abstraction (`features/customers/notes.ts`). Swapping to a
  server store later (a `Customer.notes` column, or Cloudflare KV) is a one-file
  change with no call-site edits. **Limitation:** notes are per-browser, not
  shared across devices/admins — see §6.

---

## 2. Endpoints (read-only, auth-guarded)

Both live under `/api/admin/*`, so `functions/api/admin/_middleware.ts` enforces
auth — unauthenticated requests get `401` (verified).

### `GET /api/admin/customers`
List with derived stats + tag. Query params:

| param | meaning |
| --- | --- |
| `q` | search by name (insensitive) or phone |
| `city` | filter by city (insensitive contains) |
| `tag` | `NEW` \| `RETURNING` \| `VIP` \| `HIGH_RISK` |
| `sort` | `lastOrder` (default) \| `totalRevenue` \| `totalOrders` \| `name` \| `createdAt` |
| `order` | `asc` \| `desc` (default) |
| `page`, `pageSize` | pagination (pageSize ≤ 50) |

Returns `{ ok, data[], total, page, pageSize, totalPages }`. Each row carries the
identity fields plus `tag` and all stats.

### `GET /api/admin/customers/:id`
One customer: identity + address, stats + tag, and full `orders[]` history
(with line items), newest first. `404` when the id is unknown (verified).

**How stats are computed** (`functions/api/admin/_lib/customers.ts`,
`statsFromOrders`): the endpoint loads the matched customers' order rows
(lightweight columns only) and aggregates in one pass — `totalOrders`,
`totalRevenue` (Σ `totalPrice`), `avgOrderValue` (revenue/orders), `delivered`,
`cancelled`, `firstOrderDate`, `lastOrderDate`. Tag filtering and computed-field
sorting are applied after aggregation, then the page is sliced.

---

## 3. Derived tags (`_lib/customers.ts` → `computeTag`)

A single **primary** tag by priority: **High Risk > VIP > Returning > New**.

| Tag | Rule | Arabic |
| --- | --- | --- |
| `HIGH_RISK` | ≥ 2 orders **and** cancelled/total ≥ 50% | خطر مرتفع |
| `VIP` | lifetime revenue ≥ 1000 MAD (`100_000` centimes) **or** ≥ 3 delivered | VIP |
| `RETURNING` | ≥ 2 orders | متكرر |
| `NEW` | 0–1 orders | جديد |

Thresholds are named constants (`VIP_REVENUE_CENTIMES`, `VIP_DELIVERED_ORDERS`,
`HIGH_RISK_MIN_ORDERS`, `HIGH_RISK_CANCEL_RATE`) — tune in one place. Display
metadata (label + colour tone) lives in `features/customers/tags.ts`.

> Revenue note: `totalRevenue` is **gross booked value across all orders** (COD
> lifetime value), so `avgOrderValue = totalRevenue / totalOrders`. Delivered and
> cancelled are shown as separate counts.

---

## 4. Frontend

Routes (in `App.tsx`, inside the protected `AdminLayout`):
`/customers` (list) and `/customers/:id` (profile).

```
features/customers/
  types.ts                     data contracts
  tags.ts                      TAG_META (labels + tones) + TAG_OPTIONS
  notes.ts                     localStorage get/save (swap point for a backend)
  api.ts                       fetchCustomers / fetchCustomer
  useCustomers.ts              list hook (loading/error, refetch)
  useCustomer.ts               profile hook (loading/error/notFound)
  components/
    CustomersToolbar.tsx       search + tag filter + city + sort + refresh
    CustomersTable.tsx         list rows (avatar, stats, tag, actions)
    CustomerTagBadge.tsx       shared tag badge
    CustomerNotes.tsx          internal-notes editor
pages/
  Customers.tsx                list page
  CustomerProfile.tsx          profile page
```

- **List:** debounced search, tag/city filters, sort select, pagination; loading
  spinner, error state with retry, and empty state. Rows open the profile.
- **Profile:** identity header (tag + WhatsApp/call), five stat cards (total
  orders, revenue, AOV, delivered, cancelled), first/last order dates, full order
  history table, and internal notes. Distinct loading / error / **not-found** /
  empty-history states.
- **Reuse:** `Card`, `StatCard`, `Badge`, `Avatar`, `Button`, `Spinner`,
  `EmptyState`, `PageHeader`, `Pagination`, `Select`, and the Orders module's
  `OrderActions` (WhatsApp/call/copy) + `STATUS_META`.
- **Shared additions (additive, non-breaking):** a `gold` tone on `Badge` (for
  VIP), `formatDateOnly` in `lib/format.ts`, and an optional `noun` prop on
  `Pagination` (defaults to "طلب", so Orders is unchanged).
- **RTL + responsive:** Arabic throughout; tables scroll inside their own
  container; grids collapse to one column on mobile (verified at 375px — no
  horizontal page scroll).

---

## 5. Verification performed

Local stack: embedded Postgres + `wrangler pages dev` + Vite.

**Endpoints (curl/node):**
- Unauthenticated list → `401`; authenticated → `200`.
- Stats correct (orders, revenue, AOV, delivered, cancelled, first/last dates).
- All four tags proven: crafted a 4-order customer → `VIP`; a 2-order all-cancelled
  customer → `HIGH_RISK`; seed dupes → `RETURNING`; single-order → `NEW`. Each
  `tag=` filter returns only matching rows.
- Search by name and phone; pagination (page 2 distinct); profile returns full
  history; unknown id → `404`.

**Browser (E2E):**
- List renders with avatars, formatted revenue, tag badges, filters, sort,
  pagination ("N زبون").
- Tag filter (VIP) and search both narrow the list live.
- Profile shows header, five stat cards, order history, and notes.
- Internal notes: typed, saved (button → "تم الحفظ"), persisted in localStorage,
  and **restored after reload**.
- WhatsApp (`wa.me/212…`) and call (`tel:`) links correct.
- Mobile 375px: no horizontal page scroll; RTL confirmed.
- Regression: Orders module still loads and works.

---

## 6. Constraints honored & limitations

- ✅ No DB schema change · ✅ Landing page untouched · ✅ Not deployed · ✅
  Products / Analytics / Settings / Inventory not touched.
- **Notes are per-browser** (localStorage). For shared, cross-device notes, add a
  `Customer.notes` column (or a KV/`CustomerNote` table) and repoint `notes.ts`.
- **List aggregation is in-endpoint** (loads matched customers + their order rows
  per request). Fine at store scale; for very large datasets, move aggregation to
  SQL (`groupBy`) or a materialized/summary table.
