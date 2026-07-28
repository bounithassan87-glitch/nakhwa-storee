// PATCH  /api/admin/products/:id/sizes/:sizeId — edit (label/position).
// DELETE /api/admin/products/:id/sizes/:sizeId — delete (hard; sizes are not
//   referenced by orders, which snapshot size as text).
// Auth + CSRF enforced by the admin _middleware.
import { z } from "zod";
import type { AppFunction } from "../../../../../_lib/context";
import { resolveDatabaseUrl } from "../../../../../_lib/env";
import { getPrisma, prismaCode } from "../../../../../_lib/db";
import { json, log } from "../../../../../_lib/http";

const patchSchema = z.object({
  label: z.string().trim().min(1).max(30).optional(),
  position: z.number().int().min(0).optional(),
});

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "PATCH") return editSize(ctx);
  if (ctx.request.method === "DELETE") return deleteSize(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "PATCH, DELETE" });
};

const editSize: AppFunction = async ({ params, request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const productId = String(params.id ?? "");
  const sizeId = String(params.sizeId ?? "");

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
    const res = await prisma.size.updateMany({ where: { id: sizeId, productId }, data: parsed.data });
    if (res.count === 0) return json({ ok: false, error: "not_found" }, 404);
    const size = await prisma.size.findUnique({ where: { id: sizeId } });
    return json({ ok: true, data: size });
  } catch (err) {
    if (prismaCode(err) === "P2002") return json({ ok: false, error: "duplicate_size" }, 409);
    log("error", { reqId, msg: "size_edit_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const deleteSize: AppFunction = async ({ params, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const productId = String(params.id ?? "");
  const sizeId = String(params.sizeId ?? "");
  const prisma = getPrisma(dbUrl);
  try {
    const res = await prisma.size.deleteMany({ where: { id: sizeId, productId } });
    if (res.count === 0) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true });
  } catch (err) {
    log("error", { reqId, msg: "size_delete_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
