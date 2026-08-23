// Shared environment contract for all Pages Functions.
// Secrets/config come only from the environment — never hardcoded.
export interface Env {
  // Local dev + non-Hyperdrive production: a Postgres connection string.
  DATABASE_URL?: string;
  // Recommended production DB path on Cloudflare: a Hyperdrive binding whose
  // connectionString transparently pools a managed Postgres.
  HYPERDRIVE?: { connectionString: string };
  // Non-secret runtime marker ("development" | "production").
  ENVIRONMENT?: string;
  // Admin authentication (Phase 2.2) — secrets, never committed.
  AUTH_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD_HASH?: string;
  // Firebase service-account JSON, used to mint the OAuth2 token that FCM
  // HTTP v1 requires. Optional: without it push is skipped and the dashboard
  // still gets its sound, popup and badge.
  FIREBASE_SERVICE_ACCOUNT?: string;
  // ── WhatsApp ─────────────────────────────────────────────────────────────
  // Meta WhatsApp Cloud API — the official gateway, and the one in use whenever
  // both of the first two are set. Deliberately NOT named META_* : that prefix
  // already belongs to the Conversions API token below, which carries different
  // permissions, and overwriting it would break server-side ad tracking.
  //
  // Server-side only. The token never reaches a browser, a bundle, a log line
  // or a query string — it is sent in an Authorization header and nowhere else.
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  /** Graph API version, pinned. Defaults to the version CAPI uses. */
  WHATSAPP_GRAPH_VERSION?: string;
  /**
   * Overrides the template language code. Meta matches it exactly — a template
   * registered `ar_AR` and sent as `ar` fails with 132001, which reads as
   * "template does not exist". Set only if WhatsApp Manager disagrees with the
   * `ar` the template registry declares.
   */
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
  /** Test seam only: points the sender at a local mock. Never set in production. */
  WHATSAPP_API_BASE?: string;

  // UltraMsg — the previous gateway. Kept as the fallback: it is used only when
  // the Meta pair above is absent, so the migration is reversible by removing
  // two variables rather than by deploying different code.
  ULTRAMSG_INSTANCE_ID?: string;
  ULTRAMSG_TOKEN?: string;
  /** Test seam only, mirroring WHATSAPP_API_BASE. Never set in production. */
  ULTRAMSG_API_BASE?: string;
  // Meta Conversions API token. Optional: without it server-side events are
  // skipped and the browser pixel carries on alone, so marketing degrades
  // rather than checkout. Never hardcoded — a leaked token lets anyone write
  // events into the ad account.
  META_ACCESS_TOKEN?: string;
  // Optional. Set it to route events to Events Manager → Test Events instead of
  // production, for verifying an integration without polluting real data.
  META_TEST_EVENT_CODE?: string;
}

/** Resolve the DB connection string, preferring Hyperdrive in production. */
export function resolveDatabaseUrl(env: Env): string | null {
  return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL ?? null;
}
