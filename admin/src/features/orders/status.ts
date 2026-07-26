import type { OrderStatus } from "./types";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand" | "gold";

export const STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "قيد الانتظار", tone: "warning" },
  CONFIRMED: { label: "مؤكد", tone: "brand" },
  PREPARING: { label: "قيد التحضير", tone: "gold" },
  READY_TO_SHIP: { label: "جاهز للشحن", tone: "gold" },
  SHIPPED: { label: "تم الشحن", tone: "brand" },
  IN_TRANSIT: { label: "في الطريق", tone: "brand" },
  DELIVERED: { label: "تم التوصيل", tone: "success" },
  RETURNED: { label: "مُرتجع", tone: "danger" },
  CANCELLED: { label: "ملغى", tone: "danger" },
  REJECTED: { label: "مرفوض", tone: "danger" },
};

export const STATUS_OPTIONS = (Object.keys(STATUS_META) as OrderStatus[]).map((value) => ({
  value,
  label: STATUS_META[value].label,
}));

/** Fulfillment state machine (mirrors functions/api/admin/_lib/orderWorkflow.ts).
 *  The server is authoritative; this lets the UI offer only valid actions. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "REJECTED"],
  CONFIRMED: ["PREPARING", "CANCELLED", "REJECTED"],
  PREPARING: ["READY_TO_SHIP", "CANCELLED"],
  READY_TO_SHIP: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["IN_TRANSIT", "DELIVERED", "RETURNED"],
  IN_TRANSIT: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  RETURNED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function nextStatuses(current: OrderStatus): OrderStatus[] {
  return TRANSITIONS[current] ?? [];
}
