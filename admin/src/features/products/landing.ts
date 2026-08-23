/**
 * Landing-page connection, as shown in the product form and the product page.
 *
 * The list of deployed pages lives on the server (`shared/landing-pages.js`,
 * the same array the build script copies from). The client keeps a copy only
 * so the *create* form can preview the connection before the product exists —
 * there is nothing to ask the server about yet. Everything after creation uses
 * the `landingPage` field the API returns, which is authoritative.
 *
 * Keep this array in step with `shared/landing-pages.js` when a page is added.
 * Drifting only affects the preview on an unsaved form; the saved product's
 * status always comes from the server.
 */
import type { LandingStatus, ProductStatus } from "./types";

export const DEPLOYED_LANDING_PAGES = ["bellevia-weight-gain", "bellevia-anti-joint-pain"];

/** The one endpoint every storefront posts to. There is no per-product API. */
export const ORDER_ENDPOINT = "/api/orders";

export function landingUrlFor(slug: string): string | null {
  return DEPLOYED_LANDING_PAGES.includes(slug) ? `/${slug}/` : null;
}

/** Preview of what the connection will be once the product is saved. */
export function previewLandingStatus(slug: string, status: ProductStatus): LandingStatus {
  if (!landingUrlFor(slug)) return "not_connected";
  if (status === "ARCHIVED") return "inactive";
  if (status === "ACTIVE") return "active";
  return "connected";
}

/**
 * Tones are the shared `Badge` component's, not hand-written classes: the
 * palette tokens are `success`/`warning`/`neutral`, and inventing names next
 * to them produces a badge that silently renders unstyled.
 */
export const LANDING_STATUS_META: Record<
  LandingStatus,
  { label: string; tone: "success" | "warning" | "neutral"; hint: string }
> = {
  active: {
    label: "نشط",
    tone: "success",
    hint: "الصفحة منشورة والمنتج نشط — الطلبات غادي تتسجل عادي.",
  },
  connected: {
    label: "مربوط",
    tone: "warning",
    hint: "الصفحة منشورة ولكن المنتج ماشي نشط. الـ API غادي يرد product_unavailable وكل طلب غادي يضيع — بدّل الحالة لـ«نشط».",
  },
  inactive: {
    label: "متوقف",
    tone: "neutral",
    hint: "الصفحة منشورة والمنتج مؤرشف. ما كاين حتى طلب غادي يتقبل.",
  },
  not_connected: {
    label: "ماشي مربوط",
    tone: "neutral",
    hint: "ما كاينة حتى صفحة هبوط بهاد المعرّف. المنتج كيبقى خدام مع أي واجهة كتبعت هاد الـ slug.",
  },
};
