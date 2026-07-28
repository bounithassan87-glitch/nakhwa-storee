// GET  /api/admin/shipping-companies — list (any admin).
// POST /api/admin/shipping-companies — add (requires manage_shipping_settings).
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma, prismaCode } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";

const addSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).nullable().optional(),
  website: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "GET") return list(ctx);
  if (ctx.request.method === "POST") return add(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, POST" });
};

const list: AppFunction = async ({ env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  try {
    const rows = await getPrisma(dbUrl).shippingCompany.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
    return json({ ok: true, data: rows });
  } catch (err) {
    log("error", { reqId, msg: "companies_list_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const add: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const role = data.admin?.role;
  if (!roleCan(role, "manage_shipping_settings")) return json({ ok: false, error: "forbidden" }, 403);
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);

  const prisma = getPrisma(dbUrl);
  try {
    const last = await prisma.shippingCompany.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
    const company = await prisma.shippingCompany.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        website: parsed.data.website ?? null,
        notes: parsed.data.notes ?? null,
        position: (last?.position ?? -1) + 1,
      },
    });
    return json({ ok: true, data: company }, 201);
  } catch (err) {
    if (prismaCode(err) === "P2002") return json({ ok: false, error: "duplicate_company" }, 409);
    log("error", { reqId, msg: "company_add_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
