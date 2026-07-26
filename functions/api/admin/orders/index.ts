// GET /api/admin/orders — list orders with pagination, search, sort, filters.
// Reads only (no schema change). Runs on the Cloudflare Workers runtime.
//
// ⚠️ AUTH: this exposes customer PII (phone, address). It MUST be protected by
// real admin authentication/authorization before being deployed. See
// admin/ORDERS-MODULE.md §Security. It is currently used only in local dev.
import type { Prisma } from "@prisma/client";
import type { Env } from "../../../_lib/env";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";

const STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
const SORT_FIELDS = ["createdAt", "totalPrice", "status"] as const;

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
  }
  return listOrders(ctx);
};

const listOrders: PagesFunction<Env> = async ({ request, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim();
  const status = p.get("status") ?? "";
  const city = (p.get("city") ?? "").trim();
  const dateFrom = p.get("dateFrom");
  const dateTo = p.get("dateTo");
  const sort = (SORT_FIELDS as readonly string[]).includes(p.get("sort") ?? "")
    ? (p.get("sort") as (typeof SORT_FIELDS)[number])
    : "createdAt";
  const dir = p.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(p.get("pageSize") ?? "10", 10) || 10));

  const where: Prisma.OrderWhereInput = {};
  const and: Prisma.OrderWhereInput[] = [];
  if (status && (STATUSES as readonly string[]).includes(status)) {
    where.status = status as (typeof STATUSES)[number];
  }
  if (q) {
    and.push({
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { customer: { is: { fullName: { contains: q, mode: "insensitive" } } } },
        { customer: { is: { phone: { contains: q } } } },
      ],
    });
  }
  if (city) and.push({ customer: { is: { city: { contains: city, mode: "insensitive" } } } });
  if (dateFrom || dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      createdAt.lte = d;
    }
    and.push({ createdAt });
  }
  if (and.length) where.AND = and;

  const prisma = getPrisma(dbUrl);
  try {
    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { [sort]: dir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: true, items: true },
      }),
    ]);

    const data = rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      quantity: o.quantity,
      totalPrice: o.totalPrice,
      currency: o.currency,
      status: o.status,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt,
      customer: {
        fullName: o.customer.fullName,
        phone: o.customer.phone,
        city: o.customer.city,
        address: o.customer.address,
      },
      items: o.items.map((i) => ({ colorName: i.colorName, sizeLabel: i.sizeLabel })),
    }));

    return json({
      ok: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    log("error", { reqId, msg: "orders_list_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
