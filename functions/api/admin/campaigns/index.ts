// GET  /api/admin/campaigns — list with filters/sort/pagination + derived metrics
//   per campaign, plus dashboard `summary`, `timeseries`, `platforms`, `top`.
// POST /api/admin/campaigns — create (requires manage_marketing).
// Auth + CSRF + audit via the admin _middleware.
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";
import { computeMetrics, type CampaignMetrics } from "../_lib/campaignMetrics";

const STATUSES = ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const;
const PLATFORMS = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "GOOGLE", "SNAPCHAT", "MANUAL"] as const;
const SORT_FIELDS = ["createdAt", "name", "budget", "spent", "revenue", "roas", "status"] as const;
const DAY = 86_400_000;

const createSchema = z.object({
  name: z.string().trim().min(2).max(150),
  platform: z.enum(PLATFORMS).default("MANUAL"),
  objective: z.string().trim().max(120).nullable().optional(),
  status: z.enum(STATUSES).default("DRAFT"),
  budget: z.number().int().min(0).default(0),
  spent: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  impressions: z.number().int().min(0).default(0),
  conversions: z.number().int().min(0).default(0),
  notes: z.string().trim().max(2000).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

const toDate = (v: string | null | undefined) => (v ? new Date(v) : null);
const dayKey = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "GET") return list(ctx);
  if (ctx.request.method === "POST") return create(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, POST" });
};

const list: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim();
  const status = (p.get("status") ?? "").trim().toUpperCase();
  const platform = (p.get("platform") ?? "").trim().toUpperCase();
  const objective = (p.get("objective") ?? "").trim();
  const budgetMin = parseInt(p.get("budgetMin") ?? "", 10);
  const sort = (SORT_FIELDS as readonly string[]).includes(p.get("sort") ?? "")
    ? (p.get("sort") as (typeof SORT_FIELDS)[number])
    : "createdAt";
  const dir = p.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(p.get("pageSize") ?? "10", 10) || 10));

  const where: Prisma.CampaignWhereInput = {};
  const and: Prisma.CampaignWhereInput[] = [];
  if (q) and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { objective: { contains: q, mode: "insensitive" } }] });
  if (status && (STATUSES as readonly string[]).includes(status)) where.status = status as (typeof STATUSES)[number];
  if (platform && (PLATFORMS as readonly string[]).includes(platform)) where.platform = platform as (typeof PLATFORMS)[number];
  if (objective) and.push({ objective: { contains: objective, mode: "insensitive" } });
  if (!Number.isNaN(budgetMin)) and.push({ budget: { gte: budgetMin } });
  if (and.length) where.AND = and;

  const prisma = getPrisma(dbUrl);
  try {
    const campaigns = await prisma.campaign.findMany({ where });

    // Attributed orders for the matched campaigns (lightweight columns).
    const ids = campaigns.map((c) => c.id);
    const orderRows = ids.length
      ? await prisma.order.findMany({
          where: { campaignId: { in: ids } },
          select: { campaignId: true, status: true, totalPrice: true, customerId: true, createdAt: true },
        })
      : [];
    const byCampaign = new Map<string, typeof orderRows>();
    for (const r of orderRows) {
      // `campaignId` is non-null by construction (the query filters on
      // `campaignId: { in: ids }`), but Prisma types it from the nullable
      // column. Narrowing instead of asserting keeps this fail-closed: a null
      // key could never match the `byCampaign.get(c.id)` lookup below anyway,
      // so the outcome is unchanged.
      const campaignId = r.campaignId;
      if (campaignId === null) continue;
      const arr = byCampaign.get(campaignId) ?? [];
      arr.push(r);
      byCampaign.set(campaignId, arr);
    }

    // Sorted in place and sliced below — never reassigned.
    const rows = campaigns.map((c) => {
      const attributed = byCampaign.get(c.id) ?? [];
      const metrics = computeMetrics(c, attributed);
      return {
        id: c.id,
        name: c.name,
        platform: c.platform,
        objective: c.objective,
        status: c.status,
        budget: c.budget,
        spent: c.spent,
        clicks: c.clicks,
        impressions: c.impressions,
        conversions: c.conversions,
        startDate: c.startDate,
        endDate: c.endDate,
        createdAt: c.createdAt,
        metrics,
      };
    });

    // Sorting (some fields are derived → sort in JS).
    const sign = dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (sort) {
        case "name": return sign * a.name.localeCompare(b.name, "ar");
        case "budget": return sign * (a.budget - b.budget);
        case "spent": return sign * (a.spent - b.spent);
        case "revenue": return sign * (a.metrics.revenue - b.metrics.revenue);
        case "roas": return sign * (a.metrics.roas - b.metrics.roas);
        case "status": return sign * a.status.localeCompare(b.status);
        default: return sign * (a.createdAt.getTime() - b.createdAt.getTime());
      }
    });

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

    // ── Dashboard aggregates (across the filtered set) ──
    const sum = (f: (m: CampaignMetrics) => number) => rows.reduce((a, r) => a + f(r.metrics), 0);
    const sumRaw = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
    const totalRevenue = sum((m) => m.revenue);
    const totalSpent = sumRaw((r) => r.spent);
    const totalClicks = sumRaw((r) => r.clicks);
    const totalImpr = sumRaw((r) => r.impressions);
    const totalConv = sumRaw((r) => r.conversions);
    const uniqueCustomers = new Set(orderRows.filter((r) => r.status !== "CANCELLED").map((r) => r.customerId)).size;
    const div = (a: number, b: number) => (b > 0 ? a / b : 0);
    const summary = {
      totalCampaigns: rows.length,
      activeCampaigns: rows.filter((r) => r.status === "ACTIVE").length,
      budget: sumRaw((r) => r.budget),
      spent: totalSpent,
      revenue: totalRevenue,
      profit: totalRevenue - totalSpent,
      roas: div(totalRevenue, totalSpent),
      cpa: Math.round(div(totalSpent, totalConv)),
      ctr: div(totalClicks, totalImpr),
      conversionRate: div(totalConv, totalClicks),
      ordersGenerated: sum((m) => m.orders),
      customersAcquired: uniqueCustomers,
    };

    // Platform distribution (spend + revenue + count).
    const platMap = new Map<string, { platform: string; spend: number; revenue: number; count: number }>();
    for (const r of rows) {
      const e = platMap.get(r.platform) ?? { platform: r.platform, spend: 0, revenue: 0, count: 0 };
      e.spend += r.spent;
      e.revenue += r.metrics.revenue;
      e.count += 1;
      platMap.set(r.platform, e);
    }
    const platforms = [...platMap.values()];

    // Top campaigns by revenue.
    const top = [...rows].sort((a, b) => b.metrics.revenue - a.metrics.revenue).slice(0, 5)
      .map((r) => ({ id: r.id, name: r.name, revenue: r.metrics.revenue, roas: r.metrics.roas, spent: r.spent }));

    // Time-series (last 30 days): revenue from attributed orders (real); spend
    // distributed across each campaign's active window (documented estimate).
    const todayStart = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    const buckets = new Map<string, { date: string; revenue: number; spend: number }>();
    for (let i = 29; i >= 0; i--) {
      const k = new Date(todayStart - i * DAY).toISOString().slice(0, 10);
      buckets.set(k, { date: k, revenue: 0, spend: 0 });
    }
    for (const r of orderRows) {
      if (r.status === "CANCELLED") continue;
      const b = buckets.get(dayKey(r.createdAt));
      if (b) b.revenue += r.totalPrice;
    }
    for (const c of campaigns) {
      if (!c.spent) continue;
      const startMs = c.startDate ? Date.UTC(c.startDate.getUTCFullYear(), c.startDate.getUTCMonth(), c.startDate.getUTCDate()) : todayStart - 29 * DAY;
      const endMs = Math.min(c.endDate ? Date.UTC(c.endDate.getUTCFullYear(), c.endDate.getUTCMonth(), c.endDate.getUTCDate()) : todayStart, todayStart);
      const days = Math.max(1, Math.round((endMs - startMs) / DAY) + 1);
      const perDay = c.spent / days;
      for (let t = startMs; t <= endMs; t += DAY) {
        const b = buckets.get(new Date(t).toISOString().slice(0, 10));
        if (b) b.spend += perDay;
      }
    }
    const timeseries = [...buckets.values()].map((b) => ({ date: b.date, revenue: b.revenue, spend: Math.round(b.spend), roas: b.spend > 0 ? b.revenue / b.spend : 0 }));

    const objectives = [...new Set(campaigns.map((c) => c.objective).filter(Boolean))] as string[];

    return json({
      ok: true,
      data: pageRows,
      summary,
      platforms,
      top,
      timeseries,
      objectives,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    log("error", { reqId, msg: "campaigns_list_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const create: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const admin = data.admin;
  if (!roleCan(admin?.role, "manage_marketing")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);
  const b = parsed.data;

  const prisma = getPrisma(dbUrl);
  try {
    const campaign = await prisma.campaign.create({
      data: {
        name: b.name,
        platform: b.platform,
        objective: b.objective ?? null,
        status: b.status,
        budget: b.budget,
        spent: b.spent,
        clicks: b.clicks,
        impressions: b.impressions,
        conversions: b.conversions,
        notes: b.notes ?? null,
        startDate: toDate(b.startDate),
        endDate: toDate(b.endDate),
        events: { create: { type: "created", actor: admin?.email ?? null } },
      },
    });
    return json({ ok: true, data: campaign }, 201);
  } catch (err) {
    log("error", { reqId, msg: "campaign_create_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
