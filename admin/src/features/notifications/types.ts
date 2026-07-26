export interface LatestOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalPrice: number;
  currency: string;
  customerName: string;
  city: string;
}

export interface OrderStats {
  ok: true;
  total: number;
  /** Orders created strictly after the `since` timestamp sent by the client. */
  newCount: number;
  serverTime: string;
  latest: LatestOrder | null;
}
