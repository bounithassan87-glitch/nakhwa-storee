import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { formatDateOnly } from "@/lib/format";
import { PRODUCT_STATUS_META } from "../status";
import { buildProductActions } from "../actions";
import { FeaturedToggle, OldPriceCell, PriceCell, StockCell, Thumb } from "./ProductCells";
import type { ProductListItem } from "../types";

/**
 * Mobile/tablet layout for the products list — the same data and the same
 * actions as `ProductsTable`, laid out as cards. Shown below `lg`, where the
 * ten-column table stops being usable.
 */
export function ProductCardList({
  products,
  featured,
  canManageProducts,
  onOpen,
  onToggleFeatured,
  onPreview,
  onArchive,
}: {
  products: ProductListItem[];
  featured: Set<string>;
  /** Gates every catalog mutation on this page — edits, archiving and the
   *  featured flag alike (see functions/api/admin/products/_middleware.ts). */
  canManageProducts: boolean;
  onOpen: (p: ProductListItem) => void;
  onToggleFeatured: (id: string) => void;
  onPreview: (p: ProductListItem) => void;
  onArchive: (p: ProductListItem) => void;
}) {
  return (
    <ul className="grid gap-3 lg:hidden">
      {products.map((p, i) => (
        <li key={p.id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }} className="animate-row-in">
          <Card
            onClick={() => onOpen(p)}
            className="cursor-pointer p-4 transition hover:border-brand active:scale-[.995]"
          >
            <div className="flex items-start gap-3">
              <Thumb url={p.image} alt={p.name} size="lg" />

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold text-ink">{p.name}</h3>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {p.colorsCount} لون · {p.sizesCount} مقاس
                  {p.sku && <span dir="ltr"> · {p.sku}</span>}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PriceCell product={p} />
                  <OldPriceCell product={p} />
                </div>
              </div>

              <div className="flex shrink-0 items-center">
                <FeaturedToggle
                  active={featured.has(p.id)}
                  canManage={canManageProducts}
                  onToggle={() => onToggleFeatured(p.id)}
                />
                <ActionMenu
                  label={`إجراءات ${p.name}`}
                  items={buildProductActions({
                    product: p,
                    canManage: canManageProducts,
                    onEdit: () => onOpen(p),
                    onPreview: () => onPreview(p),
                    onArchive: () => onArchive(p),
                  })}
                />
              </div>
            </div>

            <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/70 pt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <dt className="text-faint">التصنيف:</dt>
                <dd>
                  {p.category ? <Badge tone="brand">{p.category}</Badge> : <span className="text-faint">—</span>}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-faint">الحالة:</dt>
                <dd>
                  <Badge tone={PRODUCT_STATUS_META[p.status].tone}>
                    {PRODUCT_STATUS_META[p.status].label}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-faint">المخزون:</dt>
                <dd>
                  <StockCell />
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-faint">أُنشئ في:</dt>
                <dd className="text-muted">{formatDateOnly(p.createdAt)}</dd>
              </div>
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}
