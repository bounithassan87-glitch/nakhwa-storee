// GET /api/admin/orders/stats — lightweight live-poll endpoint for real-time
// order notifications. Returns the total order count, how many orders are newer
// than an optional `since` timestamp, and a minimal snapshot of the latest order
// (for the toast). Reads only — no schema change.
//
// This is intentionally cheap (a COUNT + a single findFirst) so the admin
// dashboard can poll it every ~12s without loading the full, filtered orders
// list. It is protected by the admin _middleware like every other /api/admin/*
// route (401 when unauthenticated).
import type { Env } from "../../../_lib/env";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
  }
  return orderStats(ctx);
};

const orderStats: PagesFunction<Env> = async ({ request, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const sinceRaw = new URL(request.url).searchParams.get("since");
  let since: Date | null = null;
  if (sinceRaw) {
    const d = new Date(sinceRaw);
    if (!Number.isNaN(d.getTime())) since = d;
  }

  const prisma = getPrisma(dbUrl);
  try {
    const [total, newCount, latest] = await Promise.all([
      prisma.order.count(),
      since ? prisma.order.count({ where: { createdAt: { gt: since } } }) : Promise.resolve(0),
      prisma.order.findFirst({
        orderBy: { createdAt: "desc" },
        include: { customer: true },
      }),
    ]);

    return json({
      ok: true,
      total,
      newCount,
      serverTime: new Date().toISOString(),
      latest: latest
        ? {
            id: latest.id,
            orderNumber: latest.orderNumber,
            createdAt: latest.createdAt,
            totalPrice: latest.totalPrice,
            currency: latest.currency,
            customerName: latest.customer.fullName,
            city: latest.customer.city,
          }
        : null,
    });
  } catch (err) {
    log("error", {
      reqId,
      msg: "orders_stats_failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
