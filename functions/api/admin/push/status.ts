// GET /api/admin/push/status — is push actually able to send?
//
// Sending is deliberately silent so a failure can never hold up an order, which
// otherwise leaves no way to distinguish "no secret" from "bad secret" from
// "Google refused the key". This reports that, and only that: booleans, the
// public project id, the service-account domain, and an error code. The
// credential itself is never returned. Auth-guarded like every /api/admin route.
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json } from "../../../_lib/http";
import { checkPushConfig } from "../../_lib/fcm";

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
  }

  const config = await checkPushConfig(ctx.env.FIREBASE_SERVICE_ACCOUNT);

  let devices: number | null = null;
  const dbUrl = resolveDatabaseUrl(ctx.env);
  if (dbUrl) {
    try {
      devices = await getPrisma(dbUrl).pushToken.count();
    } catch {
      devices = null;
    }
  }

  return json({ ok: true, ...config, devices });
};
