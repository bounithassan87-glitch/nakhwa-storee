import { apiGet } from "@/lib/api";
import type { AnalyticsResponse, RangeKey } from "./types";

export function fetchAnalytics(
  range: RangeKey,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AnalyticsResponse> {
  const qs = new URLSearchParams({ range });
  if (range === "custom") {
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
  }
  return apiGet<AnalyticsResponse>(`/api/admin/analytics?${qs.toString()}`, signal);
}
