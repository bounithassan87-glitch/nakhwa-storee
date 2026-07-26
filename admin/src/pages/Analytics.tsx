import { useState, type ReactNode } from "react";
import {
  Wallet,
  Coins,
  TrendingUp,
  CalendarClock,
  ShoppingBag,
  Percent,
  Users,
  UserPlus,
  Crown,
  AlertTriangle,
  Repeat,
  Calculator,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AreaChart } from "@/components/ui/charts/AreaChart";
import { DonutChart } from "@/components/ui/charts/DonutChart";
import { BarList } from "@/components/ui/charts/BarList";
import { AnalyticsToolbar } from "@/features/analytics/components/AnalyticsToolbar";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { STATUS_META } from "@/features/orders/status";
import type { OrderStatus } from "@/features/orders/types";
import type { RangeKey } from "@/features/analytics/types";
import { formatMoney, formatDateOnly } from "@/lib/format";

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: "var(--color-warning)",
  CONFIRMED: "var(--color-brand)",
  PREPARING: "var(--color-gold)",
  READY_TO_SHIP: "var(--color-brand-light)",
  SHIPPED: "var(--color-brand-dark)",
  IN_TRANSIT: "var(--color-brand)",
  DELIVERED: "var(--color-success)",
  RETURNED: "var(--color-danger)",
  CANCELLED: "var(--color-danger)",
  REJECTED: "var(--color-sidebar)",
};
const STATUSES = Object.keys(STATUS_COLOR) as OrderStatus[];

const pct = (n: number) => `${Math.round(n * 100)}٪`;
const axisMoney = (c: number) =>
  new Intl.NumberFormat("ar-MA", { notation: "compact", maximumFractionDigits: 1 }).format(c / 100);
const shortDay = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-base font-black text-ink">{title}</h2>
      {children}
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold text-ink">{title}</h3>
      {children}
    </Card>
  );
}

