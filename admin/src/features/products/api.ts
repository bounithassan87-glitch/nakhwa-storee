import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";
import type {
  MediaType,
  ProductColor,
  ProductDetail,
  ProductMedia,
  ProductSize,
  ProductsParams,
  ProductsResponse,
  ProductStatus,
} from "./types";

export function fetchProducts(params: ProductsParams, signal?: AbortSignal): Promise<ProductsResponse> {
  const qs = new URLSearchParams();
  (Object.entries(params) as [keyof ProductsParams, string | number][]).forEach(([k, v]) => {
    if (v !== "" && v != null) qs.set(k, String(v));
  });
  return apiGet<ProductsResponse>(`/api/admin/products?${qs.toString()}`, signal);
}

export function fetchProduct(id: string, signal?: AbortSignal): Promise<{ ok: true; data: ProductDetail }> {
  return apiGet(`/api/admin/products/${encodeURIComponent(id)}`, signal);
}

export interface ProductUpdate {
  name?: string;
  slug?: string;
  sku?: string | null;
  category?: string | null;
  description?: string | null;
  basePrice?: number;
  offerPrice?: number | null;
  compareAtPrice?: number | null;
  status?: ProductStatus;
}

const base = (id: string) => `/api/admin/products/${encodeURIComponent(id)}`;

export const updateProduct = (id: string, patch: ProductUpdate) =>
  apiPatch<{ ok: true; data: ProductDetail }>(base(id), patch);

/** Fields accepted when creating a product. Prices are integer centimes. */
export interface ProductCreate {
  name: string;
  slug?: string;
  sku?: string | null;
  category?: string | null;
  description?: string | null;
  basePrice: number;
  offerPrice?: number | null;
  compareAtPrice?: number | null;
  status?: ProductStatus;
}

/** A newly created or duplicated product — enough to navigate to it. */
export interface ProductCreated {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
}

export const createProduct = (body: ProductCreate) =>
  apiPost<{ ok: true; data: ProductCreated }>("/api/admin/products", body);

export const duplicateProduct = (id: string) =>
  apiPost<{ ok: true; data: ProductCreated }>(`${base(id)}/duplicate`);

/** Soft delete: sets status to ARCHIVED and hides the product from the store. */
export const archiveProduct = (id: string) => apiDelete<{ ok: true }>(base(id));

/**
 * Hard delete. The server refuses with `product_has_orders` (409) when any
 * order references the product, so order history can never be destroyed.
 */
export const deleteProduct = (id: string) =>
  apiDelete<{ ok: true }>(`${base(id)}?permanent=true`);

// Colors
export const addColor = (id: string, body: { name: string; swatch?: string | null }) =>
  apiPost<{ ok: true; data: ProductColor }>(`${base(id)}/colors`, body);
export const editColor = (
  id: string,
  colorId: string,
  body: Partial<Pick<ProductColor, "name" | "swatch" | "isActive" | "position">>,
) => apiPatch<{ ok: true; data: ProductColor }>(`${base(id)}/colors/${colorId}`, body);
export const deleteColor = (id: string, colorId: string) =>
  apiDelete<{ ok: true }>(`${base(id)}/colors/${colorId}`);
export const reorderColors = (id: string, ids: string[]) =>
  apiPatch<{ ok: true }>(`${base(id)}/colors`, { ids });

// Sizes
export const addSize = (id: string, body: { label: string }) =>
  apiPost<{ ok: true; data: ProductSize }>(`${base(id)}/sizes`, body);
export const editSize = (id: string, sizeId: string, body: { label?: string; position?: number }) =>
  apiPatch<{ ok: true; data: ProductSize }>(`${base(id)}/sizes/${sizeId}`, body);
export const deleteSize = (id: string, sizeId: string) =>
  apiDelete<{ ok: true }>(`${base(id)}/sizes/${sizeId}`);
export const reorderSizes = (id: string, ids: string[]) =>
  apiPatch<{ ok: true }>(`${base(id)}/sizes`, { ids });

// Media
export const addMedia = (id: string, body: { url: string; type: MediaType; isMain?: boolean }) =>
  apiPost<{ ok: true; data: ProductMedia }>(`${base(id)}/media`, body);
export const updateMedia = (
  id: string,
  mediaId: string,
  body: { isMain?: boolean; position?: number; url?: string },
) => apiPatch<{ ok: true; data: ProductMedia }>(`${base(id)}/media/${mediaId}`, body);
export const deleteMedia = (id: string, mediaId: string) =>
  apiDelete<{ ok: true }>(`${base(id)}/media/${mediaId}`);
export const reorderMedia = (id: string, ids: string[]) =>
  apiPatch<{ ok: true }>(`${base(id)}/media`, { ids });
