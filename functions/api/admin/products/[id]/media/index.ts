// POST  /api/admin/products/:id/media — add media by URL { url, type, isMain? }.
// PATCH /api/admin/products/:id/media — reorder media { ids: [...] }.
//
// Media is URL-based (main image / gallery / video) so it works without object
// storage. A binary-upload backend (Cloudflare R2/Images) can be added later
// without changing this shape — see admin/PRODUCTS-MODULE.md.
// Auth + CSRF enforced by the admin _middleware.
import { z } from "zod";
import type { AppFunction } from "../../../../../_lib/context";
import { resolveDatabaseUrl } from "../../../../../_lib/env";
import { getPrisma } from "../../../../../_lib/db";
import { json, log } from "../../../../../_lib/http";

const addSchema = z.object({
  url: z.string().trim().url().max(1000),
  type: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
  isMain: z.boolean().optional(),
});
const reorderSchema = z.object({ ids: z.array(z.string()).min(1) });

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "POST") return addMedia(ctx);
  if (ctx.request.method === "PATCH") return reorderMedia(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST, PATCH" });
};

const addMedia: AppFunction = async ({ params, request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const productId = String(params.id ?? "");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);

  const prisma = getPrisma(dbUrl);
  try {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return json({ ok: false, error: "not_found" }, 404);

    const [last, count] = await Promise.all([
      prisma.productMedia.findFirst({ where: { productId }, orderBy: { position: "desc" }, select: { position: true } }),
      prisma.productMedia.count({ where: { productId, type: "IMAGE" } }),
    ]);
    // First image becomes main automatically; explicit isMain also promotes.
    const makeMain = parsed.data.type === "IMAGE" && (parsed.data.isMain === true || count === 0);

    const media = await prisma.$transaction(async (tx) => {
      if (makeMain) await tx.productMedia.updateMany({ where: { productId, isMain: true }, data: { isMain: false } });
      return tx.productMedia.create({
        data: {
          productId,
          url: parsed.data.url,
          type: parsed.data.type,
          isMain: makeMain,
          position: (last?.position ?? -1) + 1,
        },
      });
    });
    return json({ ok: true, data: media }, 201);
  } catch (err) {
    log("error", { reqId, msg: "media_add_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const reorderMedia: AppFunction = async ({ params, request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const productId = String(params.id ?? "");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);

  const prisma = getPrisma(dbUrl);
  try {
    await prisma.$transaction(
      parsed.data.ids.map((mid, i) =>
        prisma.productMedia.updateMany({ where: { id: mid, productId }, data: { position: i } }),
      ),
    );
    return json({ ok: true });
  } catch (err) {
    log("error", { reqId, msg: "media_reorder_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