function NoData() {
  return <p className="py-8 text-center text-sm text-faint">لا توجد بيانات في هذه المدة.</p>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [range, setRange] = useState<RangeKey>("last7");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, loading, error, refetch } = useAnalytics(range, from, to);

  return (
    <>
      <PageHeader
        title="الإحصائيات"
        subtitle={
          data ? `${formatDateOnly(data.range.from)} — ${formatDateOnly(data.range.to)}` : "لوحة ذكاء الأعمال"
        }
      />

      <AnalyticsToolbar
        range={range}
        setRange={setRange}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
        onRefresh={refetch}
        refreshing={loading}
      />

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={AlertCircle}
            title="حدث خطأ"
            description={error}
            action={<Button onClick={refetch}>إعادة المحاولة</Button>}
          />
        </div>
      ) : !data || (data.revenue.total === 0 && data.customers.total === 0) ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={BarChart3}
            title="لا توجد بيانات بعد"
            description="ستظهر الإحصائيات هنا بمجرد ورود أول الطلبات."
          />
        </div>
      ) : (
        <>
          {/* Revenue overview — fixed windows */}
          <Section title="الإيرادات (نظرة عامة)">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="اليوم" value={formatMoney(data.revenue.today)} icon={Coins} />
              <StatCard label="أمس" value={formatMoney(data.revenue.yesterday)} icon={CalendarClock} />
              <StatCard label="آخر 7 أيام" value={formatMoney(data.revenue.last7)} icon={TrendingUp} />
              <StatCard label="آخر 30 يوم" value={formatMoney(data.revenue.last30)} icon={TrendingUp} />
              <StatCard label="الإجمالي" value={formatMoney(data.revenue.total)} icon={Wallet} />
            </div>
          </Section>

          {/* Charts over time */}
          <Section title="التطور عبر الزمن">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="الإيرادات عبر الزمن">
                <AreaChart
                  data={data.timeseries.map((d) => ({ label: shortDay(d.date), value: d.revenue }))}
                  formatValue={axisMoney}
                />
              </ChartCard>
              <ChartCard title="الطلبات عبر الزمن">
                <AreaChart
                  data={data.timeseries.map((d) => ({ label: shortDay(d.date), value: d.orders }))}
                  color="var(--color-gold)"
                  formatValue={(v) => String(Math.round(v))}
                />
              </ChartCard>
            </div>
          </Section>

          {/* Orders */}
          <Section title="الطلبات (حسب المدة)">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid content-start gap-4 sm:grid-cols-2">
                <StatCard label="طلبات اليوم" value={String(data.orders.today)} icon={ShoppingBag} />
                <StatCard label="طلبات المدة" value={String(data.orders.total)} icon={ShoppingBag} />
                <StatCard label="إيراد المدة" value={formatMoney(data.orders.revenue)} icon={Wallet} />
                <StatCard label="نسبة الإلغاء" value={pct(data.orders.cancellationRate)} icon={Percent} />
              </div>
              <div className="lg:col-span-2">
                <ChartCard title="توزيع حالات الطلبات">
                  {data.orders.total === 0 ? (
                    <NoData />
                  ) : (
                    <DonutChart
                      segments={STATUSES.map((s) => ({
                        label: STATUS_META[s].label,
                        value: data.orders.byStatus[s] ?? 0,
                        color: STATUS_COLOR[s],
                      }))}
                    />
                  )}
                </ChartCard>
              </div>
            </div>
          </Section>

          {/* Customers */}
          <Section title="الزبناء (تصنيف دائم)">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="زبناء جدد" value={String(data.customers.new)} icon={UserPlus} hint="طلب واحد أو أقل" />
              <StatCard label="زبناء متكررون" value={String(data.customers.returning)} icon={Repeat} hint="طلبان أو أكثر" />
              <StatCard label="زبناء VIP" value={String(data.customers.vip)} icon={Crown} hint="قيمة عالية" />
              <StatCard label="خطر مرتفع" value={String(data.customers.highRisk)} icon={AlertTriangle} hint="إلغاء مرتفع" />
            </div>
          </Section>

          {/* Performance */}
          <Section title="الأداء">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="متوسط قيمة الطلب" value={formatMoney(data.performance.avgOrderValue)} icon={Calculator} />
              <StatCard label="الإيراد لكل زبون" value={formatMoney(data.performance.revenuePerCustomer)} icon={Users} />
              <StatCard label="معدل تكرار الشراء" value={pct(data.performance.repeatPurchaseRate)} icon={Repeat} />
            </div>
          </Section>

          {/* Geography */}
          <Section title="الجغرافيا">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="أفضل المدن (حسب الطلبات)">
                {data.geography.top.length === 0 ? (
                  <NoData />
                ) : (
                  <BarList
                    items={data.geography.top.map((c) => ({
                      label: c.city,
                      value: c.orders,
                      hint: `· ${formatMoney(c.revenue)}`,
                    }))}
                    formatValue={(v) => `${v} طلب`}
                  />
                )}
              </ChartCard>
              <ChartCard title="الإيراد حسب المدينة">
                {data.geography.cities.length === 0 ? (
                  <NoData />
                ) : (
                  <BarList
                    items={[...data.geography.cities]
                      .sort((a, b) => b.revenue - a.revenue)
                      .slice(0, 6)
                      .map((c) => ({ label: c.city, value: c.revenue }))}
                    color="var(--color-success)"
                    formatValue={formatMoney}
                  />
                )}
              </ChartCard>
            </div>
          </Section>

          {/* Products */}
          <Section title="المنتجات">
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="الأكثر مبيعاً (منتجات)">
                {data.products.products.length === 0 ? (
                  <NoData />
                ) : (
                  <BarList
                    items={data.products.products.slice(0, 6).map((x) => ({ label: x.name, value: x.count }))}
                    formatValue={(v) => `${v} قطعة`}
                  />
                )}
              </ChartCard>
              <ChartCard title="الألوان الأكثر مبيعاً">
                {data.products.colors.length === 0 ? (
                  <NoData />
                ) : (
                  <BarList
                    items={data.products.colors.slice(0, 6).map((x) => ({ label: x.name, value: x.count }))}
                    color="var(--color-brand-light)"
                    formatValue={(v) => `${v} قطعة`}
                  />
                )}
              </ChartCard>
              <ChartCard title="المقاسات الأكثر مبيعاً">
                {data.products.sizes.length === 0 ? (
                  <NoData />
                ) : (
                  <BarList
                    items={data.products.sizes.map((x) => ({ label: x.name, value: x.count }))}
                    color="var(--color-gold)"
                    formatValue={(v) => `${v} قطعة`}
                  />
                )}
              </ChartCard>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
