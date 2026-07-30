import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { createProduct, type ProductCreated } from "../api";
import { errorMsg } from "../errors";
import { toCentimes } from "../pricing";
import { PRODUCT_STATUS_OPTIONS } from "../status";
import type { ProductStatus } from "../types";

const EMPTY = {
  name: "",
  category: "",
  sku: "",
  basePrice: "",
  offerPrice: "",
  compareAtPrice: "",
  description: "",
  status: "DRAFT" as ProductStatus,
};

/**
 * Create-product form.
 *
 * Only the fields the create endpoint accepts are here. Colours, sizes and
 * media belong to the product detail page and are added after creation, which
 * is why a new product starts as a DRAFT — `onCreated` hands the caller the new
 * product so it can send the admin straight there to finish the setup.
 *
 * Prices are typed in dirhams and converted to the integer centimes the API
 * stores; the conversion lives in `../pricing` so the form and the table agree.
 */
export function ProductFormDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (product: ProductCreated) => void;
}) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset between openings so a cancelled draft never resurfaces.
  useEffect(() => {
    if (open) {
      setF(EMPTY);
      setError(null);
    }
  }, [open]);

  const set = (patch: Partial<typeof EMPTY>) => setF((prev) => ({ ...prev, ...patch }));

  const base = toCentimes(f.basePrice);
  const offer = toCentimes(f.offerPrice);
  const compareAt = toCentimes(f.compareAtPrice);
  const nameOk = f.name.trim().length >= 2;
  const canSubmit = nameOk && base !== null && !busy;

  async function submit() {
    if (base === null || !nameOk) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createProduct({
        name: f.name.trim(),
        category: f.category.trim() || null,
        sku: f.sku.trim() || null,
        description: f.description.trim() || null,
        basePrice: base,
        offerPrice: offer,
        compareAtPrice: compareAt,
        status: f.status,
      });
      onCreated(res.data);
    } catch (e) {
      setError(errorMsg(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onClose={busy ? () => undefined : onClose} title="منتج جديد">
      <div className="space-y-4">
        <Input
          label="اسم المنتج *"
          value={f.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="مثال: بوركيني Cache Terazo"
          autoFocus
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="التصنيف"
            value={f.category}
            onChange={(e) => set({ category: e.target.value })}
            placeholder="بوركيني"
          />
          <Input
            label="SKU"
            value={f.sku}
            onChange={(e) => set({ sku: e.target.value })}
            placeholder="NK-CT-001"
            dir="ltr"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="السعر (درهم) *"
            value={f.basePrice}
            onChange={(e) => set({ basePrice: e.target.value })}
            inputMode="decimal"
            placeholder="299"
          />
          <Input
            label="سعر العرض"
            value={f.offerPrice}
            onChange={(e) => set({ offerPrice: e.target.value })}
            inputMode="decimal"
            placeholder="259"
          />
          <Input
            label="السعر القديم"
            value={f.compareAtPrice}
            onChange={(e) => set({ compareAtPrice: e.target.value })}
            inputMode="decimal"
            placeholder="349"
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">الوصف</span>
          <textarea
            value={f.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={4}
            placeholder="وصف المنتج كما يظهر للزبون…"
            className="w-full rounded-xl border border-line bg-bg p-3 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <Select
          label="الحالة"
          value={f.status}
          onChange={(e) => set({ status: e.target.value as ProductStatus })}
        >
          {PRODUCT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <p className="rounded-xl bg-brand-soft/50 p-3 text-xs leading-relaxed text-muted">
          سيُنشأ المنتج كمسودة افتراضياً. أضِف الألوان والمقاسات والصور من صفحة المنتج، ثم غيّر حالته إلى
          «نشط» لعرضه في المتجر.
        </p>

        {error && (
          <p className="rounded-xl bg-danger-soft p-3 text-sm font-bold text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            إنشاء المنتج
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
