import { apiGet } from "@/lib/api";
import type { CustomerProfile, CustomersParams, CustomersResponse } from "./types";

export function fetchCustomers(
  params: CustomersParams,
  signal?: AbortSignal,
): Promise<CustomersResponse> {
  const qs = new URLSearchParams();
  (Object.entries(params) as [keyof CustomersParams, string | number][]).forEach(([k, v]) => {
    if (v !== "" && v != null) qs.set(k, String(v));
  });
  return apiGet<CustomersResponse>(`/api/admin/customers?${qs.toString()}`, signal);
}

export function fetchCustomer(id: string, signal?: AbortSignal): Promise<{ ok: true; data: CustomerProfile }> {
  return apiGet(`/api/admin/customers/${encodeURIComponent(id)}`, signal);
}
