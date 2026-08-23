// The confirmation WhatsApp, per product, sent at most once per order.
//
// Two callers share this: the status transition (automatic, strictly once) and
// the admin's explicit Resend button. They differ in exactly one thing — whether
// the once-only claim may be bypassed — so the logic lives here once.
//
// Nothing in this file may fail an order. By the time it runs the status change
// has committed; an unreachable gateway is a message to retry, never a reason to
// undo a confirmation the shop has acted on.
import type { PrismaClient } from "@prisma/client";
import { log } from "../../../_lib/http";
import { resolveProvider, providerName, type WhatsAppSender, type WhatsAppEnv } from "../../_lib/whatsapp";
import {
  buildConfirmationMessage,
  buildMetaTemplate,
  productLabelFor,
} from "../../../../shared/whatsapp-templates.js";

/** What happened, as stored on the order and shown in the dashboard. */
export type WhatsAppStatus =
  | "sent" | "failed" | "not_configured" | "disabled" | "invalid_phone"
  /** Meta is the provider but this product has no approved template yet. */
  | "no_template";

export interface ConfirmOutcome {
  attempted: boolean;
  status?: WhatsAppStatus;
  /** Set when the once-only claim was already taken — nothing was sent. */
  alreadySent?: boolean;
  messageId?: string;
  error?: string;
}

/** The order shape this needs; selected once so both callers agree on it. */
const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  quantity: true,
  totalPrice: true,
  currency: true,
  whatsappConfirmationSent: true,
  customer: { select: { fullName: true, phone: true, city: true, address: true } },
  items: { select: { product: { select: { slug: true, name: true } } }, take: 1 },
} as const;

/**
 * Send the confirmation WhatsApp for one order.
 *
 * `force` is the Resend button: it bypasses the once-only claim because an admin
 * has explicitly asked for another copy. The automatic path never sets it, so a
 * doubled confirm — or a retried request — still yields exactly one message.
 *
 * `send` is injectable so tests exercise the whole decision path against a mock
 * and never reach a real gateway.
 */
export async function sendConfirmationWhatsApp(
  prisma: PrismaClient,
  env: WhatsAppEnv,
  orderId: string,
  opts: { reqId?: string; force?: boolean; send?: WhatsAppSender } = {},
): Promise<ConfirmOutcome> {
  const { reqId, force = false } = opts;

  try {
    // Claim first, send second. The write only matches while the flag is still
    // false, so of two admins confirming the same order at the same instant
    // exactly one wins. Reading then writing would let both through.
    if (!force) {
      const claim = await prisma.order.updateMany({
        where: { id: orderId, whatsappConfirmationSent: false },
        data: { whatsappConfirmationSent: true },
      });
      if (claim.count === 0) {
        log("info", { reqId, msg: "whatsapp_already_sent", orderId });
        return { attempted: false, alreadySent: true };
      }
    }

    const order = await prisma.order.findUnique({ where: { id: orderId }, select: ORDER_SELECT });
    if (!order) return { attempted: false };

    const slug = order.items[0]?.product?.slug ?? null;
    const productName = order.items[0]?.product?.name ?? "";

    // The gateway is a property of the PRODUCT, so it can only be chosen once
    // the order has been read. Resolving it earlier would have to guess, and
    // guessing is exactly what routed every product through one provider.
    const send = opts.send ?? resolveProvider(env, slug, reqId);

    // The message comes from the product's own configuration. Nothing about any
    // individual product is known here.
    const built = buildConfirmationMessage(slug, {
      name: order.customer.fullName,
      phone: order.customer.phone,
      city: order.customer.city,
      address: order.customer.address,
      quantity: order.quantity,
      total: order.totalPrice / 100,
      orderNumber: order.orderNumber,
      productName,
    });

    if (!built.enabled) {
      await record(prisma, orderId, { claimed: !force, status: "disabled" });
      log("info", { reqId, msg: "whatsapp_disabled_for_product", orderId, slug });
      return { attempted: false, status: "disabled" };
    }

    // Both shapes of the same confirmation. A text gateway sends `message`; Meta
    // must send `template`, because a business-initiated message may not be
    // free text. Building both here keeps provider choice a matter of config.
    const templateVars = {
      name: order.customer.fullName,
      productName,
      // What the customer is told they bought. The registry's label wins over
      // the catalogue row, so renaming a product in the dashboard cannot change
      // the wording Meta approved.
      productLabel: productLabelFor(slug) ?? productName,
      total: String(order.totalPrice / 100),
      quantity: String(order.quantity),
      city: order.customer.city,
    };

    const result = await send({
      phone: order.customer.phone,
      message: built.message as string,
      template: buildMetaTemplate(slug, templateVars) ?? undefined,
    });

    if (!result.ok) {
      const status: WhatsAppStatus =
        result.skipped === "not_configured" ? "not_configured"
        : result.skipped === "invalid_phone" ? "invalid_phone"
        : result.skipped === "no_template" ? "no_template"
        : "failed";
      // Release the claim so a corrected phone, restored credentials or a manual
      // resend can still deliver. The order is never touched.
      await record(prisma, orderId, {
        claimed: !force,
        status,
        error: (result.detail ?? result.skipped ?? "unknown").slice(0, 300),
      });
      log("warn", {
        reqId, msg: "whatsapp_confirmation_failed", orderId, orderNumber: order.orderNumber,
        slug, status, provider: providerName(env, slug), providerStatus: result.status ?? null,
        detail: (result.detail ?? result.skipped ?? "").slice(0, 200),
      });
      return { attempted: true, status, error: result.detail ?? result.skipped };
    }

    await record(prisma, orderId, { status: "sent", messageId: result.messageId, sentAt: new Date() });
    log("info", {
      reqId, msg: "whatsapp_confirmation_sent", orderId, orderNumber: order.orderNumber,
      slug, provider: providerName(env, slug),
      template: buildMetaTemplate(slug, {})?.name ?? built.source,
      messageId: result.messageId ?? null, forced: force,
    });
    return { attempted: true, status: "sent", messageId: result.messageId };
  } catch (err) {
    // Anything unexpected must also leave the flag false rather than stranding
    // an order as "sent" when nothing was.
    try {
      await prisma.order.updateMany({
        where: { id: orderId },
        data: {
          whatsappConfirmationSent: false,
          whatsappConfirmationStatus: "failed",
          whatsappConfirmationError: (err instanceof Error ? err.message : String(err)).slice(0, 300),
        },
      });
    } catch { /* the release is best-effort too */ }
    log("error", {
      reqId, msg: "whatsapp_confirmation_error", orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { attempted: true, status: "failed", error: "internal_error" };
  }
}

/**
 * Write the outcome. A non-success also releases the claim, so the message can
 * be retried; only a delivered message keeps the flag set and stamps the time.
 */
async function record(
  prisma: PrismaClient,
  orderId: string,
  o: { claimed?: boolean; status: WhatsAppStatus; messageId?: string; error?: string; sentAt?: Date },
): Promise<void> {
  const data: Record<string, unknown> = {
    whatsappConfirmationStatus: o.status,
    whatsappConfirmationError: o.error ?? null,
  };
  if (o.status === "sent") {
    data.whatsappConfirmationSent = true;
    data.whatsappConfirmationSentAt = o.sentAt ?? new Date();
    data.whatsappConfirmationMessageId = o.messageId ?? null;
  } else {
    data.whatsappConfirmationSent = false;
  }
  await prisma.order.updateMany({ where: { id: orderId }, data });
}
