import { type ReactNode } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { OrderActions } from "./OrderActions";
import { STATUS_META, nextStatuses } from "../status";
import { formatMoney, formatDate } from "@/lib/format";
import type { Order, OrderSpaceSeller, OrderStatus } from "../types";

function Row({ label, value, ltr }: { label: string; value: ReactNode; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-ink" dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}

/**
 * How the confirmation WhatsApp went, in one line.
 *
 * "Not configured" is deliberately its own state: it means nobody has given the
 * shop WhatsApp credentials yet, which is a different problem from a message
 * that was attempted and rejected, and it must not read as a failure.
 */
/**
 * How the fulfilment sync went, in one badge.
 *
 * PENDING is amber rather than red on purpose: it means the result is not
 * known, which is a prompt to go and look at Space Seller — not a failure.
 */
const SPACESELLER_META: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  SYNCED: { label: "تم الإرسال", tone: "success" },
  PENDING: { label: "غير مؤكد — تحقق", tone: "warning" },
  FAILED: { label: "فشل", tone: "danger" },
  SKIPPED: { label: "ما تصيفطش", tone: "neutral" },
};

/**
 * How to present the fulfilment state.
 *
 * The distinction worth drawing is between an order Space Seller *should* have
 * received and didn't, and one it was never meant to receive. Only the first is
 * a problem, so only the first gets a retry button or a red line — a product
 * fulfilled elsewhere reads as ordinary, because it is.
 */
function spacesellerView(ss: OrderSpaceSeller | null | undefined): {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  retryable: boolean;
  note?: string;
  noteTone: "muted" | "danger";
} {
  if (ss?.error === "out_of_scope") {
    return {
      label: "خارج نطاق Space Seller",
      tone: "neutral",
      retryable: false,
      note: "هاد المنتج كيتسيفط من جهة أخرى.",
      noteTone: "muted",
    };
  }
  // No sync status at all means nothing was ever attempted — an order placed
  // before the integration existed, or one whose attempt never ran. That is a
  // different thing from "attempted and not sent", and saying so in the same
  // words sends an admin looking for a failure that did not happen.
  if (!ss?.syncStatus) {
    return {
      label: "ما تجرباتش بعد",
      tone: "neutral",
      retryable: true,
      note: "هاد الطلب مازال ما تصيفطش لـ Space Seller. ضغط «إعادة المحاولة» باش تصيفطو.",
      noteTone: "muted",
    };
  }

  const meta = SPACESELLER_META[ss.syncStatus];
  return {
    label: meta?.label ?? ss.syncStatus,
    tone: meta?.tone ?? "neutral",
    retryable: true,
    note: ss.error ?? undefined,
    // Contention is not a failure: another attempt is already in flight.
    noteTone: ss.error === "claim_lost" || ss.error === "already_pending" ? "muted" : "danger",
  };
}

const WHATSAPP_META: Record<string, { label: string; tone: "success" | "danger" | "neutral" | "warning" }> = {
  sent: { label: "✓ تم الإرسال", tone: "success" },
  failed: { label: "⚠ فشل الإرسال", tone: "danger" },
  not_configured: { label: "— غير مفعّل", tone: "neutral" },
  disabled: { label: "— موقوف لهاد المنتج", tone: "neutral" },
  invalid_phone: { label: "⚠ رقم غير صالح", tone: "warning" },
  no_template: { label: "— ما كاينش قالب معتمد", tone: "warning" },
};

export function OrderDrawer({
  order,
  open,
  onClose,
  onChangeStatus,
  statusBusy,
  onResendWhatsApp,
  onRetrySpaceSeller,
  spacesellerBusy,
  canRetrySpaceSeller,
  whatsappBusy,
  canResendWhatsApp,
}: {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onChangeStatus: (id: string, status: OrderStatus) => void;
  statusBusy: boolean;
  /** Explicit resend. Absent when the signed-in admin may not send messages. */
  onResendWhatsApp?: (id: string) => void;
  onRetrySpaceSeller?: (id: string, action: "retry" | "refresh") => void;
  spacesellerBusy?: boolean;
  canRetrySpaceSeller?: boolean;
  whatsappBusy?: boolean;
  canResendWhatsApp?: boolean;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={order ? `طلب ${order.orderNumber}` : ""}>
      {order && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Badge tone={STATUS_META[order.status].tone}>{STATUS_META[order.status].label}</Badge>
            <span className="text-lg font-black text-brand-dark">{formatMoney(order.totalPrice)}</span>
          </div>

          <section>
            <h3 className="mb-1 text-xs font-bold text-faint">الزبون</h3>
            <Row label="الاسم" value={order.customer.fullName} />
            <Row label="الهاتف" value={order.customer.phone} ltr />
            <Row label="المدينة" value={order.customer.city} />
            <Row label="العنوان" value={order.customer.address} />
            <div className="pt-3">
              <OrderActions phone={order.customer.phone} orderNumber={order.orderNumber} />
            </div>
          </section>

          {/* Which product, at what unit price. With one dashboard serving
              several storefronts, an order that only shows a total and a
              size is not enough to pack the right box. */}
          {order.product && (
            <section>
              <h3 className="mb-1 text-xs font-bold text-faint">المنتج</h3>
              <Row label="الاسم" value={order.product.name} />
              <Row label="المعرّف (slug)" value={order.product.slug} ltr />
              <Row label="سعر الوحدة" value={formatMoney(order.product.unitPrice)} />
              <Row label="الكمية" value={String(order.quantity)} />
              <Row label="المجموع" value={formatMoney(order.totalPrice)} />
            </section>
          )}

          {/* Colour and size only exist for products that have them; a
              single-variant product records empty strings, and printing
              "القطعة 1: —" for each unit is noise. */}
          {order.items.some((it) => it.sizeLabel || it.colorName) && (
            <section>
              <h3 className="mb-1 text-xs font-bold text-faint">القطع ({order.quantity})</h3>
              {order.items.map((it, i) => (
                <Row key={i} label={`القطعة ${i + 1}`} value={[it.sizeLabel, it.colorName].filter(Boolean).join(" — ")} />
              ))}
            </section>
          )}

          <section>
            <h3 className="mb-1 text-xs font-bold text-faint">تفاصيل</h3>
            <Row label="طريقة الدفع" value={order.paymentMethod === "COD" ? "الدفع عند الاستلام" : order.paymentMethod} />
            <Row label="المصدر" value={order.source} ltr />
            <Row label="التاريخ" value={formatDate(order.createdAt)} />
          </section>

          {/* Confirmation WhatsApp. Only meaningful once the order has left
              PENDING — before that no message has been attempted. */}
          {order.status !== "PENDING" && (
            <section>
              <h3 className="mb-2 text-xs font-bold text-faint">واتساب التأكيد</h3>
              <div className="flex items-center justify-between gap-3">
                <Badge tone={WHATSAPP_META[order.whatsapp?.status ?? "not_configured"]?.tone ?? "neutral"}>
                  {WHATSAPP_META[order.whatsapp?.status ?? "not_configured"]?.label ?? "— غير معروف"}
                </Badge>
                {canResendWhatsApp && onResendWhatsApp && (
                  <button
                    type="button"
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
                    disabled={whatsappBusy}
                    onClick={() => onResendWhatsApp(order.id)}
                  >
                    {whatsappBusy ? "كيتصيفط…" : "إعادة الإرسال"}
                  </button>
                )}
              </div>
              {order.whatsapp?.sentAt && (
                <p className="mt-1 text-xs text-muted">{formatDate(order.whatsapp.sentAt)}</p>
              )}
              {order.whatsapp?.error && (
                <p className="mt-1 text-xs text-danger">{order.whatsapp.error}</p>
              )}
            </section>
          )}

          {/* Space Seller fulfilment. Shown for every order, because an order
              that was never sent is exactly the one an admin needs to see. */}
          <section>
            <h3 className="mb-2 text-xs font-bold text-faint">Space Seller</h3>
            <div className="flex items-center justify-between gap-3">
              <Badge tone={spacesellerView(order.spaceseller).tone}>
                {spacesellerView(order.spaceseller).label}
              </Badge>
              {spacesellerView(order.spaceseller).retryable && canRetrySpaceSeller && onRetrySpaceSeller && (
                <button
                  type="button"
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
                  disabled={spacesellerBusy}
                  onClick={() => onRetrySpaceSeller(order.id, order.spaceseller?.orderId ? "refresh" : "retry")}
                >
                  {spacesellerBusy
                    ? "كيخدم…"
                    : order.spaceseller?.orderId
                      ? "تحديث الحالة"
                      : "إعادة المحاولة"}
                </button>
              )}
            </div>
            {order.spaceseller?.orderId && (
              <Row label="رقم Space Seller" value={order.spaceseller.orderId} ltr />
            )}
            {order.spaceseller?.status && (
              <Row label="حالة الطلب" value={order.spaceseller.status} ltr />
            )}
            {order.spaceseller?.deliveryStatus && (
              <Row label="حالة التوصيل" value={order.spaceseller.deliveryStatus} ltr />
            )}
            {order.spaceseller?.trackingNumber && (
              <Row label="رقم التتبع" value={order.spaceseller.trackingNumber} ltr />
            )}
            {order.spaceseller?.syncedAt && (
              <p className="mt-1 text-xs text-muted">{formatDate(order.spaceseller.syncedAt)}</p>
            )}
            {spacesellerView(order.spaceseller).note && (
              <p
                className={`mt-1 text-xs ${
                  spacesellerView(order.spaceseller).noteTone === "danger" ? "text-danger" : "text-muted"
                }`}
              >
                {spacesellerView(order.spaceseller).note}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold text-faint">تغيير الحالة</h3>
            <Select
              value={order.status}
              disabled={statusBusy || nextStatuses(order.status).length === 0}
              onChange={(e) => onChangeStatus(order.id, e.target.value as OrderStatus)}
            >
              <option value={order.status}>{STATUS_META[order.status].label} (الحالية)</option>
              {nextStatuses(order.status).map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </Select>
          </section>
        </div>
      )}
    </Drawer>
  );
}
