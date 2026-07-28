// GET /api/admin/analytics — read-only business-intelligence aggregates.
// No schema change. Auth-guarded by functions/api/admin/_middleware.ts.
//
// Query: ?range=today|yesterday|last7|last30|thisMonth|custom [&from=YYYY-MM-DD&to=YYYY-MM-DD]
//
// Metric scoping (documented in admin/ANALYTICS-MODULE.md):
//   • revenue overview (today/yesterday/last7/last30/total) — FIXED windows.
//   • customer tag distribution + performance — LIFETIME (all-time).
//   • orders-by-status, geography, products, timeseries, range totals — the
//     SELECTED range.
// "Revenue" everywhere excludes CANCELLED orders (booked, non-cancelled value).
// Day boundaries are UTC (see Future extension points in the docs).
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { statsFromOrders, computeTag, type CustomerTag } from "../_lib/customers";
import { ORDER_STATUSES } from "../_lib/orderWorkflow";

const DAY = 86_400_000;
const STATUSES = ORDER_STATUSES;

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function dayKey(d: Date): string {
  return startOfUTCDay(d).toISOString().slice(0, 10);
}

function resolveRange(key: string, fromStr: string | null, toStr: string | null) {
  const now = new Date();
  const todayStart = startOfUTCDay(now);
  const endToday = new Date(todayStart.getTime() + DAY - 1);
  switch (key) {
    case "today":
      return { key, from: todayStart, to: endToday };
    case "yesterday":
      return { key, from: new Date(todayStart.getTime() - DAY), to: new Date(todayStart.getTime() - 1) };
    case "last30":
      return { key, from: new Date(todayStart.getTime() - 29 * DAY), to: endToday };
    case "thisMonth":
      return { key, from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: endToday };
    case "custom": {
      const f = fromStr && !Number.isNaN(Date.parse(fromStr)) ? startOfUTCDay(new Date(fromStr)) : new Date(todayStart.getTime() - 6 * DAY);
      const t = toStr && !Number.isNaN(Date.parse(toStr)) ? new Date(startOfUTCDay(new Date(toStr)).getTime() + DAY - 1) : endToday;
      return { key: "custom", from: f, to: t };
    }
    case "last7":
    default:
      return { key: "last7", from: new Date(todayStart.getTime() - 6 * DAY), to: endToday };
  }
}

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
  }
  return analytics(ctx);
};

