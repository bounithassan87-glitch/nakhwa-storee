# Products Manager (Phase 2.6)

The single place to manage the catalog: a filterable product list and a full
per-product profile with editable info, pricing, status lifecycle, media, colours,
sizes, and derived statistics. Built on the existing auth, API client, design
system, and reusable components. **Landing page untouched, nothing deployed,
existing APIs unchanged.**

---

## 1. Architecture

```
Products list ─useProducts─▶ GET  /api/admin/products
Product detail ─useProduct─▶ GET  /api/admin/products/:id
   │  edit/pricing/status ─▶ PATCH /api/admin/products/:id
   │  soft delete ─────────▶ DELETE /api/admin/products/:id   (status=ARCHIVED)
   ├─ ColorsManager ───────▶ POST|PATCH|DELETE .../:id/colors[/:colorId]
   ├─ SizesManager ────────▶ POST|PATCH|DELETE .../:id/sizes[/:sizeId]
   └─ MediaManager ────────▶ POST|PATCH|DELETE .../:id/media[/:mediaId]
```

- Every endpoint lives under `/api/admin/*`, so the existing
  `functions/api/admin/_middleware.ts` enforces **auth (401)** and, on mutations,
  **CSRF (403)**. No new auth code.
- Product order **statistics are derived** from order items (shared helper
  `functions/api/admin/_lib/productStats.ts`) — nothing is precomputed or stored.
- Frontend mirrors the other feature modules:
  `features/products/{types,status,api,useProducts,useProduct}.ts` +
  `components/{ProductsToolbar,ProductsTable,ColorsManager,SizesManager,MediaManager}`
  and pages `Products.tsx` (list) / `ProductDetail.tsx` (profile).
- Reuses `Card`, `StatCard`, `Badge`, `Button`, `Input`, `Select`, `Skeleton`,
  `EmptyState`, `PageHeader`, `Pagination`. Additive shared change: `apiDelete`
  in `lib/api.ts` and `prismaCode()` in `functions/_lib/db.ts`.

---

## 2. API

All read endpoints return `{ ok, data, ... }`; mutations require the CSRF header
(handled automatically by the admin `api` client).

| Method & path | Purpose |
| --- | --- |
| `GET /api/admin/products` | List — `q`, `status`, `category`, `sort` (createdAt/name/basePrice/ordersCount/revenue/status), `order`, `page`, `pageSize`. Returns rows with main image + derived `ordersCount`/`revenue`, plus the distinct `categories`. |
| `GET /api/admin/products/:id` | Full product: info, pricing, `colors[]`, `sizes[]`, `media[]`, and `stats` (ordersCount, revenue, bestColor, bestSize, cancellationRate). `404` if unknown. |
| `PATCH /api/admin/products/:id` | Update name/slug/sku/category/description/pricing/status. `409` on duplicate slug/sku, `422` on validation. |
| `DELETE /api/admin/products/:id` | **Soft delete** → `status=ARCHIVED`, `isActive=false`. Never hard-deletes. |
| `POST\|PATCH /api/admin/products/:id/colors` | Add colour · reorder `{ids}`. |
| `PATCH\|DELETE /api/admin/products/:id/colors/:colorId` | Edit (name/swatch/isActive/position) · delete. |
| `POST\|PATCH /api/admin/products/:id/sizes` | Add size · reorder `{ids}`. |
| `PATCH\|DELETE /api/admin/products/:id/sizes/:sizeId` | Edit (label/position) · delete. |
| `POST\|PATCH /api/admin/products/:id/media` | Add media `{url,type,isMain?}` · reorder `{ids}`. |
| `PATCH\|DELETE /api/admin/products/:id/media/:mediaId` | Set main / move / replace url · delete (auto-promotes next main). |

Prices are integer **centimes** (MAD); the UI edits in dirhams and converts.

**Statistics** (`statsFromItems`): `ordersCount` = distinct orders containing the
product; `revenue` = Σ item `unitPrice` of non-cancelled orders; `bestColor` /
`bestSize` = most-sold (non-cancelled); `cancellationRate` = cancelled ÷ total
orders containing the product.

---

## 3. Database

Schema changes were required (SKU, offer price, category, status lifecycle,
media, colour enable/disable) and are applied in a single reversible migration:
`prisma/migrations/20260726161051_products_manager/`.

