// GET  /api/admin/cities — list (any admin).
// POST /api/admin/cities — add (requires manage_cities).
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma, prismaCode } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";

const addSchema = z.object({
  name: z.string().trim().min(1).max(80),
  shippingCost: z.number().int().min(0).nullable().optional(),
  estimatedDays: z.number().int().min(0).max(60).nullable().optional(),
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
    const rows = await getPrisma(dbUrl).city.findMany({ orderBy: { name: "asc" } });
    return json({ ok: true, data: rows });
  } catch (err) {
    log("error", { reqId, msg: "cities_list_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const add: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const role = data.admin?.role;
  if (!roleCan(role, "manage_cities")) return json({ ok: false, error: "forbidden" }, 403);
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

  try {
    const city = await getPrisma(dbUrl).city.create({
      data: {
        name: parsed.data.name,
        shippingCost: parsed.data.shippingCost ?? null,
        estimatedDays: parsed.data.estimatedDays ?? null,
      },
    });
    return json({ ok: true, data: city }, 201);
  } catch (err) {
    if (prismaCode(err) === "P2002") return json({ ok: false, error: "duplicate_city" }, 409);
    log("error", { reqId, msg: "city_add_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
