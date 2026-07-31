import { Search, RefreshCw } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { STATUS_OPTIONS } from "../status";

export interface ToolbarProps {
  q: string;
  setQ: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

const field =
  "h-11 rounded-xl border border-line bg-bg px-4 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

export function OrdersToolbar(p: ToolbarProps) {
  return (
    <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-2 xl:grid-cols-6">
      <div className="relative xl:col-span-2">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={p.q}
          onChange={(e) => p.setQ(e.target.value)}
          placeholder="بحث برقم الطلب، الاسم، الهاتف…"
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

      <input
        value={p.city}
        onChange={(e) => p.setCity(e.target.value)}
        placeholder="المدينة"
        className={field}
      />

      <input
        type="date"
        value={p.dateFrom}
        onChange={(e) => p.setDateFrom(e.target.value)}
        className={field}
        aria-label="من تاريخ"
      />

      <div className="flex gap-2">
        {/* `min-w-0` is load-bearing: a flex item defaults to `min-width: auto`,
            and a date input's intrinsic width (~147px) is wider than this grid
            cell — without it the input refuses to shrink and pushes the refresh
            button out of the viewport. */}
        <input
          type="date"
          value={p.dateTo}
          onChange={(e) => p.setDateTo(e.target.value)}
          className={`${field} min-w-0 flex-1`}
          aria-label="إلى تاريخ"
        />
        <Button
          variant="secondary"
          onClick={p.onRefresh}
          disabled={p.refreshing}
          aria-label="تحديث"
          title="تحديث"
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4${p.refreshing ? " animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
