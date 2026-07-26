export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "RETURNED"
  | "CANCELLED"
  | "REJECTED";

export interface OrderItem {
  colorName: string;
  sizeLabel: string;
}

export interface OrderCustomer {
  fullName: string;
  phone: string;
  city: string;
  address: string;
}

export interface Order {
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
}

export type SortField = "createdAt" | "totalPrice" | "status";
export type SortOrder = "asc" | "desc";

export interface OrdersParams {
  page: number;
  pageSize: number;
  q: string;
  status: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  sort: SortField;
  order: SortOrder;
}

export interface OrdersResponse {
  ok: true;
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
