import { Badge } from "@/components/ui/Badge";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { DataCardList } from "@/components/ui/DataCardList";
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
    <DataCardList
      items={products}
      getKey={(p) => p.id}
      onOpen={onOpen}
      renderHead={(p) => (
        <>
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
                onDuplicate: () => onDuplicate(p),
                onArchive: () => onArchive(p),
                onDelete: () => onDelete(p),
              })}
            />
          </div>
        </>
      )}
      getFields={(p) => [
        {
          label: "التصنيف",
          value: p.category ? <Badge tone="brand">{p.category}</Badge> : <span className="text-faint">—</span>,
        },
        {
          label: "الحالة",
          value: (
            <Badge tone={PRODUCT_STATUS_META[p.status].tone}>{PRODUCT_STATUS_META[p.status].label}</Badge>
          ),
        },
        { label: "المخزون", value: <StockCell /> },
        { label: "أُنشئ في", value: <span className="text-muted">{formatDateOnly(p.createdAt)}</span> },
      ]}
    />
  );
}
