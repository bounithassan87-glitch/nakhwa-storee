// GET /api/admin/products — list products with search, filters, sorting,
// pagination and derived order stats. Read-only. Auth-guarded by the admin
// _middleware. Products are few, so stats are computed in-endpoint.
import type { Prisma } from "@prisma/client";
import type { Env } from "../../../_lib/env";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { statsFromItems } from "../_lib/productStats";

const STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"] as const;
const SORT_FIELDS = ["createdAt", "name", "basePrice", "ordersCount", "revenue", "status"] as const;

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
  }
  return listProducts(ctx);
};

const listProducts: PagesFunction<Env> = async ({ request, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
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
