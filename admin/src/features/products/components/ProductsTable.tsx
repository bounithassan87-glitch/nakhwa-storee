import { ImageOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { PRODUCT_STATUS_META } from "../status";
import type { ProductListItem } from "../types";

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-line/50 text-faint">
        <ImageOff className="h-4 w-4" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

export function ProductsTable({
  products,
  onOpen,
}: {
  products: ProductListItem[];
  onOpen: (p: ProductListItem) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-line bg-brand-soft/40 text-muted">
              <th className="whitespace-nowrap px-4 py-3 font-bold">المنتج</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">SKU</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">السعر</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">سعر العرض</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">الحالة</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">الطلبات</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">الإيراد</th>
              <th className="whitespace-nowrap px-4 py-3 font-bold">أُنشئ في</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={p.id}
                onClick={() => onOpen(p)}
                className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-brand-soft/20"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Thumb url={p.image} alt={p.name} />
                    <div className="min-w-0">
                      <div className="font-bold text-ink">{p.name}</div>
                      <div className="text-xs text-muted">
                        {p.category ?? "—"} · {p.colorsCount} لون · {p.sizesCount} مقاس
                      </div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted" dir="ltr">{p.sku ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{formatMoney(p.basePrice)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {p.offerPrice != null ? (
                    <span className="font-bold text-success">{formatMoney(p.offerPrice)}</span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={PRODUCT_STATUS_META[p.status].tone}>{PRODUCT_STATUS_META[p.status].label}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{p.ordersCount}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{formatMoney(p.revenue)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateOnly(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
