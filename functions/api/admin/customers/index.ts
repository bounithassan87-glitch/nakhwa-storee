// GET /api/admin/customers — list customers with derived CRM stats + tag.
// Read-only (no schema change). Stats/tags are computed from order history.
// Auth-guarded by functions/api/admin/_middleware.ts.
import type { Prisma } from "@prisma/client";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { statsFromOrders, computeTag, type CustomerTag } from "../_lib/customers";

const SORT_FIELDS = ["lastOrder", "totalRevenue", "totalOrders", "name", "createdAt"] as const;
const TAGS = ["NEW", "RETURNING", "VIP", "HIGH_RISK"] as const;

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
  }
  return listCustomers(ctx);
};

const listCustomers: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim();
  const city = (p.get("city") ?? "").trim();
  const tag = (p.get("tag") ?? "").trim().toUpperCase();
  const sort = (SORT_FIELDS as readonly string[]).includes(p.get("sort") ?? "")
    ? (p.get("sort") as (typeof SORT_FIELDS)[number])
    : "lastOrder";
  const dir = p.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(p.get("pageSize") ?? "10", 10) || 10));

  const where: Prisma.CustomerWhereInput = {};
  const and: Prisma.CustomerWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    });
  }
  if (city) and.push({ city: { contains: city, mode: "insensitive" } });
  if (and.length) where.AND = and;

  const prisma = getPrisma(dbUrl);
  try {
    // Matched customers (scalar fields only).
    const customers = await prisma.customer.findMany({
      where,
      select: { id: true, fullName: true, phone: true, city: true, createdAt: true },
    });

    // Their order rows (lightweight columns) for stat aggregation.
    const ids = customers.map((c) => c.id);
    const orderRows = ids.length
      ? await prisma.order.findMany({
          where: { customerId: { in: ids } },
          select: { customerId: true, status: true, totalPrice: true, createdAt: true },
        })
      : [];

    const byCustomer = new Map<string, { status: string; totalPrice: number; createdAt: Date }[]>();
    for (const r of orderRows) {
      const arr = byCustomer.get(r.customerId) ?? [];
      arr.push({ status: r.status, totalPrice: r.totalPrice, createdAt: r.createdAt });
      byCustomer.set(r.customerId, arr);
    }

    let rows = customers.map((c) => {
      const stats = statsFromOrders(byCustomer.get(c.id) ?? []);
      return {
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        city: c.city,
        createdAt: c.createdAt,
        tag: computeTag(stats),
        ...stats,
      };
    });

    if (tag && (TAGS as readonly string[]).includes(tag)) {
      rows = rows.filter((r) => r.tag === (tag as CustomerTag));
    }

    const sign = dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (sort) {
        case "name":
          return sign * a.fullName.localeCompare(b.fullName, "ar");
        case "totalRevenue":
          return sign * (a.totalRevenue - b.totalRevenue);
        case "totalOrders":
          return sign * (a.totalOrders - b.totalOrders);
        case "createdAt":
          return sign * (a.createdAt.getTime() - b.createdAt.getTime());
        case "lastOrder":
        default: {
          const av = a.lastOrderDate ? Date.parse(a.lastOrderDate) : 0;
          const bv = b.lastOrderDate ? Date.parse(b.lastOrderDate) : 0;
          return sign * (av - bv);
        }
      }
    });

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    return json({
      ok: true,
      data: pageRows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    log("error", {
      reqId,
      msg: "customers_list_failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
