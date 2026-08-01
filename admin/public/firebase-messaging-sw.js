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

/**
 * The server sends `data` only, so the notification is drawn here for both
 * foreground and background. `tag` is the order id: a repeat delivery of the
 * same order replaces the existing notification rather than stacking a second.
 */
messaging.onBackgroundMessage((payload) => {
  const d = (payload && payload.data) || {};
  self.registration.showNotification(d.title || "🛒 طلب جديد", {
    body: d.body || "",
    tag: d.tag || "nakhwa-order",
    renotify: false,
    dir: "rtl",
    lang: "ar",
    icon: "/admin/assets/icon-192.png",
    badge: "/admin/assets/icon-192.png",
    data: { link: d.link || "/admin/orders" },
  });
});

// Clicking focuses an already-open dashboard instead of opening a second tab.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/admin/orders";

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
