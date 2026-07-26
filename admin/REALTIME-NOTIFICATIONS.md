# Real-time Order Notifications (Phase 2.3)

Live new-order awareness for the Admin Dashboard: the Orders list updates on its
own, a badge counts unseen orders, a toast (and optional sound) fires when an
order arrives — with **no database schema change, no landing-page change, and
nothing deployed**.

---

## 1. Why polling, not SSE

The task asked for SSE **if it fits the Cloudflare Pages architecture**. It does
not, so we use efficient polling — which the task allows as the fallback.

Cloudflare Pages Functions run on the stateless Workers runtime:

| SSE requirement | Reality on Pages Functions |
| --- | --- |
| A long-lived, held-open connection per client | Worker invocations are short-lived; connection duration is capped, so a held SSE stream gets torn down. |
| A push source (something that *knows* a new order exists) | No shared state or pub/sub between invocations without **Durable Objects**. |
| DB change feed | The production DB is **Neon over the HTTP/serverless driver**, which has no `LISTEN/NOTIFY`. |

An SSE endpoint here would have to **poll Neon itself**, inside a per-admin
held-open request — i.e. server-side polling that is *more* expensive and *more*
fragile than doing the poll from the browser. So the browser polls a cheap
endpoint instead. If we later adopt Durable Objects, real push becomes viable
(see §7).

---

## 2. Architecture at a glance

```
        Customer                 Browser (Admin)                 Cloudflare Pages Functions          Neon
  ┌───────────────┐         ┌───────────────────────┐         ┌───────────────────────────┐    ┌─────────┐
  │ Landing page  │  POST   │ NotificationsProvider │   GET   │ /api/admin/orders/stats   │    │ orders  │
  │ checkout      ├────────▶│  poll every 12s        ├────────▶│  (auth-guarded, read-only)├───▶│ (count) │
  │ POST /api/    │ /api/   │  (only while visible)  │ ?since= │  count + newCount + latest│    └─────────┘
  │      orders   │ orders  │                        │◀────────┤                            │
  └───────────────┘         │  newCount>0 →          │         └───────────────────────────┘
                            │   • badge (bell+side)  │
                            │   • toast + sound      │         ┌───────────────────────────┐
                            │   • revision++         │   GET   │ /api/admin/orders         │
                            │      └▶ Orders page     ├────────▶│  (full filtered list)     │
                            │         silent refetch │         └───────────────────────────┘
                            └───────────────────────┘
```

The public checkout endpoint (`POST /api/orders`) is **unchanged** — new orders
are detected purely by observing the database through the read-only stats query.

---

## 3. The poll endpoint — `GET /api/admin/orders/stats`

`functions/api/admin/orders/stats.ts`. Deliberately cheap so it can be polled
often: a `COUNT`, a conditional `COUNT(createdAt > since)`, and a single
`findFirst`.

Query params: `since` (ISO timestamp, optional).

Response:

```json
{
  "ok": true,
  "total": 24,
  "newCount": 1,
  "serverTime": "2026-07-26T12:31:34.865Z",
  "latest": {
    "id": "…", "orderNumber": "NK-…", "createdAt": "…",
    "totalPrice": 54900, "currency": "MAD",
    "customerName": "…", "city": "…"
  }
}
```

- `newCount` = orders created strictly after `since` (0 when `since` is omitted).
- `latest` = minimal snapshot of the newest order, used for the toast text.
- **Auth:** it lives under `/api/admin/*`, so the existing
  `functions/api/admin/_middleware.ts` guards it — unauthenticated requests get
  `401` (verified). It exposes only name + city (no phone/address).

---

## 4. Client architecture

### `NotificationsProvider` — `admin/src/features/notifications/NotificationsContext.tsx`

Mounted once inside `AdminLayout`, so it runs across every authenticated page and
stops when the admin logs out. Responsibilities:

- **Polls** `stats` every **12 s** (`POLL_MS`, inside the requested 10–15 s band).
- **Page Visibility optimization:** the interval only calls the endpoint while
  `document.visibilityState === "visible"`, and it fires an **immediate** poll on
  the `visibilitychange` → visible transition. Hidden tabs make **zero** network
  requests.
- **Baseline (`since`):** the first successful response establishes the cutoff
  (the newest existing order), so pre-existing orders never notify. Viewing the
  Orders list (`markAllSeen`) advances the cutoff and zeroes the counter.
- **De-dupe:** a toast/sound fires only when the newest order id changes and
  `newCount > 0`, so repeated polls of the same state stay silent.
- **`revision`** increments on each genuine new-order detection; pages watch it
  to refetch (§4.4).

