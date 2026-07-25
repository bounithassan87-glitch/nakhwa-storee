# Nakhwa Store — Admin Dashboard (Architecture)

> **Phase 2 foundation.** UI shell only — mobile-first, Arabic/RTL, premium, with
> secure route protection and reusable components. **No real data / business
> logic yet**, and it is **fully isolated** from the landing page, the backend
> API, and the database. Nothing here is deployed.

## 1. Why a separate app
The landing page is intentionally a zero-build static site. An admin dashboard
(8 sections, routing, auth guards, tables, forms, reusable components) needs a
component framework. So the admin lives in its own self-contained app under
**`admin/`** with its own `package.json` — it does **not** modify the landing
page (`/index.html`, `/dist`), the API (`/functions`), or Prisma (`/prisma`).

## 2. Tech stack
| Concern | Choice | Rationale |
|---|---|---|
| Framework | **React 19 + TypeScript** | Reusable components, strong ecosystem |
| Build | **Vite** | Fast, simple SPA build |
| Routing | **React Router v7** (declarative) | Nested layouts + route guards |
| Styling | **Tailwind CSS v4** | RTL via logical properties, design tokens |
| Icons | **lucide-react** | Clean, tree-shakeable |
| Auth (now) | **Mock `AuthContext`** (localStorage) | Disconnected; swappable for real auth later |
| Fonts | **Tajawal** (Arabic) | Consistent with the landing page |

## 3. Folder structure
```
admin/
  index.html                # <html lang="ar" dir="rtl">
  vite.config.ts            # react + tailwind plugins, @/ alias
  tsconfig*.json
  package.json
  src/
    main.tsx                # entry
    App.tsx                 # <AuthProvider> + router
    styles/index.css        # Tailwind + design tokens (brand/khaki, gold, neutrals)
    auth/
      AuthContext.tsx       # mock provider: user, isAuthenticated, login(), logout()
      useAuth.ts
    components/
      ProtectedRoute.tsx    # redirects to /login when unauthenticated
      layout/
        AdminLayout.tsx     # sidebar + topbar + <Outlet/> + mobile drawer
        Sidebar.tsx         # RTL nav (right side on desktop)
        Topbar.tsx          # page title, search, profile menu, mobile hamburger
      ui/                   # reusable primitives (design system)
        Button.tsx  Card.tsx  StatCard.tsx  Badge.tsx  Input.tsx
        PageHeader.tsx  DataTable.tsx  EmptyState.tsx  Avatar.tsx
    lib/
      cn.ts                 # className merge helper
      nav.tsx               # single source of truth for nav items + icons
    pages/
      Login.tsx  DashboardHome.tsx  Orders.tsx  Customers.tsx
      Products.tsx  Analytics.tsx  Settings.tsx  Profile.tsx  NotFound.tsx
```

## 4. Routing & route protection
```
/login                         public
  ┌─ ProtectedRoute (guard) ───────────────────────────┐
  │   ┌─ AdminLayout (sidebar + topbar) ──────────────┐ │
  │   │  /            → redirect /dashboard           │ │
  │   │  /dashboard   Dashboard Home                  │ │
  │   │  /orders      Orders                          │ │
  │   │  /customers   Customers                       │ │
  │   │  /products    Products                        │ │
  │   │  /analytics   Analytics                       │ │
  │   │  /settings    Settings                        │ │
  │   │  /profile     Profile                         │ │
  │   └───────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────┘
*                              NotFound
```
`ProtectedRoute` checks `useAuth().isAuthenticated`; if false it `<Navigate to="/login" />`
(preserving the intended destination). `/login` bounces to `/dashboard` if already
signed in. **This is a client-side guard only** — real security is enforced
server-side later (see §7).

## 5. Auth (mock, for now)
`AuthContext` exposes `{ user, isAuthenticated, login(email,password), logout() }`.
`login()` currently accepts any non-empty credentials, stores a flag in
`localStorage`, and sets a placeholder user — **no network call**. It is written so
the internals can be replaced by a real call (e.g. `POST /api/admin/login`) without
touching any page or component.

## 6. Design system (premium, RTL)
- **Tokens** (Tailwind `@theme`): `brand` (khaki `#7C7043`), `brand-dark`,
  `gold`, `sidebar` (deep khaki), warm `bg`/`surface`, `ink`/`muted`, `line`,
  and semantic `success`/`warning`/`danger`.
- **RTL** is the default (`dir="rtl"`); all spacing uses logical utilities so the
  layout mirrors correctly. Sidebar sits on the **right** on desktop, collapses to
  a slide-in **drawer** on mobile.
- **Mobile-first**: single-column content, drawer nav < `lg`; fixed sidebar ≥ `lg`.
- Reusable primitives (`Button`, `Card`, `StatCard`, `Badge`, `DataTable`,
  `EmptyState`, `Input`, `PageHeader`, `Avatar`) give every page a consistent look.

## 7. Future integration points (NOT built now)
- **Auth** → real endpoint + httpOnly session/JWT; server-side `requirePermission`.
- **Data** → the existing API (`/api/orders`, plus future `/api/admin/*`); pages
  currently render **empty states / placeholders** only.
- **Deploy** → build to static and serve under `/admin` on the same Pages project
  (set router `basename="/admin"` + SPA fallback). Deferred.

## 8. Constraints honored
Landing page, backend API, and DB schema untouched. No deployment. No real data —
every page shows placeholders/empty states wired to nothing.
