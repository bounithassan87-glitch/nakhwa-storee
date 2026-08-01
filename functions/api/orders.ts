// POST /api/orders — validate and persist a submitted order to PostgreSQL.
// Runs as a Cloudflare Pages Function (Workers runtime). Cross-cutting concerns
// (logging, request id, security headers, error boundary) live in _middleware.ts.
//
// One endpoint serves every storefront. A landing page that sends `productSlug`
// is priced and validated against that product's own row in the database; the
// original Nakhwa page, which sends no slug, keeps the exact behaviour it had
// before multi-product support existed. Adding a storefront therefore needs a
// product in the catalog and nothing here.
import { z } from "zod";
import type { AppFunction } from "../_lib/context";
import { resolveDatabaseUrl } from "../_lib/env";
import { getPrisma } from "../_lib/db";
import { json, log } from "../_lib/http";
import { COLORS, SIZES, PRICE_BY_QTY, CURRENCY, PRODUCT } from "../../shared/catalog.js";

/**
 * Cross-origin access for storefronts hosted elsewhere.
 *
 * `*` is appropriate here and does not weaken anything: the endpoint carries no
 * cookie or credential, so a browser's same-origin policy was never what
 * protected it — any client could always POST to it directly. Opening it is
 * what lets a new landing page work without touching this file.
 */
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

const reply = (body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) =>
  json(body, status, { ...CORS, ...headers });

/** Fields every storefront sends, whatever it is selling. */
const customerFields = {
  phone: z.string().trim().regex(/^0[5-7][0-9]{8}$/, "invalid_moroccan_phone"),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(3).max(200),
  note: z.string().trim().max(500).optional(),
  /** Which landing page this came from; shown as "المصدر" in the dashboard. */
  source: z.string().trim().min(1).max(60).optional(),
};

/**
 * The original Nakhwa payload. Untouched: same enums, same 1-or-2 quantity,
 * same `items` array. Any request without `productSlug` still goes through
 * exactly this, so the live page cannot regress.
 */
const legacySchema = z
  .object({
    ...customerFields,
    fullname: z.string().trim().min(2).max(100),
    quantity: z.union([z.literal(1), z.literal(2)]),
    items: z
      .array(
        z.object({
          size: z.enum(SIZES as [string, ...string[]]),
          color: z.enum(COLORS as [string, ...string[]]),
        }),
      )
      .min(1)
      .max(2),
  })
  .refine((d) => d.items.length === d.quantity, {
    message: "items_length_must_equal_quantity",
    path: ["items"],
  });

/**
 * The catalog payload, used by every other storefront.
 *
 * Colour and size are plain strings here rather than enums — they are checked
 * against the product's own rows once it has been loaded, which is what makes
 * this work for a product nobody has told this file about. `productName` is
 * accepted so a caller may send it, then ignored: any name that is displayed
 * comes from the database row, never from the request.
 */
const catalogSchema = z
  .object({
    ...customerFields,
    productSlug: z.string().trim().min(1).max(150),
    productName: z.string().trim().max(150).optional(),
    fullname: z.string().trim().min(2).max(100).optional(),
    customerName: z.string().trim().min(2).max(100).optional(),
    quantity: z.number().int().min(1).max(10).default(1),
    color: z.string().trim().min(1).max(80).optional(),
    size: z.string().trim().min(1).max(80).optional(),
    items: z
      .array(z.object({ size: z.string().trim().max(80), color: z.string().trim().max(80) }))
      .min(1)
      .max(10)
      .optional(),
  })
  .refine((d) => Boolean(d.fullname ?? d.customerName), {
    message: "name_required",
    path: ["customerName"],
  });

