import { Badge } from "@/components/ui/Badge";
import { DataCardList } from "@/components/ui/DataCardList";
import { STATUS_META } from "@/features/orders/status";
import { formatMoney, formatDate } from "@/lib/format";
import type { ShippingOrder } from "../types";

/**
 * Mobile layout for the shipping list — the counterpart to `ShippingTable`,
 * which is hidden below `lg` where its eight columns stop fitting.
 */
export function ShippingCardList({
  orders,
  onOpen,
}: {
  orders: ShippingOrder[];
  onOpen: (o: ShippingOrder) => void;
}) {
  return (
    <DataCardList
      items={orders}
      getKey={(o) => o.id}
      onOpen={onOpen}
      renderHead={(o) => (
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-ink">{o.orderNumber}</span>
            <Badge tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</Badge>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-ink">{o.customer.fullName}</p>
          <p className="truncate text-xs text-muted" dir="ltr">
            {o.customer.phone}
          </p>
        </div>
      )}
      getFields={(o) => [
        { label: "المدينة", value: <span className="text-muted">{o.customer.city}</span> },
        {
          label: "شركة الشحن",
          value: o.shipment?.company ? (
            <span className="text-muted">{o.shipment.company}</span>
          ) : (
            <span className="text-faint">—</span>
          ),
        },
        {
          label: "رقم التتبع",
          value: (
            <span className="text-muted" dir="ltr">
              {o.shipment?.trackingNumber ?? "—"}
            </span>
          ),
        },
        { label: "المجموع", value: <span className="font-bold text-ink">{formatMoney(o.totalPrice)}</span> },
        { label: "التاريخ", value: <span className="text-muted">{formatDate(o.createdAt)}</span> },
      ]}
    />
  );
}
