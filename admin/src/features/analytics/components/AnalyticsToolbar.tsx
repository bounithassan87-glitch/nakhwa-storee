import { RefreshCw } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { RANGE_OPTIONS } from "../ranges";
import type { RangeKey } from "../types";

const field =
  "h-11 rounded-xl border border-line bg-bg px-4 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

export function AnalyticsToolbar({
  range,
  setRange,
  from,
  setFrom,
  to,
  setTo,
  onRefresh,
  refreshing,
}: {
  range: RangeKey;
  setRange: (v: RangeKey) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="w-44">
        <Select value={range} onChange={(e) => setRange(e.target.value as RangeKey)} aria-label="المدة">
          {RANGE_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {range === "custom" && (
        <>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={field}
            aria-label="من تاريخ"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={field}
            aria-label="إلى تاريخ"
          />
        </>
      )}

      <Button
        variant="secondary"
        onClick={onRefresh}
        disabled={refreshing}
        className="ms-auto"
        aria-label="تحديث"
        title="تحديث"
      >
        <RefreshCw className={`h-4 w-4${refreshing ? " animate-spin" : ""}`} /> تحديث
      </Button>
    </div>
  );
}
