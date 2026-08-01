// Login rate limiting: 5 attempts per IP per 15 minutes.
//
// The mechanism moved to api/_lib/ratelimit so the public tracking endpoint
// could use it too rather than carry a second copy of the same logic. These
// exports keep their original names and signatures, so no call site changes.
import { createRateLimiter } from "../../_lib/ratelimit";

const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

export function hit(ip: string): { blocked: boolean; retryAfter: number } {
  return limiter.hit(ip);
}

export function reset(ip: string): void {
  limiter.reset(ip);
}
