// POST /api/admin/auth/logout — clear session (CSRF-protected), audit.
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { writeAudit, clientIp } from "../_lib/audit";
import {
  parseCookies,
  verifySession,
  clearSessionCookie,
  clearCsrfCookie,
  SESSION_COOKIE,
  CSRF_COOKIE,
} from "../_lib/auth";

export const onRequest: AppFunction = async ({ request, env, data }) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  const reqId = data.reqId;
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

  const dbUrl = resolveDatabaseUrl(env);
  if (dbUrl && email !== "unknown") {
    await writeAudit(getPrisma(dbUrl), { actor: email, action: "logout", entity: "auth", ip: clientIp(request) });
  }
  return res;
};
