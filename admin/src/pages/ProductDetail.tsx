import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowRight,
  ShoppingBag,
  Wallet,
  Palette,
  Ruler,
  Percent,
  AlertCircle,
  PackageX,
  Save,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaManager } from "@/features/products/components/MediaManager";
import { ColorsManager } from "@/features/products/components/ColorsManager";
import { SizesManager } from "@/features/products/components/SizesManager";
import { PRODUCT_STATUS_META, PRODUCT_STATUS_OPTIONS } from "@/features/products/status";
import { updateProduct, archiveProduct } from "@/features/products/api";
import { useProduct } from "@/features/products/useProduct";
import { formatMoney, formatDate, formatDateOnly } from "@/lib/format";
import type { ProductStatus } from "@/features/products/types";

const toDh = (c: number | null) => (c == null ? "" : String(c / 100));
const toCentimes = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { product, loading, error, notFound, refetch } = useProduct(id);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    sku: "",
    category: "",
    description: "",
    basePrice: "",
    offerPrice: "",
    compareAtPrice: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  // Sync the form whenever the product (re)loads.
  useEffect(() => {
    if (!product) return;
    setForm({
      name: product.name,
      slug: product.slug,
      sku: product.sku ?? "",
      category: product.category ?? "",
      description: product.description ?? "",
      basePrice: toDh(product.basePrice),
      offerPrice: toDh(product.offerPrice),
      compareAtPrice: toDh(product.compareAtPrice),
    });
  }, [product]);

  const back = (
    <Link to="/products" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink">
      <ArrowRight className="h-4 w-4" /> رجوع إلى المنتجات
    </Link>
  );

  if (loading) {
    return (
      <>
        {back}
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }
  if (notFound) {
    return (
      <>
        {back}
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState icon={PackageX} title="المنتج غير موجود" description="ربما تم حذف هذا المنتج أو أن الرابط غير صحيح."
            action={<Button onClick={() => navigate("/products")}>عودة للائحة</Button>} />
        </div>
      </>
    );
  }
  if (error || !product) {
    return (
      <>
        {back}
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState icon={AlertCircle} title="حدث خطأ" description={error ?? "تعذّر تحميل المنتج."}
            action={<Button onClick={refetch}>إعادة المحاولة</Button>} />
        </div>
      </>
    );
  }

  async function onSave() {
    if (!product) return;
    setSaving(true);
    try {
      await updateProduct(product.id, {
        name: form.name.trim(),
        slug: form.slug.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        basePrice: toCentimes(form.basePrice) ?? product.basePrice,
        offerPrice: toCentimes(form.offerPrice),
        compareAtPrice: toCentimes(form.compareAtPrice),
      });
      void refetch();
      notify("تم حفظ التغييرات");
    } catch (e) {
      const m = (e as Error).message;
      notify(m === "duplicate_slug_or_sku" ? "الرابط أو SKU مستخدم مسبقاً." : m === "validation_error" ? "تحقّقي من الحقول." : "تعذّر الحفظ.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: ProductStatus) {
    if (!product) return;
    try {
      await updateProduct(product.id, { status });
      void refetch();
      notify("تم تغيير الحالة");
    } catch {
      notify("تعذّر تغيير الحالة.");
    }
  }

  async function onArchive() {
    if (!product) return;
    try {
      await archiveProduct(product.id);
      void refetch();
      notify("تمت أرشفة المنتج (حذف ناعم)");
    } catch {
      notify("تعذّرت الأرشفة.");
    }
  }

  const s = product.stats;

  return (
    <>
      {back}

      {/* Header */}
      <Card className="mb-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-black text-ink">{product.name}</h2>
              <Badge tone={PRODUCT_STATUS_META[product.status].tone}>{PRODUCT_STATUS_META[product.status].label}</Badge>
            </div>
            <p className="mt-1 text-xs text-faint">
              SEO: <span dir="ltr">/{product.slug}</span> · أُنشئ {formatDateOnly(product.createdAt)} · آخر تحديث {formatDate(product.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRODUCT_STATUS_OPTIONS.map((o) => (
              <Button
                key={o.value}
                size="sm"
                variant={product.status === o.value ? "primary" : "secondary"}
                onClick={() => setStatus(o.value)}
                disabled={product.status === o.value}
              >
                {o.label}
              </Button>
            ))}
            {product.status !== "ARCHIVED" && (
              <Button size="sm" variant="danger" onClick={onArchive}>
                <PackageX className="h-4 w-4" /> حذف (أرشفة)
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Statistics */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="عدد الطلبات" value={String(s.ordersCount)} icon={ShoppingBag} />
        <StatCard label="الإيراد" value={formatMoney(s.revenue)} icon={Wallet} />
        <StatCard label="أفضل لون" value={s.bestColor ?? "—"} icon={Palette} />
        <StatCard label="أفضل مقاس" value={s.bestSize ?? "—"} icon={Ruler} />
        <StatCard label="نسبة الإلغاء" value={`${Math.round(s.cancellationRate * 100)}٪`} icon={Percent} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Editable details + pricing */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-ink">المعلومات الأساسية</h3>
              <Button size="sm" onClick={onSave} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "جارٍ الحفظ…" : "حفظ"}
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="اسم المنتج" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="الرابط (Slug)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} dir="ltr" />
              <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} dir="ltr" />
              <Input label="التصنيف" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-bold text-ink">الوصف</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full resize-y rounded-xl border border-line bg-bg p-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Input label="السعر العادي (درهم)" type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} />
              <Input label="سعر العرض (درهم)" type="number" value={form.offerPrice} onChange={(e) => setForm({ ...form, offerPrice: e.target.value })} />
              <Input label="السعر قبل التخفيض (درهم)" type="number" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
            </div>
          </Card>

          <MediaManager productId={product.id} media={product.media} onChanged={refetch} notify={notify} />
        </div>

        {/* Colors + sizes */}
        <div className="space-y-4">
          <ColorsManager productId={product.id} colors={product.colors} onChanged={refetch} notify={notify} />
          <SizesManager productId={product.id} sizes={product.sizes} onChanged={refetch} notify={notify} />
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-sidebar px-4 py-2 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
