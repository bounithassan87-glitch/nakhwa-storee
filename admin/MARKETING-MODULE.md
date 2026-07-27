# Marketing & Campaigns (Phase 2.9)

An internal marketing-management platform for the Admin dashboard: campaign CRUD,
order attribution, a derived-metrics engine (ROAS/CPA/CPC/CPM/CTR/…), a KPI +
charts dashboard, per-campaign detail with timeline, and role/audit/notification
integration. Built entirely on the existing architecture. **Landing page, public
checkout, and every prior module are untouched except the one additive
integration point on `Order` (a nullable `campaignId`).**

> This document is written before the implementation (per the milestone process)
> and finalized with the verification results at the end.

---

## 1. Database design

One **additive** migration (`marketing_campaigns`). Two new tables + two enums,
plus a single nullable FK column on the existing `Order` table for attribution.

```prisma
enum CampaignStatus { DRAFT SCHEDULED ACTIVE PAUSED COMPLETED CANCELLED }
enum CampaignPlatform { FACEBOOK INSTAGRAM TIKTOK GOOGLE SNAPCHAT MANUAL }

model Campaign {
  id          String           @id @default(cuid())
  name        String
  platform    CampaignPlatform @default(MANUAL)
  objective   String?
  status      CampaignStatus   @default(DRAFT)
  budget      Int              @default(0)  // centimes
  spent       Int              @default(0)  // centimes (from the ad platform)
  clicks      Int              @default(0)
  impressions Int              @default(0)
  conversions Int              @default(0)
  notes       String?
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  orders      Order[]
  events      CampaignEvent[]
  @@index([status]); @@index([platform])
}

model CampaignEvent {          // append-only timeline
  id String @id @default(cuid())
  campaignId String
  campaign   Campaign @relation(fields:[campaignId], references:[id], onDelete: Cascade)
  type   String        // created | activated | paused | budget_changed | completed | cancelled | note | updated
  note   String?
  actor  String?       // admin email
  createdAt DateTime @default(now())
  @@index([campaignId])
}

// Integration (additive, nullable): attribution link on the existing Order.
model Order { …existing…
  campaignId String?
  campaign   Campaign? @relation(fields:[campaignId], references:[id], onDelete: SetNull)
  @@index([campaignId])
}
```

**Why these choices**
- **Only raw inputs are stored** (`budget, spent, clicks, impressions,
  conversions`). Every performance figure is **derived at read time** — nothing
  redundant is persisted (see §4).
- **Attribution is a nullable FK** on `Order`. The public checkout never sets it,
  so it stays `null` — zero impact on the ordering flow. `onDelete: SetNull` means
  deleting a campaign never touches order history.
- **Timeline** is an append-only `CampaignEvent` table (mirrors the shipping
  `OrderEvent` pattern).

**Rollback** (documented in the migration file): drop the FK + `campaignId` column
+ its index on `Order`, drop `CampaignEvent`, drop `Campaign`, drop the two enums.
Non-breaking and fully reversible; no existing migration is modified.

---

## 2. Backend API

All under `/api/admin/campaigns/*` → auth + CSRF + centralized audit come from the
existing `functions/api/admin/_middleware.ts` (every successful mutation is
audited automatically). Mutations additionally require the `manage_marketing`
permission (owner + admin/manager); staff is read-only.

| Method & path | Purpose | Guard |
| --- | --- | --- |
| `GET /api/admin/campaigns` | list: filters (status, platform, objective, budgetMin, q), sort, pagination; each row carries derived metrics; response also returns `summary` (dashboard KPIs), `timeseries`, `platforms`, `top`, and filter option lists | any admin |
| `POST /api/admin/campaigns` | create (writes a `created` timeline event) | manage_marketing |
| `GET /api/admin/campaigns/:id` | detail: campaign + derived metrics + attributed orders + customers + timeline | any admin |
| `PATCH /api/admin/campaigns/:id` | update fields; status/budget changes append timeline events + fire notifications | manage_marketing |
| `DELETE /api/admin/campaigns/:id` | delete (orders keep history via SetNull) | manage_marketing |
| `POST /api/admin/campaigns/:id/events` | add an internal note to the timeline | manage_marketing |
| `POST /api/admin/campaigns/:id/orders` | attribute an order (`{ orderNumber }`) | manage_marketing |
| `DELETE /api/admin/campaigns/:id/orders/:orderId` | remove attribution | manage_marketing |

Shared helper `functions/api/admin/_lib/campaignMetrics.ts` computes metrics from
raw inputs + attributed orders — the single source of truth reused by list,
detail, and dashboard. Reuses `getPrisma`, `prismaCode`, `resolveDatabaseUrl`,
`json`, `log`, `roleCan`, and zod — no duplicated logic.

---

## 3. Derived metrics (never stored)

Attributed (from `Order` where `campaignId = id` and status ≠ CANCELLED):
`orders`, `revenue` (Σ totalPrice), `customers` (distinct), `AOV` = revenue/orders.

Performance (guarded against divide-by-zero; return 0 when the denominator is 0):

| Metric | Formula |
| --- | --- |
| ROAS | revenue / spent |
| Profit | revenue − spent |
| CPA | spent / conversions |
| CPC | spent / clicks |
| CPM | spent / impressions × 1000 |
| CTR | clicks / impressions |
| Conversion rate | conversions / clicks |
| Avg revenue (ARPU) | revenue / customers |

