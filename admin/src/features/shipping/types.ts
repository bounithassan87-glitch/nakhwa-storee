import type { OrderStatus, OrderCustomer, OrderItem } from "@/features/orders/types";

export interface Shipment {
  id: string;
  company: string | null;
  trackingNumber: string | null;
  shippingCost: number | null; // centimes
  codAmount: number | null; // centimes
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  status: OrderStatus;
  note: string | null;
  actor: string | null;
  createdAt: string;
}

export interface ShippingOrder {
  id: string;
  orderNumber: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  status: OrderStatus;
  paymentMethod: string;
  createdAt: string;
  customer: OrderCustomer;
  items: OrderItem[];
  shipment: { company: string | null; trackingNumber: string | null; status: string | null } | null;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  status: OrderStatus;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  customer: OrderCustomer;
  items: OrderItem[];
  shipment: Shipment | null;
  timeline: TimelineEvent[];
}

export type ShippingSortField = "createdAt" | "totalPrice" | "status";
export type SortOrder = "asc" | "desc";

export interface ShippingParams {
  page: number;
  pageSize: number;
  q: string;
  status: string;
  company: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  sort: ShippingSortField;
  order: SortOrder;
}

export interface ShippingResponse {
  ok: true;
  data: ShippingOrder[];
  statusCounts: Record<OrderStatus, number>;
  companies: string[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ShipmentInput {
  company?: string | null;
  trackingNumber?: string | null;
  shippingCost?: number | null;
  codAmount?: number | null;
  estimatedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  status?: string | null;
}
