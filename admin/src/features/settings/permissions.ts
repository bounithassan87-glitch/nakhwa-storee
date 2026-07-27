// Frontend mirror of functions/api/admin/_lib/permissions.ts — used to gate UI.
// The server is always authoritative; this only hides controls the user can't use.

export type Role = "owner" | "admin" | "staff";

export type Permission =
  | "manage_admins"
  | "manage_settings"
  | "manage_shipping_settings"
  | "manage_cities"
  | "view_audit"
  | "manage_products"
  | "manage_orders"
  | "manage_shipping"
  | "manage_marketing";

const ROLE_MATRIX: Record<Role, Permission[] | "*"> = {
  owner: "*",
  admin: [
    "manage_settings",
    "manage_shipping_settings",
    "manage_cities",
    "view_audit",
    "manage_products",
    "manage_orders",
    "manage_shipping",
    "manage_marketing",
  ],
  staff: ["manage_orders", "manage_shipping"],
};

function normalize(role: string | undefined | null): Role {
  const r = (role ?? "").toLowerCase();
  return r === "owner" || r === "admin" || r === "staff" ? r : "staff";
}

export function roleCan(role: string | undefined | null, permission: Permission): boolean {
  const grants = ROLE_MATRIX[normalize(role)];
  return grants === "*" || grants.includes(permission);
}

export const ROLE_LABEL: Record<string, string> = {
  OWNER: "المالك",
  ADMIN: "مدير",
  STAFF: "موظف",
  owner: "المالك",
  admin: "مدير",
  staff: "موظف",
};
