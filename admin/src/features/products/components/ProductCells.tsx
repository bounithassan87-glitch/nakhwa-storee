/**
 * Presentation atoms shared by the products table (desktop) and the product
 * cards (mobile). Keeping them here means the two layouts can never drift in
 * how a price, a stock state or the featured flag is rendered.
 */
import { ImageOff, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";
import { discountPercent, effectivePrice } from "../pricing";
import type { ProductListItem } from "../types";

export function Thumb({ url, alt, size = "md" }: { url: string | null; alt: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-14 w-14" : "h-11 w-11";
  if (!url) {
    return (
      <span
        className={cn("grid shrink-0 place-items-center rounded-xl bg-line/50 text-faint", box)}
        title="لا توجد صورة"
      >
        <ImageOff className="h-4 w-4" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={cn("shrink-0 rounded-xl border border-line object-cover", box)}
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

/** Live selling price. Highlighted when an offer price is undercutting the base. */
export function PriceCell({ product }: { product: ProductListItem }) {
  const onOffer = product.offerPrice != null && product.offerPrice < product.basePrice;
  return (
    <span className={cn("font-bold", onOffer ? "text-success" : "text-ink")}>
      {formatMoney(effectivePrice(product))}
    </span>
  );
}

/** "Was" price with the discount it represents. */
export function OldPriceCell({ product }: { product: ProductListItem }) {
  const pct = discountPercent(product);
  if (product.compareAtPrice == null) return <span className="text-faint">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-muted line-through">{formatMoney(product.compareAtPrice)}</span>
      {pct != null && <Badge tone="danger">-{pct}%</Badge>}
    </span>
  );
}

/**
 * Stock indicator.
 *
 * There is deliberately no stock value anywhere in the data model — `Product`
 * has no inventory column and this milestone ships without a migration. Rather
 * than invent a number, the cell states plainly that inventory tracking is not
 * available yet, so nobody mistakes a placeholder for a real count.
 */
export function StockCell() {
  return (
    <span
      className="inline-flex items-center rounded-full bg-line/60 px-2.5 py-1 text-xs font-bold text-faint"
      title="تتبّع المخزون غير مفعّل بعد — سيُضاف مع نظام إدارة المخزون."
    >
      غير متاح
    </span>
  );
}

/** Star toggle. Renders read-only (no button) for roles that cannot persist it. */
export function FeaturedToggle({
  active,
  canManage,
  busy,
  onToggle,
}: {
  active: boolean;
  canManage: boolean;
  busy?: boolean;
  onToggle: () => void;
}) {
  const star = (
    <Star className={cn("h-4 w-4 transition", active ? "fill-gold text-gold" : "text-faint")} />
  );

  if (!canManage) {
    return (
      <span
        className="grid h-9 w-9 place-items-center"
        title={active ? "منتج مميّز" : "غير مميّز"}
        aria-label={active ? "منتج مميّز" : "غير مميّز"}
      >
        {star}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={active}
      title={active ? "إزالة التمييز" : "تمييز المنتج"}
      aria-label={active ? "إزالة التمييز" : "تمييز المنتج"}
      className="grid h-9 w-9 place-items-center rounded-xl transition hover:bg-brand-soft active:scale-90 disabled:opacity-40"
    >
      {star}
    </button>
  );
}
