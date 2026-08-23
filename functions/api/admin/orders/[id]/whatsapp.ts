// POST /api/admin/orders/:id/whatsapp — resend the confirmation WhatsApp.
//
// Deliberately separate from the status transition. The automatic send happens
// once and only once when an order becomes CONFIRMED; this is the human
// override for "the customer says it never arrived", and it only ever runs
// because an admin pressed a button.
//
// It is a POST, so the middleware's CSRF check applies, and it is gated on
// `manage_orders` — the same permission that lets someone change the status in
// the first place.
import type { AppFunction } from "../../../../_lib/context";
import { resolveDatabaseUrl } from "../../../../_lib/env";
import { getPrisma } from "../../../../_lib/db";
import { json, log } from "../../../../_lib/http";
import { roleCan } from "../../_lib/permissions";
import { writeAudit, clientIp } from "../../_lib/audit";
import { sendConfirmationWhatsApp } from "../../_lib/whatsappConfirm";

export const onRequest: AppFunction = async ({ request, env, params, data }) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }

  const reqId = data.reqId;
  const id = String(params.id ?? "");
  if (!id) return json({ ok: false, error: "missing_id" }, 400);

  const actor = data.admin?.email ?? null;
  if (!roleCan(data.admin?.role, "manage_orders")) {
    log("warn", { reqId, msg: "whatsapp_resend_forbidden", id, actor });
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const prisma = getPrisma(dbUrl);

  try {
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true, orderNumber: true, status: true } });
    if (!order) return json({ ok: false, error: "not_found" }, 404);

    // Only for an order the shop has actually confirmed. Resending on a PENDING
    // order would tell a customer their order is confirmed when it is not.
    if (order.status === "PENDING") {
      return json({ ok: false, error: "not_confirmed", status: order.status }, 409);
    }

    // `force`: the claim is bypassed on purpose. This is the one path allowed to
    // produce a second message, and only ever by an explicit admin action.
    const outcome = await sendConfirmationWhatsApp(prisma, env, id, { reqId, force: true });

    await writeAudit(prisma, {
      actor: actor ?? "unknown",
      action: "order.whatsapp_resend",
      entity: "order",
      entityId: id,
      details: `${order.orderNumber} → ${outcome.status ?? "unknown"}`,
      ip: clientIp(request),
    });

    log("info", { reqId, msg: "whatsapp_resend", id, orderNumber: order.orderNumber, actor, status: outcome.status ?? null });

    if (outcome.status !== "sent") {
      return json({ ok: false, error: outcome.status ?? "failed", detail: outcome.error ?? null }, 502);
    }
    return json({ ok: true, data: { status: outcome.status, messageId: outcome.messageId ?? null } });
  } catch (err) {
    log("error", { reqId, msg: "whatsapp_resend_failed", id, error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
