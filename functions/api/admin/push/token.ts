// POST   /api/admin/push/token — register (or refresh) this device's FCM token.
// DELETE /api/admin/push/token — forget it, e.g. when the admin turns push off.
//
// Auth + CSRF come from the admin _middleware, so only a signed-in admin can
// attach a device. The token is the delivery address FCM issues per browser
// installation; it is unique on its own, so re-registering the same device
// updates its row instead of adding another. The dashboard saves on every load,
// which is also how a rotated token replaces the one it superseded.
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";

const bodySchema = z.object({
  token: z.string().trim().min(20).max(4096),
});

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "POST") return saveToken(ctx);
  if (ctx.request.method === "DELETE") return removeToken(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST, DELETE" });
};

const saveToken: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const adminEmail = data.admin?.email;
  if (!adminEmail) return json({ ok: false, error: "unauthenticated" }, 401);

  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error" }, 422);

  // Truncated: the header is only ever used to tell devices apart in the table.
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300) || null;

  try {
    await getPrisma(dbUrl).pushToken.upsert({
      where: { token: parsed.data.token },
      update: { adminEmail, userAgent, lastSeenAt: new Date() },
      create: { token: parsed.data.token, adminEmail, userAgent },
    });
    return json({ ok: true });
  } catch (err) {
    log("error", { reqId, msg: "push_token_save_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const removeToken: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error" }, 422);

  try {
    // deleteMany, not delete: removing a token that is already gone is success.
    await getPrisma(dbUrl).pushToken.deleteMany({ where: { token: parsed.data.token } });
    return json({ ok: true });
  } catch (err) {
    log("error", { reqId, msg: "push_token_delete_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
