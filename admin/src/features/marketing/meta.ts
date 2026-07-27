import type { CampaignPlatform, CampaignStatus } from "./types";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand" | "gold";

export const STATUS_META: Record<CampaignStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "مسودة", tone: "neutral" },
  SCHEDULED: { label: "مجدولة", tone: "gold" },
  ACTIVE: { label: "نشطة", tone: "success" },
  PAUSED: { label: "متوقفة", tone: "warning" },
  COMPLETED: { label: "مكتملة", tone: "brand" },
  CANCELLED: { label: "ملغاة", tone: "danger" },
};

export const PLATFORM_META: Record<CampaignPlatform, { label: string; color: string }> = {
  FACEBOOK: { label: "فيسبوك", color: "var(--color-brand)" },
  INSTAGRAM: { label: "إنستغرام", color: "var(--color-danger)" },
  TIKTOK: { label: "تيك توك", color: "var(--color-sidebar)" },
  GOOGLE: { label: "غوغل", color: "var(--color-gold)" },
  SNAPCHAT: { label: "سناب شات", color: "var(--color-warning)" },
  MANUAL: { label: "يدوية", color: "var(--color-brand-light)" },
};

export const STATUS_OPTIONS = (Object.keys(STATUS_META) as CampaignStatus[]).map((v) => ({ value: v, label: STATUS_META[v].label }));
export const PLATFORM_OPTIONS = (Object.keys(PLATFORM_META) as CampaignPlatform[]).map((v) => ({ value: v, label: PLATFORM_META[v].label }));

/** Timeline event type → Arabic label. */
export const EVENT_LABEL: Record<string, string> = {
  created: "تم الإنشاء",
  activated: "تم التفعيل",
  paused: "تم الإيقاف المؤقت",
  budget_changed: "تغيّرت الميزانية",
  completed: "اكتملت",
  cancelled: "أُلغيت",
  scheduled: "تمت الجدولة",
  updated: "تم التحديث",
  note: "ملاحظة",
};
