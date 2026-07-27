import { Search, RefreshCw } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { STATUS_OPTIONS, PLATFORM_OPTIONS } from "../meta";
import type { CampaignSortField } from "../types";

const field =
  "h-11 rounded-xl border border-line bg-bg px-4 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

const SORT_LABELS: Record<CampaignSortField, string> = {
  createdAt: "الأحدث",
  name: "الاسم",
  budget: "الميزانية",
  spent: "المصروف",
  revenue: "الإيراد",
  roas: "ROAS",
  status: "الحالة",
};

export interface ToolbarProps {
  q: string;
  setQ: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  platform: string;
  setPlatform: (v: string) => void;
  objective: string;
  setObjective: (v: string) => void;
  objectives: string[];
  budgetMin: string;
  setBudgetMin: (v: string) => void;
  sort: CampaignSortField;
  setSort: (v: CampaignSortField) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function CampaignsToolbar(p: ToolbarProps) {
  return (
    <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-2 xl:grid-cols-6">
      <div className="relative xl:col-span-2">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input value={p.q} onChange={(e) => p.setQ(e.target.value)} placeholder="بحث بالاسم أو الهدف…" className={`${field} w-full pe-10`} />
      </div>

      <Select value={p.status} onChange={(e) => p.setStatus(e.target.value)} aria-label="الحالة">
        <option value="">كل الحالات</option>
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>

      <Select value={p.platform} onChange={(e) => p.setPlatform(e.target.value)} aria-label="المنصة">
        <option value="">كل المنصات</option>
        {PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>

      <input value={p.budgetMin} onChange={(e) => p.setBudgetMin(e.target.value)} type="number" placeholder="أدنى ميزانية (درهم)" className={field} aria-label="أدنى ميزانية" />

      <div className="flex gap-2">
        <Select value={p.sort} onChange={(e) => p.setSort(e.target.value as CampaignSortField)} aria-label="ترتيب">
          {(Object.keys(SORT_LABELS) as CampaignSortField[]).map((k) => <option key={k} value={k}>ترتيب: {SORT_LABELS[k]}</option>)}
        </Select>
        <Button variant="secondary" onClick={p.onRefresh} disabled={p.refreshing} aria-label="تحديث" title="تحديث">
          <RefreshCw className={`h-4 w-4${p.refreshing ? " animate-spin" : ""}`} />
        </Button>
      </div>

      {p.objectives.length > 0 && (
        <Select value={p.objective} onChange={(e) => p.setObjective(e.target.value)} aria-label="الهدف">
          <option value="">كل الأهداف</option>
          {p.objectives.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      )}
    </div>
  );
}
