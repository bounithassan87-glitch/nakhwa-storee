/**
 * Price derivation for the products list.
 *
 * A product carries three prices: `basePrice` (regular), `offerPrice` (the
 * discounted selling price, when running an offer) and `compareAtPrice` (the
 * struck-through "was" figure). These helpers turn that triple into the two
 * numbers the UI actually shows, in one place, so the table and the mobile
 * cards can never disagree.
 *
 * Lives outside the component file so it exports no components — see
 * `./errors.ts` for the same reasoning.
 */
import type { ProductListItem } from "./types";

/** The price a customer actually pays: the offer when one is set. */
export function effectivePrice(p: ProductListItem): number {
  return p.offerPrice ?? p.basePrice;
}

/** Discount vs. the "was" price, or null when there is nothing to compare. */
export function discountPercent(p: ProductListItem): number | null {
  const was = p.compareAtPrice;
  const now = effectivePrice(p);
  if (was == null || was <= now) return null;
  return Math.round((1 - now / was) * 100);
}

/**
 * Dirhams as typed into a form → the integer centimes the API stores.
 *
 * Returns `null` for blank or unparseable input so an optional price field can
 * be left empty. Rounding happens here, at the single point where a decimal
 * becomes an integer, so no fractional centime ever reaches the database.
 */
export function toCentimes(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Integer centimes → the dirham string a form field shows. */
export function fromCentimes(centimes: number | null | undefined): string {
  if (centimes == null) return "";
  return String(centimes / 100);
}
