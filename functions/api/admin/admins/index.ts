// GET  /api/admin/admins — list administrators (requires manage_admins).
// POST /api/admin/admins — add an administrator (requires manage_admins).
// Auth + CSRF enforced by the admin _middleware. Password hashes never leave.
import { z } from "zod";
import type { Env } from "../../../_lib/env";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma, prismaCode } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";
import { hashPassword } from "../_lib/auth";

const addSchema = z.object({
  email: z.string().trim().email().max(160),
  name: z.string().trim().max(120).optional(),
  password: z.string().min(8).max(200),
  role: z.enum(["OWNER", "ADMIN", "STAFF"]).default("STAFF"),
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

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "GET") return list(ctx);
  if (ctx.request.method === "POST") return add(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, POST" });
};

const list: PagesFunction<Env> = async ({ env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const role = (data as { admin?: { role?: string } }).admin?.role;
  if (!roleCan(role, "manage_admins")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  try {
    const rows = await getPrisma(dbUrl).admin.findMany({ select: publicFields, orderBy: { createdAt: "asc" } });
    return json({ ok: true, data: rows });
  } catch (err) {
    log("error", { reqId, msg: "admins_list_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const add: PagesFunction<Env> = async ({ request, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const role = (data as { admin?: { role?: string } }).admin?.role;
  if (!roleCan(role, "manage_admins")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);

  try {
    const admin = await getPrisma(dbUrl).admin.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name ?? null,
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role,
      },
      select: publicFields,
    });
    return json({ ok: true, data: admin }, 201);
  } catch (err) {
    if (prismaCode(err) === "P2002") return json({ ok: false, error: "duplicate_email" }, 409);
    log("error", { reqId, msg: "admin_add_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
