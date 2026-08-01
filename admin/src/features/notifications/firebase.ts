/**
 * Firebase project configuration.
 *
 * These values are public by design — they identify the project, they do not
 * authorise anything. Sending is authorised server-side by a service account
 * that never leaves Cloudflare's secret store (see functions/api/_lib/fcm.ts).
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCSl_1KlLsLWWHiYqjf7n1i7uLqwzU14bs",
  authDomain: "nakhwa-store-f59d6.firebaseapp.com",
  projectId: "nakhwa-store-f59d6",
  storageBucket: "nakhwa-store-f59d6.firebasestorage.app",
  messagingSenderId: "538264132042",
  appId: "1:538264132042:web:82522e80671d5559731733",
} as const;

/** Web Push certificate (public key) from Firebase → Cloud Messaging. */
export const VAPID_KEY =
  "BB1CxafIPz_B5A_6ZUeH8CTex77VWgwqv3ZC0zhQ1q63aqboq4vyBE5dgnj_uvVOSbdGScwiDd3mA0Co9nfhC4Y";

/**
 * The dashboard is served under /admin, so the worker registers with that
 * scope. FCM otherwise looks for the file at the origin root, where it is not.
 */
export const SW_URL = `${import.meta.env.BASE_URL}firebase-messaging-sw.js`;
export const SW_SCOPE = import.meta.env.BASE_URL;
