// POST /api/admin/auth/login — verify credentials against the DB Admin table,
// issue a session + CSRF cookie. On first ever login the env owner is seeded
// into the Admin table, so the original single-admin credentials keep working
// while enabling real multi-admin management.
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { verifyPassword, DUMMY_HASH, signSession, randomToken, sessionCookie, csrfCookie } from "../_lib/auth";
import { writeAudit, clientIp } from "../_lib/audit";
import { hit, reset } from "../_lib/ratelimit";

const SESSION_TTL = 60 * 60 * 8; // 8 hours

export const onRequest: AppFunction = async ({ request, env, data }) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  const reqId = data.reqId;
  const ip = clientIp(request) ?? "local";

  const rl = hit(ip);
  if (rl.blocked) {
    log("warn", { event: "admin.login.rate_limited", ip, reqId });
    return json({ ok: false, error: "too_many_attempts" }, 429, { "retry-after": String(rl.retryAfter) });
  }

  if (!env.AUTH_SECRET) return json({ ok: false, error: "auth_not_configured" }, 503);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const prisma = getPrisma(dbUrl);
  try {
    // Bootstrap: seed the env owner into the Admin table on first ever login.
    if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD_HASH) {
      const count = await prisma.admin.count();
      if (count === 0) {
        await prisma.admin.create({
          data: {
            email: env.ADMIN_EMAIL.toLowerCase(),
            name: "المالك",
            passwordHash: env.ADMIN_PASSWORD_HASH,
            role: "OWNER",
            isActive: true,
          },
        });
      }
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    const active = admin?.isActive ?? false;
    // Always run a hash to equalise timing (dummy when the account is unknown).
    const passOk = await verifyPassword(password, admin && active ? admin.passwordHash : DUMMY_HASH);

    if (!admin || !active || !passOk) {
      log("warn", { event: "admin.login.failed", email, ip, reqId });
      await writeAudit(prisma, { actor: email || "unknown", action: "login_failed", entity: "auth", ip });
      return json({ ok: false, error: "invalid_credentials" }, 401);
    }

    reset(ip);
    await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    const role = admin.role.toLowerCase();
    const token = await signSession({ sub: admin.email, role }, env.AUTH_SECRET, SESSION_TTL);
    const csrf = randomToken();

    const res = json({ ok: true, user: { email: admin.email, role, name: admin.name } });
    res.headers.append("set-cookie", sessionCookie(token, SESSION_TTL));
    res.headers.append("set-cookie", csrfCookie(csrf, SESSION_TTL));
    log("info", { event: "admin.login.success", email, ip, reqId });
    await writeAudit(prisma, { actor: admin.email, action: "login", entity: "auth", ip });
    return res;
  } catch (err) {
    log("error", { event: "admin.login.error", reqId, error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
