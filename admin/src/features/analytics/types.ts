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
  timeseries: Analytics["timeseries"];
}
