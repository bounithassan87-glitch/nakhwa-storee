// GET   /api/admin/settings — all store + system settings as an object.
// PATCH /api/admin/settings — upsert allowed keys (requires manage_settings).
// Auth + CSRF enforced by the admin _middleware.
import type { AppFunction } from "../../../_lib/context";
import { resolveDatabaseUrl } from "../../../_lib/env";
import { getPrisma } from "../../../_lib/db";
import { json, log } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";

// Extensible allowlist — add a key here (and in the UI) to expose a new setting.
const ALLOWED_KEYS = new Set([
  // Store
  "store_name",
  "logo_url",
  "email",
  "phone",
  "whatsapp",
  "address",
  "currency",
  "timezone",
  "language",
  "date_format",
  // System
  "order_prefix",
  "default_currency",
  "default_country",
  "default_language",
  "default_timezone",
  // Catalog — JSON array of product ids flagged "featured" in the admin.
  // `Product` has no `featured` column; this key is the storage for that flag
  // so the feature ships without a schema change or migration. `settingToString`
  // already JSON-encodes arrays, and the 2000-char cap below bounds the list —
  // the client enforces a matching limit before saving (see
  // admin/src/features/products/featured.ts).
  "featured_product_ids",
]);

/**
 * Keys that are catalog data rather than store configuration.
 *
 * They live in this table only because `Product` has no column for them, so
 * they are authorized as products (`manage_products`), not as settings
 * (`manage_settings`) — writing one is editing the catalog. Anything not listed
 * here keeps requiring `manage_settings`.
 */
const CATALOG_KEYS = new Set(["featured_product_ids"]);

/**
 * Coerce an incoming setting value to the string this table stores.
 *
 * Every allowed key is a scalar text setting. `String(v)` on an object yields
 * the literal `"[object Object]"`, silently persisting corrupt data, so objects
 * and arrays are JSON-encoded instead. All legitimate inputs (string / number /
 * boolean / null / undefined) produce byte-identical output to the previous
 * `String(v ?? "")`.
 */
function settingToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  try {
    return JSON.stringify(v) ?? "";
  } catch {
    return "";
  }
}

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "GET") return getSettings(ctx);
  if (ctx.request.method === "PATCH") return patchSettings(ctx);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, PATCH" });
};

const getSettings: AppFunction = async ({ env, data }) => {
  const reqId = data.reqId;
  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);
  try {
    const rows = await getPrisma(dbUrl).setting.findMany();
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return json({ ok: true, data: settings });
  } catch (err) {
    log("error", { reqId, msg: "settings_get_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};

const patchSettings: AppFunction = async ({ request, env, data }) => {
  const reqId = data.reqId;
  const role = data.admin?.role;
  const canSettings = roleCan(role, "manage_settings");
  const canCatalog = roleCan(role, "manage_products");
  // Baseline gate, kept ahead of any work: an admin holding neither permission
  // has no business on this endpoint, and without this a body containing no
  // recognised keys would fall through the per-key checks below and return the
  // full settings map to anyone authenticated.
  if (!canSettings && !canCatalog) return json({ ok: false, error: "forbidden" }, 403);

  const dbUrl = resolveDatabaseUrl(env);
  if (!dbUrl) return json({ ok: false, error: "database_not_configured" }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!raw || typeof raw !== "object") return json({ ok: false, error: "validation_error" }, 422);

  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([k]) => ALLOWED_KEYS.has(k))
    .map(([k, v]) => [k, settingToString(v).slice(0, 2000)] as [string, string]);

  // Per-key authorization — a write is refused unless the caller holds the
  // permission matching every key it touches.
  if (entries.some(([k]) => !CATALOG_KEYS.has(k)) && !canSettings) {
    return json({ ok: false, error: "forbidden" }, 403);
  }
  if (entries.some(([k]) => CATALOG_KEYS.has(k)) && !canCatalog) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const prisma = getPrisma(dbUrl);
  try {
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
      ),
    );
    const rows = await prisma.setting.findMany();
    return json({ ok: true, data: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  } catch (err) {
    log("error", { reqId, msg: "settings_patch_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "server_error" }, 500);
  }
};
