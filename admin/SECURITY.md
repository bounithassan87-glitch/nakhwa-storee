# Admin — Security Architecture (Phase 2.2)

Real server-side authentication protecting the entire admin API. Designed to add
**no database schema** (constraint): no user/session tables.

## Model
- **Credential:** a single admin identity in env — `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`.
  Password is stored **hashed only** (PBKDF2-HMAC-SHA256, 100k iterations, random
  per-password salt) via Web Crypto — never plain text. Generate with
  `node scripts/hash-admin-password.mjs "<password>"`.
- **Sessions:** **stateless signed JWT** (HS256 over `AUTH_SECRET`) with `exp`,
  carried in a cookie that is **HttpOnly · Secure · SameSite=Strict · Path=/**.
  No session table → no schema change. Logout clears the cookie.
- **CSRF:** double-submit token. On login a non-HttpOnly `admin_csrf` cookie is
  set; the SPA echoes it in an `X-CSRF-Token` header on every mutating request
  (`POST/PATCH/PUT/DELETE`). The server requires header === cookie.

## Endpoints (`functions/api/admin/auth/`)
| Endpoint | Method | Notes |
|---|---|---|
| `/api/admin/auth/login` | POST | Rate-limited; verifies hash; sets session + CSRF cookies; audit log |
| `/api/admin/auth/logout` | POST | Requires CSRF; clears cookies; audit log |
| `/api/admin/auth/session` | GET | Returns `{user}` for a valid cookie, else **401** |

## Authorization middleware (`functions/api/admin/_middleware.ts`)
Runs for **every `/api/admin/*`** request except `/api/admin/auth/*`:
1. No/invalid/expired session cookie → **401** (`unauthenticated`).
2. Mutating method without a matching CSRF token → **403** (`csrf_failed`).
3. Otherwise attaches `ctx.data.admin = { email, role }` and continues.

So `GET/PATCH /api/admin/orders*` are unreachable without a valid session — the
Orders module simply sends the cookie (credentials) + CSRF header via `lib/api.ts`.

## Session expiry → /login
`lib/api.ts` invokes a global handler on any `401`; `AuthContext` clears the user,
so `ProtectedRoute` redirects to `/login`. The SPA also checks
`GET /api/admin/auth/session` on load.

## Rate limiting (login)
Per-IP: 5 attempts / 15 min → **429**; reset on success. Implemented in-memory
per Worker isolate — sufficient for this phase. **Production hardening:** move to
Cloudflare KV / Durable Objects / WAF Rate Limiting (isolates aren't shared).

## Audit logging
Structured single-line JSON events via the existing logger (Cloudflare Logs):
`admin.login.success`, `admin.login.failed`, `admin.login.rate_limited`,
`admin.logout` — each with email (where known), IP, and request id.

## Secrets (env — never committed)
`AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` — in `.dev.vars` locally;
Cloudflare Pages secrets in production. Templates in `.dev.vars.example`.

## Verified
Unauthenticated `/api/admin/*` → 401; bad creds → 401; rate limit → 429; login →
cookies set; authed list → 200; mutation without CSRF → 403, with CSRF → 200;
logout → cookies cleared → subsequent calls 401. Orders UI unchanged.

## Not deployed / not in scope
No deployment. Customers, Products, Analytics remain placeholders. Persistent
audit storage and multi-user admin (with a real users table) are future work that
would require a schema change.
