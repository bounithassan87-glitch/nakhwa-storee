import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { OrderStatus } from "@/features/orders/types";
import type { OrderDetail, ShipmentInput, ShippingParams, ShippingResponse, Shipment, TimelineEvent } from "./types";

export function fetchShippingOrders(params: ShippingParams, signal?: AbortSignal): Promise<ShippingResponse> {
  const qs = new URLSearchParams();
  (Object.entries(params) as [keyof ShippingParams, string | number][]).forEach(([k, v]) => {
    if (v !== "" && v != null) qs.set(k, String(v));
  });
  return apiGet<ShippingResponse>(`/api/admin/orders?${qs.toString()}`, signal);
}

export function fetchOrderDetail(id: string, signal?: AbortSignal): Promise<{ ok: true; data: OrderDetail }> {
  return apiGet(`/api/admin/orders/${encodeURIComponent(id)}`, signal);
}

export function transitionOrder(id: string, status: OrderStatus, note?: string) {
  return apiPatch<{ ok: true; data: OrderDetail }>(`/api/admin/orders/${encodeURIComponent(id)}`, { status, note });
}

export function saveShipment(id: string, body: ShipmentInput) {
  return apiPatch<{ ok: true; data: Shipment }>(`/api/admin/orders/${encodeURIComponent(id)}/shipment`, body);
}

export function addOrderNote(id: string, note: string) {
  return apiPost<{ ok: true; data: TimelineEvent }>(`/api/admin/orders/${encodeURIComponent(id)}/events`, { note });
}
