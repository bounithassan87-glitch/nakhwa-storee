/**
 * Builds the row action menu. Shared by the desktop table and the mobile cards
 * so both offer exactly the same operations in the same order.
 */
import { Pencil, Copy, Eye, Archive, Trash2 } from "lucide-react";
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

const NO_PERMISSION = "لا تملك صلاحية إدارة المنتجات";

export function buildProductActions({
  product,
  canManage,
  onEdit,
  onPreview,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  product: ProductListItem;
  canManage: boolean;
  onEdit: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}): ActionItem[] {
  const archived = product.status === "ARCHIVED";
  // A product any order references can only be archived — the server refuses a
  // hard delete to protect order history. Surfacing it here means the admin
  // sees why before clicking rather than after.
  const ordered = product.ordersCount > 0;

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
      onSelect: onDuplicate,
      disabled: !canManage,
      title: canManage ? "إنشاء نسخة كمسودة" : NO_PERMISSION,
    },
    {
      label: archived ? "مؤرشف بالفعل" : "أرشفة",
      icon: Archive,
      onSelect: onArchive,
      disabled: !canManage || archived,
      title: !canManage ? NO_PERMISSION : archived ? "هذا المنتج مؤرشف بالفعل" : undefined,
    },
    {
      label: "حذف نهائي",
      icon: Trash2,
      onSelect: onDelete,
      tone: "danger",
      disabled: !canManage || ordered,
      title: !canManage
        ? NO_PERMISSION
        : ordered
          ? `مرتبط بـ ${product.ordersCount} طلب — الأرشفة فقط`
          : "حذف لا رجعة فيه",
    },
  ];
}
