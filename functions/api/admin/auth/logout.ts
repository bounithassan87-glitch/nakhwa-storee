// POST /api/admin/auth/logout — clear session (CSRF-protected), audit.
import type { Env } from "../../../_lib/env";
import { json, log } from "../../../_lib/http";
import {
  parseCookies,
  verifySession,
  clearSessionCookie,
  clearCsrfCookie,
  SESSION_COOKIE,
  CSRF_COOKIE,
} from "../_lib/auth";

export const onRequest: PagesFunction<Env> = async ({ request, env, data }) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  const reqId = (data as { reqId?: string }).reqId;
  const cookies = parseCookies(request.headers.get("cookie"));

  // CSRF double-submit (prevents forced logout).
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = request.headers.get("x-csrf-token");
  if (!cookieToken || cookieToken !== headerToken) {
    return json({ ok: false, error: "csrf_failed" }, 403);
  }

  let email = "unknown";
  const token = cookies[SESSION_COOKIE];
  if (token && env.AUTH_SECRET) {
    const payload = await verifySession(token, env.AUTH_SECRET);
    if (payload) email = payload.sub;
  }

  const res = json({ ok: true });
  res.headers.append("set-cookie", clearSessionCookie());
  res.headers.append("set-cookie", clearCsrfCookie());
  log("info", { event: "admin.logout", email, reqId });
  return res;
};
