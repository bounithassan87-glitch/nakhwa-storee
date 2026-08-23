// GET /api/admin/orders — list orders with pagination, search, sort, filters.
// Reads only (no schema change). Runs on the Cloudflare Workers runtime.
//
// ⚠️ AUTH: this exposes customer PII (phone, address). It MUST be protected by
// real admin authentication/authorization before being deployed. See
// admin/ORDERS-MODULE.md §Security. It is currently used only in local dev.
import type { Prisma } from "@prisma/client";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { ORDER_STATUSES } from "../_lib/orderWorkflow";

const STATUSES = ORDER_STATUSES;
const SORT_FIELDS = ["createdAt", "totalPrice", "status"] as const;

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
  }
  return listOrders(ctx);
};

const listOrders: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim();
  const status = p.get("status") ?? "";
  const city = (p.get("city") ?? "").trim();
  const company = (p.get("company") ?? "").trim();
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
        { shipment: { is: { trackingNumber: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (city) and.push({ customer: { is: { city: { contains: city, mode: "insensitive" } } } });
  if (company) and.push({ shipment: { is: { company: { contains: company, mode: "insensitive" } } } });
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
    const [total, rows, grouped, companyRows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { [sort]: dir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        // The product name and slug come from the join, not from the free-text
        // `source` column: `source` is whatever a landing page called itself,
        // and with several storefronts sharing this dashboard it is not a
        // reliable answer to "which product is this".
        include: {
          customer: true,
          items: { include: { product: { select: { name: true, slug: true } } } },
          shipment: true,
        },
      }),
      // Global status snapshot for the shipping KPIs (unfiltered).
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      // Distinct shipping companies for the filter.
      prisma.shipment.findMany({
        where: { company: { not: null } },
        distinct: ["company"],
        select: { company: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const g of grouped) statusCounts[g.status] = g._count._all;

    const data = rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      quantity: o.quantity,
      totalPrice: o.totalPrice,
      currency: o.currency,
      status: o.status,
      paymentMethod: o.paymentMethod,
      // Which storefront the order came from — "landing" for the original
      // Nakhwa page, otherwise the product slug or whatever label that page
      // sent. Shown as the "المصدر" column.
      source: o.source,
      createdAt: o.createdAt,
      // Confirmation WhatsApp, so the drawer can show its state without a
      // second request. Read-only summary; the send path is server-side.
      whatsapp: {
        sent: o.whatsappConfirmationSent,
        sentAt: o.whatsappConfirmationSentAt,
        status: o.whatsappConfirmationStatus,
        error: o.whatsappConfirmationError,
      },
      customer: {
        fullName: o.customer.fullName,
        phone: o.customer.phone,
        city: o.customer.city,
        address: o.customer.address,
      },
      items: o.items.map((i) => ({ colorName: i.colorName, sizeLabel: i.sizeLabel })),
      // Which product was sold, and what one unit was charged at the time.
      // `unitPrice` is a snapshot: repricing the catalog never rewrites it.
      product: o.items[0]
        ? { name: o.items[0].product.name, slug: o.items[0].product.slug, unitPrice: o.items[0].unitPrice }
        : null,
      shipment: o.shipment
        ? { company: o.shipment.company, trackingNumber: o.shipment.trackingNumber, status: o.shipment.status }
        : null,
    }));

    return json({
      ok: true,
      data,
      statusCounts,
      companies: companyRows.map((c) => c.company).filter(Boolean),
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
