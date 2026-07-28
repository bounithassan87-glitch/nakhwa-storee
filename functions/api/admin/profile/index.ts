// PATCH /api/admin/profile — update the signed-in admin's own name / avatar.
// Auth + CSRF enforced by the admin _middleware.
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";

const patchSchema = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  avatarUrl: z.string().trim().url().max(1000).nullable().optional().or(z.literal("")),
});

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "PATCH") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "PATCH" });
  }
  return updateProfile(ctx);
};

const updateProfile: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const email = data.admin?.email;
  if (!email) return json({ ok: false, error: "unauthenticated" }, 401);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);

  const patch: { name?: string | null; avatarUrl?: string | null } = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.avatarUrl !== undefined) patch.avatarUrl = parsed.data.avatarUrl === "" ? null : parsed.data.avatarUrl;

  try {
    const admin = await getPrisma(dbUrl).admin.update({
      where: { email },
      data: patch,
      select: { email: true, name: true, role: true, avatarUrl: true, lastLoginAt: true },
    });
    return json({ ok: true, data: { ...admin, role: admin.role.toLowerCase() } });
  } catch (err) {
    log("error", { reqId, msg: "profile_update_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
