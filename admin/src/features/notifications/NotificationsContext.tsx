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
import { isSoundEnabled, setSoundPref, primeAudio, playNewOrderSound } from "./sound";
import type { LatestOrder } from "./types";

/** Poll cadence. Kept inside the requested 10–15s window. Polling only happens
 *  while the tab is visible (Page Visibility API) — no network work in the
 *  background. */
const POLL_MS = 12_000;

export interface ToastItem {
  id: number;
  title: string;
  body?: string;
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
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [newCount, setNewCount] = useState(0);
  const [latestOrder, setLatestOrder] = useState<LatestOrder | null>(null);
  const [revision, setRevision] = useState(0);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => isSoundEnabled());
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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
    (title: string, body?: string) => {
      const id = ++toastId.current;
      setToasts((t) => [...t, { id, title, body }]);
      window.setTimeout(() => dismissToast(id), 6000);
    },
    [dismissToast],
  );

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
          notifiedIdRef.current = stats.latest.id;
          const name = stats.latest.customerName;
          if (stats.newCount > 1) {
            pushToast(`${stats.newCount} طلبات جديدة`, `آخرها من ${name} — ${stats.latest.city}`);
          } else {
            pushToast("طلب جديد", `${name} — ${stats.latest.city}`);
          }
          playNewOrderSound();
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
