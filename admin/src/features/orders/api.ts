import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Order, OrderStatus, OrdersParams, OrdersResponse } from "./types";

export function fetchOrders(params: OrdersParams, signal?: AbortSignal): Promise<OrdersResponse> {
  const qs = new URLSearchParams();
  (Object.entries(params) as [keyof OrdersParams, string | number][]).forEach(([k, v]) => {
    if (v !== "" && v != null) qs.set(k, String(v));
  });
  return apiGet<OrdersResponse>(`/api/admin/orders?${qs.toString()}`, signal);
}

export function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<{ ok: true; order: Pick<Order, "id" | "orderNumber" | "status"> }> {
  return apiPatch(`/api/admin/orders/${encodeURIComponent(id)}`, { status });
}

/**
 * Resend the confirmation WhatsApp. Explicit admin action only — the automatic
 * send happens once, server-side, when an order becomes CONFIRMED.
 */
export function resendWhatsApp(id: string): Promise<{ ok: true; data: { status: string; messageId: string | null } }> {
  return apiPost(`/api/admin/orders/${encodeURIComponent(id)}/whatsapp`);
}

export interface SpaceSellerActionResult {
  ok: boolean;
  action: "retry" | "refresh";
  status: string | null;
  alreadySynced?: boolean;
  spacesellerOrderId?: string | null;
  spacesellerUuid?: string | null;
  deliveryStatus?: string | null;
  trackingNumber?: string | null;
  error: string | null;
}

/**
 * Retry the fulfilment sync, or refresh the status of an order already sent.
 *
 * `retry` may create an order upstream, so the server refuses it outright when
 * one already exists and while a previous attempt is unresolved. `refresh` is
 * read-only upstream and always safe.
 */
export function spacesellerAction(
  id: string,
  action: "retry" | "refresh",
): Promise<SpaceSellerActionResult> {
  return apiPost(`/api/admin/orders/${encodeURIComponent(id)}/spaceseller`, { action });
}
