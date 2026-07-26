// PATCH /api/admin/orders/:id — change an order's status (updates the existing
// `status` field only; no schema change).
//
// ⚠️ AUTH: must be protected by real admin auth before deploy (see index.ts).
import { z } from "zod";
import type { Env } from "../../../_lib/env";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";

const bodySchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "PATCH") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "PATCH" });
  }
  return updateStatus(ctx);
};

const updateStatus: PagesFunction<Env> = async ({ request, env, params, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
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

  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const prisma = getPrisma(dbUrl);
  try {
    const updated = await prisma.order.update({
      where: { id },
      data: { status: parsed.data.status },
      select: { id: true, orderNumber: true, status: true },
    });
    log("info", { reqId, msg: "order_status_updated", id, status: parsed.data.status });
    return json({ ok: true, order: updated });
  } catch (err) {
    log("warn", { reqId, msg: "order_update_failed", id, error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "not_found_or_failed" }, 404);
  }
};
