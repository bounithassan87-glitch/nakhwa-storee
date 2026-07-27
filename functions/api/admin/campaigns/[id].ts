// GET    /api/admin/campaigns/:id — detail: metrics, attributed orders,
//   customers, timeline.
// PATCH  /api/admin/campaigns/:id — update; status/budget changes append timeline
//   events (requires manage_marketing).
// DELETE /api/admin/campaigns/:id — delete (orders keep history via SetNull).
// Auth + CSRF + audit via the admin _middleware.
import { z } from "zod";
import type { Env } from "../../../_lib/env";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma, prismaCode } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";
import { computeMetrics } from "../_lib/campaignMetrics";

const STATUSES = ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const;
const PLATFORMS = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "GOOGLE", "SNAPCHAT", "MANUAL"] as const;

const patchSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  platform: z.enum(PLATFORMS).optional(),
  objective: z.string().trim().max(120).nullable().optional(),
  status: z.enum(STATUSES).optional(),
  budget: z.number().int().min(0).optional(),
  spent: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  impressions: z.number().int().min(0).optional(),
  conversions: z.number().int().min(0).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

const STATUS_EVENT: Record<string, string> = {
  ACTIVE: "activated",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  SCHEDULED: "scheduled",
  DRAFT: "updated",
};

const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(v) : null);

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "GET") return detail(ctx);
  if (ctx.request.method === "PATCH") return update(ctx);
  if (ctx.request.method === "DELETE") return remove(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, PATCH, DELETE" });
};

async function loadDetail(prisma: ReturnType<typeof getPrisma>, id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!campaign) return null;
  const orders = await prisma.order.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { fullName: true, phone: true, city: true } } },
  });
  const metrics = computeMetrics(
    campaign,
    orders.map((o) => ({ status: o.status, totalPrice: o.totalPrice, customerId: o.customerId })),
  );
  // Distinct customers among attributed (non-cancelled) orders.
  const custMap = new Map<string, { name: string; phone: string; city: string; orders: number; revenue: number }>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    const e = custMap.get(o.customerId) ?? { name: o.customer.fullName, phone: o.customer.phone, city: o.customer.city, orders: 0, revenue: 0 };
    e.orders += 1;
    e.revenue += o.totalPrice;
    custMap.set(o.customerId, e);
  }
  return {
    ...serialize(campaign),
    metrics,
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalPrice: o.totalPrice,
      createdAt: o.createdAt,
      customer: { fullName: o.customer.fullName, phone: o.customer.phone, city: o.customer.city },
    })),
    customers: [...custMap.values()],
    timeline: campaign.events.map((e) => ({ id: e.id, type: e.type, note: e.note, actor: e.actor, createdAt: e.createdAt })),
  };
}

function serialize(c: {
  id: string; name: string; platform: string; objective: string | null; status: string;
  budget: number; spent: number; clicks: number; impressions: number; conversions: number;
  notes: string | null; startDate: Date | null; endDate: Date | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: c.id, name: c.name, platform: c.platform, objective: c.objective, status: c.status,
    budget: c.budget, spent: c.spent, clicks: c.clicks, impressions: c.impressions, conversions: c.conversions,
    notes: c.notes, startDate: c.startDate, endDate: c.endDate, createdAt: c.createdAt, updatedAt: c.updatedAt,
  };
}

const detail: PagesFunction<Env> = async ({ env, params, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  try {
    const d = await loadDetail(getPrisma(dbUrl), String(params.id ?? ""));
    if (!d) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true, data: d });
  } catch (err) {
    log("error", { reqId, msg: "campaign_detail_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const update: PagesFunction<Env> = async ({ request, env, params, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const admin = (data as { admin?: { email?: string; role?: string } }).admin;
  if (!roleCan(admin?.role, "manage_marketing")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const id = String(params.id ?? "");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);
  const b = parsed.data;

  const prisma = getPrisma(dbUrl);
  try {
    const before = await prisma.campaign.findUnique({ where: { id }, select: { status: true, budget: true } });
    if (!before) return json({ ok: false, error: "not_found" }, 404);

    const patch: Record<string, unknown> = { ...b };
    if (b.startDate !== undefined) patch.startDate = toDate(b.startDate);
    if (b.endDate !== undefined) patch.endDate = toDate(b.endDate);

    const events: { type: string; note?: string; actor: string | null }[] = [];
    if (b.status && b.status !== before.status) events.push({ type: STATUS_EVENT[b.status] ?? "updated", actor: admin?.email ?? null });
    if (b.budget !== undefined && b.budget !== before.budget) {
      events.push({ type: "budget_changed", note: `${before.budget} → ${b.budget}`, actor: admin?.email ?? null });
    }

    await prisma.$transaction(async (tx) => {
      await tx.campaign.update({ where: { id }, data: patch });
      for (const e of events) await tx.campaignEvent.create({ data: { campaignId: id, ...e } });
    });

    const d = await loadDetail(prisma, id);
    return json({ ok: true, data: d });
  } catch (err) {
    if (prismaCode(err) === "P2025") return json({ ok: false, error: "not_found" }, 404);
    log("error", { reqId, msg: "campaign_update_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const remove: PagesFunction<Env> = async ({ env, params, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const admin = (data as { admin?: { role?: string } }).admin;
  if (!roleCan(admin?.role, "manage_marketing")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  try {
    await getPrisma(dbUrl).campaign.delete({ where: { id: String(params.id ?? "") } });
    return json({ ok: true });
  } catch (err) {
    if (prismaCode(err) === "P2025") return json({ ok: false, error: "not_found" }, 404);
    log("error", { reqId, msg: "campaign_delete_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
