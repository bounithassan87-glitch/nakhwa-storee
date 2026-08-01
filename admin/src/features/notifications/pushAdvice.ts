/**
 * Turns a push registration outcome into something the admin can act on.
 *
 * Kept apart from the banner that renders it so the mapping can be tested on
 * its own: this is the only place that explains why notifications are not
 * arriving, and wrong advice here is worse than none — it sends someone to fix
 * the wrong thing.
 */
import { BellRing, Share, Smartphone, TriangleAlert } from "lucide-react";
import type { PushOutcome } from "./push";

export interface Advice {
  tone: "info" | "warn";
  icon: typeof BellRing;
  title: string;
  body: string;
  /** Ordered steps, when the fix is a sequence the admin performs by hand. */
  steps?: string[];
  action?: string;
  /** The browser's own message — shown verbatim, never paraphrased. */
  detail?: string;
}

export function adviceFor(
  outcome: PushOutcome | undefined,
  permission: NotificationPermission | "unsupported",
  detail?: string,
): Advice | null {
  if (outcome === "enabled") return null;

  switch (outcome) {
    case "needs_install":
      return {
        tone: "info",
        icon: Share,
        title: "الإشعارات على iPhone تحتاج تثبيت اللوحة أولاً",
        body: "نظام iOS لا يسلّم إشعارات الويب إلا للوحة مثبّتة على الشاشة الرئيسية، وليس داخل تبويب Safari عادي.",
        steps: [
          "من Safari: زر المشاركة (المربع مع السهم) في الأسفل",
          "«إضافة إلى الشاشة الرئيسية» ثم «إضافة»",
          "فتح اللوحة من الأيقونة الجديدة، لا من Safari",
          "تسجيل الدخول، ثم السماح بالإشعارات عند طلبها",
        ],
      };

    case "denied":
      return {
        tone: "warn",
        icon: TriangleAlert,
        title: "الإشعارات محظورة في هذا المتصفح",
        body: "تم رفض الإذن سابقاً، ولا يمكن طلبه مرة أخرى من داخل الصفحة. يلزم السماح به من إعدادات الموقع في المتصفح ثم إعادة تحميل اللوحة.",
      };

    case "unsupported":
      return {
        tone: "warn",
        icon: Smartphone,
        title: "هذا المتصفح لا يدعم إشعارات الويب",
        body: "الجرس والصوت والنافذة داخل اللوحة تعمل كالمعتاد، لكن لا تصل إشعارات واللوحة مغلقة. متصفح Chrome أو Edge على أندرويد أو سطح المكتب يدعمها.",
      };

    case "no_token":
      return {
        tone: "warn",
        icon: TriangleAlert,
        title: "تعذّر الحصول على معرّف الجهاز من Firebase",
        body: "الإذن ممنوح، لكن Firebase لم يُصدر معرّفاً لهذا الجهاز. غالباً حاجب إعلانات أو شبكة تمنع الاتصال بخوادم Google.",
        action: "إعادة المحاولة",
      };

    case "failed":
      return {
        tone: "warn",
        icon: TriangleAlert,
        title: "تعذّر تسجيل هذا الجهاز للإشعارات",
        body: "لم يُحفظ الجهاز، لذلك لن تصله إشعارات الطلبات الجديدة. الرسالة التالية من المتصفح:",
        detail: detail ?? "—",
        action: "إعادة المحاولة",
      };

    case "dismissed":
      return {
        tone: "info",
        icon: BellRing,
        title: "الإشعارات غير مفعّلة",
        body: "لم يتم السماح بالإشعارات، فلن تصل تنبيهات الطلبات الجديدة إلى هذا الجهاز.",
        action: "تفعيل الإشعارات",
      };

    default:
      // No attempt recorded yet. Prompt only where asking is still possible —
      // "granted" with no result means registration is still in flight, and a
      // banner that flashes on every load is worse than none.
      if (permission === "default") {
        return {
          tone: "info",
          icon: BellRing,
          title: "فعّل إشعارات الطلبات الجديدة",
          body: "لتصلك الطلبات على هذا الجهاز حتى عندما تكون اللوحة مغلقة.",
          action: "تفعيل الإشعارات",
        };
      }
      return null;
  }
}
