/**
 * FCM registration for the dashboard.
 *
 * Everything here is best-effort. Push is an addition on top of the sound,
 * popup and badge the dashboard already has: if the browser has no support, the
 * admin declines permission, or Firebase is unreachable, `enablePush` reports
 * why and the rest of the notification system is untouched.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from "firebase/messaging";
import { apiPost } from "@/lib/api";
import { firebaseConfig, VAPID_KEY, SW_URL, SW_SCOPE } from "./firebase";

export type PushOutcome =
  | "enabled"
  /** iOS only delivers web push to a home-screen install, not a Safari tab. */
  | "needs_install"
  | "unsupported"
  | "denied"
  | "dismissed"
  | "no_token"
  | "failed";

export interface PushResult {
  outcome: PushOutcome;
  /** The underlying error, when there was one. Shown to the admin verbatim —
   *  a registration that fails silently cannot be diagnosed from either side. */
  detail?: string;
}

/**
 * iOS delivers web push only to a dashboard installed to the home screen.
 *
 * In an ordinary Safari tab `Notification` is not defined at all, so without
 * this check the outcome is an unhelpful "unsupported" — indistinguishable from
 * a browser that will never support push, when in fact one action fixes it.
 */
function iosNeedsInstall(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as Macintosh; the touch points give it away.
  const isIOS =
    /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone;
}

/** The last token this browser registered, so an unchanged one is not re-sent. */
const SAVED_TOKEN_KEY = "nakhwa.admin.pushToken";

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

function firebaseApp(): FirebaseApp {
  app = app ?? (getApps()[0] ?? initializeApp(firebaseConfig));
  return app;
}

/**
 * Register the worker under the dashboard's own scope.
 *
 * FCM looks for /firebase-messaging-sw.js at the origin root by default, but
 * the admin is served from /admin, so the registration is passed explicitly.
 */
async function registerWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
}

/**
 * Ask for permission if it has not been asked, then register this device.
 *
 * Safe to call on every dashboard load: the token is re-saved each time, which
 * is also how a rotated token replaces the one it superseded, and the server
 * upserts on the token so a device never accumulates rows.
 */
export async function enablePush(): Promise<PushResult> {
  try {
    // Checked before `isSupported`, which cannot tell "this browser will never
    // do push" apart from "this browser needs one setup step".
    if (iosNeedsInstall()) return { outcome: "needs_install" };
    if (!(await isSupported())) return { outcome: "unsupported" };
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
      return { outcome: "unsupported" };
    }

    if (Notification.permission === "denied") return { outcome: "denied" };
    if (Notification.permission === "default") {
      const granted = await Notification.requestPermission();
      if (granted === "denied") return { outcome: "denied" };
      if (granted !== "granted") return { outcome: "dismissed" };
    }

    const registration = await registerWorker();
    messaging = messaging ?? getMessaging(firebaseApp());

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { outcome: "no_token" };

    // Sent on every load rather than only on change: it doubles as the
    // "this device is still alive" signal the server records as lastSeenAt.
    await apiPost("/api/admin/push/token", { token });
    localStorage.setItem(SAVED_TOKEN_KEY, token);
    return { outcome: "enabled" };
  } catch (err) {
    // Still never thrown at the admin — an order must not depend on push. But
    // the reason is carried out now instead of discarded: a registration that
    // fails silently is one neither the admin nor a developer can diagnose.
    return { outcome: "failed", detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Foreground messages.
 *
 * FCM does not invoke the service worker while the tab is focused, so without
 * this a notification arriving during use would be silently dropped. The
 * callback routes it into the same in-page toast the poll already raises.
 */
export function onForegroundPush(handler: (data: Record<string, string>) => void): () => void {
  try {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return () => undefined;
    messaging = messaging ?? getMessaging(firebaseApp());
    return onMessage(messaging, (payload) => {
      if (payload.data) handler(payload.data);
    });
  } catch {
    return () => undefined;
  }
}

/** Forget this device — used when the admin turns notifications off. */
export async function disablePush(): Promise<void> {
  const token = localStorage.getItem(SAVED_TOKEN_KEY);
  if (!token) return;
  try {
    await apiDelete("/api/admin/push/token", { token });
  } catch {
    /* the row is pruned server-side when FCM reports the token dead */
  }
  localStorage.removeItem(SAVED_TOKEN_KEY);
}

/** `apiDelete` in lib/api has no body parameter; this endpoint needs one. */
async function apiDelete(path: string, body: unknown): Promise<void> {
  const m = document.cookie.match(/(?:^|;\s*)admin_csrf=([^;]+)/);
  await fetch(path, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": m ? decodeURIComponent(m[1]) : "",
    },
    body: JSON.stringify(body),
  });
}
