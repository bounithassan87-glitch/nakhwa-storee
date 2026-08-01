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
}

/** Resolve the DB connection string, preferring Hyperdrive in production. */
export function resolveDatabaseUrl(env: Env): string | null {
  return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL ?? null;
}
