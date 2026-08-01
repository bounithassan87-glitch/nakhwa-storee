import { useNavigate } from "react-router-dom";
import { ShoppingBag, X, MapPin, Package } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { sourceLabel } from "@/features/orders/source";
import { useNotifications, type ToastItem } from "./NotificationsContext";

/** The detailed card shown for a new order. */
function OrderToast({ toast, onOpen }: { toast: ToastItem; onOpen: () => void }) {
  const o = toast.order;
  if (!o) return null;
  const src = sourceLabel(o.source);

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-black text-ink">🛒 {toast.title}</p>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-dark">
          {src.label}
        </span>
      </div>

      <p className="mt-1 truncate text-sm font-bold text-ink">{o.customerName}</p>

      {o.productName && (
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
          <Package className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{o.productName}</span>
        </p>
      )}

      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        {o.city}
        <span className="font-black text-brand-dark">· {formatMoney(o.totalPrice)}</span>
      </p>

      <button
        onClick={onOpen}
        className="mt-2.5 w-full rounded-xl bg-brand px-3 py-2 text-xs font-black text-white transition hover:bg-brand-dark active:scale-[.98]"
      >
        عرض الطلب
      </button>
    </div>
  );
}

/**
 * Global stack of toasts, rendered at the app-shell level so they appear on any
 * admin page. A new-order toast shows the customer, the product, the city and
 * the amount with an explicit action; other modules push plain title/body
 * toasts through the same host.
 */
export function ToastHost() {
  const { toasts, dismissToast, markAllSeen } = useNotifications();
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  const openOrders = (id: number) => {
    markAllSeen();
    void navigate("/orders");
    dismissToast(id);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          // Order cards have their own button; a plain toast is clickable itself.
          onClick={t.order ? undefined : () => openOrders(t.id)}
          className={`pointer-events-auto flex w-full max-w-sm animate-scale-in items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-[0_12px_40px_rgba(60,50,25,.18)] transition hover:border-brand${
            t.order ? "" : " cursor-pointer"
          }`}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-dark">
            <ShoppingBag className="h-5 w-5" />
          </span>

          {t.order ? (
            <OrderToast toast={t} onOpen={() => openOrders(t.id)} />
          ) : (
            <div className="min-w-0 flex-1">
              <p className="font-black text-ink">{t.title}</p>
              {t.body && <p className="truncate text-sm text-muted">{t.body}</p>}
            </div>
          )}

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
