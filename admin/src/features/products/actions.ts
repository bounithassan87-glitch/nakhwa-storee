/**
 * Builds the row action menu. Shared by the desktop table and the mobile cards
 * so both offer exactly the same operations in the same order.
 */
import { Pencil, Copy, Eye, Archive } from "lucide-react";
import type { ActionItem } from "@/components/ui/ActionMenu";
import type { ProductListItem } from "./types";

/**
 * Public URL for previewing a product.
 *
 * The storefront is a single-product landing page — there is no per-slug public
 * route — so preview opens the site root on the same origin the admin is served
 * from. When per-product pages exist, this is the one place to change.
 */
export function publicProductUrl(): string {
  return `${window.location.origin}/`;
}

export function buildProductActions({
  product,
  canManage,
  onEdit,
  onPreview,
  onArchive,
}: {
  product: ProductListItem;
  canManage: boolean;
  onEdit: () => void;
  onPreview: () => void;
  onArchive: () => void;
}): ActionItem[] {
  const archived = product.status === "ARCHIVED";

  return [
    {
      label: "تعديل",
      icon: Pencil,
      onSelect: onEdit,
    },
    {
      label: "معاينة",
      icon: Eye,
      onSelect: onPreview,
    },
    {
      label: "نسخ",
      icon: Copy,
      onSelect: () => {
        /* unreachable while disabled — see `title` */
      },
      disabled: true,
      // Duplicating needs a create endpoint; the products API is read + update
      // only (GET / PATCH / DELETE). Enabled once POST /api/admin/products lands.
      title: "النسخ غير متاح بعد — يتطلب واجهة إنشاء منتج",
    },
    {
      label: archived ? "مؤرشف بالفعل" : "أرشفة",
      icon: Archive,
      onSelect: onArchive,
      tone: "danger",
      disabled: !canManage || archived,
      title: !canManage
        ? "لا تملك صلاحية إدارة المنتجات"
        : archived
          ? "هذا المنتج مؤرشف بالفعل"
          : undefined,
    },
  ];
}
