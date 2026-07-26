import type { CustomerTag } from "./types";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand" | "gold";

/** Display metadata for the derived customer tags (Arabic labels + tone). */
export const TAG_META: Record<CustomerTag, { label: string; tone: Tone; hint: string }> = {
  NEW: { label: "جديد", tone: "neutral", hint: "طلب واحد أو أقل" },
  RETURNING: { label: "متكرر", tone: "brand", hint: "طلبان أو أكثر" },
  VIP: { label: "VIP", tone: "gold", hint: "قيمة عالية أو مشترٍ وفيّ" },
  HIGH_RISK: { label: "خطر مرتفع", tone: "danger", hint: "نسبة إلغاء مرتفعة" },
};

export const TAG_OPTIONS = (Object.keys(TAG_META) as CustomerTag[]).map((value) => ({
  value,
  label: TAG_META[value].label,
}));
