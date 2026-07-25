// GET /api/health — lightweight readiness probe (checks DB connectivity).
import type { Env } from "../_lib/env";
import { resolveDatabaseUrl } from "../_lib/env";
import { json, log } from "../_lib/http";
import { getPrisma } from "../_lib/db";

export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const reqId = (data as { reqId?: string }).reqId;
  const result = {
    ok: true,
    service: "nakhwa-store-api",
    environment: env.ENVIRONMENT ?? "development",
    database: "unknown" as "unknown" | "connected" | "unreachable" | "not_configured",
    time: new Date().toISOString(),
    reqId,
  };

  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) {
    result.ok = false;
    result.database = "not_configured";
    return json(result, 503);
  }

  const prisma = getPrisma(dbUrl);
  try {
    await prisma.$queryRaw`SELECT 1`;
    result.database = "connected";
  } catch (err) {
    result.ok = false;
    result.database = "unreachable";
    log("error", { reqId, msg: "health_db_unreachable", error: err instanceof Error ? err.message : String(err) });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  return json(result, result.ok ? 200 : 503);
};
