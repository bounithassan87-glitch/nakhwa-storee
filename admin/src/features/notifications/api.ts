import { apiGet } from "@/lib/api";
import type { OrderStats } from "./types";

/** Cheap poll endpoint: total + count of orders newer than `since` + latest. */
export function fetchOrderStats(since: string | null, signal?: AbortSignal): Promise<OrderStats> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiGet<OrderStats>(`/api/admin/orders/stats${qs}`, signal);
}
