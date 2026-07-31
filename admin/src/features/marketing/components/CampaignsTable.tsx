import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { STATUS_META, PLATFORM_META } from "../meta";
import { formatX } from "../metrics";
import type { CampaignListItem, CampaignSortField, SortOrder } from "../types";

function SortHead({ label, field, sort, order, onSort, className }: {
  label: string; field: CampaignSortField; sort: CampaignSortField; order: SortOrder; onSort: (f: CampaignSortField) => void; className?: string;
}) {
  const active = sort === field;
  return (
    <th className={`whitespace-nowrap px-4 py-3 ${className ?? ""}`}>
      <button onClick={() => onSort(field)} className="inline-flex items-center gap-1 font-bold hover:text-ink">
        {label}
        {active ? (order === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
      </button>
    </th>
  );
}

export function CampaignsTable({
  campaigns,
  sort,
  order,
  onSort,
  onOpen,
}: {
  campaigns: CampaignListItem[];
  sort: CampaignSortField;
  order: SortOrder;
  onSort: (f: CampaignSortField) => void;
  onOpen: (c: CampaignListItem) => void;
}) {
  return (
    // Hidden below `lg`, where `CampaignsCardList` takes over — nine columns do
    // not fit a phone.
    <Card className="hidden overflow-hidden lg:block">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-right text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-line bg-brand-soft text-muted">
              <SortHead label="الحملة" field="name" sort={sort} order={order} onSort={onSort} />
              <th className="whitespace-nowrap px-4 py-3 font-bold">المنصة</th>
              <SortHead label="الحالة" field="status" sort={sort} order={order} onSort={onSort} />
              <SortHead label="الميزانية" field="budget" sort={sort} order={order} onSort={onSort} />
              <SortHead label="المصروف" field="spent" sort={sort} order={order} onSort={onSort} />
              <SortHead label="الإيراد" field="revenue" sort={sort} order={order} onSort={onSort} />
              <SortHead label="ROAS" field="roas" sort={sort} order={order} onSort={onSort} />
              <th className="whitespace-nowrap px-4 py-3 font-bold">الطلبات</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} onClick={() => onOpen(c)} className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-brand-soft/20">
                <td className="px-4 py-3">
                  <div className="font-bold text-ink">{c.name}</div>
                  {c.objective && <div className="text-xs text-muted">{c.objective}</div>}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLATFORM_META[c.platform].color }} />
                    {PLATFORM_META[c.platform].label}
                  </span>
                </td>
                <td className="px-4 py-3"><Badge tone={STATUS_META[c.status].tone}>{STATUS_META[c.status].label}</Badge></td>
                <td className="whitespace-nowrap px-4 py-3 text-ink">{formatMoney(c.budget)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink">{formatMoney(c.spent)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{formatMoney(c.metrics.revenue)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold" style={{ color: c.metrics.roas >= 1 ? "var(--color-success)" : "var(--color-muted)" }}>{formatX(c.metrics.roas)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink">{c.metrics.orders}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateOnly(c.startDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
