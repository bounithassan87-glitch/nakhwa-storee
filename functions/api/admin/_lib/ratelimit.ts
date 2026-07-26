// In-memory per-IP rate limiter for login attempts.
// NOTE: state lives in a single Worker isolate — fine for this phase / local dev.
// Production hardening: Cloudflare KV, Durable Objects, or WAF Rate Limiting.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const store = new Map<string, { count: number; resetAt: number }>();

export function hit(ip: string): { blocked: boolean; retryAfter: number } {
  const now = Date.now();
  let entry = store.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(ip, entry);
  }
  entry.count++;
  return { blocked: entry.count > MAX_ATTEMPTS, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
}

export function reset(ip: string): void {
  store.delete(ip);
}
