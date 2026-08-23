export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";
export type MediaType = "IMAGE" | "VIDEO";

/**
 * How a product and its landing page stand. Computed by the server from
 * `shared/landing-pages.js` — the same list the build script deploys from, so
 * the dashboard cannot claim a page that was never shipped.
 *
 * `connected` is the state worth noticing: the page is live but the product is
 * a draft, so `/api/orders` answers `product_unavailable` and every order from
 * that page is lost silently.
 */
export type LandingStatus = "not_connected" | "connected" | "active" | "inactive";

export interface LandingPageLink {
  /** `/bellevia-anti-joint-pain/`, or null when no page is deployed. */
  url: string | null;
  status: LandingStatus;
}

export interface ProductColor {
  id: string;
  name: string;
  swatch: string | null;
  position: number;
  isActive: boolean;
}

export interface ProductSize {
  id: string;
  label: string;
  position: number;
}

export interface ProductMedia {
  id: string;
  type: MediaType;
  url: string;
  position: number;
  isMain: boolean;
}

export interface ProductStats {
  ordersCount: number;
  revenue: number;
  bestColor: string | null;
  bestSize: string | null;
  cancellationRate: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  category: string | null;
  basePrice: number;
  offerPrice: number | null;
  compareAtPrice: number | null;
  currency: string;
  status: ProductStatus;
  isActive: boolean;
  /** What `/api/orders` charges for one unit: `offerPrice ?? basePrice`. */
  sellingPrice: number;
  landingPage: LandingPageLink;
  createdAt: string;
  image: string | null;
  colorsCount: number;
  sizesCount: number;
  ordersCount: number;
  revenue: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  basePrice: number;
  offerPrice: number | null;
  compareAtPrice: number | null;
  currency: string;
  status: ProductStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  colors: ProductColor[];
  sizes: ProductSize[];
  media: ProductMedia[];
  stats: ProductStats;
}

export type ProductSortField = "createdAt" | "name" | "basePrice" | "ordersCount" | "revenue" | "status";
export type SortOrder = "asc" | "desc";

/**
 * Featured filter state. Empty string = no filter, matching the `status` and
 * `category` filters. Applied client-side: the featured set lives in the
 * settings table, not in the products query (see `./featured.ts`).
 */
export type FeaturedFilter = "" | "featured" | "not_featured";

export interface ProductsParams {
  page: number;
  pageSize: number;
  q: string;
  status: string;
  category: string;
  sort: ProductSortField;
  order: SortOrder;
}

export interface ProductsResponse {
  ok: true;
  data: ProductListItem[];
  categories: string[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
