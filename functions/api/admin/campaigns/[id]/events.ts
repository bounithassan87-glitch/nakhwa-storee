// POST /api/admin/campaigns/:id/events — add an internal note to the timeline
// (requires manage_marketing). Auth + CSRF + audit via the admin _middleware.
import { z } from "zod";
import type { AppFunction } from "../../../../_lib/context";
import { resolveDatabaseUrl } from "../../../../_lib/env";
import { getPrisma } from "../../../../_lib/db";
import { json, log } from "../../../../_lib/http";
import { roleCan } from "../../_lib/permissions";

const bodySchema = z.object({ note: z.string().trim().min(1).max(500) });

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  return addNote(ctx);
};

const addNote: AppFunction = async ({ request, env, params, data }) => {
  const reqId = data.reqId;
  const admin = data.admin;
  if (!roleCan(admin?.role, "manage_marketing")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const campaignId = String(params.id ?? "");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);

  const prisma = getPrisma(dbUrl);
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true } });
    if (!campaign) return json({ ok: false, error: "not_found" }, 404);
    const event = await prisma.campaignEvent.create({
      data: { campaignId, type: "note", note: parsed.data.note, actor: admin?.email ?? null },
    });
    return json({ ok: true, data: event }, 201);
  } catch (err) {
    log("error", { reqId, msg: "campaign_note_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
