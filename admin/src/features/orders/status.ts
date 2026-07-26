import type { OrderStatus } from "./types";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

export const STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "قيد الانتظار", tone: "warning" },
  CONFIRMED: { label: "مؤكد", tone: "brand" },
  SHIPPED: { label: "تم الشحن", tone: "brand" },
  DELIVERED: { label: "تم التوصيل", tone: "success" },
  CANCELLED: { label: "ملغى", tone: "danger" },
};

export const STATUS_OPTIONS = (Object.keys(STATUS_META) as OrderStatus[]).map((value) => ({
  value,
  label: STATUS_META[value].label,
}));
