import { useNavigate } from "react-router-dom";
import { ShoppingBag, X } from "lucide-react";
import { useNotifications } from "./NotificationsContext";

/** Global stack of new-order toasts, rendered at the app-shell level so they
 *  appear on any admin page. Clicking a toast opens the Orders list. */
export function ToastHost() {
  const { toasts, dismissToast, markAllSeen } = useNotifications();
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => {
            markAllSeen();
            navigate("/orders");
            dismissToast(t.id);
          }}
          className="pointer-events-auto flex w-full max-w-sm cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-[0_12px_40px_rgba(60,50,25,.18)] transition hover:border-brand"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-dark">
            <ShoppingBag className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-black text-ink">{t.title}</p>
            {t.body && <p className="truncate text-sm text-muted">{t.body}</p>}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismissToast(t.id);
            }}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-line/50 hover:text-ink"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
