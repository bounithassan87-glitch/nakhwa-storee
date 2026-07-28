// POST  /api/admin/products/:id/colors  — add a colour.
// PATCH /api/admin/products/:id/colors  — reorder colours { ids: [...] }.
// Auth + CSRF enforced by the admin _middleware.
import { z } from "zod";
import type { AppFunction } from "../../../../../_lib/context";
import { resolveDatabaseUrl } from "../../../../../_lib/env";
import { getPrisma, prismaCode } from "../../../../../_lib/db";
import { json, log } from "../../../../../_lib/http";

const addSchema = z.object({
  name: z.string().trim().min(1).max(60),
  swatch: z.string().trim().max(200).nullable().optional(),
});
const reorderSchema = z.object({ ids: z.array(z.string()).min(1) });

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "POST") return addColor(ctx);
  if (ctx.request.method === "PATCH") return reorderColors(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST, PATCH" });
};

const addColor: AppFunction = async ({ params, request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const productId = String(params.id ?? "");

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
    const last = await prisma.color.findFirst({
      where: { productId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const color = await prisma.color.create({
      data: {
        productId,
        name: parsed.data.name,
        swatch: parsed.data.swatch ?? null,
        position: (last?.position ?? -1) + 1,
      },
    });
    return json({ ok: true, data: color }, 201);
  } catch (err) {
    const code = prismaCode(err);
    if (code === "P2002") return json({ ok: false, error: "duplicate_color" }, 409);
    if (code === "P2003") return json({ ok: false, error: "not_found" }, 404);
    log("error", { reqId, msg: "color_add_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const reorderColors: AppFunction = async ({ params, request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  const productId = String(params.id ?? "");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, 422);

  const prisma = getPrisma(dbUrl);
  try {
    await prisma.$transaction(
      parsed.data.ids.map((cid, i) =>
        prisma.color.updateMany({ where: { id: cid, productId }, data: { position: i } }),
      ),
    );
    return json({ ok: true });
  } catch (err) {
    log("error", { reqId, msg: "color_reorder_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