Dashboard KPIs aggregate the same formulas across the filtered set (e.g. ROAS =
Σrevenue / Σspent). Money is integer **centimes**; the UI divides by 100.

**Charts** (dependency-free SVG, reusing `AreaChart` / `DonutChart` / `BarList`):
- **Revenue over time** — attributed orders bucketed by day (real).
- **Spend over time** — each campaign's `spent` distributed across its active
  window `[startDate, min(endDate, today)]`, summed per day (a documented estimate
  until per-day ad data is ingested — see §6).
- **ROAS trend** — daily revenue ÷ daily spend.
- **Campaign performance** — bar list of campaigns by revenue.
- **Platform distribution** — donut of spend by platform.
- **Top campaigns** — ranked by ROAS/revenue.

---

## 4. Frontend architecture

```
features/marketing/
  types.ts          contracts (Campaign, metrics, detail, params, responses)
  meta.ts           status/platform Arabic labels + tones + colors (single source)
  metrics.ts        client-side metric formatting helpers
  api.ts            all endpoints (reuses apiGet/apiPatch/apiPost/apiDelete)
  useCampaigns.ts   list + dashboard summary/timeseries/platform/top
  useCampaign.ts    detail (metrics, orders, customers, timeline)
  components/
    CampaignKPIs.tsx        StatCard grid (12 KPIs)
    CampaignCharts.tsx      the six charts (reused SVG components)
    CampaignsToolbar.tsx    search + filters (status/platform/objective/budget)
    CampaignsTable.tsx      sortable, sticky-header, responsive, RTL table
    CampaignDrawer.tsx      tabbed detail: Overview/Performance/Orders/Timeline/Notes
    CampaignForm.tsx        create/edit form
pages/Marketing.tsx         dashboard + table + drawer (route /marketing)
```

- **Reuses** `Card`, `StatCard`, `Badge`, `Drawer`, `Pagination`, `Skeleton`,
  `Input`, `Select`, `Button`, `EmptyState`, `PageHeader`, the `charts/*`
  components, `useDebouncedValue`, `formatMoney/formatDate`, and the auth +
  notifications contexts. No component is duplicated.
- **States**: skeleton while loading, error card with retry, empty states.
- **Responsive/RTL**: mobile-first; tables scroll inside their own container
  (no horizontal page scroll); Arabic RTL throughout.

---

## 5. Permissions, audit & notifications

- **Permissions** — a new `manage_marketing` permission added to the existing
  matrix (`_lib/permissions.ts` + the frontend mirror): **owner** ✅, **admin
  (manager)** ✅, **staff** ✗ (read-only). Endpoints enforce it; the UI hides
  create/edit/delete for staff.
- **Audit** — every campaign mutation is captured by the existing centralized
  middleware audit (`actor, action, entity="campaigns", path, ip`). No new audit
  code.
- **Notifications** — the existing `NotificationsContext` gains a small `notify()`
  that pushes into the shared `ToastHost` (reusing its toast queue). The Marketing
  UI calls it on **campaign started / paused / completed / ended** and when
  **budget is exceeded** (`spent > budget`). The global order poller is unchanged.

---

## 6. Future scalability

- **`CampaignDailyMetric` table** (campaignId, date, spent, clicks, impressions,
  conversions) for true per-day spend/ROAS trends instead of the modeled
  distribution — the charts already consume a daily series, so only the data
  source changes.
- **Ad-platform ingestion** (Meta/TikTok/Google APIs) to auto-populate spend &
  daily metrics and refresh on a schedule.
- **UTM-based auto-attribution** — capture `utm_campaign` at checkout and resolve
  it to a campaign server-side (today attribution is a manual admin action, which
  keeps the public flow untouched).
- **Budget pacing & alerts** promoted from client toasts to server-side scheduled
  notifications.

---

## 7. Verification performed

Local stack: embedded Postgres + `wrangler pages dev` + Vite.

**API (curl/node, 24 checks):** unauth → 401. Full CRUD: create (with a `created`
timeline event); detail with derived metrics (CPC/CPM/CTR/CPA verified against the
formulas); attribute/unattribute orders (metrics + revenue/ROAS recompute
live; unknown order → 404); PATCH status/budget → `paused` + `budget_changed`
timeline events; note event; filters + summary + platform distribution; 30-day
timeseries (real attributed revenue + modeled spend); **staff → 403 on create,
200 on read** (permission enforced); **audit captured 6 campaign mutations**;
delete. Regression: analytics/orders/customers/products/orders-stats all 200,
`byStatus` intact, and **public `POST /api/orders` → 201** with `campaignId` null.

**Browser (E2E):** dashboard renders all **12 KPIs** and all **6 charts**
(donut platform %, ROAS/spend/revenue area, performance/top bar lists); sortable
sticky-header table + filters + pagination; campaign drawer with all six tabs
(Overview/Performance/Orders/Customers/Timeline/Notes); a status change fired the
**reused notification host** ("تم إيقاف الحملة مؤقتاً"); create-campaign flow
added a 5th campaign; sorting by revenue works. Mobile 375px: no horizontal
scroll on list or drawer; RTL confirmed; **zero console errors**. Type-check +
production build pass.
