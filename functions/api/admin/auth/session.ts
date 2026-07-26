// GET /api/admin/auth/session — return the current admin for a valid cookie.
import type { Env } from "../../../_lib/env";
import { json } from "../../../_lib/http";
import { parseCookies, verifySession, SESSION_COOKIE } from "../_lib/auth";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
  }
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  const payload = token && env.AUTH_SECRET ? await verifySession(token, env.AUTH_SECRET) : null;
  if (!payload) {
    return json({ ok: false, error: "unauthenticated" }, 401);
  }
  return json({ ok: true, user: { email: payload.sub, role: payload.role } });
};
