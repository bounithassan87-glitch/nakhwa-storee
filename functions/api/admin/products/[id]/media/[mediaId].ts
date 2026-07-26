// PATCH  /api/admin/products/:id/media/:mediaId — update (isMain / position / url).
// DELETE /api/admin/products/:id/media/:mediaId — delete media.
// Setting isMain=true demotes any other main image. Auth + CSRF enforced.
import { z } from "zod";
import type { Env } from "../../../../_lib/env";
import { resolveDatabaseUrl } from "../../../../../_lib/env";
import { getPrisma } from "../../../../../_lib/db";
import { json, log } from "../../../../../_lib/http";

const patchSchema = z.object({
  isMain: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  url: z.string().trim().url().max(1000).optional(),
});

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "PATCH") return updateMedia(ctx);
  if (ctx.request.method === "DELETE") return deleteMedia(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "PATCH, DELETE" });
};

const updateMedia: PagesFunction<Env> = async ({ params, request, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const productId = String(params.id ?? "");
  const mediaId = String(params.mediaId ?? "");

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
    const existing = await prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!existing) return json({ ok: false, error: "not_found" }, 404);

    const media = await prisma.$transaction(async (tx) => {
      if (parsed.data.isMain === true) {
        await tx.productMedia.updateMany({ where: { productId, isMain: true }, data: { isMain: false } });
      }
      return tx.productMedia.update({ where: { id: mediaId }, data: parsed.data });
    });
    return json({ ok: true, data: media });
  } catch (err) {
    log("error", { reqId, msg: "media_update_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const deleteMedia: PagesFunction<Env> = async ({ params, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const productId = String(params.id ?? "");
  const mediaId = String(params.mediaId ?? "");
  const prisma = getPrisma(dbUrl);
  try {
    const existing = await prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!existing) return json({ ok: false, error: "not_found" }, 404);
    await prisma.productMedia.delete({ where: { id: mediaId } });
    // If we removed the main image, promote the next image (by position).
    if (existing.isMain) {
      const next = await prisma.productMedia.findFirst({
        where: { productId, type: "IMAGE" },
        orderBy: { position: "asc" },
      });
      if (next) await prisma.productMedia.update({ where: { id: next.id }, data: { isMain: true } });
    }
    return json({ ok: true });
  } catch (err) {
    log("error", { reqId, msg: "media_delete_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
