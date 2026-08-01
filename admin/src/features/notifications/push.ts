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
  | "unsupported"
  | "denied"
  | "dismissed"
  | "no_token"
  | "failed";

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
export async function enablePush(): Promise<PushOutcome> {
  try {
    if (!(await isSupported())) return "unsupported";
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return "unsupported";

    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "default") {
      const granted = await Notification.requestPermission();
      if (granted === "denied") return "denied";
      if (granted !== "granted") return "dismissed";
    }

    const registration = await registerWorker();
    messaging = messaging ?? getMessaging(firebaseApp());

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return "no_token";

    // Sent on every load rather than only on change: it doubles as the
    // "this device is still alive" signal the server records as lastSeenAt.
    await apiPost("/api/admin/push/token", { token });
    localStorage.setItem(SAVED_TOKEN_KEY, token);
    return "enabled";
  } catch {
    // A blocked worker, a network failure, an ad-blocker — none of it should
    // reach the admin as an error, because nothing they do here depends on it.
    return "failed";
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
