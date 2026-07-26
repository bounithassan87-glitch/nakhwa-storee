// PATCH  /api/admin/products/:id/colors/:colorId — edit (name/swatch/isActive/position).
// DELETE /api/admin/products/:id/colors/:colorId — delete (hard; colours are not
//   referenced by orders, which snapshot colour as text).
// Auth + CSRF enforced by the admin _middleware.
import { z } from "zod";
import type { Env } from "../../../../_lib/env";
import { resolveDatabaseUrl } from "../../../../../_lib/env";
import { getPrisma, prismaCode } from "../../../../../_lib/db";
import { json, log } from "../../../../../_lib/http";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  swatch: z.string().trim().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "PATCH") return editColor(ctx);
  if (ctx.request.method === "DELETE") return deleteColor(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "PATCH, DELETE" });
};

const editColor: PagesFunction<Env> = async ({ params, request, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const productId = String(params.id ?? "");
  const colorId = String(params.colorId ?? "");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);

  const prisma = getPrisma(dbUrl);
  try {
    const res = await prisma.color.updateMany({ where: { id: colorId, productId }, data: parsed.data });
    if (res.count === 0) return json({ ok: false, error: "not_found" }, 404);
    const color = await prisma.color.findUnique({ where: { id: colorId } });
    return json({ ok: true, data: color });
  } catch (err) {
    if (prismaCode(err) === "P2002") return json({ ok: false, error: "duplicate_color" }, 409);
    log("error", { reqId, msg: "color_edit_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const deleteColor: PagesFunction<Env> = async ({ params, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const productId = String(params.id ?? "");
  const colorId = String(params.colorId ?? "");
  const prisma = getPrisma(dbUrl);
  try {
    const res = await prisma.color.deleteMany({ where: { id: colorId, productId } });
    if (res.count === 0) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true });
  } catch (err) {
    log("error", { reqId, msg: "color_delete_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
