import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { formatDateOnly } from "@/lib/format";
import { PRODUCT_STATUS_META } from "../status";
import { buildProductActions } from "../actions";
import { FeaturedToggle, OldPriceCell, PriceCell, StockCell, Thumb } from "./ProductCells";
import type { ProductListItem } from "../types";

const TH = "whitespace-nowrap px-4 py-3 font-bold";

/**
 * Desktop products table. Hidden below `lg`, where `ProductCard` takes over —
 * ten columns cannot be made readable on a phone, and a horizontally scrolling
 * table is a poor touch experience.
 */
export function ProductsTable({
  products,
  featured,
  canManageProducts,
  onOpen,
  onToggleFeatured,
  onPreview,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  products: ProductListItem[];
  featured: Set<string>;
  /** Gates every catalog mutation on this page — edits, archiving and the
   *  featured flag alike (see functions/api/admin/products/_middleware.ts). */
  canManageProducts: boolean;
  onOpen: (p: ProductListItem) => void;
  onToggleFeatured: (id: string) => void;
  onPreview: (p: ProductListItem) => void;
  onDuplicate: (p: ProductListItem) => void;
  onArchive: (p: ProductListItem) => void;
  onDelete: (p: ProductListItem) => void;
}) {
  return (
    <Card className="hidden overflow-hidden lg:block">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <caption className="sr-only">قائمة المنتجات</caption>
          <thead>
            <tr className="border-b border-line bg-brand-soft/40 text-muted">
              <th scope="col" className={TH}>
                <span className="sr-only">الصورة</span>
              </th>
              <th scope="col" className={TH}>المنتج</th>
              <th scope="col" className={TH}>التصنيف</th>
              <th scope="col" className={TH}>السعر</th>
              <th scope="col" className={TH}>السعر القديم</th>
              <th scope="col" className={TH}>المخزون</th>
              <th scope="col" className={TH}>الحالة</th>
              <th scope="col" className={TH}>مميّز</th>
              <th scope="col" className={TH}>أُنشئ في</th>
              <th scope="col" className={TH}>
                <span className="sr-only">إجراءات</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr
                key={p.id}
                onClick={() => onOpen(p)}
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                className="animate-row-in cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-brand-soft/25"
              >
                <td className="py-3 ps-4">
                  <Thumb url={p.image} alt={p.name} />
                </td>

                <td className="px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-bold text-ink">{p.name}</div>
                    <div className="text-xs text-muted">
                      {p.colorsCount} لون · {p.sizesCount} مقاس
                      {p.sku && <span dir="ltr"> · {p.sku}</span>}
                    </div>
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  {p.category ? (
                    <Badge tone="brand">{p.category}</Badge>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <PriceCell product={p} />
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <OldPriceCell product={p} />
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <StockCell />
                </td>

                <td className="px-4 py-3">
                  <Badge tone={PRODUCT_STATUS_META[p.status].tone}>
                    {PRODUCT_STATUS_META[p.status].label}
                  </Badge>
                </td>

                <td className="px-4 py-3">
                  <FeaturedToggle
                    active={featured.has(p.id)}
                    canManage={canManageProducts}
                    onToggle={() => onToggleFeatured(p.id)}
                  />
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateOnly(p.createdAt)}</td>

                <td className="px-4 py-3">
                  <ActionMenu
                    label={`إجراءات ${p.name}`}
                    items={buildProductActions({
                      product: p,
                      canManage: canManageProducts,
                      onEdit: () => onOpen(p),
                      onPreview: () => onPreview(p),
                      onDuplicate: () => onDuplicate(p),
                      onArchive: () => onArchive(p),
                      onDelete: () => onDelete(p),
                    })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