function orderNumber(): string {
  return (
    "NK-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

export const onRequest: AppFunction = async (ctx) => {
  // Preflight for cross-origin storefronts.
  if (ctx.request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (ctx.request.method !== "POST") {
    return reply({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST, OPTIONS" });
  }
  return handleCreateOrder(ctx);
};

const handleCreateOrder: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return reply({ ok: false, error: "invalid_json" }, 400);
  }

  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) {
    log("error", { reqId, msg: "database_not_configured" });
    return reply({ ok: false, error: "database_not_configured" }, 503);
  }
  const prisma = getPrisma(dbUrl);

  // Presence of `productSlug` is what selects the path — nothing else about the
  // request is inspected first, so the legacy shape can never be misrouted.
  const usesCatalog =
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { productSlug?: unknown }).productSlug === "string";

  try {
    return usesCatalog
      ? await createCatalogOrder(prisma, raw, reqId)
      : await createLegacyOrder(prisma, raw, reqId);
  } catch (err) {
    log("error", { reqId, msg: "order_create_failed", error: err instanceof Error ? err.message : String(err) });
    return reply({ ok: false, error: "server_error" }, 500);
  }
  // Note: no per-request $disconnect() — closing the pool here can drop an
  // in-flight commit in the Workers runtime. The isolate reclaims it.
};

type PrismaClient = ReturnType<typeof getPrisma>;

interface PersistInput {
  fullname: string;
  phone: string;
  city: string;
  address: string;
  note: string | null;
  source: string;
  quantity: number;
  total: number;
  currency: string;
  productId: string;
  unitPrice: number;
  items: { size: string; color: string }[];
}

/** The original Nakhwa flow, behaviour-for-behaviour as it was. */
async function createLegacyOrder(prisma: PrismaClient, raw: unknown, reqId: string | undefined) {
  const parsed = legacySchema.safeParse(raw);
  if (!parsed.success) {
    log("warn", { reqId, msg: "order_validation_failed", issues: parsed.error.flatten().fieldErrors });
    return reply({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);
  }
  const order = parsed.data;

  const product = await prisma.product.findUnique({ where: { slug: PRODUCT.slug } });
  if (!product) {
    log("error", { reqId, msg: "product_unavailable", slug: PRODUCT.slug });
    return reply({ ok: false, error: "product_unavailable" }, 503);
  }

  return persist(prisma, reqId, {
    fullname: order.fullname,
    phone: order.phone,
    city: order.city,
    address: order.address,
    note: order.note ?? null,
    source: order.source ?? "landing",
    quantity: order.quantity,
    total: PRICE_BY_QTY[order.quantity],
    currency: CURRENCY,
    productId: product.id,
    unitPrice: product.basePrice,
    items: order.items,
  });
}

/**
 * Any storefront that names its product.
 *
 * The price is read from the product row and never from the request — a client
 * can ask for a product, not for what it costs.
 */
async function createCatalogOrder(prisma: PrismaClient, raw: unknown, reqId: string | undefined) {
  const parsed = catalogSchema.safeParse(raw);
  if (!parsed.success) {
    log("warn", { reqId, msg: "order_validation_failed", issues: parsed.error.flatten().fieldErrors });
    return reply({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);
  }
  const order = parsed.data;

  const product = await prisma.product.findUnique({
    where: { slug: order.productSlug },
    include: { colors: { where: { isActive: true } }, sizes: true },
  });
  if (!product || !product.isActive || product.status !== "ACTIVE") {
    log("warn", { reqId, msg: "product_unavailable", slug: order.productSlug });
    return reply({ ok: false, error: "product_unavailable" }, 503);
  }

  // One entry per unit, so an order of three becomes three OrderItem rows —
  // the same shape the two-piece Nakhwa order already produces.
  const items =
    order.items ??
    Array.from({ length: order.quantity }, () => ({
      size: order.size ?? "",
      color: order.color ?? "",
    }));

  if (items.length !== order.quantity) {
    return reply(
      { ok: false, error: "validation_error", details: { items: ["items_length_must_equal_quantity"] } },
      422,
    );
  }

  // Checked against what the product actually offers. A product with no colours
  // or sizes configured accepts anything, so a single-variant landing page
  // needs no catalog setup beyond the product itself.
  const colours = product.colors.map((c) => c.name);
  const sizes = product.sizes.map((s) => s.label);
  for (const it of items) {
    if (colours.length > 0 && !colours.includes(it.color)) {
      return reply({ ok: false, error: "invalid_color", allowed: colours }, 422);
    }
    if (sizes.length > 0 && !sizes.includes(it.size)) {
      return reply({ ok: false, error: "invalid_size", allowed: sizes }, 422);
    }
  }

  // The selling price, from the database.
  const unitPrice = product.offerPrice ?? product.basePrice;

  return persist(prisma, reqId, {
    fullname: (order.fullname ?? order.customerName)!,
    phone: order.phone,
    city: order.city,
    address: order.address,
    note: order.note ?? null,
    // Defaults to the slug, so the dashboard can always tell storefronts apart
    // even when a page does not label itself.
    source: order.source ?? order.productSlug,
    quantity: order.quantity,
    total: unitPrice * order.quantity,
    currency: product.currency,
    productId: product.id,
    unitPrice,
    items,
  });
}

/** Shared write path: upsert the customer, then create the order and its items. */
async function persist(prisma: PrismaClient, reqId: string | undefined, o: PersistInput) {
  const customer = await prisma.customer.upsert({
    where: { phone: o.phone },
    update: { fullName: o.fullname, city: o.city, address: o.address },
    create: { fullName: o.fullname, phone: o.phone, city: o.city, address: o.address },
  });

  const created = await prisma.order.create({
    data: {
      orderNumber: orderNumber(),
      customerId: customer.id,
      quantity: o.quantity,
      totalPrice: o.total,
      currency: o.currency,
      note: o.note,
      source: o.source,
      items: {
        create: o.items.map((it) => ({
          productId: o.productId,
          colorName: it.color,
          sizeLabel: it.size,
          unitPrice: o.unitPrice,
        })),
      },
    },
    select: { orderNumber: true, quantity: true, totalPrice: true, currency: true },
  });

  log("info", {
    reqId,
    msg: "order_created",
    orderNumber: created.orderNumber,
    quantity: created.quantity,
    source: o.source,
  });

  return reply(
    {
      ok: true,
      orderNumber: created.orderNumber,
      quantity: created.quantity,
      total: created.totalPrice,
      currency: created.currency,
    },
    201,
  );
}
