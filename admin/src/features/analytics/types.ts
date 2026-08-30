import type { OrderStatus } from "@/features/orders/types";

export type RangeKey = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "custom";

export interface NameCount {
  name: string;
  count: number;
}

export interface CityStat {
  city: string;
  orders: number;
  revenue: number;
}

/**
 * Landing-page funnel.
 *
 * Every rate is nullable: a percentage with nothing to divide by is not zero,
 * it is unknown, and the UI shows "—" rather than inventing a 0%.
 */
export interface FunnelRates {
  visitorsToFormViews: number | null;
  formViewsToStarts: number | null;
  startsToSubmits: number | null;
  submitsToOrders: number | null;
  conversion: number | null;
  formCompletion: number | null;
  abandonment: number | null;
}

export interface Funnel {
  visitors: number;
  formViews: number;
  formStarts: number;
  submitAttempts: number;
  failedSubmissions: number;
  orders: number;
  abandoned: number;
  rates: FunnelRates;
}

export interface FunnelByPage extends Funnel {
  landingPage: string;
}

export interface Analytics {
  range: { key: RangeKey; from: string; to: string };
  revenue: { today: number; yesterday: number; last7: number; last30: number; total: number };
  orders: {
    today: number;
    total: number;
    revenue: number;
    byStatus: Record<OrderStatus, number>;
    cancellationRate: number;
  };
  customers: { total: number; new: number; returning: number; vip: number; highRisk: number };
  performance: { avgOrderValue: number; revenuePerCustomer: number; repeatPurchaseRate: number };
  geography: { cities: CityStat[]; top: CityStat[] };
  products: { products: NameCount[]; colors: NameCount[]; sizes: NameCount[] };
  timeseries: { date: string; revenue: number; orders: number }[];
  /** IANA zone the day boundaries were drawn on, e.g. "Africa/Casablanca". */
  timezone?: string;
  /** Landing-page funnel for the selected range. Null when unavailable. */
  funnel?: Funnel | null;
  /** The same funnel, split by landing page. Empty when unavailable. */
  funnelByPage?: FunnelByPage[];
}

export interface AnalyticsResponse {
  ok: true;
  range: Analytics["range"];
  revenue: Analytics["revenue"];
  orders: Analytics["orders"];
  customers: Analytics["customers"];
  performance: Analytics["performance"];
  geography: Analytics["geography"];
  products: Analytics["products"];
  timezone?: Analytics["timezone"];
  funnel?: Analytics["funnel"];
  funnelByPage?: Analytics["funnelByPage"];
  timeseries: Analytics["timeseries"];
}
