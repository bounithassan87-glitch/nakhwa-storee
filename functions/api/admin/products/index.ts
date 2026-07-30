// GET  /api/admin/products — list products with search, filters, sorting,
//                            pagination and derived order stats.
// POST /api/admin/products — create a product.
// Auth-guarded by the admin _middleware; mutations additionally require
// `manage_products` (products/_middleware.ts) and a CSRF token.
// Products are few, so stats are computed in-endpoint.
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma, prismaCode } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { statsFromItems } from "../_lib/productStats";
import { uniqueSlug } from "./_lib/slug";

const STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"] as const;
const SORT_FIELDS = ["createdAt", "name", "basePrice", "ordersCount", "revenue", "status"] as const;

const createSchema = z.object({
  name: z.string().trim().min(2).max(150),
  // Optional: derived from the name when omitted. Arabic names reduce to an
  // empty slug, so `uniqueSlug` falls back to a generated stem.
  slug: z.string().trim().min(2).max(150).regex(/^[a-z0-9-]+$/, "invalid_slug").optional(),
  sku: z.string().trim().max(80).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  basePrice: z.number().int().min(0),
  offerPrice: z.number().int().min(0).nullable().optional(),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  // A new product starts as a DRAFT: publishing is a deliberate second step, so
  // a half-configured product (no colours, sizes or images yet) can never appear
  // in the storefront by accident.
  status: z.enum(STATUSES).default("DRAFT"),
});

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "GET") return listProducts(ctx);
  if (ctx.request.method === "POST") return createProduct(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, POST" });
};

const createProduct: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);
  }
  const body = parsed.data;

  const prisma = getPrisma(dbUrl);
  try {
    const slug = body.slug ?? (await uniqueSlug(prisma, body.name));
    const created = await prisma.product.create({
      data: {
        slug,
        // An empty SKU string would collide with other blank SKUs on the unique
        // index; store it as absent instead.
        sku: body.sku ? body.sku : null,
        name: body.name,
        description: body.description ?? null,
        category: body.category ?? null,
        basePrice: body.basePrice,
        offerPrice: body.offerPrice ?? null,
        compareAtPrice: body.compareAtPrice ?? null,
        status: body.status,
        // Mirrors the admin lifecycle onto the flag the public flow reads.
        isActive: body.status === "ACTIVE",
      },
      select: { id: true, slug: true, name: true, status: true },
    });
    log("info", { reqId, msg: "product_created", productId: created.id, slug: created.slug });
    return json({ ok: true, data: created }, 201);
  } catch (err) {
    if (prismaCode(err) === "P2002") return json({ ok: false, error: "duplicate_slug_or_sku" }, 409);
    log("error", { reqId, msg: "product_create_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const listProducts: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim();
  const status = (p.get("status") ?? "").trim().toUpperCase();
  const category = (p.get("category") ?? "").trim();
  const sort = (SORT_FIELDS as readonly string[]).includes(p.get("sort") ?? "")
    ? (p.get("sort") as (typeof SORT_FIELDS)[number])
    : "createdAt";
  const dir = p.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(p.get("pageSize") ?? "10", 10) || 10));

  const where: Prisma.ProductWhereInput = {};
  const and: Prisma.ProductWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (status && (STATUSES as readonly string[]).includes(status)) {
    where.status = status as (typeof STATUSES)[number];
  }
  if (category) and.push({ category: { contains: category, mode: "insensitive" } });
  if (and.length) where.AND = and;

  const prisma = getPrisma(dbUrl);
  try {
    const products = await prisma.product.findMany({
      where,
      include: {
        media: { orderBy: [{ isMain: "desc" }, { position: "asc" }] },
        _count: { select: { colors: true, sizes: true } },
      },
    });

    const ids = products.map((x) => x.id);
    const items = ids.length
      ? await prisma.orderItem.findMany({
          where: { productId: { in: ids } },
          select: {
            productId: true,
            colorName: true,
            sizeLabel: true,
            unitPrice: true,
            order: { select: { id: true, status: true } },
          },
        })
      : [];

    const byProduct = new Map<string, typeof items>();
    for (const it of items) {
      const arr = byProduct.get(it.productId) ?? [];
      arr.push(it);
      byProduct.set(it.productId, arr);
    }

    let rows = products.map((pr) => {
      const stats = statsFromItems(byProduct.get(pr.id) ?? []);
      const main = pr.media.find((m) => m.isMain) ?? pr.media[0] ?? null;
      return {
        id: pr.id,
        name: pr.name,
        slug: pr.slug,
        sku: pr.sku,
        category: pr.category,
        basePrice: pr.basePrice,
        offerPrice: pr.offerPrice,
        compareAtPrice: pr.compareAtPrice,
        currency: pr.currency,
        status: pr.status,
        isActive: pr.isActive,
        createdAt: pr.createdAt,
        image: main?.url ?? null,
        colorsCount: pr._count.colors,
        sizesCount: pr._count.sizes,
        ordersCount: stats.ordersCount,
        revenue: stats.revenue,
      };
    });

    const categories = [...new Set(products.map((x) => x.category).filter(Boolean))] as string[];

    const sign = dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (sort) {
        case "name":
          return sign * a.name.localeCompare(b.name, "ar");
        case "basePrice":
          return sign * (a.basePrice - b.basePrice);
        case "ordersCount":
          return sign * (a.ordersCount - b.ordersCount);
        case "revenue":
          return sign * (a.revenue - b.revenue);
        case "status":
          return sign * a.status.localeCompare(b.status);
        case "createdAt":
        default:
          return sign * (a.createdAt.getTime() - b.createdAt.getTime());
      }
    });

    const total = rows.length;
    const start = (page - 1) * pageSize;
    rows = rows.slice(start, start + pageSize);

    return json({
      ok: true,
      data: rows,
      categories,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    log("error", { reqId, msg: "products_list_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
