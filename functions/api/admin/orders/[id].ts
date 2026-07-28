// GET   /api/admin/orders/:id — full order: customer, items, shipment, timeline.
// PATCH /api/admin/orders/:id — validated status transition (+ optional note).
//   Writes an OrderEvent to the timeline; sets shipment.deliveredAt on DELIVERED.
// Auth + CSRF enforced by the admin _middleware.
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { canTransition, isOrderStatus, ORDER_STATUSES, type OrderStatus } from "../_lib/orderWorkflow";

const bodySchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "GET") return getOrder(ctx);
  if (ctx.request.method === "PATCH") return transition(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, PATCH" });
};

async function loadDetail(prisma: ReturnType<typeof getPrisma>, id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: true,
      shipment: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    quantity: order.quantity,
    totalPrice: order.totalPrice,
    currency: order.currency,
    status: order.status,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: {
      fullName: order.customer.fullName,
      phone: order.customer.phone,
      city: order.customer.city,
      address: order.customer.address,
    },
    items: order.items.map((i) => ({ colorName: i.colorName, sizeLabel: i.sizeLabel })),
    shipment: order.shipment,
    timeline: order.events.map((e) => ({
      id: e.id,
      status: e.status,
      note: e.note,
      actor: e.actor,
      createdAt: e.createdAt,
    })),
  };
}

const getOrder: AppFunction = async ({ env, params, data }) => {
  const reqId = data.reqId;
  const id = String(params.id ?? "");
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const prisma = getPrisma(dbUrl);
  try {
    const detail = await loadDetail(prisma, id);
    if (!detail) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true, data: detail });
  } catch (err) {
    log("error", { reqId, msg: "order_get_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const transition: AppFunction = async ({ request, env, params, data }) => {
  const reqId = data.reqId;
  const actor = data.admin?.email ?? null;
  const id = String(params.id ?? "");
  if (!id) return json({ ok: false, error: "missing_id" }, 400);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);
  }
  const target = parsed.data.status as OrderStatus;

  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const prisma = getPrisma(dbUrl);
  try {
    const current = await prisma.order.findUnique({ where: { id }, select: { status: true } });
    if (!current) return json({ ok: false, error: "not_found" }, 404);
    if (!isOrderStatus(current.status)) return json({ ok: false, error: "server_error" }, 500);

    if (current.status === target) {
      return json({ ok: false, error: "no_change", from: current.status }, 409);
    }
    if (!canTransition(current.status, target)) {
      return json({ ok: false, error: "invalid_transition", from: current.status, to: target }, 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: target } });
      await tx.orderEvent.create({
        data: { orderId: id, status: target, note: parsed.data.note ?? null, actor },
      });
      // On delivery, stamp the shipment's delivery date (if a shipment exists).
      if (target === "DELIVERED") {
        await tx.shipment.updateMany({
          where: { orderId: id, deliveredAt: null },
          data: { deliveredAt: new Date(), status: "DELIVERED" },
        });
      }
    });

    log("info", { reqId, msg: "order_transition", id, from: current.status, to: target, actor });
    const detail = await loadDetail(prisma, id);
    return json({ ok: true, data: detail });
  } catch (err) {
    log("error", { reqId, msg: "order_transition_failed", id, error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
