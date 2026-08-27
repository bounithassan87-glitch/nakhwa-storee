// POST /api/admin/orders/:id/spaceseller — retry the fulfilment sync, or
// refresh the status of an order already sent.
//
// Deliberately one endpoint with an explicit `action`, because the two do very
// different things and the difference should be visible at the call site:
//
//   retry    may CREATE an order upstream. Refuses outright if one already
//            exists, and refuses while a previous attempt is unresolved.
//   refresh  read-only upstream. Cannot create anything, so it is always safe.
//
// A POST, so the admin middleware's CSRF check applies, and gated on
// `manage_orders` — the same permission that lets someone change a status.
import { z } from "zod";
import type { AppFunction } from "../../../../_lib/context";
import { resolveDatabaseUrl } from "../../../../_lib/env";
import { getPrisma } from "../../../../_lib/db";
import { json, log } from "../../../../_lib/http";
import { roleCan } from "../../_lib/permissions";
import { writeAudit, clientIp } from "../../_lib/audit";
import { syncOrderToSpaceSeller, refreshSpaceSellerStatus } from "../../_lib/spacesellerSync";

const bodySchema = z.object({ action: z.enum(["retry", "refresh"]).default("retry") }).optional();

export const onRequest: AppFunction = async ({ request, env, params, data }) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }

  const reqId = data.reqId;
  const actor = data.admin?.email ?? null;
  const id = String(params.id ?? "");
  if (!id) return json({ ok: false, error: "not_found" }, 404);

  if (!roleCan(data.admin?.role, "manage_orders")) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    /* body is optional; defaults to retry */
  }
  const parsed = bodySchema.safeParse(raw);
  const action = (parsed.success ? parsed.data?.action : undefined) ?? "retry";

  const prisma = getPrisma(dbUrl);
  const credentials = {
    SPACESELLER_TOKEN: env.SPACESELLER_TOKEN,
    SPACESELLER_API_BASE: env.SPACESELLER_API_BASE,
  };

  try {
    if (action === "refresh") {
      const res = await refreshSpaceSellerStatus(prisma, credentials, id, { reqId });
      return json({
        ok: res.refreshed,
        action,
        status: res.status ?? null,
        deliveryStatus: res.delivery ?? null,
        trackingNumber: res.tracking ?? null,
        error: res.error ?? null,
      });
    }

    const res = await syncOrderToSpaceSeller(prisma, credentials, id, { reqId });

    // The outcome, not the payload: no customer details in the audit trail.
    await writeAudit(prisma, {
      actor: actor ?? "unknown",
      action: "order.spaceseller_retry",
      entity: "order",
      entityId: id,
      details: `${res.status ?? "unknown"}${res.alreadySynced ? " (already synced)" : ""}`,
      ip: clientIp(request),
    }).catch(() => undefined);

    log("info", {
      reqId,
      msg: "spaceseller_retry",
      orderId: id,
      actor,
      status: res.status,
      alreadySynced: res.alreadySynced,
    });

    return json({
      ok: res.status === "SYNCED",
      action,
      status: res.status ?? null,
      alreadySynced: Boolean(res.alreadySynced),
      spacesellerOrderId: res.orderId ?? null,
      spacesellerUuid: res.uuid ?? null,
      // Safe to show: upstream messages are scrubbed of anything credential
      // shaped before they ever reach this point.
      error: res.error ?? null,
    });
  } catch (err) {
    log("error", {
      reqId,
      msg: "spaceseller_endpoint_error",
      orderId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
