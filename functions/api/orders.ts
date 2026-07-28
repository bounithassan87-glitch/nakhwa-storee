// POST /api/orders — validate and persist a submitted order to PostgreSQL.
// Runs as a Cloudflare Pages Function (Workers runtime). Cross-cutting concerns
// (logging, request id, security headers, error boundary) live in _middleware.ts.
import { z } from "zod";
import type { AppFunction } from "../_lib/context";
import { resolveDatabaseUrl } from "../_lib/env";
import { getPrisma } from "../_lib/db";
import { json, log } from "../_lib/http";
import { COLORS, SIZES, PRICE_BY_QTY, CURRENCY, PRODUCT } from "../../shared/catalog.js";

const itemSchema = z.object({
  size: z.enum(SIZES as [string, ...string[]]),
  color: z.enum(COLORS as [string, ...string[]]),
});

const orderSchema = z
  .object({
    fullname: z.string().trim().min(2).max(100),
    phone: z.string().trim().regex(/^0[5-7][0-9]{8}$/, "invalid_moroccan_phone"),
    city: z.string().trim().min(2).max(80),
    address: z.string().trim().min(3).max(200),
    quantity: z.union([z.literal(1), z.literal(2)]),
    items: z.array(itemSchema).min(1).max(2),
  })
  .refine((d) => d.items.length === d.quantity, {
    message: "items_length_must_equal_quantity",
    path: ["items"],
  });

function orderNumber(): string {
  return (
    "NK-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

// Only POST is allowed; anything else returns a clean 405.
export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  return handleCreateOrder(ctx);
};

const handleCreateOrder: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) {
    log("warn", { reqId, msg: "order_validation_failed", issues: parsed.error.flatten().fieldErrors });
    return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);
  }
  const order = parsed.data;

  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) {
    log("error", { reqId, msg: "database_not_configured" });
    return json({ ok: false, error: "database_not_configured" }, 503);
  }

  const prisma = getPrisma(dbUrl);
  try {
    const product = await prisma.product.findUnique({ where: { slug: PRODUCT.slug } });
    if (!product) {
      log("error", { reqId, msg: "product_unavailable", slug: PRODUCT.slug });
      return json({ ok: false, error: "product_unavailable" }, 503);
    }

    const total = PRICE_BY_QTY[order.quantity as 1 | 2];

    const customer = await prisma.customer.upsert({
      where: { phone: order.phone },
      update: { fullName: order.fullname, city: order.city, address: order.address },
      create: { fullName: order.fullname, phone: order.phone, city: order.city, address: order.address },
    });

    const created = await prisma.order.create({
      data: {
        orderNumber: orderNumber(),
        customerId: customer.id,
        quantity: order.quantity,
        totalPrice: total,
        currency: CURRENCY,
        items: {
          create: order.items.map((it) => ({
            productId: product.id,
            colorName: it.color,
            sizeLabel: it.size,
            unitPrice: product.basePrice,
          })),
        },
      },
      select: { orderNumber: true, quantity: true, totalPrice: true, currency: true },
    });

    log("info", { reqId, msg: "order_created", orderNumber: created.orderNumber, quantity: created.quantity });
    return json(
      { ok: true, orderNumber: created.orderNumber, quantity: created.quantity, total: created.totalPrice, currency: created.currency },
      201,
    );
  } catch (err) {
    log("error", { reqId, msg: "order_create_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
  // Note: no per-request $disconnect() — closing the pool here can drop an
  // in-flight commit in the Workers runtime. The isolate reclaims it.
};
