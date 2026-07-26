// GET /api/admin/customers/:id — one customer profile: identity, derived CRM
// stats + tag, and full order history. Read-only (no schema change).
// Auth-guarded by functions/api/admin/_middleware.ts.
import type { Env } from "../../../_lib/env";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { statsFromOrders, computeTag } from "../_lib/customers";

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
  }
  return getCustomer(ctx);
};

const getCustomer: PagesFunction<Env> = async ({ params, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const id = String(params.id ?? "");
  if (!id) return json({ ok: false, error: "not_found" }, 404);

  const prisma = getPrisma(dbUrl);
  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: { items: true },
        },
      },
    });
    if (!customer) return json({ ok: false, error: "not_found" }, 404);

    const stats = statsFromOrders(
      customer.orders.map((o) => ({ status: o.status, totalPrice: o.totalPrice, createdAt: o.createdAt })),
    );

    return json({
      ok: true,
      data: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        city: customer.city,
        address: customer.address,
        createdAt: customer.createdAt,
        tag: computeTag(stats),
        ...stats,
        orders: customer.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          quantity: o.quantity,
          totalPrice: o.totalPrice,
          currency: o.currency,
          status: o.status,
          paymentMethod: o.paymentMethod,
          createdAt: o.createdAt,
          items: o.items.map((i) => ({ colorName: i.colorName, sizeLabel: i.sizeLabel })),
        })),
      },
    });
  } catch (err) {
    log("error", {
      reqId,
      msg: "customer_get_failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
