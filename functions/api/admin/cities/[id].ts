// PATCH  /api/admin/cities/:id — edit / enable-disable.
// DELETE /api/admin/cities/:id — delete.
// Requires manage_cities. Auth + CSRF enforced.
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma, prismaCode } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  shippingCost: z.number().int().min(0).nullable().optional(),
  estimatedDays: z.number().int().min(0).max(60).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "PATCH") return edit(ctx);
  if (ctx.request.method === "DELETE") return remove(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "PATCH, DELETE" });
};

const edit: AppFunction = async ({ request, env, params, data }) => {
  const reqId = data.reqId;
  const role = data.admin?.role;
  if (!roleCan(role, "manage_cities")) return json({ ok: false, error: "forbidden" }, 403);
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

  try {
    const city = await getPrisma(dbUrl).city.update({ where: { id }, data: parsed.data });
    return json({ ok: true, data: city });
  } catch (err) {
    const code = prismaCode(err);
    if (code === "P2025") return json({ ok: false, error: "not_found" }, 404);
    if (code === "P2002") return json({ ok: false, error: "duplicate_city" }, 409);
    log("error", { reqId, msg: "city_edit_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const remove: AppFunction = async ({ env, params, data }) => {
  const reqId = data.reqId;
  const role = data.admin?.role;
  if (!roleCan(role, "manage_cities")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const id = String(params.id ?? "");
  try {
    await getPrisma(dbUrl).city.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    if (prismaCode(err) === "P2025") return json({ ok: false, error: "not_found" }, 404);
    log("error", { reqId, msg: "city_delete_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
