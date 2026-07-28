// GET /api/admin/audit — paginated activity log with filters (requires
// view_audit). Auth enforced by the admin _middleware.
import type { Prisma } from "@prisma/client";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
  }
  return listAudit(ctx);
};

const listAudit: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const role = data.admin?.role;
  if (!roleCan(role, "view_audit")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  const p = new URL(request.url).searchParams;
  const actor = (p.get("actor") ?? "").trim();
  const action = (p.get("action") ?? "").trim();
  const entity = (p.get("entity") ?? "").trim();
  const dateFrom = p.get("dateFrom");
  const dateTo = p.get("dateTo");
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(p.get("pageSize") ?? "20", 10) || 20));

  const where: Prisma.AuditLogWhereInput = {};
  const and: Prisma.AuditLogWhereInput[] = [];
  if (actor) and.push({ actor: { contains: actor, mode: "insensitive" } });
  if (action) and.push({ action: { contains: action, mode: "insensitive" } });
  if (entity) and.push({ entity: { equals: entity } });
  if (dateFrom || dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      createdAt.lte = d;
    }
    and.push({ createdAt });
  }
  if (and.length) where.AND = and;

  const prisma = getPrisma(dbUrl);
  try {
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return json({
      ok: true,
      data: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    log("error", { reqId, msg: "audit_list_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
