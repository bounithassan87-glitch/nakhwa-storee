import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchOrderStats } from "./api";
import {
  isSoundEnabled,
  setSoundPref,
  primeAudio,
  primeAudioOnFirstGesture,
  playNewOrderSound,
} from "./sound";
import { enablePush, onForegroundPush, type PushOutcome } from "./push";
import type { LatestOrder } from "./types";

/** Poll cadence. Kept inside the requested 10–15s window. Polling only happens
 *  while the tab is visible (Page Visibility API) — no network work in the
 *  background. */
const POLL_MS = 12_000;

export interface ToastItem {
  id: number;
  title: string;
  body?: string;
  /** Present only on new-order toasts; drives the detailed card and its CTA. */
  order?: LatestOrder;
}

/**
 * Desktop notification raised by the poll for an order that arrived while the
 * tab was not in front.
 *
 * This is the fallback path, used when FCM has nothing to deliver through —
 * no service account configured, or the device never registered. When push is
 * working the service worker draws the notification instead; both use the order
 * id as `tag`, so the browser replaces rather than stacks and the admin sees
 * one notification per order either way.
 */
function notifyBrowser(order: LatestOrder, onOpen: () => void): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  try {
    const n = new Notification("🛒 طلب جديد", {
      body: [
        order.customerName,
        order.productName,
        `${order.city} — ${order.totalPrice / 100} درهم`,
      ]
        .filter(Boolean)
        .join("\n"),
      tag: order.id,
      // The store's icon, under /assets/img. The admin bundle ships none, and
      // an unknown /admin/* path resolves to the SPA fallback HTML.
      icon: "/assets/img/icon-192.png",
    });
    n.onclick = () => {
      window.focus();
      onOpen();
      n.close();
    };
  } catch {
    /* Notification can throw on some platforms (e.g. Android without a SW) */
  }
}

interface NotificationsValue {
  /** Number of orders that arrived since the admin last "saw" the list. */
  newCount: number;
  latestOrder: LatestOrder | null;
  /** Bumped every time a new order is detected — pages watch this to refetch. */
  revision: number;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  /** Reset the unseen counter (call when the admin views the orders list). */
  markAllSeen: () => void;
  /** Force an immediate poll (e.g. after a manual refresh). */
  refreshNow: () => void;
  /** Push a toast into the shared notification host (reused by other modules). */
  notify: (title: string, body?: string) => void;
  toasts: ToastItem[];
  dismissToast: (id: number) => void;
  /** "default" until the admin has been asked; drives the Topbar prompt. */
  notificationPermission: NotificationPermission | "unsupported";
  /** Asks the browser once, from a user gesture, and registers for push. */
  requestNotificationPermission: () => void;
  /** Result of the last push registration attempt. */
  pushStatus: PushOutcome | null;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [newCount, setNewCount] = useState(0);
  const [latestOrder, setLatestOrder] = useState<LatestOrder | null>(null);
  const [revision, setRevision] = useState(0);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => isSoundEnabled());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  const [pushStatus, setPushStatus] = useState<PushOutcome | null>(null);

  // Baseline cutoff: orders newer than this are "unseen". Set on bootstrap so
  // pre-existing orders never trigger a notification.
  const sinceRef = useRef<string | null>(null);
  // Id of the order we last raised a toast for — de-dupes repeated polls.
  const notifiedIdRef = useRef<string | null>(null);
  const latestRef = useRef<LatestOrder | null>(null);
  const bootstrappedRef = useRef(false);
  const toastId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback(
    (title: string, body?: string, order?: LatestOrder) => {
      const id = ++toastId.current;
      setToasts((t) => [...t, { id, title, body, order }]);
      // Order cards carry an action, so they stay long enough to be clicked.
      window.setTimeout(() => dismissToast(id), order ? 12000 : 6000);
    },
    [dismissToast],
  );

  // Asks the browser and registers the device in one step, from the Topbar
  // button — a real gesture, which Safari requires and which is better than
  // ambushing the admin with a permission dialog on load.
  const requestNotificationPermission = useCallback(() => {
    void enablePush().then((outcome) => {
      setPushStatus(outcome);
      if (typeof Notification !== "undefined") setNotificationPermission(Notification.permission);
    });
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundPref(enabled);
    setSoundEnabledState(enabled);
    if (enabled) primeAudio(); // enabling counts as the user gesture that unlocks audio
  }, []);

  const markAllSeen = useCallback(() => {
    sinceRef.current = latestRef.current?.createdAt ?? new Date().toISOString();
    if (latestRef.current) notifiedIdRef.current = latestRef.current.id;
    setNewCount(0);
  }, []);

  // Single poll tick. Safe to call ad-hoc (visibility change, manual refresh).
  const poll = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const stats = await fetchOrderStats(sinceRef.current, signal);

        latestRef.current = stats.latest;
        setLatestOrder(stats.latest);

        // First successful response establishes the baseline; do not notify.
        if (!bootstrappedRef.current) {
          bootstrappedRef.current = true;
          sinceRef.current = stats.latest?.createdAt ?? stats.serverTime;
          notifiedIdRef.current = stats.latest?.id ?? null;
          setNewCount(0);
          return;
        }

        setNewCount(stats.newCount);

        // A genuinely new order (newer than baseline, and one we haven't toasted).
        if (stats.latest && stats.newCount > 0 && stats.latest.id !== notifiedIdRef.current) {
          // Guarded by the order id, so the same order is announced once no
          // matter how many polls observe it.
          notifiedIdRef.current = stats.latest.id;
          const order = stats.latest;
          pushToast(
            stats.newCount > 1 ? `${stats.newCount} طلبات جديدة` : "طلب جديد",
            undefined,
            order,
          );
          playNewOrderSound();
          notifyBrowser(order, () => {
            window.location.assign(`${import.meta.env.BASE_URL}orders`);
          });
          setRevision((r) => r + 1); // signal pages to refetch
        }
      } catch {
        /* transient/unauthorized — the api layer handles 401 redirects */
      }
    },
    [pushToast],
  );

  const refreshNow = useCallback(() => {
    void poll();
  }, [poll]);

  // Arm the audio unlock as soon as the dashboard mounts. Without it the chime
  // only ever worked for an admin who happened to toggle the sound control.
  useEffect(() => {
    primeAudioOnFirstGesture();
  }, []);

  // Re-register on every load when permission is already granted. FCM rotates
  // tokens, and the server upserts on the token, so this both refreshes an
  // expired one and records the device as still alive — without ever prompting.
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    void enablePush().then(setPushStatus);
  }, []);

  // A push arriving while the tab is focused never reaches the service worker,
  // so it is used purely as a trigger: poll immediately and let the existing
  // path raise the toast. One source of truth for the toast, and the order-id
  // guard inside `poll` still prevents a second announcement.
  useEffect(() => onForegroundPush(() => void poll()), [poll]);

  // Polling loop with Page Visibility optimization: no polls while hidden, and
  // an immediate poll the moment the tab becomes visible again.
  useEffect(() => {
    const ac = new AbortController();
    void poll(ac.signal); // initial bootstrap

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      ac.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  return (
    <NotificationsContext.Provider
      value={{
        newCount,
        latestOrder,
        revision,
        soundEnabled,
        setSoundEnabled,
        markAllSeen,
        refreshNow,
        notify: pushToast,
        toasts,
        dismissToast,
        notificationPermission,
        requestNotificationPermission,
        pushStatus,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

// The provider and its consumer hook intentionally live together (canonical
// React context pattern). Splitting them would touch every consumer file for a
// Fast-Refresh-only benefit.
// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within <NotificationsProvider>");
  return ctx;
}
