import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";
import type { CampaignDetail, CampaignInput, CampaignListItem, CampaignsParams, CampaignsResponse } from "./types";

export function fetchCampaigns(params: CampaignsParams, signal?: AbortSignal): Promise<CampaignsResponse> {
  const qs = new URLSearchParams();
  (Object.entries(params) as [keyof CampaignsParams, string | number][]).forEach(([k, v]) => {
    if (v !== "" && v != null) qs.set(k, String(v));
  });
  return apiGet<CampaignsResponse>(`/api/admin/campaigns?${qs.toString()}`, signal);
}

export const fetchCampaign = (id: string, signal?: AbortSignal) =>
  apiGet<{ ok: true; data: CampaignDetail }>(`/api/admin/campaigns/${encodeURIComponent(id)}`, signal);

export const createCampaign = (body: CampaignInput) =>
  apiPost<{ ok: true; data: CampaignListItem }>("/api/admin/campaigns", body);

export const updateCampaign = (id: string, body: CampaignInput) =>
  apiPatch<{ ok: true; data: CampaignDetail }>(`/api/admin/campaigns/${encodeURIComponent(id)}`, body);

export const deleteCampaign = (id: string) =>
  apiDelete<{ ok: true }>(`/api/admin/campaigns/${encodeURIComponent(id)}`);

export const addCampaignNote = (id: string, note: string) =>
  apiPost<{ ok: true }>(`/api/admin/campaigns/${encodeURIComponent(id)}/events`, { note });

export const attributeOrder = (id: string, orderNumber: string) =>
  apiPost<{ ok: true }>(`/api/admin/campaigns/${encodeURIComponent(id)}/orders`, { orderNumber });

export const unattributeOrder = (id: string, orderId: string) =>
  apiDelete<{ ok: true }>(`/api/admin/campaigns/${encodeURIComponent(id)}/orders/${encodeURIComponent(orderId)}`);
