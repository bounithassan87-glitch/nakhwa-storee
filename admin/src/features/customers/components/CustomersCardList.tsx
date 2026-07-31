import { Avatar } from "@/components/ui/Avatar";
import { DataCardList } from "@/components/ui/DataCardList";
import { OrderActions } from "@/features/orders/components/OrderActions";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { CustomerTagBadge } from "./CustomerTagBadge";
import type { CustomerListItem } from "../types";

/**
 * Mobile layout for the customers list — the counterpart to `CustomersTable`,
 * which is hidden below `lg`.
 */
export function CustomersCardList({
  customers,
  onOpen,
}: {
  customers: CustomerListItem[];
  onOpen: (c: CustomerListItem) => void;
}) {
  return (
    <DataCardList
      items={customers}
      getKey={(c) => c.id}
      onOpen={onOpen}
      renderHead={(c) => (
        <>
          <Avatar name={c.fullName} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-ink">{c.fullName}</p>
            <p className="truncate text-xs text-muted" dir="ltr">
              {c.phone}
            </p>
            <div className="mt-1.5">
              <CustomerTagBadge tag={c.tag} />
            </div>
          </div>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <OrderActions phone={c.phone} />
          </div>
        </>
      )}
      getFields={(c) => [
        { label: "المدينة", value: <span className="text-muted">{c.city}</span> },
        { label: "الطلبات", value: <span className="font-bold text-ink">{c.totalOrders}</span> },
        { label: "الإيراد", value: <span className="font-bold text-ink">{formatMoney(c.totalRevenue)}</span> },
        { label: "آخر طلب", value: <span className="text-muted">{formatDateOnly(c.lastOrderDate)}</span> },
      ]}
    />
  );
}
