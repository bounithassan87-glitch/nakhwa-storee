// Slug generation shared by the create and duplicate endpoints.
// `_lib` is excluded from Pages Functions routing by the leading underscore.
import type { getPrisma } from "../../../../_lib/db";

type Prisma = ReturnType<typeof getPrisma>;

/**
 * Reduce free text to the `^[a-z0-9-]+$` shape the product slug column accepts.
 *
 * Product names in this store are Arabic, and Arabic characters are not in that
 * set — so this returns an empty string for a purely Arabic name rather than
 * mangling it. Callers must handle that case; `uniqueSlug` does.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * A slug derived from `desired` that no product currently holds.
 *
 * Collisions get a numeric suffix (`-2`, `-3`, …). When `desired` reduces to
 * nothing — the common case for an Arabic-only name — a random readable stem is
 * used instead, so creating a product never fails just because its name has no
 * Latin characters.
 *
 * This narrows the race window but does not close it: two concurrent creates
 * can still pick the same slug. The unique index is the real guard, and callers
 * translate its P2002 into a 409.
 */
export async function uniqueSlug(prisma: Prisma, desired: string): Promise<string> {
  const root = slugify(desired) || `product-${Math.random().toString(36).slice(2, 8)}`;

  const taken = new Set(
    (
      await prisma.product.findMany({
        where: { slug: { startsWith: root } },
        select: { slug: true },
      })
    ).map((p) => p.slug),
  );

  if (!taken.has(root)) return root;
  for (let i = 2; i <= 200; i++) {
    const candidate = `${root}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
