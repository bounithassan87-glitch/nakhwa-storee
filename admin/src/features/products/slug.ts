/**
 * Slug helpers for the product form.
 *
 * The slug is not cosmetic here — it is the only thing that connects three
 * separately deployed pieces:
 *
 *   the landing-page folder   `/<slug>/`
 *   the payload it posts      `{ productSlug: "<slug>" }`
 *   the catalog row           `Product.slug`
 *
 * `/api/orders` looks the product up by that string and prices the order from
 * the row it finds. Get it wrong and the page answers `product_unavailable`
 * for every visitor — a silent, total loss of orders that looks like nothing
 * at all from the dashboard. Hence the live preview and the strict check in
 * the form rather than a free-text field.
 *
 * Mirrors `functions/api/admin/products/_lib/slug.ts`, which is authoritative:
 * the server derives its own slug when the form sends none, and the unique
 * index is the real guard against collisions.
 */

/** The shape the `slug` column accepts. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Reduce a product name to a slug candidate.
 *
 * Product names in this store are usually Arabic, and Arabic characters are
 * not in `[a-z0-9-]`, so an Arabic-only name reduces to an empty string. That
 * is deliberate — the caller shows the field empty and the admin types a Latin
 * slug, rather than the form inventing something unrecognisable. A name with
 * Latin in it (“BelleVia Anti Joint Pain”) slugifies exactly as expected.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Validation message for a slug, or null when it is acceptable. */
export function slugError(slug: string): string | null {
  if (slug === "") return null; // optional — the server will derive one
  if (slug.length < 2) return "المعرّف قصير بزاف.";
  if (slug.length > 150) return "المعرّف طويل بزاف.";
  if (!SLUG_PATTERN.test(slug)) {
    return "حروف صغيرة وأرقام وشرطات فقط، بلا شرطة فالبداية ولا فالنهاية.";
  }
  return null;
}
