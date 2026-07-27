import { type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { AreaChart } from "@/components/ui/charts/AreaChart";
import { DonutChart } from "@/components/ui/charts/DonutChart";
import { BarList } from "@/components/ui/charts/BarList";
import { formatMoney } from "@/lib/format";
import { formatX } from "../metrics";
import { PLATFORM_META } from "../meta";
import type { CampaignListItem, PlatformStat, TimeseriesPoint, TopCampaign } from "../types";

const axisMoney = (c: number) =>
  new Intl.NumberFormat("ar-MA", { notation: "compact", maximumFractionDigits: 1 }).format(c / 100);
const shortDay = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold text-ink">{title}</h3>
      {children}
    </Card>
  );
}
function NoData() {
  return <p className="py-8 text-center text-sm text-faint">لا توجد بيانات كافية.</p>;
}

export function CampaignCharts({
  timeseries,
  platforms,
  top,
  campaigns,
}: {
  timeseries: TimeseriesPoint[];
  platforms: PlatformStat[];
  top: TopCampaign[];
  campaigns: CampaignListItem[];
}) {
  const hasSpend = timeseries.some((t) => t.spend > 0);
  const hasRevenue = timeseries.some((t) => t.revenue > 0);

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <ChartCard title="الإيراد عبر الزمن">
        {hasRevenue ? (
          <AreaChart data={timeseries.map((t) => ({ label: shortDay(t.date), value: t.revenue }))} formatValue={axisMoney} />
        ) : (
          <NoData />
        )}
      </ChartCard>

      <ChartCard title="الإنفاق عبر الزمن">
        {hasSpend ? (
          <AreaChart data={timeseries.map((t) => ({ label: shortDay(t.date), value: t.spend }))} color="var(--color-danger)" formatValue={axisMoney} />
        ) : (
          <NoData />
        )}
      </ChartCard>

      <ChartCard title="اتجاه ROAS">
        {hasSpend ? (
          <AreaChart data={timeseries.map((t) => ({ label: shortDay(t.date), value: t.roas }))} color="var(--color-gold)" formatValue={(v) => v.toFixed(1) + "×"} />
        ) : (
          <NoData />
        )}
      </ChartCard>

      <ChartCard title="توزيع المنصات (حسب الإنفاق)">
        {platforms.some((p) => p.spend > 0) ? (
          <DonutChart segments={platforms.filter((p) => p.spend > 0).map((p) => ({ label: PLATFORM_META[p.platform].label, value: p.spend, color: PLATFORM_META[p.platform].color }))} />
        ) : (
          <NoData />
        )}
      </ChartCard>

      <ChartCard title="أداء الحملات (الإيراد)">
        {campaigns.length ? (
          <BarList items={campaigns.slice(0, 6).map((c) => ({ label: c.name, value: c.metrics.revenue, hint: `· ${formatX(c.metrics.roas)}` }))} formatValue={formatMoney} />
        ) : (
          <NoData />
        )}
      </ChartCard>

      <ChartCard title="أفضل الحملات">
        {top.length ? (
          <BarList items={top.map((t) => ({ label: t.name, value: t.revenue, hint: `· ${formatX(t.roas)}` }))} color="var(--color-success)" formatValue={formatMoney} />
        ) : (
          <NoData />
        )}
      </ChartCard>
    </div>
  );
}
