// POST /api/admin/auth/login — verify credentials, issue a session + CSRF cookie.
import type { Env } from "../../../_lib/env";
import { json, log } from "../../../_lib/http";
import {
  verifyPassword,
  DUMMY_HASH,
  signSession,
  randomToken,
  sessionCookie,
  csrfCookie,
} from "../_lib/auth";
import { hit, reset } from "../_lib/ratelimit";

const SESSION_TTL = 60 * 60 * 8; // 8 hours

export const onRequest: PagesFunction<Env> = async ({ request, env, data }) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  const reqId = (data as { reqId?: string }).reqId;
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "local";

  const rl = hit(ip);
  if (rl.blocked) {
    log("warn", { event: "admin.login.rate_limited", ip, reqId });
    return json({ ok: false, error: "too_many_attempts" }, 429, { "retry-after": String(rl.retryAfter) });
  }

  if (!env.AUTH_SECRET || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH) {
    return json({ ok: false, error: "auth_not_configured" }, 503);
  }

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const emailOk = email === env.ADMIN_EMAIL.toLowerCase();
  // Always run a hash to equalise timing (dummy when email is unknown).
  const passOk = await verifyPassword(password, emailOk ? env.ADMIN_PASSWORD_HASH : DUMMY_HASH);

  if (!emailOk || !passOk) {
    log("warn", { event: "admin.login.failed", email, ip, reqId });
    return json({ ok: false, error: "invalid_credentials" }, 401);
  }

  reset(ip);
  const token = await signSession({ sub: email, role: "owner" }, env.AUTH_SECRET, SESSION_TTL);
  const csrf = randomToken();

  const res = json({ ok: true, user: { email, role: "owner" } });
  res.headers.append("set-cookie", sessionCookie(token, SESSION_TTL));
  res.headers.append("set-cookie", csrfCookie(csrf, SESSION_TTL));
  log("info", { event: "admin.login.success", email, ip, reqId });
  return res;
};
