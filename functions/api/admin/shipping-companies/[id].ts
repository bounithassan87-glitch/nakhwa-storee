// PATCH  /api/admin/shipping-companies/:id — edit / enable-disable.
// DELETE /api/admin/shipping-companies/:id — delete.
// Requires manage_shipping_settings. Auth + CSRF enforced.
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma, prismaCode } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  website: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
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
  if (!roleCan(role, "manage_shipping_settings")) return json({ ok: false, error: "forbidden" }, 403);
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
    const company = await getPrisma(dbUrl).shippingCompany.update({ where: { id }, data: parsed.data });
    return json({ ok: true, data: company });
  } catch (err) {
    const code = prismaCode(err);
    if (code === "P2025") return json({ ok: false, error: "not_found" }, 404);
    if (code === "P2002") return json({ ok: false, error: "duplicate_company" }, 409);
    log("error", { reqId, msg: "company_edit_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const remove: AppFunction = async ({ env, params, data }) => {
  const reqId = data.reqId;
  const role = data.admin?.role;
  if (!roleCan(role, "manage_shipping_settings")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const id = String(params.id ?? "");
  try {
    await getPrisma(dbUrl).shippingCompany.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    if (prismaCode(err) === "P2025") return json({ ok: false, error: "not_found" }, 404);
    log("error", { reqId, msg: "company_delete_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
