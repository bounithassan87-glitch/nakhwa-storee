export type CampaignStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type CampaignPlatform = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "GOOGLE" | "SNAPCHAT" | "MANUAL";

export interface CampaignMetrics {
  orders: number;
  revenue: number; // centimes
  customers: number;
  aov: number;
  roas: number;
  profit: number;
  cpa: number;
  cpc: number;
  cpm: number;
  ctr: number;
  conversionRate: number;
  avgRevenue: number;
}

export interface CampaignListItem {
  id: string;
  name: string;
  platform: CampaignPlatform;
  objective: string | null;
  status: CampaignStatus;
  budget: number;
  spent: number;
  clicks: number;
  impressions: number;
  conversions: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  metrics: CampaignMetrics;
}

export interface CampaignOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  customer: { fullName: string; phone: string; city: string };
}

export interface CampaignCustomerRow {
  name: string;
  phone: string;
  city: string;
  orders: number;
  revenue: number;
}

export interface CampaignEventRow {
  id: string;
  type: string;
  note: string | null;
  actor: string | null;
  createdAt: string;
}

export interface CampaignDetail extends Omit<CampaignListItem, never> {
  notes: string | null;
  updatedAt: string;
  orders: CampaignOrderRow[];
  customers: CampaignCustomerRow[];
  timeline: CampaignEventRow[];
}

export interface CampaignSummary {
  totalCampaigns: number;
  activeCampaigns: number;
  budget: number;
  spent: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
  ctr: number;
  conversionRate: number;
  ordersGenerated: number;
  customersAcquired: number;
}

export interface PlatformStat {
  platform: CampaignPlatform;
  spend: number;
  revenue: number;
  count: number;
}

export interface TopCampaign {
  id: string;
  name: string;
  revenue: number;
  roas: number;
  spent: number;
}

export interface TimeseriesPoint {
  date: string;
  revenue: number;
  spend: number;
  roas: number;
}

export type CampaignSortField = "createdAt" | "name" | "budget" | "spent" | "revenue" | "roas" | "status";
export type SortOrder = "asc" | "desc";

export interface CampaignsParams {
  page: number;
  pageSize: number;
  q: string;
  status: string;
  platform: string;
  objective: string;
  budgetMin: string;
  sort: CampaignSortField;
  order: SortOrder;
}

export interface CampaignsResponse {
  ok: true;
  data: CampaignListItem[];
  summary: CampaignSummary;
  platforms: PlatformStat[];
  top: TopCampaign[];
  timeseries: TimeseriesPoint[];
  objectives: string[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CampaignInput {
  name?: string;
  platform?: CampaignPlatform;
  objective?: string | null;
  status?: CampaignStatus;
  budget?: number;
  spent?: number;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  notes?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}
