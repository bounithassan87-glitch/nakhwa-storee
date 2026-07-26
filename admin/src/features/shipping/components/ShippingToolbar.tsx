import { Search, RefreshCw } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { STATUS_OPTIONS } from "@/features/orders/status";

const field =
  "h-11 rounded-xl border border-line bg-bg px-4 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

export interface ShippingToolbarProps {
  q: string;
  setQ: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  company: string;
  setCompany: (v: string) => void;
  companies: string[];
  city: string;
  setCity: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function ShippingToolbar(p: ShippingToolbarProps) {
  return (
    <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-2 xl:grid-cols-6">
      <div className="relative xl:col-span-2">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={p.q}
          onChange={(e) => p.setQ(e.target.value)}
          placeholder="بحث برقم الطلب، الاسم، الهاتف أو رقم التتبع…"
          className={`${field} w-full pe-10`}
        />
      </div>

      <Select value={p.status} onChange={(e) => p.setStatus(e.target.value)} aria-label="الحالة">
        <option value="">كل الحالات</option>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      <Select value={p.company} onChange={(e) => p.setCompany(e.target.value)} aria-label="شركة الشحن">
        <option value="">كل الشركات</option>
        {p.companies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>

      <input value={p.city} onChange={(e) => p.setCity(e.target.value)} placeholder="المدينة" className={field} />

      <div className="flex gap-2">
        <input type="date" value={p.dateFrom} onChange={(e) => p.setDateFrom(e.target.value)} className={`${field} flex-1`} aria-label="من تاريخ" />
        <Button variant="secondary" onClick={p.onRefresh} disabled={p.refreshing} aria-label="تحديث" title="تحديث">
          <RefreshCw className={`h-4 w-4${p.refreshing ? " animate-spin" : ""}`} />
        </Button>
      </div>
      <input type="date" value={p.dateTo} onChange={(e) => p.setDateTo(e.target.value)} className={field} aria-label="إلى تاريخ" />
    </div>
  );
}
