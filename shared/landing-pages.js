// The landing pages that ship with this site, and how a product connects to one.
//
// One list, two readers. `scripts/copy-landing-pages.mjs` uses it to decide what
// to copy into `dist/`, and the admin products API uses it to tell an admin
// whether the product they are looking at has a page in front of it. Keeping
// both on the same array is what stops the dashboard from claiming a landing
// page that was never deployed.
//
// A landing page is connected to a product by **slug and nothing else**: the
// folder name is the slug, the page posts that slug to `/api/orders`, and the
// order endpoint prices it from the product row with that slug. So adding a
// storefront is: create the folder, add its name here, create the product.
// No API code changes, no second orders system, no per-product endpoint.

/** Folders at the repo root that deploy as-is under the same name. */
export const LANDING_PAGES = [
  "bellevia-weight-gain",
  "bellevia-anti-joint-pain",
  "bellevia-anti-lice",
  "bellevia-pack-raha",
  "bellevia-pack-bila-alam",
];

/** The public path a landing page is served from, e.g. `/bellevia-weight-gain/`. */
export function landingUrlFor(slug) {
  return LANDING_PAGES.includes(slug) ? `/${slug}/` : null;
}

/**
 * How a product and its landing page stand, as one of four states.
 *
 * The two things are deployed separately — a page can exist with no product
 * behind it, and a product can exist with no page in front of it — and each
 * combination fails differently, so they are named rather than collapsed into
 * a boolean:
 *
 *   not_connected — no page deployed at `/<slug>/`. Orders can still be taken
 *                   by any other storefront that posts this slug.
 *   connected     — the page is deployed but the product is a DRAFT, so
 *                   `/api/orders` answers `product_unavailable` and every order
 *                   from that page is lost. This is the dangerous state, and
 *                   the one worth showing an admin before they start spending.
 *   active        — page deployed, product ACTIVE. Orders go through.
 *   inactive      — page deployed, product ARCHIVED. Deliberately switched off.
 *
 * `status` and `isActive` are both read because the public order flow checks
 * both; a row where they disagree is treated as not sellable.
 */
export function landingStatusFor(slug, product) {
  const url = landingUrlFor(slug);
  if (!url) return { url: null, status: "not_connected" };
  if (!product) return { url, status: "connected" };
  if (product.status === "ARCHIVED") return { url, status: "inactive" };
  if (product.status === "ACTIVE" && product.isActive !== false) return { url, status: "active" };
  return { url, status: "connected" };
}

/** The one endpoint every storefront posts to. There is no per-product API. */
export const ORDER_ENDPOINT = "/api/orders";
