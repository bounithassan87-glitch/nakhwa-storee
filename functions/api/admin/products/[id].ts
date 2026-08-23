// GET    /api/admin/products/:id — full product (info, pricing, colors, sizes,
//                                  media) + derived statistics.
// PATCH  /api/admin/products/:id — update basic info / pricing / status.
// DELETE /api/admin/products/:id — archive (status = ARCHIVED); the default and
//                                  the safe choice, since order history keeps
//                                  pointing at the product.
// DELETE /api/admin/products/:id?permanent=true — hard delete. Only possible
//                                  for a product no order has ever referenced;
//                                  see `removeProduct`.
// Auth-guarded by the admin _middleware (PATCH/DELETE also require CSRF) and by
// products/_middleware.ts for `manage_products`.
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma, prismaCode } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { statsFromItems } from "../_lib/productStats";
import { landingStatusFor, ORDER_ENDPOINT } from "../../../../shared/landing-pages.js";

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
      return removeProduct(ctx);
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
    // The one price that reaches a customer. `/api/orders` computes it the same
    // way — `offerPrice ?? basePrice` — from this row, and never from the
    // request, so this is the number the delivery slip will carry.
    sellingPrice: product.offerPrice ?? product.basePrice,
    landingPage: landingStatusFor(product.slug, product),
    orderEndpoint: ORDER_ENDPOINT,
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
    // A patch may touch one price and not the other, so the resulting selling
    // price has to be checked against the row as it will be, not as it was
    // sent. Same rule as create: `/api/orders` charges `offerPrice ?? basePrice`
    // and a product that resolves to zero would take orders for nothing.
    if (body.basePrice !== undefined || body.offerPrice !== undefined) {
      const current = await prisma.product.findUnique({
        where: { id },
        select: { basePrice: true, offerPrice: true },
      });
      if (!current) return json({ ok: false, error: "not_found" }, 404);
      const nextBase = body.basePrice ?? current.basePrice;
      const nextOffer = body.offerPrice === undefined ? current.offerPrice : body.offerPrice;
      if ((nextOffer ?? nextBase) <= 0) {
        return json(
          {
            ok: false,
            error: "validation_error",
            details: { fieldErrors: { basePrice: ["selling_price_must_be_positive"] } },
          },
          422,
        );
      }
    }

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

/**
 * DELETE handler for both dispositions.
 *
 * Archiving is the default because it is always safe. A hard delete is offered
 * only for a product no order has ever referenced: `OrderItem.product` is a
 * required relation with no `onDelete` rule, so Postgres restricts the delete,
 * and forcing it would mean destroying order history. Colours, sizes and media
 * do cascade, so removing a never-ordered product leaves nothing behind.
 */
const removeProduct: AppFunction = async (ctx) => {
  const permanent = new URL(ctx.request.url).searchParams.get("permanent") === "true";
  return permanent ? hardDeleteProduct(ctx) : archiveProduct(ctx);
};

const archiveProduct: AppFunction = async ({ params, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const id = String(params.id ?? "");
  const prisma = getPrisma(dbUrl);
  try {
    // Soft delete — archive + deactivate for the public flow.
    await prisma.product.update({ where: { id }, data: { status: "ARCHIVED", isActive: false } });
    return json({ ok: true, data: { id, status: "ARCHIVED" } });
  } catch (err) {
    if (prismaCode(err) === "P2025") return json({ ok: false, error: "not_found" }, 404);
    log("error", { reqId, msg: "product_archive_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const hardDeleteProduct: AppFunction = async ({ params, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const id = String(params.id ?? "");
  const prisma = getPrisma(dbUrl);
  try {
    // Checked up front so the caller gets an explanation and a count rather than
    // a bare constraint violation. The catch below still handles the race where
    // an order lands between this count and the delete.
    const ordered = await prisma.orderItem.count({ where: { productId: id } });
    if (ordered > 0) {
      return json({ ok: false, error: "product_has_orders", ordersCount: ordered }, 409);
    }

    await prisma.product.delete({ where: { id } });
    log("info", { reqId, msg: "product_deleted", productId: id });
    return json({ ok: true, data: { id, deleted: true } });
  } catch (err) {
    const code = prismaCode(err);
    if (code === "P2025") return json({ ok: false, error: "not_found" }, 404);
    if (code === "P2003") return json({ ok: false, error: "product_has_orders" }, 409);
    log("error", { reqId, msg: "product_delete_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
