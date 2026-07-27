import { Megaphone, PlayCircle, Wallet, Coins, TrendingUp, PiggyBank, Target, Calculator, Percent, MousePointerClick, ShoppingBag, Users } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { formatMoney } from "@/lib/format";
import { formatX, formatPct } from "../metrics";
import type { CampaignSummary } from "../types";

export function CampaignKPIs({ s }: { s: CampaignSummary }) {
  return (
    <div className="mb-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <StatCard label="إجمالي الحملات" value={String(s.totalCampaigns)} icon={Megaphone} />
      <StatCard label="حملات نشطة" value={String(s.activeCampaigns)} icon={PlayCircle} />
      <StatCard label="الميزانية" value={formatMoney(s.budget)} icon={Wallet} />
      <StatCard label="المصروف" value={formatMoney(s.spent)} icon={Coins} />
      <StatCard label="الإيراد" value={formatMoney(s.revenue)} icon={TrendingUp} />
      <StatCard label="الربح" value={formatMoney(s.profit)} icon={PiggyBank} />
      <StatCard label="ROAS" value={formatX(s.roas)} icon={Target} />
      <StatCard label="CPA" value={formatMoney(s.cpa)} icon={Calculator} />
      <StatCard label="CTR" value={formatPct(s.ctr)} icon={MousePointerClick} />
      <StatCard label="معدل التحويل" value={formatPct(s.conversionRate)} icon={Percent} />
      <StatCard label="الطلبات المُولّدة" value={String(s.ordersGenerated)} icon={ShoppingBag} />
      <StatCard label="زبناء مكتسَبون" value={String(s.customersAcquired)} icon={Users} />
    </div>
  );
}
