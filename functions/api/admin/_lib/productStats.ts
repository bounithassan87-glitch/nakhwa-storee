// Shared product-analytics helpers. Lives under _lib so Pages does not route it.
// All stats are DERIVED from order items — nothing is stored.

export interface ProductStats {
  ordersCount: number;
  revenue: number; // centimes, non-cancelled
  bestColor: string | null;
  bestSize: string | null;
  cancellationRate: number;
}

export interface StatItem {
  colorName: string;
  sizeLabel: string;
  unitPrice: number;
  order: { id: string; status: string };
}

function topKey(m: Map<string, number>): string | null {
  let best: string | null = null;
  let n = -1;
  for (const [k, v] of m) {
    if (v > n) {
      n = v;
      best = k;
    }
  }
  return best;
}

/** Aggregate a product's order-item rows into CRM-style stats. */
export function statsFromItems(items: StatItem[]): ProductStats {
  const orderIds = new Set<string>();
  const cancelledOrderIds = new Set<string>();
  const colors = new Map<string, number>();
  const sizes = new Map<string, number>();
  let revenue = 0;

  for (const it of items) {
    orderIds.add(it.order.id);
    const cancelled = it.order.status === "CANCELLED";
    if (cancelled) {
      cancelledOrderIds.add(it.order.id);
      continue;
    }
    revenue += it.unitPrice;
    colors.set(it.colorName, (colors.get(it.colorName) ?? 0) + 1);
    sizes.set(it.sizeLabel, (sizes.get(it.sizeLabel) ?? 0) + 1);
  }

  const ordersCount = orderIds.size;
  return {
    ordersCount,
    revenue,
    bestColor: topKey(colors),
    bestSize: topKey(sizes),
    cancellationRate: ordersCount ? cancelledOrderIds.size / ordersCount : 0,
  };
}
