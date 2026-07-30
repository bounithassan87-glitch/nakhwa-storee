import { Search, RefreshCw, RotateCcw, Plus, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { PRODUCT_STATUS_OPTIONS } from "../status";
import { hasActiveFilters, type ProductsFilters } from "../filters";
import type { FeaturedFilter, ProductSortField } from "../types";

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
  filters,
  onChange,
  onReset,
  categories,
  onRefresh,
  refreshing,
  canCreate,
}: {
  filters: ProductsFilters;
  /** Patch one or more filter fields; the page owns the merged state. */
  onChange: (patch: Partial<ProductsFilters>) => void;
  onReset: () => void;
  categories: string[];
  onRefresh: () => void;
  refreshing: boolean;
  canCreate: boolean;
}) {
  const active = hasActiveFilters(filters);

  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        {/* Search */}
        <div className="relative xl:col-span-4">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="بحث بالاسم، SKU أو الرابط…"
            aria-label="بحث"
            className={`${field} w-full pe-10 ps-9`}
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => onChange({ q: "" })}
              aria-label="مسح البحث"
              className="absolute start-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-faint transition hover:bg-line/60 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select
          value={filters.category}
          onChange={(e) => onChange({ category: e.target.value })}
          aria-label="التصنيف"
          className="xl:col-span-2"
        >
          <option value="">كل التصنيفات</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <Select
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value })}
          aria-label="الحالة"
          className="xl:col-span-2"
        >
          <option value="">كل الحالات</option>
          {PRODUCT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Select
          value={filters.featured}
          onChange={(e) => onChange({ featured: e.target.value as FeaturedFilter })}
          aria-label="التمييز"
          className="xl:col-span-2"
        >
          <option value="">مميّز وغير مميّز</option>
          <option value="featured">المميّزة فقط</option>
          <option value="not_featured">غير المميّزة فقط</option>
        </Select>

        <Select
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as ProductSortField })}
          aria-label="ترتيب"
          className="xl:col-span-2"
        >
          {(Object.keys(SORT_LABELS) as ProductSortField[]).map((k) => (
            <option key={k} value={k}>
              ترتيب: {SORT_LABELS[k]}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={!active}
          title={active ? "إعادة ضبط الفلاتر" : "لا توجد فلاتر مفعّلة"}
        >
          <RotateCcw className="h-4 w-4" /> إعادة ضبط الفلاتر
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing} title="تحديث">
            <RefreshCw className={`h-4 w-4${refreshing ? " animate-spin" : ""}`} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>

          {/* Creating a product needs POST /api/admin/products, which the API
              does not expose yet (GET / PATCH / DELETE only). The control is
              shown disabled rather than hidden so the gap is visible instead of
              silently missing. */}
          <Button
            size="sm"
            disabled
            title={
              canCreate
                ? "إضافة منتج غير متاحة بعد — تتطلب واجهة إنشاء منتج في الخادم"
                : "لا تملك صلاحية إدارة المنتجات"
            }
          >
            <Plus className="h-4 w-4" /> إضافة منتج
          </Button>
        </div>
      </div>
    </div>
  );
}
