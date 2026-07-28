// PATCH /api/admin/admins/:id — edit name / role / isActive (requires
// manage_admins). Guards against demoting or disabling the last active owner.
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma, prismaCode } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";

const patchSchema = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  role: z.enum(["OWNER", "ADMIN", "STAFF"]).optional(),
  isActive: z.boolean().optional(),
});

const publicFields = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  avatarUrl: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "PATCH") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "PATCH" });
  }
  return edit(ctx);
};

const edit: AppFunction = async ({ request, env, params, data }) => {
  const reqId = data.reqId;
  const role = data.admin?.role;
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
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);
  const body = parsed.data;

  const prisma = getPrisma(dbUrl);
  try {
    const target = await prisma.admin.findUnique({ where: { id } });
    if (!target) return json({ ok: false, error: "not_found" }, 404);

    // Never let the last active owner be demoted or disabled (lockout guard).
    const demoting = body.role !== undefined && body.role !== "OWNER";
    const disabling = body.isActive === false;
    if (target.role === "OWNER" && target.isActive && (demoting || disabling)) {
      const activeOwners = await prisma.admin.count({ where: { role: "OWNER", isActive: true } });
      if (activeOwners <= 1) return json({ ok: false, error: "last_owner" }, 409);
    }

    const admin = await prisma.admin.update({ where: { id }, data: body, select: publicFields });
    return json({ ok: true, data: admin });
  } catch (err) {
    if (prismaCode(err) === "P2025") return json({ ok: false, error: "not_found" }, 404);
    log("error", { reqId, msg: "admin_edit_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
