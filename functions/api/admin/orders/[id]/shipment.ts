// PUT /api/admin/orders/:id/shipment — create/update the shipment record for an
// order (company, tracking, costs, dates, carrier status). Auth + CSRF enforced.
import { z } from "zod";
import type { Env } from "../../../../_lib/env";
import { resolveDatabaseUrl } from "../../../../_lib/env";
import { getPrisma } from "../../../../_lib/db";
import { json, log } from "../../../../_lib/http";

const nullableDate = z
  .string()
  .trim()
  .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), "invalid_date")
  .nullable()
  .optional();

const bodySchema = z.object({
  company: z.string().trim().max(120).nullable().optional(),
  trackingNumber: z.string().trim().max(120).nullable().optional(),
  shippingCost: z.number().int().min(0).nullable().optional(),
  codAmount: z.number().int().min(0).nullable().optional(),
  estimatedDeliveryAt: nullableDate,
  deliveredAt: nullableDate,
  status: z.string().trim().max(80).nullable().optional(),
});

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "PUT" && ctx.request.method !== "PATCH") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "PUT, PATCH" });
  }
  return upsertShipment(ctx);
};

const toDate = (v: string | null | undefined): Date | null | undefined =>
  v === undefined ? undefined : v === null || v === "" ? null : new Date(v);

const upsertShipment: PagesFunction<Env> = async ({ request, env, params, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const orderId = String(params.id ?? "");
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

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
  const b = parsed.data;
  const fields = {
    company: b.company,
    trackingNumber: b.trackingNumber,
    shippingCost: b.shippingCost,
    codAmount: b.codAmount,
    estimatedDeliveryAt: toDate(b.estimatedDeliveryAt),
    deliveredAt: toDate(b.deliveredAt),
    status: b.status,
  };

  const prisma = getPrisma(dbUrl);
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) return json({ ok: false, error: "not_found" }, 404);

    const shipment = await prisma.shipment.upsert({
      where: { orderId },
      update: fields,
      create: { orderId, ...fields },
    });
    return json({ ok: true, data: shipment });
  } catch (err) {
    log("error", { reqId, msg: "shipment_upsert_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
