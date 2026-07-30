/**
 * Products list filter state.
 *
 * Lives outside the toolbar component so the page, the toolbar and the URL
 * sync logic share one definition — and so the component file exports
 * components only, which keeps Fast Refresh reliable (same reasoning as
 * `./errors.ts`).
 */
import type { FeaturedFilter, ProductListItem, ProductSortField } from "./types";

export interface ProductsFilters {
  q: string;
  status: string;
  category: string;
  featured: FeaturedFilter;
  sort: ProductSortField;
}

export const DEFAULT_FILTERS: ProductsFilters = {
  q: "",
  status: "",
  category: "",
  featured: "",
  sort: "createdAt",
};

/** True when anything is narrowing the list — drives the Reset button state. */
export function hasActiveFilters(f: ProductsFilters): boolean {
  return f.q !== "" || f.status !== "" || f.category !== "" || f.featured !== "";
}

/**
 * Apply the featured filter.
 *
 * Search, status and category are filtered by the API. Featured cannot be:
 * the flag lives in the settings table, not on `Product`, so it is applied here
 * over the current page of results.
 *
 * The trade-off is deliberate and visible in the UI — see `Products.tsx`, which
 * shows the post-filter count so the numbers never look wrong. It disappears
 * once `Product.featured` exists and the API can filter on it.
 */
export function applyFeaturedFilter(
  products: ProductListItem[],
  mode: FeaturedFilter,
  featured: Set<string>,
): ProductListItem[] {
  if (mode === "featured") return products.filter((p) => featured.has(p.id));
  if (mode === "not_featured") return products.filter((p) => !featured.has(p.id));
  return products;
}
