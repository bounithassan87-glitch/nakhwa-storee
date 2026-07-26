// POST /api/admin/profile/password — change the signed-in admin's own password
// (verifies the current password). Auth + CSRF enforced.
import { z } from "zod";
import type { Env } from "../../../_lib/env";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { verifyPassword, hashPassword } from "../_lib/auth";

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  return changePassword(ctx);
};

const changePassword: PagesFunction<Env> = async ({ request, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const email = (data as { admin?: { email?: string } }).admin?.email;
  if (!email) return json({ ok: false, error: "unauthenticated" }, 401);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);

  const prisma = getPrisma(dbUrl);
  try {
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) return json({ ok: false, error: "not_found" }, 404);
    if (!(await verifyPassword(parsed.data.currentPassword, admin.passwordHash))) {
      return json({ ok: false, error: "invalid_current_password" }, 401);
    }
    await prisma.admin.update({ where: { email }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
    return json({ ok: true });
  } catch (err) {
    log("error", { reqId, msg: "profile_password_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
