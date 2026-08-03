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
import { sendPush, DASHBOARD_ORDERS_URL, PUSH_ICON_URL } from "./_lib/fcm";
import { sendCapiEvent, clientSignals } from "./_lib/capi";
import { createRateLimiter } from "./_lib/ratelimit";
import { COLORS, SIZES, PRICE_BY_QTY, CURRENCY, PRODUCT } from "../../shared/catalog.js";

/** Setting row holding what FCM answered for the most recent order. */
const PUSH_LAST_RESULT_KEY = "push_last_result";
/** Setting row holding what Meta answered for the most recent Lead. */
const CAPI_LAST_RESULT_KEY = "capi_last_result";

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

  // Meta attribution. All optional, and shared by every payload shape, so a
  // landing page that sends them gets deduplicated server-side conversions and
  // one that does not still orders exactly as before. That is what lets a new
  // storefront work without touching this file: send the fields or don't.
  /** Must equal the `eventID` the page gave fbq, or Meta counts the Lead twice. */
  eventId: z.string().trim().min(8).max(100).optional(),
  fbp: z.string().trim().max(200).optional(),
  fbc: z.string().trim().max(400).optional(),
  externalId: z.string().trim().max(100).optional(),
  eventSourceUrl: z.string().trim().url().max(500).optional(),
  email: z.string().trim().email().max(200).optional(),
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

/**
 * Flood brake on the public checkout.
 *
 * The endpoint is unauthenticated by necessity and every accepted request costs
 * three customer rows, a push to the owner's phone and a Lead to Meta. Without
 * a ceiling, a script can bury real orders in noise, make the notification
 * useless, and train ad optimisation on conversions that never happened.
 *
 * The threshold is set far above any human: thirty a minute from one address is
 * an order every two seconds, sustained. A shared carrier NAT — normal on
 * Moroccan mobile — will not reach it, and a customer retrying a rejected form
 * is nowhere near it. That is deliberate. A limit tight enough to bite an
 * attacker meaningfully would eventually bite a real buyer, and losing one sale
 * costs more than the abuse this prevents.
 *
 * It is a speed bump, not a wall: the counter lives in one Worker isolate, so a
 * distributed flood gets a budget per isolate. Cloudflare's own WAF rate
 * limiting is the real control and belongs in front of this.
 */
const orderLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export const onRequest: AppFunction = async (ctx) => {
  // Preflight for cross-origin storefronts.
  if (ctx.request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (ctx.request.method !== "POST") {
    return reply({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST, OPTIONS" });
  }

  // Fails open on purpose. If anything here throws, the order proceeds: a
  // checkout must never be lost to its own abuse protection.
  try {
    const ip = ctx.request.headers.get("cf-connecting-ip");
    if (ip) {
      const rl = orderLimiter.hit(ip);
      if (rl.blocked) {
        log("warn", { reqId: ctx.data.reqId, msg: "order_rate_limited" });
        return reply({ ok: false, error: "too_many_requests" }, 429, {
          "retry-after": String(rl.retryAfter),
        });
      }
    }
  } catch {
    /* never block a sale on the limiter */
  }

  return handleCreateOrder(ctx);
};

const handleCreateOrder: AppFunction = async ({ request, env, data, waitUntil }) => {
  const reqId = data.reqId;
  const push: DeferredContext = {
    serviceAccount: env.FIREBASE_SERVICE_ACCOUNT,
    metaToken: env.META_ACCESS_TOKEN,
    metaTestCode: env.META_TEST_EVENT_CODE,
    ...clientSignals(request),
    referer: request.headers.get("referer") ?? undefined,
    waitUntil: (p) => waitUntil(p),
  };

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
      ? await createCatalogOrder(prisma, raw, reqId, push)
      : await createLegacyOrder(prisma, raw, reqId, push);
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
  productName: string;
  unitPrice: number;
  items: { size: string; color: string }[];
  /** Meta attribution passed through from the request; absent is normal. */
  meta?: MetaFields;
}

interface MetaFields {
  eventId?: string;
  fbp?: string;
  fbc?: string;
  externalId?: string;
  eventSourceUrl?: string;
  email?: string;
}

/** Lift the attribution fields off a validated order, whatever its shape. */
function metaFrom(order: MetaFields): MetaFields {
  return {
    eventId: order.eventId,
    fbp: order.fbp,
    fbc: order.fbc,
    externalId: order.externalId,
    eventSourceUrl: order.eventSourceUrl,
    email: order.email,
  };
}

/**
 * What `persist` needs for the work that happens after the customer has their
 * confirmation: the new-order notification, and the server-side Lead.
 *
 * Both are deferred through `waitUntil` for the same reason — neither a push
 * service nor an ad platform is allowed to hold up a sale.
 */
interface DeferredContext {
  serviceAccount?: string;
  metaToken?: string;
  metaTestCode?: string;
  /** Read from the edge request, never from the body. */
  clientIpAddress?: string;
  clientUserAgent?: string;
  /** Fallback when the page did not name its own URL. */
  referer?: string;
  waitUntil: (p: Promise<unknown>) => void;
}

/** The original Nakhwa flow, behaviour-for-behaviour as it was. */
async function createLegacyOrder(
  prisma: PrismaClient,
  raw: unknown,
  reqId: string | undefined,
  push?: DeferredContext,
) {
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
    productName: product.name,
    unitPrice: product.basePrice,
    items: order.items,
    meta: metaFrom(order),
  }, push);
}

/**
 * Any storefront that names its product.
 *
 * The price is read from the product row and never from the request — a client
 * can ask for a product, not for what it costs.
 */
async function createCatalogOrder(
  prisma: PrismaClient,
  raw: unknown,
  reqId: string | undefined,
  push?: DeferredContext,
) {
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
    productName: product.name,
    unitPrice,
    items,
    meta: metaFrom(order),
  }, push);
}

/**
 * Fan a "new order" notification out to every registered device.
 *
 * Runs after the response has been sent and swallows everything: an order is
 * recorded whether or not anyone could be told about it, and the dashboard's
 * own sound/popup/badge do not depend on this path.
 */
