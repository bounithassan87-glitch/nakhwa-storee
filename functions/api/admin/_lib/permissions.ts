// Role/permission model — the single source of truth, reusable and extensible.
// Add a new permission to PERMISSIONS and grant it in ROLE_MATRIX; the frontend
// mirrors this map (admin/src/features/settings/permissions.ts).

export type Role = "owner" | "admin" | "staff";

export const PERMISSIONS = [
  "manage_admins",
  "manage_settings",
  "manage_shipping_settings",
  "manage_cities",
  "view_audit",
  "manage_products",
  "manage_orders",
  "manage_shipping",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// "*" = all permissions. Owner is all-powerful; Admin runs the store but cannot
// manage other admins; Staff handles day-to-day fulfillment only.
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
  ],
  staff: ["manage_orders", "manage_shipping"],
};

export function normalizeRole(role: string | undefined): Role {
  const r = (role ?? "").toLowerCase();
  return r === "owner" || r === "admin" || r === "staff" ? r : "staff";
}

export function roleCan(role: string | undefined, permission: Permission): boolean {
  const grants = ROLE_MATRIX[normalizeRole(role)];
  return grants === "*" || grants.includes(permission);
}
