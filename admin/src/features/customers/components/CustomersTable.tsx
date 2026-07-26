import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { OrderActions } from "@/features/orders/components/OrderActions";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { CustomerTagBadge } from "./CustomerTagBadge";
import type { CustomerListItem } from "../types";

export function CustomersTable({
  customers,
  onOpen,
}: {
  customers: CustomerListItem[];
  onOpen: (c: CustomerListItem) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-line bg-brand-soft/40 text-muted">
              <th className="whitespace-nowrap px-4 py-3 font-bold">الزبون</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">المدينة</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">الطلبات</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">الإيراد</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">التصنيف</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">آخر طلب</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.id}
                onClick={() => onOpen(c)}
                className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-brand-soft/20"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.fullName} size={38} />
                    <div>
                      <div className="font-bold text-ink">{c.fullName}</div>
                      <div className="text-xs text-muted" dir="ltr">{c.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{c.city}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{c.totalOrders}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{formatMoney(c.totalRevenue)}</td>
                <td className="px-4 py-3"><CustomerTagBadge tag={c.tag} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateOnly(c.lastOrderDate)}</td>
                <td className="px-4 py-3">
                  <OrderActions phone={c.phone} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
