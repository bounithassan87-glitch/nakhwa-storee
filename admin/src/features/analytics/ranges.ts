import type { RangeKey } from "./types";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "اليوم" },
  { key: "yesterday", label: "أمس" },
  { key: "last7", label: "آخر 7 أيام" },
  { key: "last30", label: "آخر 30 يوم" },
  { key: "thisMonth", label: "هذا الشهر" },
  { key: "custom", label: "مدة مخصصة" },
];
