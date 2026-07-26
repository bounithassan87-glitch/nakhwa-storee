// POST /api/admin/admins/:id/password — set an administrator's password
// (requires manage_admins). Auth + CSRF enforced.
import { z } from "zod";
import type { Env } from "../../../../_lib/env";
import { resolveDatabaseUrl } from "../../../../_lib/env";
import { getPrisma, prismaCode } from "../../../../_lib/db";
import { json, log } from "../../../../_lib/http";
import { roleCan } from "../../_lib/permissions";
import { hashPassword } from "../../_lib/auth";

const bodySchema = z.object({ password: z.string().min(8).max(200) });

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  return setPassword(ctx);
};

const setPassword: PagesFunction<Env> = async ({ request, env, params, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const role = (data as { admin?: { role?: string } }).admin?.role;
  if (!roleCan(role, "manage_admins")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const id = String(params.id ?? "");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);

  try {
    await getPrisma(dbUrl).admin.update({ where: { id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
    return json({ ok: true });
  } catch (err) {
    if (prismaCode(err) === "P2025") return json({ ok: false, error: "not_found" }, 404);
    log("error", { reqId, msg: "admin_password_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
