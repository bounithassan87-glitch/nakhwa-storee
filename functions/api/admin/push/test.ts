// POST /api/admin/push/test — send a notification to this admin's devices now.
//
// Two jobs. For the admin it is the "did that actually arrive on my phone?"
// button. For diagnosis it runs the same `sendPush` the order path uses, but
// inline rather than through `waitUntil`, and returns the result — which is
// what separates a broken sender from a deferred task that never ran.
//
// An optional `token` sends to that address only, so a probe can be exercised
// without a real device registered.
import { z } from "zod";
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { sendPush, DASHBOARD_ORDERS_URL, PUSH_ICON_URL } from "../../_lib/fcm";

const bodySchema = z.object({ token: z.string().trim().min(10).max(4096).optional() }).optional();

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }

  const reqId = ctx.data.reqId;
  const dbUrl = resolveDatabaseUrl(ctx.env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown = undefined;
  try {
    raw = await ctx.request.json();
  } catch {
    /* body is optional */
  }
  const parsed = bodySchema.safeParse(raw);
  const explicit = parsed.success ? parsed.data?.token : undefined;

  const prisma = getPrisma(dbUrl);
  const tokens = explicit
    ? [explicit]
    : (await prisma.pushToken.findMany({ select: { token: true } })).map((t) => t.token);

  const result = await sendPush(
    ctx.env.FIREBASE_SERVICE_ACCOUNT,
    tokens,
    {
      title: "🛒 طلب جديد",
      body: ["المنتج: اختبار", "الزبون: اختبار", "المدينة: اختبار", "المبلغ: 0 DH"].join("\n"),
      link: DASHBOARD_ORDERS_URL,
      icon: PUSH_ICON_URL,
      tag: `test-${Date.now()}`,
    },
    reqId,
  );

  // Same pruning the order path does, so a test also tidies dead devices.
  if (result.invalid.length > 0) {
    await prisma.pushToken.deleteMany({ where: { token: { in: result.invalid } } });
  }

  log("info", { reqId, msg: "push_test", sent: result.sent, invalid: result.invalid.length, skipped: result.skipped });
  return json({
    ok: true,
    devices: tokens.length,
    sent: result.sent,
    pruned: result.invalid.length,
    skipped: result.skipped ?? null,
  });
};