const analytics: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const p = new URL(request.url).searchParams;
  const range = resolveRange(p.get("range") ?? "last7", p.get("from"), p.get("to"));

  const prisma = getPrisma(dbUrl);
  try {
    const [allOrders, rangeOrders, totalCustomers] = await Promise.all([
      // All orders (scalar) — fixed windows, customer tags, performance.
      prisma.order.findMany({
        select: { status: true, totalPrice: true, createdAt: true, customerId: true },
      }),
      // Range orders with city + items — status/geography/products/timeseries.
      prisma.order.findMany({
        where: { createdAt: { gte: range.from, lte: range.to } },
        select: {
          status: true,
          totalPrice: true,
          createdAt: true,
          customer: { select: { city: true } },
          items: { select: { colorName: true, sizeLabel: true, product: { select: { name: true } } } },
        },
      }),
      prisma.customer.count(),
    ]);

    const notCancelled = (s: string) => s !== "CANCELLED";
    const todayStart = startOfUTCDay(new Date()).getTime();
    const sumIf = (pred: (o: (typeof allOrders)[number]) => boolean) =>
      allOrders.reduce((acc, o) => (pred(o) ? acc + o.totalPrice : acc), 0);

    // ── Revenue overview (fixed windows, non-cancelled) ──
    const revenue = {
      today: sumIf((o) => notCancelled(o.status) && o.createdAt.getTime() >= todayStart),
      yesterday: sumIf(
        (o) => notCancelled(o.status) && o.createdAt.getTime() >= todayStart - DAY && o.createdAt.getTime() < todayStart,
      ),
      last7: sumIf((o) => notCancelled(o.status) && o.createdAt.getTime() >= todayStart - 6 * DAY),
      last30: sumIf((o) => notCancelled(o.status) && o.createdAt.getTime() >= todayStart - 29 * DAY),
      total: sumIf((o) => notCancelled(o.status)),
    };

    // ── Orders (range-scoped status + fixed "today") ──
    const byStatus: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    let rangeRevenue = 0;
    for (const o of rangeOrders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      if (notCancelled(o.status)) rangeRevenue += o.totalPrice;
    }
    const rangeTotal = rangeOrders.length;
    const orders = {
      today: allOrders.filter((o) => o.createdAt.getTime() >= todayStart).length,
      total: rangeTotal,
      revenue: rangeRevenue,
      byStatus,
      cancellationRate: rangeTotal ? byStatus.CANCELLED / rangeTotal : 0,
    };

    // ── Customers (lifetime tag distribution) ──
    const byCustomer = new Map<string, { status: string; totalPrice: number; createdAt: Date }[]>();
    for (const o of allOrders) {
      const arr = byCustomer.get(o.customerId) ?? [];
      arr.push({ status: o.status, totalPrice: o.totalPrice, createdAt: o.createdAt });
      byCustomer.set(o.customerId, arr);
    }
    const tagCounts: Record<CustomerTag, number> = { NEW: 0, RETURNING: 0, VIP: 0, HIGH_RISK: 0 };
    let repeatCustomers = 0;
    for (const orderList of byCustomer.values()) {
      const s = statsFromOrders(orderList);
      tagCounts[computeTag(s)]++;
      if (s.totalOrders >= 2) repeatCustomers++;
    }
    const customers = {
      total: totalCustomers,
      new: tagCounts.NEW,
      returning: tagCounts.RETURNING,
      vip: tagCounts.VIP,
      highRisk: tagCounts.HIGH_RISK,
    };

    // ── Performance (lifetime) ──
    const nonCancelledCount = allOrders.filter((o) => notCancelled(o.status)).length;
    const performance = {
      avgOrderValue: nonCancelledCount ? Math.round(revenue.total / nonCancelledCount) : 0,
      revenuePerCustomer: totalCustomers ? Math.round(revenue.total / totalCustomers) : 0,
      repeatPurchaseRate: totalCustomers ? repeatCustomers / totalCustomers : 0,
    };

    // ── Geography (range) ──
    const cityMap = new Map<string, { city: string; orders: number; revenue: number }>();
    for (const o of rangeOrders) {
      const city = o.customer.city || "غير محدد";
      const entry = cityMap.get(city) ?? { city, orders: 0, revenue: 0 };
      entry.orders++;
      if (notCancelled(o.status)) entry.revenue += o.totalPrice;
      cityMap.set(city, entry);
    }
    const cities = [...cityMap.values()].sort((a, b) => b.orders - a.orders);
    const geography = { cities, top: cities.slice(0, 5) };

    // ── Products (range, non-cancelled pieces) ──
    const prod = new Map<string, number>();
    const colors = new Map<string, number>();
    const sizes = new Map<string, number>();
    for (const o of rangeOrders) {
      if (!notCancelled(o.status)) continue;
      for (const it of o.items) {
        prod.set(it.product.name, (prod.get(it.product.name) ?? 0) + 1);
        colors.set(it.colorName, (colors.get(it.colorName) ?? 0) + 1);
        sizes.set(it.sizeLabel, (sizes.get(it.sizeLabel) ?? 0) + 1);
      }
    }
    const topList = (m: Map<string, number>) =>
      [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const products = { products: topList(prod), colors: topList(colors), sizes: topList(sizes) };

    // ── Timeseries (range, daily buckets) ──
    const buckets = new Map<string, { date: string; revenue: number; orders: number }>();
    for (
      let t = startOfUTCDay(range.from).getTime();
      t <= range.to.getTime();
      t += DAY
    ) {
      const k = new Date(t).toISOString().slice(0, 10);
      buckets.set(k, { date: k, revenue: 0, orders: 0 });
    }
    for (const o of rangeOrders) {
      const k = dayKey(o.createdAt);
      const b = buckets.get(k);
      if (!b) continue;
      b.orders++;
      if (notCancelled(o.status)) b.revenue += o.totalPrice;
    }
    const timeseries = [...buckets.values()];

    return json({
      ok: true,
      range: { key: range.key, from: range.from.toISOString(), to: range.to.toISOString() },
      revenue,
      orders,
      customers,
      performance,
      geography,
      products,
      timeseries,
    });
  } catch (err) {
    log("error", {
      reqId,
      msg: "analytics_failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
