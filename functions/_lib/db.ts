// Prisma client factory with a runtime-appropriate driver adapter.
// - Neon (production + Neon-backed dev): the Neon serverless driver (WebSocket),
//   the driver that works on the Cloudflare Workers runtime for a remote DB.
// - Anything else (local embedded Postgres over TCP): the pg driver adapter.
// A fresh client per request is the correct pattern in the Workers runtime.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeon } from "@prisma/adapter-neon";

export function getPrisma(connectionString: string): PrismaClient {
  const isNeon = /\.neon\.tech/i.test(connectionString);
  const adapter = isNeon
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** Extract a Prisma known-error code (e.g. "P2002") from an unknown error.
 *  The code lives on `err.code`, not in `err.message`. */
export function prismaCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}
