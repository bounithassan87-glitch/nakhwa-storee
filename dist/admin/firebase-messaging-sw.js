// Service worker for background FCM messages.
//
// Runs outside the app bundle, so it cannot import from src/ — the config is
// repeated here deliberately. These values are public identifiers; the key that
// authorises sending lives only in Cloudflare's secret store.
//
// The compat build is used because a service worker cannot consume the modular
// SDK's ES modules through importScripts.
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCSl_1KlLsLWWHiYqjf7n1i7uLqwzU14bs",
  authDomain: "nakhwa-store-f59d6.firebaseapp.com",
  projectId: "nakhwa-store-f59d6",
  storageBucket: "nakhwa-store-f59d6.firebasestorage.app",
  messagingSenderId: "538264132042",
  appId: "1:538264132042:web:82522e80671d5559731733",
});

const messaging = firebase.messaging();

// Take over as soon as a new version is deployed, rather than waiting for
// every dashboard tab to close. Without this an old worker can keep serving
// pushes for days.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/**
 * Fallback for a data-only message.
 *
 * The server now sends a `webpush.notification` block, which the SDK renders on
 * its own — that is what makes delivery work while the browser is closed,
 * because it no longer depends on this callback running. This stays for any
 * data-only message so one is never silently dropped.
 */
messaging.onBackgroundMessage((payload) => {
  const d = (payload && payload.data) || {};
  if (!d.title && !d.body) return; // the SDK already showed a notification block
  self.registration.showNotification(d.title || "🛒 طلب جديد", {
    body: d.body || "",
    tag: d.tag || "nakhwa-order",
    requireInteraction: true,
    dir: "rtl",
    lang: "ar",
    icon: "/assets/img/icon-192.png",
    badge: "/assets/img/icon-192.png",
    data: { link: d.link || "/admin/orders" },
  });
});

// Clicking focuses an already-open dashboard instead of opening a second tab.
// The link is read from every shape the payload can arrive in: our own
// `data.link`, or the SDK's FCM_MSG envelope when it rendered the notification.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const link =
    data.link ||
    (data.FCM_MSG && data.FCM_MSG.data && data.FCM_MSG.data.link) ||
    (data.FCM_MSG && data.FCM_MSG.notification && data.FCM_MSG.notification.click_action) ||
    "/admin/orders";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const c of all) {
        if (c.url.includes("/admin") && "focus" in c) {
          c.navigate(link);
          return c.focus();
        }
      }
      return clients.openWindow(link);
    }),
  );
});
