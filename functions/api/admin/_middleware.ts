// Authorization guard for every /api/admin/* request (except /api/admin/auth/*).
// Unauthenticated → 401. Mutating requests without a valid CSRF token → 403.
import type { Env } from "../../_lib/env";
import { json } from "../../_lib/http";
import { parseCookies, verifySession, SESSION_COOKIE, CSRF_COOKIE } from "./_lib/auth";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);

  // The auth endpoints manage their own access (login is public, etc.).
  if (url.pathname.startsWith("/api/admin/auth/")) return ctx.next();

  const cookies = parseCookies(ctx.request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  const payload = token && ctx.env.AUTH_SECRET ? await verifySession(token, ctx.env.AUTH_SECRET) : null;
  if (!payload) {
    return json({ ok: false, error: "unauthenticated" }, 401);
  }

  if (MUTATING.has(ctx.request.method)) {
    const cookieToken = cookies[CSRF_COOKIE];
    const headerToken = ctx.request.headers.get("x-csrf-token");
    if (!cookieToken || cookieToken !== headerToken) {
      return json({ ok: false, error: "csrf_failed" }, 403);
    }
  }

  ctx.data.admin = { email: payload.sub, role: payload.role };
  return ctx.next();
};
