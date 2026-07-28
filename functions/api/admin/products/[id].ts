// GET   /api/admin/products/:id  — full product (info, pricing, colors, sizes,
//                                   media) + derived statistics.
// PATCH /api/admin/products/:id  — update basic info / pricing / status.
// DELETE /api/admin/products/:id — soft delete (status = ARCHIVED). Never hard.
// Auth-guarded by the admin _middleware (PATCH/DELETE also require CSRF).
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma, prismaCode } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { statsFromItems } from "../_lib/productStats";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  slug: z.string().trim().min(2).max(150).regex(/^[a-z0-9-]+$/, "invalid_slug").optional(),
  sku: z.string().trim().max(80).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  basePrice: z.number().int().min(0).optional(),
  offerPrice: z.number().int().min(0).nullable().optional(),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
});

export const onRequest: AppFunction = async (ctx) => {
  switch (ctx.request.method) {
    case "GET":
      return getProduct(ctx);
    case "PATCH":
      return updateProduct(ctx);
    case "DELETE":
      return archiveProduct(ctx);
    default:
      return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, PATCH, DELETE" });
  }
};

async function loadFull(prisma: ReturnType<typeof getPrisma>, id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      colors: { orderBy: { position: "asc" } },
      sizes: { orderBy: { position: "asc" } },
      media: { orderBy: [{ isMain: "desc" }, { position: "asc" }] },
    },
  });
  if (!product) return null;
  const items = await prisma.orderItem.findMany({
    where: { productId: id },
    select: { colorName: true, sizeLabel: true, unitPrice: true, order: { select: { id: true, status: true } } },
  });
  return { product, stats: statsFromItems(items) };
}

function serialize(full: NonNullable<Awaited<ReturnType<typeof loadFull>>>) {
  const { product, stats } = full;
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    category: product.category,
    description: product.description,
    basePrice: product.basePrice,
    offerPrice: product.offerPrice,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    status: product.status,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    colors: product.colors,
    sizes: product.sizes,
    media: product.media,
    stats,
  };
}

const getProduct: AppFunction = async ({ params, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const id = String(params.id ?? "");
  const prisma = getPrisma(dbUrl);
  try {
    const full = await loadFull(prisma, id);
    if (!full) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true, data: serialize(full) });
  } catch (err) {
    log("error", { reqId, msg: "product_get_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const updateProduct: AppFunction = async ({ params, request, env, data }) => {
  const reqId = data.reqId;
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
  if (!parsed.success) {
    return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);
  }
  const body = parsed.data;
  const patch: Record<string, unknown> = { ...body };
  // Keep the public flow's isActive in sync with the admin lifecycle.
  if (body.status) patch.isActive = body.status === "ACTIVE";
  if (body.sku === "") patch.sku = null;

  const prisma = getPrisma(dbUrl);
  try {
    await prisma.product.update({ where: { id }, data: patch });
    const full = await loadFull(prisma, id);
    if (!full) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true, data: serialize(full) });
  } catch (err) {
    const code = prismaCode(err);
    if (code === "P2025") return json({ ok: false, error: "not_found" }, 404);
    if (code === "P2002") return json({ ok: false, error: "duplicate_slug_or_sku" }, 409);
    log("error", { reqId, msg: "product_update_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const archiveProduct: AppFunction = async ({ params, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const id = String(params.id ?? "");
  const prisma = getPrisma(dbUrl);
  try {
    // Soft delete only — archive + deactivate for the public flow.
    await prisma.product.update({ where: { id }, data: { status: "ARCHIVED", isActive: false } });
    return json({ ok: true, data: { id, status: "ARCHIVED" } });
  } catch (err) {
    if (prismaCode(err) === "P2025") return json({ ok: false, error: "not_found" }, 404);
    log("error", { reqId, msg: "product_archive_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
