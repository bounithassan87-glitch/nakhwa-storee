import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";
import type { AdminRole, AdminUser, AuditEntry, AuditParams, City, SettingsMap, ShippingCompany } from "./types";

// Settings
export const getSettings = () => apiGet<{ ok: true; data: SettingsMap }>("/api/admin/settings");
export const saveSettings = (patch: SettingsMap) =>
  apiPatch<{ ok: true; data: SettingsMap }>("/api/admin/settings", patch);

// Shipping companies
export const getCompanies = () => apiGet<{ ok: true; data: ShippingCompany[] }>("/api/admin/shipping-companies");
export const addCompany = (body: { name: string; phone?: string | null; website?: string | null; notes?: string | null }) =>
  apiPost<{ ok: true; data: ShippingCompany }>("/api/admin/shipping-companies", body);
export const editCompany = (id: string, body: Partial<Omit<ShippingCompany, "id" | "position">>) =>
  apiPatch<{ ok: true; data: ShippingCompany }>(`/api/admin/shipping-companies/${id}`, body);
export const deleteCompany = (id: string) => apiDelete<{ ok: true }>(`/api/admin/shipping-companies/${id}`);

// Cities
export const getCities = () => apiGet<{ ok: true; data: City[] }>("/api/admin/cities");
export const addCity = (body: { name: string; shippingCost?: number | null; estimatedDays?: number | null }) =>
  apiPost<{ ok: true; data: City }>("/api/admin/cities", body);
export const editCity = (id: string, body: Partial<Omit<City, "id">>) =>
  apiPatch<{ ok: true; data: City }>(`/api/admin/cities/${id}`, body);
export const deleteCity = (id: string) => apiDelete<{ ok: true }>(`/api/admin/cities/${id}`);

// Admins
export const getAdmins = () => apiGet<{ ok: true; data: AdminUser[] }>("/api/admin/admins");
export const addAdmin = (body: { email: string; name?: string; password: string; role: AdminRole }) =>
  apiPost<{ ok: true; data: AdminUser }>("/api/admin/admins", body);
export const editAdmin = (id: string, body: { name?: string | null; role?: AdminRole; isActive?: boolean }) =>
  apiPatch<{ ok: true; data: AdminUser }>(`/api/admin/admins/${id}`, body);
export const setAdminPassword = (id: string, password: string) =>
  apiPost<{ ok: true }>(`/api/admin/admins/${id}/password`, { password });

// Audit
export function getAudit(params: AuditParams, signal?: AbortSignal) {
  const qs = new URLSearchParams();
  (Object.entries(params) as [keyof AuditParams, string | number][]).forEach(([k, v]) => {
    if (v !== "" && v != null) qs.set(k, String(v));
  });
  return apiGet<{ ok: true; data: AuditEntry[]; total: number; page: number; pageSize: number; totalPages: number }>(
    `/api/admin/audit?${qs.toString()}`,
    signal,
  );
}

// Profile
export const updateProfile = (body: { name?: string | null; avatarUrl?: string | null }) =>
  apiPatch<{ ok: true; data: { email: string; name: string | null; role: string; avatarUrl: string | null } }>(
    "/api/admin/profile",
    body,
  );
export const changeOwnPassword = (currentPassword: string, newPassword: string) =>
  apiPost<{ ok: true }>("/api/admin/profile/password", { currentPassword, newPassword });
