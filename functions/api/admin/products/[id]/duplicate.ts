// POST /api/admin/products/:id/duplicate — copy a product with its colours,
// sizes and media. Auth + CSRF enforced by the admin _middleware;
// `manage_products` enforced by products/_middleware.ts.
import type { AppFunction } from "../../../../_lib/context";
import { resolveDatabaseUrl } from "../../../../_lib/env";
import { getPrisma, prismaCode } from "../../../../_lib/db";
import { json, log } from "../../../../_lib/http";
import { uniqueSlug } from "../_lib/slug";

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  return duplicateProduct(ctx);
};

const duplicateProduct: AppFunction = async ({ params, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const id = String(params.id ?? "");

  const prisma = getPrisma(dbUrl);
  try {
    const source = await prisma.product.findUnique({
      where: { id },
      include: {
        colors: { orderBy: { position: "asc" } },
        sizes: { orderBy: { position: "asc" } },
        media: { orderBy: [{ isMain: "desc" }, { position: "asc" }] },
      },
    });
    if (!source) return json({ ok: false, error: "not_found" }, 404);

    const created = await prisma.product.create({
      data: {
        slug: await uniqueSlug(prisma, `${source.slug}-copy`),
        // SKU is unique and identifies a specific physical item — a copy has to
        // be given its own, so it starts empty rather than colliding.
        sku: null,
        name: `${source.name} (نسخة)`,
        description: source.description,
        category: source.category,
        basePrice: source.basePrice,
        offerPrice: source.offerPrice,
        compareAtPrice: source.compareAtPrice,
        currency: source.currency,
        // Always a draft, whatever the source was: a duplicate is a starting
        // point to edit, and must never reach the storefront on its own.
        status: "DRAFT",
        isActive: false,
        colors: {
          create: source.colors.map((c) => ({
            name: c.name,
            swatch: c.swatch,
            position: c.position,
            isActive: c.isActive,
          })),
        },
        sizes: { create: source.sizes.map((s) => ({ label: s.label, position: s.position })) },
        media: {
          create: source.media.map((m) => ({
            type: m.type,
            url: m.url,
            position: m.position,
            isMain: m.isMain,
          })),
        },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        _count: { select: { colors: true, sizes: true, media: true } },
      },
    });

    log("info", { reqId, msg: "product_duplicated", sourceId: id, productId: created.id });
    return json({ ok: true, data: created }, 201);
  } catch (err) {
    const code = prismaCode(err);
    if (code === "P2025") return json({ ok: false, error: "not_found" }, 404);
    if (code === "P2002") return json({ ok: false, error: "duplicate_slug_or_sku" }, 409);
    log("error", { reqId, msg: "product_duplicate_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