**Why & what (all additive, non-breaking):**

| Change | Why |
| --- | --- |
| `Product.sku String? @unique` | SKU column (nullable — existing row has none; NULLs allowed). |
| `Product.offerPrice Int?` | Offer price, distinct from `basePrice` (regular) and `compareAtPrice` (strikethrough). |
| `Product.category String?` | Category filter/label. |
| `Product.status ProductStatus @default(ACTIVE)` | Active/Draft/Archived lifecycle; `ARCHIVED` = soft delete. |
| `Color.isActive Boolean @default(true)` | Enable/disable a colour. |
| `ProductMedia` table + `MediaType` enum | Main image / gallery / video, ordered, one main. |

**Backward compatibility:** every column is nullable or defaulted, so existing
rows and the **public order flow are unaffected** — it reads only `Product.slug`
and `Product.basePrice` (+ static `shared/catalog.js`) and never touched
`compareAtPrice`/colours/sizes. `isActive` is **kept** and auto-synced from
`status` (ACTIVE ⇒ true) so the public contract is preserved.

**Safety:** the migration was generated with `prisma migrate diff` and applied
**locally only** (embedded Postgres) with `migrate deploy`; the production Neon
database was never touched (no deploy). Colours/sizes can be hard-deleted safely
because orders snapshot colour/size as **text** (`OrderItem.colorName/sizeLabel`),
not foreign keys.

**Reversibility:** the migration file documents the exact rollback SQL (drop the
FK + `ProductMedia`, drop the added columns, drop the two enums). Re-running
`prisma migrate diff` after a revert reproduces an empty diff.

To apply on another environment: `prisma migrate deploy` (never `migrate reset`
against production).

---

## 4. UI

- **List:** image thumbnail, name (+category/colours/sizes), SKU, price, offer
  price, status badge, orders count, revenue, created date. Search + status filter
  + category filter + sort + pagination. Skeleton / error / empty states.
- **Detail:** header with status badge + quick Active/Draft/Archive buttons +
  soft-delete; five stat cards; an editable **Basic info & pricing** form (name,
  slug/SEO, SKU, category, description, regular/offer/compare-at price) with Save;
  **MediaManager** (main/gallery/video, add-by-URL, set-main, reorder ↑/↓,
  delete); **ColorsManager** (add, rename, enable/disable, reorder, delete);
  **SizesManager** (add, rename, reorder, delete). Toasts confirm each action.
- Arabic RTL, responsive (verified at 375px — no horizontal scroll), premium.
  Reorder uses up/down controls (accessible, no drag dependency).

---

## 5. Verification performed

Local stack: embedded Postgres + `wrangler pages dev` + Vite.

**API (curl/node):** unauth → 401. Full CRUD proved: detail+stats; update
sku/category/offer/description; colours add/edit/disable/reorder/delete + duplicate
→ 409; sizes add/edit/reorder/delete + duplicate → 409; media add (first→auto
main, video, set-main, reorder, delete→auto-promote) + invalid url → 422; soft
delete → ARCHIVED then restore → ACTIVE (isActive synced); unknown id → 404.
**Public `POST /api/orders` still returns 201** (regression).

**Browser (E2E):** list renders all columns + filters + pagination; detail shows
stats/form/media/colours/sizes; added a colour (8→9), added media (2→3), switched
status to Draft and back to Active, edited offer price and **Save persisted**
(25900). Mobile 375px: no horizontal scroll; RTL confirmed; **zero console
errors**. Type-check + build pass. Analytics/Orders/Customers regression-checked.

---

## 6. Future extensions

- **Binary media upload.** Media is URL-based today. `ProductMedia` and its
  endpoints already model type/order/main; add a Cloudflare **R2/Images** binding
  and an upload endpoint that stores the file and returns its URL — no shape
  change. (Deferred because it needs an infra binding and a deploy.)
- **Multiple products / create flow.** The store currently sells one product; the
  list/detail generalise to many. Add a `POST /api/admin/products` create form.
- **Per-item revenue attribution** is already item-level, so multi-product orders
  report correctly.
- **DB-driven catalog.** The landing page still reads the static
  `shared/catalog.js`; a future step could source colours/sizes/price from the DB
  (colour `isActive` and sort order are ready for it).
- **Variant-level pricing/stock** if inventory is added later (out of scope here).
