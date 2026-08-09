// Single source of truth for catalog constants — imported by both the
// Cloudflare Pages Function (TS, bundled by wrangler) and the Node scripts.

export const CURRENCY = "MAD";

// Prices in centimes (integer, never float).
export const PRICE_BY_QTY = { 1: 29900, 2: 54900 };

/**
 * Multi-buy pack pricing, per product slug, in centimes.
 *
 * A product listed here is sold ONLY in the quantities it names: the total for
 * each is taken from this table rather than multiplied out from the unit price,
 * and any other quantity is refused outright. That is what makes "2 for 349"
 * mean 349 on the order row and not 2 × 199.
 *
 * This is the price the server charges. The browser may say which pack it
 * wants; it never says what that pack costs. Keep it that way — the moment a
 * total is read off the request, anyone can order for a dirham.
 *
 * A slug that is absent keeps the ordinary unit × quantity behaviour, so
 * adding an entry here cannot change what any other product costs.
 */
export const PACK_PRICING = {
  "bellevia-weight-gain": { 1: 19900, 2: 34900, 3: 44900 },
};

/**
 * The pack total for `quantity` of `slug`, in centimes.
 *
 * - `null`      → this product has no pack pricing; price it the usual way.
 * - `undefined` → it does, and this quantity is not one it is sold in.
 */
export function packTotalFor(slug, quantity) {
  const tiers = PACK_PRICING[slug];
  if (!tiers) return null;
  const total = tiers[quantity];
  return typeof total === "number" ? total : undefined;
}

/** The quantities a pack-priced product is sold in, or `null` if it isn't. */
export function packQuantitiesFor(slug) {
  const tiers = PACK_PRICING[slug];
  return tiers ? Object.keys(tiers).map(Number).sort((a, b) => a - b) : null;
}

export const PRODUCT = {
  slug: "cache-terazo",
  name: "بوركيني Cache Terazo",
  description:
    "طقم بوركيني كامل: لباس بحر بسحاب + جاكيت خارجي أنيق بطبعة راقية + حجاب مدمج. قماش يجف بسرعة ومقاوم للكلور.",
  basePrice: 29900,
  compareAtPrice: 34900,
};

// Colours exactly as shown in the landing page selector.
export const COLORS = [
  "أسود",
  "أبيض",
  "مارون",
  "بوردو",
  "زيتي",
  "مارون نمري",
  "أسود نمري",
];

export const SIZES = ["L", "XL", "2XL", "3XL"];