Exposed via `useNotifications()`: `newCount`, `latestOrder`, `revision`,
`soundEnabled`/`setSoundEnabled`, `markAllSeen`, `refreshNow`, `toasts`,
`dismissToast`.

### 4.1 Badge — `Sidebar.tsx` + `Topbar.tsx`

`newCount` renders as a red badge on the sidebar **"الطلبات"** item and on the
Topbar **bell**. Clicking the bell opens the list and clears the count. Shows
`99+` above 99.

### 4.2 Toast — `features/notifications/ToastHost.tsx`

Rendered at the app-shell level, so toasts appear on **any** admin page. Singular
(`طلب جديد — {name} — {city}`) or plural (`{n} طلبات جديدة — آخرها من …`).
Auto-dismisses after 6 s; clicking one opens the Orders list.

### 4.3 Sound — `features/notifications/sound.ts`

A short two-tone Web Audio chime (no audio asset shipped). **Optional and
user-controlled:** the Topbar speaker button toggles it; the preference persists
in `localStorage` (`nakhwa.admin.soundEnabled`, default on). Audio is unlocked on
the user's first interaction (login / toggle) per browser autoplay rules.

### 4.4 Auto-updating the Orders table — `pages/Orders.tsx` + `useOrders.ts`

When `revision` bumps, the Orders page runs a **silent** refetch of the *current*
view:

- `useOrders` gained a `refetch({ silent: true })` path that swaps the rows
  **without** toggling the full-page loading spinner. Because the table is never
  unmounted and rows are keyed by `id`, React reconciles in place — so **filters,
  search, pagination, and scroll position are all preserved** (verified: a city
  filter survived three consecutive live inserts).
- Newly-arrived rows briefly highlight (4 s) so the change is noticeable.
- Because the admin is already looking at the list, the page also calls
  `markAllSeen`, keeping the badge at 0 while they watch.

### 4.5 Optimistic UI — unchanged

Status changes remain optimistic (`useOrders.changeStatus`: update immediately,
revert on failure). Phase 2.3 did not touch that path (verified: PENDING →
CONFIRMED flips in <60 ms and persists after the PATCH).

---

## 5. Configuration

| Knob | Location | Default |
| --- | --- | --- |
| Poll interval | `POLL_MS` in `NotificationsContext.tsx` | `12_000` |
| Toast lifetime | `pushToast` timeout | `6000` |
| New-row highlight | highlight effect in `Orders.tsx` | `4000` |
| Sound on/off | `localStorage["nakhwa.admin.soundEnabled"]` | on |

---

## 6. Constraints honored

- **No DB schema change** — the stats endpoint is read-only; detection uses the
  existing `createdAt` column.
- **No landing-page change** — the public `POST /api/orders` is untouched.
- **Not deployed** — verified locally against embedded Postgres + `wrangler pages
  dev` only.
- **Scope** — Customers / Products / Analytics / iPhone support intentionally not
  implemented.

---

## 7. Known limitations & future work

- **Not sub-second.** Worst-case latency ≈ the poll interval (~12 s). Adequate for
  COD order handling.
- **Per-tab baseline.** Each browser tab tracks its own unseen count (no
  cross-tab/cross-device sync). A shared count would need server-side state.
- **In-tab only while visible.** Background tabs don't poll (by design). Native
  OS notifications for hidden tabs are out of scope.
- **Path to true real-time:** a Durable Object per store could hold the connection
  and fan out an event when `POST /api/orders` writes, letting the client upgrade
  to SSE/WebSocket with the polling loop as fallback.

---

## 8. Verification performed

Local stack: embedded Postgres (`:5434`) + `wrangler pages dev` (`:8788`) + Vite
(`:5173`).

**Endpoint (curl):**
- Unauthenticated `stats` → `401`.
- `since` = newest order → `newCount 0`; `since` = old date → `newCount = total`.
- Created a real order via public `POST /api/orders` → `newCount` went `0 → 1`,
  `total 23 → 24`, `latest` = the new order.

**Browser (E2E):**
- New orders appeared in the filtered table with **no manual refresh** (2 → 3 → 4
  → 5) while the **city filter and pagination were preserved**.
- Page Visibility: while `visibilityState:"hidden"` the table did **not** update;
  it refreshed immediately on becoming visible.
- Badge: bell + sidebar showed the live count (`1`, `3`, `5`) with correct
  singular/plural aria; **cleared to 0** when the Orders list was opened.
- Toast: singular (`طلب جديد — …`) and plural (`5 طلبات جديدة — آخرها من …`).
- Sound toggle: icon, aria-label, and persisted preference flip correctly.
- Optimistic status change still works and persists.
