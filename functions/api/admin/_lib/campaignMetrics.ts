// Campaign metrics engine — the single source of truth. All performance figures
// are DERIVED from raw ad inputs + attributed (non-cancelled) orders. Nothing
// here is stored. Money values are integer centimes; ratios are plain numbers.

export interface CampaignRaw {
  budget: number;
  spent: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

export interface AttributedRow {
  status: string;
  totalPrice: number;
  customerId: string;
}

export interface CampaignMetrics {
  orders: number;
  revenue: number; // centimes
  customers: number;
  aov: number; // centimes
  roas: number; // ratio
  profit: number; // centimes
  cpa: number; // centimes
  cpc: number; // centimes
  cpm: number; // centimes
  ctr: number; // ratio 0..1
  conversionRate: number; // ratio 0..1
  avgRevenue: number; // centimes (ARPU)
}

const div = (a: number, b: number): number => (b > 0 ? a / b : 0);

export function computeMetrics(raw: CampaignRaw, rows: AttributedRow[]): CampaignMetrics {
  const live = rows.filter((r) => r.status !== "CANCELLED");
  const orders = live.length;
  const revenue = live.reduce((a, r) => a + r.totalPrice, 0);
  const customers = new Set(live.map((r) => r.customerId)).size;

  return {
    orders,
    revenue,
    customers,
    aov: Math.round(div(revenue, orders)),
    roas: div(revenue, raw.spent),
    profit: revenue - raw.spent,
    cpa: Math.round(div(raw.spent, raw.conversions)),
    cpc: Math.round(div(raw.spent, raw.clicks)),
    cpm: Math.round(div(raw.spent * 1000, raw.impressions)),
    ctr: div(raw.clicks, raw.impressions),
    conversionRate: div(raw.conversions, raw.clicks),
    avgRevenue: Math.round(div(revenue, customers)),
  };
}
