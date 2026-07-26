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
}

/** Resolve the DB connection string, preferring Hyperdrive in production. */
export function resolveDatabaseUrl(env: Env): string | null {
  return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL ?? null;
}
