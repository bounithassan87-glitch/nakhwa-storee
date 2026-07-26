import { type ReactNode } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { OrderActions } from "./OrderActions";
import { STATUS_META, STATUS_OPTIONS } from "../status";
import { formatMoney, formatDate } from "@/lib/format";
import type { Order, OrderStatus } from "../types";

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

export function OrderDrawer({
  order,
  open,
  onClose,
  onChangeStatus,
  statusBusy,
}: {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onChangeStatus: (id: string, status: OrderStatus) => void;
  statusBusy: boolean;
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

          <section>
            <h3 className="mb-1 text-xs font-bold text-faint">القطع ({order.quantity})</h3>
            {order.items.map((it, i) => (
              <Row key={i} label={`القطعة ${i + 1}`} value={`${it.sizeLabel} — ${it.colorName}`} />
            ))}
          </section>

          <section>
            <h3 className="mb-1 text-xs font-bold text-faint">تفاصيل</h3>
            <Row label="طريقة الدفع" value={order.paymentMethod === "COD" ? "الدفع عند الاستلام" : order.paymentMethod} />
            <Row label="التاريخ" value={formatDate(order.createdAt)} />
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold text-faint">تغيير الحالة</h3>
            <Select
              value={order.status}
              disabled={statusBusy}
              onChange={(e) => onChangeStatus(order.id, e.target.value as OrderStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </section>
        </div>
      )}
    </Drawer>
  );
}
