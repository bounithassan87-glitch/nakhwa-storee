import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { STATUS_META } from "../status";
import { formatMoney, formatDate } from "@/lib/format";
import { OrderActions } from "./OrderActions";
import type { Order, SortField, SortOrder } from "../types";

function SortHead({
  label,
  field,
  sort,
  order,
  onSort,
}: {
  label: string;
  field: SortField;
  sort: SortField;
  order: SortOrder;
  onSort: (f: SortField) => void;
}) {
  const active = sort === field;
  return (
    <th className="whitespace-nowrap px-4 py-3">
      <button onClick={() => onSort(field)} className="inline-flex items-center gap-1 font-bold hover:text-ink">
        {label}
        {active ? (
          order === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

export function OrdersTable({
  orders,
  sort,
  order,
  onSort,
  onOpen,
  highlightIds,
}: {
  orders: Order[];
  sort: SortField;
  order: SortOrder;
  onSort: (f: SortField) => void;
  onOpen: (o: Order) => void;
  highlightIds?: Set<string>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-line bg-brand-soft/40 text-muted">
              <th className="whitespace-nowrap px-4 py-3 font-bold">رقم الطلب</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">الزبون</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">المدينة</th>
              <SortHead label="المجموع" field="totalPrice" sort={sort} order={order} onSort={onSort} />
              <SortHead label="الحالة" field="status" sort={sort} order={order} onSort={onSort} />
              <SortHead label="التاريخ" field="createdAt" sort={sort} order={order} onSort={onSort} />
              <th className="whitespace-nowrap px-4 py-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => onOpen(o)}
                className={cn(
                  "cursor-pointer border-b border-line/70 last:border-0 transition-colors duration-1000 hover:bg-brand-soft/20",
                  highlightIds?.has(o.id) && "bg-success-soft/60",
                )}
              >
                <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{o.orderNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{o.customer.fullName}</div>
                  <div className="text-xs text-muted" dir="ltr">{o.customer.phone}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{o.customer.city}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{formatMoney(o.totalPrice)}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3">
                  <OrderActions phone={o.customer.phone} orderNumber={o.orderNumber} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
