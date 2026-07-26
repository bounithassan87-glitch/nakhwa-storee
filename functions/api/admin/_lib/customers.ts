// Shared customer-analytics helpers for the admin Customers CRM. Lives under
// _lib so Cloudflare Pages does not route it. All stats are DERIVED from order
// history — there is no customer stats/tag column, so nothing here writes.

export type CustomerTag = "NEW" | "RETURNING" | "VIP" | "HIGH_RISK";

export interface CustomerStats {
  totalOrders: number;
  /** Gross booked value across all of the customer's orders, in centimes. */
  totalRevenue: number;
  /** totalRevenue / totalOrders (0 when no orders), in centimes. */
  avgOrderValue: number;
  delivered: number;
  cancelled: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
}

// Thresholds — tunable business rules, documented in admin/CUSTOMERS-MODULE.md.
export const VIP_REVENUE_CENTIMES = 100_000; // ≥ 1000 MAD lifetime booked
export const VIP_DELIVERED_ORDERS = 3; // or ≥ 3 delivered orders
export const HIGH_RISK_MIN_ORDERS = 2; // needs history before flagging risk
export const HIGH_RISK_CANCEL_RATE = 0.5; // ≥ 50% cancelled

/**
 * Single primary tag, by priority: High Risk > VIP > Returning > New.
 * - HIGH_RISK: ≥2 orders and at least half cancelled (operationally urgent).
 * - VIP: high lifetime value or a proven repeat-delivered buyer.
 * - RETURNING: 2+ orders.
 * - NEW: 0–1 orders.
 */
export function computeTag(s: CustomerStats): CustomerTag {
  if (s.totalOrders >= HIGH_RISK_MIN_ORDERS && s.cancelled / s.totalOrders >= HIGH_RISK_CANCEL_RATE) {
    return "HIGH_RISK";
  }
  if (s.totalRevenue >= VIP_REVENUE_CENTIMES || s.delivered >= VIP_DELIVERED_ORDERS) {
    return "VIP";
  }
  if (s.totalOrders >= 2) return "RETURNING";
  return "NEW";
}

/** Build stats from a customer's order rows (status, price, createdAt). */
export function statsFromOrders(
  orders: { status: string; totalPrice: number; createdAt: Date }[],
): CustomerStats {
  const totalOrders = orders.length;
  let totalRevenue = 0;
  let delivered = 0;
  let cancelled = 0;
  let first: number | null = null;
  let last: number | null = null;
  for (const o of orders) {
    totalRevenue += o.totalPrice;
    if (o.status === "DELIVERED") delivered++;
    if (o.status === "CANCELLED") cancelled++;
    const t = o.createdAt.getTime();
    if (first === null || t < first) first = t;
    if (last === null || t > last) last = t;
  }
  return {
    totalOrders,
    totalRevenue,
    avgOrderValue: totalOrders ? Math.round(totalRevenue / totalOrders) : 0,
    delivered,
    cancelled,
    firstOrderDate: first === null ? null : new Date(first).toISOString(),
    lastOrderDate: last === null ? null : new Date(last).toISOString(),
  };
}
