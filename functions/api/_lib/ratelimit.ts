// Per-key in-memory rate limiting, shared by every endpoint that needs it.
//
// NOTE: state lives in a single Worker isolate, so the real ceiling is higher
// than the configured one — an attacker spread across isolates gets a budget
// per isolate. That is acceptable for slowing down noise and abuse; it is not a
// security boundary. Production hardening: Cloudflare KV, Durable Objects, or
// WAF Rate Limiting.

export interface RateLimiter {
  /** Count one request against `key`. */
  hit(key: string): { blocked: boolean; retryAfter: number };
  /** Forget `key` — e.g. after a successful login. */
  reset(key: string): void;
}

export function createRateLimiter(opts: { windowMs: number; max: number }): RateLimiter {
  const store = new Map<string, { count: number; resetAt: number }>();

  return {
    hit(key) {
      const now = Date.now();
      let entry = store.get(key);
      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + opts.windowMs };
        store.set(key, entry);
      }
      entry.count++;
      return {
        blocked: entry.count > opts.max,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      };
    },
    reset(key) {
      store.delete(key);
    },
  };
}
