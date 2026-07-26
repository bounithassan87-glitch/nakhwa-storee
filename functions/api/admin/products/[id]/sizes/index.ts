// POST  /api/admin/products/:id/sizes  — add a size.
// PATCH /api/admin/products/:id/sizes  — reorder sizes { ids: [...] }.
// Auth + CSRF enforced by the admin _middleware.
import { z } from "zod";
import type { Env } from "../../../../_lib/env";
import { resolveDatabaseUrl } from "../../../../../_lib/env";
import { getPrisma, prismaCode } from "../../../../../_lib/db";
import { json, log } from "../../../../../_lib/http";

const addSchema = z.object({ label: z.string().trim().min(1).max(30) });
const reorderSchema = z.object({ ids: z.array(z.string()).min(1) });

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "POST") return addSize(ctx);
  if (ctx.request.method === "PATCH") return reorderSizes(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST, PATCH" });
};

const addSize: PagesFunction<Env> = async ({ params, request, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
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
    const last = await prisma.size.findFirst({
      where: { productId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const size = await prisma.size.create({
      data: { productId, label: parsed.data.label, position: (last?.position ?? -1) + 1 },
    });
    return json({ ok: true, data: size }, 201);
  } catch (err) {
    const code = prismaCode(err);
    if (code === "P2002") return json({ ok: false, error: "duplicate_size" }, 409);
    if (code === "P2003") return json({ ok: false, error: "not_found" }, 404);
    log("error", { reqId, msg: "size_add_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const reorderSizes: PagesFunction<Env> = async ({ params, request, env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
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
      parsed.data.ids.map((sid, i) =>
        prisma.size.updateMany({ where: { id: sid, productId }, data: { position: i } }),
      ),
    );
    return json({ ok: true });
  } catch (err) {
    log("error", { reqId, msg: "size_reorder_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
