import type { OrderStatus } from "@/features/orders/types";

export type CustomerTag = "NEW" | "RETURNING" | "VIP" | "HIGH_RISK";

export interface CustomerStats {
  totalOrders: number;
  totalRevenue: number; // centimes
  avgOrderValue: number; // centimes
  delivered: number;
  cancelled: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
}

export interface CustomerListItem extends CustomerStats {
  id: string;
  fullName: string;
  phone: string;
  city: string;
  createdAt: string;
  tag: CustomerTag;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  status: OrderStatus;
  paymentMethod: string;
  createdAt: string;
  items: { colorName: string; sizeLabel: string }[];
}

export interface CustomerProfile extends CustomerStats {
  id: string;
  fullName: string;
  phone: string;
  city: string;
  address: string;
  createdAt: string;
  tag: CustomerTag;
  orders: CustomerOrder[];
}

export type CustomerSortField = "lastOrder" | "totalRevenue" | "totalOrders" | "name" | "createdAt";
export type SortOrder = "asc" | "desc";

export interface CustomersParams {
  page: number;
  pageSize: number;
  q: string;
  city: string;
  tag: string;
  sort: CustomerSortField;
  order: SortOrder;
}

export interface CustomersResponse {
  ok: true;
  data: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
