import type { OrderStatus } from "@/features/orders/types";
import { nextStatuses } from "@/features/orders/status";

export { nextStatuses };

type Variant = "primary" | "secondary" | "danger";

/** UI metadata for each transition target (the workflow actions). */
export const ACTION_META: Record<OrderStatus, { label: string; variant: Variant }> = {
  PENDING: { label: "إرجاع لقيد الانتظار", variant: "secondary" },
  CONFIRMED: { label: "تأكيد الطلب", variant: "primary" },
  PREPARING: { label: "بدء التحضير", variant: "primary" },
  READY_TO_SHIP: { label: "جاهز للشحن", variant: "primary" },
  SHIPPED: { label: "شحن الطلب", variant: "primary" },
  IN_TRANSIT: { label: "في الطريق", variant: "primary" },
  DELIVERED: { label: "تم التوصيل", variant: "primary" },
  RETURNED: { label: "تسجيل إرجاع", variant: "danger" },
  CANCELLED: { label: "إلغاء الطلب", variant: "danger" },
  REJECTED: { label: "رفض الطلب", variant: "danger" },
};

/** KPI groups shown on the shipping dashboard, in fulfillment order. */
export const KPI_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY_TO_SHIP",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];
