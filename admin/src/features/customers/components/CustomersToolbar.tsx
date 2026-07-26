import { Search, RefreshCw } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { TAG_OPTIONS } from "../tags";
import type { CustomerSortField } from "../types";

export interface CustomersToolbarProps {
  q: string;
  setQ: (v: string) => void;
  tag: string;
  setTag: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  sort: CustomerSortField;
  setSort: (v: CustomerSortField) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

const field =
  "h-11 rounded-xl border border-line bg-bg px-4 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

const SORT_LABELS: Record<CustomerSortField, string> = {
  lastOrder: "آخر طلب",
  totalRevenue: "الإيراد",
  totalOrders: "عدد الطلبات",
  name: "الاسم",
  createdAt: "تاريخ الإضافة",
};

export function CustomersToolbar(p: CustomersToolbarProps) {
  return (
    <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-2 xl:grid-cols-5">
      <div className="relative xl:col-span-2">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={p.q}
          onChange={(e) => p.setQ(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف…"
          className={`${field} w-full pe-10`}
        />
      </div>

      <Select value={p.tag} onChange={(e) => p.setTag(e.target.value)} aria-label="التصنيف">
        <option value="">كل التصنيفات</option>
        {TAG_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      <input
        value={p.city}
        onChange={(e) => p.setCity(e.target.value)}
        placeholder="المدينة"
        className={field}
      />

      <div className="flex gap-2">
        <Select
          value={p.sort}
          onChange={(e) => p.setSort(e.target.value as CustomerSortField)}
          aria-label="ترتيب"
        >
          {(Object.keys(SORT_LABELS) as CustomerSortField[]).map((k) => (
            <option key={k} value={k}>
              ترتيب: {SORT_LABELS[k]}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={p.onRefresh} disabled={p.refreshing} aria-label="تحديث" title="تحديث">
          <RefreshCw className={`h-4 w-4${p.refreshing ? " animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
