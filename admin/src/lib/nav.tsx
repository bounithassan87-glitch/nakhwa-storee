import {
  LayoutDashboard,
  ShoppingBag,
  Truck,
  Users,
  Package,
  BarChart3,
  Megaphone,
  Settings,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Single source of truth for the admin navigation. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "لوحة القيادة", icon: LayoutDashboard },
  { to: "/orders", label: "الطلبات", icon: ShoppingBag },
  { to: "/shipping", label: "الشحن والتتبع", icon: Truck },
  { to: "/customers", label: "الزبناء", icon: Users },
  { to: "/products", label: "المنتجات", icon: Package },
  { to: "/analytics", label: "الإحصائيات", icon: BarChart3 },
  { to: "/marketing", label: "التسويق والحملات", icon: Megaphone },
  { to: "/settings", label: "الإعدادات", icon: Settings },
  { to: "/profile", label: "الملف الشخصي", icon: UserCircle },
];
