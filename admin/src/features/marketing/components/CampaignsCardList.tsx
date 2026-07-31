import { Badge } from "@/components/ui/Badge";
import { DataCardList } from "@/components/ui/DataCardList";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { STATUS_META, PLATFORM_META } from "../meta";
import { formatX } from "../metrics";
import type { CampaignListItem } from "../types";

/**
 * Mobile layout for the campaigns list — the counterpart to `CampaignsTable`,
 * which is hidden below `lg`.
 */
export function CampaignsCardList({
  campaigns,
  onOpen,
}: {
  campaigns: CampaignListItem[];
  onOpen: (c: CampaignListItem) => void;
}) {
  return (
    <DataCardList
      items={campaigns}
      getKey={(c) => c.id}
      onOpen={onOpen}
      renderHead={(c) => (
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-bold text-ink">{c.name}</span>
            <Badge tone={STATUS_META[c.status].tone}>{STATUS_META[c.status].label}</Badge>
          </div>

          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PLATFORM_META[c.platform].color }}
            />
            {PLATFORM_META[c.platform].label}
            {c.objective && <span className="truncate"> · {c.objective}</span>}
          </p>

          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="font-bold text-ink">{formatMoney(c.metrics.revenue)}</span>
            <span
              className="text-sm font-bold"
              style={{ color: c.metrics.roas >= 1 ? "var(--color-success)" : "var(--color-muted)" }}
            >
              ROAS {formatX(c.metrics.roas)}
            </span>
          </div>
        </div>
      )}
      getFields={(c) => [
        { label: "الميزانية", value: <span className="text-muted">{formatMoney(c.budget)}</span> },
        { label: "المصروف", value: <span className="text-muted">{formatMoney(c.spent)}</span> },
        { label: "الطلبات", value: <span className="font-bold text-ink">{c.metrics.orders}</span> },
        { label: "التاريخ", value: <span className="text-muted">{formatDateOnly(c.startDate)}</span> },
      ]}
    />
  );
}
