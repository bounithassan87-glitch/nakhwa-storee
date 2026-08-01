// Single source of truth for catalog constants — imported by both the
// Cloudflare Pages Function (TS, bundled by wrangler) and the Node scripts.

export const CURRENCY = "MAD";

// Prices in centimes (integer, never float).
export const PRICE_BY_QTY = { 1: 29900, 2: 54900 };

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
