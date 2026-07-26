import type { ProductStatus } from "./types";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand" | "gold";

export const PRODUCT_STATUS_META: Record<ProductStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "نشط", tone: "success" },
  DRAFT: { label: "مسودة", tone: "warning" },
  ARCHIVED: { label: "مؤرشف", tone: "neutral" },
};

export const PRODUCT_STATUS_OPTIONS = (Object.keys(PRODUCT_STATUS_META) as ProductStatus[]).map(
  (value) => ({ value, label: PRODUCT_STATUS_META[value].label }),
);
