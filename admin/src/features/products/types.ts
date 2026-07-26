export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";
export type MediaType = "IMAGE" | "VIDEO";

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
