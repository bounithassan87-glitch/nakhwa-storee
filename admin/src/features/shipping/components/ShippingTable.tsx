import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { STATUS_META } from "@/features/orders/status";
import { formatMoney, formatDate } from "@/lib/format";
import type { ShippingOrder } from "../types";

export function ShippingTable({
  orders,
  onOpen,
}: {
  orders: ShippingOrder[];
  onOpen: (o: ShippingOrder) => void;
}) {
  return (
    // Hidden below `lg`, where `ShippingCardList` takes over.
    <Card className="hidden overflow-hidden lg:block">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-line bg-brand-soft/40 text-muted">
              <th className="whitespace-nowrap px-4 py-3 font-bold">رقم الطلب</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">الزبون</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">المدينة</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">الحالة</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">شركة الشحن</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">رقم التتبع</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">المجموع</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => onOpen(o)}
                className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-brand-soft/20"
              >
                <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{o.orderNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{o.customer.fullName}</div>
                  <div className="text-xs text-muted" dir="ltr">{o.customer.phone}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{o.customer.city}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{o.shipment?.company ?? <span className="text-faint">—</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted" dir="ltr">{o.shipment?.trackingNumber ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{formatMoney(o.totalPrice)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
