// Audit-log helpers. Writes are best-effort: a logging failure must never break
// the underlying request.
import type { PrismaClient } from "@prisma/client";

export function clientIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    null
  );
}

export interface AuditEntry {
  actor: string;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: string | null;
  ip?: string | null;
}

export async function writeAudit(prisma: PrismaClient, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        details: entry.details ?? null,
        ip: entry.ip ?? null,
      },
    });
  } catch {
    /* never let audit failure break the request */
  }
}

/** Derive a coarse entity name from an /api/admin/<entity>/... path. */
export function entityFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/api\/admin\/([^/?]+)/);
  return m ? m[1] : null;
}
