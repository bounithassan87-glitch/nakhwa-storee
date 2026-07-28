// DELETE /api/admin/campaigns/:id/orders/:orderId — remove an order's attribution
// (requires manage_marketing). Auth + CSRF + audit via the admin _middleware.
import type { AppFunction } from "../../../../../_lib/context";
import { resolveDatabaseUrl } from "../../../../../_lib/env";
import { getPrisma } from "../../../../../_lib/db";
import { json, log } from "../../../../../_lib/http";
import { roleCan } from "../../../_lib/permissions";

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "DELETE") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "DELETE" });
  }
  return unattribute(ctx);
};

const unattribute: AppFunction = async ({ env, params, data }) => {
  const reqId = data.reqId;
  const role = data.admin?.role;
  if (!roleCan(role, "manage_marketing")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const campaignId = String(params.id ?? "");
  const orderId = String(params.orderId ?? "");

  try {
    const res = await getPrisma(dbUrl).order.updateMany({
      where: { id: orderId, campaignId },
      data: { campaignId: null },
    });
    if (res.count === 0) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true });
  } catch (err) {
    log("error", { reqId, msg: "campaign_unattribute_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
