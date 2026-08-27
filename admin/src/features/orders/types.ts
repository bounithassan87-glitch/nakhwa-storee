import type { SpaceSellerBlock } from "@shared/spaceseller-view.js";
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

/**
 * Which product an order is for.
 *
 * Comes from the OrderItem → Product join, not from the `source` string: with
 * several storefronts posting to one endpoint, `source` is a label a landing
 * page chose for itself and nothing guarantees it matches a catalog slug.
 *
 * `unitPrice` is a snapshot of what one unit was charged when the order was
 * placed. Repricing the catalog does not change it, which is why an old order
 * can legitimately disagree with today's product page.
 *
 * Null for the small number of historic orders whose items predate the join.
 */
export interface OrderProduct {
  name: string;
  slug: string;
  unitPrice: number;
}

export interface OrderCustomer {
  fullName: string;
  phone: string;
  city: string;
  address: string;
}

/**
 * State of the confirmation WhatsApp for one order.
 *
 * `status` distinguishes a message that failed to send from one that was never
 * attempted because nothing is configured — the shop needs to tell those apart.
 */
export type WhatsAppStatus =
  | "sent" | "failed" | "not_configured" | "disabled" | "invalid_phone"
  /** Meta is the gateway but this product has no approved template yet. */
  | "no_template";


/** Space Seller fulfilment, as the dashboard shows it. */
/**
 * The Space Seller block, as both order endpoints return it.
 *
 * Aliased to the shared definition rather than restated: the local copy had
 * drifted (`error` optional here, required there), and a client type that
 * disagrees with the server is how a SYNCED order ends up rendering as never
 * attempted.
 */
export type OrderSpaceSeller = SpaceSellerBlock;

export interface OrderWhatsApp {
  sent: boolean;
  sentAt: string | null;
  status: WhatsAppStatus | null;
  error?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  status: OrderStatus;
  paymentMethod: string;
  /** Storefront the order arrived from — see `sourceLabel()`. */
  source: string;
  createdAt: string;
  customer: OrderCustomer;
  items: OrderItem[];
  product: OrderProduct | null;
  whatsapp?: OrderWhatsApp | null;
  spaceseller?: OrderSpaceSeller | null;
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
