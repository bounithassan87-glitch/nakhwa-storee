// GET /api/admin/auth/session — return the current admin for a valid cookie,
// enriched with the DB profile (name, avatar, last login).
import type { Env } from "../../../_lib/env";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
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

  const user: {
    email: string;
    role: string;
    name?: string | null;
    avatarUrl?: string | null;
    lastLoginAt?: string | null;
  } = { email: payload.sub, role: payload.role };

  const dbUrl = resolveDatabaseUrl(env);
  if (dbUrl) {
    try {
      const admin = await getPrisma(dbUrl).admin.findUnique({ where: { email: payload.sub } });
      if (admin) {
        user.role = admin.role.toLowerCase();
        user.name = admin.name;
        user.avatarUrl = admin.avatarUrl;
        user.lastLoginAt = admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null;
      }
    } catch {
      /* fall back to token claims */
    }
  }

  return json({ ok: true, user });
};