async function notifyDevices(
  prisma: PrismaClient,
  push: DeferredContext,
  reqId: string | undefined,
  o: PersistInput,
  orderId: string,
): Promise<void> {
  try {
    const devices = await prisma.pushToken.findMany({ select: { token: true } });
    if (devices.length === 0) return;

    const result = await sendPush(
      push.serviceAccount,
      devices.map((d) => d.token),
      {
        title: "🛒 طلب جديد",
        body: [
          `المنتج: ${o.productName}`,
          `الزبون: ${o.fullname}`,
          `المدينة: ${o.city}`,
          `المبلغ: ${o.total / 100} DH`,
        ].join("\n"),
        link: DASHBOARD_ORDERS_URL,
        icon: PUSH_ICON_URL,
        // The order id, so a repeat delivery replaces rather than stacks.
        tag: orderId,
      },
      reqId,
    );

    // Prune devices FCM says are gone, so the list does not grow stale.
    if (result.invalid.length > 0) {
      await prisma.pushToken.deleteMany({ where: { token: { in: result.invalid } } });
    }
    log("info", { reqId, msg: "push_sent", sent: result.sent, pruned: result.invalid.length, skipped: result.skipped });
    await recordPushResult(prisma, devices.length, result);
  } catch (err) {
    log("warn", { reqId, msg: "push_failed", error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Report the sale to Meta, from the server.
 *
 * Fired here rather than accepted from the browser because this is the only
 * place that knows the order exists: it runs after the row is committed, so a
 * Lead can never be reported for an order that failed, and it still fires for a
 * customer whose pixel was blocked or who closed the tab on the confirmation.
 *
 * The event id comes from the page, and is the same one it gave fbq — that is
 * what lets Meta drop whichever copy arrives second. A page that sends no id
 * gets one generated here: the event is still recorded, there is simply no
 * browser event to reconcile it with, which is exactly right for a storefront
 * that has no pixel of its own.
 */
async function reportLead(
  prisma: PrismaClient,
  ctx: DeferredContext,
  reqId: string | undefined,
  o: PersistInput,
  orderNumber: string,
): Promise<void> {
  try {
    const meta = o.meta ?? {};
    const result = await sendCapiEvent(
      ctx.metaToken,
      {
        eventName: "Lead",
        eventId: meta.eventId ?? `srv-${orderNumber}`,
        eventSourceUrl: meta.eventSourceUrl ?? ctx.referer,
        user: {
          clientIpAddress: ctx.clientIpAddress,
          clientUserAgent: ctx.clientUserAgent,
          fbp: meta.fbp,
          fbc: meta.fbc,
          externalId: meta.externalId,
          phone: o.phone,
          email: meta.email,
          city: o.city,
          country: "MA",
        },
        custom: {
          value: o.total / 100,
          currency: o.currency,
          content_name: o.productName,
          order_id: orderNumber,
        },
      },
      reqId,
      ctx.metaTestCode,
    );

    // Same reason the push result is recorded: this runs after the customer has
    // their confirmation, so its outcome reaches nothing but a log line, and a
    // Conversions API that quietly stopped authenticating would look identical
    // to one that is working until someone noticed the ad spend.
    await recordSetting(prisma, CAPI_LAST_RESULT_KEY, {
      at: new Date().toISOString(),
      event: "Lead",
      ok: result.ok,
      status: result.status ?? null,
      skipped: result.skipped ?? null,
      deduplicatedWithBrowser: Boolean(meta.eventId),
      detail: result.detail ? result.detail.slice(0, 300) : null,
    });
  } catch (err) {
    // sendCapiEvent already swallows its own failures; this is the last guard,
    // because nothing in this function may ever reject into waitUntil.
    log("warn", { reqId, msg: "lead_report_failed", error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Record what FCM answered for the last order.
 *
 * Delivery happens in `waitUntil`, after the response has gone back to the
 * customer, so nothing about it reaches the caller and a failure shows up only
 * in logs nobody reads at 2am. This leaves one durable row saying whether the
 * last notification was accepted, how many devices it went to, and the error if
 * it was not — which is the difference between "push is working" and "push has
 * been silently broken for a week".
 *
 * It reuses the existing Setting table, so there is no schema change, and it is
 * wrapped so that bookkeeping can never affect an order that is already saved.
 */
async function recordPushResult(
  prisma: PrismaClient,
  devices: number,
  result: { sent: number; invalid: string[]; skipped?: string; errors?: { status: number; detail: string }[] },
): Promise<void> {
  await recordSetting(prisma, PUSH_LAST_RESULT_KEY, {
    at: new Date().toISOString(),
    devices,
    sent: result.sent,
    pruned: result.invalid.length,
    skipped: result.skipped ?? null,
    errors: (result.errors ?? []).slice(0, 3),
  });
}

/** Write one diagnostic row. Never throws — bookkeeping does not get to break
 *  an order that is already committed. */
async function recordSetting(
  prisma: PrismaClient,
  key: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const value = JSON.stringify(payload).slice(0, 2000);
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  } catch {
    /* diagnostics must never break the order path */
  }
}

/** Shared write path: upsert the customer, then create the order and its items. */
async function persist(
  prisma: PrismaClient,
  reqId: string | undefined,
  o: PersistInput,
  push?: DeferredContext,
) {
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
    select: { id: true, orderNumber: true, quantity: true, totalPrice: true, currency: true },
  });

  log("info", {
    reqId,
    msg: "order_created",
    orderNumber: created.orderNumber,
    quantity: created.quantity,
    source: o.source,
  });

  // Both handed to the runtime: the customer's confirmation waits on neither
  // FCM nor Meta, and a failure in either cannot reach a sale that is already
  // committed to the database.
  if (push) {
    push.waitUntil(notifyDevices(prisma, push, reqId, o, created.id));
    push.waitUntil(reportLead(prisma, push, reqId, o, created.orderNumber));
  }

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
