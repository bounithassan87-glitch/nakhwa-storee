// Authorization guard for every /api/admin/* request (except /api/admin/auth/*).
// Unauthenticated → 401. Mutating requests without a valid CSRF token → 403.
// After a successful mutation, an audit-log row is recorded here (one place),
// covering product/order/shipping/settings/admin changes without touching each
// endpoint.
import type { AppFunction } from "../../_lib/context";
import { json } from "../../_lib/http";
import { resolveDatabaseUrl } from "../../_lib/env";
import { getPrisma } from "../../_lib/db";
import { parseCookies, verifySession, SESSION_COOKIE, CSRF_COOKIE } from "./_lib/auth";
import { writeAudit, entityFromPath, clientIp } from "./_lib/audit";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export const onRequest: AppFunction = async (ctx) => {
  const url = new URL(ctx.request.url);

  // The auth endpoints manage their own access (login is public, etc.).
  if (url.pathname.startsWith("/api/admin/auth/")) return ctx.next();

  const cookies = parseCookies(ctx.request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  const payload = token && ctx.env.AUTH_SECRET ? await verifySession(token, ctx.env.AUTH_SECRET) : null;
  if (!payload) {
    return json({ ok: false, error: "unauthenticated" }, 401);
  }

  const isMutation = MUTATING.has(ctx.request.method);
  if (isMutation) {
    const cookieToken = cookies[CSRF_COOKIE];
    const headerToken = ctx.request.headers.get("x-csrf-token");
    if (!cookieToken || cookieToken !== headerToken) {
      return json({ ok: false, error: "csrf_failed" }, 403);
    }
  }

  ctx.data.admin = { email: payload.sub, role: payload.role };

  const response = await ctx.next();

  // Record successful mutations to the audit log (best-effort, never blocking).
  if (isMutation && response.ok) {
    const dbUrl = resolveDatabaseUrl(ctx.env);
    if (dbUrl) {
      await writeAudit(getPrisma(dbUrl), {
        actor: payload.sub,
        action: ctx.request.method,
        entity: entityFromPath(url.pathname),
        details: url.pathname,
        ip: clientIp(ctx.request),
      });
    }
  }

  return response;
};
