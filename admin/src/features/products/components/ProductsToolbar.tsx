import { Search, RefreshCw } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { PRODUCT_STATUS_OPTIONS } from "../status";
import type { ProductSortField } from "../types";

const field =
  "h-11 rounded-xl border border-line bg-bg px-4 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

const SORT_LABELS: Record<ProductSortField, string> = {
  createdAt: "الأحدث",
  name: "الاسم",
  basePrice: "السعر",
  ordersCount: "عدد الطلبات",
  revenue: "الإيراد",
  status: "الحالة",
};

export function ProductsToolbar({
  q,
  setQ,
  status,
  setStatus,
  category,
  setCategory,
  categories,
  sort,
  setSort,
  onRefresh,
  refreshing,
}: {
  q: string;
  setQ: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  categories: string[];
  sort: ProductSortField;
  setSort: (v: ProductSortField) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-2 xl:grid-cols-5">
      <div className="relative xl:col-span-2">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالاسم، SKU أو الرابط…"
          className={`${field} w-full pe-10`}
        />
      </div>

      <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة">
        <option value="">كل الحالات</option>
        {PRODUCT_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="التصنيف">
        <option value="">كل التصنيفات</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>

      <div className="flex gap-2">
        <Select value={sort} onChange={(e) => setSort(e.target.value as ProductSortField)} aria-label="ترتيب">
          {(Object.keys(SORT_LABELS) as ProductSortField[]).map((k) => (
            <option key={k} value={k}>
              ترتيب: {SORT_LABELS[k]}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={onRefresh} disabled={refreshing} aria-label="تحديث" title="تحديث">
          <RefreshCw className={`h-4 w-4${refreshing ? " animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
