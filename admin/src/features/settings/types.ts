export type AdminRole = "OWNER" | "ADMIN" | "STAFF";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  isActive: boolean;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ShippingCompany {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
  position: number;
}

export interface City {
  id: string;
  name: string;
  shippingCost: number | null; // centimes
  estimatedDays: number | null;
  isActive: boolean;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

export type SettingsMap = Record<string, string>;

export interface AuditParams {
  page: number;
  pageSize: number;
  actor: string;
  action: string;
  entity: string;
  dateFrom: string;
  dateTo: string;
}
