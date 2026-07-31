import { Badge } from "@/components/ui/Badge";
import { DataCardList } from "@/components/ui/DataCardList";
import { formatMoney, formatDate } from "@/lib/format";
import { STATUS_META } from "../status";
import { OrderActions } from "./OrderActions";
import type { Order } from "../types";

/**
 * Mobile layout for the orders list — same data and actions as `OrdersTable`,
 * which is hidden below `lg` where its seven columns stop fitting.
 */
export function OrdersCardList({
  orders,
  onOpen,
  highlightIds,
}: {
  orders: Order[];
  onOpen: (o: Order) => void;
  highlightIds?: Set<string>;
}) {
  return (
    <DataCardList
      items={orders}
      getKey={(o) => o.id}
      onOpen={onOpen}
      // Mirrors the table's tint for orders that arrived since the last poll.
      getCardClassName={(o) => (highlightIds?.has(o.id) ? "bg-success-soft/60 duration-1000" : undefined)}
      renderHead={(o) => (
        <>
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
          <div
            className="shrink-0"
            // The row itself opens the order; the call/WhatsApp buttons must not.
            onClick={(e) => e.stopPropagation()}
          >
            <OrderActions phone={o.customer.phone} orderNumber={o.orderNumber} />
          </div>
        </>
      )}
      getFields={(o) => [
        { label: "المدينة", value: <span className="text-muted">{o.customer.city}</span> },
        { label: "المجموع", value: <span className="font-bold text-ink">{formatMoney(o.totalPrice)}</span> },
        { label: "التاريخ", value: <span className="text-muted">{formatDate(o.createdAt)}</span> },
      ]}
    />
  );
}
