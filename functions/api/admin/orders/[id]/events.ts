// POST /api/admin/orders/:id/events — add an internal note to the timeline
// (records the current status). Auth + CSRF enforced.
import { z } from "zod";
import type { AppFunction } from "../../../../_lib/context";
import { resolveDatabaseUrl } from "../../../../_lib/env";
import { getPrisma } from "../../../../_lib/db";
import { json, log } from "../../../../_lib/http";

const bodySchema = z.object({ note: z.string().trim().min(1).max(500) });

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  return addNote(ctx);
};

const addNote: AppFunction = async ({ request, env, params, data }) => {
  const reqId = data.reqId;
  const actor = data.admin?.email ?? null;
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

  const prisma = getPrisma(dbUrl);
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order) return json({ ok: false, error: "not_found" }, 404);
    const event = await prisma.orderEvent.create({
      data: { orderId, status: order.status, note: parsed.data.note, actor },
    });
    return json({ ok: true, data: event }, 201);
  } catch (err) {
    log("error", { reqId, msg: "order_note_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
